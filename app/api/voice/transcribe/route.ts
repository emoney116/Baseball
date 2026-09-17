import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import {
  assertPlayerLinkTeamManager,
  PlayerLinkError,
} from "../../../lib/playerAccountLinks";
import { validateVoiceWav, VOICE_MAX_BYTES, VOICE_MAX_SECONDS } from "../../../lib/voiceAudio";
import { voiceTokenConfidence } from "../../../lib/voiceTranscriptionConfidence";
import { voiceDeploymentEnabled } from "../../../lib/voiceAvailability";
import { voiceTranscriptionModel } from "../../../lib/voiceModel";

export const runtime = "nodejs";
export const maxDuration = 30;
const reply = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_CLUBHOUSE_VOICE_ENABLED !== "true" || !voiceDeploymentEnabled(process.env.VERCEL_ENV, process.env.NODE_ENV, process.env.VOICE_ENABLED))
    return reply({ message: "Voice unavailable - use manual entry." }, 503);
  const started = Date.now();
  let reservation:
    | { id: string; db: ReturnType<typeof createAdminClient> }
    | undefined;
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin)
      return reply({ message: "Voice request unavailable." }, 403);
    const { data, error } = await (await createClient()).auth.getUser();
    if (error || !data.user)
      return reply({ message: "Sign in to use Voice." }, 401);
    const apiKey = process.env.OPENAI_VOICE_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey)
      return reply({ message: "Voice unavailable - use manual entry." }, 503);
    const url = new URL(request.url),
      practiceId = url.searchParams.get("practiceId"),
      id = url.searchParams.get("requestId");
    if (
      !practiceId ||
      !id ||
      ![practiceId, id].every((v) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          v,
        ),
      )
    )
      return reply({ message: "Choose an active Practice." }, 400);
    const db = createAdminClient();
    const practice = await db
      .from("practices")
      .select("id,team_id,ended_at,status,starts_at")
      .eq("id", practiceId)
      .maybeSingle();
    if (practice.error || !practice.data)
      return reply({ message: "Practice unavailable." }, 404);
    await assertPlayerLinkTeamManager(db, data.user.id, practice.data.team_id);
    if (
      practice.data.ended_at ||
      practice.data.status !== "active" ||
      (practice.data.starts_at &&
        Date.parse(practice.data.starts_at) > Date.now())
    )
      return reply({ message: "Choose a Practice currently underway." }, 409);
    if (request.headers.get("content-type") !== "audio/wav")
      return reply({ message: "Unsupported audio format." }, 415);
    const reader = request.body?.getReader();
    if (!reader) return reply({ message: "Audio is missing." }, 400);
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > VOICE_MAX_BYTES) {
        await reader.cancel();
        return reply({ message: `Audio must be at most ${VOICE_MAX_SECONDS} seconds.` }, 413);
      }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const seconds = validateVoiceWav(bytes);
    const reserved = await db.rpc("reserve_voice_usage", {
      p_request_id: id,
      p_actor_id: data.user.id,
      p_team_id: practice.data.team_id,
      p_practice_id: practiceId,
      p_audio_seconds: seconds,
    });
    if (reserved.error)
      return reply({ message: "Voice unavailable - use manual entry." }, 503);
    if (!reserved.data)
      return reply(
        {
          message:
            "Voice request already used or limit reached. Use manual entry or try again shortly.",
        },
        429,
      );
    reservation = { id, db };
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: "audio/wav" }), "event.wav");
    const model = voiceTranscriptionModel(process.env.OPENAI_VOICE_TRANSCRIBE_MODEL);
    form.append("model", model);
    form.append("language", "en");
    // Very short control phrases can otherwise echo the vocabulary prompt as speech.
    if (seconds > 3) form.append("prompt", "Baseball practice vocabulary: hitting, pitching, at-bat, ball, ball outside, ball away, fastball, four-seam, slider, changeup, curveball, cutter, swing and miss, whiff, called strike, foul, exit velo, left center, right field.");
    form.append("response_format", "json");
    form.append("include[]", "logprobs");
    const response = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
      },
    );
    if (!response.ok) {
      if(response.status===429){
        await db.from('voice_usage').update({status:'failed',failure_code:'rate_limited',latency_ms:Date.now()-started}).eq('request_id',id);
        return reply({message:'Voice provider is busy. Captured audio can be retried; manual entry remains available.'},429);
      }
      throw new Error("provider");
    }
    const result = await response.json();
    if (
      typeof result.text !== "string" ||
      !result.text.trim() ||
      result.text.length > 700 ||
      /baseball practice vocabulary/i.test(result.text)
    )
      throw new Error("transcript");
    const confidence = voiceTokenConfidence(result.logprobs);
    const costPerMinute = Number(process.env.VOICE_COST_USD_PER_MINUTE);
    await db
      .from("voice_usage")
      .update({
        status: "completed",
        model,
        latency_ms: Date.now() - started,
        estimated_cost_usd:
          Number.isFinite(costPerMinute) && costPerMinute > 0
            ? (seconds * costPerMinute) / 60
            : null,
      })
      .eq("request_id", id);
    return reply({
      transcript: result.text,
      confidence,
      model,
      requestId: id,
      latencyMs: Date.now() - started,
      ...(process.env.VERCEL_ENV === 'preview' && Array.isArray(result.logprobs) ? {
        confidenceEvidence: result.logprobs
          .filter((token: {token?: string; logprob?: number}) => typeof token.token === 'string' && /[a-z0-9]/i.test(token.token) && typeof token.logprob === 'number' && Number.isFinite(token.logprob))
          .sort((a: {logprob:number}, b: {logprob:number}) => a.logprob-b.logprob).slice(0,5)
          .map((token: {token:string;logprob:number}) => `${JSON.stringify(token.token)} ${Math.exp(token.logprob).toFixed(4)}`).join('; '),
      } : {}),
    });
  } catch (error) {
    if (reservation)
      await reservation.db
        .from("voice_usage")
        .update({
          status: "failed",
          failure_code:
            error instanceof Error && error.name === "TimeoutError"
              ? "timeout"
              : "unavailable",
          latency_ms: Date.now() - started,
        })
        .eq("request_id", reservation.id);
    return reply(
      {
        message:
          error instanceof PlayerLinkError
            ? error.message
            : "Voice unavailable - use manual entry.",
      },
      error instanceof PlayerLinkError ? error.status : 503,
    );
  }
}

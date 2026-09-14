import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import {
  assertPlayerLinkTeamManager,
  PlayerLinkError,
} from "../../../lib/playerAccountLinks";
import { validateVoiceWav, VOICE_MAX_BYTES } from "../../../lib/voiceAudio";

export const runtime = "nodejs";
export const maxDuration = 30;
const reply = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function POST(request: Request) {
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
        return reply({ message: "Audio must be at most 12 seconds." }, 413);
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
    form.append("model", "whisper-1");
    form.append("language", "en");
    form.append("response_format", "verbose_json");
    const response = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
      },
    );
    if (!response.ok) throw new Error("provider");
    const result = await response.json();
    if (
      typeof result.text !== "string" ||
      !result.text.trim() ||
      result.text.length > 700
    )
      throw new Error("transcript");
    const segments = Array.isArray(result.segments) ? result.segments : [];
    const confidence =
      segments.length &&
      segments.every(
        (s: { avg_logprob?: number; no_speech_prob?: number }) =>
          typeof s.avg_logprob === "number" &&
          typeof s.no_speech_prob === "number",
      )
        ? Math.min(
            ...segments.map(
              (s: { avg_logprob: number; no_speech_prob: number }) =>
                Math.min(Math.exp(s.avg_logprob), 1 - s.no_speech_prob),
            ),
          )
        : null;
    const costPerMinute = Number(process.env.VOICE_COST_USD_PER_MINUTE);
    await db
      .from("voice_usage")
      .update({
        status: "completed",
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
      requestId: id,
      latencyMs: Date.now() - started,
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

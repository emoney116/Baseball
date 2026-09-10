import { NextResponse } from "next/server";
import { createClient } from "../../lib/supabase/server";
import { createAdminClient } from "../../lib/supabase/admin";
import {
  assertPlayerLinkTeamManager,
  PlayerLinkError,
} from "../../lib/playerAccountLinks";
import {
  buildBpPitch,
  validateBpSettings,
  validateBpState,
  type BpRound,
} from "../../lib/liveBp";

async function context(request: Request) {
  const { data, error } = await (await createClient()).auth.getUser();
  if (error || !data.user)
    throw new PlayerLinkError("Sign in to use Live BP.", 401);
  const db = createAdminClient();
  const practiceId = new URL(request.url).searchParams.get("practiceId");
  if (!practiceId || !/^[0-9a-f-]{36}$/i.test(practiceId))
    throw new PlayerLinkError("Choose a saved Practice.");
  const practice = await db
    .from("practices")
    .select("id,team_id")
    .eq("id", practiceId)
    .maybeSingle();
  if (practice.error || !practice.data)
    throw new PlayerLinkError("Practice unavailable.", 404);
  await assertPlayerLinkTeamManager(db, data.user.id, practice.data.team_id);
  return { db, actor: data.user.id, practiceId };
}
function failure(error: unknown) {
  return NextResponse.json(
    {
      message:
        error instanceof PlayerLinkError
          ? error.message
          : "Unable to save Live BP. Your draft is still available.",
    },
    {
      status: error instanceof PlayerLinkError ? error.status : 400,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
export async function GET(request: Request) {
  try {
    const { db, practiceId } = await context(request);
    const { data, error } = await db
      .from("live_bp_rounds")
      .select("*")
      .eq("practice_id", practiceId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw error;
    return NextResponse.json(
      { rounds: data },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    const { db, actor, practiceId } = await context(request);
    const text = await request.text();
    if (text.length > 16000)
      throw new PlayerLinkError("Live BP request is too large.");
    const body = JSON.parse(text);
    if (
      !["start", "configure", "pitch", "end"].includes(body.operation) ||
      !/^[0-9a-f-]{36}$/i.test(body.roundId)
    )
      throw new PlayerLinkError("Choose a Live BP round.");
    let payload = {};
    try {
      if (body.operation === "start" || body.operation === "configure") {
        validateBpSettings(body.settings);
        validateBpState(body.state);
        payload = { settings: body.settings, state: body.state };
      } else if (body.operation === "pitch") {
        if (!/^[0-9a-f-]{36}$/i.test(body.requestId))
          throw new Error("Invalid pitch request.");
        const read = await db
          .from("live_bp_rounds")
          .select("*")
          .eq("id", body.roundId)
          .eq("practice_id", practiceId)
          .single();
        if (read.error) throw new PlayerLinkError("Round unavailable.", 404);
        const round = read.data as BpRound;
        // A committed BIP may have advanced the runners. Check its identity before
        // validating an uncertain retry against the newer situation.
        const prior = await db
          .from("hitting_events")
          .select("id")
          .eq("id", body.requestId)
          .eq("live_bp_round_id", round.id)
          .eq("created_by_profile_id", actor)
          .maybeSingle();
        if (prior.error)
          throw new PlayerLinkError(
            "Unable to verify this pitch. Retry shortly.",
            503,
          );
        payload = prior.data
          ? {}
          : buildBpPitch(round.settings, round.state, body.draft);
      }
    } catch (error) {
      if (error instanceof PlayerLinkError) throw error;
      throw new PlayerLinkError(
        error instanceof Error ? error.message : "Check the pitch.",
      );
    }
    const { data, error } = await db.rpc("write_live_bp", {
      actor,
      practice: practiceId,
      round_id: body.roundId,
      operation: body.operation,
      expected_version: body.version ?? 0,
      request_id: body.requestId ?? null,
      payload,
    });
    if (error?.code === "55000")
      return NextResponse.json(
        { message: "Practice or Live BP has ended.", ended: true },
        { status: 409 },
      );
    if (error)
      throw new PlayerLinkError(
        error.code === "42501"
          ? "Your roster or coach access changed. Reload before continuing."
          : error.code === "40001"
            ? "This round changed elsewhere. Reload before continuing."
            : "Unable to save this pitch. Your draft is still available.",
        error.code === "42501" ? 403 : 409,
      );
    return NextResponse.json(
      { round: data },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}

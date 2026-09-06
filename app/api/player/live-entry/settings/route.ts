import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import {
  assertPlayerLinkTeamManager,
  PlayerLinkError,
} from "../../../../lib/playerAccountLinks";
import {
  LIVE_DOMAINS,
  LIVE_FIELDS,
  type LiveDomain,
} from "../../../../lib/playerLiveModels";

async function authorize(teamId: string) {
  const {
    data: { user },
    error,
  } = await (await createClient()).auth.getUser();
  if (error || !user) throw new PlayerLinkError("Sign in to continue.", 401);
  const db = createAdminClient();
  await assertPlayerLinkTeamManager(db, user.id, teamId);
  return { db, actor: user.id };
}
function reply(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
function fail(e: unknown) {
  return reply(
    {
      message:
        e instanceof PlayerLinkError
          ? e.message
          : "Unable to manage live entry.",
    },
    e instanceof PlayerLinkError ? e.status : 400,
  );
}
export async function GET(request: NextRequest) {
  try {
    const teamId = request.nextUrl.searchParams.get("teamId") ?? "",
      sessionId = request.nextUrl.searchParams.get("sessionId") ?? "",
      domain = request.nextUrl.searchParams.get("domain") as LiveDomain;
    const { db } = await authorize(teamId);
    if (!LIVE_DOMAINS.includes(domain))
      throw new PlayerLinkError("Choose a session.");
    if (domain === "workout") {
      const { data, error } = await db
        .from("weight_room_workouts")
        .select("player_entry_enabled")
        .eq("id", sessionId)
        .eq("team_id", teamId)
        .single();
      if (error)
        throw new PlayerLinkError(
          "Save the workout before enabling player entry.",
          409,
        );
      return reply({ enabled: data.player_entry_enabled, fields: [] });
    }
    const { data, error } = await db
      .from("practice_sessions")
      .select("entry_policy,metadata,practice_id")
      .eq("id", sessionId)
      .eq("category", domain)
      .single();
    if (error)
      throw new PlayerLinkError(
        "Save the station before enabling player entry.",
        409,
      );
    const parent = await db
      .from("practices")
      .select("id")
      .eq("id", data.practice_id)
      .eq("team_id", teamId)
      .single();
    if (parent.error) throw new PlayerLinkError("Session unavailable.", 403);
    return reply({
      enabled: data.entry_policy !== "COACH_ONLY",
      fields: (data.metadata?.playerEntryFields ?? []).filter((k: string) =>
        LIVE_FIELDS[domain].some((f) => f.key === k),
      ),
    });
  } catch (e) {
    return fail(e);
  }
}
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    if (
      !body ||
      typeof body.teamId !== "string" ||
      typeof body.sessionId !== "string" ||
      typeof body.enabled !== "boolean" ||
      !LIVE_DOMAINS.includes(body.domain) ||
      !Array.isArray(body.fields) ||
      body.fields.length > 15 ||
      body.fields.some(
        (f: unknown) =>
          typeof f !== "string" ||
          !LIVE_FIELDS[body.domain as LiveDomain].some(
            (field) => field.key === f,
          ),
      )
    )
      throw new PlayerLinkError("Invalid live-entry settings.");
    const { db, actor } = await authorize(body.teamId);
    const { error } = await db.rpc("configure_player_live_entry", {
      actor,
      target_team: body.teamId,
      domain: body.domain,
      target_session: body.sessionId,
      enabled: body.enabled,
      fields: body.fields,
    });
    if (error)
      throw new PlayerLinkError(
        "Unable to enable entry. Check that the saved session is running and assigned to a roster player.",
        409,
      );
    return reply({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

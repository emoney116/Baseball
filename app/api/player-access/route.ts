import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../lib/supabase/server";
import { createAdminClient } from "../../lib/supabase/admin";
import {
  assertPlayerLinkTeamManager,
  PlayerLinkError,
} from "../../lib/playerAccountLinks";
import { isPlayerAccessMode, isPlayerTrackingPolicy } from "../../lib/playerCapabilities";
import { labelExactRoster, playerSelectionLabel } from "../../lib/exactRosterIdentity";
async function authorized(teamId: string) {
  const {
    data: { user },
    error,
  } = await (await createClient()).auth.getUser();
  if (error || !user) throw new PlayerLinkError("Sign in to continue.", 401);
  const db = createAdminClient();
  await assertPlayerLinkTeamManager(db, user.id, teamId);
  return { db, user };
}
export async function GET(request: NextRequest) {
  try {
    const teamId = request.nextUrl.searchParams.get("teamId") ?? "",
      seasonId = request.nextUrl.searchParams.get("seasonId") ?? "";
    const { db } = await authorized(teamId);
    const [team, overrides, memberships] = await Promise.all([
      db
        .from("teams")
        .select("player_access_default,player_tracking_policy")
        .eq("id", teamId)
        .single(),
      db
        .from("player_access_overrides")
        .select("player_id,access_mode")
        .eq("team_id", teamId),
      db
        .from("player_team_memberships")
        .select("id,player_id,jersey_number")
        .eq("team_id", teamId)
        .eq("season_id", seasonId)
        .eq("active", true)
        .order("jersey_number")
        .limit(500),
    ]);
    if (team.error || overrides.error || memberships.error)
      throw new PlayerLinkError("Unable to load access settings.", 503);
    const ids = (memberships.data ?? []).map((m) => m.player_id);
    const players = ids.length
      ? await db
          .from("players")
          .select("id,first_name,last_name,created_at")
          .in("id", ids)
          .eq("active", true)
      : { data: [], error: null };
    if (players.error) throw new PlayerLinkError("Unable to load roster.", 503);
    const links = ids.length
      ? await db.from("profile_player_links").select("player_id")
          .in("player_id", ids).eq("relationship_type", "PLAYER").eq("status", "APPROVED")
      : { data: [], error: null };
    if (links.error) throw new PlayerLinkError("Unable to load roster account status.", 503);
    const labeledPlayers = labelExactRoster(
      (players.data ?? []).map(p => ({ ...p, name: `${p.first_name} ${p.last_name}`, createdAt: p.created_at })),
      (links.data ?? []).map(l => l.player_id),
    );
    return NextResponse.json(
      {
        teamDefault: team.data.player_access_default,
        trackingPolicy: team.data.player_tracking_policy,
        roster: (memberships.data ?? []).flatMap((m) => {
          const p = labeledPlayers.find((p) => p.id === m.player_id);
          return p
            ? [
                {
                  playerId: p.id,
                  membershipId: m.id,
                  name: `${m.jersey_number == null ? "" : `#${m.jersey_number} `}${playerSelectionLabel(p)}`,
                  override:
                    overrides.data?.find((o) => o.player_id === p.id)
                      ?.access_mode ?? null,
                },
              ]
            : [];
        }),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return fail(e);
  }
}
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    if (body && typeof body.teamId === "string" && isPlayerTrackingPolicy(body.trackingPolicy) && body.mode === undefined && body.playerId == null) {
      const { db, user } = await authorized(body.teamId);
      const { error } = await db.rpc("set_player_tracking_policy", { actor: user.id, target_team: body.teamId, new_policy: body.trackingPolicy });
      if (error) throw new PlayerLinkError("Unable to change team tracking policy.", 403);
      return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    }
    if (
      !body ||
      typeof body.teamId !== "string" ||
      (body.mode !== null && !isPlayerAccessMode(body.mode)) ||
      (body.playerId != null && typeof body.playerId !== "string")
    )
      throw new PlayerLinkError("Invalid access setting.");
    const { db, user } = await authorized(body.teamId);
    const { error } = await db.rpc("set_player_access_mode", {
      actor: user.id,
      target_team: body.teamId,
      target_player: body.playerId ?? null,
      new_mode: body.mode,
    });
    if (error)
      throw new PlayerLinkError(
        "Unable to change access. Check your team authority and selected player.",
        403,
      );
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return fail(e);
  }
}
function fail(e: unknown) {
  return NextResponse.json(
    {
      message:
        e instanceof PlayerLinkError ? e.message : "Unable to manage access.",
    },
    { status: e instanceof PlayerLinkError ? e.status : 400 },
  );
}

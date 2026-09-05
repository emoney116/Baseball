import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../lib/supabase/server";
import { createAdminClient } from "../../lib/supabase/admin";
import {
  assertPlayerLinkTeamManager,
  PlayerLinkError,
} from "../../lib/playerAccountLinks";
import {
  createPlayerInvitation,
  changePlayerInvitation,
  playerInviteFields,
} from "../../lib/playerInvitations";
import { sendPlayerInviteEmail } from "../../lib/email/playerInvite";
import { requestSiteUrl } from "../../lib/siteUrl";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    const {
      data: { user },
    } = await (await createClient()).auth.getUser();
    if (!user) throw new PlayerLinkError("Sign in to continue.", 401);
    const db = createAdminClient(),
      teamId = request.nextUrl.searchParams.get("teamId") ?? "";
    await assertPlayerLinkTeamManager(db, user.id, teamId);
    const { data, error } = await db
      .from("player_invitations")
      .select(playerInviteFields)
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new PlayerLinkError("Unable to load invitations.", 503);
    const { data: memberships, error: membershipError } = await db
      .from("player_team_memberships")
      .select("id,player_id,jersey_number")
      .eq("team_id", teamId)
      .eq("season_id", request.nextUrl.searchParams.get("seasonId") ?? "")
      .eq("active", true);
    if (membershipError)
      throw new PlayerLinkError("Unable to load roster.", 503);
    const ids = (memberships ?? []).map((m) => m.player_id);
    const { data: players, error: playerError } = ids.length
      ? await db
          .from("players")
          .select("id,first_name,last_name")
          .in("id", ids)
          .eq("active", true)
      : { data: [], error: null };
    if (playerError) throw new PlayerLinkError("Unable to load roster.", 503);
    const roster = (memberships ?? []).flatMap((m) => {
      const p = players?.find((p) => p.id === m.player_id);
      return p
        ? [
            {
              membershipId: m.id,
              name: `${m.jersey_number !== null ? `#${m.jersey_number} ` : ""}${p.first_name} ${p.last_name}`,
            },
          ]
        : [];
    });
    return NextResponse.json(
      { invitations: data, roster },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return fail(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    const {
      data: { user },
    } = await (await createClient()).auth.getUser();
    if (!user) throw new PlayerLinkError("Sign in to continue.", 401);
    const db = createAdminClient(),
      body = await request.json();
    if (!body || typeof body.teamId !== "string")
      throw new PlayerLinkError("Choose a team.");
    if (body.action === "revoke" || body.action === "resend") {
      const result = await changePlayerInvitation(db, user.id, body);
      const email = result.token
        ? await sendPlayerInviteEmail(
            result.invitation.invited_email,
            `${requestSiteUrl(request)}/join/player/${result.token}`,
            "your roster identity",
          )
        : undefined;
      return NextResponse.json({ invitation: result.invitation, email });
    }
    const entries = Array.isArray(body.entries) ? body.entries : [];
    if (
      entries.length < 1 ||
      entries.length > 60 ||
      typeof body.seasonId !== "string"
    )
      throw new PlayerLinkError("Select between 1 and 60 roster players.");
    // Validate authority before processing any batch entry; each result is explicit.
    await assertPlayerLinkTeamManager(db, user.id, body.teamId);
    const results = [];
    for (const entry of entries) {
      try {
        const result = await createPlayerInvitation(db, user.id, {
          teamId: body.teamId,
          seasonId: body.seasonId,
          membershipId: entry.membershipId,
          email: entry.email,
        });
        const email = await sendPlayerInviteEmail(
          result.invitation.invited_email,
          `${requestSiteUrl(request)}/join/player/${result.token}`,
          result.playerName,
        );
        results.push({
          membershipId: entry.membershipId,
          invitation: result.invitation,
          email,
        });
      } catch (error) {
        results.push({
          membershipId: entry?.membershipId,
          message:
            error instanceof PlayerLinkError
              ? error.message
              : "Unable to invite this player.",
        });
      }
    }
    return NextResponse.json({ results });
  } catch (error) {
    return fail(error);
  }
}
function fail(error: unknown) {
  return NextResponse.json(
    {
      message:
        error instanceof PlayerLinkError
          ? error.message
          : "Invitation request failed.",
    },
    { status: error instanceof PlayerLinkError ? error.status : 500 },
  );
}

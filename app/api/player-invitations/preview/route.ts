import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { hashInviteToken } from "../../../lib/invitations";
import { assertPlayerLinkTeamManager } from "../../../lib/playerAccountLinks";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

// Possession reveals only the intended identity, never roster/private data.
export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();
    if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token))
      return NextResponse.json({ message: "This invitation is invalid." }, { status: 400, headers });
    const db = createAdminClient();
    const { data: invite, error } = await db.from("player_invitations")
      .select("player_id,membership_id,team_id,season_id,status,expires_at,invited_by")
      .eq("token_hash", hashInviteToken(token)).maybeSingle();
    if (error) throw new Error("lookup");
    if (!invite || invite.status !== "PENDING" || new Date(invite.expires_at) <= new Date())
      return NextResponse.json({ message: "This invitation is unavailable, already used, or expired." }, { status: 410, headers });
    await assertPlayerLinkTeamManager(db, invite.invited_by, invite.team_id);
    const { data: membership } = await db.from("player_team_memberships").select("jersey_number")
      .eq("id", invite.membership_id).eq("player_id", invite.player_id)
      .eq("team_id", invite.team_id).eq("season_id", invite.season_id).eq("active", true).maybeSingle();
    const { data: player } = await db.from("players").select("first_name,last_name")
      .eq("id", invite.player_id).eq("active", true).maybeSingle();
    const { data: team } = await db.from("teams").select("name").eq("id", invite.team_id).eq("active", true).maybeSingle();
    const { data: season } = await db.from("seasons").select("id").eq("id", invite.season_id).eq("team_id", invite.team_id).eq("active", true).maybeSingle();
    if (!membership || !player || !team || !season) throw new Error("inactive");
    return NextResponse.json({ teamName: team.name, playerName: `${player.first_name} ${player.last_name}`,
      jersey: membership.jersey_number }, { headers });
  } catch {
    return NextResponse.json({ message: "This invitation is unavailable. Ask your coach for help." }, { status: 503, headers });
  }
}

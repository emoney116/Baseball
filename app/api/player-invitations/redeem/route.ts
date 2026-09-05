import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { hashInviteToken } from "../../../lib/invitations";
import {
  ensurePlayerLinkProfile,
  PlayerLinkError,
} from "../../../lib/playerAccountLinks";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    const {
      data: { user },
      error,
    } = await (await createClient()).auth.getUser();
    if (error || !user)
      throw new PlayerLinkError("Sign in with the invited email.", 401);
    if (!user.email || !user.email_confirmed_at)
      throw new PlayerLinkError(
        "Verify your email before accepting this invitation.",
        403,
      );
    const body = await request.json();
    if (
      typeof body.token !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(body.token)
    )
      throw new PlayerLinkError("This invitation is invalid.");
    const db = createAdminClient();
    await ensurePlayerLinkProfile(db, user);
    const { error: redeemError } = await db.rpc("redeem_player_invitation", {
      invite_hash: hashInviteToken(body.token),
      account_id: user.id,
      verified_email: user.email,
    });
    if (redeemError)
      throw new PlayerLinkError(
        redeemError.code === "P0001"
          ? redeemError.message
          : "This invitation could not be accepted.",
        409,
      );
    const { data: invitation } = await db
      .from("player_invitations")
      .select("player_id,team_id,season_id")
      .eq("token_hash", hashInviteToken(body.token))
      .eq("accepted_by", user.id)
      .single();
    const context = invitation
      ? {
          playerId: invitation.player_id,
          teamId: invitation.team_id,
          seasonId: invitation.season_id,
        }
      : undefined;
    return NextResponse.json(
      { ok: true, context },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof PlayerLinkError
            ? error.message
            : "Unable to accept invitation.",
      },
      { status: error instanceof PlayerLinkError ? error.status : 500 },
    );
  }
}

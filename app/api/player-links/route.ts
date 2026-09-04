import { NextResponse, type NextRequest } from "next/server";
import { assertApprovedPlayerLink, createSelfPlayerClaim, getApprovedPlayerLinks, listProfilePlayerLinks, PlayerLinkError } from "../../lib/playerAccountLinks";
import { createAdminClient } from "../../lib/supabase/admin";
import { createClient } from "../../lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    const admin = createAdminClient();
    const [links, approvedLinks] = await Promise.all([
      listProfilePlayerLinks(admin, user.id),
      getApprovedPlayerLinks(admin, user.id),
    ]);
    return NextResponse.json({ ok: true, links, approvedLinks });
  } catch (error) {
    return playerLinkResponse(error, "Unable to load player links.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const admin = createAdminClient();
    const body = await request.json().catch(() => ({})) as {
      action?: "claim" | "context";
      teamId?: string;
      seasonId?: string;
      membershipId?: string;
      playerId?: string;
      requestMessage?: string;
    };
    if (body.action === "context") {
      if (!body.playerId) throw new PlayerLinkError("Choose a player context.", 400);
      const link = await assertApprovedPlayerLink(admin, user.id, {
        playerId: body.playerId,
        teamId: body.teamId,
        seasonId: body.seasonId,
      });
      return NextResponse.json({ ok: true, activePlayerContext: link });
    }
    if (body.action !== "claim" || !body.teamId || !body.seasonId || !body.membershipId) {
      throw new PlayerLinkError("Choose a roster player before requesting access.", 400);
    }
    const link = await createSelfPlayerClaim(admin, {
      profile: user,
      teamId: body.teamId,
      seasonId: body.seasonId,
      membershipId: body.membershipId,
      requestMessage: body.requestMessage,
    });
    return NextResponse.json({ ok: true, link }, { status: 201 });
  } catch (error) {
    return playerLinkResponse(error, "Unable to submit player claim.");
  }
}

async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new PlayerLinkError("Sign in before managing player access.", 401);
  return data.user;
}

function playerLinkResponse(error: unknown, fallback: string) {
  const status = error instanceof PlayerLinkError ? error.status : 500;
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ ok: false, message }, { status });
}

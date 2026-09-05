import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { hasStaffAccess, loadPlayerSession, listPlayerContexts, loadPlayerAccountHome } from "../../../lib/playerAccess";
import { PlayerLinkError } from "../../../lib/playerAccountLinks";

export async function GET(request: NextRequest) {
  try {
    const {
      data: { user },
      error,
    } = await (await createClient()).auth.getUser();
    if (error || !user)
      return NextResponse.json(
        { message: "Sign in to continue." },
        { status: 401 },
      );
    const db = createAdminClient();
    const q = request.nextUrl.searchParams;
    const playerId = q.get("playerId") ?? q.get("player") ?? undefined;
    const teamId = q.get("teamId") ?? q.get("team") ?? undefined;
    const contexts = await listPlayerContexts(db, user.id);
    const staff = await hasStaffAccess(db, user.id);
    // An explicit self-context still requires its approved link, even for staff.
    if (staff && q.get("workspace") !== "player")
      return NextResponse.json(
        { mode: "staff", playerContexts: contexts },
        { headers: { "Cache-Control": "no-store" } },
      );
    if (!teamId && !playerId) return NextResponse.json({ mode: "player", accountHome: true, profileId: user.id, contexts, data: await loadPlayerAccountHome(db, user.id, contexts) }, { headers: { "Cache-Control": "private, no-store" } });
    const session = await loadPlayerSession(db, user.id, {
      playerId,
      teamId,
      seasonId: q.get("seasonId") ?? q.get("season") ?? undefined,
    });
    return NextResponse.json(session, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof PlayerLinkError
            ? error.message
            : "Unable to load player access.",
      },
      { status: error instanceof PlayerLinkError ? error.status : 500 },
    );
  }
}

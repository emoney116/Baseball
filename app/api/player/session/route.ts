import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { hasStaffAccess, loadPlayerSession } from "../../../lib/playerAccess";
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
    if (await hasStaffAccess(db, user.id))
      return NextResponse.json(
        { mode: "staff" },
        { headers: { "Cache-Control": "no-store" } },
      );
    const q = request.nextUrl.searchParams;
    const session = await loadPlayerSession(db, user.id, {
      playerId: q.get("playerId") ?? q.get("player") ?? undefined,
      teamId: q.get("teamId") ?? q.get("team") ?? undefined,
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

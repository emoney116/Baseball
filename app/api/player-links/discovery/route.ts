import { NextResponse, type NextRequest } from "next/server";
import { PlayerLinkError, searchClaimRoster, searchClaimTeams } from "../../../lib/playerAccountLinks";
import { createAdminClient } from "../../../lib/supabase/admin";
import { createClient } from "../../../lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw new PlayerLinkError("Sign in before finding your team.", 401);
    const kind = request.nextUrl.searchParams.get("kind");
    const admin = createAdminClient();
    if (kind === "teams") {
      const teams = await searchClaimTeams(admin, request.nextUrl.searchParams.get("q") ?? "");
      return NextResponse.json({ ok: true, teams });
    }
    if (kind === "players") {
      const teamId = request.nextUrl.searchParams.get("teamId") ?? "";
      const seasonId = request.nextUrl.searchParams.get("seasonId") ?? "";
      const roster = await searchClaimRoster(admin, { teamId, seasonId, query: request.nextUrl.searchParams.get("q") ?? "" });
      return NextResponse.json({ ok: true, ...roster });
    }
    throw new PlayerLinkError("Choose team or player search.", 400);
  } catch (error) {
    const status = error instanceof PlayerLinkError ? error.status : 500;
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Player discovery is unavailable." }, { status });
  }
}

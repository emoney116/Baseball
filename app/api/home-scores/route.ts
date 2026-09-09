import { createClient } from "../../lib/supabase/server";
import { getPublicTeamDirectory } from "../../lib/publicDirectory";
import { recentHomeScores, type HomeScore } from "../../lib/homeScores";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return Response.json({ scores: [] }, { status: 401, headers });
  const ids = [...new Set((new URL(request.url).searchParams.get("teams") ?? "").split(","))];
  if (ids.length > 12 || ids.some(id => !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id))) return Response.json({ scores: [] }, { status: 400, headers });
  const scores: HomeScore[] = [];
  // Reuse the existing visibility/claim-aware directory boundary; never query private scores directly.
  for (const id of ids) {
    const team = await getPublicTeamDirectory(id);
    if (!team) continue;
    for (const game of team.games) scores.push({ id: game.id, teamId: id, teamName: team.name, opponent: game.opponent, ourScore: game.ourScore, opponentScore: game.opponentScore, date: game.gameDate, result: game.result ?? "" });
  }
  return Response.json({ scores: recentHomeScores(scores, ids) }, { headers });
}

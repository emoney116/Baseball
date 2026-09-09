export type HomeScore = { id: string; teamId: string; teamName: string; opponent: string; ourScore: number; opponentScore: number; date: string; result: string };

export function recentHomeScores(scores: HomeScore[], allowedTeamIds: string[], now = Date.now()) {
  const allowed = new Set(allowedTeamIds);
  const seen = new Set<string>();
  return scores.filter(score => {
    const at = Date.parse(score.date);
    if (!allowed.has(score.teamId) || !["W", "L", "T"].includes(score.result) || !Number.isFinite(score.ourScore) || !Number.isFinite(score.opponentScore) || score.ourScore < 0 || score.opponentScore < 0 || !Number.isFinite(at) || at > now || at < now - 14 * 86400000 || seen.has(score.id)) return false;
    seen.add(score.id); return true;
  }).sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 5);
}

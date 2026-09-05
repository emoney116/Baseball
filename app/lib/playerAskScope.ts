import type { PlayerContext } from "./playerAccess.ts";
import type { AskClubhouseUiContext } from "./askClubhouse/types.ts";
import { PlayerLinkError } from "./playerAccountLinks.ts";

export function playerAskContext(
  context: PlayerContext,
  requested?: AskClubhouseUiContext,
): AskClubhouseUiContext {
  const { playerId, team } = context;
  const playerIds = [
    requested?.playerId,
    requested?.viewerPlayerId,
    ...(requested?.analytics?.playerIds ?? []),
    requested?.visualContext?.playerId,
    ...(requested?.visualContext?.query.playerIds ?? []),
  ].filter(Boolean);
  const teams = [
    requested?.teamId,
    requested?.analytics?.context?.teamId,
  ].filter(Boolean);
  const seasons = [
    requested?.seasonId,
    requested?.analytics?.context?.seasonId,
  ].filter(Boolean);
  if (
    playerIds.some((id) => id !== playerId) ||
    teams.some((id) => id !== team.teamId) ||
    seasons.some((id) => id !== team.seasonId) ||
    requested?.teamScopes?.some(
      (s) =>
        s.teamId !== team.teamId ||
        (s.seasonId && s.seasonId !== team.seasonId),
    )
  )
    throw new PlayerLinkError(
      "Player access is limited to your selected approved context.",
      403,
    );
  return {
    playerId,
    viewerPlayerId: playerId,
    teamId: team.teamId,
    seasonId: team.seasonId,
    launchSurface: "analytics",
    analytics: {
      ...requested?.analytics,
      playerIds: [playerId],
      context: { teamId: team.teamId, seasonId: team.seasonId, role: "PLAYER" },
    },
    visualContext: requested?.visualContext
      ? {
          ...requested.visualContext,
          playerId,
          query: { ...requested.visualContext.query, playerIds: [playerId] },
        }
      : undefined,
  };
}
export function isPrivateTeamQuestion(message: string) {
  return (
    /\b(rank(ing|ings)?|leaderboard|compare me|other players?|teammate['’]?s?|private notes?|staff notes?|pending claims?|invitation status)\b/i.test(
      message,
    ) ||
    /\bwho\b.*\b(highest|lowest|best|worst|most|least)\b/i.test(message) ||
    /\b(team|our|we)\b.*\b(stats?|analytics|hitting|pitching|contact|average|best|worst|velocity|weight|ops)\b/i.test(
      message,
    )
  );
}

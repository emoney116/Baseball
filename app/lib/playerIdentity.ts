import type { AppData, Game, GameStateSnapshot, ID, Player, PlayerTeamMembership } from "../types.ts";

export interface CanonicalPlayerIdentityView {
  data: AppData;
  canonicalIdByPlayerId: Map<ID, ID>;
}

export function canonicalizeAppDataPlayerIdentities(data: AppData): CanonicalPlayerIdentityView {
  const referenceCounts = countPlayerReferences(data);
  const canonicalIdByPlayerId = buildCanonicalPlayerMap(data.players, data.playerTeamMemberships ?? [], referenceCounts);
  const canonicalId = (playerId: ID | undefined): ID | undefined => playerId ? canonicalIdByPlayerId.get(playerId) ?? playerId : undefined;
  const canonicalPlayers = data.players.filter((player) => canonicalId(player.id) === player.id);
  const memberships = canonicalMemberships(data.playerTeamMemberships ?? [], canonicalId);

  return {
    canonicalIdByPlayerId,
    data: {
      ...data,
      players: canonicalPlayers,
      playerTeamMemberships: memberships,
      practices: data.practices.map((practice) => ({
        ...practice,
        playerIds: uniqueIds(practice.playerIds.map((id) => canonicalId(id) ?? id)),
        pitcherIds: uniqueIds(practice.pitcherIds.map((id) => canonicalId(id) ?? id)),
        hitterIds: uniqueIds(practice.hitterIds.map((id) => canonicalId(id) ?? id)),
      })),
      attendance: uniqueBy(data.attendance.map((item) => ({ ...item, playerId: canonicalId(item.playerId) ?? item.playerId })), (item) => `${item.practiceId}:${item.playerId}`),
      pitchingSessions: data.pitchingSessions.map((session) => ({
        ...session,
        pitcherId: canonicalId(session.pitcherId) ?? session.pitcherId,
        catcherId: canonicalId(session.catcherId),
        hitterId: canonicalId(session.hitterId),
      })),
      pitchEvents: data.pitchEvents.map((event) => ({
        ...event,
        pitcherId: canonicalId(event.pitcherId) ?? event.pitcherId,
        hitterId: canonicalId(event.hitterId),
      })),
      hittingSessions: data.hittingSessions.map((session) => ({ ...session, hitterId: canonicalId(session.hitterId) ?? session.hitterId })),
      hittingEvents: data.hittingEvents.map((event) => ({
        ...event,
        hitterId: canonicalId(event.hitterId) ?? event.hitterId,
        pitcherId: canonicalId(event.pitcherId),
      })),
      defenseSessions: data.defenseSessions.map((session) => ({ ...session, playerId: canonicalId(session.playerId) ?? session.playerId })),
      defenseEvents: data.defenseEvents.map((event) => ({ ...event, playerId: canonicalId(event.playerId) ?? event.playerId })),
      weightRoomWorkoutGroupMembers: data.weightRoomWorkoutGroupMembers?.map((item) => ({ ...item, playerId: canonicalId(item.playerId) ?? item.playerId })),
      weightRoomGroupPresetMembers: data.weightRoomGroupPresetMembers?.map((item) => ({ ...item, playerId: canonicalId(item.playerId) ?? item.playerId })),
      workoutSessions: data.workoutSessions.map((session) => ({ ...session, playerId: canonicalId(session.playerId) ?? session.playerId })),
      workoutEntries: data.workoutEntries.map((entry) => ({ ...entry, playerId: canonicalId(entry.playerId) ?? entry.playerId })),
      games: data.games.map((game) => remapGame(game, canonicalId)),
      gameEvents: data.gameEvents.map((event) => ({
        ...event,
        pitcherId: canonicalId(event.pitcherId),
        batterId: canonicalId(event.batterId),
        runnerId: canonicalId(event.runnerId),
        runnerMovements: event.runnerMovements?.map((movement) => ({ ...movement, runnerId: canonicalId(movement.runnerId) ?? movement.runnerId })),
        substitution: event.substitution ? {
          ...event.substitution,
          outgoingPlayerId: canonicalId(event.substitution.outgoingPlayerId),
          incomingPlayerId: canonicalId(event.substitution.incomingPlayerId),
        } : undefined,
        runnersBefore: remapRunners(event.runnersBefore, canonicalId),
        runnersAfter: remapRunners(event.runnersAfter, canonicalId),
        stateBefore: remapGameState(event.stateBefore, canonicalId),
        stateAfter: remapGameState(event.stateAfter, canonicalId),
      })),
      plateAppearances: data.plateAppearances.map((appearance) => ({
        ...appearance,
        pitcherId: canonicalId(appearance.pitcherId) ?? appearance.pitcherId,
        hitterId: canonicalId(appearance.hitterId) ?? appearance.hitterId,
      })),
      coachNotes: data.coachNotes.map((note) => note.scope.type === "Player" || note.scope.type === "PitchingSession" || note.scope.type === "HittingSession"
        ? { ...note, scope: { ...note.scope, playerId: canonicalId(note.scope.playerId) ?? note.scope.playerId } }
        : note),
      developmentGoals: data.developmentGoals.map((goal) => ({ ...goal, playerId: canonicalId(goal.playerId) ?? goal.playerId })),
      settings: {
        ...data.settings,
        recentPlayerIds: uniqueIds(data.settings.recentPlayerIds.map((id) => canonicalId(id) ?? id)),
      },
    },
  };
}

export function normalizePlayerIdentityName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function isUsablePlayerIdentityName(name: string): boolean {
  return normalizePlayerIdentityName(name).length >= 3;
}

export function strongRosterIdentityKey(input: {
  name: string;
  graduationYear?: number | null;
  jerseyNumber?: number | null;
  teamId?: ID | null;
  seasonId?: ID | null;
}): string | undefined {
  const name = normalizePlayerIdentityName(input.name);
  if (name.length < 3 || !input.graduationYear || !input.jerseyNumber || !input.teamId || !input.seasonId) return undefined;
  return `${input.teamId}:${input.seasonId}:${name}:${input.graduationYear}:${input.jerseyNumber}`;
}

function buildCanonicalPlayerMap(
  players: Player[],
  memberships: PlayerTeamMembership[],
  referenceCounts: Map<ID, number>,
): Map<ID, ID> {
  const membershipCounts = countBy(memberships.map((membership) => membership.playerId));
  const playerById = new Map(players.map((player) => [player.id, player]));
  const groups = new Map<string, Player[]>();
  for (const membership of memberships) {
    const player = playerById.get(membership.playerId);
    if (!player) continue;
    const key = strongRosterIdentityKey({
      name: player.name,
      graduationYear: player.graduationYear,
      jerseyNumber: membership.jerseyNumber ?? player.jerseyNumber,
      teamId: membership.teamId,
      seasonId: membership.seasonId,
    });
    if (!key) continue;
    groups.set(key, [...new Map([...(groups.get(key) ?? []), player].map((item) => [item.id, item])).values()]);
  }

  const result = new Map(players.map((player) => [player.id, player.id]));
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const canonical = [...group].sort((left, right) => (
      (referenceCounts.get(right.id) ?? 0) - (referenceCounts.get(left.id) ?? 0)
      || (membershipCounts.get(right.id) ?? 0) - (membershipCounts.get(left.id) ?? 0)
      || playerCompletenessScore(right) - playerCompletenessScore(left)
      || compareTimestamp(right.updatedAt, left.updatedAt)
      || left.id.localeCompare(right.id)
    ))[0];
    group.forEach((player) => result.set(player.id, canonical.id));
  }
  return result;
}

function countPlayerReferences(data: AppData): Map<ID, number> {
  const counts = new Map<ID, number>();
  const add = (playerId: ID | undefined, weight = 1) => {
    if (playerId) counts.set(playerId, (counts.get(playerId) ?? 0) + weight);
  };

  data.attendance.forEach((item) => add(item.playerId));
  data.pitchingSessions.forEach((session) => { add(session.pitcherId); add(session.catcherId); add(session.hitterId); });
  data.pitchEvents.forEach((event) => { add(event.pitcherId); add(event.hitterId); });
  data.hittingSessions.forEach((session) => add(session.hitterId));
  data.hittingEvents.forEach((event) => { add(event.hitterId); add(event.pitcherId); });
  data.defenseSessions.forEach((session) => add(session.playerId));
  data.defenseEvents.forEach((event) => add(event.playerId));
  data.workoutSessions.forEach((session) => add(session.playerId));
  data.workoutEntries.forEach((entry) => add(entry.playerId));
  data.weightRoomWorkoutGroupMembers?.forEach((item) => add(item.playerId));
  data.weightRoomGroupPresetMembers?.forEach((item) => add(item.playerId));
  data.games.forEach((game) => {
    game.lineup.forEach((id) => add(id));
    Object.values(game.positions).forEach((id) => add(id));
    add(game.startingPitcherId);
    add(game.currentPitcherId);
    add(game.currentBatterId);
  });
  data.gameEvents.forEach((event) => {
    add(event.pitcherId);
    add(event.batterId);
    add(event.runnerId);
    event.runnerMovements?.forEach((movement) => add(movement.runnerId));
  });
  data.plateAppearances.forEach((appearance) => { add(appearance.pitcherId); add(appearance.hitterId); });
  data.developmentGoals.forEach((goal) => add(goal.playerId));
  return counts;
}

function remapGame(game: Game, canonicalId: (id: ID | undefined) => ID | undefined): Game {
  return {
    ...game,
    runners: remapRunners(game.runners, canonicalId) ?? {},
    lineup: uniqueIds(game.lineup.map((id) => canonicalId(id) ?? id)),
    positions: Object.fromEntries(Object.entries(game.positions).map(([position, id]) => [position, canonicalId(id) ?? id])),
    startingPitcherId: canonicalId(game.startingPitcherId),
    currentPitcherId: canonicalId(game.currentPitcherId),
    currentBatterId: canonicalId(game.currentBatterId),
  };
}

function remapGameState(
  state: GameStateSnapshot | undefined,
  canonicalId: (id: ID | undefined) => ID | undefined,
): GameStateSnapshot | undefined {
  if (!state) return undefined;
  return {
    ...state,
    runners: remapRunners(state.runners, canonicalId) ?? {},
    lineup: state.lineup ? uniqueIds(state.lineup.map((id) => canonicalId(id) ?? id)) : undefined,
    positions: state.positions ? Object.fromEntries(Object.entries(state.positions).map(([position, id]) => [position, canonicalId(id) ?? id])) : undefined,
    startingPitcherId: canonicalId(state.startingPitcherId),
    currentPitcherId: canonicalId(state.currentPitcherId),
    currentBatterId: canonicalId(state.currentBatterId),
  };
}

function remapRunners(
  runners: Game["runners"] | undefined,
  canonicalId: (id: ID | undefined) => ID | undefined,
): Game["runners"] | undefined {
  if (!runners) return undefined;
  return {
    first: canonicalId(runners.first),
    second: canonicalId(runners.second),
    third: canonicalId(runners.third),
  };
}

function playerCompletenessScore(player: Player): number {
  return (player.archived ? 0 : 20)
    + (player.imageUrl ? 8 : 0)
    + (player.height ? 4 : 0)
    + (player.weight ? 4 : 0)
    + (player.secondaryPosition ? 2 : 0);
}

function compareTimestamp(left: string | undefined, right: string | undefined): number {
  return (Date.parse(left ?? "") || 0) - (Date.parse(right ?? "") || 0);
}

function countBy(ids: ID[]): Map<ID, number> {
  const counts = new Map<ID, number>();
  ids.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
  return counts;
}

function canonicalMemberships(
  memberships: PlayerTeamMembership[],
  canonicalId: (id: ID | undefined) => ID | undefined,
): PlayerTeamMembership[] {
  const byScope = new Map<string, { membership: PlayerTeamMembership; isCanonicalSource: boolean }>();
  for (const membership of memberships) {
    const playerId = canonicalId(membership.playerId) ?? membership.playerId;
    const key = `${playerId}:${membership.teamId}:${membership.seasonId ?? ""}`;
    const isCanonicalSource = membership.playerId === playerId;
    const existing = byScope.get(key);
    if (!existing || (isCanonicalSource && !existing.isCanonicalSource)) {
      byScope.set(key, { membership: { ...membership, playerId }, isCanonicalSource });
    }
  }
  return [...byScope.values()].map((item) => item.membership);
}

function uniqueIds(ids: ID[]): ID[] {
  return [...new Set(ids)];
}

function uniqueBy<T>(values: T[], key: (value: T) => string): T[] {
  return [...new Map(values.map((value) => [key(value), value])).values()];
}

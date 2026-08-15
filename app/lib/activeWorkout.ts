export type ActiveWorkoutGroupSeed = {
  id: string;
  name: string;
  playerIds: string[];
  stationIndex: number;
};

export type ActiveWorkoutSetKey = {
  playerId: string;
  exercise: string;
  setNumber?: number;
};

export function createWorkoutGroups(playerIds: string[], requestedGroupCount: number): ActiveWorkoutGroupSeed[] {
  const groupCount = Math.max(1, Math.min(Math.max(1, playerIds.length), Math.floor(requestedGroupCount) || 1));
  const groups = Array.from({ length: groupCount }, (_, index) => ({
    id: `group-${index + 1}`,
    name: `Group ${index + 1}`,
    playerIds: [] as string[],
    stationIndex: index,
  }));

  playerIds.forEach((playerId, index) => {
    groups[index % groupCount].playerIds.push(playerId);
  });

  return groups;
}

export function moveWorkoutGroupMember(groups: ActiveWorkoutGroupSeed[], playerId: string, targetGroupId: string) {
  return groups.map((group) => {
    const withoutPlayer = group.playerIds.filter((id) => id !== playerId);
    return {
      ...group,
      playerIds: group.id === targetGroupId ? [...withoutPlayer, playerId] : withoutPlayer,
    };
  });
}

export function setWorkoutGroupStation(groups: ActiveWorkoutGroupSeed[], groupId: string, stationIndex: number, stationCount: number) {
  return groups.map((group) => group.id === groupId ? { ...group, stationIndex: normalizeStationIndex(stationIndex, stationCount) } : group);
}

export function advanceWorkoutGroupStation(groups: ActiveWorkoutGroupSeed[], groupId: string, stationCount: number, step = 1) {
  return groups.map((group) => group.id === groupId
    ? { ...group, stationIndex: normalizeStationIndex(group.stationIndex + step, stationCount) }
    : group);
}

export function normalizeStationIndex(index: number, stationCount: number) {
  if (stationCount <= 0) return 0;
  return ((index % stationCount) + stationCount) % stationCount;
}

export function upsertWorkoutSetByKey<T extends ActiveWorkoutSetKey>(entries: T[], nextEntry: T) {
  return [
    nextEntry,
    ...entries.filter((entry) => !sameWorkoutSet(entry, nextEntry)),
  ];
}

export function sameWorkoutSet(left: ActiveWorkoutSetKey, right: ActiveWorkoutSetKey) {
  return left.playerId === right.playerId
    && left.exercise === right.exercise
    && (left.setNumber ?? 1) === (right.setNumber ?? 1);
}

export type ActiveWorkoutGroupSeed = {
  id: string;
  name: string;
  playerIds: string[];
  stationIndex: number;
};

export type ActiveWorkoutStationSeed = {
  id: string;
  name: string;
  displayOrder: number;
  targetSets?: number;
};

export type ActiveWorkoutEntryMode = "Groups" | "Individual";

export function createBlankWorkoutSetup() {
  return {
    groups: [] as ActiveWorkoutGroupSeed[],
    stations: [] as ActiveWorkoutStationSeed[],
  };
}

export function createEmptyWorkoutGroups(groupCount: number, stationCount = 0): ActiveWorkoutGroupSeed[] {
  const resolvedGroupCount = Math.max(0, Math.floor(groupCount) || 0);
  return Array.from({ length: resolvedGroupCount }, (_, index) => ({
    id: `group-${index + 1}`,
    name: `Group ${index + 1}`,
    playerIds: [],
    stationIndex: stationCount > 0 ? index % stationCount : 0,
  }));
}

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

export function plannedWorkoutSetCount({
  stations,
  groups,
  athleteCount,
  mode,
}: {
  stations: Array<Pick<ActiveWorkoutStationSeed, "targetSets">>;
  groups: ActiveWorkoutGroupSeed[];
  athleteCount: number;
  mode: ActiveWorkoutEntryMode;
}) {
  if (!stations.length) return 0;
  const stationTargetCount = stations.reduce((sum, station) => sum + Math.max(1, Math.floor(station.targetSets ?? 1)), 0);
  if (mode === "Individual") return Math.max(0, athleteCount) * stationTargetCount;
  const assignedAthletes = new Set(groups.flatMap((group) => group.playerIds));
  return assignedAthletes.size * stationTargetCount;
}

export function copyExercisePresetToStations<T extends { name: string; targetSets?: number }>(items: T[]): Array<T & ActiveWorkoutStationSeed> {
  return items.map((item, index) => ({
    ...item,
    id: `station-${index + 1}-${slugifyPresetName(item.name)}`,
    displayOrder: index + 1,
  }));
}

export function copyGroupPresetToWorkout(groups: ActiveWorkoutGroupSeed[], stationCount: number): ActiveWorkoutGroupSeed[] {
  return groups.map((group, index) => ({
    ...group,
    id: `group-${index + 1}`,
    name: group.name || `Group ${index + 1}`,
    playerIds: [...group.playerIds],
    stationIndex: stationCount > 0 ? index % stationCount : 0,
  }));
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

function slugifyPresetName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "exercise";
}

import type { AppData } from "../types";

export function changedRows<T extends { id: string }>(
  before: readonly T[],
  after: readonly T[],
): T[] {
  const prior = new Map(before.map((r) => [r.id, JSON.stringify(r)]));
  return after.filter((r) => prior.get(r.id) !== JSON.stringify(r));
}
export function mergeLiveRefresh(current: AppData, remote: AppData): AppData {
  const next = { ...current };
  for (const key of [
    "practices",
    "attendance",
    "hittingSessions",
    "pitchingSessions",
    "defenseSessions",
    "pitchEvents",
    "hittingEvents",
    "defenseEvents",
    "workoutSessions",
    "workoutEntries",
    "weightRoomWorkouts",
    "weightRoomWorkoutStations",
    "weightRoomWorkoutGroups",
    "weightRoomWorkoutGroupMembers",
  ] as const) {
    Object.assign(next, { [key]: remote[key] });
  }
  return next;
}
// A coach save must not replay an unchanged snapshot over another station's work.
export function liveSyncDelta(previous: AppData, next: AppData): AppData {
  const delta = { ...next };
  const keys = [
    "practices",
    "attendance",
    "hittingSessions",
    "pitchingSessions",
    "defenseSessions",
    "pitchEvents",
    "hittingEvents",
    "defenseEvents",
    "workoutSessions",
    "workoutEntries",
    "weightRoomWorkouts",
    "weightRoomExercises",
    "weightRoomWorkoutGroupMembers",
    "weightRoomExercisePresets",
    "weightRoomExercisePresetItems",
    "weightRoomGroupPresets",
    "weightRoomGroupPresetMembers",
  ] as const;
  for (const key of keys) {
    const before = (previous[key] ?? []) as { id: string }[],
      after = (next[key] ?? []) as { id: string }[];
    Object.assign(delta, { [key]: changedRows(before, after) });
  }
  // Ordered programming helpers require the complete affected parent, not partial positions.
  for (const key of [
    "weightRoomWorkoutStations",
    "weightRoomWorkoutGroups",
  ] as const) {
    const parents = new Set(
      changedRows<{ id: string; workoutId: string }>(
        previous[key] ?? [],
        next[key] ?? [],
      ).map((r) => r.workoutId),
    );
    Object.assign(delta, {
      [key]: (next[key] ?? []).filter((r) => parents.has(r.workoutId)),
    });
  }
  return delta;
}

import type { AppData } from "../types.ts";

export function weightRoomAnalyticsRecords(data: AppData, scope: { playerIds?: string[]; eventIds?: string[]; start?: string; end?: string; exercise?: string }) {
  const sessions = new Map(data.workoutSessions.map(s => [s.id, s]));
  const stations = new Map((data.weightRoomWorkoutStations ?? []).map(s => [s.id, s]));
  return data.workoutEntries.flatMap(entry => {
    const session = sessions.get(entry.sessionId);
    if (!session || (scope.playerIds?.length && !scope.playerIds.includes(entry.playerId)) || (scope.start && session.date < scope.start) || (scope.end && session.date > scope.end) || (scope.exercise && entry.exercise !== scope.exercise)) return [];
    if (scope.eventIds?.length && !scope.eventIds.some(id => id === session.id || id === entry.activeWorkoutId || id === `workout-day:${session.date}`)) return [];
    const measurement = stations.get(entry.workoutStationId ?? "")?.measurementType;
    const load = entry.testConditions?.mode === "FIXED_LOAD_TIMED_REPS" ? entry.testConditions.loadLb : entry.weight;
    const fixedLoadReps = entry.testConditions?.mode === "FIXED_LOAD_TIMED_REPS";
    const supportsVolume = !measurement || measurement === "WEIGHT_REPS" || measurement === "REPS_ONLY" && fixedLoadReps;
    const validVolume = entry.status !== "Skipped" && supportsVolume && entry.unit !== "sec" && (entry.unit === "lb" || fixedLoadReps) && typeof load === "number" && Number.isFinite(load) && load > 0 && typeof entry.reps === "number" && Number.isFinite(entry.reps) && entry.reps >= 0;
    return [{ entry, date: session.date, measurement, volume: validVolume ? load! * entry.reps! : 0 }];
  }).sort((a, b) => b.date.localeCompare(a.date) || a.entry.exercise.localeCompare(b.entry.exercise) || (a.entry.setNumber ?? 1) - (b.entry.setNumber ?? 1));
}

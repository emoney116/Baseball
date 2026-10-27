import type { WorkoutEntry, WorkoutSession } from "../types";
import { testComparisonKey, type WorkoutTestConditions } from "./workoutTesting.ts";

export function initialWorkoutResult(entries: readonly WorkoutEntry[], sessions: readonly WorkoutSession[], playerId: string, date: string, conditions: WorkoutTestConditions, side?: string) {
  const dates = new Map(sessions.map(session => [session.id, session.date]));
  const key = testComparisonKey(conditions, side);
  const comparable = entries.flatMap(entry => {
    const measured = conditions.mode === "MAX_DURATION" ? entry.value : entry.reps ?? entry.value;
    const recordedDate = dates.get(entry.sessionId);
    if (entry.playerId !== playerId || !recordedDate || recordedDate >= date || !entry.testConditions || testComparisonKey(entry.testConditions, entry.testSide) !== key || entry.status === "Skipped" || entry.status === "Modified" || typeof measured !== "number" || !Number.isFinite(measured) || measured < 0) return [];
    return [{ date: recordedDate, value: measured }];
  }).sort((a, b) => a.date.localeCompare(b.date));
  const firstDate = comparable[0]?.date;
  if (!firstDate) return undefined;
  return { date: firstDate, value: Math.max(...comparable.filter(row => row.date === firstDate).map(row => row.value)) };
}

export function workoutBaselineChange(initial: number | undefined, current: number | undefined) {
  if (initial === undefined || initial <= 0 || current === undefined || !Number.isFinite(current) || current < 0) return undefined;
  return (current - initial) / initial * 100;
}

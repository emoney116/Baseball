import type { Player, WorkoutEntry, WorkoutSession } from "../types";

export type WeightRoomWindow = "This Week" | "This Month" | "This Season";

export interface WeightRoomScoreBreakdown {
  label: string;
  value: number;
  max: number;
}

export interface WeightRoomScoreResult {
  score: number;
  qualified: boolean;
  reasons: string[];
  breakdown: WeightRoomScoreBreakdown[];
  sessions: number;
  completedSessions: number;
  sets: number;
  volume: number;
  progressPct: number;
  completionPct: number;
  attendancePct: number;
}

export interface WeightRoomScoredPlayer extends WeightRoomScoreResult {
  player: Player;
}

export function buildWeightRoomLeaderboard(
  players: Player[],
  sessions: WorkoutSession[],
  entries: WorkoutEntry[],
  window: WeightRoomWindow,
  anchorDate?: string,
): WeightRoomScoredPlayer[] {
  return players
    .filter((player) => !player.archived)
    .map((player) => ({
      player,
      ...calculateWeightRoomScore(
        player,
        filterWorkoutSessionsByWindow(sessions.filter((session) => session.playerId === player.id), window, anchorDate),
        filterWorkoutEntriesByWindow(entries.filter((entry) => entry.playerId === player.id), sessions, window, anchorDate),
      ),
    }))
    .filter((result) => result.qualified)
    .sort((left, right) => right.score - left.score || right.progressPct - left.progressPct || left.player.name.localeCompare(right.player.name));
}

export function calculateWeightRoomScore(player: Player, sessions: WorkoutSession[], entries: WorkoutEntry[]): WeightRoomScoreResult {
  const completedSessions = sessions.filter((session) => session.completed).length;
  const completedEntries = entries.filter((entry) => (entry.status ?? "Completed") !== "Skipped");
  const setCount = completedEntries.reduce((sum, entry) => sum + Math.max(1, entry.sets ?? 1), 0);
  const qualified = completedSessions >= 2 || completedEntries.length >= 4;
  const volume = completedEntries.reduce((sum, entry) => sum + workoutEntryVolume(entry), 0);
  const progressPct = cappedAverageImprovement(completedEntries);
  const completionPct = sessions.length ? percent(completedSessions, sessions.length) : 0;
  const attendancePct = sessions.length ? percent(completedSessions, Math.max(2, sessions.length)) : 0;
  const relativeValues = completedEntries
    .filter((entry) => typeof entry.weight === "number" && typeof player.weight === "number" && player.weight > 0)
    .map((entry) => (entry.weight ?? 0) / Math.max(1, player.weight ?? 1));
  const relativeScore = relativeValues.length ? Math.min(100, average(relativeValues) * 62) : undefined;
  const rpeValues = completedEntries.filter((entry) => typeof entry.rpe === "number").map((entry) => entry.rpe ?? 0);
  const effortScore = rpeValues.length ? percent(average(rpeValues), 10) : undefined;

  const weightedParts = [
    { label: "Improvement", value: Math.min(100, progressPct * 5), max: 35, available: completedEntries.some((entry) => hasComparablePrior(entry)) },
    { label: "Consistency", value: completionPct, max: 25, available: sessions.length > 0 },
    { label: "Relative Performance", value: relativeScore ?? 0, max: 20, available: relativeScore !== undefined },
    { label: "Effort", value: effortScore ?? 0, max: 10, available: effortScore !== undefined },
    { label: "Attendance", value: attendancePct, max: 10, available: sessions.length > 0 },
  ];
  const availableWeight = weightedParts.filter((part) => part.available).reduce((sum, part) => sum + part.max, 0);
  const score = qualified && availableWeight > 0
    ? Math.round(weightedParts.filter((part) => part.available).reduce((sum, part) => sum + (part.value / 100) * (part.max / availableWeight) * 100, 0))
    : 0;

  const breakdown = weightedParts.map((part) => ({
    label: part.label,
    value: part.available && availableWeight > 0 ? Math.round((part.value / 100) * part.max) : 0,
    max: part.max,
  }));

  return {
    score,
    qualified,
    reasons: qualified
      ? [
          progressPct > 0 ? `+${formatScoreNumber(progressPct)}% own-baseline progress` : "Baseline held steady",
          `${Math.round(completionPct)}% workout completion`,
          `${setCount} tracked set${setCount === 1 ? "" : "s"}`,
        ]
      : ["Not enough data yet"],
    breakdown,
    sessions: sessions.length,
    completedSessions,
    sets: setCount,
    volume,
    progressPct,
    completionPct,
    attendancePct,
  };
}

export function workoutEntryVolume(entry: WorkoutEntry) {
  if (typeof entry.weight === "number" && typeof entry.reps === "number") return entry.weight * entry.reps * Math.max(1, entry.sets ?? 1);
  if (typeof entry.value === "number") return entry.value * Math.max(1, entry.sets ?? 1);
  if (typeof entry.reps === "number") return entry.reps * Math.max(1, entry.sets ?? 1);
  return 0;
}

export function estimatedOneRepMax(weight?: number, reps?: number) {
  if (!weight || !reps) return undefined;
  return Math.round(weight * (1 + reps / 30));
}

export function filterWorkoutSessionsByWindow(sessions: WorkoutSession[], window: WeightRoomWindow, anchorDate?: string) {
  const cutoff = weightRoomWindowCutoff(window, anchorDate);
  if (!cutoff) return sessions;
  return sessions.filter((session) => session.date >= cutoff);
}

export function filterWorkoutEntriesByWindow(entries: WorkoutEntry[], sessions: WorkoutSession[], window: WeightRoomWindow, anchorDate?: string) {
  const cutoff = weightRoomWindowCutoff(window, anchorDate);
  if (!cutoff) return entries;
  const sessionDateById = new Map(sessions.map((session) => [session.id, session.date]));
  return entries.filter((entry) => (sessionDateById.get(entry.sessionId) ?? entry.createdAt.slice(0, 10)) >= cutoff);
}

function cappedAverageImprovement(entries: WorkoutEntry[]) {
  const improvements = entries
    .filter(hasComparablePrior)
    .map((entry) => {
      const current = workoutEntryComparableValue(entry);
      const prior = entry.priorValue ?? 0;
      const raw = ((current - prior) / Math.max(1, prior)) * 100;
      const timeBased = entry.kind === "Speed" || entry.unit === "sec";
      return timeBased ? -raw : raw;
    })
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.max(-20, Math.min(20, value)));
  return average(improvements);
}

function hasComparablePrior(entry: WorkoutEntry) {
  return Boolean(entry.priorValue && workoutEntryComparableValue(entry));
}

function workoutEntryComparableValue(entry: WorkoutEntry) {
  return entry.weight ?? entry.value ?? entry.reps ?? 0;
}

function weightRoomWindowCutoff(window: WeightRoomWindow, anchorDate?: string) {
  if (window === "This Season") return undefined;
  const anchor = parseDate(anchorDate) ?? new Date();
  if (window === "This Week") {
    const date = new Date(anchor);
    const day = date.getDay();
    date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
    return date.toISOString().slice(0, 10);
  }
  const date = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  return date.toISOString().slice(0, 10);
}

function parseDate(value?: string) {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function percent(value: number, total: number) {
  return total > 0 ? (value / total) * 100 : 0;
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function formatScoreNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

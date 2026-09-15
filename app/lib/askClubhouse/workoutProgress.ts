import type { AppData, WorkoutEntry } from "../../types.ts";
import type { AskClubhouseUiContext } from "./types.ts";
import { resolveAskClubhousePlayer } from "./entityResolution.ts";
import { formatTestResult, testComparisonKey, testConditionLabel } from "../workoutTesting.ts";
import { workoutPeriods, type WorkoutPeriod } from "./workoutPeriods.ts";

export const normalizeExercise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const aliases = [
  { pattern: /\bpush[ -]?ups?\b/i, key: /pushups?/ },
  { pattern: /\bpull[ -]?ups?\b/i, key: /pullups?/ },
  { pattern: /\bbench(?: press)?\b/i, key: /bench/ },
  { pattern: /\bdead hang\b/i, key: /deadhang/ },
  { pattern: /\bside plank\b/i, key: /sideplank/ },
  { pattern: /\b(?:grip|plate) hold\b/i, key: /(?:grip|plate)hold/ },
  { pattern: /\bsquats?\b/i, key: /squat/ },
];
export function workoutExerciseMatches(name: string, question: string, available: string[]) {
  const requested = aliases.filter(alias => alias.pattern.test(question));
  if (requested.length) return requested.some(alias => alias.key.test(normalizeExercise(name)));
  const named = available.filter(exercise => normalizeExercise(question).includes(normalizeExercise(exercise)));
  return !named.length || named.includes(name);
}
export function hasWorkoutExercise(question: string, available: string[]) {
  return aliases.some(alias => alias.pattern.test(question)) || available.some(name => normalizeExercise(question).includes(normalizeExercise(name)));
}
export function comparableWorkoutResult(entry: WorkoutEntry) {
  const c = entry.testConditions;
  const timed = c?.mode === "MAX_DURATION";
  const value = timed ? entry.value : entry.reps ?? (entry.unit === "reps" ? entry.value : undefined);
  if (value === undefined || !Number.isFinite(value) || value < 0) return undefined;
  return {
    value, timed,
    key: `${normalizeExercise(entry.exercise)}:${c ? testComparisonKey(c, entry.testSide) : `${entry.weight ?? "unknown"}:reps`}`,
    condition: c ? [testConditionLabel(c), entry.testSide].filter(Boolean).join(" / ") : `${entry.weight === undefined ? "Load not tracked" : `${entry.weight} lb`} / duration not tracked`,
    display: (n: number) => timed && c ? `${formatTestResult(n, c)} held` : `${Number(n.toFixed(2))} reps`,
  };
}

/** Compare each athlete only against their own matching exercise and conditions. */
export function workoutProgressAnswer(data: AppData, question: string, context: AskClubhouseUiContext | undefined, now: Date) {
  if (!/\b(improv\w*|progress|chang\w*|compar\w*)\b/i.test(question)) return undefined;
  // Overall development rankings use the existing development tool, not mixed-unit deltas.
  if (/\b(who|which player)\b.*\b(most|least)\b/i.test(question)) return undefined;
  const names = [...new Set(data.workoutEntries.map(e => e.exercise))];
  if (!/\bexercises?\b/i.test(question) && !hasWorkoutExercise(question, names) && context?.launchSurface !== "weight_room") return undefined;
  const match = resolveAskClubhousePlayer({ data, message: question.replace(/\bwhat changed in\b/i, "compare"), route: "clubhouse_data", uiContext: context });
  if (match.status === "ambiguous") return { status: "needs_clarification" as const, answer: `Which player: ${match.players.map(p => p.name).join(", ")}?` };
  const players = new Map(data.players.map(p => [p.id, p.name]));
  const dates = new Map(data.workoutSessions.map(s => [s.id, s.date]));
  const period = workoutPeriods(question, context, now, [...dates.values()].sort()[0]);
  if (!period.current || (!period.prior && !period.season)) return { status: "needs_clarification" as const, answer: "Which comparison should I use: last week versus this week, last month versus this month, or season beginning to now?" };
  const current = period.current;
  const inside = (date: string, range: WorkoutPeriod) => date >= range.start && date <= range.end;
  type Sample = { entry: WorkoutEntry; value: number; date: string };
  const groups = new Map<string, { player: string; exercise: string; metric: NonNullable<ReturnType<typeof comparableWorkoutResult>>; samples: Sample[] }>();
  const seen = new Set<string>();
  for (const entry of data.workoutEntries) {
    const date = dates.get(entry.sessionId);
    const metric = comparableWorkoutResult(entry);
    if (seen.has(entry.id) || !date || !metric || !players.has(entry.playerId) || entry.status === "Skipped") continue;
    if (match.status === "single" && match.player.id !== entry.playerId) continue;
    if (!workoutExerciseMatches(entry.exercise, question, names)) continue;
    if (!inside(date, current) && (!period.prior || !inside(date, period.prior))) continue;
    seen.add(entry.id);
    const key = `${entry.playerId}:${metric.key}`;
    const group = groups.get(key) ?? { player: players.get(entry.playerId)!, exercise: entry.exercise, metric, samples: [] };
    group.samples.push({ entry, value: metric.value, date });
    groups.set(key, group);
  }
  if (!groups.size) return { status: "no_data" as const, answer: "No comparable recorded exercise results in those periods. Missing results are not zero." };
  const lines = [...groups.values()].map(group => {
    const days = [...new Set(group.samples.map(s => s.date))].sort();
    const earlier = period.season ? group.samples.filter(s => s.date === days[0]) : group.samples.filter(s => inside(s.date, period.prior!));
    const later = period.season ? group.samples.filter(s => s.date === days.at(-1)) : group.samples.filter(s => inside(s.date, current));
    const label = `${group.player} - ${group.exercise} (${group.metric.condition})`;
    if (!earlier.length || !later.length || (period.season && days.length < 2)) return `- ${label}: no comparable ${!later.length ? "current result" : "baseline"}; cannot determine improvement.`;
    const before = Math.max(...earlier.map(s => s.value));
    const after = Math.max(...later.map(s => s.value));
    const delta = after - before;
    const percent = before === 0 ? "percentage change unavailable from a zero baseline" : `${Number((delta / before * 100).toFixed(1))}%`;
    return `- ${label}: ${group.metric.display(before)} to ${group.metric.display(after)}; ${delta > 0 ? "+" : ""}${Number(delta.toFixed(2))} ${group.metric.timed ? "seconds" : "reps"} (${percent}), ${delta > 0 ? "improved" : delta < 0 ? "decreased" : "unchanged"}${period.season ? `; ${days[0]} to ${days.at(-1)}` : ""}.`;
  });
  const scope = period.season ? "Season beginning to now: earliest versus latest recorded day for each exercise" : `${period.prior!.start} through ${period.prior!.end} versus ${current.start} through ${current.end}`;
  return { status: "completed" as const, answer: `${scope}.\n${lines.slice(0, 60).join("\n")}${lines.length > 60 ? `\n${lines.length - 60} additional comparisons; choose a player or exercise to narrow the answer.` : ""}\n\nUses each athlete's best recorded attempt in each period (calendar weeks start Monday). Only matching load, duration and side are compared. Current periods are partial; this is recorded performance, not a causal assessment of training.` };
}

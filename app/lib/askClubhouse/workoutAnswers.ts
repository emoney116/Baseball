import type { AppData, WorkoutEntry } from "../../types.ts";
import type { AskClubhouseUiContext } from "./types.ts";
import { composeAskClubhouseQueryPlan } from "./queryPlan.ts";
import { formatTestResult, testComparisonKey, testConditionLabel } from "../workoutTesting.ts";
import { resolveAskClubhousePlayer } from "./entityResolution.ts";

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Uses only the already-authorized canonical rows supplied to Ask. */
export function workoutAnswer(data: AppData, question: string, context: AskClubhouseUiContext | undefined, now: Date) {
  const best = /\b(best|leader|leaders|highest|most)\b/i.test(question) && /\b(each|every|per) exercise\b/i.test(question);
  const total = /\b(total|how many|sum)\b/i.test(question) && /\b(push[ -]?ups?|pull[ -]?ups?|reps|repetitions)\b/i.test(question);
  if (!best && !total) return undefined;
  const player = resolveAskClubhousePlayer({ data, message: question, route: "clubhouse_data", uiContext: context });
  if (player.status === "ambiguous") return { status: "needs_clarification" as const, answer: `Which player: ${player.players.map(p => p.name).join(", ")}?` };
  const plan = composeAskClubhouseQueryPlan(question, context, undefined, now);
  const range = plan.scope.customDateRange ?? context?.analytics?.customDateRange;
  if (!range?.start || !range.end) return { status: "needs_clarification" as const, answer: "Which workout date should I use? You can say today, yesterday, or a date." };
  const { start, end } = range;
  const sessions = new Set(data.workoutSessions.filter(s => s.date >= start && s.date <= end).map(s => s.id));
  const players = new Map(data.players.map(p => [p.id, p.name]));
  const seen = new Set<string>();
  let entries = data.workoutEntries.filter(e => {
    if (seen.has(e.id) || !sessions.has(e.sessionId) || !players.has(e.playerId) || e.status === "Skipped") return false;
    if (player.status === "single" && e.playerId !== player.player.id) return false;
    seen.add(e.id);
    return true;
  });
  if (total) {
    const requested = /push[ -]?ups?/i.test(question) ? "pushup" : /pull[ -]?ups?/i.test(question) ? "pullup" : undefined;
    const names = [...new Set(entries.map(e => e.exercise))].filter(name => normalize(question).includes(normalize(name)));
    if (!requested && names.length !== 1) return { status: "needs_clarification" as const, answer: "Which exercise should I total?" };
    entries = entries.filter(e => requested ? new RegExp(`^${requested}s?(?:$|[0-9]|minute|test)`).test(normalize(e.exercise)) : e.exercise === names[0]);
  }
  const groups = new Map<string, { name: string; condition: string; entries: Array<{ entry: WorkoutEntry; value: number }>; timed: boolean }>();
  for (const entry of entries) {
    const c = entry.testConditions;
    const timed = c?.mode === "MAX_DURATION";
    const value = timed ? entry.value : entry.reps ?? (entry.unit === "reps" ? entry.value : undefined);
    if (value === undefined || !Number.isFinite(value) || value < 0 || (total && timed)) continue;
    const condition = c ? [testConditionLabel(c), entry.testSide].filter(Boolean).join(" / ") : `${entry.weight === undefined ? "Load not tracked" : `${entry.weight} lb`} / duration not tracked`;
    const key = `${normalize(entry.exercise)}:${c ? testComparisonKey(c, entry.testSide) : `${entry.weight ?? "unknown"}:reps`}`;
    const group = groups.get(key) ?? { name: entry.exercise, condition, entries: [], timed };
    group.entries.push({ entry, value });
    groups.set(key, group);
  }
  const period = range.start === range.end ? range.start : `${range.start} through ${range.end}`;
  if (!groups.size) return { status: "no_data" as const, answer: `No recorded ${total ? "rep results for that exercise" : "comparable rep or max-duration results"} for ${period}. Missing results are not zero.` };
  const lines = [...groups.values()].map(group => {
    if (total) {
      const reps = group.entries.reduce((sum, row) => sum + row.value * Math.max(1, row.entry.sets ?? 1), 0);
      return `- ${group.name} (${group.condition}): ${reps} total reps across ${group.entries.length} recorded entries.`;
    }
    const max = Math.max(...group.entries.map(row => row.value));
    const winners = [...new Set(group.entries.filter(row => row.value === max).map(row => players.get(row.entry.playerId)))];
    const c = group.entries[0].entry.testConditions;
    const result = group.timed && c ? `${formatTestResult(max, c)} held` : `${max} reps`;
    return `- ${group.name} (${group.condition}): ${winners.join(" and ")} - ${result}${winners.length > 1 ? " (tie)" : ""}.`;
  });
  return { status: "completed" as const, answer: `${total ? "Recorded team totals" : "Best recorded result per exercise and test condition"} for ${period}:\n${lines.join("\n")}\n\n${total ? "All recorded attempts are included." : "Leaders use highest reps or longest max-duration hold, not an overall strength ranking."} Different loads, durations and sides are kept separate. Untracked results are excluded.` };
}

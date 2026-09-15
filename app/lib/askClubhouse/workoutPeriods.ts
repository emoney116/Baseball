import { composeAskClubhouseQueryPlan } from "./queryPlan.ts";
import type { AskClubhouseUiContext } from "./types.ts";

export type WorkoutPeriod = { start: string; end: string };
export function shiftWorkoutDay(day: string, days: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function workoutPeriods(question: string, context: AskClubhouseUiContext | undefined, now: Date, firstDay?: string) {
  const today = composeAskClubhouseQueryPlan("today", context, undefined, now).scope.customDateRange!.start!;
  const monday = shiftWorkoutDay(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
  const month = `${today.slice(0, 7)}-01`;
  let current: WorkoutPeriod | undefined;
  let prior: WorkoutPeriod | undefined;
  const season = /\bseason\b/i.test(question);
  if (/\bweek\b/i.test(question)) {
    current = { start: monday, end: today };
    prior = { start: shiftWorkoutDay(monday, -7), end: shiftWorkoutDay(monday, -1) };
  } else if (/\bmonth\b/i.test(question)) {
    const priorEnd = shiftWorkoutDay(month, -1);
    current = { start: month, end: today };
    prior = { start: `${priorEnd.slice(0, 7)}-01`, end: priorEnd };
  } else if (season) {
    current = { start: firstDay ?? today, end: today };
  } else {
    const requested = composeAskClubhouseQueryPlan(question, context, undefined, now).scope.customDateRange;
    const selected = requested ?? context?.analytics?.customDateRange;
    if (selected?.start && selected.end) current = { start: selected.start, end: selected.end };
  }
  return { current, prior, season };
}

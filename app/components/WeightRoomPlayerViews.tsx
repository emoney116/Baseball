"use client";
import {
  BarChart3,
  CalendarDays,
  Dumbbell,
  Gauge
} from "lucide-react";
import { uniqueStrings } from "../components/TeamTrainingViews";
import { buildScheduleItems, dateKeyFromIso, formatTime, isUpcomingScheduleItem, localDateKey, todayKey } from "../components/TeamWorkspaceViews";
import { MiniLineChart } from "../components/visuals";
import { playerSelectionLabel } from "../lib/exactRosterIdentity";
import {
  formatNumber,
  shortDate
} from "../lib/stats";
import {
  buildWeightRoomLeaderboard as buildScoredWeightRoomLeaderboard,
  estimatedOneRepMax,
  workoutEntryVolume
} from "../lib/weightRoom";
import type {
  AppData,
  ID,
  Player,
  WorkoutEntry
} from "../types";
export function WeightRoomAthleteOverview({ player, profile }: { data: AppData; player: Player; profile: ReturnType<typeof buildWeightRoomPlayerProfile> }) {
  const score = profile.score?.score;
  const focus = buildWeightRoomAthleteFocus(player, profile);
  const nextLift = profile.nextLift;
  const nextLiftDate = nextLift ? dateKeyFromIso(nextLift.startAt) : undefined;

  return (
    <div className="weight-room-athlete-overview">
      <section className="weight-room-week-summary" aria-label={`${playerSelectionLabel(player)} weight room summary`}>
        <h3>This Week</h3>
        <div className="weight-room-week-summary__metrics">
          <span>
            <CalendarDays size={18} aria-hidden="true" />
            <small>Workouts</small>
            <strong>{profile.completedWorkoutsThisWeek}</strong>
            <em>{profile.scheduledWorkoutsThisWeek ? `of ${profile.scheduledWorkoutsThisWeek} scheduled` : "none scheduled"}</em>
          </span>
          <span>
            <Dumbbell size={18} aria-hidden="true" />
            <small>Total Volume</small>
            <strong>{formatWorkoutVolume(profile.volume)}</strong>
            <em className={weightRoomDeltaClass(profile.volumeChangePct)}>{formatWeightRoomTrend(profile.volumeChangePct, "vs last week")}</em>
          </span>
          <span>
            <BarChart3 size={18} aria-hidden="true" />
            <small>Sets</small>
            <strong>{profile.sets}</strong>
            <em>{formatSignedCount(profile.setChange, "vs last week")}</em>
          </span>
          <span>
            <Gauge size={18} aria-hidden="true" />
            <small>Current Weight</small>
            <strong>{profile.currentWeight ? `${formatNumber(profile.currentWeight, 1)} lb` : "--"}</strong>
            <em>{profile.weightChange ? formatSignedWeight(profile.weightChange) : "No change"}</em>
          </span>
          <span className="weight-room-week-summary__score">
            <i style={{ ["--score" as string]: `${Math.max(0, Math.min(100, score ?? 0))}%` }} aria-hidden="true">
              <strong>{score ?? "--"}</strong>
            </i>
            <small>Development Score</small>
          </span>
        </div>
      </section>

      <section className="weight-room-focus-panel">
        <div>
          <span>Focus This Week</span>
          <h3>{focus.title}</h3>
          <p>{focus.body}</p>
        </div>
        {profile.weightTrend.length > 1 && <MiniLineChart values={profile.weightTrend} labels={["Start", "Now"]} />}
      </section>

      {nextLift && (
        <section className="weight-room-next-workout">
          <CalendarDays size={18} aria-hidden="true" />
          <span>Next Workout</span>
          <strong>{nextLift.title}</strong>
          <small>{nextLiftDate ? formatRelativeWorkoutDate(nextLiftDate) : shortDate(nextLift.startAt)}{nextLift.startAt ? ` - ${formatTime(nextLift.startAt)}` : ""}</small>
        </section>
      )}
    </div>
  );
}

export function formatWorkoutVolume(value: number) {
  if (!value) return "--";
  if (value >= 1000) return `${formatCompactNumber(value)} lbs`;
  return `${formatNumber(value, 0)} lbs`;
}

export function latestBodyWeight(data: AppData, playerId: ID, throughDate?: string, exactDateOnly = false) {
  const sessions = data.workoutSessions
    .filter((session) => session.playerId === playerId && typeof session.bodyWeight === "number")
    .filter((session) => exactDateOnly ? session.date === throughDate : !throughDate || session.date <= throughDate)
    .sort((left, right) => right.date.localeCompare(left.date) || right.updatedAt.localeCompare(left.updatedAt));
  return sessions[0]?.bodyWeight;
}

export function previousBodyWeight(data: AppData, playerId: ID, beforeDate: string) {
  const sessions = data.workoutSessions
    .filter((session) => session.playerId === playerId && typeof session.bodyWeight === "number" && session.date < beforeDate)
    .sort((left, right) => right.date.localeCompare(left.date) || right.updatedAt.localeCompare(left.updatedAt));
  return sessions[0]?.bodyWeight;
}

export function shiftDateKey(dateKey: string, days: number) {
  const date = parseDateKey(dateKey) ?? new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

export function buildWeightRoomPlayerProfile(data: AppData, player: Player) {
  const sessions = data.workoutSessions.filter((session) => session.playerId === player.id).sort((left, right) => right.date.localeCompare(left.date));
  const entries = data.workoutEntries.filter((entry) => entry.playerId === player.id);
  const today = todayKey();
  const week = weekStart(today);
  const previousWeek = shiftDateKey(week, -7);
  const sessionsThisWeek = sessions.filter((session) => (session.weekOf || weekStart(session.date)) === week);
  const sessionsPreviousWeek = sessions.filter((session) => (session.weekOf || weekStart(session.date)) === previousWeek);
  const sessionIdsThisWeek = new Set(sessionsThisWeek.map((session) => session.id));
  const sessionIdsPreviousWeek = new Set(sessionsPreviousWeek.map((session) => session.id));
  const entriesThisWeek = entries.filter((entry) => sessionIdsThisWeek.has(entry.sessionId) && (entry.status ?? "Completed") !== "Skipped");
  const entriesPreviousWeek = entries.filter((entry) => sessionIdsPreviousWeek.has(entry.sessionId) && (entry.status ?? "Completed") !== "Skipped");
  const score = buildScoredWeightRoomLeaderboard([player], data.workoutSessions, data.workoutEntries, "This Week", today)[0]
    ?? buildScoredWeightRoomLeaderboard([player], data.workoutSessions, data.workoutEntries, "This Season", today)[0];
  const currentWeight = latestBodyWeight(data, player.id);
  const previousWeight = previousBodyWeight(data, player.id, today);
  const volume = entriesThisWeek.reduce((sum, entry) => sum + workoutEntryVolume(entry), 0);
  const previousVolume = entriesPreviousWeek.reduce((sum, entry) => sum + workoutEntryVolume(entry), 0);
  const setCount = entriesThisWeek.reduce((sum, entry) => sum + Math.max(1, entry.sets ?? 1), 0);
  const previousSetCount = entriesPreviousWeek.reduce((sum, entry) => sum + Math.max(1, entry.sets ?? 1), 0);
  const nextLift = buildScheduleItems(data)
    .filter((item) => item.eventType === "Lift" && item.status !== "Completed" && item.status !== "Cancelled" && isUpcomingScheduleItem(item))
    .sort((left, right) => Date.parse(left.startAt) - Date.parse(right.startAt))[0];
  const bodyWeights = sessions
    .filter((session) => typeof session.bodyWeight === "number")
    .slice()
    .reverse()
    .map((session) => session.bodyWeight ?? 0);
  const exerciseTrends = uniqueStrings(entries.map((entry) => entry.exercise)).map((exercise) => trendForExercise(entries.filter((entry) => entry.exercise === exercise))).filter((trend) => trend.samples > 1);
  return {
    workoutsThisWeek: new Set(sessionsThisWeek.map((session) => session.date)).size,
    completedWorkoutsThisWeek: new Set(sessionsThisWeek.filter((session) => session.completed).map((session) => session.date)).size,
    scheduledWorkoutsThisWeek: new Set(sessionsThisWeek.map((session) => session.date)).size,
    volume,
    volumeChangePct: previousVolume > 0 ? ((volume - previousVolume) / previousVolume) * 100 : undefined,
    sets: setCount,
    setChange: sessionsPreviousWeek.length || previousSetCount ? setCount - previousSetCount : undefined,
    currentWeight,
    weightChange: typeof currentWeight === "number" && typeof previousWeight === "number" ? currentWeight - previousWeight : undefined,
    score,
    weightTrend: bodyWeights,
    exerciseTrends,
    nextLift,
  };
}

export function firstName(player: Player) {
  return player.name.split(" ")[0] ?? player.name;
}

export function buildWeightRoomAthleteFocus(player: Player, profile: ReturnType<typeof buildWeightRoomPlayerProfile>) {
  if (!profile.sets) {
    return {
      title: "Build workout history",
      body: "Not enough workout history yet to identify a focus area.",
    };
  }
  const trends = profile.exerciseTrends.slice().sort((left, right) => left.changePct - right.changePct);
  const weakest = trends[0];
  const strongest = trends[trends.length - 1];
  if (weakest && weakest.changePct < -1) {
    return {
      title: `Stabilize ${weakest.exercise}`,
      body: `${weakest.exercise} is down ${formatNumber(Math.abs(weakest.changePct), 1)}% across comparable logged sets.`,
    };
  }
  if (weakest && Math.abs(weakest.changePct) <= 1) {
    return {
      title: `Move ${weakest.exercise} forward`,
      body: `${weakest.exercise} has held nearly flat across recent comparable sessions.`,
    };
  }
  if (strongest && strongest.changePct > 1) {
    return {
      title: `Keep building ${strongest.exercise}`,
      body: `${firstName(player)} is trending up ${formatNumber(strongest.changePct, 1)}% on ${strongest.exercise}.`,
    };
  }
  return {
    title: "Keep logging comparable sets",
    body: "Consistent weekly workout entries will make the next focus recommendation more specific.",
  };
}

export function formatWeightRoomTrend(value: number | undefined, suffix: string) {
  if (typeof value !== "number") return "No prior week";
  if (Math.abs(value) < 0.05) return "No change";
  return `${value > 0 ? "+" : ""}${formatNumber(value, 0)}% ${suffix}`;
}

export function formatSignedCount(value: number | undefined, suffix: string) {
  if (typeof value !== "number") return "No prior week";
  if (value === 0) return "No change";
  return `${value > 0 ? "+" : ""}${value} ${suffix}`;
}

export function formatSignedWeight(value: number) {
  if (Math.abs(value) < 0.05) return "No change";
  return `${value > 0 ? "+" : ""}${formatNumber(value, 1)} lb`;
}

export function formatRelativeWorkoutDate(date: string) {
  const today = todayKey();
  if (date === today) return "Today";
  if (date === shiftDateKey(today, 1)) return "Tomorrow";
  return shortDate(date);
}

export function workoutEntryComparableForDisplay(entry: WorkoutEntry) {
  if (entry.unit === "sec" && typeof entry.value === "number") return -entry.value;
  return estimatedOneRepMax(entry.weight, entry.reps) ?? entry.weight ?? entry.value ?? entry.reps ?? 0;
}

export function weightRoomDeltaClass(value?: number) {
  if (typeof value !== "number" || Math.abs(value) < 0.05) return "";
  return value > 0 ? "positive" : "negative";
}

export function trendForExercise(entries: WorkoutEntry[]) {
  const sorted = entries.slice().sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const first = sorted[0];
  const latest = sorted[sorted.length - 1];
  const firstValue = first ? workoutEntryComparableForDisplay(first) : 0;
  const latestValue = latest ? workoutEntryComparableForDisplay(latest) : 0;
  const changePct = firstValue ? ((latestValue - firstValue) / Math.abs(firstValue)) * 100 : 0;
  return {
    exercise: latest?.exercise ?? first?.exercise ?? "Exercise",
    samples: sorted.length,
    changePct,
  };
}

export function parseDateKey(dateKey?: string) {
  if (!dateKey) return undefined;
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: value >= 1000 ? 1 : 0 }).format(value);
}

export function weekStart(dateString: string) {
  const date = new Date(`${dateString}T12:00:00`);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date.toISOString().slice(0, 10);
}

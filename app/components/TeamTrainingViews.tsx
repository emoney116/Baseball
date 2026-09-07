"use client";
import {
  Check,
  ChevronRight
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { buildScheduleItems, CompactEmpty, dateKeyFromIso, formatTime, isUpcomingScheduleItem, ScheduleItem, ScheduleTypeIcon, SegmentedControl } from "../components/TeamWorkspaceViews";
import { deriveConcurrentPracticeTotals } from "../lib/practiceConcurrency";
import {
  formatNumber,
  shortDate
} from "../lib/stats";
import {
  workoutEntryVolume
} from "../lib/weightRoom";
import type {
  AppData,
  ExerciseKind,
  ID,
  Player,
  PracticeType,
  WorkoutEntry,
  WorkoutSession
} from "../types";
export type WeightRoomWorkoutStatus = "Idle" | "In Progress" | "Paused" | "Completed";

export type WeightRoomExerciseCategory = "Lower Body" | "Upper Body" | "Power" | "Core" | "Conditioning" | "Speed" | "Mobility" | "Other";

export type WorkoutMeasurementType = "WEIGHT_REPS" | "BODYWEIGHT_REPS" | "REPS_ONLY" | "TIME" | "DISTANCE" | "HEIGHT" | "WEIGHT_ONLY" | "COUNT" | "COMPLETION" | "RPE_ONLY" | "CUSTOM";

export type WorkoutPerformanceDirection = "HIGHER_IS_BETTER" | "LOWER_IS_BETTER";

export type WorkoutTargetStyle = "Standard" | "Max Reps" | "Target Reps" | "Max Time" | "Target Time" | "Best Time" | "Best Distance" | "Max Weight" | "Completion";

export type WeightRoomExercise = {
  name: string;
  category: WeightRoomExerciseCategory;
  measurementType: WorkoutMeasurementType;
  kind: ExerciseKind;
  unit?: WorkoutEntry["unit"];
  equipment?: string;
  active: boolean;
  targetSets?: number;
  targetReps?: number;
  targetValue?: number;
  defaultTargetStyle?: WorkoutTargetStyle;
  performanceDirection?: WorkoutPerformanceDirection;
};

export type ActiveWorkoutStation = WeightRoomExercise & {
  id: ID;
  displayOrder: number;
  targetStyle: WorkoutTargetStyle;
  performanceDirection: WorkoutPerformanceDirection;
  targetValue?: number;
  notes?: string;
};

export type ActiveWorkoutCell = {
  playerId: ID;
  exercise: string;
  setNumber: number;
};

export interface WeightRoomWorkoutSummary {
  date: string;
  title: string;
  location?: string;
  startAt?: string;
  athletes: number;
  sets: number;
  volume: number;
  completed: boolean;
}

export const TRACKING_VELOCITY_MIN_MPH = 1;

export const TRACKING_VELOCITY_MAX_MPH = 300;

export const TRACKING_VELOCITY_OPTIONS = Array.from(
  { length: TRACKING_VELOCITY_MAX_MPH - TRACKING_VELOCITY_MIN_MPH + 1 },
  (_, index) => TRACKING_VELOCITY_MIN_MPH + index,
);

export function PracticeHistoryTab({ data, onOpenPractice }: { data: AppData; onOpenPractice: (practiceId: ID) => void }) {
  const [filter, setFilter] = useState<"All" | PracticeType>("All");
  const filters = ["All", ...uniqueStrings(data.practices.map((practice) => practice.type))] as Array<"All" | PracticeType>;
  const practices = data.practices.filter((practice) => filter === "All" || practice.type === filter);
  return (
    <section className="panel practice-history-panel">
      <div className="panel-heading tight">
        <div>
          <h2>History</h2>
          <span>Completed practice archive and session totals.</span>
        </div>
        <SegmentedControl values={filters} active={filter} onChange={setFilter} />
      </div>
      <div className="practice-history-rows">
        {practices.map((practice) => {
          const totals = practiceTotals(data, practice.id);
          const attendance = data.attendance.filter((row) => row.practiceId === practice.id);
          const active = attendance.filter((row) => row.status !== "Absent");
          return (
            <button key={practice.id} type="button" onClick={() => onOpenPractice(practice.id)}>
              <span>
                <strong>{shortDate(practice.date)}</strong>
                <small>{practice.location || "Field"}</small>
              </span>
              <em>{active.length || practice.playerIds.length} players</em>
              <em>{totals.pitches} pitches</em>
              <em>{totals.swings} swings</em>
              <em>{totals.defense} defense</em>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          );
        })}
        {!practices.length && <CompactEmpty title="No practices match this filter" />}
      </div>
    </section>
  );
}

export function VelocityPickerField({
  label,
  value,
  onChange,
  defaultValue,
  ariaLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  defaultValue: number;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [draftValue, setDraftValue] = useState(() => normalizedVelocityValue(value, defaultValue));
  const selectedRef = useRef<HTMLButtonElement | null>(null);
  const pointerStartRef = useRef<number | null>(null);
  const currentValue = normalizedVelocityValue(value, defaultValue);

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => selectedRef.current?.scrollIntoView({ block: "center" }), 0);
  }, [open, draftValue]);

  useEffect(() => {
    if (!open) return undefined;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  function openPicker() {
    setDraftValue(normalizedVelocityValue(value, defaultValue));
    setOpen(true);
  }

  return (
    <div className="velocity-picker-field">
      <button className="velocity-picker-field__trigger" type="button" onClick={openPicker} aria-label={ariaLabel}>
        <span>{label}</span>
        <strong>{value.trim() ? currentValue : "--"}</strong>
        <em>mph</em>
      </button>
      {open && (
        <div className="velocity-picker-field__popover" role="dialog" aria-label={`${label} selector`}>
          <div className="velocity-picker-field__head">
            <button type="button" onClick={() => setOpen(false)}>Cancel</button>
            <strong>{label}</strong>
            <button type="button" onClick={() => { onChange(String(draftValue)); setOpen(false); }}>Done</button>
          </div>
          <div className="velocity-picker-field__wheel" role="listbox" aria-label={`${label} velocity`}>
            {TRACKING_VELOCITY_OPTIONS.map((option) => (
              <button
                key={option}
                ref={draftValue === option ? selectedRef : undefined}
                type="button"
                role="option"
                aria-selected={draftValue === option}
                className={draftValue === option ? "active" : ""}
                onPointerDown={(event) => { pointerStartRef.current = event.clientY; }}
                onClick={(event) => {
                  const moved = pointerStartRef.current !== null && Math.abs(event.clientY - pointerStartRef.current) > 8;
                  pointerStartRef.current = null;
                  setDraftValue(option);
                  if (moved) return;
                  onChange(String(option));
                  setOpen(false);
                }}
              >
                <span>{option}</span>
                <em>mph</em>
              </button>
            ))}
          </div>
          <button className="velocity-picker-field__clear" type="button" onClick={() => { onChange(""); setOpen(false); }}>Clear</button>
        </div>
      )}
    </div>
  );
}

export function normalizedVelocityValue(value: string, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(TRACKING_VELOCITY_MIN_MPH, Math.min(TRACKING_VELOCITY_MAX_MPH, Math.round(parsed)));
}

export function WeightRoomRecentWorkouts({
  data,
  players,
  activeWorkout,
  onStart,
  onReview,
  onViewAll,
  expanded = false,
}: {
  data: AppData;
  players: Player[];
  activeWorkout?: { status: WeightRoomWorkoutStatus; date: string; title: string; eventId?: ID };
  onStart?: (input?: { title?: string; date?: string; location?: string; eventId?: ID }) => void;
  onReview?: (row: WeightRoomWorkoutSummary) => void;
  onViewAll?: () => void;
  expanded?: boolean;
}) {
  const allWorkoutRows = buildRecentWeightRoomWorkouts(data, players);
  const allLiftRows = buildScheduleItems(data)
    .filter((item) => item.eventType === "Lift" && item.status !== "Cancelled")
    .sort((left, right) => Date.parse(left.startAt) - Date.parse(right.startAt));
  const upcomingLifts = allLiftRows.filter((item) => item.status !== "Completed" && isUpcomingScheduleItem(item));
  const lifts = expanded ? upcomingLifts.slice(0, 5) : upcomingLifts.slice(0, 1);
  const completedRows = allWorkoutRows.filter((row) => row.completed);
  const openRows = allWorkoutRows.filter((row) => !row.completed);
  const workoutRows = expanded
    ? [...openRows, ...completedRows].slice(0, 8)
    : completedRows.slice(0, 1);
  const totalRows = lifts.length + workoutRows.length;
  const activeRunning = activeWorkout?.status === "In Progress" || activeWorkout?.status === "Paused";
  const presetNames = new Set((data.weightRoomExercisePresets ?? []).filter((preset) => !preset.archivedAt).map((preset) => preset.name.toLowerCase()));
  const displayWorkoutTitle = (title: string) => presetNames.has(title.toLowerCase()) ? title : "Team Lift";
  const labelForLift = (item: ScheduleItem) => {
    const activeMatch = activeRunning
      && ((activeWorkout?.eventId && item.source === "event" && item.sourceId === activeWorkout.eventId)
        || (item.date === activeWorkout?.date && item.title === activeWorkout?.title));
    const hasStartedData = allWorkoutRows.some((row) => row.date === item.date && row.title === item.title && !row.completed && (row.sets > 0 || row.athletes > 0));
    if (activeMatch) return activeWorkout?.status === "Paused" ? "Paused" : "Started";
    if (hasStartedData) return "Started";
    return "Scheduled";
  };

  return (
    <article className="panel weight-room-recent-card">
      <div className="panel-heading tight">
        <div>
          <span>{expanded ? "Workout History" : "Team sessions"}</span>
          <h2>{totalRows ? "Lifts" : "No workouts yet"}</h2>
        </div>
        {!expanded && onViewAll && totalRows > 0 && (
          <button className="text-button" type="button" onClick={onViewAll}>View All</button>
        )}
      </div>
      <div className="weight-room-workout-list">
        {lifts.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={!onStart}
            onClick={() => onStart?.({ title: item.title, date: item.date, location: item.location, eventId: item.source === "event" ? item.sourceId : undefined })}
          >
            <ScheduleTypeIcon type="Lift" />
            <span>
              <strong>{displayWorkoutTitle(item.title)}</strong>
              <small>{formatWeightRoomSessionMeta(item.date, item.startAt)}</small>
            </span>
            <em>{labelForLift(item)}</em>
          </button>
        ))}
        {workoutRows.map((row) => (
          <button
            key={`${row.date}-${row.title}`}
            type="button"
            disabled={!onReview && !onStart}
            onClick={() => onReview && (row.completed || !onStart) ? onReview(row) : onStart?.({ title: row.title, date: row.date, location: row.location })}
          >
            <ScheduleTypeIcon type="Lift" />
            <span>
              <strong>{displayWorkoutTitle(row.title)}</strong>
              <small>{formatWeightRoomSessionMeta(row.date, row.startAt)}</small>
            </span>
            <em>{row.completed ? "Completed" : "Started"}</em>
          </button>
        ))}
        {!totalRows && <CompactEmpty title={onStart ? "Start the first lift to begin tracking." : "No workout history yet."} />}
      </div>
    </article>
  );
}

export function WeightRoomInlineSetCell({
  cell,
  station,
  entry,
  previousEntry,
  disabled,
  onSaveCell,
  explicitSave = false,
}: {
  cell: ActiveWorkoutCell;
  station: ActiveWorkoutStation;
  entry?: WorkoutEntry;
  previousEntry?: WorkoutEntry;
  disabled: boolean;
  onSaveCell: (cell: ActiveWorkoutCell, draft: { weight?: number; reps?: number; value?: number; rpe?: number; unit?: WorkoutEntry["unit"]; status?: WorkoutEntry["status"] }) => void;
  explicitSave?: boolean;
}) {
  const [weight, setWeight] = useState(entry?.weight?.toString() ?? "");
  const [reps, setReps] = useState(entry?.reps?.toString() ?? "");
  const [value, setValue] = useState((station.measurementType === "RPE_ONLY" ? entry?.rpe : entry?.value)?.toString() ?? "");
  const isWeightReps = station.measurementType === "WEIGHT_REPS";
  const isRepsOnly = station.measurementType === "BODYWEIGHT_REPS" || station.measurementType === "REPS_ONLY" || station.measurementType === "COUNT";
  const isWeightOnly = station.measurementType === "WEIGHT_ONLY";
  const isCompletion = station.measurementType === "COMPLETION" || station.targetStyle === "Completion";

  function clean(valueToClean: string) {
    return valueToClean.replace(/[^0-9.]/g, "");
  }

  function save() {
    if (disabled) return;
    const parsedValue = station.measurementType === "TIME"
      ? optionalTimeValue(value)
      : station.measurementType === "DISTANCE" || station.measurementType === "HEIGHT"
        ? optionalDistanceValue(value)
        : optionalNumber(value);
    const draft = {
      weight: isWeightReps || isWeightOnly ? optionalNumber(weight) : undefined,
      reps: isWeightReps || isRepsOnly ? optionalNumber(reps) : undefined,
      value: isCompletion ? 1 : isWeightReps || isWeightOnly || isRepsOnly || station.measurementType === "RPE_ONLY" ? undefined : parsedValue,
      rpe: station.measurementType === "RPE_ONLY" ? parsedValue : undefined,
      unit: isWeightReps || isWeightOnly ? "lb" as const : isRepsOnly ? "reps" as const : station.unit,
      status: "Completed" as const,
    };
    if (isCompletion || typeof draft.weight === "number" || typeof draft.reps === "number" || typeof draft.value === "number" || typeof draft.rpe === "number") {
      onSaveCell(cell, draft);
    }
  }

  function handleKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.currentTarget.blur();
      if (explicitSave) save();
    }
  }

  const previousText = previousEntry ? formatWorkoutEntryValueForStation(previousEntry, station) : undefined;
  return (
    <div className={entry ? "weight-room-inline-set-cell complete" : "weight-room-inline-set-cell"} aria-label={`${station.name} ${stationAttemptLabel(station).toLowerCase()} ${cell.setNumber}`}>
      {isWeightReps ? (
        <div className="weight-room-inline-set-fields two">
          <label>
            <span>lbs</span>
            <input disabled={disabled} inputMode="decimal" value={weight} placeholder={previousEntry?.weight?.toString() ?? "Weight"} onBlur={explicitSave ? undefined : save} onKeyDown={handleKey} onChange={(event) => setWeight(clean(event.target.value))} />
          </label>
          <label>
            <span>reps</span>
            <input disabled={disabled} inputMode="numeric" value={reps} placeholder={station.targetReps ? `${station.targetReps}` : previousEntry?.reps?.toString() ?? "Reps"} onBlur={explicitSave ? undefined : save} onKeyDown={handleKey} onChange={(event) => setReps(clean(event.target.value))} />
          </label>
        </div>
      ) : isRepsOnly ? (
        <div className="weight-room-inline-set-fields">
          <label>
            <span>reps</span>
            <input disabled={disabled} inputMode="numeric" value={reps} placeholder={station.targetReps ? `${station.targetReps}` : "Reps"} onBlur={explicitSave ? undefined : save} onKeyDown={handleKey} onChange={(event) => setReps(clean(event.target.value))} />
          </label>
        </div>
      ) : isWeightOnly ? (
        <div className="weight-room-inline-set-fields">
          <label>
            <span>lbs</span>
            <input disabled={disabled} inputMode="decimal" value={weight} placeholder={previousEntry?.weight?.toString() ?? "Weight"} onBlur={explicitSave ? undefined : save} onKeyDown={handleKey} onChange={(event) => setWeight(clean(event.target.value))} />
          </label>
        </div>
      ) : isCompletion ? (
        <button className="weight-room-completion-cell" type="button" disabled={disabled} onClick={save}>
          <Check size={15} aria-hidden="true" />
          Complete
        </button>
      ) : station.measurementType === "RPE_ONLY" ? (
        <div className="weight-room-inline-set-fields">
          <label>
            <span>score</span>
            <input disabled={disabled} inputMode="decimal" value={value} placeholder="1-10" onBlur={explicitSave ? undefined : save} onKeyDown={handleKey} onChange={(event) => setValue(clean(event.target.value))} />
          </label>
        </div>
      ) : (
        <div className="weight-room-inline-set-fields">
          <label>
            <span>{station.unit ?? weightRoomMeasurementLabel(station)}</span>
            <input
              disabled={disabled}
              inputMode="decimal"
              value={value}
              placeholder={previousEntry ? formatWorkoutEntryValueForStation(previousEntry, station) : weightRoomMeasurementLabel(station)}
              onBlur={explicitSave ? undefined : save}
              onKeyDown={handleKey}
              onChange={(event) => setValue(cleanWorkoutMeasurementDraft(event.target.value, station.measurementType))}
            />
          </label>
        </div>
      )}
      {explicitSave && !isCompletion && <button type="button" className="primary-button" disabled={disabled} onClick={save}><Check size={16} />{entry ? "Save Correction" : "Save Set"}</button>}
      <small>{entry ? formatWorkoutEntryValueForStation(entry, station) : previousText && previousText !== "--" ? `Prev ${previousText}` : station.targetReps ? `${station.targetReps} target` : "Enter"}</small>
    </div>
  );
}

export function stationAttemptLabel(station: Pick<ActiveWorkoutStation, "targetStyle">) {
  return ["Best Time", "Best Distance", "Max Weight", "Max Time", "Max Reps"].includes(station.targetStyle) ? "Attempts" : "Sets";
}

export function weightRoomMeasurementLabel(exercise?: WeightRoomExercise) {
  if (!exercise) return "Value";
  if (exercise.measurementType === "TIME") return "Time";
  if (exercise.measurementType === "DISTANCE") return "Distance";
  if (exercise.measurementType === "HEIGHT") return "Height";
  if (exercise.measurementType === "WEIGHT_ONLY") return "Weight";
  if (exercise.measurementType === "COMPLETION") return "Completion";
  if (exercise.measurementType === "BODYWEIGHT_REPS" || exercise.measurementType === "REPS_ONLY" || exercise.measurementType === "COUNT") return "Reps";
  return "Value";
}

export function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function optionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function optionalTimeValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.includes(":")) {
    const [minutesRaw, secondsRaw = "0"] = trimmed.split(":");
    const minutes = Number(minutesRaw);
    const seconds = Number(secondsRaw);
    if (Number.isFinite(minutes) && Number.isFinite(seconds)) return (minutes * 60) + seconds;
  }
  return optionalNumber(trimmed);
}

export function optionalDistanceValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const feetInches = trimmed.match(/^(\d+)\s*(?:'|ft)\s*(\d+(?:\.\d+)?)?/i);
  if (feetInches) {
    const feet = Number(feetInches[1]);
    const inches = Number(feetInches[2] ?? 0);
    if (Number.isFinite(feet) && Number.isFinite(inches)) return (feet * 12) + inches;
  }
  return optionalNumber(trimmed.replace(/["in\s]/gi, ""));
}

export function cleanWorkoutMeasurementDraft(value: string, measurementType: WorkoutMeasurementType) {
  if (measurementType === "TIME") return value.replace(/[^0-9:.]/g, "");
  if (measurementType === "DISTANCE" || measurementType === "HEIGHT") return value.replace(/[^0-9.'"\s]/g, "");
  return value.replace(/[^0-9.]/g, "");
}

export function formatWorkoutEntryValue(entry: WorkoutEntry) {
  if (typeof entry.weight === "number" && typeof entry.reps === "number") return `${formatNumber(entry.weight, 0)} lb x ${entry.reps}`;
  if (typeof entry.weight === "number") return `${formatNumber(entry.weight, 0)} lb`;
  if (typeof entry.value === "number" && entry.unit === "sec") return formatSecondsValue(entry.value);
  if (typeof entry.value === "number" && entry.unit === "in") return formatInchesValue(entry.value);
  if (typeof entry.value === "number") return `${formatNumber(entry.value, 1)}${entry.unit ? ` ${entry.unit}` : ""}`;
  if (typeof entry.reps === "number") return `${entry.reps} reps`;
  return "--";
}

export function formatWorkoutEntryValueForStation(entry: WorkoutEntry, station?: Pick<ActiveWorkoutStation, "measurementType" | "targetStyle" | "unit">) {
  if (!station) return formatWorkoutEntryValue(entry);
  if (station.measurementType === "WEIGHT_REPS") {
    if (typeof entry.weight === "number" && typeof entry.reps === "number") return `${formatNumber(entry.weight, 0)} lb x ${entry.reps}`;
    if (typeof entry.weight === "number") return `${formatNumber(entry.weight, 0)} lb`;
    if (typeof entry.reps === "number") return `${entry.reps} reps`;
    return "--";
  }
  if (station.measurementType === "WEIGHT_ONLY") {
    const value = entry.weight ?? entry.value;
    return typeof value === "number" ? `${formatNumber(value, 0)} lb` : "--";
  }
  if (station.measurementType === "BODYWEIGHT_REPS" || station.measurementType === "REPS_ONLY" || station.measurementType === "COUNT") {
    const value = entry.reps ?? entry.value;
    return typeof value === "number" ? `${formatNumber(value, 0)} reps` : "--";
  }
  if (station.measurementType === "TIME") {
    return typeof entry.value === "number" ? formatSecondsValue(entry.value) : "--";
  }
  if (station.measurementType === "DISTANCE" || station.measurementType === "HEIGHT") {
    return typeof entry.value === "number" ? formatInchesValue(entry.value) : "--";
  }
  if (station.measurementType === "COMPLETION" || station.targetStyle === "Completion") {
    return (entry.status ?? "Completed") === "Skipped" ? "Skipped" : "Completed";
  }
  if (station.measurementType === "RPE_ONLY") {
    return typeof entry.rpe === "number" ? `${formatNumber(entry.rpe, 1)} RPE` : typeof entry.value === "number" ? formatNumber(entry.value, 1) : "--";
  }
  return formatWorkoutEntryValue(entry);
}

export function formatSecondsValue(value: number) {
  if (value >= 60) {
    const minutes = Math.floor(value / 60);
    const seconds = Math.round(value % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  }
  return `${formatNumber(value, 2)} sec`;
}

export function formatInchesValue(value: number) {
  if (value >= 24) {
    const feet = Math.floor(value / 12);
    const inches = Math.round(value - feet * 12);
    return `${feet}'${inches}"`;
  }
  return `${formatNumber(value, 1)} in`;
}

export function buildRecentWeightRoomWorkouts(data: AppData, players: Player[]): WeightRoomWorkoutSummary[] {
  const playerIds = new Set(players.map((player) => player.id));
  const byDate = new Map<string, WorkoutSession[]>();
  for (const session of data.workoutSessions.filter((item) => playerIds.has(item.playerId))) {
    const group = byDate.get(session.date) ?? [];
    group.push(session);
    byDate.set(session.date, group);
  }
  return [...byDate.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([date, sessions]) => {
      const sessionIds = new Set(sessions.map((session) => session.id));
      const entries = data.workoutEntries.filter((entry) => sessionIds.has(entry.sessionId));
      const liftEvent = (data.scheduleEvents ?? []).find((event) => event.eventType === "Lift" && dateKeyFromIso(event.startAt) === date);
      return {
        date,
        title: liftEvent?.title ?? "Team Lift",
        location: liftEvent?.location,
        startAt: liftEvent?.startAt,
        athletes: new Set(sessions.map((session) => session.playerId)).size,
        sets: entries.filter((entry) => (entry.status ?? "Completed") !== "Skipped").length,
        volume: entries.reduce((sum, entry) => sum + workoutEntryVolume(entry), 0),
        completed: sessions.length > 0 && sessions.every((session) => session.completed),
      };
    });
}

export function formatWeightRoomSessionMeta(date: string, startAt?: string) {
  return [shortDate(date), startAt ? formatTime(startAt) : undefined].filter(Boolean).join(" - ");
}

export function practiceTotals(data: AppData, practiceId: ID) {
  const totals = deriveConcurrentPracticeTotals(data, practiceId);
  return {
    pitches: totals.pitches,
    swings: totals.swings,
    defense: totals.defense,
    liveBpPas: data.plateAppearances.filter((appearance) => appearance.practiceId === practiceId).length,
    hittingSessions: data.hittingSessions.filter((session) => session.practiceId === practiceId).length,
    pitchingSessions: data.pitchingSessions.filter((session) => session.practiceId === practiceId).length,
    defenseSessions: data.defenseSessions.filter((session) => session.practiceId === practiceId).length,
  };
}

"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Pencil, Save, Undo2, Radio, RefreshCw } from "lucide-react";
import { StrikeZone } from "./visuals";
import { ClubhouseBaseballField } from "./ClubhouseBaseballField";
import { ChoiceSelect } from "./ChoiceSelect";
import { PracticeResultChoices } from "./PracticeResultChoices";
import { VelocityPickerField, WeightRoomInlineSetCell, type ActiveWorkoutStation } from "./TeamTrainingViews";
import {
  LIVE_FIELDS,
  LIVE_RESULTS,
  liveCapability,
  normalizeLivePayload,
  type LiveDomain,
  type LiveField,
  type PlayerLiveEntry as Entry,
  type PlayerLiveSession,
  type PlayerLiveState,
} from "../lib/playerLiveModels";
import type { WorkoutEntry, ZonePoint } from "../types";

export type LiveSubmission = {
  membershipId: string;
  sessionId: string;
  domain: LiveDomain;
  operation: "create" | "update" | "delete";
  requestId: string;
  entryId?: string;
  payload: Record<string, unknown>;
};
export type LiveTransport = {
  load: () => Promise<PlayerLiveState>;
  save: (body: LiveSubmission) => Promise<{ id: string }>;
};
class LiveHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
async function decode(r: Response) {
  const p = await r.json();
  if (!r.ok)
    throw new LiveHttpError(
      p.message ?? "Unable to verify live access.",
      r.status,
    );
  return p;
}

export function PlayerLiveEntry({
  membershipId,
  domain,
  excludeWorkout = false,
  onSaved,
  transport,
}: {
  membershipId: string;
  domain?: LiveDomain;
  excludeWorkout?: boolean;
  onSaved?: () => void;
  transport?: LiveTransport;
}) {
  const [state, setState] = useState<PlayerLiveState>(),
    [error, setError] = useState(""),
    [selected, setSelected] = useState(""),
    [notice, setNotice] = useState("");
  const hadSession = useRef(false);
  const generation = useRef(0),
    savedCallback = useRef(onSaved);
  useEffect(() => {
    savedCallback.current = onSaved;
  }, [onSaved]);
  const refresh = useCallback(async () => {
    const sequence = ++generation.current;
    try {
      const next = transport
        ? await transport.load()
        : await decode(
            await fetch(
              `/api/player/live-entry?${new URLSearchParams({ membershipId })}`,
              { cache: "no-store" },
            ),
          );
      if (sequence !== generation.current) return;
      if (hadSession.current && !next.sessions.length)
        setNotice(
          "Session ended or assignment changed. Your history is still available.",
        );
      if (next.sessions.length) setNotice("");
      hadSession.current = next.sessions.length > 0;
      setState(next);
      setError("");
    } catch (e) {
      if (sequence === generation.current) {
        setState(undefined);
        setError(
          e instanceof Error ? e.message : "Unable to verify live access.",
        );
      }
    }
  }, [membershipId, transport]);
  useEffect(() => {
    const requestGeneration = generation;
    const initial = window.setTimeout(() => void refresh(), 0),
      timer = window.setInterval(() => void refresh(), 5000);
    window.addEventListener("focus", refresh);
    return () => {
      requestGeneration.current++;
      window.clearTimeout(initial);
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);
  const sessions = (state?.sessions ?? []).filter(
    (s) => (!domain || s.domain === domain) && (!excludeWorkout || s.domain !== "workout"),
  );
  const active =
    sessions.find((s) => `${s.id}:${s.domain}` === selected) ?? sessions[0];
  async function save(body: LiveSubmission) {
    try {
      const result = transport
        ? await transport.save(body)
        : await decode(
            await fetch("/api/player/live-entry", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }),
          );
      await refresh();
      savedCallback.current?.();
      return result;
    } catch (e) {
      if (e instanceof LiveHttpError) await refresh();
      throw e;
    }
  }
  return (
    <section className="player-live-section" aria-label="Live training">
      {notice && !error && <p role="status">{notice}</p>}
      {error ? (
        <div role="alert">
          <p>{error}</p>
          <button className="secondary-button" onClick={() => void refresh()}>
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      ) : !state ? (
        <p role="status">Checking live sessions...</p>
      ) : (
        <>
          {!sessions.some((s) => s.domain !== "workout") &&
            domain !== "workout" && (
              <div className="player-live-waiting">
                <h2>Practice</h2>
                <p>Waiting on coach to begin Practice session.</p>
              </div>
            )}
          {!sessions.some((s) => s.domain === "workout") &&
            !excludeWorkout && (!domain || domain === "workout") && (
              <div className="player-live-waiting">
                <h2>Weight Room</h2>
                <p>Waiting on coach to begin Weight Room session.</p>
              </div>
            )}
          {active && (
            <>
              <div className="player-live-heading">
                <span className="player-live-badge">
                  <Radio size={16} />
                  Live Now
                </span>
                <span>{state.context.name}</span>
              </div>
              {sessions.length > 1 && (
                <label className="player-live-select">
                  Your Station
                  <select
                    aria-label="Your live station"
                    value={`${active.id}:${active.domain}`}
                    onChange={(e) => setSelected(e.target.value)}
                  >
                    {sessions.map((s) => (
                      <option
                        key={`${s.id}:${s.domain}`}
                        value={`${s.id}:${s.domain}`}
                      >
                        {s.title} - {s.station}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <h2>{active.title}</h2>
              <p className="muted">
                {active.station} · {state.context.teamName} ·{" "}
                {state.context.seasonName}
              </p>
              {state.capabilities[liveCapability(active.domain)] ? (
                <LiveEntryForm
                  key={`${membershipId}:${active.id}:${active.domain}:${active.exercise?.id ?? ""}`}
                  session={active}
                  membershipId={membershipId}
                  entries={state.entries.filter(
                    (e) =>
                      e.sessionId === active.id && e.domain === active.domain,
                  )}
                  save={save}
                />
              ) : (
                <p role="status">View Only. Live entry is not permitted.</p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

function LiveEntryForm({
  session,
  membershipId,
  entries,
  save,
}: {
  session: PlayerLiveSession;
  membershipId: string;
  entries: Entry[];
  save: (body: LiveSubmission) => Promise<{ id: string }>;
}) {
  const workout = session.domain === "workout",
    resultKey = workout
      ? "status"
      : session.domain === "hitting"
        ? "action"
        : "outcome";
  const [values, setValues] = useState<Record<string, unknown>>(
    workout
      ? {
          status: "Completed",
          weight: session.exercise?.weight,
          reps: session.exercise?.reps,
        }
      : {},
  );
  const [setNumber, setSetNumber] = useState(1),
    [editing, setEditing] = useState<Entry>(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [retry, setRetry] = useState(false);
  const pending = useRef<LiveSubmission | undefined>(undefined),
    saving = useRef(false);
  const stationEntries = entries.filter(
    (e) => !workout || e.payload.stationId === session.exercise?.id,
  );
  const occupied = new Set(
    stationEntries.map((e) => Number(e.payload.setNumber)),
  );
  const available = workout
    ? Array.from(
        { length: session.exercise?.sets ?? 1 },
        (_, i) => i + 1,
      ).filter((n) => !occupied.has(n))
    : [];
  const nextSet = editing
    ? Number(editing.payload.setNumber)
    : available.includes(setNumber)
      ? setNumber
      : available[0];
  const fields = workout
    ? workoutFields(session)
    : LIVE_FIELDS[session.domain].filter((f) => session.fields.includes(f.key));
  const latest = stationEntries
    .filter((e) => e.editable)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const setValue = (key: string, value: unknown) =>
    setValues((v) => ({ ...v, [key]: value }));
  async function submit(operation: LiveSubmission["operation"], entry?: Entry, draft = values) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setMessage("");
    try {
      if (!pending.current) {
        const selectedValues: Record<string, unknown> = {};
        if (operation !== "delete")
          for (const key of [resultKey, ...fields.map((f) => f.key)])
            if (draft[key] != null && draft[key] !== "")
              selectedValues[key] = draft[key];
        if (workout) {
          selectedValues.stationId = session.exercise!.id;
          selectedValues.setNumber = entry ? entry.payload.setNumber : nextSet;
        }
        pending.current = {
          membershipId,
          sessionId: session.id,
          domain: session.domain,
          operation,
          entryId: entry?.id,
          requestId: crypto.randomUUID(),
          payload: normalizeLivePayload(
            session.domain,
            selectedValues,
            operation === "delete",
          ),
        };
      }
      await save(pending.current);
      pending.current = undefined;
      setRetry(false);
      setEditing(undefined);
      setMessage(
        operation === "delete"
          ? "Last entry removed."
          : operation === "update"
            ? "Correction saved."
            : workout
              ? "Set saved."
              : "Rep saved. Ready for the next one.",
      );
      if (!workout)
        setValues((v) =>
          Object.fromEntries(
            Object.entries(v).filter(([k]) =>
              ["pitch_type", "velocity"].includes(k),
            ),
          ),
        );
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Unable to save. Retry this entry.",
      );
      if (e instanceof LiveHttpError || !pending.current) {
        pending.current = undefined;
        setRetry(false);
      } else setRetry(true);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="player-live-form">
      <fieldset disabled={busy || retry}>
        {workout && (
          <label>
            Set
            <select
              aria-label="Set number"
              disabled={!!editing}
              value={nextSet ?? ""}
              onChange={(e) => setSetNumber(Number(e.target.value))}
            >
              {(editing ? [Number(editing.payload.setNumber)] : available).map(
                (n) => (
                  <option key={n} value={n}>
                    Set {n} of {session.exercise?.sets}
                  </option>
                ),
              )}
              {!editing && !available.length && (
                <option value="">All sets recorded</option>
              )}
            </select>
          </label>
        )}
        {!workout && <PracticeResultChoices
          className={session.domain === "defense" ? "practice-defense-result-grid" : "practice-hitting-result-grid"}
          options={LIVE_RESULTS[session.domain].map(result => ({ value: result, label: result }))}
          value={String(values[resultKey] ?? "")}
          onChange={value => setValue(resultKey, value)}
        />}
        {workout && session.exercise && nextSet && <div className="weight-room-individual-set-row">
          <strong>Set {nextSet}</strong>
          <WeightRoomInlineSetCell
            key={`${nextSet}:${editing?.id ?? "new"}`}
            cell={{ playerId: "self", exercise: session.exercise.name, setNumber: nextSet }}
            entry={editing ? { ...editing.payload, id: editing.id, sessionId: session.id, playerId: "self", exercise: session.exercise.name, kind: "Lift", createdAt: editing.createdAt } as WorkoutEntry : undefined}
            station={{ id: session.exercise.id, name: session.exercise.name, category: "Other", kind: "Lift", active: true, displayOrder: 0, targetStyle: "Standard", performanceDirection: "HIGHER_IS_BETTER", targetSets: session.exercise.sets, targetReps: session.exercise.reps, measurementType: session.exercise.measurement, unit: session.exercise.unit } as ActiveWorkoutStation}
            disabled={busy || retry}
            explicitSave
            onSaveCell={(_cell, draft) => void submit(editing ? "update" : "create", editing, { ...draft, status: "Completed" })}
          />
        </div>}
        {!workout && <div className="player-live-fields">
          {fields.map((f) => (
            <LiveInput
              key={f.key}
              field={f}
              value={values[f.key]}
              onChange={(v) => setValue(f.key, v)}
            />
          ))}
        </div>}
      </fieldset>
      <div className="player-live-actions">
        {(!workout || retry) && <button
          className="primary-button"
          disabled={busy || (!retry && workout && !nextSet)}
          onClick={() => void submit(editing ? "update" : "create", editing)}
        >
          {retry ? <RefreshCw size={18} /> : <Save size={18} />}
          {busy
            ? "Saving..."
            : retry
              ? "Retry Entry"
              : editing
                ? "Save Correction"
                : workout
                  ? "Save Set"
                  : "Save Rep"}
        </button>}
        {editing && !retry && (
          <button
            className="ghost-button"
            disabled={busy}
            onClick={() => setEditing(undefined)}
          >
            Cancel
          </button>
        )}
        {!editing && latest && !retry && (
          <button
            className="icon-button"
            disabled={busy}
            title={workout ? "Undo last set" : "Undo last rep"}
            aria-label={workout ? "Undo last set" : "Undo last rep"}
            onClick={() => void submit("delete", latest)}
          >
            <Undo2 size={20} />
          </button>
        )}
      </div>
      {message && (
        <p role="status" className="player-live-message">
          {message}
        </p>
      )}
      {!!stationEntries.length && (
        <details className="player-live-recent">
          <summary>
            {stationEntries.length} {workout ? "set" : "rep"}
            {stationEntries.length === 1 ? "" : "s"} recorded
          </summary>
          {stationEntries.slice(0, 20).map((e) => (
            <div className="player-live-recent-row" key={e.id}>
              <Check size={16} />
              <span>
                {workout ? `Set ${e.payload.setNumber} · ` : ""}
                {String(e.payload[resultKey] ?? "Recorded")}
                {e.payload.weight != null
                  ? ` · ${e.payload.weight} ${session.exercise?.unit ?? "lb"}`
                  : ""}
                {e.payload.reps != null ? ` × ${e.payload.reps}` : ""}
              </span>
              {e.editable && (
                <button
                  className="icon-button"
                  disabled={busy || retry}
                  title="Correct your entry"
                  aria-label="Correct your entry"
                  onClick={() => {
                    setEditing(e);
                    setValues(e.payload);
                    setMessage("");
                  }}
                >
                  <Pencil size={16} />
                </button>
              )}
            </div>
          ))}
        </details>
      )}
    </div>
  );
}

function workoutFields(session: PlayerLiveSession): LiveField[] {
  const measurement = session.exercise?.measurement;
  const keys =
    measurement === "WEIGHT_REPS"
      ? ["weight", "reps"]
      : measurement === "WEIGHT_ONLY"
        ? ["weight"]
        : ["BODYWEIGHT_REPS", "REPS_ONLY", "COUNT"].includes(measurement ?? "")
          ? ["reps"]
          : measurement === "COMPLETION"
            ? []
            : measurement === "RPE_ONLY"
              ? ["rpe"]
              : ["value"];
  return LIVE_FIELDS.workout
    .filter((f) => keys.includes(f.key))
    .map((f) => ({
      ...f,
      label:
        f.key === "weight"
          ? `Load (${session.exercise?.unit ?? "lb"})`
          : f.key === "value"
            ? `Result (${session.exercise?.unit ?? "value"})`
            : f.label,
    }));
}
function LiveInput({
  field,
  value,
  onChange,
}: {
  field: LiveField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (field.key === "velocity" || field.key === "exit_velocity_mph") return <VelocityPickerField
    label={field.label} ariaLabel={field.label} value={value == null ? "" : String(value)} defaultValue={75}
    onChange={value => onChange(value === "" ? undefined : Number(value))} />;
  if (field.options) return <ChoiceSelect label={field.label} value={String(value ?? "")}
    options={[{ value: "", label: "Not tracked" }, ...field.options.map(value => ({ value, label: value }))]}
    onChange={onChange} />;
  if (field.kind === "point")
    return (
      <div className="player-live-point">
        <span>{field.label}</span>
        {field.key === "field_location" ? (
          <ClubhouseBaseballField
            activePoint={value as ZonePoint | undefined}
            onSelect={onChange}
            coordinateSpace="practice"
            ariaLabel={field.label}
          />
        ) : (
          <StrikeZone
            activePoint={value as ZonePoint | undefined}
            onSelect={onChange}
            compact
          />
        )}
      </div>
    );
  if (field.kind === "count") {
    const count = value as { balls: number; strikes: number } | undefined;
    return (
      <div className="player-live-count">
        <span>{field.label}</span>
        <div>
          {(["balls", "strikes"] as const).map((k) => (
            <label key={k}>
              {k === "balls" ? "Balls" : "Strikes"}
              <select
                aria-label={k === "balls" ? "Balls" : "Strikes"}
                value={count?.[k] ?? ""}
                onChange={(e) =>
                  onChange({
                    balls: count?.balls ?? 0,
                    strikes: count?.strikes ?? 0,
                    [k]: Number(e.target.value),
                  })
                }
              >
                <option value="">Not tracked</option>
                {Array.from({ length: k === "balls" ? 4 : 3 }, (_, i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </div>
    );
  }
  return (
    <label>
      {field.label}
      {
        <input
          aria-label={field.label}
          inputMode="decimal"
          type="number"
          min={field.min}
          max={field.max}
          step={field.key === "reps" ? 1 : "any"}
          value={value == null ? "" : String(value)}
          onChange={(e) =>
            onChange(e.target.value === "" ? undefined : Number(e.target.value))
          }
        />
      }
    </label>
  );
}

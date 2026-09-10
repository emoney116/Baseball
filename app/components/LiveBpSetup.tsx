"use client";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Users } from "lucide-react";
import type { Player } from "../types";
import {
  BP_POSITIONS,
  bpTracksCount,
  bpPositionTracked,
  toggleBpPosition,
  withBpPitcherAlignment,
  withBpRunners,
  validateBpSettings,
  validateBpState,
  type BpSettings,
  type BpState,
  type BpPosition,
} from "../lib/liveBp";
import { TENDEX_PITCH_TYPES } from "../lib/tendexGameAnalysis";
import { densePlayerIdentityLabel } from "../lib/densePlayerIdentity";
import { CLUBHOUSE_FIELD_POSITION_COORDINATES } from "../lib/baseballFieldLayout";
import { ChoiceSelect } from "./ChoiceSelect";
import { liveBpFieldLabel } from "../lib/liveBpFieldLabel";
import { ClubhouseBaseballField } from "./ClubhouseBaseballField";
import { BpBases, BpCount, BpSegments, type BpSheet } from "./LiveBpControls";
import styles from "./LiveBpConsole.module.css";

export function LiveBpSetup({
  settings,
  state,
  players,
  coaches,
  initialStep = 0,
  initialPosition,
  busy,
  error,
  onSave,
  onClose,
  sheet,
  onEnd,
}: {
  settings: BpSettings;
  state: BpState;
  players: Player[];
  coaches: string[];
  initialStep?: number;
  initialPosition?: BpPosition;
  busy: boolean;
  error: string;
  onSave: (s: BpSettings, state: BpState) => void;
  onClose: () => void;
  sheet: BpSheet;
  onEnd?: () => void;
}) {
  const [draft, setDraft] = useState({
    ...settings,
    countTracking: bpTracksCount(settings),
  });
  const [situation, setSituation] = useState(state);
  const [step, setStep] = useState(initialStep),
    [alignment, setAlignment] = useState(Boolean(initialPosition)),
    [position, setPosition] = useState<BpPosition>(initialPosition ?? "P"),
    [message, setMessage] = useState("");
  const positions =
    draft.defense === "SELECTED" ? draft.positions : BP_POSITIONS;
  function update<K extends keyof BpSettings>(key: K, value: BpSettings[K]) {
    setDraft((s) => ({
      ...withBpPitcherAlignment({ ...s, [key]: value }),
      countTracking: key === "countTracking" ? Boolean(value) : s.countTracking,
    }));
  }
  function save() {
    try {
      validateBpSettings(draft);
      validateBpState(situation);
      setMessage("");
      onSave(draft, situation);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Check setup.");
    }
  }
  function assign(id: string) {
    if (position === "P") return;
    const next = { ...draft.alignment };
    for (const p of BP_POSITIONS) if (next[p] === id) delete next[p];
    if (id) next[position] = id;
    else delete next[position];
    update("alignment", next);
  }
  const roster = players
    .filter((p) => !p.archived)
    .map((p) => ({ value: p.id, label: densePlayerIdentityLabel(p) }));
  return sheet(
    alignment ? "Defensive Alignment" : "Live BP Setup",
    () => {
      if (!busy) onClose();
    },
    <>
      <fieldset disabled={busy} className={styles.setup}>
        {alignment ? (
          <>
            <div className={styles.alignmentField}>
              <ClubhouseBaseballField
                coordinateSpace="game"
                showLabels={false}
                showEmptyState={false}
                ariaLabel="Defensive alignment"
              />
              {BP_POSITIONS.map((p) => {
                const [left, top] = CLUBHOUSE_FIELD_POSITION_COORDINATES[p];
                return (
                  <button
                    key={p}
                    type="button"
                    style={{ left: `${left}%`, top: `${top}%` }}
                    aria-label={`Assign ${p}`}
                    aria-pressed={position === p}
                    data-tracked={bpPositionTracked(draft, p)}
                    onClick={() => setPosition(p)}
                  >
                    <span title={liveBpFieldLabel(draft, players, p)}>
                      {liveBpFieldLabel(draft, players, p)}
                    </span>
                  </button>
                );
              })}
            </div>
            <section
              className={styles.assignmentRoster}
              aria-label={`Players at ${position}`}
            >
              <div className={styles.positionTracking}>
                <h3>{position}</h3>
                <label>
                  Track stats
                  <input
                    type="checkbox"
                    role="switch"
                    aria-label={`Track ${position} stats`}
                    checked={bpPositionTracked(draft, position)}
                    disabled={position === "P" && draft.source !== "PLAYER"}
                    onChange={() =>
                      setDraft((s) => ({
                        ...toggleBpPosition(s, position),
                        countTracking: s.countTracking,
                      }))
                    }
                  />
                </label>
              </div>
              {position === "P" ? (
                <p>
                  {draft.source === "PLAYER"
                    ? roster.find((p) => p.value === draft.pitcherId)?.label
                    : draft.source === "COACH"
                      ? draft.coachName
                      : "Machine"}
                </p>
              ) : (
                <div role="listbox" aria-label={`Player at ${position}`}>
                  {[
                    { value: "", label: "Unassigned" },
                    ...roster.filter(
                      (p) =>
                        draft.source !== "PLAYER" ||
                        p.value !== draft.pitcherId,
                    ),
                  ].map((player) => (
                    <button
                      key={player.value}
                      type="button"
                      role="option"
                      aria-selected={
                        (draft.alignment[position] ?? "") === player.value
                      }
                      onClick={() => assign(player.value)}
                    >
                      {player.label}
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          <>
            <nav className={styles.steps} aria-label="Setup steps">
              {["Matchup", "Tracking", "Situation"].map((label, i) => (
                <button
                  type="button"
                  key={label}
                  aria-current={step === i ? "step" : undefined}
                  onClick={() => setStep(i)}
                >
                  {i + 1}. {label}
                </button>
              ))}
            </nav>
            {step === 0 && (
              <>
                <BpSegments
                  label="Mode"
                  value={draft.mode}
                  options={[
                    { value: "FREE", label: "Free BP" },
                    { value: "AB", label: "Live AB" },
                    { value: "GAME", label: "Game-Like" },
                  ]}
                  onChange={(v) => {
                    setDraft((s) => ({
                      ...s,
                      mode: v as BpSettings["mode"],
                      countTracking: v !== "FREE",
                    }));
                    setSituation((s) => ({ ...s, balls: 0, strikes: 0 }));
                  }}
                />
                <BpSegments
                  label="Pitch source"
                  value={draft.source}
                  options={[
                    { value: "MACHINE", label: "Machine" },
                    { value: "COACH", label: "Coach" },
                    { value: "PLAYER", label: "Player" },
                  ]}
                  onChange={(v) => update("source", v as BpSettings["source"])}
                />
                {draft.source === "COACH" && (
                  <>
                    <ChoiceSelect
                      label="Coach"
                      value={
                        coaches.includes(draft.coachName ?? "")
                          ? draft.coachName!
                          : "custom"
                      }
                      options={[
                        ...coaches.map((name) => ({
                          value: name,
                          label: name,
                        })),
                        { value: "custom", label: "Other coach" },
                      ]}
                      onChange={(v) =>
                        update("coachName", v === "custom" ? undefined : v)
                      }
                    />
                    {!coaches.includes(draft.coachName ?? "") && (
                      <label>
                        Coach name
                        <input
                          maxLength={80}
                          value={draft.coachName ?? ""}
                          onChange={(e) =>
                            update("coachName", e.target.value || undefined)
                          }
                        />
                      </label>
                    )}
                  </>
                )}
                {draft.source === "PLAYER" && (
                  <ChoiceSelect
                    label="Player pitcher"
                    value={draft.pitcherId ?? ""}
                    options={roster.filter((p) => p.value !== draft.hitterId)}
                    onChange={(v) => update("pitcherId", v)}
                  />
                )}
              </>
            )}
            {step === 1 && (
              <>
                <BpSegments
                  label="Pitch type tracking"
                  inline
                  value={draft.pitchMode}
                  options={[
                    { value: "OFF", label: "Off" },
                    { value: "ONE", label: "Single" },
                    { value: "MULTI", label: "Multi" },
                  ]}
                  onChange={(v) =>
                    setDraft((s) => ({
                      ...s,
                      pitchMode: v as BpSettings["pitchMode"],
                      pitchType: s.pitchType ?? "4-Seam",
                    }))
                  }
                />
                {draft.pitchMode !== "OFF" && (
                  <ChoiceSelect
                    label="Default pitch"
                    disabled={draft.pitchMode !== "ONE"}
                    value={draft.pitchType ?? "4-Seam"}
                    options={TENDEX_PITCH_TYPES.map((value) => ({
                      value,
                      label: value,
                    }))}
                    onChange={(v) =>
                      update("pitchType", v as BpSettings["pitchType"])
                    }
                  />
                )}
                <div className={styles.switches}>
                  {(
                    [
                      ["velocity", "Velocity"],
                      ["location", "Pitch location"],
                      ["ev", "Exit velocity"],
                      ["spray", "Spray chart"],
                      ["countTracking", "Count tracking"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key}>
                      <span>{label}</span>
                      <input
                        type="checkbox"
                        role="switch"
                        checked={Boolean(draft[key])}
                        onChange={(e) => {
                          update(key, e.target.checked);
                          if (key === "countTracking")
                            setSituation((s) => ({
                              ...s,
                              balls: 0,
                              strikes: 0,
                            }));
                        }}
                      />
                    </label>
                  ))}
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <BpSegments
                  label="Defense tracking"
                  value={draft.defense}
                  options={[
                    { value: "OFF", label: "Off" },
                    { value: "ALL", label: "All" },
                    { value: "SELECTED", label: "Selected" },
                  ]}
                  onChange={(v) =>
                    update("defense", v as BpSettings["defense"])
                  }
                />
                {draft.defense === "SELECTED" && (
                  <div
                    className={styles.positions}
                    role="group"
                    aria-label="Tracked positions"
                  >
                    {BP_POSITIONS.map((p) => (
                      <button
                        type="button"
                        key={p}
                        aria-pressed={draft.positions.includes(p)}
                        onClick={() =>
                          update(
                            "positions",
                            draft.positions.includes(p)
                              ? draft.positions.filter((v) => v !== p)
                              : [...draft.positions, p],
                          )
                        }
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
                {draft.defense !== "OFF" && (
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={!positions.length}
                    onClick={() => {
                      setPosition(positions[0]);
                      setAlignment(true);
                    }}
                  >
                    <Users size={18} />
                    Edit Defensive Alignment
                  </button>
                )}
                {draft.countTracking && (
                  <BpCount
                    balls={situation.balls}
                    strikes={situation.strikes}
                    onChange={(balls, strikes) =>
                      setSituation((s) => ({ ...s, balls, strikes }))
                    }
                  />
                )}
                {draft.mode === "GAME" && (
                  <>
                    <BpSegments
                      label="Outs"
                      value={String(situation.outs)}
                      options={[0, 1, 2].map((n) => ({
                        value: String(n),
                        label: String(n),
                      }))}
                      onChange={(v) =>
                        setSituation((s) => ({ ...s, outs: Number(v) }))
                      }
                    />
                    <BpBases
                      runners={situation.runners}
                      onChange={(runners) =>
                        setSituation((s) => withBpRunners(s, runners))
                      }
                    />
                    <BpSegments
                      label="Situational job"
                      value={situation.job}
                      options={[
                        "",
                        "Move Runner",
                        "Score Runner",
                        "Productive Out",
                        "Drive Runner In",
                        "Get On Base",
                      ].map((v) => ({ value: v, label: v || "None" }))}
                      onChange={(job) => setSituation((s) => ({ ...s, job }))}
                    />
                    <label>
                      Custom job
                      <input
                        maxLength={80}
                        value={situation.job}
                        onChange={(e) =>
                          setSituation((s) => ({ ...s, job: e.target.value }))
                        }
                      />
                    </label>
                  </>
                )}
              </>
            )}
          </>
        )}
        {(message || error) && <p role="alert">{message || error}</p>}
        {onEnd && !alignment && (
          <button className="text-button" onClick={onEnd}>
            End Live BP
          </button>
        )}
      </fieldset>
      <div className="modal-actions">
        {alignment ? (
          <button
            className="primary-button"
            disabled={busy}
            onClick={() => (initialPosition ? save() : setAlignment(false))}
          >
            <Check size={18} />
            Done
          </button>
        ) : (
          <>
            {step > 0 && (
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => setStep((s) => s - 1)}
              >
                <ArrowLeft size={18} />
                Back
              </button>
            )}
            {step < 2 && (
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => setStep((s) => s + 1)}
              >
                Next
                <ArrowRight size={18} />
              </button>
            )}
            <button className="primary-button" disabled={busy} onClick={save}>
              <Check size={18} />
              {busy ? "Saving..." : "Save Setup"}
            </button>
          </>
        )}
      </div>
    </>,
  );
}

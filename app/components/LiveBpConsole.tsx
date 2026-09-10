"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BarChart3,
  Settings,
  ArrowRight,
  Plus,
  Undo2,
  LayoutList,
} from "lucide-react";
import type { Player, ZonePoint } from "../types";
import {
  BP_POSITIONS,
  bpBatterResults,
  buildBpPitch,
  initialBpSettings,
  initialBpState,
  bpTracksCount,
  bpPositionTracked,
  withBpPitcherAlignment,
  type BpState,
  type BpDraft,
  type BpRound,
  type BpSettings,
} from "../lib/liveBp";
import { LiveBpPitchDetails } from "./LiveBpPitchDetails";
import { LiveBpPlayResolution } from "./LiveBpPlayResolution";
import { VelocityPickerField } from "./TeamTrainingViews";
import { ChoiceSelect } from "./ChoiceSelect";
import { ClubhouseBaseballField } from "./ClubhouseBaseballField";
import { DensePlayerIdentity } from "./DensePlayerIdentity";
import { densePlayerIdentityLabel } from "../lib/densePlayerIdentity";
import { CLUBHOUSE_FIELD_POSITION_COORDINATES } from "../lib/baseballFieldLayout";
import { LiveBpSetup } from "./LiveBpSetup";
import { LiveBpDefensePresets } from "./LiveBpDefensePresets";
import { AskClubhouseLauncher } from "./AskClubhouseDrawer";
import { liveBpFieldLabel } from "../lib/liveBpFieldLabel";
import { BpSegments, type BpSheet } from "./LiveBpControls";
import { LiveBpCorrections } from "./LiveBpCorrections";
import { LiveBpFieldRunners } from "./LiveBpFieldRunners";
import type { BpRunnerMove } from "../lib/liveBpRunnerMove";
import styles from "./LiveBpConsole.module.css";

export function LiveBpConsole({
  practiceId,
  players,
  active,
  onExit,
  onSaved,
  pitchLocationControl,
  initialHitterId,
  initialPitcherId,
  initialSource,
  coaches = [],
  charts,
  sheet,
  createPlayer,
  onAsk,
}: {
  practiceId: string;
  onAsk: (playerId: string, side: "hitting" | "pitching") => void;
  players: Player[];
  active: boolean;
  onExit: () => void;
  onSaved: () => void;
  initialHitterId?: string;
  initialPitcherId?: string;
  initialSource?: BpSettings["source"];
  coaches?: string[];
  charts: (
    playerId: string,
    side?: "hitting" | "pitching",
    view?: "spray" | "location",
  ) => ReactNode;
  sheet: BpSheet;
  createPlayer: (
    onCreated: (player: Player) => void,
    onClose: () => void,
  ) => ReactNode;
  pitchLocationControl: (
    point: ZonePoint | undefined,
    onSelect: (point: ZonePoint) => void,
    hitterId: string,
  ) => ReactNode;
}) {
  const [round, setRound] = useState<BpRound | null>(null),
    [settings, setSettings] = useState<BpSettings>(() => {
      const hitterId =
        players.find((p) => p.id === initialHitterId)?.id ??
        players[0]?.id ??
        "";
      const pitcherId =
        players.find((p) => p.id === initialPitcherId && p.id !== hitterId)
          ?.id ??
        players.find((p) => p.id !== hitterId && p.isPitcher)?.id ??
        players.find((p) => p.id !== hitterId)?.id;
      return withBpPitcherAlignment({
        ...initialBpSettings(hitterId),
        source: initialSource ?? "MACHINE",
        pitcherId,
      });
    });
  const [state, setState] = useState(initialBpState),
    [draft, setDraft] = useState<BpDraft>({ outcome: "" });
  const [loading, setLoading] = useState(true),
    [presetsOpen, setPresetsOpen] = useState(false),
    [optionsOpen, setOptionsOpen] = useState(false),
    [chartsOpen, setChartsOpen] = useState(false),
    [chartSide, setChartSide] = useState<"hitting" | "pitching">("hitting"),
    [chartPlayer, setChartPlayer] = useState(""),
    [stage, setStage] = useState<"pitch" | "details" | "result" | "bip">(
      "pitch",
    ),
    [quickView, setQuickView] = useState<"defense" | "spray" | "location">(
      "defense",
    ),
    [fieldView, setFieldView] = useState("runners"),
    [alignmentPosition, setAlignmentPosition] = useState<BpDraft["position"]>(),
    [participantPicker, setParticipantPicker] = useState<
      "hitter" | "pitcher" | null
    >(null),
    [creatingParticipant, setCreatingParticipant] = useState(false),
    [participantType, setParticipantType] = useState("Player"),
    [coachDraft, setCoachDraft] = useState(""),
    [playerEditor, setPlayerEditor] = useState(false),
    [contactFinished, setContactFinished] = useState(false),
    [setupStep, setSetupStep] = useState(0),
    [lastPitch, setLastPitch] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [uncertain, setUncertain] = useState(false);
  const lock = useRef(false),
    fields = useRef<HTMLFieldSetElement>(null),
    pending = useRef<{ id: string; draft: BpDraft } | null>(null),
    startId = useRef<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fieldSettings = useRef<HTMLDetailsElement>(null);
  const fieldRequest = useRef<{
    operation: "undo" | "runner";
    id: string;
    version: number;
    move?: BpRunnerMove;
  } | null>(null);
  const [fieldRetry, setFieldRetry] = useState(false);
  const onSavedRef = useRef(onSaved);
  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);
  useEffect(
    () => () => {
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
        onSavedRef.current();
      }
    },
    [],
  );
  const url = `/api/live-bp?practiceId=${encodeURIComponent(practiceId)}`;
  function adopt(r: BpRound) {
    setRound(r);
    setSettings(withBpPitcherAlignment(r.settings));
    setState(r.state);
  }
  async function reload() {
    try {
      const res = await fetch(url, { cache: "no-store" });
      const p = await res.json();
      if (!res.ok) throw new Error(p.message);
      const r = p.rounds.find((r: BpRound) => !r.ended_at);
      if (r) {
        if (
          round &&
          (r.settings.hitterId !== round.settings.hitterId ||
            r.settings.pitcherId !== round.settings.pitcherId ||
            r.settings.source !== round.settings.source)
        ) {
          setDraft({ outcome: "" });
          setNotice("Hitter or pitch source changed. Start a new pitch.");
        }
        adopt(r);
      }
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load Live BP.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message);
        if (controller.signal.aborted) return;
        const saved = payload.rounds.find((r: BpRound) => !r.ended_at);
        if (saved) {
          adopt(saved);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error ? error.message : "Unable to load Live BP.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [url]);
  const roster = players.map((p) => ({
    value: p.id,
    label: densePlayerIdentityLabel(p),
  }));
  const hitters = players.filter(
    (p) => settings.source !== "PLAYER" || p.id !== settings.pitcherId,
  );
  function update<K extends keyof BpSettings>(key: K, value: BpSettings[K]) {
    if (uncertain || busy) return;
    if (["hitterId", "pitcherId", "source", "coachName"].includes(key))
      setDraft({ outcome: "" });
    setSettings((s) => withBpPitcherAlignment({ ...s, [key]: value }));
  }
  function edit<K extends keyof BpDraft>(key: K, value: BpDraft[K]) {
    if (!uncertain && !busy) setDraft((d) => ({ ...d, [key]: value }));
  }
  async function write(
    operation: "start" | "configure" | "pitch" | "end",
    nextSettings = settings,
    nextState = state,
  ) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (operation === "pitch" && !pending.current) {
        buildBpPitch(settings, state, draft);
        pending.current = { id: crypto.randomUUID(), draft: { ...draft } };
      }
      startId.current ??= crypto.randomUUID();
      let savedRound = round;
      if (
        operation === "pitch" &&
        (!savedRound ||
          JSON.stringify(savedRound.settings) !== JSON.stringify(settings) ||
          JSON.stringify(savedRound.state) !== JSON.stringify(state))
      ) {
        const setup = await fetch(url, {
          method: "POST",
          signal: AbortSignal.timeout(15000),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operation: savedRound ? "configure" : "start",
            roundId: savedRound?.id ?? startId.current,
            version: savedRound?.version ?? 0,
            settings,
            state,
          }),
        });
        const result = await setup.json();
        if (!setup.ok) {
          if (setup.status < 500) pending.current = null;
          if (result.ended && round)
            setRound({ ...round, ended_at: new Date().toISOString() });
          throw new Error(result.message ?? "Unable to save settings.");
        }
        savedRound = result.round;
        setRound(savedRound);
      }
      const res = await fetch(url, {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation,
          roundId: savedRound?.id ?? startId.current,
          version: savedRound?.version ?? 0,
          settings: nextSettings,
          state: nextState,
          requestId: pending.current?.id,
          draft: pending.current?.draft,
        }),
      });
      const p = await res.json();
      if (!res.ok) {
        if (res.status < 500) pending.current = null;
        if (p.ended && round)
          setRound({ ...round, ended_at: new Date().toISOString() });
        throw new Error(p.message ?? "Save failed.");
      }
      adopt(p.round);
      if (operation === "pitch") {
        const savedDraft = pending.current?.draft ?? draft;
        const pitchType = savedDraft.pitchType;
        pending.current = null;
        setDraft({ outcome: "", pitchType });
        requestAnimationFrame(() =>
          fields.current?.scrollIntoView({ block: "start" }),
        );
        setNotice("Pitch saved");
        setStage("pitch");
        setLastPitch(
          [
            settings.pitchMode !== "OFF"
              ? settings.pitchMode === "ONE"
                ? settings.pitchType
                : (savedDraft.pitchType ?? settings.pitchType)
              : "",
            settings.velocity && savedDraft.velocity
              ? `${savedDraft.velocity} mph`
              : "",
            savedDraft.outcome,
          ]
            .filter(Boolean)
            .join(" · "),
        );
      }
      if (operation === "end") {
        setNotice("Live BP ended");
      }
      if (operation === "start" || operation === "configure")
        setOptionsOpen(false);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      if (operation === "end") {
        refreshTimer.current = null;
        onSaved();
      } else
        refreshTimer.current = setTimeout(() => {
          refreshTimer.current = null;
          onSavedRef.current();
        }, 10000);
      return true;
    } catch (e) {
      setError(
        e instanceof Error &&
          !["TimeoutError", "AbortError", "TypeError"].includes(e.name)
          ? e.message
          : pending.current
            ? "Connection interrupted. Your pitch is retained. Retry to confirm the save."
            : "Connection interrupted. Please try again.",
      );
    } finally {
      lock.current = false;
      setUncertain(Boolean(pending.current));
      setBusy(false);
    }
  }
  async function fieldAction(
    operation: "undo" | "runner",
    move?: BpRunnerMove,
  ) {
    if (!round || lock.current || uncertain) return;
    if (!fieldRequest.current)
      fieldRequest.current = {
        operation,
        id: crypto.randomUUID(),
        version: round.version,
        move,
      };
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const request = fieldRequest.current;
      const res = await fetch(url, {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: request.operation,
          roundId: round.id,
          requestId: request.id,
          version: request.version,
          move: request.move,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        if (res.status < 500) fieldRequest.current = null;
        throw new Error(result.message ?? "Unable to update the field.");
      }
      adopt(result.round);
      fieldRequest.current = null;
      setDraft({ outcome: "" });
      setLastPitch("");
      setNotice(
        operation === "undo"
          ? "Last pitch and linked stats removed"
          : "Runner movement saved",
      );
      onSaved();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Connection interrupted. Retry to confirm the field update.",
      );
    } finally {
      setFieldRetry(Boolean(fieldRequest.current));
      setBusy(false);
      lock.current = false;
    }
  }
  async function undoPitch() {
    if (
      window.confirm(
        "Undo the last pitch and delete its linked stats? Count, outs, and runners will return to before that pitch, including any later runner moves or corrections. The current matchup stays selected.",
      )
    )
      await fieldAction("undo");
  }
  const bip = stage === "bip";
  const ended = !active || Boolean(round?.ended_at);
  const trackedCount = bpTracksCount(settings);
  const pitcher = players.find((p) => p.id === settings.pitcherId);
  const nonBipPaEnd =
    draft.outcome === "HBP" ||
    (trackedCount &&
      ((draft.outcome === "Ball" && state.balls === 3) ||
        (["Called Strike", "Whiff"].includes(draft.outcome) &&
          state.strikes === 2)));
  function setup(step = 0) {
    if (uncertain || busy) return;
    setAlignmentPosition(undefined);
    setSetupStep(step);
    setOptionsOpen(true);
  }
  function saveSetup(next: BpSettings, nextState: BpState) {
    next = withBpPitcherAlignment(next);
    const changed =
      next.source !== settings.source ||
      next.pitcherId !== settings.pitcherId ||
      next.coachName !== settings.coachName;
    if (
      changed &&
      (draft.outcome || draft.velocity || draft.location) &&
      !window.confirm("Discard this pitch and change the pitch source?")
    )
      return;
    if (changed) {
      setDraft({ outcome: "" });
      setStage("pitch");
    }
    void write(round ? "configure" : "start", next, nextState);
  }
  function chooseResult(outcome: string) {
    if (busy || uncertain) return;
    setContactFinished(false);
    setPlayResolution(false);
    setError("");
    const nextDraft: BpDraft =
      outcome !== draft.outcome
        ? {
            outcome,
            pitchType: draft.pitchType,
            velocity: draft.velocity,
            location: draft.location,
          }
        : draft;
    setDraft(nextDraft);
    if (outcome === "Ball in play") {
      setContactFinished(!settings.ev && !settings.spray);
      setStage("bip");
    } else setStage("result");
  }
  function changeHitter(id: string) {
    if (id === settings.hitterId) return;
    if (
      (draft.outcome || draft.velocity || draft.location) &&
      !window.confirm("Discard this pitch and change hitter?")
    )
      return;
    update("hitterId", id);
    setStage("pitch");
  }
  const [playResolution, setPlayResolution] = useState(false);
  const needsPlayResolution =
    settings.mode === "GAME" || settings.defense !== "OFF";
  const needsPitchDetails =
    settings.velocity || settings.location || settings.pitchMode === "MULTI";
  const wizardStep =
    stage === "details"
      ? 0
      : stage === "result"
        ? 1
        : !contactFinished
          ? 2
          : playResolution
            ? 4
            : 3;
  function goToWizardStep(step: number) {
    if (busy || uncertain) return;
    setError("");
    if (step < 2) setStage(step === 0 ? "details" : "result");
    else {
      setStage("bip");
      setContactFinished(step >= 3);
      setPlayResolution(step === 4);
    }
  }
  function flow(content: ReactNode) {
    const steps = [
      ...(needsPitchDetails ? [{ id: 0, label: "Pitch" }] : []),
      { id: 1, label: "Outcome" },
      ...(draft.outcome === "Ball in play"
        ? [
            ...(settings.ev || settings.spray
              ? [{ id: 2, label: "Contact" }]
              : []),
            { id: 3, label: "Result" },
            ...(needsPlayResolution ? [{ id: 4, label: "Field" }] : []),
          ]
        : []),
    ];
    const next =
      stage === "details" ||
      (stage === "result" && draft.outcome === "Ball in play") ||
      (bip && (!contactFinished || (!playResolution && needsPlayResolution)));
    const canFinish = Boolean(
      draft.outcome &&
      (draft.outcome !== "Ball in play" ||
        (bip && (settings.mode !== "GAME" || draft.result))),
    );
    const stepIndex = steps.findIndex((step) => step.id === wizardStep);
    return sheet(
      "Log Pitch",
      () => {
        if (!busy) setStage("pitch");
      },
      <>
        <div className={styles.wizardMatchup}>
          <div>
            <span>Hitter</span>
            <strong>
              {players.find((p) => p.id === settings.hitterId)?.name ??
                "Hitter"}
            </strong>
          </div>
          <div>
            <span>{settings.source === "PLAYER" ? "Pitcher" : "Source"}</span>
            <strong>
              {settings.source === "PLAYER"
                ? players.find((p) => p.id === settings.pitcherId)?.name
                : settings.source === "COACH"
                  ? settings.coachName || "Coach"
                  : "Machine"}
            </strong>
          </div>
          <div>
            <span>Count / Outs</span>
            <strong>
              {trackedCount ? `${state.balls}-${state.strikes}` : "--"} /{" "}
              {state.outs}
            </strong>
          </div>
        </div>
        <div
          className="practice-hitting-sheet__flow"
          aria-label="Pitch log steps"
        >
          {steps.map(({ label, id }) => (
            <button
              key={label}
              type="button"
              aria-current={wizardStep === id ? "step" : undefined}
              disabled={
                busy ||
                uncertain ||
                (id === 4 && settings.mode === "GAME" && !draft.result)
              }
              onClick={() => goToWizardStep(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <fieldset disabled={busy || uncertain} className={styles.fields}>
          {content}
        </fieldset>
        <div className="modal-actions">
          {error && <p role="alert">{error}</p>}
          {(next || canFinish) && (
            <button
              type="button"
              className="primary-button"
              disabled={
                busy ||
                (!uncertain &&
                  bip &&
                  contactFinished &&
                  settings.mode === "GAME" &&
                  !draft.result)
              }
              onClick={
                uncertain
                  ? submitPitch
                  : next
                    ? () => goToWizardStep(steps[stepIndex + 1].id)
                    : submitPitch
              }
            >
              {busy
                ? "Saving..."
                : uncertain
                  ? "Retry Pitch"
                  : next
                    ? "Next"
                    : bip
                      ? "Save Ball in Play"
                      : "Save Pitch"}
              <ArrowRight size={18} />
            </button>
          )}
        </div>
      </>,
      {
        panelClassName: "live-bp-wizard",
        onBack:
          stepIndex > 0
            ? () => goToWizardStep(steps[stepIndex - 1].id)
            : undefined,
      },
    );
  }
  function submitPitch() {
    void write("pitch");
  }
  const job =
    settings.mode === "GAME" && state.job ? (
      <details className={styles.optional}>
        <summary>Job result (optional)</summary>
        <BpSegments
          label="Job result"
          value={draft.jobSuccess === undefined ? "" : String(draft.jobSuccess)}
          options={[
            { value: "", label: "Not recorded" },
            { value: "true", label: "Done" },
            { value: "false", label: "Not Done" },
          ]}
          onChange={(v) =>
            edit("jobSuccess", v === "" ? undefined : v === "true")
          }
        />
      </details>
    ) : null;
  const status = [
    settings.mode === "FREE"
      ? "FREE BP"
      : settings.mode === "AB"
        ? "LIVE AB"
        : "GAME-LIKE",
    settings.pitchMode !== "OFF"
      ? settings.pitchMode === "ONE"
        ? settings.pitchType
        : "MULTI"
      : "",
    settings.location && "LOC",
    settings.velocity && "VELO",
    settings.ev && "EV",
    settings.spray && "SPRAY",
    trackedCount && "COUNT",
    settings.defense !== "OFF" && "DEF",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className={styles.console} aria-label="Live BP console">
      {loading ? (
        <p role="status">Loading Live BP...</p>
      ) : ended ? (
        <div className={styles.complete}>
          <h2>Live BP Complete</h2>
          <p>Practice or Live BP has ended.</p>
          <button className="secondary-button" onClick={onExit}>
            Practice Home
          </button>
          <button
            className="secondary-button"
            onClick={() => {
              onSaved();
              setChartsOpen(true);
            }}
          >
            View Analytics
          </button>
          {chartsOpen && charts(settings.hitterId)}
        </div>
      ) : (
        <>
          <fieldset
            disabled={busy || fieldRetry}
            className={styles.fields}
            ref={fields}
          >
            <div className={styles.matchup}>
              <div className={styles.athlete}>
                <span>Hitter</span>
                <div className={styles.rotation}>
                  <button
                    type="button"
                    className={styles.participantName}
                    aria-label="Hitter"
                    title={
                      players.find((p) => p.id === settings.hitterId)?.name
                    }
                    onClick={() => {
                      if (!uncertain) {
                        setCreatingParticipant(false);
                        setParticipantPicker("hitter");
                      }
                    }}
                  >
                    {densePlayerIdentityLabel(
                      players.find((p) => p.id === settings.hitterId) ??
                        players[0],
                    )}
                  </button>
                </div>
              </div>
              <span className={styles.vs}>VS</span>
              <div className={styles.athlete}>
                <span>Pitcher</span>
                <button
                  type="button"
                  className={styles.sourceButton}
                  aria-label="Change pitch source"
                  onClick={() => {
                    if (!uncertain) {
                      setCreatingParticipant(false);
                      setParticipantPicker("pitcher");
                    }
                  }}
                >
                  {settings.source === "PLAYER" && pitcher ? (
                    <DensePlayerIdentity
                      player={{ ...pitcher, identityLabel: undefined }}
                    />
                  ) : (
                    <strong>
                      {settings.source === "MACHINE"
                        ? "Machine"
                        : (settings.coachName ?? "Coach BP")}
                    </strong>
                  )}
                </button>
              </div>
            </div>
            <div className={styles.statusRow}>
              <div className={styles.scoreboard}>
                {trackedCount && (
                  <div
                    className={styles.numericCount}
                    aria-label={`Count ${state.balls}-${state.strikes}`}
                  >
                    <span>Count</span>
                    <strong>
                      {state.balls}-{state.strikes}
                    </strong>
                  </div>
                )}
                {settings.mode === "GAME" && (
                  <div
                    className={styles.outsControl}
                    aria-label={`${state.outs} Outs`}
                  >
                    <span>Outs</span>
                    <strong>{state.outs}</strong>
                  </div>
                )}
              </div>
              <div className={styles.toolbarCorrections}>
                <button
                  type="button"
                  className={styles.status}
                  aria-label="Undo last pitch"
                  title="Undo last pitch"
                  disabled={busy || uncertain || !round}
                  onClick={() => void undoPitch()}
                >
                  <Undo2 size={18} />
                </button>
                <LiveBpCorrections
                  players={players}
                  state={state}
                  trackedCount={trackedCount}
                  game={settings.mode === "GAME"}
                  disabled={busy || uncertain}
                  onUndo={() => void undoPitch()}
                  onSave={(next) => saveSetup(settings, next)}
                  sheet={sheet}
                />
              </div>
              <button
                type="button"
                className={styles.status}
                aria-label="Live BP Setup"
                title={status}
                onClick={() => setup(1)}
              >
                <Settings size={18} />
              </button>
              <button
                type="button"
                className="practice-hitting-nav-button practice-hitting-nav-button--stats"
                aria-label="Show Live BP charts"
                aria-expanded={chartsOpen}
                onClick={() => {
                  onSaved();
                  setChartPlayer(settings.hitterId);
                  setChartSide("hitting");
                  setChartsOpen((v) => !v);
                }}
              >
                <BarChart3 size={18} />
              </button>
            </div>
            {bip ? (
              flow(
                playResolution ? (
                  <LiveBpPlayResolution
                    settings={settings}
                    state={state}
                    draft={draft}
                    players={players}
                    onChange={setDraft}
                  />
                ) : (
                  <>
                    <div className={styles.bipLayout}>
                      <div className={styles.bipDetails}>
                        {!contactFinished && settings.ev && (
                          <VelocityPickerField
                            label="EV"
                            value={draft.ev?.toString() ?? ""}
                            onChange={(v) =>
                              edit("ev", v ? Number(v) : undefined)
                            }
                            defaultValue={80}
                            ariaLabel="Exit velocity in miles per hour"
                          />
                        )}
                        {contactFinished && (
                          <>
                            <BpSegments
                              label="Batted ball"
                              className={styles.contactGrid}
                              value={draft.battedBall ?? ""}
                              options={[
                                "Ground ball",
                                "Hard ground ball",
                                "Line drive",
                                "Fly ball",
                                "Bunt",
                                "Pop up",
                              ].map((v) => ({ value: v, label: v }))}
                              onChange={(v) => {
                                if (v !== draft.battedBall)
                                  setDraft({
                                    ...draft,
                                    battedBall: v,
                                    result: undefined,
                                    runnerOutcomes: undefined,
                                    runnerReasons: undefined,
                                  });
                              }}
                            />
                            {draft.battedBall && (
                              <BpSegments
                                className={styles.batterResultGrid}
                                label={
                                  settings.mode === "GAME"
                                    ? "Batter result"
                                    : "Batter result (optional)"
                                }
                                value={draft.result ?? ""}
                                options={bpBatterResults(
                                  draft.battedBall,
                                  settings,
                                  state,
                                )}
                                onChange={(v) => {
                                  if (v !== draft.result)
                                    setDraft({
                                      ...draft,
                                      result: v,
                                      runnerOutcomes: undefined,
                                      runnerReasons: undefined,
                                    });
                                }}
                              />
                            )}
                            <details className={styles.optional}>
                              <summary>Contact quality (optional)</summary>
                              <BpSegments
                                label="Contact quality"
                                value={draft.contactQuality ?? ""}
                                options={[
                                  "Not recorded",
                                  "Poor",
                                  "Weak",
                                  "Solid",
                                  "Hard",
                                  "Barrel",
                                ].map((v) => ({ value: v, label: v }))}
                                onChange={(v) =>
                                  edit(
                                    "contactQuality",
                                    v === "Not recorded" ? undefined : v,
                                  )
                                }
                              />
                            </details>
                          </>
                        )}
                      </div>
                      {!contactFinished && settings.spray && (
                        <section className={styles.spray}>
                          <h3>Spray Location</h3>
                          <ClubhouseBaseballField
                            activePoint={draft.spray}
                            onSelect={(p) => edit("spray", p)}
                            ariaLabel="Live BP spray location"
                          />
                          <button
                            className="text-button"
                            onClick={() => edit("spray", undefined)}
                          >
                            Clear spray
                          </button>
                        </section>
                      )}
                    </div>
                    {contactFinished && job}
                  </>
                ),
              )
            ) : (
              <>
                {stage === "result" &&
                  flow(
                    <section className={styles.result}>
                      <h3>Result</h3>
                      <div className={styles.outcomes}>
                        {[
                          ["Ball", "Ball"],
                          ["Called Strike", "Called Strike"],
                          ["Whiff", "Whiff"],
                          ["Foul", "Foul"],
                          ["Ball in play", "In Play"],
                          ["HBP", "HBP"],
                        ].map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            aria-pressed={draft.outcome === value}
                            className={
                              draft.outcome === value
                                ? "primary-button"
                                : "secondary-button"
                            }
                            onClick={() => chooseResult(value)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {nonBipPaEnd && job}
                    </section>,
                  )}
                <button
                  type="button"
                  className="primary-button"
                  onClick={() =>
                    setStage(
                      uncertain
                        ? "result"
                        : needsPitchDetails
                          ? "details"
                          : "result",
                    )
                  }
                >
                  <Plus size={20} />
                  {uncertain ? "Retry Pitch" : "Log Pitch"}
                </button>
                <div
                  className="practice-hitting-inline-pitch"
                  aria-label="Live BP quick charts"
                >
                  {["defense", "spray", "location"].map((view) => (
                    <button
                      key={view}
                      type="button"
                      className={quickView === view ? "active" : ""}
                      onClick={() => setQuickView(view as typeof quickView)}
                    >
                      {view === "defense"
                        ? "Field"
                        : view === "spray"
                          ? "Spray"
                          : "Pitch Map"}
                    </button>
                  ))}
                </div>
                {quickView === "defense" ? (
                  <div className={styles.fieldPanel}>
                    <div className={styles.fieldToolbar}>
                      {settings.mode === "GAME" && (
                        <div className={styles.fieldViewToggle}>
                          <BpSegments
                            label="Field view"
                            value={fieldView}
                            options={[
                              { value: "runners", label: "Runners" },
                              { value: "defense", label: "Defense" },
                            ]}
                            onChange={setFieldView}
                          />
                        </div>
                      )}
                      {
                        <details
                          ref={fieldSettings}
                          className={styles.fieldTracking}
                          onPointerEnter={(event) => {
                            if (event.pointerType === "mouse")
                              event.currentTarget.open = true;
                          }}
                          onPointerLeave={(event) => {
                            if (
                              event.pointerType === "mouse" &&
                              !event.currentTarget.contains(
                                document.activeElement,
                              )
                            )
                              event.currentTarget.open = false;
                          }}
                        >
                          <summary
                            aria-label="Defense tracking settings"
                            title="Defense tracking"
                          >
                            <Settings size={16} />
                          </summary>
                          <BpSegments
                            label="Defense tracking"
                            value={settings.defense}
                            options={[
                              { value: "OFF", label: "Off" },
                              { value: "ALL", label: "All" },
                              { value: "SELECTED", label: "Selected" },
                            ]}
                            onChange={(value) => {
                              if (!busy && !uncertain)
                                saveSetup(
                                  {
                                    ...settings,
                                    defense: value as BpSettings["defense"],
                                  },
                                  state,
                                );
                            }}
                          />
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => {
                              if (!busy && !uncertain) setPresetsOpen(true);
                            }}
                          >
                            <LayoutList size={16} />
                            Defense Presets
                          </button>
                        </details>
                      }
                    </div>
                    <div className={styles.alignmentField}>
                      <ClubhouseBaseballField
                        coordinateSpace="game"
                        showLabels={false}
                        showEmptyState={false}
                        ariaLabel={
                          settings.mode === "GAME" && fieldView === "runners"
                            ? "Practice runners"
                            : "Defensive alignment"
                        }
                      />
                      {settings.mode === "GAME" && fieldView === "runners" && (
                        <LiveBpFieldRunners
                          state={state}
                          players={players}
                          sheet={sheet}
                          disabled={busy || uncertain}
                          onMove={(move) => void fieldAction("runner", move)}
                        />
                      )}
                      {(settings.mode !== "GAME" || fieldView === "defense") &&
                        BP_POSITIONS.map((position) => {
                          const [left, top] =
                            CLUBHOUSE_FIELD_POSITION_COORDINATES[position];
                          return (
                            <button
                              key={position}
                              type="button"
                              style={{ left: `${left}%`, top: `${top}%` }}
                              data-tracked={bpPositionTracked(
                                settings,
                                position,
                              )}
                              aria-label={
                                position === "P"
                                  ? `Change pitcher: ${settings.source === "PLAYER" ? roster.find((p) => p.value === settings.pitcherId)?.label : settings.source === "COACH" ? settings.coachName : "Machine"}`
                                  : `Change ${position}: ${roster.find((p) => p.value === settings.alignment[position])?.label ?? "Unassigned"}`
                              }
                              onClick={() => {
                                if (uncertain || busy) return;
                                if (position === "P") {
                                  setParticipantPicker("pitcher");
                                  return;
                                }
                                setAlignmentPosition(position);
                                setSetupStep(2);
                                setOptionsOpen(true);
                              }}
                            >
                              <span
                                title={liveBpFieldLabel(
                                  settings,
                                  players,
                                  position,
                                )}
                              >
                                {liveBpFieldLabel(settings, players, position)}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                ) : (
                  charts(
                    settings.hitterId,
                    "hitting",
                    quickView === "location" ? "location" : "spray",
                  )
                )}
              </>
            )}
          </fieldset>
          {stage === "details" &&
            flow(
              <LiveBpPitchDetails
                settings={settings}
                draft={draft}
                location={pitchLocationControl}
                onChange={(next) => {
                  setDraft(next);
                  if (settings.pitchMode === "ONE" && next.pitchType)
                    update("pitchType", next.pitchType);
                }}
              />,
            )}
          {fieldRetry && (
            <button
              type="button"
              className="primary-button"
              disabled={busy}
              onClick={() => {
                const request = fieldRequest.current;
                if (request) void fieldAction(request.operation);
              }}
            >
              Retry field update
            </button>
          )}
          {stage === "pitch" && (
            <footer className={styles.footer}>
              {error && (
                <div role="alert">
                  <p>{error}</p>
                  {!uncertain && (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => void reload()}
                    >
                      Reload round
                    </button>
                  )}
                </div>
              )}
              <p role="status" className={styles.notice}>
                {notice || (lastPitch ? `Last: ${lastPitch}` : "")}
              </p>
            </footer>
          )}
          {chartsOpen &&
            sheet(
              "Live BP Analytics",
              () => setChartsOpen(false),
              <>
                <AskClubhouseLauncher
                  compact
                  onClick={() => {
                    setChartsOpen(false);
                    onAsk(chartPlayer || settings.hitterId, chartSide);
                  }}
                />
                <BpSegments
                  label="Analytics"
                  value={chartSide}
                  options={[
                    { value: "hitting", label: "Hitting" },
                    { value: "pitching", label: "Pitching" },
                  ]}
                  onChange={(side) => {
                    setChartSide(side as "hitting" | "pitching");
                    setChartPlayer(
                      side === "pitching"
                        ? (settings.pitcherId ?? players[0]?.id ?? "")
                        : settings.hitterId,
                    );
                  }}
                />
                <ChoiceSelect
                  label="Analytics player"
                  value={chartPlayer || settings.hitterId}
                  options={roster.filter(
                    (p) =>
                      !players.find((player) => player.id === p.value)
                        ?.archived,
                  )}
                  onChange={setChartPlayer}
                />
                <section className={styles.charts}>
                  {charts(chartPlayer || settings.hitterId, chartSide)}
                </section>
              </>,
            )}
          {optionsOpen && (
            <LiveBpSetup
              settings={settings}
              state={state}
              players={players}
              coaches={coaches}
              initialStep={setupStep}
              initialPosition={alignmentPosition}
              busy={busy}
              error={error}
              onSave={saveSetup}
              onClose={() => setOptionsOpen(false)}
              sheet={sheet}
              onEnd={
                round
                  ? () => {
                      if (window.confirm("End this Live BP round?"))
                        void write("end");
                    }
                  : undefined
              }
            />
          )}
          {presetsOpen && (
            <LiveBpDefensePresets
              settings={settings}
              playerIds={players.filter((p) => !p.archived).map((p) => p.id)}
              busy={busy || uncertain}
              error={error}
              onSave={(next) => saveSetup(next, state)}
              onLoad={async (next) => {
                if (busy || uncertain) return;
                if (await write(round ? "configure" : "start", next, state)) {
                  setPresetsOpen(false);
                  setQuickView("defense");
                  setFieldView("defense");
                  if (fieldSettings.current) fieldSettings.current.open = false;
                }
              }}
              onClose={() => {
                if (!busy) setPresetsOpen(false);
              }}
              sheet={sheet}
            />
          )}
          {participantPicker &&
            !playerEditor &&
            sheet(
              creatingParticipant
                ? "Create new"
                : participantPicker === "hitter"
                  ? "Choose Hitter"
                  : "Choose Pitcher",
              () => setParticipantPicker(null),
              <>
                {creatingParticipant ? (
                  <>
                    <BpSegments
                      label="Type"
                      value={participantType}
                      options={[
                        { value: "Player", label: "Player" },
                        { value: "Coach", label: "Coach" },
                      ]}
                      onChange={setParticipantType}
                    />
                    {participantType === "Coach" && (
                      <label>
                        Coach name
                        <input
                          value={coachDraft}
                          maxLength={80}
                          onChange={(e) => setCoachDraft(e.target.value)}
                        />
                      </label>
                    )}
                    <div className="modal-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setCreatingParticipant(false)}
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        className="primary-button"
                        disabled={
                          participantType === "Coach" && !coachDraft.trim()
                        }
                        onClick={() => {
                          if (participantType === "Player")
                            setPlayerEditor(true);
                          else {
                            saveSetup(
                              {
                                ...settings,
                                source: "COACH",
                                coachName: coachDraft.trim(),
                                pitcherId: undefined,
                              },
                              state,
                            );
                            setParticipantPicker(null);
                          }
                        }}
                      >
                        {participantType === "Player"
                          ? "Player Details"
                          : "Use Coach"}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.participantList}>
                      {participantPicker === "pitcher" && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              saveSetup(
                                {
                                  ...settings,
                                  source: "MACHINE",
                                  pitcherId: undefined,
                                },
                                state,
                              );
                              setParticipantPicker(null);
                            }}
                          >
                            Machine
                          </button>
                          {[
                            ...new Set(
                              [...coaches, settings.coachName].filter(
                                (v): v is string => Boolean(v),
                              ),
                            ),
                          ].map((name) => (
                            <button
                              type="button"
                              key={name}
                              onClick={() => {
                                saveSetup(
                                  {
                                    ...settings,
                                    source: "COACH",
                                    coachName: name,
                                    pitcherId: undefined,
                                  },
                                  state,
                                );
                                setParticipantPicker(null);
                              }}
                            >
                              Coach · {name}
                            </button>
                          ))}
                        </>
                      )}
                      {(participantPicker === "hitter"
                        ? hitters
                        : players.filter(
                            (p) => !p.archived && p.id !== settings.hitterId,
                          )
                      ).map((player) => (
                        <button
                          type="button"
                          key={player.id}
                          onClick={() => {
                            if (participantPicker === "hitter")
                              changeHitter(player.id);
                            else
                              saveSetup(
                                {
                                  ...settings,
                                  source: "PLAYER",
                                  pitcherId: player.id,
                                },
                                state,
                              );
                            setParticipantPicker(null);
                          }}
                        >
                          {densePlayerIdentityLabel(player)}
                        </button>
                      ))}
                    </div>
                    <div className="modal-actions">
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => {
                          setParticipantType("Player");
                          setCoachDraft("");
                          setCreatingParticipant(true);
                        }}
                      >
                        <Plus size={18} />
                        Create new
                      </button>
                    </div>
                  </>
                )}
              </>,
            )}
          {playerEditor &&
            createPlayer(
              (player) => {
                if (participantPicker === "hitter") {
                  update("hitterId", player.id);
                } else {
                  setSettings((s) => ({
                    ...s,
                    source: "PLAYER",
                    pitcherId: player.id,
                  }));
                  setDraft({ outcome: "" });
                }
                setPlayerEditor(false);
                setParticipantPicker(null);
              },
              () => setPlayerEditor(false),
            )}
        </>
      )}
    </section>
  );
}

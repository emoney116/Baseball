"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChevronRight,
  Check,
  BarChart3,
  Settings,
  ArrowLeft,
  ArrowRight,
  Plus,
} from "lucide-react";
import type { Player, ZonePoint } from "../types";
import {
  BP_POSITIONS,
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
import { VelocityPickerField } from "./TeamTrainingViews";
import { ChoiceSelect } from "./ChoiceSelect";
import { ClubhouseBaseballField } from "./ClubhouseBaseballField";
import { DensePlayerIdentity } from "./DensePlayerIdentity";
import { densePlayerIdentityLabel } from "../lib/densePlayerIdentity";
import { CLUBHOUSE_FIELD_POSITION_COORDINATES } from "../lib/baseballFieldLayout";
import { LiveBpSetup } from "./LiveBpSetup";
import { BpBases, BpCount, BpSegments, type BpSheet } from "./LiveBpControls";
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
}: {
  practiceId: string;
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
    [alignmentPosition, setAlignmentPosition] = useState<BpDraft["position"]>(),
    [participantPicker, setParticipantPicker] = useState<
      "hitter" | "pitcher" | null
    >(null),
    [creatingParticipant, setCreatingParticipant] = useState(false),
    [participantType, setParticipantType] = useState("Player"),
    [coachDraft, setCoachDraft] = useState(""),
    [playerEditor, setPlayerEditor] = useState(false),
    [contactFinished, setContactFinished] = useState(false),
    [detail, setDetail] = useState<"defense" | "runners" | null>(null),
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
        const pitchType = draft.pitchType;
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
                : (draft.pitchType ?? settings.pitchType)
              : "",
            settings.velocity && draft.velocity ? `${draft.velocity} mph` : "",
            draft.outcome,
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
  const bip = stage === "bip";
  const ended = !active || Boolean(round?.ended_at);
  const trackedCount = bpTracksCount(settings);
  const pitcher = players.find((p) => p.id === settings.pitcherId);
  const positions =
    settings.defense === "ALL" ? BP_POSITIONS : settings.positions;
  const currentPitchType =
    settings.pitchMode === "ONE"
      ? settings.pitchType
      : (draft.pitchType ?? settings.pitchType);
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
    setContactFinished(false);
    edit("outcome", outcome);
    if (outcome === "Ball in play") {
      setContactFinished(!settings.ev && !settings.spray);
      setStage("bip");
    }
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
  function flow(content: ReactNode) {
    const next = stage === "details" || (bip && !contactFinished);
    return sheet(
      bip ? "Ball in Play" : "Log Pitch",
      () => {
        if (!busy) setStage("pitch");
      },
      <>
        <div
          className="practice-hitting-sheet__flow"
          aria-label="Pitch log steps"
        >
          <span className={stage === "details" ? "active" : ""}>Pitch</span>
          <span className={stage === "result" ? "active" : ""}>Result</span>
          {draft.outcome === "Ball in play" && (
            <>
              <span className={bip && !contactFinished ? "active" : ""}>
                Contact
              </span>
              <span className={contactFinished ? "active" : ""}>Result</span>
            </>
          )}
        </div>
        <fieldset disabled={busy || uncertain} className={styles.fields}>
          {content}
        </fieldset>
        <div className="modal-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={() => {
              if (bip && contactFinished) setContactFinished(false);
              else setStage("pitch");
            }}
          >
            Back
          </button>
          {error && <p role="alert">{error}</p>}
          <button
            type="button"
            className="primary-button"
            disabled={
              busy ||
              (!next && !draft.outcome) ||
              (bip && contactFinished && !draft.result)
            }
            onClick={() =>
              next
                ? bip
                  ? setContactFinished(true)
                  : setStage("result")
                : void write("pitch")
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
        </div>
      </>,
    );
  }
  const job =
    settings.mode === "GAME" && state.job ? (
      <div className={styles.job}>
        <span>Job · {state.job}</span>
        <BpSegments
          label="Job result"
          value={draft.jobSuccess === undefined ? "" : String(draft.jobSuccess)}
          options={[
            { value: "true", label: "Done" },
            { value: "false", label: "Not Done" },
          ]}
          onChange={(v) => edit("jobSuccess", v === "true")}
        />
      </div>
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
          <fieldset disabled={busy} className={styles.fields} ref={fields}>
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
              <span className={styles.live}>LIVE</span>
              {trackedCount && (
                <BpCount
                  balls={state.balls}
                  strikes={state.strikes}
                  onChange={(balls, strikes) => {
                    if (!uncertain) setState((s) => ({ ...s, balls, strikes }));
                  }}
                />
              )}
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
                <>
                  <div className={styles.pitchSummary}>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Back to pitch"
                      onClick={() =>
                        setStage(
                          settings.velocity ||
                            settings.location ||
                            settings.pitchMode !== "OFF"
                            ? "details"
                            : "pitch",
                        )
                      }
                    >
                      <ArrowLeft size={18} />
                    </button>
                    <div>
                      <span>
                        {[
                          settings.pitchMode !== "OFF" && currentPitchType,
                          settings.velocity &&
                            draft.velocity &&
                            `${draft.velocity} mph`,
                          trackedCount && `${state.balls}-${state.strikes}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </div>
                  </div>
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
                            value={draft.battedBall ?? ""}
                            options={[
                              "Ground ball",
                              "Line drive",
                              "Fly ball",
                              "Pop up",
                            ].map((v) => ({ value: v, label: v }))}
                            onChange={(v) => edit("battedBall", v)}
                          />
                          <BpSegments
                            label="Batter result"
                            value={draft.result ?? ""}
                            options={[
                              ["Out", "Out"],
                              ["Single", "1B"],
                              ["Double", "2B"],
                              ["Triple", "3B"],
                              ["Home Run", "HR"],
                              ["Reached on Error", "Error"],
                              ["Fielders Choice", "FC"],
                            ].map(([value, label]) => ({ value, label }))}
                            onChange={(v) => edit("result", v)}
                          />
                          <details className={styles.optional}>
                            <summary>Contact quality</summary>
                            <BpSegments
                              label="Contact quality"
                              value={draft.contactQuality ?? ""}
                              options={[
                                "Poor",
                                "Weak",
                                "Solid",
                                "Hard",
                                "Barrel",
                              ].map((v) => ({ value: v, label: v }))}
                              onChange={(v) => edit("contactQuality", v)}
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
                  {contactFinished && settings.defense !== "OFF" && (
                    <button
                      type="button"
                      className={styles.detailRow}
                      onClick={() => setDetail("defense")}
                    >
                      <span>Defense</span>
                      <strong>
                        {draft.position
                          ? `${draft.position} · ${draft.defenseResult ?? "Select result"}`
                          : "Select Fielder"}
                      </strong>
                      <ChevronRight size={18} />
                    </button>
                  )}
                  {contactFinished &&
                    settings.mode === "GAME" &&
                    state.runners.length > 0 && (
                      <button
                        type="button"
                        className={styles.detailRow}
                        onClick={() => setDetail("runners")}
                      >
                        <span>Runners</span>
                        <strong>
                          {state.runners
                            .map(
                              (b) =>
                                `${b}B → ${draft.runnerOutcomes?.[b] ?? "Hold"}`,
                            )
                            .join(" · ")}
                        </strong>
                        <ChevronRight size={18} />
                      </button>
                    )}
                  {contactFinished && job}
                </>,
              )
            ) : (
              <>
                <div className={styles.situation}>
                  {settings.mode === "GAME" && (
                    <div className={styles.gameSituation}>
                      <button
                        type="button"
                        aria-label="Edit situation"
                        onClick={() => setup(2)}
                      >
                        <strong>
                          {state.outs} OUT{state.outs === 1 ? "" : "S"}
                        </strong>
                        <span>
                          {state.job ? `JOB · ${state.job}` : "Edit situation"}
                        </span>
                      </button>
                      <BpBases runners={state.runners} />
                    </div>
                  )}
                </div>
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
                        : settings.velocity ||
                            settings.location ||
                            settings.pitchMode !== "OFF"
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
                        ? "Defense"
                        : view === "spray"
                          ? "Spray"
                          : "Pitch Map"}
                    </button>
                  ))}
                </div>
                {quickView === "defense" ? (
                  <div className={styles.alignmentField}>
                    <ClubhouseBaseballField
                      coordinateSpace="game"
                      showLabels={false}
                      showEmptyState={false}
                      ariaLabel="Defensive alignment"
                    />
                    <details
                      className={styles.fieldTracking}
                      onPointerEnter={(event) => {
                        if (event.pointerType === "mouse")
                          event.currentTarget.open = true;
                      }}
                      onPointerLeave={(event) => {
                        if (
                          event.pointerType === "mouse" &&
                          !event.currentTarget.contains(document.activeElement)
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
                    </details>
                    {BP_POSITIONS.map((position) => {
                      const [left, top] =
                        CLUBHOUSE_FIELD_POSITION_COORDINATES[position];
                      return (
                        <button
                          key={position}
                          type="button"
                          style={{ left: `${left}%`, top: `${top}%` }}
                          data-tracked={bpPositionTracked(settings, position)}
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
                          {position}
                        </button>
                      );
                    })}
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
          {detail === "defense" &&
            sheet(
              "Fielding Play",
              () => setDetail(null),
              <>
                <fieldset disabled={busy || uncertain} className={styles.setup}>
                  <ChoiceSelect
                    label="Fielder"
                    value={draft.position ?? ""}
                    options={[
                      { value: "", label: "No defensive rep" },
                      ...positions
                        .filter((p) => settings.alignment[p])
                        .map((p) => ({
                          value: p,
                          label: `${p} · ${roster.find((r) => r.value === settings.alignment[p])?.label ?? ""}`,
                        })),
                    ]}
                    onChange={(v) =>
                      edit(
                        "position",
                        v ? (v as BpDraft["position"]) : undefined,
                      )
                    }
                  />
                  {draft.position && (
                    <>
                      <BpSegments
                        label="Defense result"
                        value={draft.defenseResult ?? ""}
                        options={[
                          "Clean",
                          "Missed Rep",
                          "Error",
                          "Great Play",
                        ].map((v) => ({ value: v, label: v }))}
                        onChange={(v) => edit("defenseResult", v)}
                      />
                      {draft.defenseResult === "Error" && (
                        <BpSegments
                          label="Error type"
                          value={draft.errorType ?? ""}
                          options={["Fielding", "Throwing", "Decision"].map(
                            (v) => ({ value: v, label: v }),
                          )}
                          onChange={(v) => edit("errorType", v)}
                        />
                      )}
                      <BpSegments
                        label="Throw"
                        value={draft.throwResult ?? "No Throw"}
                        options={["No Throw", "Accurate", "Inaccurate"].map(
                          (v) => ({ value: v, label: v }),
                        )}
                        onChange={(v) => edit("throwResult", v)}
                      />
                    </>
                  )}
                </fieldset>
                <div className="modal-actions">
                  <button
                    className="primary-button"
                    onClick={() => setDetail(null)}
                  >
                    Done
                    <Check size={18} />
                  </button>
                </div>
              </>,
            )}
          {detail === "runners" &&
            sheet(
              "Runner Outcomes",
              () => setDetail(null),
              <>
                <div className={styles.setup}>
                  {state.runners.map((b) => (
                    <BpSegments
                      key={b}
                      label={`Runner ${b}B`}
                      value={draft.runnerOutcomes?.[b] ?? "hold"}
                      options={[
                        { value: "hold", label: "Hold" },
                        ...[1, 2, 3]
                          .filter((n) => n !== b)
                          .map((n) => ({
                            value: String(n),
                            label: `To ${n}B`,
                          })),
                        { value: "score", label: "Score" },
                        { value: "out", label: "Out" },
                      ]}
                      onChange={(v) =>
                        edit("runnerOutcomes", {
                          ...draft.runnerOutcomes,
                          [b]: v,
                        })
                      }
                    />
                  ))}
                </div>
                <div className="modal-actions">
                  <button
                    className="primary-button"
                    onClick={() => setDetail(null)}
                  >
                    Done
                    <Check size={18} />
                  </button>
                </div>
              </>,
            )}
        </>
      )}
    </section>
  );
}

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Plus,
  MoreHorizontal,
  X,
  BarChart3,
} from "lucide-react";
import type { Player, ZonePoint } from "../types";
import {
  BP_POSITIONS,
  buildBpPitch,
  initialBpSettings,
  initialBpState,
  type BpDraft,
  type BpRound,
  type BpSettings,
} from "../lib/liveBp";
import { TENDEX_PITCH_TYPES } from "../lib/tendexGameAnalysis";
import { ChoiceSelect } from "./ChoiceSelect";
import { ClubhouseBaseballField } from "./ClubhouseBaseballField";
import { PlayerAvatar } from "./visuals";
import styles from "./LiveBpConsole.module.css";

function Select({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: string;
  values: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <ChoiceSelect
      label={label}
      value={value}
      options={values.map((value) => ({ value, label: value }))}
      onChange={onChange}
    />
  );
}
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
  charts: (hitterId: string) => ReactNode;
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
      return {
        ...initialBpSettings(hitterId),
        source: initialSource ?? "MACHINE",
        pitcherId,
      };
    });
  const [state, setState] = useState(initialBpState),
    [draft, setDraft] = useState<BpDraft>({ outcome: "" });
  const [loading, setLoading] = useState(true),
    [optionsOpen, setOptionsOpen] = useState(false),
    [entryOpen, setEntryOpen] = useState(false),
    [chartsOpen, setChartsOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [uncertain, setUncertain] = useState(false);
  const lock = useRef(false),
    fields = useRef<HTMLFieldSetElement>(null),
    pending = useRef<{ id: string; draft: BpDraft } | null>(null),
    startId = useRef<string | null>(null);
  const url = `/api/live-bp?practiceId=${encodeURIComponent(practiceId)}`;
  function adopt(r: BpRound) {
    setRound(r);
    setSettings(r.settings);
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
  const roster = players.map((p) => ({ value: p.id, label: p.name }));
  const hitters = players.filter(
    (p) => settings.source !== "PLAYER" || p.id !== settings.pitcherId,
  );
  const coachNames = [
    ...new Set([...coaches, settings.coachName ?? ""].filter(Boolean)),
  ];
  function rotateHitter(direction: number) {
    const index = hitters.findIndex((p) => p.id === settings.hitterId);
    const next = hitters[(index + direction + hitters.length) % hitters.length];
    if (next) update("hitterId", next.id);
  }
  function update<K extends keyof BpSettings>(key: K, value: BpSettings[K]) {
    if (["hitterId", "pitcherId", "source", "coachName"].includes(key))
      setDraft({ outcome: "" });
    setSettings((s) => ({ ...s, [key]: value }));
  }
  function edit<K extends keyof BpDraft>(key: K, value: BpDraft[K]) {
    if (!uncertain && !busy) setDraft((d) => ({ ...d, [key]: value }));
  }
  async function write(
    operation: "start" | "configure" | "pitch" | "end",
    nextSettings = settings,
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
          state,
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
      if (
        operation === "configure" &&
        (nextSettings.hitterId !== round?.settings.hitterId ||
          nextSettings.pitcherId !== round?.settings.pitcherId ||
          nextSettings.source !== round?.settings.source)
      )
        setDraft({ outcome: "" });
      adopt(p.round);
      if (operation === "pitch") {
        const pitchType = draft.pitchType;
        pending.current = null;
        setDraft({ outcome: "", pitchType });
        requestAnimationFrame(() => fields.current?.scrollTo({ top: 0 }));
        setNotice("Pitch saved");
        setEntryOpen(false);
      }
      if (operation === "end") {
        setNotice("Live BP ended");
      }
      onSaved();
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
  const bip = draft.outcome === "Ball in play",
    ended = !active || Boolean(round?.ended_at);
  const nonBipPaEnd =
    draft.outcome === "HBP" ||
    (draft.outcome === "Ball" && state.balls === 3) ||
    (["Called Strike", "Whiff"].includes(draft.outcome) && state.strikes === 2);
  const positions =
    settings.defense === "ALL" ? BP_POSITIONS : settings.positions;
  const number = (key: "velocity" | "ev", label: string) => (
    <label>
      {label}
      <input
        inputMode="decimal"
        type="number"
        min="1"
        max="130"
        value={draft[key] ?? ""}
        onChange={(e) =>
          edit(key, e.target.value === "" ? undefined : Number(e.target.value))
        }
      />
    </label>
  );
  return (
    <section className={`practice-hitting-shell ${styles.console}`}>
      {loading ? (
        <p role="status">Loading Live BP...</p>
      ) : (
        <>
          {error && (
            <div role="alert">
              <p>{error}</p>
              <button
                className="secondary-button"
                onClick={() => void reload()}
              >
                Reload round
              </button>
            </div>
          )}
          {ended ? (
            <div>
              <p role="status">Practice or Live BP has ended.</p>
              <button className="secondary-button" onClick={onExit}>
                Practice Home
              </button>
            </div>
          ) : (
            <>
              <fieldset
                ref={fields}
                disabled={busy || uncertain}
                className={`practice-hitting-stage panel ${styles.fields}`}
              >
                <div
                  className={`practice-hitting-player-row ${styles.playerRow}`}
                >
                  <button
                    className="practice-hitting-nav-button"
                    aria-label="Previous hitter"
                    onClick={() => rotateHitter(-1)}
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <ChoiceSelect
                    aria-label="Hitter"
                    className={styles.hitter}
                    mobilePresentation="popover"
                    value={settings.hitterId}
                    options={hitters.map((p) => ({
                      value: p.id,
                      label: p.name,
                      icon: <PlayerAvatar player={p} size="lg" compact />,
                    }))}
                    onChange={(v) => update("hitterId", v)}
                  />
                  <button
                    className="practice-hitting-nav-button practice-hitting-nav-button--stats"
                    aria-label="Show Live BP charts"
                    aria-expanded={chartsOpen}
                    onClick={() => setChartsOpen((v) => !v)}
                  >
                    <BarChart3 size={18} />
                  </button>
                  <button
                    className="practice-hitting-nav-button"
                    aria-label="Next hitter"
                    onClick={() => rotateHitter(1)}
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
                <ChoiceSelect
                  aria-label="Pitch source"
                  className="practice-hitting-session-select practice-session-select"
                  mobilePresentation="popover"
                  value={
                    settings.source === "PLAYER"
                      ? `PLAYER:${settings.pitcherId}`
                      : settings.source === "COACH" && settings.coachName
                        ? `COACH:${settings.coachName}`
                        : settings.source
                  }
                  options={[
                    { value: "MACHINE", label: "Machine" },
                    ...coachNames.map((name) => ({
                      value: `COACH:${name}`,
                      label: `Coach ${name}`,
                    })),
                    { value: "COACH", label: "Other coach" },
                    ...players
                      .filter((p) => p.id !== settings.hitterId)
                      .map((p) => ({
                        value: `PLAYER:${p.id}`,
                        label: p.name,
                        description: "Player pitcher",
                      })),
                  ]}
                  onChange={(v) => {
                    setDraft({ outcome: "" });
                    setSettings((s) => ({
                      ...s,
                      source: v.startsWith("PLAYER:")
                        ? "PLAYER"
                        : v.startsWith("COACH")
                          ? "COACH"
                          : "MACHINE",
                      pitcherId: v.startsWith("PLAYER:")
                        ? v.slice(7)
                        : undefined,
                      coachName: v.startsWith("COACH:")
                        ? v.slice(6)
                        : undefined,
                    }));
                  }}
                />
                {settings.source === "COACH" &&
                  (!coaches.includes(settings.coachName ?? "") ||
                    optionsOpen) && (
                    <label>
                      Coach name
                      <input
                        maxLength={80}
                        value={settings.coachName ?? ""}
                        onChange={(e) =>
                          update("coachName", e.target.value || undefined)
                        }
                      />
                    </label>
                  )}
                <div className="practice-hitting-entry-bar">
                  <button
                    className="primary-button practice-hitting-log-trigger"
                    aria-expanded={entryOpen}
                    onClick={() => setEntryOpen(true)}
                  >
                    <Plus size={20} />
                    Log Pitch
                  </button>
                  <div className="practice-hitting-quick-controls">
                    {(["ev", "velocity", "spray", "location"] as const).map(
                      (key, i) => (
                        <button
                          key={key}
                          type="button"
                          aria-pressed={settings[key]}
                          onClick={() => update(key, !settings[key])}
                        >
                          {["EV", "Velo", "Spray", "Loc"][i]}{" "}
                          <strong>{settings[key] ? "On" : "Off"}</strong>
                        </button>
                      ),
                    )}
                    <button
                      type="button"
                      aria-expanded={optionsOpen}
                      onClick={() => setOptionsOpen((v) => !v)}
                    >
                      Pitch{" "}
                      <strong>
                        {settings.pitchMode === "OFF"
                          ? "Off"
                          : settings.pitchMode === "ONE"
                            ? "Single"
                            : "Multi"}
                      </strong>
                    </button>
                  </div>
                  <button
                    className="secondary-button practice-hitting-more-trigger"
                    title="Live BP options"
                    aria-label="Live BP options"
                    aria-expanded={optionsOpen}
                    onClick={() => setOptionsOpen((v) => !v)}
                  >
                    <MoreHorizontal size={20} />
                  </button>
                </div>
                {chartsOpen && charts(settings.hitterId)}
                {optionsOpen && (
                  <>
                    <div className={styles.grid}>
                      <ChoiceSelect
                        label="Mode"
                        value={settings.mode}
                        options={[
                          { value: "FREE", label: "Free BP" },
                          { value: "AB", label: "Live AB" },
                          { value: "GAME", label: "Game-Like" },
                        ]}
                        onChange={(v) =>
                          update("mode", v as BpSettings["mode"])
                        }
                      />
                      <ChoiceSelect
                        label="Pitch type tracking"
                        value={settings.pitchMode}
                        options={[
                          { value: "OFF", label: "Off" },
                          { value: "ONE", label: "Single Pitch" },
                          { value: "MULTI", label: "Multi Pitch" },
                        ]}
                        onChange={(v) =>
                          update("pitchMode", v as BpSettings["pitchMode"])
                        }
                      />
                      {settings.pitchMode !== "OFF" && (
                        <Select
                          label="Pitch type"
                          value={settings.pitchType ?? ""}
                          values={TENDEX_PITCH_TYPES}
                          onChange={(v) =>
                            update("pitchType", v as BpSettings["pitchType"])
                          }
                        />
                      )}
                    </div>
                    <ChoiceSelect
                      label="Defense tracking"
                      value={settings.defense}
                      options={[
                        { value: "OFF", label: "Off" },
                        { value: "ALL", label: "All Positions" },
                        { value: "SELECTED", label: "Selected Positions" },
                      ]}
                      onChange={(v) =>
                        update("defense", v as BpSettings["defense"])
                      }
                    />
                    {settings.defense === "SELECTED" && (
                      <div className={styles.toggles}>
                        {BP_POSITIONS.map((p) => (
                          <label key={p}>
                            <input
                              type="checkbox"
                              checked={settings.positions.includes(p)}
                              onChange={(e) =>
                                update(
                                  "positions",
                                  e.target.checked
                                    ? [...settings.positions, p]
                                    : settings.positions.filter((v) => v !== p),
                                )
                              }
                            />
                            {p}
                          </label>
                        ))}
                      </div>
                    )}
                    {settings.defense !== "OFF" && (
                      <div className={styles.grid}>
                        {positions.map((p) => (
                          <ChoiceSelect
                            key={p}
                            label={p}
                            value={settings.alignment[p] ?? ""}
                            options={[
                              { value: "", label: "Unassigned" },
                              ...roster,
                            ]}
                            onChange={(v) =>
                              update("alignment", {
                                ...settings.alignment,
                                [p]: v,
                              })
                            }
                          />
                        ))}
                      </div>
                    )}
                    {settings.mode !== "FREE" && (
                      <div className={styles.grid}>
                        <Select
                          label="Balls"
                          value={String(state.balls)}
                          values={["0", "1", "2", "3"]}
                          onChange={(v) =>
                            setState((s) => ({ ...s, balls: Number(v) }))
                          }
                        />
                        <Select
                          label="Strikes"
                          value={String(state.strikes)}
                          values={["0", "1", "2"]}
                          onChange={(v) =>
                            setState((s) => ({ ...s, strikes: Number(v) }))
                          }
                        />
                        {settings.mode === "GAME" && (
                          <>
                            <Select
                              label="Outs"
                              value={String(state.outs)}
                              values={["0", "1", "2"]}
                              onChange={(v) =>
                                setState((s) => ({ ...s, outs: Number(v) }))
                              }
                            />
                            <label>
                              Job
                              <input
                                maxLength={80}
                                value={state.job}
                                onChange={(e) =>
                                  setState((s) => ({
                                    ...s,
                                    job: e.target.value,
                                  }))
                                }
                              />
                            </label>
                            <div className={styles.toggles}>
                              {[1, 2, 3].map((b) => (
                                <label key={b}>
                                  <input
                                    type="checkbox"
                                    checked={state.runners.includes(b)}
                                    onChange={(e) =>
                                      setState((s) => ({
                                        ...s,
                                        runners: e.target.checked
                                          ? [...s.runners, b]
                                          : s.runners.filter((v) => v !== b),
                                      }))
                                    }
                                  />
                                  {b}B
                                </label>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
                {entryOpen && (
                  <>
                    <div className={styles.header}>
                      <h3>Log Pitch</h3>
                      <button
                        className="icon-button"
                        aria-label="Close pitch entry"
                        onClick={() => setEntryOpen(false)}
                      >
                        <X size={18} />
                      </button>
                    </div>
                    {settings.pitchMode !== "OFF" && (
                      <Select
                        label="Pitch type for this pitch"
                        value={
                          settings.pitchMode === "ONE"
                            ? (settings.pitchType ?? "")
                            : (draft.pitchType ?? settings.pitchType ?? "")
                        }
                        values={TENDEX_PITCH_TYPES}
                        onChange={(v) =>
                          settings.pitchMode === "ONE"
                            ? update("pitchType", v as BpSettings["pitchType"])
                            : edit("pitchType", v as BpDraft["pitchType"])
                        }
                      />
                    )}
                    {settings.mode !== "FREE" && (
                      <div className={styles.situation}>
                        <strong>{`${state.balls}-${state.strikes}`}</strong>
                        {settings.mode === "GAME" && (
                          <>
                            <span>{state.outs} out</span>
                            <span>
                              {state.runners.length
                                ? state.runners.map((b) => `${b}B`).join(", ")
                                : "Bases empty"}
                            </span>
                            <span>{state.job}</span>
                          </>
                        )}
                      </div>
                    )}
                    {settings.velocity && (
                      <div className={styles.grid}>
                        {settings.velocity &&
                          number("velocity", "Pitch velocity (mph)")}
                      </div>
                    )}
                    <div className={styles.outcomes}>
                      {[
                        "Ball",
                        "Called Strike",
                        "Whiff",
                        "Foul",
                        "Ball in play",
                        "HBP",
                      ].map((v) => (
                        <button
                          key={v}
                          aria-pressed={draft.outcome === v}
                          className={
                            draft.outcome === v
                              ? "primary-button"
                              : "secondary-button"
                          }
                          onClick={() => edit("outcome", v)}
                        >
                          {v === "Whiff"
                            ? "Swing + Miss"
                            : v === "Ball"
                              ? "Take: Ball"
                              : v === "Called Strike"
                                ? "Take: Strike"
                                : v}
                        </button>
                      ))}
                    </div>
                    <div className={styles.entry}>
                      {settings.location && (
                        <section>
                          <h3>Pitch Location</h3>
                          {pitchLocationControl(
                            draft.location,
                            (p) => edit("location", p),
                            settings.hitterId,
                          )}
                        </section>
                      )}
                      {bip && (
                        <section className={styles.bip}>
                          <h3>Ball in Play</h3>
                          <div className={styles.grid}>
                            {settings.ev && number("ev", "Exit velocity (mph)")}
                            <Select
                              label="Batted-ball type"
                              value={draft.battedBall ?? ""}
                              values={[
                                "Ground ball",
                                "Line drive",
                                "Fly ball",
                                "Pop up",
                              ]}
                              onChange={(v) => edit("battedBall", v)}
                            />
                            <Select
                              label="Contact quality (optional)"
                              value={draft.contactQuality ?? ""}
                              values={[
                                "Poor",
                                "Weak",
                                "Solid",
                                "Hard",
                                "Barrel",
                              ]}
                              onChange={(v) => edit("contactQuality", v)}
                            />
                            <Select
                              label="Batter result"
                              value={draft.result ?? ""}
                              values={[
                                "Out",
                                "Single",
                                "Double",
                                "Triple",
                                "Home Run",
                                "Reached on Error",
                                "Fielders Choice",
                              ]}
                              onChange={(v) => edit("result", v)}
                            />
                          </div>
                          {settings.spray && (
                            <ClubhouseBaseballField
                              activePoint={draft.spray}
                              onSelect={(p) => edit("spray", p)}
                              ariaLabel="Live BP spray location"
                            />
                          )}
                          {settings.defense !== "OFF" && (
                            <>
                              <ChoiceSelect
                                label="Fielder"
                                value={draft.position ?? ""}
                                options={[
                                  { value: "", label: "No defensive rep" },
                                  ...positions
                                    .filter((p) => settings.alignment[p])
                                    .map((p) => ({
                                      value: p,
                                      label: `${p} - ${roster.find((r) => r.value === settings.alignment[p])?.label ?? ""}`,
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
                                <div className={styles.grid}>
                                  <Select
                                    label="Defense result"
                                    value={draft.defenseResult ?? ""}
                                    values={[
                                      "Clean",
                                      "Missed Rep",
                                      "Error",
                                      "Great Play",
                                    ]}
                                    onChange={(v) => edit("defenseResult", v)}
                                  />
                                  <Select
                                    label="Throw"
                                    value={draft.throwResult ?? "No Throw"}
                                    values={[
                                      "No Throw",
                                      "Accurate",
                                      "Inaccurate",
                                    ]}
                                    onChange={(v) => edit("throwResult", v)}
                                  />
                                  {draft.defenseResult === "Error" && (
                                    <Select
                                      label="Error type"
                                      value={draft.errorType ?? ""}
                                      values={[
                                        "Fielding",
                                        "Throwing",
                                        "Decision",
                                      ]}
                                      onChange={(v) => edit("errorType", v)}
                                    />
                                  )}
                                </div>
                              )}
                            </>
                          )}
                          {settings.mode === "GAME" && (
                            <div className={styles.grid}>
                              <ChoiceSelect
                                label="Batter finishes"
                                value={draft.runnerOutcomes?.batter ?? ""}
                                options={[
                                  { value: "", label: "From batter result" },
                                  { value: "out", label: "Out" },
                                  ...["1", "2", "3"].map((value) => ({
                                    value,
                                    label: `To ${value}B`,
                                  })),
                                  { value: "score", label: "Scores" },
                                ]}
                                onChange={(v) => {
                                  const next = { ...draft.runnerOutcomes };
                                  if (v) next.batter = v;
                                  else delete next.batter;
                                  edit("runnerOutcomes", next);
                                }}
                              />
                              {state.runners.map((b) => (
                                <ChoiceSelect
                                  key={b}
                                  label={`Runner ${b}B`}
                                  value={draft.runnerOutcomes?.[b] ?? "hold"}
                                  options={[
                                    { value: "hold", label: "Holds" },
                                    ...["1", "2", "3"].map((value) => ({
                                      value,
                                      label: `To ${value}B`,
                                    })),
                                    { value: "score", label: "Scores" },
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
                              {state.job && (
                                <ChoiceSelect
                                  label="Job result"
                                  value={
                                    draft.jobSuccess === undefined
                                      ? ""
                                      : String(draft.jobSuccess)
                                  }
                                  options={[
                                    { value: "true", label: "Job Done" },
                                    { value: "false", label: "Job Not Done" },
                                  ]}
                                  onChange={(v) =>
                                    edit("jobSuccess", v === "true")
                                  }
                                />
                              )}
                            </div>
                          )}
                        </section>
                      )}
                    </div>
                    {settings.mode === "GAME" && state.job && nonBipPaEnd && (
                      <ChoiceSelect
                        label="Job result"
                        value={
                          draft.jobSuccess === undefined
                            ? ""
                            : String(draft.jobSuccess)
                        }
                        options={[
                          { value: "true", label: "Job Done" },
                          { value: "false", label: "Job Not Done" },
                        ]}
                        onChange={(v) => edit("jobSuccess", v === "true")}
                      />
                    )}
                  </>
                )}
              </fieldset>
              {entryOpen && (
                <footer className={styles.footer}>
                  <button
                    className="secondary-button"
                    disabled={busy || uncertain}
                    onClick={() => setEntryOpen(false)}
                  >
                    <X size={16} /> Close
                  </button>
                  <button
                    className="primary-button"
                    disabled={busy || !draft.outcome}
                    onClick={() => void write("pitch")}
                  >
                    <Check size={16} />
                    {busy
                      ? "Saving..."
                      : uncertain
                        ? "Retry Pitch"
                        : "Save Pitch"}
                  </button>
                </footer>
              )}
              {round && optionsOpen && (
                <button
                  className="ghost-button"
                  disabled={busy || uncertain}
                  onClick={() => void write("end")}
                >
                  End Live BP
                </button>
              )}
            </>
          )}
          <p role="status" className={styles.notice}>
            {notice}
          </p>
        </>
      )}
    </section>
  );
}

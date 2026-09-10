"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Settings2 } from "lucide-react";
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
}: {
  practiceId: string;
  players: Player[];
  active: boolean;
  onExit: () => void;
  onSaved: () => void;
  pitchLocationControl: (
    point: ZonePoint | undefined,
    onSelect: (point: ZonePoint) => void,
    hitterId: string,
  ) => ReactNode;
}) {
  const [round, setRound] = useState<BpRound | null>(null),
    [settings, setSettings] = useState(() =>
      initialBpSettings(players[0]?.id ?? ""),
    );
  const [state, setState] = useState(initialBpState),
    [draft, setDraft] = useState<BpDraft>({ outcome: "" });
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [config, setConfig] = useState(true),
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
        setConfig(false);
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
          setConfig(false);
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
  function update<K extends keyof BpSettings>(key: K, value: BpSettings[K]) {
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
      const res = await fetch(url, {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation,
          roundId: round?.id ?? startId.current,
          version: round?.version ?? 0,
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
      setConfig(false);
      if (operation === "pitch") {
        const pitchType = draft.pitchType;
        pending.current = null;
        setDraft({ outcome: "", pitchType });
        requestAnimationFrame(() => fields.current?.scrollTo({ top: 0 }));
        setNotice("Pitch saved");
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
    <div className={styles.console}>
      <header className={styles.header}>
        <button
          className="icon-button"
          title="Back to Practice"
          onClick={onExit}
        >
          <ArrowLeft size={20} />
        </button>
        <div className={styles.title}>
          <h2>Live BP</h2>
          {round && !config && (
            <p>
              <strong>
                {roster.find((p) => p.value === settings.hitterId)?.label}
              </strong>
              <span>
                {" "}
                ·{" "}
                {settings.source === "PLAYER"
                  ? roster.find((p) => p.value === settings.pitcherId)?.label
                  : settings.source === "MACHINE"
                    ? "Machine"
                    : "Coach"}
              </span>
            </p>
          )}
        </div>
        <button
          className="icon-button"
          title="Live BP settings"
          disabled={busy || uncertain || ended}
          onClick={() => {
            if (config && round) adopt(round);
            setConfig((v) => (round ? !v : true));
          }}
        >
          <Settings2 size={20} />
        </button>
      </header>
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
            <p role="status">Practice or Live BP has ended.</p>
          ) : (
            <>
              <fieldset
                ref={fields}
                disabled={busy || uncertain}
                className={styles.fields}
              >
                {config ? (
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
                        label="Pitch source"
                        value={settings.source}
                        options={["MACHINE", "COACH", "PLAYER"].map(
                          (value) => ({
                            value,
                            label: value[0] + value.slice(1).toLowerCase(),
                          }),
                        )}
                        onChange={(v) =>
                          update("source", v as BpSettings["source"])
                        }
                      />
                      <ChoiceSelect
                        label="Hitter"
                        value={settings.hitterId}
                        options={roster}
                        onChange={(v) => update("hitterId", v)}
                      />
                      {settings.source === "PLAYER" && (
                        <ChoiceSelect
                          label="Pitcher"
                          value={settings.pitcherId ?? ""}
                          options={roster.filter(
                            (p) => p.value !== settings.hitterId,
                          )}
                          onChange={(v) => update("pitcherId", v)}
                        />
                      )}
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
                    <div className={styles.toggles}>
                      {(["velocity", "location", "ev", "spray"] as const).map(
                        (key, i) => (
                          <label key={key}>
                            <input
                              type="checkbox"
                              checked={settings[key]}
                              onChange={(e) => update(key, e.target.checked)}
                            />
                            {
                              [
                                "Pitch velocity",
                                "Pitch location",
                                "Exit velocity",
                                "Spray",
                              ][i]
                            }
                          </label>
                        ),
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
                    <button
                      className="primary-button"
                      onClick={() => void write(round ? "configure" : "start")}
                    >
                      {round ? "Apply Settings" : "Start Live BP"}
                    </button>
                  </>
                ) : (
                  round && (
                    <>
                      <div className={styles.grid}>
                        <ChoiceSelect
                          label="Hitter"
                          value={settings.hitterId}
                          options={roster.filter(
                            (p) =>
                              settings.source !== "PLAYER" ||
                              p.value !== settings.pitcherId,
                          )}
                          onChange={(v) =>
                            void write("configure", {
                              ...settings,
                              hitterId: v,
                            })
                          }
                        />
                        {settings.source === "PLAYER" ? (
                          <ChoiceSelect
                            label="Pitcher"
                            value={settings.pitcherId ?? ""}
                            options={roster.filter(
                              (p) => p.value !== settings.hitterId,
                            )}
                            onChange={(v) =>
                              void write("configure", {
                                ...settings,
                                pitcherId: v,
                              })
                            }
                          />
                        ) : (
                          <strong className={styles.source}>
                            {settings.source === "MACHINE"
                              ? "Machine"
                              : "Coach"}{" "}
                            pitching
                          </strong>
                        )}
                      </div>
                      <div className={styles.situation}>
                        <strong>
                          {settings.mode === "FREE"
                            ? "Free BP"
                            : `${state.balls}-${state.strikes}`}
                        </strong>
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
                      <div className={styles.grid}>
                        {settings.pitchMode !== "OFF" && (
                          <Select
                            label="Pitch type"
                            value={
                              settings.pitchMode === "ONE"
                                ? (settings.pitchType ?? "")
                                : (draft.pitchType ?? settings.pitchType ?? "")
                            }
                            values={TENDEX_PITCH_TYPES}
                            onChange={(v) =>
                              settings.pitchMode === "ONE"
                                ? void write("configure", {
                                    ...settings,
                                    pitchType: v as BpSettings["pitchType"],
                                  })
                                : edit("pitchType", v as BpDraft["pitchType"])
                            }
                          />
                        )}
                        {settings.velocity &&
                          number("velocity", "Pitch velocity (mph)")}
                      </div>
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
                              {settings.ev &&
                                number("ev", "Exit velocity (mph)")}
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
                                      v
                                        ? (v as BpDraft["position"])
                                        : undefined,
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
                  )
                )}
              </fieldset>
              {!config && round && (
                <footer className={styles.footer}>
                  <button
                    className="secondary-button"
                    disabled={busy || uncertain}
                    onClick={() => {
                      const eligible = roster.filter(
                        (p) =>
                          settings.source !== "PLAYER" ||
                          p.value !== settings.pitcherId,
                      );
                      const next =
                        eligible[
                          (eligible.findIndex(
                            (p) => p.value === settings.hitterId,
                          ) +
                            1) %
                            eligible.length
                        ];
                      if (next)
                        void write("configure", {
                          ...settings,
                          hitterId: next.value,
                        });
                    }}
                  >
                    Next Hitter <ArrowRight size={16} />
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
              {!config && round && (
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
    </div>
  );
}

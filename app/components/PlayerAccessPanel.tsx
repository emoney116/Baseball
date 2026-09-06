"use client";
import { useEffect, useId, useRef, useState } from "react";
import { CircleHelp, ShieldCheck, X } from "lucide-react";
import {
  PLAYER_ACCESS_MODES,
  PLAYER_MODE_DETAILS,
  playerModeCapabilityDetails,
  type PlayerAccessMode,
} from "../lib/playerCapabilities";
export type PlayerAccessSettings = {
  teamDefault: PlayerAccessMode;
  roster: Array<{
    playerId: string;
    membershipId: string;
    name: string;
    override: PlayerAccessMode | null;
  }>;
};
export function PlayerAccessPanel({
  teamId,
  seasonId,
  previewSettings,
}: {
  teamId: string;
  seasonId: string;
  previewSettings?: PlayerAccessSettings;
}) {
  const [settings, setSettings] = useState<PlayerAccessSettings | undefined>(
    previewSettings,
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const helpDialog = useRef<HTMLDialogElement>(null);
  const controlId = useId();
  useEffect(() => {
    if (previewSettings) return;
    const controller = new AbortController();
    fetch(`/api/player-access?${new URLSearchParams({ teamId, seasonId })}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        const p = await r.json();
        if (!r.ok) throw new Error(p.message);
        return p;
      })
      .then(setSettings)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [teamId, seasonId, previewSettings]);
  async function save(mode: PlayerAccessMode | null, playerId?: string) {
    setBusy(true);
    setError("");
    try {
      if (!previewSettings) {
        const r = await fetch("/api/player-access", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamId, playerId, mode }),
        });
        const p = await r.json();
        if (!r.ok) throw new Error(p.message);
      }
      setSettings(
        (s) =>
          s &&
          (playerId
            ? {
                ...s,
                roster: s.roster.map((p) =>
                  p.playerId === playerId ? { ...p, override: mode } : p,
                ),
              }
            : { ...s, teamDefault: mode! }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save access.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="player-access-settings" aria-label="Player Access">
      <h2>
        <ShieldCheck size={18} /> Player Access
        <button
          className="icon-button player-access-help-button"
          type="button"
          aria-label="About player access modes"
          title="About player access modes"
          aria-haspopup="dialog"
          onClick={() => helpDialog.current?.showModal()}
        >
          <CircleHelp size={18} />
        </button>
      </h2>
      <dialog className="player-access-help-dialog" ref={helpDialog} aria-labelledby={`${controlId}-help-title`}>
        <header>
          <h2 id={`${controlId}-help-title`}>Player Access Modes</h2>
          <button className="icon-button" type="button" aria-label="Close access mode details" title="Close" onClick={() => helpDialog.current?.close()}><X size={18} /></button>
        </header>
        <div className="player-access-help-content">
          <p>Each mode requires an approved player link and applies only within this team. Individual overrides replace the team default.</p>
          {PLAYER_ACCESS_MODES.map((mode, index) => {
            const previousMode = PLAYER_ACCESS_MODES[index - 1];
            const inherited = new Set(previousMode ? playerModeCapabilityDetails(previousMode).map(({ key }) => key) : []);
            return <section key={mode}>
              <h3>{PLAYER_MODE_DETAILS[mode].label}</h3>
              {previousMode && <p>Everything in {PLAYER_MODE_DETAILS[previousMode].label}, plus:</p>}
              <ul>{playerModeCapabilityDetails(mode).filter(({ key }) => !inherited.has(key)).map(({ key, label }) => <li key={key}>{label}</li>)}</ul>
            </section>;
          })}
          <section>
            <h3>Not included in any mode</h3>
            <p>Players cannot create or start Practice or team workouts. Live entry requires an active coach-enabled session and their own assignment. Ending the session makes entry read-only. Live BP and Game entry are not enabled.</p>
            <p>No editing coach-owned records or official Games. No access to private coach notes, private teammate data, staff/admin tools, team stats or Insights, or published lineups. Player-written feedback and check-ins are not enabled.</p>
          </section>
        </div>
      </dialog>
      {error && <p role="alert">{error}</p>}
      {!settings ? (
        !error && <p role="status">Loading access settings...</p>
      ) : (
        <>
          <div className="player-access-default-row">
            <label htmlFor={`${controlId}-default`}>Default Player Access</label>
            <select id={`${controlId}-default`} value={settings.teamDefault} disabled={busy}
              onChange={(e) => void save(e.target.value as PlayerAccessMode)}>
              {PLAYER_ACCESS_MODES.map((mode) => <option key={mode} value={mode}>{PLAYER_MODE_DETAILS[mode].label}</option>)}
            </select>
          </div>
          <p className="muted">
            {PLAYER_MODE_DETAILS[settings.teamDefault].description}
          </p>
          <details className="player-access-overrides">
            <summary>
              Player Overrides{" "}
              <span>{settings.roster.filter((p) => p.override).length}</span>
            </summary>
            {settings.roster.map((p) => (
              <div className="player-access-row" key={p.membershipId}>
                <div>
                  <strong>{p.name}</strong>
                </div>
                <select
                  aria-label={`Access for ${p.name}`}
                  value={p.override ?? ""}
                  disabled={busy}
                  onChange={(e) =>
                    void save(
                      (e.target.value || null) as PlayerAccessMode | null,
                      p.playerId,
                    )
                  }
                >
                  <option value="">Team Default</option>
                  {PLAYER_ACCESS_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {PLAYER_MODE_DETAILS[mode].label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            {!settings.roster.length && (
              <p>No active players in this season.</p>
            )}
          </details>
        </>
      )}
    </section>
  );
}

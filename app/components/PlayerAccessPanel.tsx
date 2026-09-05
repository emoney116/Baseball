"use client";
import { useEffect, useState } from "react";
import { ChevronDown, ShieldCheck } from "lucide-react";
import {
  PLAYER_ACCESS_MODES,
  PLAYER_MODE_DETAILS,
  PLAYER_CAPABILITY_GROUPS,
  resolvePlayerCapabilities,
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
      </h2>
      {error && <p role="alert">{error}</p>}
      {!settings ? (
        <p role="status">Loading access settings...</p>
      ) : (
        <>
          <h3>Default Player Access</h3>
          <div
            className="player-access-modes"
            role="group"
            aria-label="Default Player Access"
          >
            {PLAYER_ACCESS_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={settings.teamDefault === mode}
                disabled={busy}
                onClick={() => void save(mode)}
              >
                {PLAYER_MODE_DETAILS[mode].label}
              </button>
            ))}
          </div>
          <p className="muted">
            {PLAYER_MODE_DETAILS[settings.teamDefault].description}
          </p>
          <details>
            <summary>
              What&apos;s included? <ChevronDown size={14} />
            </summary>
            {PLAYER_ACCESS_MODES.map((mode) => (
              <div key={mode}>
                <h3>{PLAYER_MODE_DETAILS[mode].label}</h3>
                <p>{PLAYER_MODE_DETAILS[mode].description}</p>
                <small>
                  {
                    Object.entries(
                      resolvePlayerCapabilities({
                        approved: true,
                        teamDefault: mode,
                      }).capabilities,
                    ).filter(
                      ([key, enabled]) =>
                        enabled &&
                        !PLAYER_CAPABILITY_GROUPS.denied.includes(key as never),
                    ).length
                  }{" "}
                  permitted capabilities
                </small>
              </div>
            ))}
          </details>
          <details className="player-access-overrides">
            <summary>
              Player Overrides{" "}
              <span>{settings.roster.filter((p) => p.override).length}</span>
            </summary>
            {settings.roster.map((p) => (
              <div className="player-access-row" key={p.membershipId}>
                <div>
                  <strong>{p.name}</strong>
                  <small title={p.playerId}>
                    Identity {p.playerId.slice(0, 8)}...{p.playerId.slice(-8)}
                  </small>
                </div>
                <select
                  aria-label={`Access for ${p.name} (${p.playerId})`}
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

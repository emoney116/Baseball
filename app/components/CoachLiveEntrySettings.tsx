"use client";
import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { LIVE_FIELDS, type LiveDomain } from "../lib/playerLiveModels";

export function CoachLiveEntrySettings({
  teamId,
  sessionId,
  domain,
  playerName,
  preview = false,
}: {
  teamId: string;
  sessionId: string;
  domain: LiveDomain;
  playerName?: string;
  preview?: boolean;
}) {
  const [enabled, setEnabled] = useState(false),
    [fields, setFields] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(preview),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (preview) return;
    let cancelled = false,
      loaded = false,
      reading = false;
    const read = () => {
      if (loaded || reading) return;
      reading = true;
      void fetch(
        `/api/player/live-entry/settings?${new URLSearchParams({ teamId, sessionId, domain })}`,
        { cache: "no-store" },
      )
        .then(async (r) => {
          const p = await r.json();
          if (!r.ok) throw new Error(p.message);
          if (!cancelled) {
            loaded = true;
            setEnabled(p.enabled);
            setFields(p.fields);
            setReady(true);
            setMessage("");
          }
        })
        .catch((e) => {
          if (!cancelled) setMessage(e.message);
        })
        .finally(() => {
          reading = false;
        });
    };
    read();
    // A newly selected coach station can still be in the existing persistence queue.
    const retryTimer = window.setInterval(read, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(retryTimer);
    };
  }, [teamId, sessionId, domain, preview]);
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      if (!preview) {
        const r = await fetch("/api/player/live-entry/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamId, sessionId, domain, enabled, fields }),
        });
        const p = await r.json();
        if (!r.ok) throw new Error(p.message);
      }
      setMessage(
        preview
          ? "Preview only. No team settings changed."
          : "Player entry settings saved.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to save.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="coach-live-entry">
      <summary>Player Live Entry{playerName ? ` - ${playerName}` : ""}</summary>
      <div className="coach-live-entry__body">
        <label className="live-checkbox">
          <input
            type="checkbox"
            checked={enabled}
            disabled={!ready || busy}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Allow assigned players to enter their own{" "}
          {domain === "workout" ? "sets" : "reps"}
        </label>
        {domain !== "workout" && (
          <fieldset disabled={!ready || busy}>
            <legend>Tracked Fields</legend>
            <div className="live-field-options">
              {LIVE_FIELDS[domain].map((f) => (
                <label className="live-checkbox" key={f.key}>
                  <input
                    type="checkbox"
                    checked={fields.includes(f.key)}
                    onChange={(e) =>
                      setFields(
                        e.target.checked
                          ? [...fields, f.key]
                          : fields.filter((k) => k !== f.key),
                      )
                    }
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <button
          className="secondary-button"
          disabled={!ready || busy}
          onClick={() => void save()}
        >
          <Save size={16} />
          Save
        </button>
        {message && <p role="status">{message}</p>}
      </div>
    </details>
  );
}

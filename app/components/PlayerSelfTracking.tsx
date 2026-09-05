"use client";
import { useState } from "react";
import { Plus, Save, Trash2, X } from "lucide-react";
import type { PlayerSession } from "../lib/playerAccess";
import { ownsPlayerEntry } from "../lib/playerCapabilities";
export function PlayerSelfTracking({
  session,
  onSaved,
  preview = false,
}: {
  session: PlayerSession;
  onSaved: () => Promise<void>;
  preview?: boolean;
}) {
  const [kind, setKind] = useState<"goal" | "body_weight" | null>(null),
    [id, setId] = useState<string | null>(null);
  const [title, setTitle] = useState(""),
    [weight, setWeight] = useState(""),
    [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [completed, setCompleted] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const caps = session.access?.capabilities;
  if (
    !caps ||
    !session.context ||
    !session.data ||
    (!caps.canCreateGoals && !caps.canLogBodyWeight)
  )
    return null;
  const goals = session.data.developmentGoals.filter((g) =>
    ownsPlayerEntry(g, session.profileId),
  );
  const weights = session.data.workoutSessions.filter((w) =>
    ownsPlayerEntry(w, session.profileId),
  );
  async function submit(operation: string, entryKind = kind, entryId = id) {
    let accessChanged = false;
    setBusy(true);
    setError("");
    try {
      if (preview) throw new Error("Preview only. No records were saved.");
      const r = await fetch("/api/player/self-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          membershipId: session.context!.membershipId,
          kind: entryKind,
          operation,
          id: entryId,
          date,
          bodyWeight: Number(weight),
          title,
          completed,
        }),
      });
      const p = await r.json();
      accessChanged = r.status === 401 || r.status === 403;
      if (!r.ok) throw new Error(p.message);
      setKind(null);
      setId(null);
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save entry.");
      if (accessChanged) await onSaved();
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="player-beta-section player-self-tracking"
      aria-label="Personal Tracking"
    >
      <h2>Personal Tracking</h2>
      <div className="player-tracking-actions">
        {caps.canCreateGoals && (
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => {
              setKind("goal");
              setId(null);
              setTitle("");
              setCompleted(false);
            }}
          >
            <Plus size={16} /> Goal
          </button>
        )}
        {caps.canLogBodyWeight && (
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => {
              setKind("body_weight");
              setId(null);
              setWeight("");
            }}
          >
            <Plus size={16} /> Body Weight
          </button>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      {kind && (
        <form
          className="player-tracking-form"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(id ? "update" : "create");
          }}
        >
          <h3>
            {id ? "Edit" : "New"} {kind === "goal" ? "Goal" : "Body Weight"}
          </h3>
          {kind === "goal" ? (
            <>
              <label>
                Goal
                <input
                  value={title}
                  maxLength={200}
                  required
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={completed}
                  onChange={(e) => setCompleted(e.target.checked)}
                />{" "}
                Completed
              </label>
            </>
          ) : (
            <>
              <label>
                Date
                <input
                  type="date"
                  value={date}
                  required
                  disabled={Boolean(id)}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <label>
                Body Weight (lb)
                <input
                  type="number"
                  inputMode="decimal"
                  min={30}
                  max={700}
                  step="0.1"
                  value={weight}
                  required
                  onChange={(e) => setWeight(e.target.value)}
                />
              </label>
            </>
          )}
          <div className="player-tracking-actions">
            <button className="primary-button" disabled={busy}>
              <Save size={16} /> Save
            </button>
            <button
              className="icon-button"
              type="button"
              title="Cancel entry"
              aria-label="Cancel entry"
              onClick={() => setKind(null)}
            >
              <X size={16} />
            </button>
          </div>
        </form>
      )}
      {goals.map((g) => (
        <div className="player-access-row" key={g.id}>
          <button
            className="text-button"
            disabled={busy || !caps.canUpdateOwnGoals}
            onClick={() => {
              setKind("goal");
              setId(g.id);
              setTitle(g.title);
              setCompleted(Boolean(g.completed));
            }}
          >
            {g.title}
            {g.completed ? " (completed)" : ""}
          </button>
          {caps.canDeleteOwnGoals && (
            <button
              className="icon-button"
              disabled={busy}
              aria-label={`Delete goal ${g.title}`}
              title="Delete personal goal"
              onClick={() => {
                if (confirm("Delete your personal goal?"))
                  void submit("delete", "goal", g.id);
              }}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      ))}
      {weights.map((w) => (
        <div className="player-access-row" key={w.id}>
          <button
            className="text-button"
            disabled={busy || !caps.canUpdateOwnBodyWeight}
            onClick={() => {
              setKind("body_weight");
              setId(w.id);
              setDate(w.date);
              setWeight(String(w.bodyWeight ?? ""));
            }}
          >
            {w.date} · {w.bodyWeight ?? "—"} lb
          </button>
          {caps.canDeleteOwnBodyWeight && (
            <button
              className="icon-button"
              disabled={busy}
              aria-label={`Delete body weight ${w.date}`}
              title="Delete personal body weight"
              onClick={() => {
                if (confirm("Delete your personal body-weight entry?"))
                  void submit("delete", "body_weight", w.id);
              }}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      ))}
    </section>
  );
}

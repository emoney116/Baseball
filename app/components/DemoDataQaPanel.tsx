"use client";

import { useEffect, useState } from "react";

type Dataset = "hitting" | "pitching" | "defense" | "games" | "weight-room" | "full";
type Volume = "small" | "medium" | "large";
type Status = { id: string; seed_version: string; action: string; status: string; started_at: string; created_counts?: Record<string, number>; deleted_counts?: Record<string, number> } | null;

const DATASETS: Array<{ value: Dataset; label: string }> = [
  { value: "full", label: "Full Demo Set" }, { value: "hitting", label: "Hitting" }, { value: "pitching", label: "Pitching" },
  { value: "defense", label: "Defense" }, { value: "games", label: "Games" }, { value: "weight-room", label: "Weight Room" },
];

export function DemoDataQaPanel() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [dataset, setDataset] = useState<Dataset>("full");
  const [volume, setVolume] = useState<Volume>("medium");
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [pending, setPending] = useState<"seed" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    const response = await fetch("/api/internal/demo-data", { credentials: "include" });
    if (!response.ok) { setAuthorized(false); return; }
    const payload = await response.json() as { status?: Status };
    setStatus(payload.status ?? null);
    setAuthorized(true);
  };

  useEffect(() => {
    const task = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(task);
  }, []);
  if (authorized !== true) return null;

  async function run(action: "seed" | "delete") {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/internal/demo-data", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, dataset, volume, replaceExisting, confirmed: true }) });
      const payload = await response.json() as { message?: string; runId?: string };
      if (!response.ok) throw new Error(payload.message ?? "Unable to update demo data.");
      setMessage(`${action === "seed" ? "Demo data seeded" : "Demo data deleted"}. Run ${payload.runId ?? "completed"}.`);
      setPending(null);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update demo data.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="panel demo-data-qa-panel">
      <div className="panel-heading tight"><div><span>Developer / QA</span><h2>Demo Data</h2></div></div>
      <div className="demo-data-qa-panel__grid">
        <label><span>Team</span><select value="Metrolina Varsity" disabled><option>Metrolina Varsity</option></select></label>
        <label><span>Season</span><select value="Fall 2026" disabled><option>Fall 2026</option></select></label>
        <label><span>Dataset</span><select value={dataset} onChange={(event) => setDataset(event.target.value as Dataset)}>{DATASETS.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
      </div>
      <div className="demo-data-qa-panel__volume"><span>Volume</span><div role="group" aria-label="Demo data volume">{(["small", "medium", "large"] as Volume[]).map((item) => <button key={item} type="button" className={volume === item ? "active" : ""} onClick={() => setVolume(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div></div>
      <label className="demo-data-qa-panel__check"><input type="checkbox" checked={replaceExisting} onChange={(event) => setReplaceExisting(event.target.checked)} /> Remove existing v1 demo data before seeding</label>
      <div className="demo-data-qa-panel__status">{status ? <><span>v{status.seed_version.replace(/^v/, "")} · {status.action} · {status.status}</span><small>Run {status.id.slice(0, 8)} · {new Date(status.started_at).toLocaleString()}</small>{Object.keys(status.created_counts ?? status.deleted_counts ?? {}).length > 0 && <em>{Object.entries(status.created_counts ?? status.deleted_counts ?? {}).map(([key, count]) => `${key}: ${count}`).join(" · ")}</em>}</> : <><span>v1 · no demo seed run</span><small>Demo records have not been created for this target.</small></>}</div>
      {pending && <div className="demo-data-qa-panel__confirm"><strong>{pending === "seed" ? "Create Clubhouse demo data for Metrolina Varsity · Fall 2026?" : "Delete only demo-seeded data?"}</strong><div><button className="secondary-button" type="button" onClick={() => setPending(null)} disabled={busy}>Cancel</button><button className={pending === "delete" ? "danger-button" : "primary-button"} type="button" onClick={() => void run(pending)} disabled={busy}>{busy ? "Working..." : "Confirm"}</button></div></div>}
      {!pending && <div className="demo-data-qa-panel__actions"><button className="secondary-button" type="button" onClick={() => setPending("delete")} disabled={busy}>Delete Demo Data</button><button className="primary-button" type="button" onClick={() => setPending("seed")} disabled={busy}>Seed Demo Data</button></div>}
      {message && <p className="demo-data-qa-panel__message">{message}</p>}
    </article>
  );
}

"use client";

import { ArrowDown, ArrowUp, Edit3, Plus, Trash2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import type { Practice } from "../types";
import { validatePlanItems, type PracticePlanItem } from "../lib/practicePlan";

export type PlanResponse = { items: PracticePlanItem[]; revision?: number; warnings?: string[] };
export type PlanRequest = (method: "GET" | "POST", body?: Record<string, unknown>) => Promise<PlanResponse>;
export function PracticeTeamPlan({ practice, teamId, canManage = false, request: fixtureRequest }: { practice: Practice; teamId?: string; canManage?: boolean; request?: PlanRequest }) {
  const [localPlan, setPublished] = useState(practice.teamPlan ?? []);
  const [revision, setRevision] = useState(practice.teamPlanRevision ?? 0);
  const published = (practice.teamPlanRevision ?? 0) > revision ? practice.teamPlan ?? [] : localPlan;
  const [draft, setDraft] = useState<PracticePlanItem[]>([]);
  const [screen, setScreen] = useState<"import" | "review">("import");
  const [text, setText] = useState("");
  const [image, setImage] = useState<string>();
  const [fileName, setFileName] = useState("");
  const [mode, setMode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [editing, setEditing] = useState<string>();
  const dialog = useRef<HTMLDialogElement>(null);
  const generation = useRef(0);
  const request: PlanRequest = fixtureRequest ?? (async (method, body) => {
    const result = await fetch(`/api/practice-plan${method === "GET" ? `?practiceId=${encodeURIComponent(practice.id)}` : ""}`, { method, credentials: "include", headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify({ ...body, practiceId: practice.id, teamId }) } : {}) });
    const payload = await result.json();
    if (!result.ok) throw new Error(payload.message ?? "Unable to load plan.");
    return payload;
  });
  async function open(importing: boolean) {
    setError(""); setText(""); setImage(undefined); setFileName(""); setWarnings([]); setEditing(undefined);
    setScreen(importing ? "import" : "review"); setDraft(importing ? [] : published); setMode(importing && published.length ? "" : "replace");
    dialog.current?.showModal(); setBusy(true);
    const token = ++generation.current;
    try {
      const current = await request("GET");
      if (token !== generation.current) return;
      setPublished(current.items); setRevision(current.revision ?? 0);
      setDraft(importing ? [] : current.items); setMode(importing && current.items.length ? "" : "replace");
    } catch (e) { setError(e instanceof Error ? e.message : "Plan unavailable."); }
    finally { if (token === generation.current) setBusy(false); }
  }
  function close() { generation.current++; dialog.current?.close(); setImage(undefined); setText(""); setDraft([]); setBusy(false); }
  async function parse() {
    setBusy(true); setError(""); const token = ++generation.current;
    try {
      const result = await request("POST", { action: "extract", ...(image ? { image } : { text }) });
      if (token !== generation.current) return;
      setDraft(result.items); setWarnings(result.warnings ?? []); setScreen("review");
    } catch (e) { setError(e instanceof Error ? e.message : "Import failed."); }
    finally { if (token === generation.current) setBusy(false); }
  }
  async function publish() {
    setError(""); setBusy(true);
    try {
      const items = validatePlanItems(draft);
      const result = await request("POST", { action: "publish", items, mode, revision });
      setPublished(result.items); setRevision(result.revision ?? revision + 1); close();
    } catch (e) { setError(e instanceof Error ? e.message : "Publish failed."); }
    finally { setBusy(false); }
  }
  function update(id: string, value: Partial<PracticePlanItem>) { setDraft(rows => rows.map(r => r.id === id ? { ...r, ...value } : r)); }
  function move(index: number, offset: number) { setDraft(rows => { const next = [...rows]; [next[index], next[index + offset]] = [next[index + offset], next[index]]; return next; }); }
  return <section className="practice-team-plan" aria-label="Team Plan">
    <header className="panel-heading tight"><h2>Team Plan</h2>{canManage && <div className="plan-actions">
      <button className="icon-button" title="Edit Plan" aria-label="Edit Plan" onClick={() => void open(false)}><Edit3 size={16} /></button>
      <button className="secondary-button" onClick={() => void open(true)}><Upload size={16} />Import Plan</button>
    </div>}</header>
    {published.length ? <ol className="team-plan-schedule">{published.map(row => <li key={row.id}><time>{row.timeLabel ?? ""}</time><div><strong>{row.activity}</strong>{row.shortDetail && <small>{row.shortDetail}</small>}</div></li>)}</ol> : <p className="muted">No plan published.</p>}
    {canManage && <dialog ref={dialog} className="plan-dialog" aria-labelledby="plan-dialog-title" onCancel={e => { e.preventDefault(); if (!busy) close(); }}>
      <header><h2 id="plan-dialog-title">{screen === "import" ? "Import Practice Plan" : "Review Practice Plan"}</h2><button className="icon-button" aria-label="Close plan review" disabled={busy} onClick={close}><X size={18} /></button></header>
      <div className="plan-dialog-body">
        {screen === "import" ? <>
          <label>Screenshot / Photo<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={async e => {
            const file = e.target.files?.[0]; setImage(undefined); setFileName(""); setError("");
            if (!file) return;
            if (file.size > 2 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) { setError("Choose a PNG, JPEG or WebP image under 2 MB."); return; }
            const reader = new FileReader(); reader.onload = () => { setImage(String(reader.result)); setFileName(file.name); setText(""); }; reader.onerror = () => setError("Unable to read image."); reader.readAsDataURL(file);
          }} /></label>
          {fileName && <p>{fileName}<button className="icon-button" aria-label="Remove image" onClick={() => { setImage(undefined); setFileName(""); }}><X size={14} /></button></p>}
          <label>Paste Text<textarea aria-label="Practice message" maxLength={12000} rows={8} value={text} disabled={busy || Boolean(image)} onChange={e => setText(e.target.value)} /></label>
        </> : <>
          {warnings.map(w => <p className="muted" key={w}>{w}</p>)}
          <ol className="plan-review-list">{draft.map((row, index) => <li key={row.id}>
            <button className="plan-row-summary" onClick={() => setEditing(editing === row.id ? undefined : row.id)} aria-expanded={editing === row.id}><time>{row.timeLabel ?? "Time not found"}</time><span><strong>{row.activity || "New activity"}</strong>{row.shortDetail && <small>{row.shortDetail}</small>}</span></button>
            {editing === row.id && <div className="plan-actions"><button className="icon-button" aria-label={`Move ${row.activity || "row"} up`} title="Move up" disabled={busy || index === 0} onClick={() => move(index, -1)}><ArrowUp size={16} /></button><button className="icon-button" aria-label={`Move ${row.activity || "row"} down`} title="Move down" disabled={busy || index === draft.length - 1} onClick={() => move(index, 1)}><ArrowDown size={16} /></button><button className="icon-button" aria-label={`Delete ${row.activity || "row"}`} title="Delete row" disabled={busy} onClick={() => setDraft(rows => rows.filter(r => r.id !== row.id))}><Trash2 size={16} /></button></div>}
            {editing === row.id && <div className="plan-row-fields"><label>Time<input aria-label="Row time" value={row.timeLabel ?? ""} maxLength={40} onChange={e => update(row.id, { timeLabel: e.target.value || null })} /></label><label>Activity<input aria-label="Row activity" value={row.activity} maxLength={48} onChange={e => update(row.id, { activity: e.target.value })} /></label><label>Short Detail<input aria-label="Row short detail" value={row.shortDetail ?? ""} maxLength={64} onChange={e => update(row.id, { shortDetail: e.target.value || null })} /></label></div>}
          </li>)}</ol>
          <button className="secondary-button" disabled={busy || draft.length >= 30} onClick={() => { const id = crypto.randomUUID(); setDraft(rows => [...rows, { id, timeLabel: null, activity: "", shortDetail: null }]); setEditing(id); }}><Plus size={16} />Add Row</button>
          {published.length > 0 && <label className="plan-publish-mode">Existing Plan<select aria-label="Publish mode" value={mode} onChange={e => setMode(e.target.value)} disabled={busy}><option value="" disabled>Choose...</option><option value="replace">Replace Existing</option><option value="merge">Merge</option></select></label>}
        </>}
        {error && <p role="alert">{error}</p>}{busy && <p role="status">{screen === "import" ? "Processing..." : "Saving..."}</p>}
      </div>
      <footer><button className="secondary-button" disabled={busy} onClick={close}>Cancel</button>{screen === "review" && <button className="text-button" disabled={busy} onClick={() => { setScreen("import"); setError(""); }}>Re-import</button>}<button className="primary-button" disabled={busy || (screen === "import" ? !text.trim() && !image : !mode)} onClick={() => void (screen === "import" ? parse() : publish())}>{screen === "import" ? "Extract Plan" : "Publish Plan"}</button></footer>
    </dialog>}
  </section>;
}

"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Square } from "lucide-react";
import { LiveEntryForm, LiveHttpError, type LiveSubmission } from "./PlayerLiveEntry";
import { LIVE_FIELDS, type PlayerLiveEntry } from "../lib/playerLiveModels";
import { PERSONAL_DOMAINS, PERSONAL_TITLES, personalCapability, type PersonalDomain, type PersonalSession } from "../lib/playerPersonalModels";
import type { EffectivePlayerAccess } from "../lib/playerCapabilities";

export type PersonalState = { sessions: PersonalSession[]; entries: PlayerLiveEntry[]; access: EffectivePlayerAccess };
export type PersonalTransport = { load: () => Promise<PersonalState>; save: (body: Record<string, unknown>) => Promise<{ id: string }> };
async function decode(response: Response) {
  const value = await response.json();
  if (!response.ok) throw new LiveHttpError(value.message ?? "Unable to load personal sessions.", response.status);
  return value;
}
export function PlayerPersonalSessions({ membershipId, onSaved, transport }: { membershipId: string; onSaved: () => void; transport?: PersonalTransport }) {
  const [state, setState] = useState<PersonalState>();
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0), saving = useRef(false);
  const pendingStart = useRef<{ sessionId: string; domain: PersonalDomain } | undefined>(undefined);
  const refresh = useCallback(async () => {
    const sequence = ++generation.current;
    try {
      const next = transport ? await transport.load() : await decode(await fetch(`/api/player/personal?${new URLSearchParams({ membershipId })}`, { cache: "no-store" }));
      if (sequence === generation.current) { setState(next); setError(""); }
    } catch (e) { if (sequence === generation.current) { setState(undefined); setError(e instanceof Error ? e.message : "Unable to verify personal access."); } }
  }, [membershipId, transport]);
  useEffect(() => {
    const requestGeneration = generation;
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 5000);
    window.addEventListener("focus", refresh);
    return () => { requestGeneration.current++; clearTimeout(initial); clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [refresh]);
  async function post(body: Record<string, unknown>) {
    try {
      const result = transport ? await transport.save(body) : await decode(await fetch("/api/player/personal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, membershipId }) }));
      await refresh(); onSaved(); return result;
    } catch (e) { if (e instanceof LiveHttpError) await refresh(); throw e; }
  }
  async function manage(domain: PersonalDomain, sessionId?: string) {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError("");
    try {
      if (!sessionId && (!pendingStart.current || pendingStart.current.domain !== domain)) pendingStart.current = { sessionId: crypto.randomUUID(), domain };
      const result = await post({ domain, sessionId: sessionId ?? pendingStart.current!.sessionId, operation: sessionId ? "end" : "start" });
      pendingStart.current = undefined; setSelected(result.id);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save session."); if (e instanceof LiveHttpError) pendingStart.current = undefined; }
    finally { saving.current = false; setBusy(false); }
  }
  const active = state?.sessions.find(s => s.id === selected && !s.endedAt);
  return <section className="player-live-section" aria-label="Personal sessions">
    {error && <p role="alert">{error}</p>}
    {state && PERSONAL_DOMAINS.some(d => state.access.capabilities[personalCapability(d)]) && <>
      <h2>Personal Sessions</h2>
      <div className="player-beta-development">{PERSONAL_DOMAINS.filter(d => state.access.capabilities[personalCapability(d)]).map(domain => {
        const existing = state.sessions.find(s => s.domain === domain && !s.endedAt);
        return <button className="secondary-button" key={domain} disabled={busy} onClick={() => existing ? setSelected(existing.id) : void manage(domain)}><Plus size={16}/>{existing ? "Continue" : "Start"} {PERSONAL_TITLES[domain]}</button>;
      })}</div>
    </>}
    {active && state && state.access.capabilities[personalCapability(active.domain)] && <>
      <div className="player-home-heading"><h3>{PERSONAL_TITLES[active.domain]}</h3><button className="secondary-button" disabled={busy} onClick={() => void manage(active.domain, active.id)}><Square size={16}/>End Session</button></div>
      <LiveEntryForm key={active.id} session={{ ...active, title: PERSONAL_TITLES[active.domain], station: "Personal Session", fields: LIVE_FIELDS[active.domain].map(f => f.key) }} membershipId={membershipId} entries={state.entries.filter(e => e.sessionId === active.id)} save={(body: LiveSubmission) => post(body)} />
    </>}
  </section>;
}

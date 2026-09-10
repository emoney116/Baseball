"use client";
import { useMemo, useRef, useState } from "react";
import { PlayerPersonalSessions, type PersonalTransport } from "../components/PlayerPersonalSessions";
import { LiveHttpError } from "../components/PlayerLiveEntry";
import { resolvePlayerCapabilities, PLAYER_ACCESS_MODES, PLAYER_MODE_DETAILS, PLAYER_TRACKING_POLICIES, PLAYER_TRACKING_LABELS, type PlayerAccessMode, type PlayerTrackingPolicy } from "../lib/playerCapabilities";
import type { PersonalSession } from "../lib/playerPersonalModels";
import type { PlayerLiveEntry } from "../lib/playerLiveModels";

export function PersonalPreview() {
  const [mode, setMode] = useState<PlayerAccessMode>("TRACK_AND_VIEW");
  const [policy, setPolicy] = useState<PlayerTrackingPolicy>("PERSONAL_AND_LIVE");
  const records = useRef<{ sessions: PersonalSession[]; entries: PlayerLiveEntry[]; receipts: Map<string, string> }>({ sessions: [], entries: [], receipts: new Map() });
  const transport = useMemo<PersonalTransport>(() => ({
    load: async () => ({ ...records.current, access: resolvePlayerCapabilities({ approved: true, teamDefault: mode, trackingPolicy: policy }) }),
    save: async body => {
      if (mode === "VIEW_ONLY" || policy === "LIVE_ONLY") throw new LiveHttpError("Personal sessions are not permitted.", 403);
      const id = String(body.sessionId);
      const prior = records.current.sessions.find(s => s.id === id);
      if (body.operation === "start") {
        if (!prior) records.current.sessions.unshift({ id, domain: body.domain as PersonalSession["domain"], startedAt: new Date().toISOString() });
        return { id };
      }
      if (!prior || prior.endedAt) throw new LiveHttpError("Personal session ended.", 409);
      if (body.operation === "end") { prior.endedAt = new Date().toISOString(); return { id }; }
      const request = String(body.requestId);
      const receipt = records.current.receipts.get(request);
      if (receipt) return { id: receipt };
      const entry = String(body.entryId ?? crypto.randomUUID());
      records.current.entries = records.current.entries.filter(e => e.id !== entry);
      if (body.operation !== "delete") records.current.entries.unshift({ id: entry, sessionId: id, domain: prior.domain, editable: true, createdAt: new Date().toISOString(), payload: body.payload as Record<string, unknown> });
      records.current.receipts.set(request, entry);
      return { id: entry };
    },
  }), [mode, policy]);
  return <main className="player-beta">
    <h1>Personal Session QA</h1>
    <div className="live-qa-controls">
      <label>Access Mode<select value={mode} onChange={e => setMode(e.target.value as PlayerAccessMode)}>{PLAYER_ACCESS_MODES.map(m => <option key={m} value={m}>{PLAYER_MODE_DETAILS[m].label}</option>)}</select></label>
      <label>Tracking Policy<select value={policy} onChange={e => setPolicy(e.target.value as PlayerTrackingPolicy)}>{PLAYER_TRACKING_POLICIES.map(p => <option key={p} value={p}>{PLAYER_TRACKING_LABELS[p]}</option>)}</select></label>
    </div>
    <PlayerPersonalSessions membershipId="fixture" onSaved={() => {}} transport={transport}/>
  </main>;
}

"use client";
import { useCallback, useEffect, useState } from "react";
import { Mail, RefreshCw, X } from "lucide-react";

export type InvitationRosterEntry = { membershipId: string; playerId: string; name: string; linked: boolean };
type Invite = { id: string; player_id: string; membership_id: string; invited_email: string; status: string; expires_at: string };
export type PlayerInvitationData = { roster: InvitationRosterEntry[]; invitations: Invite[] };

export function usePlayerInvitationRoster(teamId?: string, seasonId?: string, previewData?: PlayerInvitationData) {
  const [data, setData] = useState<PlayerInvitationData>();
  const [error, setError] = useState("");
  const load = useCallback(async (signal?: AbortSignal) => {
    if (!teamId || !seasonId || previewData) return;
    const r = await fetch(`/api/player-invitations?${new URLSearchParams({ teamId, seasonId })}`, { signal, cache: "no-store" });
    const p = await r.json();
    if (!r.ok) throw new Error(p.message ?? "Unable to load player invitations.");
    return p as PlayerInvitationData;
  }, [teamId, seasonId, previewData]);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).then(p => {
      if (controller.signal.aborted) return;
      if (p) setData(p);
      setError("");
    }).catch(e => {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Unable to load player invitations.");
    });
    return () => controller.abort();
  }, [load]);
  async function reload() {
    const p = await load();
    if (p) setData(p);
    setError("");
  }
  return { data: previewData ?? data, error, reload };
}

export function PlayerInvitationsPanel({ teamId, seasonId, player, data, onChanged, preview = false }: {
  teamId: string;
  seasonId: string;
  player: InvitationRosterEntry;
  data: PlayerInvitationData;
  onChanged: () => Promise<void>;
  preview?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const invitations = data.invitations.filter(i => i.player_id === player.playerId);
  async function submit(body: object) {
    if (preview) return;
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/player-invitations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, seasonId, ...body }),
      });
      const p = await r.json();
      if (!r.ok) throw new Error(p.message);
      const result = p.results?.[0];
      setMessage(result?.message ?? result?.email?.message ?? (result?.email?.sent ? "Invitation sent." : p.email?.message ?? "Invitation updated."));
      await onChanged();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to update invitation.");
    } finally { setBusy(false); }
  }
  return <section className="player-invite-single" aria-label={`Invite ${player.name}`}>
    <p><strong>{player.name}</strong></p>
    {player.linked ? <p>This player already has an approved account.</p> :
      <form onSubmit={e => {
        e.preventDefault();
        void submit({ entries: [{ membershipId: player.membershipId, email: email.trim() }] });
      }}>
        <label>Player email<input type="email" required maxLength={254} autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /></label>
        <button className="primary-button" type="submit" disabled={preview || busy || !email.trim()}><Mail size={16} aria-hidden="true" />{busy ? "Sending..." : "Send Invitation"}</button>
      </form>}
    {invitations.map(i => <div className="player-invite-history-row" key={i.id}>
      <div><strong>{i.invited_email}</strong><small>{i.status === "PENDING" && new Date(i.expires_at) < new Date() ? "EXPIRED" : i.status}</small></div>
      {i.status === "PENDING" && <span className="row-action-group">
        <button className="icon-button" type="button" title="Resend Invitation" aria-label={`Resend invitation to ${i.invited_email}`} disabled={preview || busy || player.linked} onClick={() => void submit({ id: i.id, action: "resend" })}><RefreshCw size={16} /></button>
        <button className="icon-button" type="button" title="Revoke Invitation" aria-label={`Revoke invitation to ${i.invited_email}`} disabled={preview || busy} onClick={() => void submit({ id: i.id, action: "revoke" })}><X size={16} /></button>
      </span>}
    </div>)}
    {message && <p role="status">{message}</p>}
  </section>;
}

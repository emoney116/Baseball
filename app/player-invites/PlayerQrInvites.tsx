"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { ChevronLeft, Copy, Printer, QrCode, RefreshCw, X } from "lucide-react";
import { usePlayerInvitationRoster } from "../components/PlayerInvitationsPanel";
import "./invites.css";

export default function PlayerQrInvites() {
  const params = useSearchParams(), teamId = params.get("team") ?? "", seasonId = params.get("season") ?? "";
  const { data, error, reload } = usePlayerInvitationRoster(teamId, seasonId);
  const [links, setLinks] = useState<Record<string, { id: string; url: string }>>({});
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const roster = [...(data?.roster ?? [])].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const latest = (membershipId: string) => data?.invitations.find(i => i.membership_id === membershipId && i.delivery_mode === "QR");
  const visibleLinks = roster.filter(p => !p.linked && links[p.membershipId]?.id === latest(p.membershipId)?.id && latest(p.membershipId)?.status === "PENDING" && new Date(latest(p.membershipId)!.expires_at) > new Date());
  const missing = roster.filter(p => !p.linked && latest(p.membershipId)?.status !== "ACCEPTED" && !visibleLinks.some(visible => visible.membershipId === p.membershipId));
  const regenerating = missing.some(p => latest(p.membershipId)?.status === "PENDING");
  async function update(body: object, membershipId?: string, remaining: { body: object; membershipId: string }[] = []) {
    setBusy(true); setMessage("");
    try {
      const messages: string[] = [];
      for (const job of [{ body, membershipId }, ...remaining]) {
      const response = await fetch("/api/player-invitations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamId, seasonId, ...job.body }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Unable to update invitations.");
      const results = result.results ?? [{ ...result, membershipId: job.membershipId }];
      setLinks(previous => {
        const next = { ...previous };
        for (const item of results) {
          if (item.url && item.invitation) next[item.membershipId] = { id: item.invitation.id, url: item.url };
          else if (item.invitation?.status === "REVOKED") delete next[item.membershipId];
        }
        return next;
      });
      messages.push(...results.map((r: { message?: string }) => r.message).filter(Boolean));
      }
      setMessage(messages.join(" ") || "Invitations updated. No emails were sent.");
      await reload();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to update invitations."); }
    finally { setBusy(false); }
  }
  return <main className="qr-invites">
    <header className="qr-invites-header">
      <a className="icon-button" aria-label="Back to roster" href={`/?view=roster&team=${encodeURIComponent(teamId)}&season=${encodeURIComponent(seasonId)}`}><ChevronLeft size={20} /></a>
      <div><h1>Player Invites</h1><p>{data?.teamName}</p></div>
    </header>
    <div className="qr-invites-controls">
      <div className="section-actions">
        <button className="primary-button" disabled={busy || !missing.length} onClick={() => {
          if (!window.confirm(`Prepare ${missing.length} QR codes for ${data?.teamName}? ${regenerating ? "Previous codes for these players will stop working. " : ""}No emails will be sent.`)) return;
          const jobs = missing.map(p => {
            const invite = latest(p.membershipId);
            return { membershipId: p.membershipId, body: invite?.status === "PENDING"
              ? { action: "resend", id: invite.id }
              : { action: "generate-qr", entries: [{ membershipId: p.membershipId }] } };
          });
          if (jobs.length) void update(jobs[0].body, jobs[0].membershipId, jobs.slice(1));
        }}><QrCode size={16} /> {regenerating ? "Regenerate Missing QR Codes" : "Generate Missing Invites"}</button>
        <button className="secondary-button" disabled={busy || !visibleLinks.length} onClick={() => window.print()}><Printer size={16} /> Print QR Sheet</button>
        <button className="icon-button" aria-label="Refresh connection status" title="Refresh connection status" disabled={busy} onClick={() => void reload().catch(() => setMessage("Unable to refresh status."))}><RefreshCw size={16} /></button>
      </div>
      {(error || message) && <p role="status">{error || message}</p>}
    </div>
    <div className="qr-invite-grid">
      {roster.map(player => {
        const invite = latest(player.membershipId), expired = invite && new Date(invite.expires_at) <= new Date();
        const status = player.linked ? "Connected" : invite?.status === "ACCEPTED" ? "Claimed" : invite?.status === "REVOKED" ? "Revoked" : expired ? "Expired" : invite ? "Ready" : "Not Invited";
        const link = visibleLinks.some(p => p.membershipId === player.membershipId) ? links[player.membershipId] : undefined;
        return <article key={player.membershipId} className={`qr-invite-card${link ? " qr-printable" : ""}`}>
          <small>{data?.teamName} · Clubhouse 9</small><h2>{player.name}</h2><span className="qr-invite-status">{status}</span>
          {link && <><QRCodeSVG value={link.url} size={192} level="M" marginSize={4} title={`Invitation for ${player.name}`} /><p>Scan to join Clubhouse 9</p></>}
          {!player.linked && invite?.status !== "ACCEPTED" && <div className="qr-card-actions">
            {link && <button className="icon-button" aria-label={`Copy invite for ${player.name}`} title="Copy private invite link" onClick={() => void navigator.clipboard.writeText(link.url).then(() => setMessage("Private invite link copied.")).catch(() => setMessage("Unable to copy. Print the QR instead."))}><Copy size={16} /></button>}
            <button className="secondary-button" disabled={busy} onClick={() => {
              if (invite?.status === "PENDING") {
                if (window.confirm(`Invalidate the previous QR and generate a new one for ${player.name}?`)) void update({ action: "resend", id: invite.id }, player.membershipId);
              } else void update({ action: "generate-qr", entries: [{ membershipId: player.membershipId }] });
            }}><QrCode size={16} />{invite?.status === "PENDING" ? "Regenerate QR" : "Generate QR"}</button>
            {invite?.status === "PENDING" && <button className="icon-button" disabled={busy} aria-label={`Revoke invite for ${player.name}`} title="Revoke invitation" onClick={() => {
              if (window.confirm(`Revoke the invitation for ${player.name}?`)) void update({ action: "revoke", id: invite.id }, player.membershipId);
            }}><X size={16} /></button>}
          </div>}
        </article>;
      })}
    </div>
  </main>;
}

"use client";
import { useCallback, useEffect, useState } from "react";
import { Mail, RefreshCw, X } from "lucide-react";
type RosterEntry = { membershipId: string; name: string };
type Invite = {
  id: string;
  membership_id: string;
  invited_email: string;
  status: string;
  expires_at: string;
};
export function PlayerInvitationsPanel({
  teamId,
  seasonId,
}: {
  teamId: string;
  seasonId: string;
}) {
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({}),
    [selected, setSelected] = useState<string[]>([]),
    [invites, setInvites] = useState<Invite[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const r = await fetch(
      `/api/player-invitations?teamId=${encodeURIComponent(teamId)}&seasonId=${encodeURIComponent(seasonId)}`,
    );
    const p = await r.json();
    if (!r.ok) throw new Error(p.message);
    setInvites(p.invitations ?? []);
    setRoster(p.roster ?? []);
  }, [teamId, seasonId]);
  useEffect(() => {
    const controller = new AbortController();
    fetch(
      `/api/player-invitations?teamId=${encodeURIComponent(teamId)}&seasonId=${encodeURIComponent(seasonId)}`,
      { signal: controller.signal },
    )
      .then(async (r) => {
        const p = await r.json();
        if (!r.ok) throw new Error(p.message);
        return p;
      })
      .then((p) => {
        setInvites(p.invitations ?? []);
        setRoster(p.roster ?? []);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setMessage(e.message);
      });
    return () => controller.abort();
  }, [teamId, seasonId]);
  async function submit(body: object) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/player-invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, seasonId, ...body }),
      });
      const p = await r.json();
      if (!r.ok) throw new Error(p.message);
      if (p.results)
        setMessage(
          p.results
            .map(
              (v: {
                membershipId: string;
                message?: string;
                email?: { sent: boolean; message?: string };
              }) =>
                `${roster.find((r) => r.membershipId === v.membershipId)?.name ?? "Player"}: ${v.message ?? (v.email?.sent ? "Invitation sent" : (v.email?.message ?? "Saved"))}`,
            )
            .join("\n"),
        );
      else setMessage(p.email?.message ?? "Invitation updated.");
      await load();
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Unable to update invitations.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="player-invites">
      <h3>Player Invitations</h3>
      <label>
        <input
          type="checkbox"
          checked={roster.length > 0 && selected.length === roster.length}
          onChange={(e) =>
            setSelected(
              e.target.checked ? roster.map((p) => p.membershipId) : [],
            )
          }
        />{" "}
        Select Roster
      </label>
      <div className="player-invites__roster">
        {roster.map((p) => (
          <div key={p.membershipId} className="player-invites__row">
            <label>
              <input
                type="checkbox"
                checked={selected.includes(p.membershipId)}
                onChange={(e) =>
                  setSelected((s) =>
                    e.target.checked
                      ? [...s, p.membershipId]
                      : s.filter((id) => id !== p.membershipId),
                  )
                }
              />
              {p.name}
            </label>
            <input
              type="email"
              aria-label={`${p.name} email`}
              placeholder="Player email"
              value={emails[p.membershipId] ?? ""}
              onChange={(e) =>
                setEmails((s) => ({ ...s, [p.membershipId]: e.target.value }))
              }
            />
          </div>
        ))}
      </div>
      <button
        className="primary-button"
        disabled={
          busy || !selected.length || selected.some((id) => !emails[id])
        }
        onClick={() => {
          if (
            window.confirm(
              `Send ${selected.length} exact-player invitation(s)?`,
            )
          )
            void submit({
              entries: selected.map((membershipId) => ({
                membershipId,
                email: emails[membershipId],
              })),
            });
        }}
      >
        <Mail size={16} /> Send Invitations
      </button>
      <div>
        {invites.map((i) => (
          <div className="player-invites__row" key={i.id}>
            <span>
              {roster.find((r) => r.membershipId === i.membership_id)?.name ??
                "Roster player"}
              <small>
                {i.invited_email} ·{" "}
                {i.status === "PENDING" && new Date(i.expires_at) < new Date()
                  ? "EXPIRED"
                  : i.status}
              </small>
            </span>
            {i.status === "PENDING" && (
              <span>
                <button
                  className="icon-button"
                  title="Resend Invitation"
                  aria-label="Resend Invitation"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Send a new invitation email and expire the previous link?",
                      )
                    )
                      void submit({ id: i.id, action: "resend" });
                  }}
                >
                  <RefreshCw size={16} />
                </button>
                <button
                  className="icon-button"
                  title="Revoke Invitation"
                  aria-label="Revoke Invitation"
                  disabled={busy}
                  onClick={() => void submit({ id: i.id, action: "revoke" })}
                >
                  <X size={16} />
                </button>
              </span>
            )}
          </div>
        ))}
      </div>
      {message && (
        <p role="status" style={{ whiteSpace: "pre-line" }}>
          {message}
        </p>
      )}
    </section>
  );
}

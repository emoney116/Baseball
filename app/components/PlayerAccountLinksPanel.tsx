"use client";

import { Check, ChevronRight, RefreshCw, Search, ShieldCheck, UserCheck, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type ClaimTeam = {
  organizationId: string;
  organizationName: string;
  teamId: string;
  teamName: string;
  seasonId: string;
  seasonName: string;
  teamLevel?: string;
};

type ClaimPlayer = {
  playerId: string;
  membershipId: string;
  teamId: string;
  seasonId: string;
  name: string;
  jerseyNumber?: number;
  graduationYear?: number;
  primaryPosition?: string;
};

type PlayerLink = {
  id: string;
  playerId: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "REVOKED";
  requestedAt: string;
  teamName: string;
  seasonName: string;
  player: ClaimPlayer;
  claimant?: { displayName?: string; email?: string };
};

type ApiResult<T> = T & { ok: boolean; message?: string };

async function readJson<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, { credentials: "include", ...init });
  const payload = await response.json().catch(() => ({})) as ApiResult<T>;
  if (!response.ok || !payload.ok) throw new Error(payload.message ?? "That request could not be completed.");
  return payload;
}

function playerContext(player: ClaimPlayer, teamName?: string, seasonName?: string) {
  const identity = [player.jerseyNumber !== undefined ? `#${player.jerseyNumber}` : undefined, player.name].filter(Boolean).join(" ");
  const details = [teamName, seasonName, player.graduationYear ? `Class of ${player.graduationYear}` : undefined, player.primaryPosition].filter(Boolean).join(" · ");
  return { identity, details };
}

function StatusPill({ status }: { status: PlayerLink["status"] }) {
  const label = status === "PENDING" ? "Request pending" : status === "APPROVED" ? "Linked" : status === "REJECTED" ? "Not approved" : "Revoked";
  return <span className={`player-link-status player-link-status--${status.toLowerCase()}`}>{label}</span>;
}

export function PlayerAccountLinksPanel() {
  const [links, setLinks] = useState<PlayerLink[]>([]);
  const [teams, setTeams] = useState<ClaimTeam[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<ClaimTeam | null>(null);
  const [players, setPlayers] = useState<ClaimPlayer[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<ClaimPlayer | null>(null);
  const [teamQuery, setTeamQuery] = useState("");
  const [playerQuery, setPlayerQuery] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "submitting" | "error">("loading");
  const [message, setMessage] = useState("");
  const [activeLinkId, setActiveLinkId] = useState<string | null>(null);

  const refreshLinks = useCallback(async () => {
    const payload = await readJson<{ links: PlayerLink[] }>("/api/player-links");
    setLinks(payload.links ?? []);
  }, []);

  const searchTeams = useCallback(async (query = teamQuery) => {
    setStatus("loading");
    setMessage("");
    try {
      const payload = await readJson<{ teams: ClaimTeam[] }>(`/api/player-links/discovery?kind=teams&q=${encodeURIComponent(query)}`);
      setTeams(payload.teams ?? []);
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Team search is unavailable.");
    }
  }, [teamQuery]);

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      try {
        const [linkPayload, teamPayload] = await Promise.all([
          readJson<{ links: PlayerLink[] }>("/api/player-links"),
          readJson<{ teams: ClaimTeam[] }>("/api/player-links/discovery?kind=teams&q="),
        ]);
        if (cancelled) return;
        setLinks(linkPayload.links ?? []);
        setTeams(teamPayload.teams ?? []);
        setStatus("idle");
      } catch (error) {
        if (cancelled) return;
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Player access is unavailable.");
      }
    }
    void hydrate();
    return () => { cancelled = true; };
  }, []);

  const searchPlayers = useCallback(async (team: ClaimTeam, query = playerQuery) => {
    setStatus("loading");
    setMessage("");
    try {
      const params = new URLSearchParams({ kind: "players", teamId: team.teamId, seasonId: team.seasonId, q: query });
      const payload = await readJson<{ players: ClaimPlayer[] }>(`/api/player-links/discovery?${params.toString()}`);
      setPlayers(payload.players ?? []);
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Roster search is unavailable.");
    }
  }, [playerQuery]);

  const approvedLinks = useMemo(() => links.filter((link) => link.status === "APPROVED"), [links]);
  const openClaims = useMemo(() => links.filter((link) => link.status !== "APPROVED"), [links]);

  async function chooseTeam(team: ClaimTeam) {
    setSelectedTeam(team);
    setSelectedPlayer(null);
    setPlayers([]);
    setPlayerQuery("");
    await searchPlayers(team, "");
  }

  async function submitClaim() {
    if (!selectedTeam || !selectedPlayer) return;
    setStatus("submitting");
    setMessage("");
    try {
      await readJson<{ link: PlayerLink }>("/api/player-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim", teamId: selectedTeam.teamId, seasonId: selectedTeam.seasonId, membershipId: selectedPlayer.membershipId }),
      });
      await refreshLinks();
      setSelectedPlayer(null);
      setMessage("Request sent. A coach must approve it before player access is available.");
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to request player access.");
    }
  }

  async function chooseActiveContext(link: PlayerLink) {
    setStatus("submitting");
    setMessage("");
    try {
      await readJson<{ activePlayerContext: PlayerLink }>("/api/player-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "context", playerId: link.playerId, teamId: link.player.teamId, seasonId: link.player.seasonId }),
      });
      setActiveLinkId(link.id);
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to select player context.");
    }
  }

  return (
    <article className="panel player-account-links-panel">
      <div className="panel-heading tight">
        <div>
          <span>Player access</span>
          <h2>Find Your Team</h2>
        </div>
        <button className="icon-button" type="button" onClick={() => void Promise.all([refreshLinks(), searchTeams(teamQuery)])} aria-label="Refresh player access">
          <RefreshCw size={15} aria-hidden="true" />
        </button>
      </div>

      <div className="player-link-search-step">
        <label className="search-pill">
          <Search size={15} aria-hidden="true" />
          <input value={teamQuery} onChange={(event) => setTeamQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void searchTeams(); }} placeholder="Search organization or team" aria-label="Search for your team" />
        </label>
        <button className="secondary-button" type="button" onClick={() => void searchTeams()} disabled={status === "loading"}>Search</button>
      </div>

      <div className="player-link-team-results" aria-live="polite">
        {teams.slice(0, 6).map((team) => (
          <button className={`player-link-team-option ${selectedTeam?.seasonId === team.seasonId ? "is-selected" : ""}`} type="button" key={`${team.teamId}:${team.seasonId}`} onClick={() => void chooseTeam(team)}>
            <span>
              <strong>{team.teamName}</strong>
              <small>{team.organizationName} · {team.seasonName}</small>
            </span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        ))}
        {!teams.length && status !== "loading" && <p className="player-link-empty">Can&apos;t find your team? Ask your coach for an invite.</p>}
      </div>

      {selectedTeam && (
        <div className="player-link-roster-step">
          <div className="player-link-step-heading">
            <div>
              <span>{selectedTeam.teamName} · {selectedTeam.seasonName}</span>
              <strong>Find yourself</strong>
            </div>
          </div>
          <label className="search-pill">
            <Search size={15} aria-hidden="true" />
            <input value={playerQuery} onChange={(event) => setPlayerQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void searchPlayers(selectedTeam); }} placeholder="Name, jersey, or class" aria-label="Search this roster" />
          </label>
          <div className="player-link-player-results">
            {players.map((player) => {
              const context = playerContext(player, selectedTeam.teamName, selectedTeam.seasonName);
              return (
                <button className={`player-link-player-option ${selectedPlayer?.membershipId === player.membershipId ? "is-selected" : ""}`} type="button" key={player.membershipId} onClick={() => setSelectedPlayer(player)}>
                  <span><strong>{context.identity}</strong><small>{context.details}</small></span>
                  {selectedPlayer?.membershipId === player.membershipId ? <Check size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
                </button>
              );
            })}
            {!players.length && status !== "loading" && <p className="player-link-empty">Can&apos;t find yourself? Ask your coach to add you to the roster or send an invite.</p>}
          </div>
        </div>
      )}

      {selectedTeam && selectedPlayer && (
        <div className="player-link-confirmation">
          <ShieldCheck size={17} aria-hidden="true" />
          <div>
            <span>You&apos;re requesting access to</span>
            <strong>{playerContext(selectedPlayer).identity}</strong>
            <small>{selectedTeam.teamName} · {selectedTeam.seasonName}</small>
          </div>
          <button className="primary-button" type="button" onClick={() => void submitClaim()} disabled={status === "submitting"}>{status === "submitting" ? "Requesting..." : "Request Access"}</button>
        </div>
      )}

      {(approvedLinks.length > 0 || openClaims.length > 0) && (
        <div className="player-link-current-links">
          {approvedLinks.length > 0 && <h3>Playing As</h3>}
          {approvedLinks.map((link) => {
            const context = playerContext(link.player, link.teamName, link.seasonName);
            return <button className={`player-link-summary ${activeLinkId === link.id ? "is-active" : ""}`} type="button" key={link.id} onClick={() => void chooseActiveContext(link)}><UserCheck size={16} aria-hidden="true" /><span><strong>{context.identity}</strong><small>{context.details}</small></span>{activeLinkId === link.id ? <Check size={16} aria-label="Active player context" /> : <ChevronRight size={16} aria-hidden="true" />}</button>;
          })}
          {openClaims.map((link) => {
            const context = playerContext(link.player, link.teamName, link.seasonName);
            return <div className="player-link-summary player-link-summary--status" key={link.id}><span><strong>{context.identity}</strong><small>{context.details}</small></span><StatusPill status={link.status} /></div>;
          })}
        </div>
      )}
      {message && <p className={`player-link-message player-link-message--${status}`}>{message}</p>}
    </article>
  );
}

export function TeamPlayerClaimsPanel({ teamId }: { teamId?: string }) {
  const [claims, setClaims] = useState<PlayerLink[]>([]);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!teamId) return;
    try {
      const payload = await readJson<{ claims: PlayerLink[] }>(`/api/player-links/team/${teamId}`);
      setClaims(payload.claims ?? []);
      setAuthorized(true);
    } catch (error) {
      if (error instanceof Error && /authorized|sign in/i.test(error.message)) setAuthorized(false);
      else setMessage(error instanceof Error ? error.message : "Player claims are unavailable.");
    }
  }, [teamId]);

  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;
    async function hydrate() {
      try {
        const payload = await readJson<{ claims: PlayerLink[] }>(`/api/player-links/team/${teamId}`);
        if (cancelled) return;
        setClaims(payload.claims ?? []);
        setAuthorized(true);
      } catch (error) {
        if (cancelled) return;
        if (error instanceof Error && /authorized|sign in/i.test(error.message)) setAuthorized(false);
        else setMessage(error instanceof Error ? error.message : "Player claims are unavailable.");
      }
    }
    void hydrate();
    return () => { cancelled = true; };
  }, [teamId]);
  if (!teamId || authorized === false) return null;
  const pending = claims.filter((claim) => claim.status === "PENDING");
  const completed = claims.filter((claim) => claim.status !== "PENDING");

  async function transition(link: PlayerLink, action: "approve" | "reject" | "revoke") {
    if (!teamId) return;
    setBusyId(link.id);
    setMessage("");
    try {
      await readJson<{ link: PlayerLink }>(`/api/player-links/team/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkId: link.id, action }),
      });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update this claim.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="panel team-player-claims-panel" aria-label="Player access claims">
      <div className="panel-heading tight"><div><span>Player Access</span><h2>Player Claims{pending.length ? ` · ${pending.length}` : ""}</h2></div><Users size={18} aria-hidden="true" /></div>
      {pending.length ? <div className="team-player-claims-list">{pending.map((claim) => <ClaimRow key={claim.id} claim={claim} busy={busyId === claim.id} onAction={transition} />)}</div> : <p className="player-link-empty">No pending player claims for this team.</p>}
      {completed.length > 0 && <details className="team-player-claims-history"><summary>Access history ({completed.length})</summary><div className="team-player-claims-list">{completed.map((claim) => <ClaimRow key={claim.id} claim={claim} busy={busyId === claim.id} onAction={transition} />)}</div></details>}
      {message && <p className="player-link-message player-link-message--error">{message}</p>}
    </section>
  );
}

function ClaimRow({ claim, busy, onAction }: { claim: PlayerLink; busy: boolean; onAction: (link: PlayerLink, action: "approve" | "reject" | "revoke") => Promise<void> }) {
  const context = playerContext(claim.player, claim.teamName, claim.seasonName);
  return <article className="team-player-claim-row"><div><strong>{context.identity}</strong><small>{context.details}</small><small>Requested by {claim.claimant?.displayName ?? "Clubhouse account"}{claim.claimant?.email ? ` · ${claim.claimant.email}` : ""}</small></div>{claim.status === "PENDING" ? <div className="team-player-claim-actions"><button className="secondary-button" type="button" disabled={busy} onClick={() => void onAction(claim, "reject")}>Reject</button><button className="primary-button" type="button" disabled={busy} onClick={() => void onAction(claim, "approve")}>{busy ? "Saving..." : "Approve"}</button></div> : <div className="team-player-claim-actions"><StatusPill status={claim.status} />{claim.status === "APPROVED" && <button className="secondary-button" type="button" disabled={busy} onClick={() => void onAction(claim, "revoke")}>Revoke</button>}</div>}</article>;
}

"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  PlayerLiveEntry,
  type LiveTransport,
} from "../components/PlayerLiveEntry";
import { CoachLiveEntrySettings } from "../components/CoachLiveEntrySettings";
import {
  PLAYER_ACCESS_MODES,
  PLAYER_MODE_DETAILS,
  resolvePlayerCapabilities,
  type PlayerAccessMode,
} from "../lib/playerCapabilities";
import {
  LIVE_FIELDS,
  liveCapability,
  type LiveDomain,
  type PlayerLiveEntry as Entry,
  type PlayerLiveSession,
} from "../lib/playerLiveModels";
const id = (n: number) =>
  `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const sessions: PlayerLiveSession[] = (
  ["hitting", "pitching", "defense", "workout"] as LiveDomain[]
).map((domain, i) => ({
  id: id(80 + i),
  domain,
  title: domain === "workout" ? "Upper Body" : "Varsity Practice",
  station: [
    "Cage 2 · Hitting",
    "Bullpen · Pitching",
    "Infield · Defense",
    "Bench Press",
  ][i],
  startedAt: "2026-09-06T14:00:00.000Z",
  fields: LIVE_FIELDS[domain].map((f) => f.key),
  ...(domain === "workout"
    ? {
        exercise: {
          id: id(92),
          name: "Bench Press",
          sets: 3,
          reps: 5,
          weight: 185,
          measurement: "WEIGHT_REPS",
          unit: "lb",
        },
      }
    : { practiceId: id(60) }),
}));
export function PlayerLivePreview() {
  const [mode, setMode] = useState<PlayerAccessMode>("TRACK_AND_VIEW"),
    [running, setRunning] = useState(false),
    [domain, setDomain] = useState<LiveDomain>("hitting"),
    [approved, setApproved] = useState(true),
    [team, setTeam] = useState("A");
  const current = useRef({ mode, running, approved, team });
  useEffect(() => {
    current.current = { mode, running, approved, team };
  }, [mode, running, approved, team]);
  const entries = useRef<Entry[]>([]),
    receipts = useRef(new Map<string, { id: string }>());
  const transport = useMemo<LiveTransport>(
    () => ({
      load: async () => {
        const c = current.current;
        return {
          sessions: c.approved && c.running && c.team === "A" ? sessions : [],
          entries: entries.current,
          capabilities: resolvePlayerCapabilities({
            approved: c.approved,
            teamDefault: c.mode,
          }).capabilities,
          context: {
            playerId: id(40),
            name: "Jacob Seamon",
            teamName: c.team === "A" ? "Metrolina Varsity" : "Travel Team",
            seasonName: "Fall 2026",
          },
        };
      },
      save: async (body) => {
        const c = current.current;
        if (
          !c.running ||
          !c.approved ||
          c.team !== "A" ||
          !resolvePlayerCapabilities({
            approved: c.approved,
            teamDefault: c.mode,
          }).capabilities[liveCapability(body.domain)]
        )
          throw new Error("Session ended or access changed.");
        const prior = receipts.current.get(body.requestId);
        if (prior) return prior;
        const result = { id: body.entryId ?? crypto.randomUUID() };
        if (body.operation === "delete")
          entries.current = entries.current.filter(
            (e) => e.id !== body.entryId,
          );
        else {
          entries.current = entries.current.filter((e) => e.id !== result.id);
          entries.current.unshift({
            id: result.id,
            sessionId: body.sessionId,
            domain: body.domain,
            payload: body.payload,
            editable: true,
            createdAt: new Date().toISOString(),
          });
        }
        receipts.current.set(body.requestId, result);
        return result;
      },
    }),
    [],
  );
  return (
    <main className="player-beta">
      <h1>Metrolina Varsity</h1>
      <p>Jacob Seamon · Fall 2026</p>
      <div className="live-qa-controls" aria-label="Local QA controls">
        <label>
          Access Mode
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as PlayerAccessMode)}
          >
            {PLAYER_ACCESS_MODES.map((m) => (
              <option value={m} key={m}>
                {PLAYER_MODE_DETAILS[m].label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Domain
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value as LiveDomain)}
          >
            {["hitting", "pitching", "defense", "workout"].map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <label>
          Team
          <select value={team} onChange={(e) => setTeam(e.target.value)}>
            <option>A</option>
            <option>B</option>
          </select>
        </label>
        <button
          className="secondary-button"
          onClick={() => setRunning((v) => !v)}
        >
          {running ? "Coach: End Session" : "Coach: Start Session"}
        </button>
        <button
          className="secondary-button"
          onClick={() => setApproved((v) => !v)}
        >
          {approved ? "Coach: Revoke Link" : "Coach: Approve Link"}
        </button>
      </div>
      <PlayerLiveEntry
        membershipId={id(50)}
        domain={domain}
        transport={transport}
      />
      <section className="player-beta-section">
        <h2>{domain === "workout" ? "Recent Workouts" : "Recent Sessions"}</h2>
        <p>
          Sep 4 ·{" "}
          {domain === "workout"
            ? "Strength · Bench Press 175 lb × 5"
            : "Practice · Personal development"}
        </p>
      </section>
      <section className="player-beta-section">
        <h2>{domain === "workout" ? "Progress" : "My Analytics"}</h2>
        <p>
          {domain === "workout"
            ? "Bench Press · 185 lb · Personal best"
            : "Contact 67% · Average EV 90 mph"}
        </p>
      </section>
      <CoachLiveEntrySettings
        key={domain}
        teamId={id(20)}
        sessionId={sessions.find((s) => s.domain === domain)!.id}
        domain={domain}
        playerName="Jacob Seamon"
        preview
      />
    </main>
  );
}

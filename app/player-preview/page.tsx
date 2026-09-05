import { notFound } from "next/navigation";
import { sampleData } from "../data/sampleData";
import { PlayerShell } from "../components/PlayerShell";
import type { PlayerSession } from "../lib/playerAccess";
export const dynamic = "force-dynamic";
export default function PlayerPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  const p = {
    ...sampleData.players.find(
      (p) => p.id === sampleData.hittingEvents[0]?.hitterId,
    )!,
    notes: undefined,
  };
  const team = {
    teamId: "demo-team",
    seasonId: "demo-season",
    teamName: "Metrolina Varsity",
    seasonName: "Fall 2026",
    organizationId: "demo-org",
    organizationName: "Metrolina Baseball",
    role: "PLAYER" as const,
    active: true,
    logoUrl: "/brand/metrolina-warriors-alpha.png",
  };
  const context = {
    linkId: "demo-link",
    membershipId: "demo-membership",
    playerId: p.id,
    name: p.name,
    jersey: p.jerseyNumber,
    team,
  };
  const data = {
    ...sampleData,
    players: [p],
    teamContext: {
      profile: { id: "demo-profile", role: "PLAYER" as const },
      availableTeams: [team],
      currentTeam: team,
    },
    playerTeamMemberships: [],
    coachNotes: [],
    developmentGoals: [],
    practiceSessionContributors: [],
    hittingEvents: sampleData.hittingEvents.filter((e) => e.hitterId === p.id),
    pitchEvents: sampleData.pitchEvents.filter((e) => e.pitcherId === p.id),
    defenseEvents: sampleData.defenseEvents.filter((e) => e.playerId === p.id),
    hittingSessions: sampleData.hittingSessions.filter(
      (e) => e.hitterId === p.id,
    ),
    pitchingSessions: sampleData.pitchingSessions.filter(
      (e) => e.pitcherId === p.id,
    ),
    defenseSessions: sampleData.defenseSessions.filter(
      (e) => e.playerId === p.id,
    ),
    workoutSessions: sampleData.workoutSessions.filter(
      (e) => e.playerId === p.id,
    ),
    workoutEntries: sampleData.workoutEntries.filter(
      (e) => e.playerId === p.id,
    ),
    gameEvents: [],
    plateAppearances: [],
    games: [],
    scheduleEvents: [],
  };
  const session: PlayerSession = {
    mode: "player",
    contexts: [context],
    context,
    data,
  };
  return <PlayerShell initialSession={session} preview />;
}

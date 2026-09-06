import { notFound } from "next/navigation";
import { sampleData } from "../data/sampleData";
import { PlayerShell } from "../components/PlayerShell";
import type { PlayerSession } from "../lib/playerAccess";
import { isPlayerAccessMode, resolvePlayerCapabilities } from "../lib/playerCapabilities";
import type { AskClubhouseApiResponse } from "../lib/askClubhouse/types";
export const dynamic = "force-dynamic";
export default async function PlayerPreview({ searchParams }: { searchParams: Promise<{ access?: string; askFixture?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const params = await searchParams;
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
    profileId: "demo-profile",
    access: resolvePlayerCapabilities({ approved: true, teamDefault: isPlayerAccessMode(params.access) ? params.access : "VIEW_ONLY" }),
    teamRoster: sampleData.players.slice(0, 8).map(p => ({ playerId: p.id, name: p.name, jersey: p.jerseyNumber, position: p.primaryPosition })),
  };
  const reply: AskClubhouseApiResponse | undefined = params.askFixture ? {
    ok: true, status: "low_sample", conversationId: "local-ask-fixture",
    answer: "Today in practice, you had **4 tracked swings**:\n\n- **Contact:** 1 of 4 (**25%**)\n- **Hard contact:** 1 of 1 (**100%**)\n- **Average exit velocity:** **84.0 mph**\n\nThe sample is very small: four tracked swings.",
    followUps: ["Show me my spray chart."],
    visuals: [{ type: "spray_chart", mode: "spray", title: "My Practice Spray Chart", domain: "hitting", playerId: p.id, query: { mode: "box-score", domain: "hitting", source: "practice", playerIds: [p.id], timeRange: "season" }, sample: "limited", coverage: { label: "Tracked contact", qualifyingEvents: 1, trackedEvents: 1, minimumSample: 10 }, points: [{ id: "local-contact", x: 0.3, y: 0.6 }] }],
    actions: [{ type: "open_analytics", label: "Open Analytics", query: { domain: "hitting", source: "practice", playerIds: [p.id] } }],
  } : undefined;
  return <PlayerShell initialSession={session} preview previewReply={reply} />;
}

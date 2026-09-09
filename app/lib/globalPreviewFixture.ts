import type { AppData, TeamMembershipRole } from "../types";

// Called only inside the existing localhost-only devBypass loader.
export function globalPreviewFixture(base: AppData, rich: boolean, role: string): AppData {
  const now = Date.now();
  const iso = (offset: number) => new Date(now + offset).toISOString();
  const followerOnly = role === "parent" || role === "fan";
  const roleKey: TeamMembershipRole = role === "player" ? "PLAYER" : "HEAD_COACH";
  const teams = Array.from({ length: rich ? 6 : 1 }, (_, index) => ({
    ...base.teamContext!.availableTeams[0], teamId: `global-qa-team-${index}`, seasonId: "global-qa-season",
    teamName: ["Metrolina Varsity", "Metrolina Fall Ball", "Junior Varsity", "Charlotte Summer Development", "An Exceptionally Long Baseball Team Name for Responsive Review", "Travel Team"][index],
    organizationId: index < 3 ? "global-qa-org-1" : "global-qa-org-2",
    organizationName: index < 3 ? "Metrolina Christian Academy" : "Charlotte Baseball Club",
    teamLevel: index === 1 ? "Other" : index === 2 ? "JV" : "Varsity",
    seasonName: index === 5 ? undefined : "Fall 2026", role: roleKey, title: undefined,
    playerContextId: role === "player" ? `global-qa-player-${index}` : undefined,
    active: true,
  }));
  const profileId = `global-qa-${role}`;
  const publicTeams = Array.from({ length: rich ? 5 : 0 }, (_, index) => ({ id: `global-qa-public-${index}`, name: `Carolina Showcase ${14 + index}U`, organizationId: "global-qa-public-org", organizationName: "Carolina Showcase Baseball", seasonName: "Summer 2027", active: true, visibility: "PUBLIC" as const }));
  const existingFixture = base.teamContext?.profile?.id === profileId;
  return {
    ...base,
    teamContext: {
      profile: { ...base.teamContext?.profile, id: profileId, role: role === "super" ? "SUPER_USER" : role.toUpperCase(), displayName: `QA ${role}`, firstName: "QA", lastName: role, email: "qa.fixture@example.invalid" },
      currentTeam: followerOnly ? undefined : teams[0], availableTeams: followerOnly ? [] : teams,
      organizations: followerOnly ? [] : [ { id: "global-qa-org-1", name: "Metrolina Christian Academy", city: "Indian Trail", state: "NC", role: roleKey, active: true }, ...(rich ? [{ id: "global-qa-org-2", name: "Charlotte Baseball Club", role: roleKey, active: true }] : []) ],
    },
    profileTeamPins: existingFixture ? base.profileTeamPins : rich ? teams.slice(0, 2).map((team, index) => ({ id: `global-qa-pin-${index}`, profileId, teamId: team.teamId, seasonId: team.seasonId, createdAt: iso(0), updatedAt: iso(0) })) : [],
    publicTeams,
    publicOrganizations: rich ? [{ id: "global-qa-public-org", name: "Carolina Showcase Baseball", city: "Matthews", state: "NC", visibility: "PUBLIC", teams: publicTeams }] : [],
    profileFollows: rich ? [{ id: "global-qa-follow", profileId, organizationId: "global-qa-public-org", createdAt: iso(0) }] : [],
    profileFollowExclusions: [],
    practices: rich ? [{ id: "global-qa-completed", name: "Varsity Practice", type: "Team Practice", location: "MCA Field", date: iso(-86400000).slice(0, 10), playerIds: [], hitterIds: [], pitcherIds: [], startedAt: iso(-90000000), endedAt: iso(-86400000), createdAt: iso(-90000000), updatedAt: iso(-86400000) }] : [],
    games: [], workoutSessions: [], weightRoomWorkouts: [],
    scheduleEvents: rich ? [{ id: "global-qa-up-next", teamId: teams[0].teamId, seasonId: teams[0].seasonId, title: "Varsity Practice", eventType: "Practice", startAt: iso(3600000), location: "MCA Field", status: "Scheduled", visibility: "TEAM_ONLY", createdAt: iso(0), updatedAt: iso(0) }] : [],
  };
}

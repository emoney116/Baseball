import type { AppData, ProfileTeamPin, TeamContext, TeamOption } from "../types";

export function globalCreationCapabilities(context?: TeamContext) {
  // Preserve the player-only global UX; a legitimate staff context keeps staff entry points.
  // Existing API authorization is unchanged: an existing organization still requires ADMIN.
  const signedIn = Boolean(context?.profile?.id);
  const staffContext = context?.availableTeams?.some((team) => team.active && !team.playerContextId && team.role !== "PLAYER");
  const canCreate = signedIn && (context?.profile?.role !== "PLAYER" || Boolean(staffContext));
  return { canCreateOrganization: canCreate, canCreateTeam: canCreate };
}

export function homeTeamGroups(teams: TeamOption[], pins: ProfileTeamPin[] = []) {
  const isPinned = (team: TeamOption) => team.active && pins.some((pin) => pin.teamId === team.teamId && (pin.seasonId ?? "") === (team.seasonId ?? ""));
  return { pinned: teams.filter(isPinned), remaining: teams.filter((team) => !isPinned(team)) };
}

export type HomeActivity = { id: string; title: string; at: string; location?: string; team: TeamOption; view: "schedule" | "practice" | "games" | "weights" };

// AppData is already authorized and scoped by the existing repository/session loader.
// Never infer a start time from a date-only record or invent an activity audit trail.
export function globalHomeActivity(data: AppData, now = Date.now()) {
  const current = data.teamContext?.currentTeam;
  const teams = data.teamContext?.availableTeams ?? [];
  const direct = current && teams.find((team) => team.active && team.teamId === current.teamId && team.seasonId === current.seasonId && team.playerContextId === current.playerContextId);
  const upcoming: HomeActivity[] = [];
  const recent: HomeActivity[] = [];
  const valid = (at?: string): at is string => Boolean(at && Number.isFinite(Date.parse(at)));
  if (direct) {
    for (const practice of data.practices) {
      const item = { id: `practice-${practice.id}`, title: practice.name || "Practice", team: direct, location: practice.location, view: "practice" as const };
      if (!practice.endedAt && valid(practice.startedAt)) upcoming.push({ ...item, at: practice.startedAt });
      if (valid(practice.endedAt)) recent.push({ ...item, title: `${item.title} completed`, at: practice.endedAt });
    }
    for (const game of data.games) {
      if (!game.result && valid(game.startsAt)) upcoming.push({ id: `game-${game.id}`, title: `Game vs ${game.opponent}`, at: game.startsAt, location: game.location, team: direct, view: "games" });
    }
    for (const workout of data.weightRoomWorkouts ?? []) {
      if (workout.teamId && workout.teamId !== direct.teamId) continue;
      if (workout.seasonId && workout.seasonId !== direct.seasonId) continue;
      if (workout.status === "COMPLETED" && valid(workout.endedAt)) recent.push({ id: `workout-${workout.id}`, title: `${workout.title} completed`, at: workout.endedAt, team: direct, view: "weights" });
    }
  }
  for (const event of data.scheduleEvents ?? []) {
    if (event.status !== "Scheduled" || event.visibility === "PRIVATE" || !valid(event.startAt)) continue;
    const team = event.teamId ? teams.find((candidate) => candidate.active && candidate.teamId === event.teamId && (!event.seasonId || candidate.seasonId === event.seasonId)) : undefined;
    if (!team) continue;
    // Prefer the actual scheduled event over an associated session's representation.
    const linked = event.practiceId ? `practice-${event.practiceId}` : event.gameId ? `game-${event.gameId}` : undefined;
    const index = upcoming.findIndex((item) => item.id === linked);
    if (index >= 0) upcoming.splice(index, 1);
    upcoming.push({ id: `schedule-${event.id}`, title: event.title, at: event.startAt, location: event.location, team, view: "schedule" });
  }
  return {
    next: upcoming.filter((item) => Date.parse(item.at) >= now).sort((a, b) => Date.parse(a.at) - Date.parse(b.at))[0],
    recent: recent.filter((item) => Date.parse(item.at) <= now && Date.parse(item.at) >= now - 14 * 86400000).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 3),
  };
}

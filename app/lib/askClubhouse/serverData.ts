import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AppData,
  AppProfile,
  BattedBallType,
  DefenseDrillContext,
  DefenseEvent,
  DefenseOutcome,
  DefenseRepSubtype,
  DefenseRepType,
  DefenseSession,
  DefenseStation,
  DefenseThrowResult,
  Game,
  GameBallInPlayOutcome,
  GameEvent,
  GamePitchOutcome,
  HittingContactQuality,
  HittingPitchTrackingMode,
  HittingSession,
  ID,
  LiveBpThrowerSource,
  PitchEvent,
  PitchFocusTag,
  PitchOutcome,
  PitchType,
  PitchingSession,
  Player,
  PlayerTeamMembership,
  Position,
  Practice,
  PracticeAttendance,
  PracticeAttendanceStatus,
  PracticeEntryPolicy,
  PracticeEntrySource,
  PracticeSessionContributor,
  PracticeSessionContributorRole,
  PracticeSessionStatus,
  PracticeType,
  PracticeVerificationStatus,
  RosterStatus,
  TeamContext,
  TeamMembershipRole,
  TeamOption,
  WorkoutEntry,
  WorkoutSession,
} from "../../types";
import type { AskClubhouseTeamScope } from "./types.ts";

const SEASON_NAME = "Fall 2026";

// Supabase rows are intentionally adapted at this boundary before entering typed app data.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export interface AskClubhouseDataScope {
  profileId: ID;
  organizationId?: ID;
  teamId?: ID;
  seasonId?: ID;
  selectedTeams: TeamOption[];
}

export class AskClubhouseScopeError extends Error {
  constructor(message = "One or more selected teams are not available to this account.") {
    super(message);
    this.name = "AskClubhouseScopeError";
  }
}

export async function loadAskClubhouseData(
  supabase: SupabaseClient,
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> },
  requestedTeamId?: string,
  requestedSeasonId?: string,
  requestedTeamScopes?: AskClubhouseTeamScope[],
): Promise<{ data: AppData; scope: AskClubhouseDataScope }> {
  const profile = await ensureOwnProfile(supabase, user);
  const teamContext = await loadTeamContext(supabase, profile, requestedTeamId, requestedSeasonId);
  const explicitScopes = requestedTeamScopes?.length
    ? requestedTeamScopes
    : requestedTeamId ? [{ teamId: requestedTeamId, seasonId: requestedSeasonId }] : undefined;
  const selectedTeams = explicitScopes
    ? resolveAuthorizedTeamScopes(teamContext.availableTeams, explicitScopes)
    : teamContext.currentTeam ? [teamContext.currentTeam] : [];

  if (!selectedTeams.length) {
    return {
      data: emptyData(teamContext, profile, undefined),
      scope: { profileId: profile.id, selectedTeams: [] },
    };
  }

  const datasets = await Promise.all(selectedTeams.map((team) => loadTeamData(supabase, {
    ...teamContext,
    currentTeam: team,
  }, team)));
  const data = datasets.length === 1 ? datasets[0] : mergeTeamData(datasets, teamContext, profile);
  const current = selectedTeams.length === 1 ? selectedTeams[0] : undefined;
  return {
    data,
    scope: {
      profileId: profile.id,
      organizationId: current?.organizationId,
      teamId: current?.teamId,
      seasonId: current?.seasonId,
      selectedTeams,
    },
  };
}

function resolveAuthorizedTeamScopes(availableTeams: TeamOption[], requestedScopes: AskClubhouseTeamScope[]): TeamOption[] {
  const requested = [...new Map(requestedScopes.map((scope) => [`${scope.teamId}:${scope.seasonId ?? ""}`, scope])).values()];
  const selected = requested.map((scope) => availableTeams.find((team) => (
    team.teamId === scope.teamId
    && (!scope.seasonId || team.seasonId === scope.seasonId)
  )));
  if (selected.some((team) => !team)) throw new AskClubhouseScopeError();
  return selected.filter((team): team is TeamOption => Boolean(team));
}

function mergeTeamData(datasets: AppData[], teamContext: TeamContext, profile: AppProfile): AppData {
  const first = datasets[0];
  const uniqueRows = <T extends { id: ID }>(rows: T[]) => [...new Map(rows.map((row) => [row.id, row])).values()];
  return {
    ...first,
    teamContext: { ...teamContext, profile, currentTeam: undefined },
    players: uniqueRows(datasets.flatMap((data) => data.players)),
    playerTeamMemberships: uniqueRows(datasets.flatMap((data) => data.playerTeamMemberships ?? [])),
    practices: uniqueRows(datasets.flatMap((data) => data.practices)),
    attendance: uniqueRows(datasets.flatMap((data) => data.attendance)),
    practiceSessionContributors: uniqueRows(datasets.flatMap((data) => data.practiceSessionContributors)),
    pitchingSessions: uniqueRows(datasets.flatMap((data) => data.pitchingSessions)),
    pitchEvents: uniqueRows(datasets.flatMap((data) => data.pitchEvents)),
    hittingSessions: uniqueRows(datasets.flatMap((data) => data.hittingSessions)),
    hittingEvents: uniqueRows(datasets.flatMap((data) => data.hittingEvents)),
    defenseSessions: uniqueRows(datasets.flatMap((data) => data.defenseSessions)),
    defenseEvents: uniqueRows(datasets.flatMap((data) => data.defenseEvents)),
    workoutSessions: uniqueRows(datasets.flatMap((data) => data.workoutSessions)),
    workoutEntries: uniqueRows(datasets.flatMap((data) => data.workoutEntries)),
    games: uniqueRows(datasets.flatMap((data) => data.games)),
    gameEvents: uniqueRows(datasets.flatMap((data) => data.gameEvents)),
    scheduleEvents: [],
    plateAppearances: uniqueRows(datasets.flatMap((data) => data.plateAppearances)),
    coachNotes: uniqueRows(datasets.flatMap((data) => data.coachNotes)),
    developmentGoals: uniqueRows(datasets.flatMap((data) => data.developmentGoals)),
    settings: {
      ...first.settings,
      rosterSeason: "Selected teams",
      selectedTeamId: undefined,
      selectedSeasonId: undefined,
    },
  };
}

async function ensureOwnProfile(
  supabase: SupabaseClient,
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> },
): Promise<AppProfile> {
  const metadata = user.user_metadata ?? {};
  const { data: existing, error: existingError } = await supabase
    .from("profiles")
    .select("id,email,first_name,last_name,display_name,avatar_url,role")
    .eq("id", user.id)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  const firstName = nonEmpty(stringMetadata(metadata.first_name) ?? existing?.first_name);
  const lastName = nonEmpty(stringMetadata(metadata.last_name) ?? existing?.last_name);
  const displayName = nonEmpty(existing?.display_name)
    ?? nonEmpty(stringMetadata(metadata.display_name))
    ?? [firstName, lastName].filter(Boolean).join(" ")
    ?? user.email?.split("@")[0]
    ?? "Coach";

  const { error: upsertError } = await supabase.from("profiles").upsert({
    id: user.id,
    email: user.email?.toLowerCase() ?? existing?.email ?? null,
    first_name: firstName ?? null,
    last_name: lastName ?? null,
    display_name: displayName,
  }, { onConflict: "id" });
  if (upsertError) throw new Error(upsertError.message);

  return {
    id: user.id,
    email: user.email ?? existing?.email ?? undefined,
    firstName,
    lastName,
    displayName,
    avatarUrl: existing?.avatar_url ?? undefined,
    role: existing?.role ?? undefined,
  };
}

async function loadTeamContext(
  supabase: SupabaseClient,
  profile: AppProfile,
  requestedTeamId?: string,
  requestedSeasonId?: string,
): Promise<TeamContext> {
  const memberships = await rows(
    supabase
      .from("profile_team_memberships")
      .select("id,profile_id,team_id,season_id,role,title,active")
      .eq("profile_id", profile.id)
      .eq("active", true),
  );
  if (!memberships.length) return { profile, organizations: [], availableTeams: [] };

  const teamIds = unique(memberships.map((membership) => membership.team_id));
  const seasonIds = unique(memberships.map((membership) => membership.season_id));
  const teamRows = teamIds.length
    ? await rows(supabase.from("teams").select("id,organization_id,name,level,team_type,age_group,city,state,logo_url,active").in("id", teamIds))
    : [];
  const seasonRows = seasonIds.length
    ? await rows(supabase.from("seasons").select("id,team_id,name,active").in("id", seasonIds))
    : [];
  const organizationIds = unique(teamRows.map((team) => team.organization_id));
  const organizationRows = organizationIds.length
    ? await rows(supabase.from("organizations").select("id,name,slug,city,state,logo_url").in("id", organizationIds), true)
    : [];

  const teamsById = new Map(teamRows.map((team) => [team.id, team]));
  const seasonsById = new Map(seasonRows.map((season) => [season.id, season]));
  const organizationsById = new Map(organizationRows.map((organization) => [organization.id, organization]));

  const availableTeams = memberships
    .map((membership): TeamOption | null => {
      const team = teamsById.get(membership.team_id);
      if (!team) return null;
      const season = seasonsById.get(membership.season_id);
      const organization = organizationsById.get(team.organization_id);
      return {
        organizationId: team.organization_id ?? undefined,
        organizationName: organization?.name ?? "Independent",
        teamId: team.id,
        teamName: team.name,
        teamLevel: team.level ?? undefined,
        teamType: team.team_type ?? undefined,
        ageGroup: team.age_group ?? undefined,
        city: team.city ?? organization?.city ?? undefined,
        state: team.state ?? organization?.state ?? undefined,
        logoUrl: team.logo_url ?? undefined,
        seasonId: season?.id ?? membership.season_id ?? undefined,
        seasonName: season?.name ?? undefined,
        role: normalizeTeamRole(membership.role),
        title: membership.title ?? undefined,
        active: Boolean(membership.active),
      };
    })
    .filter((team): team is TeamOption => Boolean(team))
    .filter((team) => !isProgramContainerTeamOption(team))
    .sort(compareTeamOptions);

  const currentTeam =
    availableTeams.find((team) => team.teamId === requestedTeamId && (!requestedSeasonId || team.seasonId === requestedSeasonId))
    ?? availableTeams.find((team) => team.teamName.toLowerCase().includes("varsity"))
    ?? availableTeams[0];

  const organizations = organizationRows.map((organization) => ({
    id: organization.id,
    name: organization.name,
    slug: organization.slug ?? undefined,
    city: organization.city ?? undefined,
    state: organization.state ?? undefined,
    logoUrl: organization.logo_url ?? undefined,
    role: "COACH" as TeamMembershipRole,
    active: true,
  }));

  return { profile, organizations, availableTeams, currentTeam };
}

async function loadTeamData(supabase: SupabaseClient, teamContext: TeamContext, current: TeamOption): Promise<AppData> {
  const memberships = await rows(
    supabase
      .from("player_team_memberships")
      .select("*")
      .eq("team_id", current.teamId)
      .eq("season_id", current.seasonId),
  );
  const playerIds = unique(memberships.map((membership) => membership.player_id));
  const players = playerIds.length
    ? await rows(supabase.from("players").select("*").in("id", playerIds))
    : [];
  const membershipByPlayer = new Map(memberships.map((membership) => [membership.player_id, membership]));

  const practices = await rows(
    supabase
      .from("practices")
      .select("*")
      .eq("team_id", current.teamId)
      .eq("season_id", current.seasonId),
  );
  const practiceIds = unique(practices.map((practice) => practice.id));

  const [
    attendanceRows,
    sessionRows,
    contributorRows,
    pitchRows,
    hittingRows,
    defenseRows,
    workoutRows,
    gameRows,
  ] = await Promise.all([
    practiceIds.length ? rows(supabase.from("practice_attendance").select("*").in("practice_id", practiceIds), true) : Promise.resolve([]),
    practiceIds.length ? rows(supabase.from("practice_sessions").select("*").in("practice_id", practiceIds), true) : Promise.resolve([]),
    rows(supabase.from("practice_session_contributors").select("*"), true),
    practiceIds.length ? rows(supabase.from("pitch_events").select("*").in("practice_id", practiceIds), true) : Promise.resolve([]),
    practiceIds.length ? rows(supabase.from("hitting_events").select("*").in("practice_id", practiceIds), true) : Promise.resolve([]),
    practiceIds.length ? rows(supabase.from("defense_events").select("*").in("practice_id", practiceIds), true) : Promise.resolve([]),
    rows(supabase.from("workout_sessions").select("*").eq("team_id", current.teamId).eq("season_id", current.seasonId), true),
    rows(supabase.from("games").select("*").eq("team_id", current.teamId).eq("season_id", current.seasonId), true),
  ]);

  const sessionIds = unique(workoutRows.map((workout) => workout.id));
  const workoutSetRows = sessionIds.length
    ? await rows(supabase.from("workout_sets").select("*").in("workout_session_id", sessionIds), true)
    : [];
  const exerciseIds = unique(workoutSetRows.map((set) => set.exercise_id));
  const exerciseRows = exerciseIds.length
    ? await rows(supabase.from("exercises").select("*").in("id", exerciseIds), true)
    : [];
  const exerciseById = new Map(exerciseRows.map((exercise) => [exercise.id, exercise]));

  const gameIds = unique(gameRows.map((game) => game.id));
  const [lineupRows, gameEventRows] = await Promise.all([
    gameIds.length ? rows(supabase.from("game_lineups").select("*").in("game_id", gameIds), true) : Promise.resolve([]),
    gameIds.length ? rows(supabase.from("game_pitch_events").select("*").in("game_id", gameIds), true) : Promise.resolve([]),
  ]);

  return {
    teamContext,
    players: players.map((player) => mapPlayer(player, membershipByPlayer.get(player.id))),
    playerTeamMemberships: memberships.map(mapPlayerTeamMembership),
    practices: practices.map((practice) => mapPractice(practice, attendanceRows)),
    attendance: attendanceRows.map(mapAttendance),
    practiceSessionContributors: contributorRows
      .filter((row) => sessionRows.some((session) => session.id === row.session_id))
      .map(mapPracticeSessionContributor),
    pitchingSessions: sessionRows.filter((session) => session.category === "pitching").map(mapPitchingSession),
    pitchEvents: pitchRows.map(mapPitchEvent),
    hittingSessions: sessionRows.filter((session) => session.category === "hitting").map(mapHittingSession),
    hittingEvents: hittingRows.map(mapHittingEvent),
    defenseSessions: sessionRows.filter((session) => session.category === "defense").map(mapDefenseSession),
    defenseEvents: defenseRows.map(mapDefenseEvent),
    workoutSessions: workoutRows.map(mapWorkoutSession),
    workoutEntries: workoutSetRows.map((set) => mapWorkoutEntry(set, exerciseById.get(set.exercise_id))),
    scheduleEvents: [],
    games: gameRows.map((game) => mapGame(game, lineupRows)),
    gameEvents: gameEventRows.map(mapGameEvent),
    plateAppearances: [],
    coachNotes: [],
    developmentGoals: [],
    settings: {
      theme: "dark",
      rosterSeason: current.seasonName ?? SEASON_NAME,
      recentPlayerIds: [],
      selectedTeamId: current.teamId,
      selectedSeasonId: current.seasonId,
    },
  };
}

function emptyData(teamContext: TeamContext, profile: AppProfile, currentTeam: TeamOption | undefined): AppData {
  return {
    teamContext: { ...teamContext, profile, currentTeam },
    players: [],
    playerTeamMemberships: [],
    practices: [],
    attendance: [],
    practiceSessionContributors: [],
    pitchingSessions: [],
    pitchEvents: [],
    hittingSessions: [],
    hittingEvents: [],
    defenseSessions: [],
    defenseEvents: [],
    workoutSessions: [],
    workoutEntries: [],
    scheduleEvents: [],
    games: [],
    gameEvents: [],
    plateAppearances: [],
    coachNotes: [],
    developmentGoals: [],
    settings: {
      theme: "dark",
      rosterSeason: currentTeam?.seasonName ?? SEASON_NAME,
      recentPlayerIds: [],
      selectedTeamId: currentTeam?.teamId,
      selectedSeasonId: currentTeam?.seasonId,
    },
  };
}

async function rows<T extends AnyRow>(query: PromiseLike<{ data: T[] | null; error: { code?: string; message?: string } | null }>, optional = false): Promise<T[]> {
  const { data, error } = await query;
  if (error) {
    if (optional && isMissingTableOrColumn(error)) return [];
    throw new Error(error.message ?? "Unable to load Ask Clubhouse data.");
  }
  return data ?? [];
}

function mapPlayer(row: AnyRow, membership?: AnyRow): Player {
  const metadata = row.metadata ?? {};
  return {
    id: row.id,
    name: `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || "Player",
    jerseyNumber: membership?.jersey_number ?? row.jersey_number ?? 0,
    primaryPosition: (row.primary_position ?? "UTL") as Position,
    secondaryPosition: row.secondary_position as Position | undefined,
    bats: row.bats === "L" || row.bats === "S" ? row.bats : "R",
    throws: row.throws === "L" || row.throws === "S" ? row.throws : "R",
    graduationYear: row.graduation_year ?? new Date().getFullYear(),
    rosterStatus: normalizeRosterStatus(membership?.roster_status),
    programLevel: membership?.roster_status === "JV" ? "JV" : membership?.roster_status === "Varsity" ? "Varsity" : "Development",
    height: row.height ?? undefined,
    weight: toNumber(row.weight),
    avatarColor: metadata.avatarColor ?? "#30343b",
    imageUrl: row.photo_url ?? undefined,
    isPitcher: Boolean(row.is_pitcher),
    isHitter: row.is_hitter !== false,
    notes: metadata.notes ?? undefined,
    archived: !row.active,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? row.created_at ?? "",
  };
}

function mapPlayerTeamMembership(row: AnyRow): PlayerTeamMembership {
  return {
    id: row.id,
    playerId: row.player_id,
    teamId: row.team_id,
    seasonId: row.season_id ?? undefined,
    rosterStatus: normalizeRosterStatus(row.roster_status),
    jerseyNumber: row.jersey_number ?? undefined,
    rosterRole: row.roster_role ?? undefined,
    isCaptain: row.metadata?.isCaptain ?? undefined,
    positionLabels: Array.isArray(row.metadata?.positionLabels) ? row.metadata.positionLabels : undefined,
    active: Boolean(row.active),
    startDate: row.start_date ?? undefined,
    endDate: row.end_date ?? undefined,
  };
}

function mapPractice(row: AnyRow, attendanceRows: AnyRow[]): Practice {
  const attendance = attendanceRows.filter((item) => item.practice_id === row.id);
  const activeAttendance = attendance.filter((item) => ["Present", "Late"].includes(item.status ?? "Present"));
  return {
    id: row.id,
    date: row.practice_date,
    name: row.name,
    type: (row.practice_type ?? "Team Practice") as PracticeType,
    location: row.location ?? "",
    notes: row.notes ?? undefined,
    playerIds: activeAttendance.map((item) => item.player_id),
    pitcherIds: activeAttendance.filter((item) => ["Pitcher", "Two-way"].includes(item.role)).map((item) => item.player_id),
    hitterIds: activeAttendance.filter((item) => ["Hitter", "Two-way"].includes(item.role)).map((item) => item.player_id),
    startedAt: row.starts_at ?? `${row.practice_date}T12:00:00.000Z`,
    endedAt: row.ended_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAttendance(row: AnyRow): PracticeAttendance {
  return {
    id: row.id,
    practiceId: row.practice_id,
    playerId: row.player_id,
    role: row.role,
    status: normalizeAttendanceStatus(row.status),
    checkedInAt: row.checked_in_at,
    updatedByProfileId: row.updated_by_profile_id ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

function mapPracticeSessionContributor(row: AnyRow): PracticeSessionContributor {
  return {
    id: row.id,
    sessionId: row.session_id,
    profileId: row.profile_id,
    role: normalizeContributorRole(row.role),
    joinedAt: row.joined_at,
    lastActiveAt: row.last_active_at,
  };
}

function mapHittingSession(row: AnyRow): HittingSession {
  const metadata = row.metadata ?? {};
  return {
    id: row.id,
    practiceId: row.practice_id,
    hitterId: row.player_id,
    type: row.session_type,
    liveBpThrowerSource: normalizeLiveBpThrowerSource(metadata.liveBpThrowerSource),
    machineVelocity: toNumber(metadata.machineVelocity),
    machinePitchType: normalizePitchType(metadata.machinePitchType),
    pitchTrackingMode: normalizePitchTrackingMode(metadata.pitchTrackingMode),
    defaultPitchType: normalizePitchType(metadata.defaultPitchType),
    machineLocation: metadata.machineLocation ?? undefined,
    distance: metadata.distance ?? undefined,
    machineType: metadata.machineType ?? undefined,
    coachBpStyle: metadata.coachBpStyle ?? undefined,
    roundGoals: metadata.roundGoals ?? [],
    plannedReps: metadata.plannedReps ?? undefined,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    summaryNote: row.summary_note ?? undefined,
    sessionGrade: row.session_grade ?? undefined,
    title: row.title ?? undefined,
    status: normalizePracticeSessionStatus(row.status, row.ended_at),
    createdByProfileId: row.created_by_profile_id ?? undefined,
    contributorProfileIds: Array.isArray(row.contributor_profile_ids) ? row.contributor_profile_ids : undefined,
    location: row.location ?? undefined,
    station: row.station ?? undefined,
    entryPolicy: normalizePracticeEntryPolicy(row.entry_policy),
    updatedAt: row.updated_at ?? undefined,
  };
}

function mapPitchingSession(row: AnyRow): PitchingSession {
  const metadata = row.metadata ?? {};
  return {
    id: row.id,
    practiceId: row.practice_id,
    pitcherId: row.player_id,
    type: row.session_type,
    liveBpThrowerSource: normalizeLiveBpThrowerSource(metadata.liveBpThrowerSource),
    catcherId: metadata.catcherId,
    hitterId: metadata.hitterId ?? row.secondary_player_id ?? undefined,
    focusTags: metadata.focusTags ?? [] as PitchFocusTag[],
    intendedFocus: metadata.intendedFocus,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    summaryNote: row.summary_note ?? undefined,
    sessionGrade: row.session_grade ?? undefined,
    title: row.title ?? undefined,
    status: normalizePracticeSessionStatus(row.status, row.ended_at),
    createdByProfileId: row.created_by_profile_id ?? undefined,
    contributorProfileIds: Array.isArray(row.contributor_profile_ids) ? row.contributor_profile_ids : undefined,
    location: row.location ?? undefined,
    station: row.station ?? undefined,
    entryPolicy: normalizePracticeEntryPolicy(row.entry_policy),
    updatedAt: row.updated_at ?? undefined,
  };
}

function mapDefenseSession(row: AnyRow): DefenseSession {
  const metadata = row.metadata ?? {};
  return {
    id: row.id,
    practiceId: row.practice_id,
    playerId: row.player_id,
    station: (row.session_type ?? "Infield") as DefenseStation,
    drillContext: metadata.drillContext as DefenseDrillContext | undefined,
    positionWorked: metadata.positionWorked as Position | undefined,
    mode: metadata.mode ?? "Quick Practice",
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    plannedReps: metadata.plannedReps ?? undefined,
    summaryNote: row.summary_note ?? undefined,
    title: row.title ?? undefined,
    status: normalizePracticeSessionStatus(row.status, row.ended_at),
    createdByProfileId: row.created_by_profile_id ?? undefined,
    contributorProfileIds: Array.isArray(row.contributor_profile_ids) ? row.contributor_profile_ids : undefined,
    location: row.location ?? undefined,
    entryPolicy: normalizePracticeEntryPolicy(row.entry_policy),
    updatedAt: row.updated_at ?? undefined,
  };
}

function mapPitchEvent(row: AnyRow): PitchEvent {
  return {
    id: row.id,
    practiceId: row.practice_id,
    sessionId: row.session_id,
    pitcherId: row.pitcher_id,
    hitterId: row.hitter_id ?? undefined,
    plateAppearanceId: row.plate_appearance_id ?? undefined,
    pitchNumber: row.pitch_number,
    pitchType: normalizePitchType(row.pitch_type) ?? "4-Seam",
    outcome: (row.outcome ?? "Ball") as PitchOutcome,
    isStrike: Boolean(row.is_strike),
    isSwing: Boolean(row.is_swing),
    isZone: Boolean(row.is_zone),
    isChase: row.is_chase ?? undefined,
    isWhiff: row.is_whiff ?? undefined,
    isCalledStrike: row.is_called_strike ?? undefined,
    isBallInPlay: row.is_ball_in_play ?? undefined,
    battedBall: row.batted_ball as BattedBallType | undefined,
    contactQuality: row.contact_quality ?? undefined,
    velocity: toNumber(row.velocity),
    qualityRating: row.quality_rating ?? undefined,
    missedIntendedLocation: row.missed_intended_location ?? undefined,
    intendedTarget: row.intended_target ?? undefined,
    location: row.location ?? undefined,
    countBefore: row.count_before ?? undefined,
    countAfter: row.count_after ?? undefined,
    mechanicalNote: row.mechanical_note ?? undefined,
    coachNote: row.coach_note ?? undefined,
    createdAt: row.created_at,
    createdByProfileId: row.created_by_profile_id ?? undefined,
    updatedByProfileId: row.updated_by_profile_id ?? undefined,
    entrySource: normalizePracticeEntrySource(row.entry_source),
    verificationStatus: normalizePracticeVerificationStatus(row.verification_status),
    idempotencyKey: row.idempotency_key ?? undefined,
    sessionSequence: row.session_sequence ?? undefined,
  };
}

function mapHittingEvent(row: AnyRow) {
  return {
    id: row.id,
    practiceId: row.practice_id,
    sessionId: row.session_id,
    hitterId: row.hitter_id,
    pitcherId: row.pitcher_id ?? undefined,
    plateAppearanceId: row.plate_appearance_id ?? undefined,
    eventNumber: row.event_number,
    action: row.action,
    contactResult: row.contact_result as BattedBallType | undefined,
    contactQuality: row.contact_quality as HittingContactQuality | undefined,
    direction: row.direction ?? undefined,
    fieldLocation: row.field_location ?? undefined,
    pitchLocation: row.pitch_location ?? undefined,
    pitchType: normalizePitchType(row.pitch_type),
    velocity: toNumber(row.velocity),
    exitVelocityMph: toNumber(row.exit_velocity_mph),
    isLiveBp: Boolean(row.is_live_bp),
    createdAt: row.created_at,
    createdByProfileId: row.created_by_profile_id ?? undefined,
    updatedByProfileId: row.updated_by_profile_id ?? undefined,
    entrySource: normalizePracticeEntrySource(row.entry_source),
    verificationStatus: normalizePracticeVerificationStatus(row.verification_status),
    idempotencyKey: row.idempotency_key ?? undefined,
    sessionSequence: row.session_sequence ?? undefined,
  };
}

function mapDefenseEvent(row: AnyRow): DefenseEvent {
  return {
    id: row.id,
    practiceId: row.practice_id,
    sessionId: row.session_id,
    playerId: row.player_id,
    station: (row.station ?? "Infield") as DefenseStation,
    eventNumber: row.event_number,
    outcome: (row.outcome ?? "Clean") as DefenseOutcome,
    positionWorked: row.position_worked as Position | undefined,
    drillContext: row.drill_context as DefenseDrillContext | undefined,
    repType: row.rep_type as DefenseRepType | undefined,
    repSubtype: row.rep_subtype as DefenseRepSubtype | undefined,
    result: row.result as DefenseOutcome | undefined,
    throwResult: row.throw_result as DefenseThrowResult | undefined,
    difficulty: row.difficulty ?? undefined,
    location: row.location ?? undefined,
    timingSeconds: toNumber(row.timing_seconds),
    deviceSource: row.device_source ?? undefined,
    throwQuality: row.throw_quality ?? undefined,
    footwork: row.footwork ?? undefined,
    decision: row.decision ?? undefined,
    range: row.range ?? undefined,
    errorType: row.error_type ?? undefined,
    coachNote: row.coach_note ?? undefined,
    createdAt: row.created_at,
    createdByProfileId: row.created_by_profile_id ?? undefined,
    updatedByProfileId: row.updated_by_profile_id ?? undefined,
    entrySource: normalizePracticeEntrySource(row.entry_source),
    verificationStatus: normalizePracticeVerificationStatus(row.verification_status),
    idempotencyKey: row.idempotency_key ?? undefined,
    sessionSequence: row.session_sequence ?? undefined,
  };
}

function mapWorkoutSession(row: AnyRow): WorkoutSession {
  return {
    id: row.id,
    playerId: row.player_id,
    date: row.session_date,
    weekOf: row.week_of ?? row.session_date,
    day: row.day_name ?? "Mon",
    completed: Boolean(row.completed),
    effortScore: row.effort_score ?? 0,
    bodyWeight: toNumber(row.body_weight),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapWorkoutEntry(row: AnyRow, exercise?: AnyRow): WorkoutEntry {
  return {
    id: row.id,
    sessionId: row.workout_session_id,
    playerId: row.player_id,
    exercise: exercise?.name ?? "Custom Exercise",
    kind: exercise?.kind ?? "Custom",
    setNumber: row.set_number ?? undefined,
    weight: toNumber(row.weight),
    reps: row.reps ?? undefined,
    sets: row.sets ?? undefined,
    value: toNumber(row.value),
    unit: row.unit ?? exercise?.unit ?? undefined,
    rpe: toNumber(row.rpe),
    status: row.status ?? undefined,
    notes: row.notes ?? undefined,
    createdByProfileId: row.created_by ?? undefined,
    entrySource: row.entry_source ?? undefined,
    priorValue: toNumber(row.prior_value),
    createdAt: row.created_at,
  };
}

function mapGame(row: AnyRow, lineupRows: AnyRow[]): Game {
  const lineups = lineupRows.filter((lineup) => lineup.game_id === row.id).sort((a, b) => (a.batting_order ?? 99) - (b.batting_order ?? 99));
  return {
    id: row.id,
    date: row.game_date,
    startsAt: row.starts_at ?? undefined,
    opponent: row.opponent,
    homeAway: row.home_away ?? "Home",
    location: row.location ?? "",
    type: row.game_type ?? "Other",
    result: row.result ?? undefined,
    metrolinaScore: row.our_score ?? 0,
    opponentScore: row.opponent_score ?? 0,
    inning: row.inning ?? 1,
    half: row.half ?? "Top",
    outs: row.outs ?? 0,
    balls: row.balls ?? 0,
    strikes: row.strikes ?? 0,
    runners: row.runners ?? {},
    lineup: lineups.map((lineup) => lineup.player_id),
    positions: {},
    startingPitcherId: lineups.find((lineup) => lineup.is_starting_pitcher)?.player_id ?? row.current_pitcher_id ?? undefined,
    currentPitcherId: row.current_pitcher_id ?? undefined,
    currentBatterId: row.current_batter_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapGameEvent(row: AnyRow): GameEvent {
  return {
    id: row.id,
    gameId: row.game_id,
    inning: row.inning,
    half: row.half ?? "Top",
    pitcherId: row.pitcher_id ?? undefined,
    batterId: row.batter_id ?? undefined,
    pitchType: normalizePitchType(row.pitch_type),
    pitchOutcome: row.pitch_outcome as GamePitchOutcome | undefined,
    ballInPlayOutcome: row.ball_in_play_outcome as GameBallInPlayOutcome | undefined,
    velocity: toNumber(row.velocity),
    location: row.location ?? undefined,
    outsBefore: row.outs_before,
    outsAfter: row.outs_after,
    metrolinaRunsBefore: row.our_runs_before,
    metrolinaRunsAfter: row.our_runs_after,
    opponentRunsBefore: row.opponent_runs_before,
    opponentRunsAfter: row.opponent_runs_after,
    situations: row.situations ?? [],
    createdAt: row.created_at,
  };
}

function normalizeTeamRole(role: unknown): TeamMembershipRole {
  const value = String(role ?? "STAFF").trim().toUpperCase();
  const roles: TeamMembershipRole[] = ["OWNER", "ADMIN", "HEAD_COACH", "ASSISTANT_COACH", "STAFF", "COACH", "PLAYER"];
  return roles.includes(value as TeamMembershipRole) ? value as TeamMembershipRole : "STAFF";
}

function normalizeRosterStatus(value: unknown): RosterStatus {
  return value === "Varsity" || value === "JV" || value === "Cut" ? value : "Undecided";
}

function normalizeAttendanceStatus(value: unknown): PracticeAttendanceStatus {
  return value === "Absent" || value === "Excused" || value === "Late" ? value : "Present";
}

function normalizePracticeSessionStatus(status: unknown, endedAt?: string | null): PracticeSessionStatus {
  const value = String(status ?? "").trim().toUpperCase();
  if (value === "COMPLETED" || value === "CANCELLED" || value === "ACTIVE") return value;
  return endedAt ? "COMPLETED" : "ACTIVE";
}

function normalizeContributorRole(role: unknown): PracticeSessionContributorRole {
  const value = String(role ?? "").trim().toUpperCase();
  return value === "PLAYER" || value === "MANAGER" ? value : "COACH";
}

function normalizeLiveBpThrowerSource(source: unknown): LiveBpThrowerSource | undefined {
  const value = String(source ?? "").trim().toUpperCase();
  if (value === "PLAYER" || value === "COACH" || value === "MACHINE") return value;
  return undefined;
}

function normalizePracticeEntryPolicy(policy: unknown): PracticeEntryPolicy | undefined {
  const value = String(policy ?? "").trim().toUpperCase();
  if (value === "COACH_AND_ASSIGNED_PLAYERS" || value === "PLAYER_SELF_ENTRY" || value === "COACH_ONLY") return value;
  return undefined;
}

function normalizePracticeEntrySource(source: unknown): PracticeEntrySource | undefined {
  const value = String(source ?? "").trim().toUpperCase();
  if (value === "COACH" || value === "PLAYER" || value === "DEVICE" || value === "IMPORT") return value;
  return undefined;
}

function normalizePracticeVerificationStatus(status: unknown): PracticeVerificationStatus | undefined {
  const value = String(status ?? "").trim().toUpperCase();
  if (value === "COACH_RECORDED" || value === "PLAYER_RECORDED" || value === "COACH_VERIFIED") return value;
  return undefined;
}

function normalizePitchTrackingMode(value: unknown): HittingPitchTrackingMode | undefined {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "OFF" || normalized === "ONE" || normalized === "MULTI") return normalized;
  return undefined;
}

function normalizePitchType(value: unknown): PitchType | undefined {
  const pitchTypes: PitchType[] = ["4-Seam", "2-Seam", "Sinker", "Cutter", "Slider", "Curveball", "Changeup", "Splitter", "Knuckleball", "Other"];
  return pitchTypes.includes(value as PitchType) ? value as PitchType : undefined;
}

function isProgramContainerTeamOption(team: TeamOption) {
  const name = team.teamName.trim().toLowerCase();
  const level = (team.teamLevel ?? "").trim().toLowerCase();
  const teamType = (team.teamType ?? "").trim().toLowerCase();
  return teamType === "program" || level === "program" || name === "baseball" || name.endsWith(" baseball program") || name.includes(" program");
}

function compareTeamOptions(a: TeamOption, b: TeamOption) {
  return a.organizationName.localeCompare(b.organizationName) || teamRank(a) - teamRank(b) || a.teamName.localeCompare(b.teamName);
}

function teamRank(team: TeamOption) {
  const name = `${team.teamName} ${team.teamLevel ?? ""}`.toLowerCase();
  if (name.includes("varsity")) return 0;
  if (name.includes("jv")) return 1;
  return 2;
}

function isMissingTableOrColumn(error: { code?: string; message?: string }) {
  return error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST204" || /schema cache|does not exist|not found/i.test(error.message ?? "");
}

function stringMetadata(value: unknown) {
  return typeof value === "string" ? nonEmpty(value) : undefined;
}

function nonEmpty(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function unique(values: Array<string | undefined | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

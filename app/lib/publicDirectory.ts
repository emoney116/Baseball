import { createAdminClient } from "./supabase/admin";
import { createClient } from "./supabase/server";

type Visibility = "PUBLIC" | "UNLISTED" | "PRIVATE";

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  city?: string | null;
  state?: string | null;
  logo_url?: string | null;
  visibility: string | null;
};

type TeamRow = {
  id: string;
  organization_id: string;
  name: string;
  level: string | null;
  team_type?: string | null;
  age_group?: string | null;
  city?: string | null;
  state?: string | null;
  logo_url?: string | null;
  active: boolean;
  visibility: string | null;
};

type SeasonRow = {
  id: string;
  team_id: string;
  name: string;
  active: boolean;
};

type PlayerRow = {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
  graduation_year: number | null;
  primary_position: string;
  secondary_position: string | null;
  bats: string | null;
  throws: string | null;
  height: string | null;
  weight: number | null;
  active: boolean;
};

type GameRow = {
  id: string;
  organization_id?: string;
  team_id?: string;
  season_id?: string;
  opponent: string;
  starts_at: string | null;
  game_date: string;
  home_away: string;
  location: string | null;
  game_type: string | null;
  status: string | null;
  result: string | null;
  our_score: number | null;
  opponent_score: number | null;
};

type PublicGameDetailRow = {
  game_id: string;
  team_record: string | null;
  opponent_record: string | null;
  event_name: string | null;
  venue: string | null;
  field_label: string | null;
  city: string | null;
  state: string | null;
  public_notes: string | null;
  comparison: unknown;
  probable_starters: unknown;
  recent_matchup: unknown;
  linescore: unknown;
  team_totals: unknown;
  play_by_play: unknown;
  box_score: unknown;
  highlights: unknown;
};

export type PublicRosterPlayer = {
  id: string;
  name: string;
  jerseyNumber?: number;
  graduationYear?: number;
  primaryPosition: string;
  secondaryPosition?: string;
  bats?: string;
  throws?: string;
  height?: string;
  weight?: number;
};

export type PublicGameSummary = {
  id: string;
  opponent: string;
  startsAt?: string;
  gameDate: string;
  homeAway: string;
  location?: string;
  gameType?: string;
  status?: string;
  result?: string;
  ourScore: number;
  opponentScore: number;
};

export type PublicTeamSummary = {
  id: string;
  name: string;
  level?: string;
  visibility: Visibility;
  active: boolean;
  authorized: boolean;
  workspaceAccess: boolean;
  season?: {
    id: string;
    name: string;
  };
};

export type PublicOrganizationDirectory = {
  id: string;
  name: string;
  slug: string;
  city?: string;
  state?: string;
  logoUrl?: string;
  visibility: Visibility;
  teams: PublicTeamSummary[];
  authorized: boolean;
  canFollow: boolean;
  adminCount: number;
  memberCount: number;
};

export type PublicTeamDirectory = PublicTeamSummary & {
  teamType?: string;
  ageGroup?: string;
  city?: string;
  state?: string;
  logoUrl?: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    city?: string;
    state?: string;
    logoUrl?: string;
    visibility: Visibility;
  };
  roster: PublicRosterPlayer[];
  games: PublicGameSummary[];
  authorized: boolean;
  canFollow: boolean;
};

export type PublicComparisonMetric = {
  label: string;
  team?: string;
  opponent?: string;
};

export type PublicGameStarter = {
  name?: string;
  number?: string;
  role?: string;
  line?: string;
};

export type PublicRecentMatchup = {
  date?: string;
  opponent?: string;
  teamScore?: number;
  opponentScore?: number;
};

export type PublicLinescoreRow = {
  team: string;
  innings: Array<number | string>;
  runs: number | string;
  hits?: number | string;
  errors?: number | string;
};

export type PublicGameTotalsRow = {
  team: string;
  hits?: string;
  errors?: string;
  walks?: string;
  strikeouts?: string;
  lob?: string;
};

export type PublicPlayEvent = {
  text: string;
  score?: string;
};

export type PublicPlayByPlaySection = {
  label: string;
  events: PublicPlayEvent[];
};

export type PublicBattingRow = {
  player: string;
  ab?: number | string;
  r?: number | string;
  h?: number | string;
  rbi?: number | string;
  bb?: number | string;
  so?: number | string;
  extra?: string;
};

export type PublicPitchingRow = {
  player: string;
  ip?: number | string;
  h?: number | string;
  r?: number | string;
  er?: number | string;
  bb?: number | string;
  so?: number | string;
  pitches?: number | string;
};

export type PublicTeamBoxScore<T> = {
  team: string;
  rows: T[];
};

export type PublicGameHighlight = {
  name: string;
  line: string;
};

export type PublicGameDetail = {
  game: PublicGameSummary & {
    organizationId: string;
    teamId: string;
    seasonId: string;
  };
  team: Omit<PublicTeamDirectory, "games"> & {
    games: PublicGameSummary[];
  };
  detail: {
    teamRecord?: string;
    opponentRecord?: string;
    eventName?: string;
    venue?: string;
    fieldLabel?: string;
    city?: string;
    state?: string;
    publicNotes?: string;
    comparison: {
      teamLabel?: string;
      opponentLabel?: string;
      metrics: PublicComparisonMetric[];
    };
    probableStarters: {
      team?: PublicGameStarter;
      opponent?: PublicGameStarter;
    };
    recentMatchup?: PublicRecentMatchup;
    linescore: PublicLinescoreRow[];
    teamTotals: {
      winningPitcher?: string;
      losingPitcher?: string;
      save?: string;
      rows: PublicGameTotalsRow[];
    };
    playByPlay: PublicPlayByPlaySection[];
    boxScore: {
      batting: Array<PublicTeamBoxScore<PublicBattingRow>>;
      pitching: Array<PublicTeamBoxScore<PublicPitchingRow>>;
    };
    highlights: PublicGameHighlight[];
  };
  nextGame?: PublicGameSummary;
  recentGames: PublicGameSummary[];
  workspaceAccess: boolean;
  canFollow: boolean;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeVisibility(value: unknown): Visibility {
  return value === "PUBLIC" || value === "UNLISTED" || value === "PRIVATE" ? value : "PRIVATE";
}

function isProgramContainerTeamRow(team: { name?: string | null; level?: string | null; team_type?: string | null }) {
  const name = (team.name ?? "").trim().toLowerCase();
  const level = (team.level ?? "").trim().toLowerCase();
  const teamType = (team.team_type ?? "").trim().toLowerCase();
  return teamType === "program" || level === "program" || name === "baseball" || name.endsWith(" baseball program") || name.includes(" program");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringFrom(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function numberOrStringFrom(value: unknown) {
  return typeof value === "number" || typeof value === "string" ? value : undefined;
}

function parseComparison(value: unknown) {
  const record = asRecord(value);
  return {
    teamLabel: stringFrom(record.teamLabel),
    opponentLabel: stringFrom(record.opponentLabel),
    metrics: asArray(record.metrics)
      .map((item) => {
        const metric = asRecord(item);
        const label = stringFrom(metric.label);
        if (!label) return null;
        return {
          label,
          team: stringFrom(metric.team),
          opponent: stringFrom(metric.opponent),
        };
      })
      .filter(Boolean) as PublicComparisonMetric[],
  };
}

function parseStarter(value: unknown): PublicGameStarter | undefined {
  const record = asRecord(value);
  const starter = {
    name: stringFrom(record.name),
    number: stringFrom(record.number),
    role: stringFrom(record.role),
    line: stringFrom(record.line),
  };
  return starter.name || starter.role || starter.line ? starter : undefined;
}

function parseRecentMatchup(value: unknown): PublicRecentMatchup | undefined {
  const record = asRecord(value);
  if (!Object.keys(record).length) return undefined;
  return {
    date: stringFrom(record.date),
    opponent: stringFrom(record.opponent),
    teamScore: typeof record.teamScore === "number" ? record.teamScore : undefined,
    opponentScore: typeof record.opponentScore === "number" ? record.opponentScore : undefined,
  };
}

function parseLinescore(value: unknown): PublicLinescoreRow[] {
  return asArray(value)
    .map((item) => {
      const row = asRecord(item);
      const team = stringFrom(row.team);
      if (!team) return null;
      return {
        team,
        innings: asArray(row.innings).map((inning) => numberOrStringFrom(inning) ?? "--"),
        runs: numberOrStringFrom(row.runs) ?? "--",
        hits: numberOrStringFrom(row.hits),
        errors: numberOrStringFrom(row.errors),
      };
    })
    .filter(Boolean) as PublicLinescoreRow[];
}

function parseTotals(value: unknown) {
  const record = asRecord(value);
  return {
    winningPitcher: stringFrom(record.winningPitcher),
    losingPitcher: stringFrom(record.losingPitcher),
    save: stringFrom(record.save),
    rows: asArray(record.rows)
      .map((item) => {
        const row = asRecord(item);
        const team = stringFrom(row.team);
        if (!team) return null;
        return {
          team,
          hits: stringFrom(row.hits),
          errors: stringFrom(row.errors),
          walks: stringFrom(row.walks),
          strikeouts: stringFrom(row.strikeouts),
          lob: stringFrom(row.lob),
        };
      })
      .filter(Boolean) as PublicGameTotalsRow[],
  };
}

function parsePlayByPlay(value: unknown): PublicPlayByPlaySection[] {
  return asArray(value)
    .map((item) => {
      const section = asRecord(item);
      const label = stringFrom(section.label);
      if (!label) return null;
      const events = asArray(section.events)
        .map((eventItem) => {
          const event = asRecord(eventItem);
          const text = stringFrom(event.text);
          if (!text) return null;
          return { text, score: stringFrom(event.score) };
        })
        .filter(Boolean) as PublicPlayEvent[];
      return { label, events };
    })
    .filter(Boolean) as PublicPlayByPlaySection[];
}

function parseBoxScore(value: unknown) {
  const record = asRecord(value);
  const parseTeamRows = <T extends PublicBattingRow | PublicPitchingRow>(items: unknown[], rowParser: (row: Record<string, unknown>) => T | null) =>
    items
      .map((item) => {
        const teamSection = asRecord(item);
        const team = stringFrom(teamSection.team);
        if (!team) return null;
        const rows = asArray(teamSection.rows).map((row) => rowParser(asRecord(row))).filter(Boolean) as T[];
        return { team, rows };
      })
      .filter(Boolean) as Array<PublicTeamBoxScore<T>>;

  return {
    batting: parseTeamRows(asArray(record.batting), (row) => {
      const player = stringFrom(row.player);
      if (!player) return null;
      return {
        player,
        ab: numberOrStringFrom(row.ab),
        r: numberOrStringFrom(row.r),
        h: numberOrStringFrom(row.h),
        rbi: numberOrStringFrom(row.rbi),
        bb: numberOrStringFrom(row.bb),
        so: numberOrStringFrom(row.so),
        extra: stringFrom(row.extra),
      };
    }),
    pitching: parseTeamRows(asArray(record.pitching), (row) => {
      const player = stringFrom(row.player);
      if (!player) return null;
      return {
        player,
        ip: numberOrStringFrom(row.ip),
        h: numberOrStringFrom(row.h),
        r: numberOrStringFrom(row.r),
        er: numberOrStringFrom(row.er),
        bb: numberOrStringFrom(row.bb),
        so: numberOrStringFrom(row.so),
        pitches: numberOrStringFrom(row.pitches),
      };
    }),
  };
}

function parseHighlights(value: unknown): PublicGameHighlight[] {
  return asArray(value)
    .map((item) => {
      const row = asRecord(item);
      const name = stringFrom(row.name);
      const line = stringFrom(row.line);
      return name && line ? { name, line } : null;
    })
    .filter(Boolean) as PublicGameHighlight[];
}

function mapGameRow(game: GameRow): PublicGameSummary {
  return {
    id: game.id,
    opponent: game.opponent,
    startsAt: game.starts_at ?? undefined,
    gameDate: game.game_date,
    homeAway: game.home_away,
    location: game.location ?? undefined,
    gameType: game.game_type ?? undefined,
    status: game.status ?? undefined,
    result: game.result ?? undefined,
    ourScore: game.our_score ?? 0,
    opponentScore: game.opponent_score ?? 0,
  };
}

async function viewerId() {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.id;
  } catch {
    return undefined;
  }
}

async function viewerAccessForOrganization(organizationId: string, teamIds: string[]) {
  const userId = await viewerId();
  if (!userId) return { userId: undefined, organizationMember: false, teamIds: new Set<string>() };

  const admin = createAdminClient();
  const [{ data: organizationMembership }, { data: teamMembershipRows }] = await Promise.all([
    admin
      .from("organization_memberships")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("profile_id", userId)
      .eq("active", true)
      .limit(1)
      .maybeSingle(),
    teamIds.length
      ? admin
          .from("profile_team_memberships")
          .select("team_id")
          .in("team_id", teamIds)
          .eq("profile_id", userId)
          .eq("active", true)
      : Promise.resolve({ data: [] }),
  ]);

  return {
    userId,
    organizationMember: Boolean(organizationMembership),
    teamIds: new Set(((teamMembershipRows ?? []) as Array<{ team_id?: string | null }>).map((row) => row.team_id).filter(Boolean) as string[]),
  };
}

async function canViewOrganization(organizationId: string, teamIds: string[], organizationVisibility: Visibility) {
  if (organizationVisibility === "PUBLIC" || organizationVisibility === "UNLISTED") return { authorized: false, allowed: true };
  const userId = await viewerId();
  if (!userId) return { authorized: false, allowed: false };

  const admin = createAdminClient();
  const [{ data: organizationMembership }, { data: teamMembership }] = await Promise.all([
    admin
      .from("organization_memberships")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("profile_id", userId)
      .eq("active", true)
      .limit(1)
      .maybeSingle(),
    teamIds.length
      ? admin
          .from("profile_team_memberships")
          .select("id")
          .in("team_id", teamIds)
          .eq("profile_id", userId)
          .eq("active", true)
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const authorized = Boolean(organizationMembership || teamMembership);
  return { authorized, allowed: authorized };
}

async function canViewTeam(teamId: string, organizationId: string, organizationVisibility: Visibility) {
  if (organizationVisibility === "PUBLIC" || organizationVisibility === "UNLISTED") {
    return { authorized: false, allowed: true };
  }
  const userId = await viewerId();
  if (!userId) return { authorized: false, allowed: false };
  const admin = createAdminClient();
  const [{ data: organizationMembership }, { data: teamMembership }] = await Promise.all([
    admin
      .from("organization_memberships")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("profile_id", userId)
      .eq("active", true)
      .limit(1)
      .maybeSingle(),
    admin
      .from("profile_team_memberships")
      .select("id")
      .eq("team_id", teamId)
      .eq("profile_id", userId)
      .eq("active", true)
      .limit(1)
      .maybeSingle(),
  ]);
  const authorized = Boolean(organizationMembership || teamMembership);
  return { authorized, allowed: authorized };
}

export async function getPublicOrganizationDirectory(identifier: string): Promise<PublicOrganizationDirectory | null> {
  const admin = createAdminClient();
  const organizationQuery = admin
    .from("organizations")
    .select("id,name,slug,city,state,logo_url,visibility")
    .limit(1);
  const { data: organization, error } = isUuid(identifier)
    ? await organizationQuery.eq("id", identifier).maybeSingle()
    : await organizationQuery.eq("slug", identifier).maybeSingle();

  if (error || !organization) return null;
  const organizationRow = organization as OrganizationRow;

  const { data: teamRows, error: teamError } = await admin
    .from("teams")
    .select("id,organization_id,name,level,team_type,active,visibility")
    .eq("organization_id", organizationRow.id)
    .eq("active", true)
    .order("name", { ascending: true });

  if (teamError) return null;

  const teams = ((teamRows ?? []) as TeamRow[]).filter((team) => !isProgramContainerTeamRow(team));
  const viewerAccess = await viewerAccessForOrganization(organizationRow.id, teams.map((team) => team.id));
  const { data: memberRows } = await admin
    .from("organization_memberships")
    .select("role,active")
    .eq("organization_id", organizationRow.id)
    .eq("active", true);
  const activeMembers = (memberRows ?? []) as Array<{ role?: string | null }>;
  const access = await canViewOrganization(
    organizationRow.id,
    teams.map((team) => team.id),
    normalizeVisibility(organizationRow.visibility),
  );
  if (!access.allowed) return null;

  const organizationVisibility = normalizeVisibility(organizationRow.visibility);
  const organizationAuthorized = access.authorized || viewerAccess.organizationMember || viewerAccess.teamIds.size > 0;
  const visibleTeams = access.authorized || organizationVisibility === "PUBLIC" || organizationVisibility === "UNLISTED"
    ? teams
    : [];
  const seasonIds = visibleTeams.map((team) => team.id);
  const { data: seasonRows } = seasonIds.length
    ? await admin
        .from("seasons")
        .select("id,team_id,name,active")
        .in("team_id", seasonIds)
        .eq("active", true)
    : { data: [] };
  const seasonByTeam = new Map((seasonRows as SeasonRow[] | null ?? []).map((season) => [season.team_id, season]));

  return {
    id: organizationRow.id,
    name: organizationRow.name,
    slug: organizationRow.slug,
    city: organizationRow.city ?? undefined,
    state: organizationRow.state ?? undefined,
    logoUrl: organizationRow.logo_url ?? undefined,
    visibility: normalizeVisibility(organizationRow.visibility),
    authorized: organizationAuthorized,
    canFollow: !organizationAuthorized,
    adminCount: activeMembers.filter((member) => member.role === "ADMIN").length,
    memberCount: activeMembers.length,
    teams: visibleTeams.map((team) => {
      const season = seasonByTeam.get(team.id);
      const teamWorkspaceAccess = viewerAccess.teamIds.has(team.id);
      const teamAuthorized = viewerAccess.organizationMember || teamWorkspaceAccess;
      return {
        id: team.id,
        name: team.name,
        level: team.level ?? undefined,
        active: Boolean(team.active),
        visibility: organizationVisibility,
        authorized: teamAuthorized,
        workspaceAccess: teamWorkspaceAccess,
        season: season ? { id: season.id, name: season.name } : undefined,
      };
    }),
  };
}

export async function getPublicTeamDirectory(identifier: string): Promise<PublicTeamDirectory | null> {
  if (!isUuid(identifier)) return null;

  const admin = createAdminClient();
  const { data: team, error: teamError } = await admin
    .from("teams")
    .select("id,organization_id,name,level,team_type,age_group,city,state,logo_url,active,visibility")
    .eq("id", identifier)
    .maybeSingle();

  if (teamError || !team || !team.active || isProgramContainerTeamRow(team as TeamRow)) return null;
  const teamRow = team as TeamRow;

  const { data: organization, error: organizationError } = await admin
    .from("organizations")
    .select("id,name,slug,city,state,logo_url,visibility")
    .eq("id", teamRow.organization_id)
    .maybeSingle();

  if (organizationError || !organization) return null;
  const organizationRow = organization as OrganizationRow;
  const organizationVisibility = normalizeVisibility(organizationRow.visibility);
  const viewerAccess = await viewerAccessForOrganization(organizationRow.id, [teamRow.id]);

  const access = await canViewTeam(teamRow.id, organizationRow.id, organizationVisibility);
  if (!access.allowed) return null;
  const teamWorkspaceAccess = viewerAccess.teamIds.has(teamRow.id);
  const teamAuthorized = access.authorized || viewerAccess.organizationMember || teamWorkspaceAccess;

  const { data: seasonRows } = await admin
    .from("seasons")
    .select("id,team_id,name,active")
    .eq("team_id", teamRow.id)
    .eq("active", true)
    .order("starts_on", { ascending: false, nullsFirst: false })
    .limit(1);
  const season = (seasonRows as SeasonRow[] | null)?.[0];

  let membershipQuery = admin
    .from("player_team_memberships")
    .select("player_id,jersey_number")
    .eq("team_id", teamRow.id)
    .eq("active", true)
    .limit(80);
  if (season?.id) membershipQuery = membershipQuery.eq("season_id", season.id);
  const { data: membershipRows, error: membershipError } = await membershipQuery;
  if (membershipError) {
    console.warn("Public team roster query failed", {
      teamId: teamRow.id,
      code: membershipError.code,
      message: membershipError.message,
    });
  }
  const playerMemberships = (membershipRows ?? []) as Array<{ player_id?: string | null; jersey_number?: number | null }>;
  const membershipByPlayer = new Map(playerMemberships.filter((membership) => membership.player_id).map((membership) => [membership.player_id as string, membership]));
  const playerIds = [...new Set(playerMemberships.map((membership) => membership.player_id).filter(Boolean) as string[])];

  const { data: playerRows, error: playerError } = playerIds.length
    ? await admin
        .from("players")
        .select("id,first_name,last_name,jersey_number,graduation_year,primary_position,secondary_position,bats,throws,height,weight,active")
        .in("id", playerIds)
        .eq("active", true)
    : { data: [] };
  if (playerError) {
    console.warn("Public team player query failed", {
      teamId: teamRow.id,
      code: playerError.code,
      message: playerError.message,
    });
  }

  const { data: gameRows, error: gameError } = season
    ? await admin
        .from("games")
        .select("id,opponent,starts_at,game_date,home_away,location,game_type,status,result,our_score,opponent_score")
        .eq("team_id", teamRow.id)
        .eq("season_id", season.id)
        .order("game_date", { ascending: false })
        .limit(60)
    : { data: [] };
  if (gameError) {
    console.warn("Public team game query failed", {
      teamId: teamRow.id,
      code: gameError.code,
      message: gameError.message,
    });
  }

  return {
    id: teamRow.id,
    name: teamRow.name,
    level: teamRow.level ?? undefined,
    teamType: teamRow.team_type ?? undefined,
    ageGroup: teamRow.age_group ?? undefined,
    city: teamRow.city ?? organizationRow.city ?? undefined,
    state: teamRow.state ?? organizationRow.state ?? undefined,
    logoUrl: teamRow.logo_url ?? organizationRow.logo_url ?? undefined,
    active: Boolean(teamRow.active),
    visibility: organizationVisibility,
    authorized: teamAuthorized,
    workspaceAccess: teamWorkspaceAccess,
    season: season ? { id: season.id, name: season.name } : undefined,
    organization: {
      id: organizationRow.id,
      name: organizationRow.name,
      slug: organizationRow.slug,
      city: organizationRow.city ?? undefined,
      state: organizationRow.state ?? undefined,
      logoUrl: organizationRow.logo_url ?? undefined,
      visibility: organizationVisibility,
    },
    canFollow: !teamAuthorized,
    roster: (playerRows ?? [])
      .map((player: PlayerRow) => ({
        id: player.id,
        name: `${player.first_name} ${player.last_name}`.trim(),
        jerseyNumber: membershipByPlayer.get(player.id)?.jersey_number ?? player.jersey_number ?? undefined,
        graduationYear: player.graduation_year ?? undefined,
        primaryPosition: player.primary_position,
        secondaryPosition: player.secondary_position ?? undefined,
        bats: player.bats ?? undefined,
        throws: player.throws ?? undefined,
        height: player.height ?? undefined,
        weight: player.weight ?? undefined,
      }))
      .sort((a, b) => (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999) || a.name.localeCompare(b.name)),
    games: (gameRows as GameRow[] | null ?? []).map(mapGameRow),
  };
}

export async function getPublicGameDetail(gameId: string): Promise<PublicGameDetail | null> {
  if (!isUuid(gameId)) return null;

  const admin = createAdminClient();
  const { data: gameData, error: gameError } = await admin
    .from("games")
    .select("id,organization_id,team_id,season_id,opponent,starts_at,game_date,home_away,location,game_type,status,result,our_score,opponent_score")
    .eq("id", gameId)
    .maybeSingle();

  if (gameError || !gameData) return null;
  const gameRow = gameData as GameRow & { organization_id: string; team_id: string; season_id: string };
  const team = await getPublicTeamDirectory(gameRow.team_id);
  if (!team) return null;

  const matchingGame = team.games.find((game) => game.id === gameId);
  if (!matchingGame) return null;

  const upcomingGames = team.games
    .filter((game) => {
      if (game.id === gameId || game.result || game.status === "final") return false;
      const date = new Date(`${game.gameDate}T12:00:00`);
      const current = new Date(`${matchingGame.gameDate}T12:00:00`);
      return date >= current;
    })
    .sort((a, b) => new Date(`${a.gameDate}T12:00:00`).getTime() - new Date(`${b.gameDate}T12:00:00`).getTime());

  const recentGames = team.games
    .filter((game) => game.id !== gameId && (game.result || game.status === "final"))
    .sort((a, b) => new Date(`${b.gameDate}T12:00:00`).getTime() - new Date(`${a.gameDate}T12:00:00`).getTime())
    .slice(0, 4);

  const { data: detailRow } = await admin
    .from("public_game_details")
    .select("game_id,team_record,opponent_record,event_name,venue,field_label,city,state,public_notes,comparison,probable_starters,recent_matchup,linescore,team_totals,play_by_play,box_score,highlights")
    .eq("game_id", gameId)
    .maybeSingle();

  const detail = detailRow as PublicGameDetailRow | null;
  const starterRecord = asRecord(detail?.probable_starters);

  return {
    game: {
      ...matchingGame,
      organizationId: gameRow.organization_id,
      teamId: gameRow.team_id,
      seasonId: gameRow.season_id,
    },
    team,
    detail: {
      teamRecord: detail?.team_record ?? undefined,
      opponentRecord: detail?.opponent_record ?? undefined,
      eventName: detail?.event_name ?? matchingGame.gameType ?? undefined,
      venue: detail?.venue ?? undefined,
      fieldLabel: detail?.field_label ?? undefined,
      city: detail?.city ?? undefined,
      state: detail?.state ?? undefined,
      publicNotes: detail?.public_notes ?? undefined,
      comparison: parseComparison(detail?.comparison),
      probableStarters: {
        team: parseStarter(starterRecord.team),
        opponent: parseStarter(starterRecord.opponent),
      },
      recentMatchup: parseRecentMatchup(detail?.recent_matchup),
      linescore: parseLinescore(detail?.linescore),
      teamTotals: parseTotals(detail?.team_totals),
      playByPlay: parsePlayByPlay(detail?.play_by_play),
      boxScore: parseBoxScore(detail?.box_score),
      highlights: parseHighlights(detail?.highlights),
    },
    nextGame: upcomingGames[0],
    recentGames,
    workspaceAccess: team.workspaceAccess,
    canFollow: team.canFollow,
  };
}

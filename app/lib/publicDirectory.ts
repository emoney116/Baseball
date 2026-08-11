import { createAdminClient } from "./supabase/admin";
import { createClient } from "./supabase/server";

type Visibility = "PUBLIC" | "UNLISTED" | "PRIVATE";

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  visibility: string | null;
};

type TeamRow = {
  id: string;
  organization_id: string;
  name: string;
  level: string | null;
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
  opponent: string;
  game_date: string;
  home_away: string;
  location: string | null;
  result: string | null;
  our_score: number | null;
  opponent_score: number | null;
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
  gameDate: string;
  homeAway: string;
  location?: string;
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
  season?: {
    id: string;
    name: string;
  };
};

export type PublicOrganizationDirectory = {
  id: string;
  name: string;
  slug: string;
  visibility: Visibility;
  teams: PublicTeamSummary[];
  authorized: boolean;
};

export type PublicTeamDirectory = PublicTeamSummary & {
  organization: {
    id: string;
    name: string;
    slug: string;
    visibility: Visibility;
  };
  roster: PublicRosterPlayer[];
  games: PublicGameSummary[];
  authorized: boolean;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeVisibility(value: unknown): Visibility {
  return value === "PUBLIC" || value === "UNLISTED" || value === "PRIVATE" ? value : "PRIVATE";
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

async function canViewTeam(teamId: string, organizationId: string, teamVisibility: Visibility, organizationVisibility: Visibility) {
  if (teamVisibility === "PUBLIC" || teamVisibility === "UNLISTED" || organizationVisibility === "PUBLIC") {
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
    .select("id,name,slug,visibility")
    .limit(1);
  const { data: organization, error } = isUuid(identifier)
    ? await organizationQuery.eq("id", identifier).maybeSingle()
    : await organizationQuery.eq("slug", identifier).maybeSingle();

  if (error || !organization) return null;
  const organizationRow = organization as OrganizationRow;

  const { data: teamRows, error: teamError } = await admin
    .from("teams")
    .select("id,organization_id,name,level,active,visibility")
    .eq("organization_id", organizationRow.id)
    .eq("active", true)
    .order("name", { ascending: true });

  if (teamError) return null;

  const teams = (teamRows ?? []) as TeamRow[];
  const access = await canViewOrganization(
    organizationRow.id,
    teams.map((team) => team.id),
    normalizeVisibility(organizationRow.visibility),
  );
  if (!access.allowed) return null;

  const visibleTeams = access.authorized
    ? teams
    : teams.filter((team) => normalizeVisibility(team.visibility) !== "PRIVATE");
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
    visibility: normalizeVisibility(organizationRow.visibility),
    authorized: access.authorized,
    teams: visibleTeams.map((team) => {
      const season = seasonByTeam.get(team.id);
      return {
        id: team.id,
        name: team.name,
        level: team.level ?? undefined,
        active: Boolean(team.active),
        visibility: normalizeVisibility(team.visibility),
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
    .select("id,organization_id,name,level,active,visibility")
    .eq("id", identifier)
    .maybeSingle();

  if (teamError || !team || !team.active) return null;
  const teamRow = team as TeamRow;

  const { data: organization, error: organizationError } = await admin
    .from("organizations")
    .select("id,name,slug,visibility")
    .eq("id", teamRow.organization_id)
    .maybeSingle();

  if (organizationError || !organization) return null;
  const organizationRow = organization as OrganizationRow;

  const access = await canViewTeam(
    teamRow.id,
    organizationRow.id,
    normalizeVisibility(teamRow.visibility),
    normalizeVisibility(organizationRow.visibility),
  );
  if (!access.allowed) return null;

  const { data: seasonRows } = await admin
    .from("seasons")
    .select("id,team_id,name,active")
    .eq("team_id", teamRow.id)
    .eq("active", true)
    .order("starts_on", { ascending: false, nullsFirst: false })
    .limit(1);
  const season = (seasonRows as SeasonRow[] | null)?.[0];

  const { data: membershipRows } = await admin
    .from("player_team_memberships")
    .select("player_id")
    .eq("team_id", teamRow.id)
    .eq("active", true)
    .limit(80);
  const playerIds = [...new Set((membershipRows ?? []).map((membership) => membership.player_id as string | null).filter(Boolean))];

  const { data: playerRows } = playerIds.length
    ? await admin
        .from("players")
        .select("id,first_name,last_name,jersey_number,graduation_year,primary_position,secondary_position,bats,throws,height,weight,active")
        .in("id", playerIds)
        .eq("active", true)
    : { data: [] };

  const { data: gameRows } = season
    ? await admin
        .from("games")
        .select("id,opponent,game_date,home_away,location,result,our_score,opponent_score")
        .eq("team_id", teamRow.id)
        .eq("season_id", season.id)
        .order("game_date", { ascending: false })
        .limit(10)
    : { data: [] };

  return {
    id: teamRow.id,
    name: teamRow.name,
    level: teamRow.level ?? undefined,
    active: Boolean(teamRow.active),
    visibility: normalizeVisibility(teamRow.visibility),
    season: season ? { id: season.id, name: season.name } : undefined,
    organization: {
      id: organizationRow.id,
      name: organizationRow.name,
      slug: organizationRow.slug,
      visibility: normalizeVisibility(organizationRow.visibility),
    },
    authorized: access.authorized,
    roster: (playerRows ?? [])
      .map((player: PlayerRow) => ({
        id: player.id,
        name: `${player.first_name} ${player.last_name}`.trim(),
        jerseyNumber: player.jersey_number ?? undefined,
        graduationYear: player.graduation_year ?? undefined,
        primaryPosition: player.primary_position,
        secondaryPosition: player.secondary_position ?? undefined,
        bats: player.bats ?? undefined,
        throws: player.throws ?? undefined,
        height: player.height ?? undefined,
        weight: player.weight ?? undefined,
      }))
      .sort((a, b) => (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999) || a.name.localeCompare(b.name)),
    games: (gameRows as GameRow[] | null ?? []).map((game) => ({
      id: game.id,
      opponent: game.opponent,
      gameDate: game.game_date,
      homeAway: game.home_away,
      location: game.location ?? undefined,
      result: game.result ?? undefined,
      ourScore: game.our_score ?? 0,
      opponentScore: game.opponent_score ?? 0,
    })),
  };
}

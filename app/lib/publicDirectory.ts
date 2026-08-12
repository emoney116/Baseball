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
    .select("id,organization_id,name,level,team_type,active,visibility")
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

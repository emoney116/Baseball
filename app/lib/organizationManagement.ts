import type { createAdminClient } from "./supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export type OrganizationVisibility = "PUBLIC" | "UNLISTED" | "PRIVATE";
export type OrgRole = "ADMIN" | "MEMBER";

export type OrganizationManageData = {
  organization: {
    id: string;
    name: string;
    slug?: string;
    city?: string;
    state?: string;
    logoUrl?: string;
    visibility: OrganizationVisibility;
  };
  teams: Array<{
    id: string;
    name: string;
    level?: string;
    teamType?: string;
    ageGroup?: string;
    city?: string;
    state?: string;
    logoUrl?: string;
    visibility: OrganizationVisibility;
    active: boolean;
    season?: {
      id: string;
      name: string;
    };
  }>;
  members: Array<{
    profileId: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    displayName: string;
    avatarUrl?: string;
    role: OrgRole;
    active: boolean;
    teams: Array<{
      id: string;
      name: string;
      role?: string;
      title?: string;
    }>;
  }>;
  invitations: Array<{
    id: string;
    email: string;
    status: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
    staffRole: string;
    accessRole: "ADMIN" | "COACH";
    orgRole: OrgRole;
    expiresAt: string;
    acceptedAt?: string;
    createdAt: string;
    updatedAt: string;
    teamNames: string[];
  }>;
};

type OrganizationRow = {
  id: string;
  name: string;
  slug?: string | null;
  city?: string | null;
  state?: string | null;
  logo_url?: string | null;
  visibility?: string | null;
};

type TeamRow = {
  id: string;
  name: string;
  level?: string | null;
  team_type?: string | null;
  age_group?: string | null;
  city?: string | null;
  state?: string | null;
  logo_url?: string | null;
  visibility?: string | null;
  active?: boolean | null;
};

type SeasonRow = {
  id: string;
  team_id: string;
  name: string;
  active?: boolean | null;
};

type OrganizationMembershipRow = {
  profile_id: string;
  role?: string | null;
  active?: boolean | null;
};

type ProfileRow = {
  id: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
};

type ProfileTeamMembershipRow = {
  profile_id: string;
  team_id: string;
  role?: string | null;
  title?: string | null;
  active?: boolean | null;
};

type InvitationRow = {
  id: string;
  email: string;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
  staff_role?: string | null;
  access_role?: string | null;
  org_role?: string | null;
  expires_at: string;
  accepted_at?: string | null;
  created_at: string;
  updated_at: string;
};

type InvitationMembershipRow = {
  invitation_id: string;
  team_id: string;
};

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export function cleanImageValue(value: unknown) {
  if (value === null) return null;
  const text = cleanText(value, 750_000);
  if (!text) return "";
  if (/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(text)) return text;
  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

export function normalizeVisibility(value: unknown): OrganizationVisibility {
  return value === "PUBLIC" || value === "UNLISTED" || value === "PRIVATE" ? value : "PRIVATE";
}

export function normalizeOrgRole(value: unknown): OrgRole {
  return typeof value === "string" && value.toUpperCase() === "ADMIN" ? "ADMIN" : "MEMBER";
}

export function orgRoleToMembershipRole(role: OrgRole) {
  return role === "ADMIN" ? "ADMIN" : "COACH";
}

export async function resolveOrganizationByIdentifier(admin: AdminClient, identifier: string) {
  const query = admin
    .from("organizations")
    .select("id,name,slug,city,state,logo_url,visibility")
    .limit(1);
  const { data, error } = isUuid(identifier)
    ? await query.eq("id", identifier).maybeSingle()
    : await query.eq("slug", identifier).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as OrganizationRow | null) ?? null;
}

export async function hasOrganizationAdminAccess(admin: AdminClient, profileId: string, organizationId: string) {
  const { count, error } = await admin
    .from("organization_memberships")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("profile_id", profileId)
    .eq("role", "ADMIN")
    .eq("active", true);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

export async function countOtherOrganizationAdmins(admin: AdminClient, organizationId: string, profileId: string) {
  const { count, error } = await admin
    .from("organization_memberships")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("role", "ADMIN")
    .eq("active", true)
    .neq("profile_id", profileId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function readOrganizationManageData(admin: AdminClient, organizationId: string): Promise<OrganizationManageData> {
  const { data: organization, error: organizationError } = await admin
    .from("organizations")
    .select("id,name,slug,city,state,logo_url,visibility")
    .eq("id", organizationId)
    .maybeSingle();
  if (organizationError) throw new Error(organizationError.message);
  if (!organization) throw new Error("Organization not found.");
  const organizationRow = organization as OrganizationRow;

  const [{ data: teamRows, error: teamsError }, { data: membershipRows, error: membershipsError }, { data: invitationRows, error: invitationsError }] =
    await Promise.all([
      admin
        .from("teams")
        .select("id,name,level,team_type,age_group,city,state,logo_url,visibility,active")
        .eq("organization_id", organizationId)
        .order("active", { ascending: false })
        .order("name", { ascending: true }),
      admin
        .from("organization_memberships")
        .select("profile_id,role,active")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: true }),
      admin
        .from("team_invitations")
        .select("id,email,status,staff_role,access_role,org_role,expires_at,accepted_at,created_at,updated_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(80),
    ]);
  if (teamsError) throw new Error(teamsError.message);
  if (membershipsError) throw new Error(membershipsError.message);
  if (invitationsError) throw new Error(invitationsError.message);

  const teams = (teamRows ?? []) as TeamRow[];
  const teamIds = teams.map((team) => team.id);
  const memberRows = (membershipRows ?? []) as OrganizationMembershipRow[];
  const profileIds = [...new Set(memberRows.map((membership) => membership.profile_id).filter(Boolean))];
  const inviteRows = (invitationRows ?? []) as InvitationRow[];
  const invitationIds = inviteRows.map((invite) => invite.id);

  const [
    { data: seasonRows, error: seasonsError },
    { data: profileRows, error: profilesError },
    { data: profileTeamRows, error: profileTeamsError },
    { data: inviteAssignmentRows, error: inviteAssignmentsError },
  ] = await Promise.all([
    teamIds.length
      ? admin
          .from("seasons")
          .select("id,team_id,name,active")
          .in("team_id", teamIds)
          .eq("active", true)
      : Promise.resolve({ data: [], error: null }),
    profileIds.length
      ? admin
          .from("profiles")
          .select("id,email,first_name,last_name,display_name,avatar_url")
          .in("id", profileIds)
      : Promise.resolve({ data: [], error: null }),
    profileIds.length && teamIds.length
      ? admin
          .from("profile_team_memberships")
          .select("profile_id,team_id,role,title,active")
          .in("profile_id", profileIds)
          .in("team_id", teamIds)
          .eq("active", true)
      : Promise.resolve({ data: [], error: null }),
    invitationIds.length
      ? admin
          .from("team_invitation_memberships")
          .select("invitation_id,team_id")
          .in("invitation_id", invitationIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (seasonsError) throw new Error(seasonsError.message);
  if (profilesError) throw new Error(profilesError.message);
  if (profileTeamsError) throw new Error(profileTeamsError.message);
  if (inviteAssignmentsError) throw new Error(inviteAssignmentsError.message);

  const seasonByTeam = new Map<string, SeasonRow>();
  for (const season of (seasonRows ?? []) as SeasonRow[]) {
    if (!seasonByTeam.has(season.team_id)) seasonByTeam.set(season.team_id, season);
  }

  const teamById = new Map(teams.map((team) => [team.id, team]));
  const profileById = new Map(((profileRows ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]));
  const profileTeamsByProfile = new Map<string, ProfileTeamMembershipRow[]>();
  for (const membership of (profileTeamRows ?? []) as ProfileTeamMembershipRow[]) {
    profileTeamsByProfile.set(membership.profile_id, [...(profileTeamsByProfile.get(membership.profile_id) ?? []), membership]);
  }

  const invitationTeams = new Map<string, string[]>();
  for (const assignment of (inviteAssignmentRows ?? []) as InvitationMembershipRow[]) {
    const teamName = teamById.get(assignment.team_id)?.name;
    if (teamName) invitationTeams.set(assignment.invitation_id, [...(invitationTeams.get(assignment.invitation_id) ?? []), teamName]);
  }

  return {
    organization: {
      id: organizationRow.id,
      name: organizationRow.name,
      slug: organizationRow.slug ?? undefined,
      city: organizationRow.city ?? undefined,
      state: organizationRow.state ?? undefined,
      logoUrl: organizationRow.logo_url ?? undefined,
      visibility: normalizeVisibility(organizationRow.visibility),
    },
    teams: teams.map((team) => {
      const season = seasonByTeam.get(team.id);
      return {
        id: team.id,
        name: team.name,
        level: team.level ?? undefined,
        teamType: team.team_type ?? undefined,
        ageGroup: team.age_group ?? undefined,
        city: team.city ?? undefined,
        state: team.state ?? undefined,
        logoUrl: team.logo_url ?? undefined,
        visibility: normalizeVisibility(team.visibility),
        active: team.active !== false,
        season: season ? { id: season.id, name: season.name } : undefined,
      };
    }),
    members: memberRows.map((membership) => {
      const profile = profileById.get(membership.profile_id);
      const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
      return {
        profileId: membership.profile_id,
        email: profile?.email ?? undefined,
        firstName: profile?.first_name ?? undefined,
        lastName: profile?.last_name ?? undefined,
        displayName: profile?.display_name || name || profile?.email || "Coach",
        avatarUrl: profile?.avatar_url ?? undefined,
        role: normalizeOrgRole(membership.role),
        active: membership.active !== false,
        teams: (profileTeamsByProfile.get(membership.profile_id) ?? []).map((teamMembership) => ({
          id: teamMembership.team_id,
          name: teamById.get(teamMembership.team_id)?.name ?? "Team",
          role: teamMembership.role ?? undefined,
          title: teamMembership.title ?? undefined,
        })),
      };
    }),
    invitations: inviteRows.map((invite) => {
      const status = invite.status === "PENDING" && new Date(invite.expires_at).getTime() <= Date.now() ? "EXPIRED" : invite.status;
      return {
        id: invite.id,
        email: invite.email,
        status,
        staffRole: invite.staff_role ?? "Assistant Coach",
        accessRole: invite.access_role === "ADMIN" ? "ADMIN" : "COACH",
        orgRole: normalizeOrgRole(invite.org_role),
        expiresAt: invite.expires_at,
        acceptedAt: invite.accepted_at ?? undefined,
        createdAt: invite.created_at,
        updatedAt: invite.updated_at,
        teamNames: invitationTeams.get(invite.id) ?? [],
      };
    }),
  };
}

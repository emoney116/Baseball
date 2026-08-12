import type { createAdminClient } from "../../../lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export type InvitationSummary = {
  id: string;
  organizationId: string;
  organizationName: string;
  email: string;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
  staffRole: string;
  accessRole: "ADMIN" | "COACH";
  orgRole: "ADMIN" | "MEMBER";
  staffMemberId?: string;
  expiresAt: string;
  acceptedAt?: string;
  invitedByProfileId?: string;
  teamIds: string[];
  seasonIds: string[];
  teamNames: string[];
  createdAt: string;
  updatedAt: string;
};

type InvitationRow = {
  id: string;
  organization_id: string;
  email: string;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
  staff_role?: string | null;
  access_role?: string | null;
  org_role?: string | null;
  staff_member_id?: string | null;
  invited_by_profile_id?: string | null;
  expires_at: string;
  accepted_at?: string | null;
  created_at: string;
  updated_at: string;
};

export async function readInvitationSummary(admin: AdminClient, invitationId: string): Promise<InvitationSummary | null> {
  const { data: invitation, error } = await admin
    .from("team_invitations")
    .select("id,organization_id,email,status,staff_role,access_role,org_role,staff_member_id,invited_by_profile_id,expires_at,accepted_at,created_at,updated_at")
    .eq("id", invitationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!invitation) return null;
  return completeInvitationSummary(admin, invitation);
}

export async function readInvitationSummaryByHash(admin: AdminClient, tokenHash: string): Promise<InvitationSummary | null> {
  const { data: invitation, error } = await admin
    .from("team_invitations")
    .select("id,organization_id,email,status,staff_role,access_role,org_role,staff_member_id,invited_by_profile_id,expires_at,accepted_at,created_at,updated_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!invitation) return null;
  return completeInvitationSummary(admin, invitation);
}

export async function ensureRouteProfile(
  admin: AdminClient,
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> },
) {
  const firstName = typeof user.user_metadata?.first_name === "string" ? user.user_metadata.first_name : undefined;
  const lastName = typeof user.user_metadata?.last_name === "string" ? user.user_metadata.last_name : undefined;
  const displayName =
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    (typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name : undefined) ||
    user.email ||
    "Coach";

  const { error } = await admin.from("profiles").upsert(
    {
      id: user.id,
      email: user.email ? user.email.toLowerCase() : null,
      first_name: firstName ?? null,
      last_name: lastName ?? null,
      display_name: displayName,
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(error.message);
}

async function completeInvitationSummary(admin: AdminClient, invitation: InvitationRow): Promise<InvitationSummary> {
  const [{ data: organization, error: orgError }, { data: assignments, error: assignmentError }] = await Promise.all([
    admin.from("organizations").select("id,name").eq("id", invitation.organization_id).maybeSingle(),
    admin
      .from("team_invitation_memberships")
      .select("team_id,season_id,staff_role,access_role")
      .eq("invitation_id", invitation.id),
  ]);
  if (orgError) throw new Error(orgError.message);
  if (assignmentError) throw new Error(assignmentError.message);

  const teamIds = [...new Set((assignments ?? []).map((item) => item.team_id).filter(Boolean))];
  const seasonIds = [...new Set((assignments ?? []).map((item) => item.season_id).filter(Boolean))];
  const [{ data: teams, error: teamsError }, { data: seasons, error: seasonsError }] = await Promise.all([
    teamIds.length ? admin.from("teams").select("id,name").in("id", teamIds) : Promise.resolve({ data: [], error: null }),
    seasonIds.length ? admin.from("seasons").select("id,name").in("id", seasonIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (teamsError) throw new Error(teamsError.message);
  if (seasonsError) throw new Error(seasonsError.message);

  const teamNameById = new Map((teams ?? []).map((team) => [team.id, team.name]));
  const seasonNameById = new Map((seasons ?? []).map((season) => [season.id, season.name]));
  const teamNames = (assignments ?? []).map((assignment) => {
    const teamName = teamNameById.get(assignment.team_id) ?? "Team";
    const seasonName = assignment.season_id ? seasonNameById.get(assignment.season_id) : undefined;
    return [teamName, seasonName].filter(Boolean).join(" - ");
  });
  const status = invitation.expires_at && new Date(invitation.expires_at).getTime() <= Date.now() && invitation.status === "PENDING"
    ? "EXPIRED"
    : invitation.status;

  return {
    id: invitation.id,
    organizationId: invitation.organization_id,
    organizationName: organization?.name ?? "Baseball organization",
    email: invitation.email,
    status,
    staffRole: invitation.staff_role ?? "Assistant Coach",
    accessRole: invitation.access_role === "ADMIN" ? "ADMIN" : "COACH",
    orgRole: invitation.org_role === "ADMIN" ? "ADMIN" : "MEMBER",
    staffMemberId: invitation.staff_member_id ?? undefined,
    invitedByProfileId: invitation.invited_by_profile_id ?? undefined,
    expiresAt: invitation.expires_at,
    acceptedAt: invitation.accepted_at ?? undefined,
    teamIds,
    seasonIds,
    teamNames,
    createdAt: invitation.created_at,
    updatedAt: invitation.updated_at,
  };
}

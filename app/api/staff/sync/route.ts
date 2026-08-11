import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { createClient } from "../../../lib/supabase/server";

export const runtime = "nodejs";

type StaffMemberInput = {
  id?: string;
  organizationId?: string;
  profileId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatarUrl?: string;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type StaffMembershipInput = {
  id?: string;
  staffMemberId?: string;
  profileId?: string;
  teamId?: string;
  seasonId?: string;
  baseballRole?: string;
  accessRole?: "ADMIN" | "COACH";
  active?: boolean;
  invitationId?: string;
  createdAt?: string;
  updatedAt?: string;
};

const ADMIN_ROLES = new Set(["OWNER", "ADMIN", "HEAD_COACH"]);
const ADMIN_TITLES = new Set(["PROGRAM ADMIN", "OWNER", "HEAD COACH"]);

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ ok: false, message: "Sign in before saving staff." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      organizationId?: string;
      staffMembers?: StaffMemberInput[];
      staffTeamMemberships?: StaffMembershipInput[];
    };
    const staffMembers = (Array.isArray(body.staffMembers) ? body.staffMembers : [])
      .filter((member) => member.id && member.displayName && !member.id.startsWith("profile-staff-"));
    const memberships = (Array.isArray(body.staffTeamMemberships) ? body.staffTeamMemberships : [])
      .filter((membership) => membership.id && membership.staffMemberId && membership.teamId && !membership.id.startsWith("profile-team-"));

    if (!staffMembers.length && !memberships.length) {
      return NextResponse.json({ ok: true, staffMembers: 0, staffTeamMemberships: 0 });
    }

    const admin = createAdminClient();
    const teamIds = [...new Set(memberships.map((membership) => membership.teamId).filter(Boolean))] as string[];
    if (!teamIds.length) {
      return NextResponse.json({ ok: false, message: "Choose a team before saving staff." }, { status: 400 });
    }

    const { data: teams, error: teamError } = await admin
      .from("teams")
      .select("id,organization_id,name")
      .in("id", teamIds);
    if (teamError) return NextResponse.json({ ok: false, message: teamError.message }, { status: 500 });
    const teamsById = new Map((teams ?? []).map((team) => [team.id, team]));
    const orgIds = [...new Set((teams ?? []).map((team) => team.organization_id))];
    if (orgIds.length !== 1 || (body.organizationId && body.organizationId !== orgIds[0])) {
      return NextResponse.json({ ok: false, message: "Staff changes must stay inside one organization." }, { status: 400 });
    }

    for (const teamId of teamIds) {
      const team = teamsById.get(teamId);
      if (!team || !(await canAdminStaffTeam(admin, authData.user.id, team.id, team.organization_id))) {
        return NextResponse.json({ ok: false, message: "You do not have permission to manage staff for this team." }, { status: 403 });
      }
    }

    const now = new Date().toISOString();
    if (staffMembers.length > 0) {
      const rows = staffMembers.map((member) => ({
        id: member.id,
        organization_id: orgIds[0],
        profile_id: member.profileId || null,
        email: member.email ? member.email.toLowerCase() : null,
        first_name: member.firstName ?? null,
        last_name: member.lastName ?? null,
        display_name: member.displayName ?? member.email ?? "Staff Member",
        avatar_url: member.avatarUrl ?? null,
        active: member.active !== false,
        created_at: member.createdAt ?? now,
        updated_at: member.updatedAt ?? now,
      }));
      const { error } = await admin.from("staff_members").upsert(rows, { onConflict: "id" });
      if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    if (memberships.length > 0) {
      const rows = memberships.map((membership) => ({
        id: membership.id,
        staff_member_id: membership.staffMemberId,
        profile_id: membership.profileId || null,
        team_id: membership.teamId,
        season_id: membership.seasonId || null,
        baseball_role: membership.baseballRole ?? "Assistant Coach",
        access_role: membership.accessRole ?? "COACH",
        active: membership.active !== false,
        invitation_id: membership.invitationId ?? null,
        created_at: membership.createdAt ?? now,
        updated_at: membership.updatedAt ?? now,
      }));
      const { error } = await admin.from("staff_team_memberships").upsert(rows, { onConflict: "staff_member_id,team_id,season_id" });
      if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, staffMembers: staffMembers.length, staffTeamMemberships: memberships.length });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to save staff changes." },
      { status: 500 },
    );
  }
}

async function canAdminStaffTeam(
  admin: ReturnType<typeof createAdminClient>,
  profileId: string,
  teamId: string,
  organizationId: string,
) {
  const [{ data: profile }, { data: orgMemberships }, { data: teamMemberships }] = await Promise.all([
    admin.from("profiles").select("role").eq("id", profileId).maybeSingle(),
    admin
      .from("organization_memberships")
      .select("role,active")
      .eq("profile_id", profileId)
      .eq("organization_id", organizationId)
      .eq("active", true),
    admin
      .from("profile_team_memberships")
      .select("role,title,active")
      .eq("profile_id", profileId)
      .eq("team_id", teamId)
      .eq("active", true),
  ]);

  const orgAllows = (orgMemberships ?? []).some((membership) => normalize(membership.role) === "ADMIN");
  if (orgAllows) return true;

  const teamAllows = (teamMemberships ?? []).some((membership) => {
    const role = normalize(membership.role);
    const title = normalize(membership.title);
    return ADMIN_ROLES.has(role) || ADMIN_TITLES.has(title);
  });
  if (teamAllows) return true;

  const profileRole = normalize(profile?.role);
  return profileRole === "ADMIN" && (teamMemberships ?? []).length > 0;
}

function normalize(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { createClient } from "../../../../lib/supabase/server";

export const runtime = "nodejs";

type StaffMembershipInput = {
  teamId?: string;
  seasonId?: string;
  baseballRole?: string;
  accessRole?: "ADMIN" | "COACH";
};

const ADMIN_ROLES = new Set(["OWNER", "ADMIN", "HEAD_COACH"]);
const ADMIN_TITLES = new Set(["PROGRAM ADMIN", "OWNER", "HEAD COACH"]);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ staffMemberId: string }> }) {
  try {
    const { staffMemberId } = await params;
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ ok: false, message: "Sign in before updating staff." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      email?: string;
      firstName?: string;
      lastName?: string;
      displayName?: string;
      memberships?: StaffMembershipInput[];
    };
    const requestedMemberships = normalizeRequestedMemberships(body.memberships ?? []);
    const admin = createAdminClient();

    const { data: staffMember, error: staffError } = await admin
      .from("staff_members")
      .select("id,organization_id,profile_id,email,display_name")
      .eq("id", staffMemberId)
      .maybeSingle();
    if (staffError) return NextResponse.json({ ok: false, message: staffError.message }, { status: 500 });
    if (!staffMember) return NextResponse.json({ ok: false, message: "Staff member was not found." }, { status: 404 });

    const { data: existingMemberships, error: membershipError } = await admin
      .from("staff_team_memberships")
      .select("id,staff_member_id,profile_id,team_id,season_id,baseball_role,access_role,active")
      .eq("staff_member_id", staffMemberId);
    if (membershipError) return NextResponse.json({ ok: false, message: membershipError.message }, { status: 500 });

    const allTeamIds = [
      ...new Set([
        ...(existingMemberships ?? []).map((membership) => membership.team_id),
        ...requestedMemberships.map((membership) => membership.teamId),
      ].filter(Boolean)),
    ];

    if (allTeamIds.length > 0) {
      const { data: teams, error: teamsError } = await admin
        .from("teams")
        .select("id,organization_id")
        .in("id", allTeamIds);
      if (teamsError) return NextResponse.json({ ok: false, message: teamsError.message }, { status: 500 });

      const teamsById = new Map((teams ?? []).map((team) => [team.id, team]));
      for (const teamId of allTeamIds) {
        const team = teamsById.get(teamId);
        if (!team || team.organization_id !== staffMember.organization_id) {
          return NextResponse.json({ ok: false, message: "Staff changes must stay inside one organization." }, { status: 400 });
        }
        if (!(await canAdminStaffTeam(admin, authData.user.id, team.id, team.organization_id))) {
          return NextResponse.json({ ok: false, message: "You do not have permission to manage staff for this team." }, { status: 403 });
        }
      }
    }

    for (const existing of existingMemberships ?? []) {
      if (!existing.active || existing.access_role !== "ADMIN" || !staffMember.profile_id) continue;
      const requested = requestedMemberships.find((membership) =>
        membership.teamId === existing.team_id && sameSeason(membership.seasonId, existing.season_id),
      );
      if (requested?.accessRole === "ADMIN") continue;
      if (!(await hasAnotherTeamAdmin(admin, staffMember.profile_id, existing.team_id))) {
        return NextResponse.json(
          { ok: false, message: "Add another admin before removing this staff member's final admin access." },
          { status: 409 },
        );
      }
    }

    const normalizedEmail = body.email?.trim().toLowerCase() || null;
    const firstName = body.firstName?.trim() || null;
    const lastName = body.lastName?.trim() || null;
    const displayName =
      body.displayName?.trim() ||
      [firstName, lastName].filter(Boolean).join(" ").trim() ||
      normalizedEmail ||
      staffMember.display_name ||
      "Staff Member";

    const { error: updateStaffError } = await admin
      .from("staff_members")
      .update({
        email: staffMember.profile_id ? staffMember.email : normalizedEmail,
        first_name: firstName,
        last_name: lastName,
        display_name: displayName,
        active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", staffMemberId);
    if (updateStaffError) return NextResponse.json({ ok: false, message: updateStaffError.message }, { status: 500 });

    for (const requested of requestedMemberships) {
      const existing = (existingMemberships ?? []).find((membership) =>
        membership.team_id === requested.teamId && sameSeason(membership.season_id, requested.seasonId),
      );
      const row = {
        staff_member_id: staffMemberId,
        profile_id: staffMember.profile_id ?? null,
        team_id: requested.teamId,
        season_id: requested.seasonId ?? null,
        baseball_role: requested.baseballRole,
        access_role: requested.accessRole,
        active: true,
        updated_at: new Date().toISOString(),
      };
      const result = existing
        ? await admin.from("staff_team_memberships").update(row).eq("id", existing.id)
        : await admin.from("staff_team_memberships").insert(row);
      if (result.error) return NextResponse.json({ ok: false, message: result.error.message }, { status: 500 });

      if (staffMember.profile_id) {
        const profileError = await upsertProfileTeamMembership(admin, staffMember.profile_id, requested.teamId, requested.seasonId, requested.accessRole, requested.baseballRole);
        if (profileError) return NextResponse.json({ ok: false, message: profileError }, { status: 500 });
      }
    }

    for (const existing of existingMemberships ?? []) {
      if (!existing.active) continue;
      const stillSelected = requestedMemberships.some((membership) =>
        membership.teamId === existing.team_id && sameSeason(membership.seasonId, existing.season_id),
      );
      if (stillSelected) continue;

      const { error } = await admin
        .from("staff_team_memberships")
        .update({ active: false, end_date: new Date().toISOString().slice(0, 10), updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

      if (staffMember.profile_id) {
        const profileError = await deactivateProfileTeamMembership(admin, staffMember.profile_id, existing.team_id, existing.season_id);
        if (profileError) return NextResponse.json({ ok: false, message: profileError }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to update staff." },
      { status: 500 },
    );
  }
}

function normalizeRequestedMemberships(memberships: StaffMembershipInput[]) {
  const seen = new Set<string>();
  return memberships
    .map((membership) => ({
      teamId: membership.teamId?.trim() ?? "",
      seasonId: membership.seasonId?.trim() || undefined,
      baseballRole: membership.baseballRole?.trim() || "Assistant Coach",
      accessRole: membership.accessRole === "ADMIN" ? "ADMIN" as const : "COACH" as const,
    }))
    .filter((membership) => {
      if (!membership.teamId) return false;
      const key = `${membership.teamId}:${membership.seasonId ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

async function upsertProfileTeamMembership(
  admin: ReturnType<typeof createAdminClient>,
  profileId: string,
  teamId: string,
  seasonId: string | undefined,
  accessRole: "ADMIN" | "COACH",
  staffRole: string,
) {
  const updateQuery = admin
    .from("profile_team_memberships")
    .update({ role: accessRole, title: staffRole, active: true, updated_at: new Date().toISOString() })
    .eq("profile_id", profileId)
    .eq("team_id", teamId);
  const { data: updatedRows, error: updateError } = await applySeasonFilter(updateQuery, seasonId).select("id");
  if (updateError) return updateError.message;
  if ((updatedRows ?? []).length > 0) return null;

  const { error: insertError } = await admin.from("profile_team_memberships").insert({
    profile_id: profileId,
    team_id: teamId,
    season_id: seasonId ?? null,
    role: accessRole,
    title: staffRole,
    active: true,
  });
  return insertError?.message ?? null;
}

async function deactivateProfileTeamMembership(
  admin: ReturnType<typeof createAdminClient>,
  profileId: string,
  teamId: string,
  seasonId: string | null | undefined,
) {
  const query = admin
    .from("profile_team_memberships")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("profile_id", profileId)
    .eq("team_id", teamId);
  const { error } = await applySeasonFilter(query, seasonId ?? undefined);
  return error?.message ?? null;
}

function applySeasonFilter<T extends { eq: (column: string, value: string) => T; is: (column: string, value: null) => T }>(query: T, seasonId?: string) {
  return seasonId ? query.eq("season_id", seasonId) : query.is("season_id", null);
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

async function hasAnotherTeamAdmin(admin: ReturnType<typeof createAdminClient>, targetProfileId: string, teamId: string) {
  const { count, error } = await admin
    .from("profile_team_memberships")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId)
    .eq("active", true)
    .neq("profile_id", targetProfileId)
    .in("role", ["OWNER", "ADMIN", "HEAD_COACH"]);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

function sameSeason(left?: string | null, right?: string | null) {
  return (left ?? "") === (right ?? "");
}

function normalize(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

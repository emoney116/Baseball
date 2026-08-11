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
const VIRTUAL_PROFILE_STAFF_PREFIX = "profile-staff-";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ staffMemberId: string }> }) {
  try {
    const { staffMemberId } = await params;
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ ok: false, message: "Sign in before updating staff." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      memberships?: StaffMembershipInput[];
    };
    const requestedMemberships = normalizeRequestedMemberships(body.memberships ?? []);
    if (requestedMemberships.length === 0) {
      return NextResponse.json({ ok: false, message: "Choose at least one team." }, { status: 400 });
    }
    const admin = createAdminClient();
    let resolvedStaffMemberId = staffMemberId;
    const virtualProfileId = parseVirtualProfileStaffId(staffMemberId);
    if (virtualProfileId) {
      const materialized = await materializeProfileStaffMember(admin, authData.user.id, virtualProfileId, requestedMemberships);
      if ("response" in materialized) return materialized.response;
      resolvedStaffMemberId = materialized.staffMemberId;
    } else if (!UUID_PATTERN.test(staffMemberId)) {
      return NextResponse.json({ ok: false, message: "Staff member was not found." }, { status: 404 });
    }

    const { data: staffMember, error: staffError } = await admin
      .from("staff_members")
      .select("id,organization_id,profile_id,email,display_name")
      .eq("id", resolvedStaffMemberId)
      .maybeSingle();
    if (staffError) return NextResponse.json({ ok: false, message: staffError.message }, { status: 500 });
    if (!staffMember) return NextResponse.json({ ok: false, message: "Staff member was not found." }, { status: 404 });

    const { data: existingMemberships, error: membershipError } = await admin
      .from("staff_team_memberships")
      .select("id,staff_member_id,profile_id,team_id,season_id,baseball_role,access_role,active")
      .eq("staff_member_id", resolvedStaffMemberId);
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

    const { error: updateStaffError } = await admin
      .from("staff_members")
      .update({
        active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", resolvedStaffMemberId);
    if (updateStaffError) return NextResponse.json({ ok: false, message: updateStaffError.message }, { status: 500 });

    for (const requested of requestedMemberships) {
      const existing = (existingMemberships ?? []).find((membership) =>
        membership.team_id === requested.teamId && sameSeason(membership.season_id, requested.seasonId),
      );
      const row = {
        staff_member_id: resolvedStaffMemberId,
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

function parseVirtualProfileStaffId(staffMemberId: string) {
  if (!staffMemberId.startsWith(VIRTUAL_PROFILE_STAFF_PREFIX)) return null;
  const profileId = staffMemberId.slice(VIRTUAL_PROFILE_STAFF_PREFIX.length);
  return UUID_PATTERN.test(profileId) ? profileId : null;
}

async function materializeProfileStaffMember(
  admin: ReturnType<typeof createAdminClient>,
  actorProfileId: string,
  profileId: string,
  requestedMemberships: ReturnType<typeof normalizeRequestedMemberships>,
): Promise<{ staffMemberId: string } | { response: NextResponse }> {
  const requestedTeamIds = [...new Set(requestedMemberships.map((membership) => membership.teamId).filter(Boolean))];
  if (requestedTeamIds.length === 0) {
    return { response: NextResponse.json({ ok: false, message: "Choose at least one team." }, { status: 400 }) };
  }

  const [{ data: profile, error: profileError }, { data: requestedTeams, error: teamsError }] = await Promise.all([
    admin.from("profiles").select("id,email,first_name,last_name,display_name,avatar_url").eq("id", profileId).maybeSingle(),
    admin.from("teams").select("id,organization_id").in("id", requestedTeamIds),
  ]);
  if (profileError) return { response: NextResponse.json({ ok: false, message: profileError.message }, { status: 500 }) };
  if (teamsError) return { response: NextResponse.json({ ok: false, message: teamsError.message }, { status: 500 }) };
  if (!profile) return { response: NextResponse.json({ ok: false, message: "Staff member was not found." }, { status: 404 }) };

  const teamsById = new Map((requestedTeams ?? []).map((team) => [team.id, team]));
  const organizationIds = new Set<string>();
  for (const teamId of requestedTeamIds) {
    const team = teamsById.get(teamId);
    if (!team) return { response: NextResponse.json({ ok: false, message: "One selected team was not found." }, { status: 400 }) };
    organizationIds.add(team.organization_id);
    if (!(await canAdminStaffTeam(admin, actorProfileId, team.id, team.organization_id))) {
      return { response: NextResponse.json({ ok: false, message: "You do not have permission to manage staff for this team." }, { status: 403 }) };
    }
  }
  if (organizationIds.size !== 1) {
    return { response: NextResponse.json({ ok: false, message: "Staff changes must stay inside one organization." }, { status: 400 }) };
  }
  const organizationId = [...organizationIds][0];

  const email = typeof profile.email === "string" ? profile.email.trim().toLowerCase() : null;
  const displayName =
    profile.display_name ||
    [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() ||
    email ||
    "Staff Member";

  let staffMemberId: string | undefined;
  const { data: existingByProfile, error: existingByProfileError } = await admin
    .from("staff_members")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (existingByProfileError) return { response: NextResponse.json({ ok: false, message: existingByProfileError.message }, { status: 500 }) };
  staffMemberId = existingByProfile?.id;

  if (!staffMemberId && email) {
    const { data: existingByEmail, error: existingByEmailError } = await admin
      .from("staff_members")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("email", email)
      .maybeSingle();
    if (existingByEmailError) return { response: NextResponse.json({ ok: false, message: existingByEmailError.message }, { status: 500 }) };
    staffMemberId = existingByEmail?.id;
  }

  if (staffMemberId) {
    const { error } = await admin
      .from("staff_members")
      .update({
        profile_id: profileId,
        email,
        first_name: profile.first_name ?? null,
        last_name: profile.last_name ?? null,
        display_name: displayName,
        avatar_url: profile.avatar_url ?? null,
        active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", staffMemberId);
    if (error) return { response: NextResponse.json({ ok: false, message: error.message }, { status: 500 }) };
  } else {
    const { data: inserted, error } = await admin
      .from("staff_members")
      .insert({
        organization_id: organizationId,
        profile_id: profileId,
        email,
        first_name: profile.first_name ?? null,
        last_name: profile.last_name ?? null,
        display_name: displayName,
        avatar_url: profile.avatar_url ?? null,
        active: true,
      })
      .select("id")
      .single();
    if (error) return { response: NextResponse.json({ ok: false, message: error.message }, { status: 500 }) };
    staffMemberId = inserted.id;
  }
  if (!staffMemberId) {
    return { response: NextResponse.json({ ok: false, message: "Staff member could not be prepared." }, { status: 500 }) };
  }

  const { data: orgTeams, error: orgTeamsError } = await admin.from("teams").select("id").eq("organization_id", organizationId);
  if (orgTeamsError) return { response: NextResponse.json({ ok: false, message: orgTeamsError.message }, { status: 500 }) };
  const orgTeamIds = (orgTeams ?? []).map((team) => team.id);
  if (orgTeamIds.length) {
    const { data: profileMemberships, error: profileMembershipsError } = await admin
      .from("profile_team_memberships")
      .select("team_id,season_id,role,title,active,created_at,updated_at")
      .eq("profile_id", profileId)
      .eq("active", true)
      .in("team_id", orgTeamIds);
    if (profileMembershipsError) return { response: NextResponse.json({ ok: false, message: profileMembershipsError.message }, { status: 500 }) };

    for (const membership of profileMemberships ?? []) {
      const { error } = await admin.from("staff_team_memberships").upsert({
        staff_member_id: staffMemberId,
        profile_id: profileId,
        team_id: membership.team_id,
        season_id: membership.season_id ?? null,
        baseball_role: baseballRoleFromProfileMembership(membership.title, membership.role),
        access_role: accessRoleFromProfileMembership(membership.role),
        active: true,
        created_at: membership.created_at ?? new Date().toISOString(),
        updated_at: membership.updated_at ?? new Date().toISOString(),
      }, { onConflict: "staff_member_id,team_id,season_id" });
      if (error) return { response: NextResponse.json({ ok: false, message: error.message }, { status: 500 }) };
    }
  }

  return { staffMemberId };
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

function accessRoleFromProfileMembership(role: unknown): "ADMIN" | "COACH" {
  return ADMIN_ROLES.has(normalize(role)) ? "ADMIN" : "COACH";
}

function baseballRoleFromProfileMembership(title: unknown, role: unknown) {
  const titleValue = String(title ?? "").trim();
  if (titleValue) return titleValue;
  return normalize(role) === "HEAD_COACH" ? "Head Coach" : "Assistant Coach";
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

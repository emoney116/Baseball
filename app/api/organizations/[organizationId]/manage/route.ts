import { NextResponse, type NextRequest } from "next/server";
import {
  cleanImageValue,
  cleanText,
  countOtherOrganizationAdmins,
  hasOrganizationAdminAccess,
  normalizeOrgRole,
  normalizeVisibility,
  orgRoleToMembershipRole,
  readOrganizationManageData,
  resolveOrganizationByIdentifier,
} from "../../../../lib/organizationManagement";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { createClient } from "../../../../lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ organizationId: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireOrgAdmin(params);
    const data = await readOrganizationManageData(auth.admin, auth.organization.id, auth.userId);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return handleManageError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireOrgAdmin(params);
    const body = (await request.json().catch(() => ({}))) as {
      type?: "general" | "member";
      name?: string;
      city?: string;
      state?: string;
      logoUrl?: string | null;
      visibility?: string;
      profileId?: string;
      role?: string;
      active?: boolean;
    };

    if (body.type === "member") {
      const profileId = cleanText(body.profileId, 80);
      if (!profileId) {
        return NextResponse.json({ ok: false, message: "Choose a staff member." }, { status: 400 });
      }
      const nextRole = normalizeOrgRole(body.role);
      const nextActive = body.active !== false;
      if ((!nextActive || nextRole !== "ADMIN") && (await isLastOrgAdmin(auth.admin, auth.organization.id, profileId))) {
        return NextResponse.json({ ok: false, message: "Every organization needs at least one admin." }, { status: 400 });
      }

      const { error } = await auth.admin
        .from("organization_memberships")
        .update({
          role: orgRoleToMembershipRole(nextRole),
          active: nextActive,
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", auth.organization.id)
        .eq("profile_id", profileId);
      if (error) throw new Error(error.message);
    } else {
      const updates: Record<string, string | null> = {};
      if (Object.prototype.hasOwnProperty.call(body, "name")) {
        const name = cleanText(body.name, 120);
        if (!name) {
          return NextResponse.json({ ok: false, message: "Organization name is required." }, { status: 400 });
        }
        updates.name = name;
      }
      if (Object.prototype.hasOwnProperty.call(body, "city")) updates.city = cleanText(body.city, 80) || null;
      if (Object.prototype.hasOwnProperty.call(body, "state")) updates.state = cleanText(body.state, 40) || null;
      if (Object.prototype.hasOwnProperty.call(body, "visibility")) updates.visibility = normalizeVisibility(body.visibility);
      if (Object.prototype.hasOwnProperty.call(body, "logoUrl")) {
        const logoUrl = cleanImageValue(body.logoUrl);
        if (logoUrl === "") {
          return NextResponse.json({ ok: false, message: "Choose a valid image." }, { status: 400 });
        }
        updates.logo_url = logoUrl;
      }

      if (Object.keys(updates).length) {
        updates.updated_at = new Date().toISOString();
        const { error } = await auth.admin.from("organizations").update(updates).eq("id", auth.organization.id);
        if (error) throw new Error(error.message);
      }
    }

    const data = await readOrganizationManageData(auth.admin, auth.organization.id, auth.userId);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return handleManageError(error);
  }
}

async function requireOrgAdmin(params: Promise<{ organizationId: string }>) {
  const { organizationId } = await params;
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    throw new ManageError("Sign in before managing organizations.", 401);
  }

  const admin = createAdminClient();
  const organization = await resolveOrganizationByIdentifier(admin, organizationId);
  if (!organization) {
    throw new ManageError("Organization not found.", 404);
  }

  const allowed = await hasOrganizationAdminAccess(admin, authData.user.id, organization.id);
  if (!allowed) {
    throw new ManageError("Only organization admins can manage this organization.", 403);
  }

  return { admin, userId: authData.user.id, organization };
}

async function isLastOrgAdmin(admin: ReturnType<typeof createAdminClient>, organizationId: string, profileId: string) {
  const [{ data: currentMembership, error }, otherAdmins] = await Promise.all([
    admin
      .from("organization_memberships")
      .select("role,active")
      .eq("organization_id", organizationId)
      .eq("profile_id", profileId)
      .maybeSingle(),
    countOtherOrganizationAdmins(admin, organizationId, profileId),
  ]);
  if (error) throw new Error(error.message);
  return currentMembership?.role === "ADMIN" && currentMembership?.active !== false && otherAdmins === 0;
}

class ManageError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function handleManageError(error: unknown) {
  if (error instanceof ManageError) {
    return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
  }
  return NextResponse.json(
    { ok: false, message: error instanceof Error ? error.message : "Organization management failed." },
    { status: 500 },
  );
}

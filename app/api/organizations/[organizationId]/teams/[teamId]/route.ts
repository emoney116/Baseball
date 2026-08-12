import { NextResponse, type NextRequest } from "next/server";
import {
  cleanImageValue,
  cleanText,
  hasOrganizationAdminAccess,
  normalizeVisibility,
  readOrganizationManageData,
  resolveOrganizationByIdentifier,
} from "../../../../../lib/organizationManagement";
import { createAdminClient } from "../../../../../lib/supabase/admin";
import { createClient } from "../../../../../lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ organizationId: string; teamId: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { organizationId, teamId } = await params;
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ ok: false, message: "Sign in before managing teams." }, { status: 401 });
    }

    const admin = createAdminClient();
    const organization = await resolveOrganizationByIdentifier(admin, organizationId);
    if (!organization) {
      return NextResponse.json({ ok: false, message: "Organization not found." }, { status: 404 });
    }
    const allowed = await hasOrganizationAdminAccess(admin, authData.user.id, organization.id);
    if (!allowed) {
      return NextResponse.json({ ok: false, message: "Only organization admins can manage teams here." }, { status: 403 });
    }

    const { data: team, error: teamError } = await admin
      .from("teams")
      .select("id,organization_id")
      .eq("id", teamId)
      .maybeSingle();
    if (teamError) throw new Error(teamError.message);
    if (!team || team.organization_id !== organization.id) {
      return NextResponse.json({ ok: false, message: "Team not found in this organization." }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      level?: string;
      teamType?: string;
      ageGroup?: string;
      city?: string;
      state?: string;
      logoUrl?: string | null;
      visibility?: string;
      active?: boolean;
      seasonName?: string;
    };

    const teamUpdates: Record<string, string | boolean | null> = {};
    if (Object.prototype.hasOwnProperty.call(body, "name")) {
      const name = cleanText(body.name, 120);
      if (!name) return NextResponse.json({ ok: false, message: "Team name is required." }, { status: 400 });
      teamUpdates.name = name;
    }
    if (Object.prototype.hasOwnProperty.call(body, "level")) teamUpdates.level = cleanText(body.level, 60) || null;
    if (Object.prototype.hasOwnProperty.call(body, "teamType")) teamUpdates.team_type = cleanText(body.teamType, 40) || null;
    if (Object.prototype.hasOwnProperty.call(body, "ageGroup")) teamUpdates.age_group = cleanText(body.ageGroup, 40) || null;
    if (Object.prototype.hasOwnProperty.call(body, "city")) teamUpdates.city = cleanText(body.city, 80) || null;
    if (Object.prototype.hasOwnProperty.call(body, "state")) teamUpdates.state = cleanText(body.state, 40) || null;
    if (Object.prototype.hasOwnProperty.call(body, "visibility")) teamUpdates.visibility = normalizeVisibility(body.visibility);
    if (Object.prototype.hasOwnProperty.call(body, "active")) teamUpdates.active = body.active !== false;
    if (Object.prototype.hasOwnProperty.call(body, "logoUrl")) {
      const logoUrl = cleanImageValue(body.logoUrl);
      if (logoUrl === "") return NextResponse.json({ ok: false, message: "Choose a valid image." }, { status: 400 });
      teamUpdates.logo_url = logoUrl;
    }

    if (Object.keys(teamUpdates).length) {
      teamUpdates.updated_at = new Date().toISOString();
      const { error } = await admin.from("teams").update(teamUpdates).eq("id", teamId).eq("organization_id", organization.id);
      if (error) throw new Error(error.message);
    }

    const seasonName = cleanText(body.seasonName, 80);
    if (seasonName) {
      const { error: seasonError } = await admin
        .from("seasons")
        .upsert(
          { organization_id: organization.id, team_id: teamId, name: seasonName, active: true },
          { onConflict: "team_id,name" },
        );
      if (seasonError) throw new Error(seasonError.message);
    }

    const data = await readOrganizationManageData(admin, organization.id);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to update team." },
      { status: 500 },
    );
  }
}

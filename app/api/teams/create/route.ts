import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { createClient } from "../../../lib/supabase/server";

const ORGANIZATION_SLUG = "metrolina-christian-academy";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ ok: false, message: "Sign in before creating a team." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      teamName?: string;
      teamLevel?: string;
      seasonName?: string;
    };
    const teamName = body.teamName?.trim();
    const teamLevel = body.teamLevel?.trim() || null;
    const seasonName = body.seasonName?.trim() || "Fall 2026";
    if (!teamName) {
      return NextResponse.json({ ok: false, message: "Team name is required." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: organization, error: organizationError } = await admin
      .from("organizations")
      .select("id,name")
      .eq("slug", ORGANIZATION_SLUG)
      .maybeSingle();
    if (organizationError || !organization) {
      return NextResponse.json({ ok: false, message: organizationError?.message ?? "Organization not found." }, { status: 404 });
    }

    const { count, error: adminError } = await admin
      .from("organization_memberships")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("profile_id", authData.user.id)
      .eq("role", "ADMIN")
      .eq("active", true);
    if (adminError) {
      return NextResponse.json({ ok: false, message: adminError.message }, { status: 500 });
    }
    if ((count ?? 0) === 0) {
      return NextResponse.json({ ok: false, message: "Only organization admins can create teams." }, { status: 403 });
    }

    const { data: team, error: teamError } = await admin
      .from("teams")
      .upsert(
        { organization_id: organization.id, name: teamName, level: teamLevel, active: true },
        { onConflict: "organization_id,name" },
      )
      .select("id,organization_id,name,level,active")
      .single();
    if (teamError || !team) {
      return NextResponse.json({ ok: false, message: teamError?.message ?? "Unable to create team." }, { status: 500 });
    }

    const { data: season, error: seasonError } = await admin
      .from("seasons")
      .upsert(
        { organization_id: organization.id, team_id: team.id, name: seasonName, active: true },
        { onConflict: "team_id,name" },
      )
      .select("id,name,active")
      .single();
    if (seasonError || !season) {
      return NextResponse.json({ ok: false, message: seasonError?.message ?? "Unable to create season." }, { status: 500 });
    }

    const { error: membershipError } = await admin
      .from("profile_team_memberships")
      .upsert(
        {
          profile_id: authData.user.id,
          team_id: team.id,
          season_id: season.id,
          role: "ADMIN",
          title: "Admin",
          active: true,
        },
        { onConflict: "profile_id,team_id,season_id" },
      );
    if (membershipError) {
      return NextResponse.json({ ok: false, message: membershipError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      team: {
        organizationId: organization.id,
        organizationName: organization.name,
        teamId: team.id,
        teamName: team.name,
        teamLevel: team.level ?? undefined,
        seasonId: season.id,
        seasonName: season.name,
        role: "ADMIN",
        title: "Admin",
        active: Boolean(team.active && season.active),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to create team." },
      { status: 500 },
    );
  }
}

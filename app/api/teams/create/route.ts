import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { createClient } from "../../../lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ ok: false, message: "Sign in before creating a team." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      organizationId?: string;
      organizationName?: string;
      city?: string;
      state?: string;
      teamName?: string;
      teamLevel?: string;
      seasonName?: string;
    };
    const organizationId = cleanText(body.organizationId, 80);
    const organizationName = cleanText(body.organizationName, 120);
    const city = cleanText(body.city, 80);
    const state = cleanText(body.state, 40);
    const teamName = body.teamName?.trim();
    const teamLevel = body.teamLevel?.trim() || null;
    const seasonName = body.seasonName?.trim() || "Fall 2026";
    if (!teamName) {
      return NextResponse.json({ ok: false, message: "Team name is required." }, { status: 400 });
    }
    if (!organizationId && !organizationName) {
      return NextResponse.json({ ok: false, message: "Choose or create an organization for this team." }, { status: 400 });
    }

    const admin = createAdminClient();
    const organizationResult = organizationId
      ? await admin
          .from("organizations")
          .select("id,name")
          .eq("id", organizationId)
          .maybeSingle()
      : await admin
          .from("organizations")
          .insert(
            {
              name: organizationName,
              slug: `${slugify(organizationName)}-${crypto.randomUUID().slice(0, 6)}`,
              city: city || null,
              state: state || null,
              visibility: "PRIVATE",
            },
          )
          .select("id,name")
          .single();
    const { data: organization, error: organizationError } = organizationResult;
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
      if (organizationId) {
        return NextResponse.json({ ok: false, message: "Only organization admins can create teams there." }, { status: 403 });
      }
      const { error: membershipError } = await admin.from("organization_memberships").upsert(
        {
          organization_id: organization.id,
          profile_id: authData.user.id,
          role: "ADMIN",
          active: true,
        },
        { onConflict: "organization_id,profile_id" },
      );
      if (membershipError) {
        return NextResponse.json({ ok: false, message: membershipError.message }, { status: 500 });
      }
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

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function slugify(value: string) {
  const base = value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return base || `org-${crypto.randomUUID().slice(0, 8)}`;
}

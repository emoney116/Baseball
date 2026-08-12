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
      organizationCity?: string;
      organizationState?: string;
      organizationLogoUrl?: string;
      organizationVisibility?: string;
      city?: string;
      state?: string;
      teamCity?: string;
      teamState?: string;
      teamName?: string;
      teamLevel?: string;
      teamType?: string;
      ageGroup?: string;
      logoUrl?: string;
      visibility?: string;
      seasonName?: string;
    };
    const organizationId = cleanText(body.organizationId, 80);
    const organizationName = cleanText(body.organizationName, 120);
    const organizationCity = cleanText(body.organizationCity ?? body.city, 80);
    const organizationState = cleanText(body.organizationState ?? body.state, 40);
    const teamCity = cleanText(body.teamCity ?? body.city, 80);
    const teamState = cleanText(body.teamState ?? body.state, 40);
    const teamName = body.teamName?.trim();
    const teamLevel = body.teamLevel?.trim() || null;
    const teamType = cleanText(body.teamType, 40) || null;
    const ageGroup = cleanText(body.ageGroup, 40) || null;
    const logoUrl = cleanAvatarValue(body.logoUrl);
    const organizationLogoUrl = cleanAvatarValue(body.organizationLogoUrl);
    const organizationVisibility = normalizeVisibility(body.organizationVisibility);
    const visibility = normalizeVisibility(body.visibility);
    const seasonName = body.seasonName?.trim() || "Fall 2026";
    if (!teamName) {
      return NextResponse.json({ ok: false, message: "Team name is required." }, { status: 400 });
    }
    if (!organizationId && !organizationName && (!teamCity || !teamState)) {
      return NextResponse.json({ ok: false, message: "City and state are required for teams without an organization." }, { status: 400 });
    }

    const admin = createAdminClient();
    let organization: { id: string; name: string; city?: string | null; state?: string | null; visibility?: string | null } | null = null;
    if (organizationId || organizationName) {
      const organizationResult = organizationId
        ? await admin
            .from("organizations")
            .select("id,name,city,state,visibility")
            .eq("id", organizationId)
            .maybeSingle()
        : await admin
            .from("organizations")
            .insert(
              {
                name: organizationName,
                slug: `${slugify(organizationName)}-${crypto.randomUUID().slice(0, 6)}`,
                city: organizationCity || null,
                state: organizationState || null,
                logo_url: organizationLogoUrl || null,
                visibility: organizationVisibility,
              },
            )
            .select("id,name,city,state,visibility")
            .single();
      const { data, error } = organizationResult;
      if (error || !data) {
        return NextResponse.json({ ok: false, message: error?.message ?? "Organization not found." }, { status: 404 });
      }
      organization = data;
    }

    if (organization) {
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
    }

    const teamPayload = {
      organization_id: organization?.id ?? null,
      name: teamName,
      level: teamLevel,
      team_type: teamType,
      age_group: ageGroup,
      city: teamCity || organization?.city || null,
      state: teamState || organization?.state || null,
      logo_url: logoUrl || null,
      visibility: organization ? normalizeVisibility(organization.visibility) : visibility,
      active: true,
    };
    const teamMutation = organization
      ? admin.from("teams").upsert(teamPayload, { onConflict: "organization_id,name" })
      : admin.from("teams").insert(teamPayload);
    const { data: team, error: teamError } = await teamMutation
      .select("id,organization_id,name,level,active,visibility")
      .single();
    if (teamError || !team) {
      return NextResponse.json({ ok: false, message: teamError?.message ?? "Unable to create team." }, { status: 500 });
    }

    const { data: season, error: seasonError } = await admin
      .from("seasons")
      .upsert(
        { organization_id: organization?.id ?? null, team_id: team.id, name: seasonName, active: true },
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
        organizationId: organization?.id ?? undefined,
        organizationName: organization?.name ?? "Independent",
        teamId: team.id,
        teamName: team.name,
        teamLevel: team.level ?? undefined,
        teamType: teamType ?? undefined,
        ageGroup: ageGroup ?? undefined,
        city: teamCity || organization?.city || undefined,
        state: teamState || organization?.state || undefined,
        logoUrl: logoUrl || undefined,
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

function normalizeVisibility(value: unknown) {
  return value === "UNLISTED" || value === "PRIVATE" ? value : "PUBLIC";
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function cleanAvatarValue(value: unknown) {
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

function slugify(value: string) {
  const base = value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return base || `org-${crypto.randomUUID().slice(0, 8)}`;
}

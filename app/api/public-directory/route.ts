import { NextResponse } from "next/server";
import { createAdminClient } from "../../lib/supabase/admin";

export const runtime = "nodejs";

type Visibility = "PUBLIC" | "UNLISTED" | "PRIVATE";

type OrganizationRow = {
  id: string;
  name: string;
  slug?: string | null;
  visibility?: string | null;
  city?: string | null;
  state?: string | null;
  logo_url?: string | null;
};

type OrganizationSummary = {
  id: string;
  name: string;
  slug?: string;
  city?: string;
  state?: string;
  logoUrl?: string;
  visibility: Visibility;
  teams: TeamSummary[];
};

type TeamSummary = {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug?: string;
  name: string;
  level?: string;
  teamType?: string;
  ageGroup?: string;
  logoUrl?: string;
  seasonId?: string;
  seasonName?: string;
  city?: string;
  state?: string;
  visibility: Visibility;
  active: boolean;
};

type SeasonRow = {
  id: string;
  team_id: string;
  name: string;
};

function normalizeVisibility(value: unknown): Visibility {
  return value === "PUBLIC" || value === "UNLISTED" || value === "PRIVATE" ? value : "PRIVATE";
}

function locationParts(row: { city?: string | null; state?: string | null }) {
  return {
    city: row.city?.trim() || undefined,
    state: row.state?.trim() || undefined,
  };
}

export async function GET() {
  const admin = createAdminClient();

  const primaryOrganizationsResult = await admin
    .from("organizations")
    .select("id,name,slug,visibility,city,state,logo_url")
    .eq("visibility", "PUBLIC")
    .order("name", { ascending: true });

  let organizationRows = (primaryOrganizationsResult.data ?? []) as OrganizationRow[];
  let organizationError = primaryOrganizationsResult.error;

  if (organizationError && /city|state|logo_url|schema cache|column/i.test(organizationError.message)) {
    const fallbackOrganizationsResult = await admin
      .from("organizations")
      .select("id,name,slug,visibility")
      .eq("visibility", "PUBLIC")
      .order("name", { ascending: true });
    organizationRows = (fallbackOrganizationsResult.data ?? []) as OrganizationRow[];
    organizationError = fallbackOrganizationsResult.error;
  }

  if (organizationError) {
    return NextResponse.json({ ok: false, message: organizationError.message }, { status: 500 });
  }

  const organizationIds = organizationRows.map((organization) => organization.id).filter(Boolean);

  const teamsResult = organizationIds.length
    ? await admin
        .from("teams")
        .select("id,organization_id,name,level,team_type,age_group,city,state,logo_url,active,visibility")
        .in("organization_id", organizationIds)
        .eq("active", true)
        .eq("visibility", "PUBLIC")
        .order("name", { ascending: true })
    : { data: [], error: null };

  if (teamsResult.error) {
    return NextResponse.json({ ok: false, message: teamsResult.error.message }, { status: 500 });
  }

  const teamRows = teamsResult.data ?? [];
  const teamIds = teamRows.map((team) => team.id).filter(Boolean);
  const seasonsResult = teamIds.length
    ? await admin
        .from("seasons")
        .select("id,team_id,name,active,starts_on")
        .in("team_id", teamIds)
        .eq("active", true)
        .order("starts_on", { ascending: false, nullsFirst: false })
    : { data: [], error: null };

  if (seasonsResult.error) {
    return NextResponse.json({ ok: false, message: seasonsResult.error.message }, { status: 500 });
  }

  const organizationsById = new Map<string, OrganizationSummary>(
    organizationRows.map((organization) => [
      organization.id,
      {
        id: organization.id,
        name: organization.name,
        slug: organization.slug ?? undefined,
        visibility: normalizeVisibility(organization.visibility),
        ...locationParts(organization),
        logoUrl: organization.logo_url ?? undefined,
        teams: [],
      },
    ]),
  );
  const seasonByTeam = new Map<string, SeasonRow>();
  for (const season of (seasonsResult.data ?? []) as SeasonRow[]) {
    if (!seasonByTeam.has(season.team_id)) seasonByTeam.set(season.team_id, season);
  }

  const teams: TeamSummary[] = [];
  for (const team of teamRows) {
    const organization = organizationsById.get(team.organization_id);
    if (!organization) continue;
    const season = seasonByTeam.get(team.id);
    teams.push({
      id: team.id,
      organizationId: team.organization_id,
      organizationName: organization.name,
      organizationSlug: organization.slug,
      name: team.name,
      level: team.level ?? undefined,
      teamType: team.team_type ?? undefined,
      ageGroup: team.age_group ?? undefined,
      logoUrl: team.logo_url ?? undefined,
      seasonId: season?.id,
      seasonName: season?.name,
      city: team.city ?? organization.city,
      state: team.state ?? organization.state,
      visibility: normalizeVisibility(team.visibility),
      active: Boolean(team.active),
    });
  }

  for (const team of teams) {
    const organization = organizationsById.get(team.organizationId);
    if (organization) organization.teams.push(team);
  }

  return NextResponse.json({
    ok: true,
    organizations: [...organizationsById.values()].filter((organization) => organization.teams.length > 0),
    teams,
  });
}

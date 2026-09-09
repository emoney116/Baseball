import type { createAdminClient } from "./supabase/admin";
import type { ClubhouseLocation, LocationScope } from "./locationTypes.ts";
import { assertPlayerLinkTeamManager, PlayerLinkError } from "./playerAccountLinks.ts";
import { PlacesRequestError } from "./placesProtection.ts";

type Admin = ReturnType<typeof createAdminClient>;
export async function authorizeLocationScope(admin: Admin, userId: string, scope: LocationScope) {
  for (const id of [scope.teamId, scope.organizationId]) {
    if (id !== undefined && (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id))) throw new PlacesRequestError(400);
  }
  if (scope.teamId) {
    try { await assertPlayerLinkTeamManager(admin, userId, scope.teamId); }
    catch (error) { throw new PlacesRequestError(error instanceof PlayerLinkError ? error.status : 503); }
    const { data, error } = await admin.from("teams").select("organization_id").eq("id", scope.teamId).single();
    if (error || !data || (scope.organizationId && scope.organizationId !== data.organization_id)) throw new PlacesRequestError(403);
    return { teamId: scope.teamId, organizationId: (data.organization_id as string | null) ?? undefined };
  }
  if (scope.organizationId) {
    const { data, error } = await admin.from("organization_memberships").select("organization_id")
      .eq("organization_id", scope.organizationId).eq("profile_id", userId).eq("active", true).eq("role", "ADMIN");
    if (error) throw new PlacesRequestError(503);
    if (!data?.length) throw new PlacesRequestError(403);
  }
  // No scope is the authenticated user's personal picker during new organization setup.
  return scope;
}

export async function readSavedLocations(admin: Admin, userId: string, scope: LocationScope, placeId?: string): Promise<ClubhouseLocation[]> {
  const verified = await authorizeLocationScope(admin, userId, scope);
  let query = admin.from("clubhouse_locations").select("id,name,city,state_region,country_code,address,provider_place_id,team_id,organization_id,created_by_profile_id");
  if (verified.organizationId) {
    query = query.eq("organization_id", verified.organizationId);
    query = verified.teamId ? query.or(`team_id.is.null,team_id.eq.${verified.teamId}`) : query.is("team_id", null);
  } else if (verified.teamId) query = query.eq("team_id", verified.teamId);
  else query = query.eq("created_by_profile_id", userId).is("organization_id", null).is("team_id", null);
  if (placeId) query = query.eq("provider_place_id", placeId);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(100);
  if (error) throw new PlacesRequestError(503);
  return (data ?? []).map(row => ({ id: row.id, name: row.name, city: row.city ?? undefined,
    stateRegion: row.state_region ?? undefined, countryCode: row.country_code ?? undefined,
    address: row.address ?? undefined, providerPlaceId: row.provider_place_id ?? undefined,
    teamId: row.team_id ?? undefined, organizationId: row.organization_id ?? undefined,
    createdByProfileId: row.created_by_profile_id }));
}

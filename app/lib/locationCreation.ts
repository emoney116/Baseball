import type { createAdminClient } from "./supabase/admin";
import type { LocationScope } from "./locationTypes.ts";
import { authorizeLocationScope, readSavedLocations } from "./placesRepository.ts";
import { PlacesRequestError } from "./placesProtection.ts";
type Admin = ReturnType<typeof createAdminClient>;

export async function creationLocation(admin: Admin, userId: string, locationId?: string, organizationId?: string) {
  if (!locationId) return null;
  if (!/^[a-f0-9-]{36}$/i.test(locationId)) throw new PlacesRequestError(400);
  if (organizationId) await authorizeLocationScope(admin, userId, { organizationId });
  const { data, error } = await admin.from("clubhouse_locations").select("*").eq("id", locationId).maybeSingle();
  if (error) throw new PlacesRequestError(503);
  const personal = data && !data.organization_id && !data.team_id && data.created_by_profile_id === userId;
  const organization = data && organizationId && data.organization_id === organizationId && !data.team_id;
  if (!personal && !organization) throw new PlacesRequestError(403);
  return data;
}

export async function adoptCreationLocation(admin: Admin, userId: string, locationId: string, scope: LocationScope) {
  const source = await creationLocation(admin, userId, locationId, scope.organizationId);
  await authorizeLocationScope(admin, userId, scope);
  if (source.organization_id === scope.organizationId && !source.team_id && scope.organizationId) return source.id as string;
  const saved = await readSavedLocations(admin, userId, scope, source.provider_place_id ?? undefined);
  const existing = source.provider_place_id && saved.find(row => row.providerPlaceId === source.provider_place_id);
  if (existing) return existing.id;
  const { data, error } = await admin.from("clubhouse_locations").insert({ name: source.name, city: source.city,
    state_region: source.state_region, country_code: source.country_code, address: source.address,
    provider_place_id: source.provider_place_id, organization_id: scope.organizationId ?? null,
    team_id: scope.teamId ?? null, created_by_profile_id: userId }).select("id").single();
  if (error || !data) throw new PlacesRequestError(503);
  return data.id as string;
}

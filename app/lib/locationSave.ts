import type { createAdminClient } from "./supabase/admin";
import type { LocationScope } from "./locationTypes.ts";
import { authorizeLocationScope, readSavedLocations } from "./placesRepository.ts";
import { PlacesRequestError } from "./placesProtection.ts";

export type LocationSaveInput = LocationScope & { name: string; city?: string; stateRegion?: string;
  countryCode?: string; address?: string; providerPlaceId?: string; receipt?: string };
export function customerLocationFields(input: LocationSaveInput) {
  const text = (value: unknown, max: number) => {
    if (value === undefined || value === null) return null;
    if (typeof value !== "string" || value.trim().length > max) throw new PlacesRequestError(400);
    return value.trim() || null;
  };
  const name = text(input.name, 100);
  if (!name) throw new PlacesRequestError(400);
  // Explicit allowlist: no provider title, formattedAddress, coordinates or components.
  return { name, city: text(input.city, 80), state_region: text(input.stateRegion, 40),
    country_code: text(input.countryCode, 2), address: text(input.address, 200) };
}

export async function saveClubhouseLocation(admin: ReturnType<typeof createAdminClient>, userId: string, input: LocationSaveInput) {
  const scope = await authorizeLocationScope(admin, userId, input);
  const fields = customerLocationFields(input);
  const saved = await readSavedLocations(admin, userId, scope, input.providerPlaceId);
  if (input.providerPlaceId) {
    if (!/^[A-Za-z0-9_-]{5,255}$/.test(input.providerPlaceId)) throw new PlacesRequestError(400);
    const existing = saved.find(location => location.providerPlaceId === input.providerPlaceId);
    if (existing) return existing;
    if (typeof input.receipt !== "string" || !/^[a-f0-9-]{36}$/i.test(input.receipt)) throw new PlacesRequestError(400);
    const { data: session, error } = await admin.from("places_search_sessions").select("token")
      .eq("token", input.receipt).eq("profile_id", userId).eq("selected_place_id", input.providerPlaceId)
      .not("ended_at", "is", null).gte("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString()).maybeSingle();
    if (error || !session) throw new PlacesRequestError(403);
  }
  const { data, error } = await admin.from("clubhouse_locations").insert({ ...fields,
    organization_id: scope.organizationId ?? null, team_id: scope.teamId ?? null,
    created_by_profile_id: userId, provider_place_id: input.providerPlaceId ?? null,
  }).select("id").single();
  if (error && error.code !== "23505") throw new PlacesRequestError(503);
  const refreshed = await readSavedLocations(admin, userId, scope, input.providerPlaceId);
  const location = refreshed.find(row => row.id === data?.id || (input.providerPlaceId && row.providerPlaceId === input.providerPlaceId));
  if (!location) throw new PlacesRequestError(503);
  return location;
}

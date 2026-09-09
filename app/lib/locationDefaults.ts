import type { createAdminClient } from "./supabase/admin";
import type { LocationScope } from "./locationTypes.ts";
import type { LocationSearchContext } from "./locationContext.ts";
import { VENUE_BIAS_RADIUS } from "./locationContext.ts";
import { authorizeLocationScope, readSavedLocations, readPreviousLocations } from "./placesRepository.ts";
import { PlacesRequestError } from "./placesProtection.ts";

type Admin = ReturnType<typeof createAdminClient>;
export async function locationConfiguration(admin: Admin, userId: string, scope: LocationScope, eventLocationId?: string) {
  const verified = await authorizeLocationScope(admin, userId, scope);
  const locations = await readSavedLocations(admin, userId, verified);
  const team = verified.teamId ? await admin.from("teams").select("default_location_id,city,state").eq("id", verified.teamId).single() : null;
  const org = verified.organizationId ? await admin.from("organizations").select("location_id,name,city,state").eq("id", verified.organizationId).single() : null;
  if (team?.error || org?.error) throw new PlacesRequestError(503);
  const defaultId = team?.data?.default_location_id || org?.data?.location_id;
  const context: LocationSearchContext = { source: "US fallback", city: team?.data?.city || org?.data?.city || undefined,
    state: team?.data?.state || org?.data?.state || undefined, organizationName: org?.data?.name };
  for (const [id, source] of [[team?.data?.default_location_id, "Team Default"], [org?.data?.location_id, "Organization Default"], [eventLocationId, "Current Event"]]) {
    const location = locations.find(row => row.id === id);
    if (!location?.providerPlaceId) continue;
    const { data, error } = await admin.from("places_coordinate_cache").select("latitude,longitude")
      .eq("place_id", location.providerPlaceId).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (error) throw new PlacesRequestError(503);
    if (data) { context.bias = { latitude: data.latitude, longitude: data.longitude, radius: VENUE_BIAS_RADIUS }; context.source = source!; break; }
  }
  if (!context.bias && context.city) context.source = "Known city/state";
  const recentIds: string[] = [];
  if (verified.teamId) {
    for (const table of ["practices", "games"]) {
      const { data, error } = await admin.from(table).select("location_id").eq("team_id", verified.teamId)
        .not("location_id", "is", null).order("updated_at", { ascending: false }).limit(10);
      if (error) throw new PlacesRequestError(503);
      for (const row of data ?? []) if (!recentIds.includes(row.location_id)) recentIds.push(row.location_id);
    }
  }
  const ranked = locations.map(row => ({ ...row, group: row.id === defaultId ? "Team Default" as const
    : recentIds.includes(row.id) ? "Recent" as const : row.teamId ? "Team Locations" as const : row.organizationId ? "Organization Locations" as const : "Saved Locations" as const }));
  const order = ["Team Default", "Team Locations", "Organization Locations", "Recent", "Saved Locations"];
  ranked.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
  const defaults = ranked.filter(row => row.id === defaultId);
  const previous = (await readPreviousLocations(admin, userId)).filter(row => !defaults.some(item => item.id === row.id || (item.providerPlaceId && item.providerPlaceId === row.providerPlaceId)));
  return { locations: [...defaults, ...previous], defaultId: defaultId ?? null, inherited: !team?.data?.default_location_id, context };
}

export async function updateLocationDefault(admin: Admin, userId: string, scope: LocationScope, locationId: string | null) {
  const verified = await authorizeLocationScope(admin, userId, scope);
  if (!verified.teamId && !verified.organizationId) throw new PlacesRequestError(400);
  const locations = await readSavedLocations(admin, userId, verified);
  if (locationId !== null && !locations.some(location => location.id === locationId)) throw new PlacesRequestError(403);
  const table = verified.teamId ? "teams" : "organizations";
  const column = verified.teamId ? "default_location_id" : "location_id";
  const { error } = await admin.from(table).update({ [column]: locationId }).eq("id", verified.teamId ?? verified.organizationId!);
  if (error) throw new PlacesRequestError(503);
}

export type LocationScope = { teamId?: string; organizationId?: string };

export type ClubhouseLocation = {
  id: string;
  name: string;
  city?: string;
  stateRegion?: string;
  countryCode?: string;
  address?: string;
  providerPlaceId?: string;
  teamId?: string;
  organizationId?: string;
  createdByProfileId: string;
  group?: "Team Default" | "Team Locations" | "Organization Locations" | "Recent" | "Saved Locations";
};

// Provider content is transient. Never serialize this into AppData or saved venues.
export type ResolvedPlace = {
  providerPlaceId: string;
  formattedAddress: string;
  addressLine1: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  countryCode: string;
  latitude: number | null;
  longitude: number | null;
  attributions: Array<{ name: string; uri: string }>;
};
export type LocationSuggestion = { providerPlaceId: string; title: string; subtitle: string };
export type LocationBias = { latitude: number; longitude: number; radius: number };
export interface LocationSearchProvider {
  autocomplete(query: string, sessionToken: string, signal?: AbortSignal, bias?: LocationBias): Promise<LocationSuggestion[]>;
  getPlace(placeId: string, sessionToken: string, signal?: AbortSignal): Promise<ResolvedPlace>;
}

export function locationLabel(location?: Pick<ClubhouseLocation, "name"> | null, historical = "") {
  return location?.name || historical;
}
export function locationSubtitle(location: Pick<ClubhouseLocation, "city" | "stateRegion">) {
  return [location.city, location.stateRegion].filter(Boolean).join(", ");
}
export function localLocationMatches(locations: ClubhouseLocation[], query: string) {
  const needle = query.trim().toLocaleLowerCase();
  return locations.filter((location) => `${location.name} ${location.city ?? ""} ${location.stateRegion ?? ""}`.toLocaleLowerCase().includes(needle));
}
export function locationMapsUrl(location: ClubhouseLocation) {
  const query = new URLSearchParams({ api: "1", query: location.address || [location.name, locationSubtitle(location)].filter(Boolean).join(", ") });
  if (location.providerPlaceId) query.set("query_place_id", location.providerPlaceId);
  return `https://www.google.com/maps/search/?${query}`;
}

import type { ClubhouseLocation } from "./locationTypes";

// This is client-only UI fixture data, never an authorization bypass for the API.
export function isLocationPreview() {
  return process.env.NODE_ENV === "development" && typeof window !== "undefined" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname) &&
    new URLSearchParams(window.location.search).get("devBypass") === "1";
}
const venues: ClubhouseLocation[] = [
  { id: "preview-field", name: "MCA Baseball Field", city: "Indian Trail", stateRegion: "NC", createdByProfileId: "local-preview", group: "Team Default" },
  { id: "preview-campus", name: "Metrolina Christian Academy", city: "Indian Trail", stateRegion: "NC", createdByProfileId: "local-preview", group: "Organization Locations" },
  { id: "preview-away", name: "Charlotte Christian School", city: "Charlotte", stateRegion: "NC", createdByProfileId: "local-preview", group: "Recent" },
];
export function previewLocations() { return [...venues]; }
export function savePreviewLocation(name: string, city: string, stateRegion: string) {
  const location: ClubhouseLocation = { id: crypto.randomUUID(), name, city, stateRegion, createdByProfileId: "local-preview", group: "Saved Locations" };
  venues.push(location);
  return location;
}

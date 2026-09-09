import type { LocationBias } from "./locationTypes.ts";

export const VENUE_BIAS_RADIUS = 35000;
export type LocationSearchContext = { bias?: LocationBias; source: string; city?: string; state?: string; organizationName?: string };
export function contextualLocationQuery(query: string, context: LocationSearchContext) {
  let result = query;
  const organization = context.organizationName?.trim();
  const initials = organization?.split(/\s+/).filter(Boolean).map(word => word[0]).join("");
  if (initials && initials.length >= 2 && result.toLowerCase().startsWith(`${initials.toLowerCase()} `)) {
    result = organization + result.slice(initials.length);
  }
  // Only resolve a generic near-clause when it names the already-known locality.
  // Never strip explicit away cities or modify a named venue on speculation.
  const match = result.match(/^(baseball field|baseball fields|park|sports complex)\s+near\s+(.+)$/i);
  if (match && context.bias && context.city && match[2].toLowerCase().replace(/[,]/g, "").trim() === context.city.toLowerCase()) result = match[1];
  return result;
}

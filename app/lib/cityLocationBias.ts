import centers from "./us-city-centers.json" with { type: "json" };
import { VENUE_BIAS_RADIUS } from "./locationContext.ts";
import type { LocationBias } from "./locationTypes.ts";

// Census 2025 Gazetteer representative points, not Google provider content.
// Ambiguous same-state names deliberately have no guessed center.
export function cityLocationBias(city?: string, state?: string): LocationBias | undefined {
  if (!city || !state) return undefined;
  const key = `${state.trim()}|${city.trim().replace(/\s+/g, " ")}`.toLowerCase();
  const point = (centers as Record<string, number[] | null>)[key];
  return point ? { latitude: point[0], longitude: point[1], radius: VENUE_BIAS_RADIUS } : undefined;
}

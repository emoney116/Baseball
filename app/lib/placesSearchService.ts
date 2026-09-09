import type { LocationSearchProvider, LocationScope, ClubhouseLocation, LocationBias } from "./locationTypes.ts";
import { localLocationMatches } from "./locationTypes.ts";
import { normalizedPlacesQuery, PlacesRequestError } from "./placesProtection.ts";
import { contextualLocationQuery, type LocationSearchContext } from "./locationContext.ts";
import type { PlacesEvent, PlacesOperation } from "./placesProtection.ts";

export type PlacesSearchInput = LocationScope & { operation: PlacesOperation; query?: string; placeId?: string; sessionToken: string; external?: boolean; bias?: LocationBias };
export interface PlacesSearchDependencies {
  userId: string | null;
  authorize(scope: LocationScope): Promise<void>;
  saved(scope: LocationScope, placeId?: string): Promise<ClubhouseLocation[]>;
  reserve(input: PlacesSearchInput): Promise<{ allowed: boolean; retryAfter: number }>;
  predictions(token: string, ids: string[]): Promise<void>;
  provider: LocationSearchProvider;
  event(operation: PlacesOperation, event: PlacesEvent): void;
  context?: LocationSearchContext;
  rememberCoordinates?(place: import("./locationTypes.ts").ResolvedPlace): Promise<void>;
}

export async function searchPlaces(input: PlacesSearchInput, deps: PlacesSearchDependencies, signal?: AbortSignal) {
  const operation = input.operation === "details" ? "details" : "autocomplete";
  if (!deps.userId) {
    deps.event(operation, "unauthenticated");
    throw new PlacesRequestError(401);
  }
  if (!["autocomplete", "details"].includes(input.operation)) throw new PlacesRequestError(400);
  if (input.bias && (!Number.isFinite(input.bias.latitude) || Math.abs(input.bias.latitude) > 90
    || !Number.isFinite(input.bias.longitude) || Math.abs(input.bias.longitude) > 180
    || !Number.isFinite(input.bias.radius) || input.bias.radius <= 0 || input.bias.radius > 50000)) throw new PlacesRequestError(400);
  await deps.authorize(input);
  if (operation === "details" && (typeof input.placeId !== "string" || !/^[A-Za-z0-9_-]{5,255}$/.test(input.placeId))) throw new PlacesRequestError(400);
  const saved = await deps.saved(input, operation === "details" ? input.placeId : undefined);
  if (operation === "details") {
    const existing = saved.find(location => location.providerPlaceId === input.placeId);
    if (existing) return { saved: [existing], suggestions: [] };
  } else {
    input = { ...input, query: normalizedPlacesQuery(input.query) };
    const matches = localLocationMatches(saved, input.query!);
    if (input.query!.length < 3 || (matches.length && !input.external)) return { saved: matches.slice(0, 20), suggestions: [] };
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.sessionToken)) throw new PlacesRequestError(400);
  if (signal?.aborted) throw new PlacesRequestError(400);
  const reservation = await deps.reserve(input);
  if (!reservation.allowed) {
    deps.event(operation, "rate_limited");
    throw new PlacesRequestError(429, reservation.retryAfter);
  }
  deps.event(operation, "attempt");
  try {
    if (operation === "details") {
      const place = await deps.provider.getPlace(input.placeId!, input.sessionToken, signal);
      await deps.rememberCoordinates?.(place);
      return { place, receipt: input.sessionToken };
    }
    const query = deps.context ? contextualLocationQuery(input.query!, deps.context) : input.query!;
    const suggestions = await deps.provider.autocomplete(query, input.sessionToken, signal, deps.context?.bias ?? input.bias);
    await deps.predictions(input.sessionToken, suggestions.map(row => row.providerPlaceId));
    return { saved: localLocationMatches(saved, input.query!).slice(0, 20), suggestions, context: deps.context };
  } catch {
    deps.event(operation, "provider_error");
    throw new PlacesRequestError(503);
  }
}

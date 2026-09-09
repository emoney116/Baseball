import type { LocationBias, LocationSearchProvider, LocationSuggestion, ResolvedPlace } from "./locationTypes.ts";

export const GOOGLE_DETAILS_FIELDS = "id,formattedAddress,addressComponents,location,attributions";
export const GOOGLE_AUTOCOMPLETE_FIELDS = "suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat";
export class LocationProviderError extends Error {
  code: "unavailable" | "timeout" | "quota" | "configuration" | "invalid";
  status: number;
  constructor(code: LocationProviderError["code"], status = 503) {
    super("Location search is temporarily unavailable.");
    this.code = code;
    this.status = status;
  }
}
type Component = { longText?: string; shortText?: string; types?: string[] };
type GooglePlace = {
  id?: string; formattedAddress?: string; addressComponents?: Component[];
  location?: { latitude?: number; longitude?: number };
  attributions?: Array<{ provider?: string; providerUri?: string }>;
};
export function normalizeGooglePlace(value: GooglePlace): ResolvedPlace {
  if (!value.id) throw new LocationProviderError("invalid");
  const components = value.addressComponents ?? [];
  const component = (type: string, short = false) => {
    const match = components.find((item) => item.types?.includes(type));
    return (short ? match?.shortText : match?.longText) ?? "";
  };
  const coordinate = (value: number | undefined, limit: number) => typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= limit ? value : null;
  return {
    providerPlaceId: value.id,
    formattedAddress: value.formattedAddress ?? "",
    addressLine1: [component("street_number"), component("route")].filter(Boolean).join(" "),
    city: component("locality") || component("postal_town") || component("administrative_area_level_3") || component("sublocality_level_1"),
    stateRegion: component("administrative_area_level_1", true),
    postalCode: component("postal_code"), countryCode: component("country", true),
    latitude: coordinate(value.location?.latitude, 90), longitude: coordinate(value.location?.longitude, 180),
    attributions: (value.attributions ?? []).flatMap((item) => item.provider && item.providerUri && /^https:\/\//.test(item.providerUri) ? [{ name: item.provider, uri: item.providerUri }] : []),
  };
}

// The route supplies the server-only credential; this module never reads browser env.
export function googlePlacesProvider(key: string | undefined, transport: typeof fetch = fetch): LocationSearchProvider {
  async function call(path: string, init: RequestInit, fields: string, signal?: AbortSignal) {
    if (!key) throw new LocationProviderError("configuration");
    const timeout = AbortSignal.timeout(6000);
    try {
      const response = await transport(`https://places.googleapis.com/v1/${path}`, {
        ...init, cache: "no-store", redirect: "error",
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": fields },
      });
      if (!response.ok) throw new LocationProviderError(response.status === 429 ? "quota" : [401, 403].includes(response.status) ? "configuration" : "unavailable");
      return await response.json();
    } catch (error) {
      if (error instanceof LocationProviderError) throw error;
      // Never forward Google's response body, headers, or request objects into logs/errors.
      throw new LocationProviderError(timeout.aborted ? "timeout" : "unavailable");
    }
  }
  return {
    async autocomplete(query, sessionToken, signal, bias?: LocationBias) {
      if (query.trim().length < 3) return [];
      const data = await call("places:autocomplete", { method: "POST", body: JSON.stringify({
        input: query.trim().slice(0, 200), sessionToken, includedRegionCodes: ["us"], languageCode: "en",
        ...(bias ? { locationBias: { circle: { center: { latitude: bias.latitude, longitude: bias.longitude }, radius: bias.radius } } } : {}),
      }) }, GOOGLE_AUTOCOMPLETE_FIELDS, signal);
      return (Array.isArray(data.suggestions) ? data.suggestions : []).slice(0, 5).flatMap((item: { placePrediction?: { placeId?: string; structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } } } }): LocationSuggestion[] => {
        const prediction = item.placePrediction;
        return prediction?.placeId ? [{ providerPlaceId: prediction.placeId, title: prediction.structuredFormat?.mainText?.text ?? "Location", subtitle: prediction.structuredFormat?.secondaryText?.text ?? "" }] : [];
      });
    },
    async getPlace(placeId, sessionToken, signal) {
      if (!/^[A-Za-z0-9_-]{5,255}$/.test(placeId)) throw new LocationProviderError("invalid", 400);
      const params = new URLSearchParams({ sessionToken, languageCode: "en" });
      return normalizeGooglePlace(await call(`places/${encodeURIComponent(placeId)}?${params}`, { method: "GET" }, GOOGLE_DETAILS_FIELDS, signal));
    },
  };
}

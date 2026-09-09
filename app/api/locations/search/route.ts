import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { googlePlacesProvider } from "../../../lib/googlePlacesProvider";
import { searchPlaces, type PlacesSearchInput } from "../../../lib/placesSearchService";
import { authorizeLocationScope, readSavedLocations } from "../../../lib/placesRepository";
import { locationConfiguration } from "../../../lib/locationDefaults";
import { placesDigest, placesEnvironment, placesIpBucket, placesTelemetry, PlacesRequestError } from "../../../lib/placesProtection";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const environment = placesEnvironment(process.env.VERCEL_ENV);
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) {
      console.info(JSON.stringify(placesTelemetry(environment, "autocomplete", "unauthenticated")));
      throw new PlacesRequestError(401);
    }
    if (request.headers.get("sec-fetch-site") === "cross-site") throw new PlacesRequestError(403);
    if (!request.headers.get("content-type")?.startsWith("application/json")) throw new PlacesRequestError(400);
    // Stream a bounded body instead of trusting a client-supplied Content-Length.
    const reader = request.body?.getReader();
    if (!reader) throw new PlacesRequestError(400);
    let bytes = 0; let text = "";
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 2048) { await reader.cancel(); throw new PlacesRequestError(413); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    const input = JSON.parse(text) as PlacesSearchInput;
    if (!input || typeof input !== "object") throw new PlacesRequestError(400);
    const admin = createAdminClient();
    const userId = data.user.id;
    const configuration = await locationConfiguration(admin, userId, input);
    // Scope-derived context wins over untrusted client coordinates.
    input.bias = configuration.context.bias;
    const result = await searchPlaces(input, {
      userId,
      authorize: async scope => { await authorizeLocationScope(admin, userId, scope); },
      saved: (scope, placeId) => readSavedLocations(admin, userId, scope, placeId),
      provider: googlePlacesProvider(process.env.GOOGLE_PLACES_API_KEY),
      context: configuration.context,
      rememberCoordinates: async place => {
        if (place.latitude === null || place.longitude === null) return;
        const { error: cacheError } = await admin.from("places_coordinate_cache").upsert({ place_id: place.providerPlaceId,
          latitude: place.latitude, longitude: place.longitude, expires_at: new Date(Date.now() + 29 * 86400000).toISOString() });
        if (cacheError) throw new PlacesRequestError(503);
      },
      event: (operation, event) => console.info(JSON.stringify(placesTelemetry(environment, operation, event))),
      reserve: async item => {
        if (!process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_PLACES_DISABLED === "1") throw new PlacesRequestError(503);
        const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
        const { data: reservation, error: reserveError } = await admin.rpc("reserve_places_request", {
          p_profile_id: userId,
          p_ip_hash: placesDigest(secret, "ip", placesIpBucket(request.headers, process.env.VERCEL === "1")),
          p_query_hash: item.query ? placesDigest(secret, "query", item.query.toLowerCase()) : null,
          p_environment: environment, p_operation: item.operation, p_token: item.sessionToken, p_place_id: item.placeId ?? null,
        });
        if (reserveError || !reservation || typeof reservation.allowed !== "boolean") throw new PlacesRequestError(503);
        return reservation as { allowed: boolean; retryAfter: number };
      },
      predictions: async (token, ids) => {
        const { error: saveError } = await admin.rpc("record_places_predictions", { p_token: token, p_profile_id: userId, p_place_ids: ids });
        if (saveError) throw new PlacesRequestError(503);
      },
    }, request.signal);
    return Response.json(result, { headers });
  } catch (error) {
    const safe = error instanceof PlacesRequestError ? error : new PlacesRequestError(error instanceof SyntaxError ? 400 : 503);
    return Response.json({ message: safe.message }, { status: safe.status,
      headers: { ...headers, ...(safe.retryAfter ? { "Retry-After": String(safe.retryAfter) } : {}) } });
  }
}

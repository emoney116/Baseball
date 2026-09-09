import { createClient } from "../../lib/supabase/server";
import { createAdminClient } from "../../lib/supabase/admin";
import { locationConfiguration, updateLocationDefault } from "../../lib/locationDefaults";
import { PlacesRequestError } from "../../lib/placesProtection";
import { saveClubhouseLocation } from "../../lib/locationSave";

// This route deliberately has no Google provider, limiter or credential dependency.
export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) throw new PlacesRequestError(401);
    const params = new URL(request.url).searchParams;
    return Response.json(await locationConfiguration(createAdminClient(), data.user.id, {
      teamId: params.get("teamId") ?? undefined, organizationId: params.get("organizationId") ?? undefined,
    }), { headers });
  } catch (error) {
    const safe = error instanceof PlacesRequestError ? error : new PlacesRequestError(503);
    return Response.json({ message: safe.message }, { headers, status: safe.status });
  }
}

export async function PATCH(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) throw new PlacesRequestError(401);
    const input = await request.json();
    if (!input || (input.locationId !== null && typeof input.locationId !== "string")) throw new PlacesRequestError(400);
    await updateLocationDefault(createAdminClient(), data.user.id, input, input.locationId);
    return Response.json({ ok: true }, { headers });
  } catch (error) {
    const safe = error instanceof PlacesRequestError ? error : new PlacesRequestError(503);
    return Response.json({ message: safe.message }, { headers, status: safe.status });
  }
}

export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) throw new PlacesRequestError(401);
    if (request.headers.get("sec-fetch-site") === "cross-site") throw new PlacesRequestError(403);
    const body = await request.text();
    if (body.length > 2048) throw new PlacesRequestError(413);
    const input = JSON.parse(body);
    if (!input || typeof input !== "object") throw new PlacesRequestError(400);
    return Response.json({ location: await saveClubhouseLocation(createAdminClient(), data.user.id, input) }, { headers });
  } catch (error) {
    const safe = error instanceof PlacesRequestError ? error : new PlacesRequestError(503);
    return Response.json({ message: safe.message }, { headers, status: safe.status });
  }
}

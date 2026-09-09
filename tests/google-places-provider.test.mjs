import test from "node:test";
import assert from "node:assert/strict";
import { googlePlacesProvider, normalizeGooglePlace, GOOGLE_DETAILS_FIELDS } from "../app/lib/googlePlacesProvider.ts";
import { localLocationMatches, locationLabel, locationMapsUrl } from "../app/lib/locationTypes.ts";

const component = (type, longText, shortText = longText) => ({ types: [type], longText, shortText });
test("normalizes a school/address without persisting provider objects", () => {
  const result = normalizeGooglePlace({ id: "place_fixture", formattedAddress: "10 Main St, Example, NC", addressComponents: [component("street_number", "10"), component("route", "Main St"), component("locality", "Example"), component("administrative_area_level_1", "North Carolina", "NC"), component("country", "United States", "US"), component("postal_code", "28079")], location: { latitude: 35, longitude: -80 } });
  assert.equal(result.city, "Example"); assert.equal(result.stateRegion, "NC"); assert.equal(result.countryCode, "US"); assert.equal(result.addressLine1, "10 Main St"); assert.equal(result.latitude, 35);
});
test("city selection does not invent a street address or coordinates", () => {
  const result = normalizeGooglePlace({ id: "city_fixture", addressComponents: [component("locality", "Example")] });
  assert.equal(result.addressLine1, ""); assert.equal(result.latitude, null); assert.equal(result.city, "Example");
});
test("postal town fallback and invalid coordinates are handled", () => {
  const result = normalizeGooglePlace({ id: "town_fixture", addressComponents: [component("postal_town", "Town")], location: { latitude: 91, longitude: NaN } });
  assert.equal(result.city, "Town"); assert.equal(result.latitude, null); assert.equal(result.longitude, null);
});
test("missing provider configuration fails safely without making a request", async () => {
  let calls = 0;
  await assert.rejects(googlePlacesProvider(undefined, async () => { calls++; }).autocomplete("school", "token"), /temporarily unavailable/);
  assert.equal(calls, 0);
});
test("minimum query length prevents external requests", async () => {
  let calls = 0;
  assert.deepEqual(await googlePlacesProvider("test", async () => { calls++; }).autocomplete("ab", "token"), []);
  assert.equal(calls, 0);
});
for (const status of [400, 401, 403, 429, 500, 503]) test(`provider ${status} never exposes raw error content`, async () => {
  const provider = googlePlacesProvider("test", async () => new Response('private-error-body', { status }));
  await assert.rejects(provider.autocomplete("school", "token"), (error) => error.message === "Location search is temporarily unavailable.");
});
test("aborted network calls return a safe error", async () => {
  const provider = googlePlacesProvider("test", async () => { throw new DOMException("private", "TimeoutError"); });
  await assert.rejects(provider.getPlace("place_fixture", "token"), /temporarily unavailable/);
});
test("autocomplete is bounded and uses the same session in Place Details", async () => {
  const calls = [];
  const provider = googlePlacesProvider("test", async (url, init) => {
    calls.push({ url, init });
    return Response.json(url.includes(":autocomplete") ? { suggestions: Array.from({ length: 9 }, (_, i) => ({ placePrediction: { placeId: `place_${i}`, structuredFormat: { mainText: { text: "Field" } } } })) } : { id: "place_0" });
  });
  assert.equal((await provider.autocomplete("field", "session-a")).length, 5);
  await provider.getPlace("place_0", "session-a");
  assert.equal(JSON.parse(calls[0].init.body).sessionToken, "session-a");
  assert.match(calls[1].url, /sessionToken=session-a/);
  assert.equal(calls[1].init.cache, "no-store");
  assert.equal(calls[1].init.headers["X-Goog-FieldMask"], GOOGLE_DETAILS_FIELDS);
  assert.doesNotMatch(GOOGLE_DETAILS_FIELDS, /displayName|reviews|photos|rating|website|phone|primaryType/);
});
test("saved reuse and historical display need no provider lookup", () => {
  const saved = { id: "fixture", name: "Coach's Field", city: "Example", providerPlaceId: "place_fixture", createdByProfileId: "coach" };
  assert.equal(localLocationMatches([saved], "coach").length, 1);
  assert.equal(locationLabel(saved, "old"), "Coach's Field");
  assert.equal(locationLabel(null, "Historic park"), "Historic park");
  assert.match(locationMapsUrl(saved), /query_place_id=place_fixture/);
});

// Run explicitly with node --env-file=.env.locations.local --experimental-strip-types.
// Only assertions/counts are logged. Never log provider objects or credentials.
import { randomUUID } from "node:crypto";
import { googlePlacesProvider } from "../app/lib/googlePlacesProvider.ts";

const provider = googlePlacesProvider(process.env.GOOGLE_PLACES_API_KEY);
const resolved = new Map();
let bias;
const queries = process.argv.includes("--bias-check")
  ? ["Metrolina Christian Academy", "MCA Baseball Field", "baseball field near Indian Trail"]
  : ["Metrolina Christian Academy", "Indian Trail, NC", "MCA Baseball Field", "Charlotte Christian School", "baseball field near Indian Trail", "732 Indian Trail Fairview Road, Indian Trail, NC"];
for (const query of queries) {
  try {
    const token = randomUUID();
    const suggestions = await provider.autocomplete(query, token, undefined, bias);
    let place;
    if (suggestions[0]) {
      const id = suggestions[0].providerPlaceId;
      place = resolved.get(id);
      if (!place) { place = await provider.getPlace(id, token); resolved.set(id, place); }
    }
    console.log(JSON.stringify({ query, suggestions: suggestions.length, resolved: Boolean(place), hasCity: Boolean(place?.city), stateIsNC: place?.stateRegion === "NC", hasCoordinates: place?.latitude != null && place?.longitude != null, hasPlaceId: Boolean(place?.providerPlaceId) }));
    if (process.argv.includes("--bias-check") && !bias && place?.latitude != null && place?.longitude != null) {
      bias = { latitude: place.latitude, longitude: place.longitude, radius: 30000 };
    }
  } catch (error) {
    console.log(JSON.stringify({ query, status: "provider_unavailable", configurationBlocked: error?.code === "configuration" }));
    if (error?.code === "configuration" || error?.code === "quota") break;
  }
}

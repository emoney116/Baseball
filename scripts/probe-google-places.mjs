// One request only. Never print response bodies, headers, error messages or keys.
import { randomUUID } from "node:crypto";
import { GOOGLE_AUTOCOMPLETE_FIELDS } from "../app/lib/googlePlacesProvider.ts";

if (!process.env.GOOGLE_PLACES_API_KEY) {
  console.log(JSON.stringify({ configured: false }));
  process.exitCode = 1;
} else {
  try {
    const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(6000),
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY, "X-Goog-FieldMask": GOOGLE_AUTOCOMPLETE_FIELDS },
      body: JSON.stringify({ input: "Metrolina Christian Academy", sessionToken: randomUUID(), includedRegionCodes: ["us"] }),
    });
    const body = await response.json();
    if (response.ok) {
      console.log(JSON.stringify({ configured: true, httpStatus: response.status, suggestionCount: Math.min(5, body.suggestions?.length ?? 0) }));
    } else {
      const details = Array.isArray(body.error?.details) ? body.error.details : [];
      const reasons = details.map(item => item.reason).filter(value => typeof value === "string" && /^[A-Z_]{1,80}$/.test(value));
      const services = details.map(item => item.metadata?.service).filter(value => value === "places.googleapis.com");
      const projects = details.map(item => item.metadata?.consumer).filter(value => typeof value === "string" && /^projects\/[0-9]{1,30}$/.test(value));
      console.log(JSON.stringify({ configured: true, httpStatus: response.status, reasons, services, projects }));
      process.exitCode = 1;
    }
  } catch {
    console.log(JSON.stringify({ configured: true, status: "probe_unavailable" }));
    process.exitCode = 1;
  }
}

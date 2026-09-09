import { createHmac } from "node:crypto";
import { isIP } from "node:net";

export type PlacesEnvironment = "production" | "preview" | "development";
export type PlacesOperation = "autocomplete" | "details";
export type PlacesEvent = "attempt" | "rate_limited" | "provider_error" | "unauthenticated" | "invalid" | "unavailable";
export class PlacesRequestError extends Error {
  status: number;
  retryAfter: number;
  constructor(status: number, retryAfter = 0) {
    super(status === 401 ? "Sign in to search locations." : status === 429 ? "Location search limit reached. Try again shortly or choose a saved location." : "Location search is temporarily unavailable.");
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export function placesEnvironment(value: string | undefined): PlacesEnvironment {
  return value === "production" || value === "preview" ? value : "development";
}

// Only trust the hosting proxy's overwritten header, never arbitrary forwarding headers locally.
export function placesIpBucket(headers: Headers, vercel: boolean) {
  if (!vercel) return "local-shared";
  const candidate = headers.get("x-forwarded-for")?.trim() ?? "";
  if (!isIP(candidate)) return "unknown-shared";
  if (isIP(candidate) === 6) {
    const normalized = new URL(`http://[${candidate}]/`).hostname.slice(1, -1);
    const [left, right = ""] = normalized.split("::");
    const a = left ? left.split(":") : [];
    const b = right ? right.split(":") : [];
    const groups = normalized.includes("::") ? [...a, ...Array(8 - a.length - b.length).fill("0"), ...b] : a;
    // Aggregate IPv6 privacy addresses within a /64 to avoid trivial IP rotation.
    return `${groups.slice(0, 4).map(group => group.padStart(4, "0")).join(":")}/64`;
  }
  return candidate;
}

export function placesDigest(secret: string | undefined, kind: "ip" | "query", value: string) {
  if (!secret) throw new PlacesRequestError(503);
  return createHmac("sha256", secret).update(`clubhouse-places:${kind}:${value}`).digest("hex");
}

export function normalizedPlacesQuery(value: unknown) {
  if (typeof value !== "string" || value.length > 200) throw new PlacesRequestError(400);
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

// Allowlisted aggregate dimensions only: no query, IP, user ID, token or provider payload.
export function placesTelemetry(environment: PlacesEnvironment, operation: PlacesOperation, event: PlacesEvent) {
  return { system: "places", environment, operation, event,
    estimatedUsd: event === "attempt" ? (operation === "autocomplete" ? 0.00283 : 0.005) : 0 };
}

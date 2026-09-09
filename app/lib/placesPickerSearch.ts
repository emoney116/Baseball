import type { ClubhouseLocation, LocationSuggestion, ResolvedPlace, LocationScope } from "./locationTypes.ts";
import { localLocationMatches } from "./locationTypes.ts";

type SearchResult = { saved?: ClubhouseLocation[]; suggestions?: LocationSuggestion[]; place?: ResolvedPlace; receipt?: string; message?: string };
export function createPlacesPickerSearch(
  scope: LocationScope,
  saved: ClubhouseLocation[],
  onResult: (result: SearchResult) => void,
  transport: typeof fetch = fetch,
) {
  let token = crypto.randomUUID();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  let generation = 0;
  let closed = false;
  let lastQuery = "";
  let blockedUntil = 0;
  const cancel = () => { generation++; clearTimeout(timer); controller?.abort(); };
  async function send(body: Record<string, unknown>, version: number) {
    controller = new AbortController();
    try {
      const response = await transport("/api/locations/search", { method: "POST", cache: "no-store", signal: controller.signal,
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...scope, sessionToken: token, ...body }) });
      if (version !== generation || closed) return;
      if (!response.ok) {
        if (response.status === 429) blockedUntil = Date.now() + Math.min(86400, Math.max(1, Number(response.headers.get("Retry-After")) || 60)) * 1000;
        onResult({ message: "Location search is temporarily unavailable. Choose a saved location or try again later." });
        return;
      }
      const result = await response.json() as SearchResult;
      if (version === generation && !closed) onResult(result);
    } catch {
      if (version === generation && !closed && !controller?.signal.aborted) onResult({ message: "Location search is temporarily unavailable." });
    }
  }
  return {
    search(query: string, external = false) {
      if (closed) return;
      const normalized = query.trim().replace(/\s+/g, " ");
      const signature = `${external}:${normalized.toLowerCase()}`;
      if (signature === lastQuery) return;
      cancel(); lastQuery = signature;
      const matches = localLocationMatches(saved, normalized).slice(0, 20);
      onResult({ saved: matches, suggestions: [] });
      if (normalized.length < 3 || normalized.length > 200 || (matches.length && !external) || Date.now() < blockedUntil) return;
      const version = generation;
      timer = setTimeout(() => { void send({ operation: "autocomplete", query: normalized, external }, version); }, 300);
    },
    async select(suggestion: LocationSuggestion) {
      if (closed) return;
      cancel(); lastQuery = "";
      const existing = saved.find(location => location.providerPlaceId === suggestion.providerPlaceId);
      if (existing) { onResult({ saved: [existing] }); return; }
      if (Date.now() < blockedUntil) return;
      const pending = send({ operation: "details", placeId: suggestion.providerPlaceId }, generation);
      // A selected result terminates the billing interaction even if Details fails.
      token = crypto.randomUUID();
      await pending;
    },
    close() { closed = true; cancel(); },
  };
}

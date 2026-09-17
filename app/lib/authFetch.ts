/** Bound auth requests so offline sign-in cannot leave the form busy forever. */
export function createAuthFetch(fetcher: typeof fetch, timeoutMs = 20000): typeof fetch {
  return async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!new URL(url).pathname.startsWith("/auth/v1/")) return fetcher(input, init);
    const controller = new AbortController();
    const incoming = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const abort = () => controller.abort(incoming?.reason);
    if (incoming?.aborted) abort();
    else incoming?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => controller.abort(new DOMException("Authentication request timed out", "TimeoutError")), timeoutMs);
    try { return await fetcher(input, { ...init, signal: controller.signal }); }
    finally { clearTimeout(timer); incoming?.removeEventListener("abort", abort); }
  };
}

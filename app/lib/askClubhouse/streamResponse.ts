import type { AskStreamEvent } from "./stream.ts";

export function createAskResponseStream(
  requestSignal: AbortSignal,
  run: (emit: (event: AskStreamEvent) => void, signal: AbortSignal) => Promise<Response>,
): Response {
  const cancellation = new AbortController();
  const signal = AbortSignal.any([requestSignal, cancellation.signal]);
  const encoder = new TextEncoder();
  let closed = false;
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: AskStreamEvent) => {
        if (!closed && !signal.aborted) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      try {
        const response = await run(emit, signal);
        emit({ type: "result", response: await response.json() });
      } catch {
        emit({ type: "result", response: { ok: false, status: "failed", answer: "The answer was interrupted. Please try again.", code: "AI_STREAM_ERROR" } });
      } finally {
        if (!closed) { closed = true; controller.close(); }
      }
    },
    cancel() { closed = true; cancellation.abort(); },
  });
  return new Response(body, { headers: {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-store, no-transform",
    "X-Accel-Buffering": "no",
  } });
}

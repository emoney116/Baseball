import type { AskClubhouseApiResponse } from "./types.ts";

export const ASK_PROGRESS_LABELS = {
  access: "Checking your question",
  records: "Reading your Clubhouse data",
  analysis: "Reviewing the relevant information",
  answer: "Preparing your answer",
  saving: "Finishing up",
} as const;
export type AskProgressStage = keyof typeof ASK_PROGRESS_LABELS;
export type AskProgressStep = { stage: AskProgressStage; startedAt: number };
export type AskStreamingState = {
  content: string;
  pending?: boolean;
  streaming?: boolean;
  steps?: AskProgressStep[];
  stopped?: boolean;
  interrupted?: boolean;
  completedAt?: number;
};
export type AskStreamEvent =
  | { type: "progress"; stage: AskProgressStage }
  | { type: "delta"; text: string }
  | { type: "result"; response: AskClubhouseApiResponse };

export function advanceAskMessage<T extends AskStreamingState>(message: T, event: Exclude<AskStreamEvent, { type: "result" }>, now = Date.now()): T {
  if (event.type === "delta") return { ...message, streaming: true, content: (message.streaming ? message.content : "") + event.text };
  const steps = message.steps ?? [];
  if (steps.some(step => step.stage === event.stage)) return message;
  return { ...message, steps: [...steps, { stage: event.stage, startedAt: now }] };
}

export function stopAskMessage<T extends AskStreamingState>(message: T, now = Date.now()): T {
  return { ...message, content: message.streaming ? message.content : "", pending: false, streaming: false, stopped: true, completedAt: now };
}

// Both transports can split a UTF-8 character or JSON record across network chunks.
export async function* readStreamLines(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    signal?.throwIfAborted();
    while (true) {
      const { value, done } = await reader.read();
      signal?.throwIfAborted();
      buffer += decoder.decode(value, { stream: !done });
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        if (newline > 2_000_000) throw new Error("The response stream exceeded its limit.");
        const line = buffer.slice(0, newline).replace(/\r$/, "");
        buffer = buffer.slice(newline + 1);
        yield line;
      }
      if (buffer.length > 2_000_000) throw new Error("The response stream exceeded its limit.");
      if (done) break;
    }
    if (buffer.trim()) yield buffer;
  } finally {
    signal?.removeEventListener("abort", cancel);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function readAskResponse(
  response: Response,
  onEvent: (event: Exclude<AskStreamEvent, { type: "result" }>) => void,
  signal?: AbortSignal,
): Promise<AskClubhouseApiResponse> {
  if (!response.headers.get("content-type")?.includes("application/x-ndjson")) {
    const payload = await response.json() as AskClubhouseApiResponse;
    signal?.throwIfAborted();
    return payload;
  }
  if (!response.body) throw new Error("The response stream is unavailable.");
  for await (const line of readStreamLines(response.body, signal)) {
    if (!line.trim()) continue;
    const event = JSON.parse(line) as AskStreamEvent;
    if (event.type === "result") return event.response;
    if (event.type === "delta" && typeof event.text === "string") onEvent(event);
    if (event.type === "progress" && Object.hasOwn(ASK_PROGRESS_LABELS, event.stage)) onEvent(event);
  }
  throw new Error("The connection ended before the answer was complete. Please try again.");
}

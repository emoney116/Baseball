import type { AIProvider, AIProviderResult } from "./types.ts";
import { readStreamLines } from "./stream.ts";

export class AskClubhouseProviderError extends Error {
  code: "rate_limited" | "quota" | "unavailable" | "provider_error";
  status?: number;

  constructor(code: AskClubhouseProviderError["code"], message: string, status?: number) {
    super(message);
    this.name = "AskClubhouseProviderError";
    this.code = code;
    this.status = status;
  }
}

export class OpenAIProvider implements AIProvider {
  readonly model: string;
  private readonly apiKey: string;

  constructor(input: { apiKey?: string; model: string }) {
    const apiKey = input.apiKey?.trim();
    if (!apiKey) throw new AskClubhouseProviderError("unavailable", "OpenAI API key is not configured.");
    this.apiKey = apiKey;
    this.model = input.model;
  }

  async generate(input: {
    system: string;
    prompt: string;
    maxOutputTokens: number;
    webSearch?: { enabled: boolean; maxSearches: number };
    structured?: { name: string; schema: Record<string, unknown>; image?: string };
    onTextDelta?: (text: string) => void;
    signal?: AbortSignal;
  }): Promise<AIProviderResult> {
    const webSearchEnabled = Boolean(input.webSearch?.enabled && input.webSearch.maxSearches > 0);
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: input.signal ? AbortSignal.any([input.signal, AbortSignal.timeout(60000)]) : AbortSignal.timeout(input.structured ? 45000 : 60000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        instructions: input.system,
        input: input.structured?.image ? [{ role: "user", content: [{ type: "input_text", text: input.prompt }, { type: "input_image", image_url: input.structured.image }] }] : input.prompt,
        ...(input.structured ? { text: { format: { type: "json_schema", name: input.structured.name, schema: input.structured.schema, strict: true } } } : {}),
        max_output_tokens: input.maxOutputTokens,
        store: false,
        ...(input.onTextDelta && !input.structured ? { stream: true } : {}),
        ...(webSearchEnabled ? {
          tools: [{ type: "web_search" }],
          tool_choice: "required",
          max_tool_calls: input.webSearch?.maxSearches ?? 1,
          include: ["web_search_call.action.sources"],
        } : {}),
      }),
    });

    const streamed = response.ok && response.headers.get("content-type")?.includes("text/event-stream");
    const payload = streamed
      ? await consumeProviderStream(response, input.onTextDelta, input.signal)
      : await response.json().catch(() => ({})) as OpenAIResponsesPayload;
    if (!response.ok) {
      const message = payload.error?.message ?? "Ask Clubhouse is temporarily unavailable.";
      const code = classifyProviderError(response.status, message);
      throw new AskClubhouseProviderError(code, message, response.status);
    }

    const text = extractResponseText(payload).trim();
    return {
      text: text || "I found the data, but could not format a useful answer. Try asking again more specifically.",
      usage: extractUsage(payload, this.model),
      model: payload.model ?? this.model,
      webSearchCount: countWebSearches(payload),
      sources: extractSources(payload),
    };
  }
}

async function consumeProviderStream(response: Response, onTextDelta?: (text: string) => void, signal?: AbortSignal): Promise<OpenAIResponsesPayload> {
  if (!response.body) throw new AskClubhouseProviderError("provider_error", "The answer stream is unavailable.");
  for await (const line of readStreamLines(response.body, signal)) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    const event = JSON.parse(data) as { type?: string; delta?: string; response?: OpenAIResponsesPayload; message?: string };
    // Only answer text crosses the boundary; never expose private reasoning events.
    if (event.type === "response.output_text.delta" && event.delta) onTextDelta?.(event.delta);
    if (event.type === "response.completed" && event.response) return event.response;
    if (event.type === "error" || event.type === "response.failed" || event.type === "response.incomplete") {
      throw new AskClubhouseProviderError("provider_error", event.response?.error?.message ?? event.message ?? "The answer could not be completed.");
    }
  }
  throw new AskClubhouseProviderError("provider_error", "The answer stream ended unexpectedly.");
}

interface OpenAIResponsesPayload {
  output_text?: string;
  model?: string;
  usage?: {
    input_tokens?: number;
    input_tokens_details?: {
      cache_write_tokens?: number;
      cached_tokens?: number;
    };
    output_tokens?: number;
    output_tokens_details?: {
      reasoning_tokens?: number;
    };
    total_tokens?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
  };
  output?: Array<{
    type?: string;
    action?: {
      sources?: Array<{
        title?: string;
        url?: string;
      }>;
    };
    content?: Array<{
      type?: string;
      text?: string;
      annotations?: Array<{
        type?: string;
        title?: string;
        url?: string;
      }>;
    }>;
  }>;
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
}

function countWebSearches(payload: OpenAIResponsesPayload): number {
  return (payload.output ?? []).filter((item) => item.type === "web_search_call").length;
}

function extractSources(payload: OpenAIResponsesPayload) {
  const sources = (payload.output ?? []).flatMap((item) => [
    ...(item.action?.sources ?? []),
    ...(item.content ?? []).flatMap((part) => part.annotations ?? []),
  ]);
  return [...new Map(sources
    .filter((source) => source.url)
    .map((source) => [source.url, {
      title: source.title?.trim() || "Baseball source",
      summary: "External baseball context",
      url: source.url,
    }])).values()].slice(0, 5);
}

function extractResponseText(payload: OpenAIResponsesPayload): string {
  if (typeof payload.output_text === "string") return payload.output_text;
  return (payload.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((part) => part.text)
    .filter((text): text is string => Boolean(text))
    .join("\n");
}

function extractUsage(payload: OpenAIResponsesPayload, fallbackModel: string) {
  const usage = payload.usage;
  if (!usage) return { model: payload.model ?? fallbackModel };
  const inputTokens = usage.input_tokens ?? usage.prompt_tokens;
  const outputTokens = usage.output_tokens ?? usage.completion_tokens;
  return {
    inputTokens,
    cachedInputTokens: usage.input_tokens_details?.cached_tokens,
    cacheWriteTokens: usage.input_tokens_details?.cache_write_tokens,
    outputTokens,
    reasoningTokens: usage.output_tokens_details?.reasoning_tokens,
    totalTokens: usage.total_tokens ?? (typeof inputTokens === "number" && typeof outputTokens === "number" ? inputTokens + outputTokens : undefined),
    model: payload.model ?? fallbackModel,
  };
}

function classifyProviderError(status: number, message: string): AskClubhouseProviderError["code"] {
  const lower = message.toLowerCase();
  if (status === 429 && /(quota|billing|spend|limit|insufficient)/.test(lower)) return "quota";
  if (status === 429) return "rate_limited";
  if (/(quota|billing|spend|limit|insufficient)/.test(lower)) return "quota";
  return status >= 500 ? "unavailable" : "provider_error";
}

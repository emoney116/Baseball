import type { AIProvider, AIProviderResult } from "./types";

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
  }): Promise<AIProviderResult> {
    const webSearchEnabled = Boolean(input.webSearch?.enabled && input.webSearch.maxSearches > 0);
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        instructions: input.system,
        input: input.prompt,
        max_output_tokens: input.maxOutputTokens,
        store: false,
        ...(webSearchEnabled ? {
          tools: [{ type: "web_search" }],
          tool_choice: "required",
          max_tool_calls: input.webSearch?.maxSearches ?? 1,
          include: ["web_search_call.action.sources"],
        } : {}),
      }),
    });

    const payload = await response.json().catch(() => ({})) as OpenAIResponsesPayload;
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

interface OpenAIResponsesPayload {
  output_text?: string;
  model?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
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
    outputTokens,
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

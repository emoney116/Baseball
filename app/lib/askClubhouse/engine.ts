import type { AppData } from "../../types";
import type { AskClubhouseConfig } from "./config";
import { AskClubhouseProviderError } from "./provider.ts";
import {
  buildAskClubhouseToolPlan,
  fallbackAnswerFromTools,
  runAskClubhouseTools,
  summarizeToolEvidence,
} from "./tools.ts";
import type {
  AIProvider,
  AIProviderUsage,
  AskClubhouseAction,
  AskClubhouseApiResponse,
  AskClubhouseClientMessage,
  AskClubhouseStatus,
  AskClubhouseToolResult,
  AskClubhouseUiContext,
} from "./types";

export interface GenerateAskReplyInput {
  data: AppData;
  message: string;
  conversationId?: string;
  history?: AskClubhouseClientMessage[];
  uiContext?: AskClubhouseUiContext;
  config: AskClubhouseConfig;
  provider?: AIProvider;
  now?: Date;
}

export interface GenerateAskReplyResult extends AskClubhouseApiResponse {
  providerUsage?: AIProviderUsage;
  toolResults: AskClubhouseToolResult[];
  toolNames: string[];
  toolParams: Record<string, unknown>[];
  webSearchCount: number;
}

export async function generateAskClubhouseReply(input: GenerateAskReplyInput): Promise<GenerateAskReplyResult> {
  const startedAt = input.now?.getTime() ?? Date.now();
  const plan = buildAskClubhouseToolPlan(input.data, input.message, input.uiContext, input.config);
  const webSearchCount = 0;

  if (plan.status !== "data") {
    const latencyMs = elapsedMs(startedAt);
    return {
      ok: plan.status === "completed",
      status: plan.status,
      answer: plan.answer,
      actions: plan.actions,
      followUps: plan.followUps,
      usage: {
        model: input.provider?.model ?? input.config.model,
        toolCallCount: 0,
        webSearchCount,
        latencyMs,
      },
      toolResults: [],
      toolNames: [],
      toolParams: [],
      webSearchCount,
    };
  }

  const toolResults = runAskClubhouseTools(input.data, plan.toolRequests, input.config);
  const toolNames = toolResults.map((tool) => tool.name);
  const toolParams = toolResults.map((tool) => tool.parameters ?? {});
  const noData = toolResults.every((tool) => !tool.rows?.length);

  if (noData) {
    const answer = fallbackAnswerFromTools(plan, toolResults);
    const latencyMs = elapsedMs(startedAt);
    return {
      ok: true,
      status: "no_data",
      answer,
      evidence: summarizeToolEvidence(toolResults),
      actions: plan.actions,
      followUps: plan.followUps,
      usage: {
        model: input.provider?.model ?? input.config.model,
        toolCallCount: toolResults.length,
        webSearchCount,
        latencyMs,
      },
      toolResults,
      toolNames,
      toolParams,
      webSearchCount,
    };
  }

  if (!input.provider) {
    const latencyMs = elapsedMs(startedAt);
    return {
      ok: false,
      status: "unavailable",
      answer: "Ask Clubhouse AI is not configured yet. Add the server OpenAI key to enable live answers.",
      evidence: summarizeToolEvidence(toolResults),
      actions: plan.actions,
      followUps: plan.followUps,
      usage: {
        model: input.config.model,
        toolCallCount: toolResults.length,
        webSearchCount,
        latencyMs,
      },
      code: "AI_PROVIDER_NOT_CONFIGURED",
      toolResults,
      toolNames,
      toolParams,
      webSearchCount,
    };
  }

  try {
    const providerResult = await input.provider.generate({
      system: buildSystemPrompt(input.config),
      prompt: buildUserPrompt(input, toolResults, plan.actions, plan.followUps),
      maxOutputTokens: input.config.maxOutputTokens,
    });
    const latencyMs = elapsedMs(startedAt);
    return {
      ok: true,
      status: "completed",
      answer: providerResult.text,
      evidence: summarizeToolEvidence(toolResults),
      actions: plan.actions,
      followUps: plan.followUps,
      usage: {
        ...providerResult.usage,
        model: providerResult.usage?.model ?? providerResult.model ?? input.provider.model,
        toolCallCount: toolResults.length,
        webSearchCount,
        latencyMs,
      },
      providerUsage: providerResult.usage,
      toolResults,
      toolNames,
      toolParams,
      webSearchCount,
    };
  } catch (error) {
    const latencyMs = elapsedMs(startedAt);
    const providerError = error instanceof AskClubhouseProviderError ? error : undefined;
    const status: AskClubhouseStatus = providerError?.code === "rate_limited" || providerError?.code === "quota" ? "unavailable" : "failed";
    return {
      ok: false,
      status,
      answer: "Ask Clubhouse is temporarily unavailable. Your team data is safe; try again in a bit.",
      evidence: summarizeToolEvidence(toolResults),
      actions: plan.actions,
      followUps: plan.followUps,
      usage: {
        model: input.provider.model,
        toolCallCount: toolResults.length,
        webSearchCount,
        latencyMs,
      },
      code: providerError?.code ?? "AI_PROVIDER_ERROR",
      toolResults,
      toolNames,
      toolParams,
      webSearchCount,
    };
  }
}

export function boundConversationHistory(messages: AskClubhouseClientMessage[] | undefined, limit: number): AskClubhouseClientMessage[] {
  return (messages ?? [])
    .filter((message) => (message.role === "user" || message.role === "assistant") && message.content.trim())
    .slice(-Math.max(0, limit))
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, 1200),
      createdAt: message.createdAt,
    }));
}

function buildSystemPrompt(config: AskClubhouseConfig): string {
  return [
    "You are Ask Clubhouse, a baseball analytics assistant inside Clubhouse 9.",
    "Answer only about Clubhouse team data, player development, baseball, or weight room context.",
    "Use the supplied tool summaries as the source of truth. Do not invent stats, raw records, SQL, hidden data, or permissions.",
    "Be concise and coach-friendly. Start with the answer, then explain the sample/denominator when it matters.",
    "Call out small samples, missing data, and unsupported metrics plainly.",
    "Do not ask the user to run queries. Offer the provided analytics actions when useful.",
    `Keep the response under ${config.maxOutputTokens} output tokens.`,
  ].join("\n");
}

function buildUserPrompt(
  input: GenerateAskReplyInput,
  toolResults: AskClubhouseToolResult[],
  actions: AskClubhouseAction[],
  followUps: string[],
): string {
  const currentTeam = input.data.teamContext?.currentTeam;
  const history = boundConversationHistory(input.history, input.config.contextMessageLimit);
  return JSON.stringify({
    question: input.message,
    scope: {
      team: currentTeam?.teamName,
      season: currentTeam?.seasonName,
      organization: currentTeam?.organizationName,
      role: currentTeam?.role,
    },
    recentConversation: history,
    boundedToolResults: toolResults,
    availableActions: actions,
    suggestedFollowUps: followUps,
  });
}

function elapsedMs(startedAt: number): number {
  return Math.max(0, Date.now() - startedAt);
}

import type { AppData } from "../../types.ts";
import type { AskClubhouseConfig } from "./config.ts";
import { AskClubhouseProviderError } from "./provider.ts";
import type { BaseballKnowledgeItem, BaseballKnowledgeProvider } from "./knowledge.ts";
import {
  buildAskClubhouseToolPlan,
  fallbackAnswerFromTools,
  runAskClubhouseTools,
  summarizeKnowledgeEvidence,
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
} from "./types.ts";

export interface GenerateAskReplyInput {
  data: AppData;
  message: string;
  conversationId?: string;
  history?: AskClubhouseClientMessage[];
  uiContext?: AskClubhouseUiContext;
  config: AskClubhouseConfig;
  provider?: AIProvider;
  knowledgeProvider?: BaseballKnowledgeProvider;
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
  const history = boundConversationHistory(input.history, input.config.contextMessageLimit);
  const plan = buildAskClubhouseToolPlan(input.data, input.message, input.uiContext, input.config, history, input.knowledgeProvider);
  let webSearchCount = 0;
  const knowledgeEvidence = summarizeKnowledgeEvidence(plan.knowledgeItems);

  if (plan.status !== "data" && plan.status !== "provider") {
    const latencyMs = elapsedMs(startedAt);
    const diagnosisEvidence = plan.diagnosis?.evidence.map((item) => ({ id: item.id, title: item.title, summary: item.summary })) ?? [];
    return {
      ok: plan.status === "completed",
      status: plan.status,
      route: plan.route,
      answer: plan.answer,
      evidence: [...diagnosisEvidence, ...knowledgeEvidence].slice(0, 6),
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

  const toolResults = plan.status === "data" ? runAskClubhouseTools(input.data, plan.toolRequests, input.config) : [];
  const toolNames = toolResults.map((tool) => tool.name);
  const toolParams = toolResults.map((tool) => tool.parameters ?? {});
  const analyticToolResults = toolResults.filter((tool) => tool.name !== "getDataCoverage");
  const noData = plan.status === "data" && analyticToolResults.every((tool) => !tool.rows?.length);
  const lowSample = hasLowSample(toolResults);

  if (plan.externalResearchRequired && !input.config.webSearchEnabled) {
    const latencyMs = elapsedMs(startedAt);
    return {
      ok: true,
      status: "completed",
      route: plan.route,
      answer: "I found the Clubhouse data, but verified current baseball context isn't available in this beta yet. I won't guess at the comparison.",
      evidence: [...knowledgeEvidence, ...summarizeToolEvidence(toolResults)].slice(0, 6),
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

  if (noData && plan.route === "clubhouse_data") {
    const answer = fallbackAnswerFromTools(plan, toolResults);
    const latencyMs = elapsedMs(startedAt);
    return {
      ok: true,
      status: "no_data",
      route: plan.route,
      answer,
      evidence: [...knowledgeEvidence, ...summarizeToolEvidence(toolResults)].slice(0, 6),
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
      route: plan.route,
      answer: "Ask Clubhouse AI is not configured yet. Add the server OpenAI key to enable live answers.",
      evidence: [...knowledgeEvidence, ...summarizeToolEvidence(toolResults)].slice(0, 6),
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
      system: buildSystemPrompt(input.config, plan.route, plan.requiresWebSearch, plan.knowledgeItems.length > 0),
      prompt: buildUserPrompt(input, toolResults, plan.actions, plan.followUps, plan.route, plan.interpretation, plan.knowledgeItems),
      maxOutputTokens: input.config.maxOutputTokens,
      webSearch: {
        enabled: plan.requiresWebSearch,
        maxSearches: Math.min(1, input.config.maxWebSearchesPerRequest),
      },
    });
    webSearchCount = Math.min(providerResult.webSearchCount ?? 0, input.config.maxWebSearchesPerRequest);
    const latencyMs = elapsedMs(startedAt);
    return {
      ok: true,
      status: lowSample ? "low_sample" : "completed",
      route: plan.route,
      answer: providerResult.text,
      evidence: [...knowledgeEvidence, ...summarizeToolEvidence(toolResults), ...(providerResult.sources ?? [])].slice(0, 6),
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
    const answer = plan.requiresWebSearch
      ? plan.route === "mixed"
        ? "I found the Clubhouse data, but couldn't verify the current external baseball context right now. Try again in a bit."
        : "I couldn't verify the current baseball guidance right now. Try again in a bit."
      : "Ask Clubhouse is temporarily unavailable. Your team data is safe; try again in a bit.";
    return {
      ok: false,
      status,
      route: plan.route,
      answer,
      evidence: [...knowledgeEvidence, ...summarizeToolEvidence(toolResults)].slice(0, 6),
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

function buildSystemPrompt(config: AskClubhouseConfig, route: GenerateAskReplyResult["route"], usesWebSearch: boolean, hasTrustedKnowledge: boolean): string {
  return [
    "You are Ask Clubhouse, a baseball analytics assistant inside Clubhouse 9.",
    "Answer only about Clubhouse team data, player development, baseball, or weight room context.",
    `This message was independently routed as ${route}. Do not inherit a previous message's route when answering it.`,
    "Use supplied Clubhouse tool summaries as the source of truth for internal data. Do not invent stats, raw records, SQL, hidden data, or permissions.",
    usesWebSearch
      ? "Use the bounded web search only for current baseball rules or external benchmarks. Prefer authoritative governing-body and established baseball sources, and distinguish external context from Clubhouse data."
      : "No web search is available for this message. Do not imply that current rules or benchmarks were verified externally.",
    hasTrustedKnowledge
      ? "Use the supplied verified or reviewed Baseball Knowledge Bank context as trusted baseball guidance."
      : "Treat any unsourced current-rule or benchmark claim as unverified.",
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
  route: GenerateAskReplyResult["route"],
  interpretation?: string,
  knowledgeItems: BaseballKnowledgeItem[] = [],
): string {
  const currentTeam = input.data.teamContext?.currentTeam;
  const history = boundConversationHistory(input.history, input.config.contextMessageLimit);
  return JSON.stringify({
    question: input.message,
    route,
    interpretation,
    scope: {
      team: currentTeam?.teamName,
      season: currentTeam?.seasonName,
      organization: currentTeam?.organizationName,
      role: currentTeam?.role,
    },
    recentConversation: history,
    boundedToolResults: toolResults,
    baseballKnowledgeContext: knowledgeItems.map((item) => ({
      id: item.id,
      title: item.title,
      content: item.content,
      category: item.category,
      subcategory: item.subcategory,
      level: item.level,
      governingBody: item.governingBody,
      version: item.version,
      source: item.source,
      sourceReference: item.sourceReference,
      verifiedAt: item.verifiedAt,
      expiresAt: item.expiresAt,
      documentId: item.documentId,
      chunkId: item.chunkId,
      status: item.status,
    })),
    availableActions: actions,
    suggestedFollowUps: followUps,
  });
}

function hasLowSample(toolResults: AskClubhouseToolResult[]): boolean {
  const coverage = toolResults.find((tool) => tool.coverage)?.coverage;
  if (coverage && coverage.tracked > 0 && coverage.tracked < coverage.minimumSample) return true;
  return toolResults
    .filter((tool) => tool.name !== "getDataCoverage")
    .some((tool) => {
      const rankingMetric = tool.query?.sort?.metricId;
      if (!rankingMetric || !tool.rows?.length) return false;
      const rankingCells = tool.rows.map((row) => row.metrics.find((cell) => cell.metricId === rankingMetric)).filter(Boolean);
      return rankingCells.length > 0 && rankingCells.every((cell) => cell?.kind === "insufficient-sample");
    });
}

function elapsedMs(startedAt: number): number {
  return Math.max(0, Date.now() - startedAt);
}

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiUsageRole, AskClubhouseConfig } from "./config.ts";
import { calculateAIRequestCost } from "./pricing.ts";
import type { AIProviderUsage, AskClubhouseStatus } from "./types.ts";

export class AiUsageStoreError extends Error {
  code: "missing_storage" | "storage_error";

  constructor(code: AiUsageStoreError["code"], message: string) {
    super(message);
    this.name = "AiUsageStoreError";
    this.code = code;
  }
}

export type AiQuotaOutcome = "useful_answer" | "not_counted";

export interface AiUsageLimitInput {
  profileId: string;
  organizationId?: string;
  teamId?: string;
  role: AiUsageRole;
  requiresWebSearch: boolean;
  requestHash: string;
  config: AskClubhouseConfig;
  now?: Date;
  timezone?: string;
  isAdmin?: boolean;
}

export interface AiUsageLimitResult {
  allowed: boolean;
  status?: "rate_limited" | "duplicate";
  message?: string;
  code?: string;
}

export interface AiUsageWindowStats {
  userDailyRequests: number;
  teamDailyRequests: number;
  teamMonthlyRequests: number;
  userDailyWebSearches: number;
  teamDailyWebSearches: number;
  teamMonthlyCostUsd: number;
  globalMonthlyCostUsd: number;
}

export interface StartUsageInput {
  profileId: string;
  organizationId?: string;
  teamId?: string;
  seasonId?: string;
  conversationId?: string;
  requestHash: string;
  model: string;
  toolNames?: string[];
  toolParams?: Record<string, unknown>[];
  metadata?: Record<string, unknown>;
}

export interface FinishUsageInput {
  usageEventId?: string;
  messageId?: string;
  status: AskClubhouseStatus;
  latencyMs: number;
  providerUsage?: AIProviderUsage;
  toolCallCount: number;
  webSearchCount: number;
  toolNames?: string[];
  toolParams?: Record<string, unknown>[];
  errorCode?: string;
  metadata?: Record<string, unknown>;
  quotaOutcome?: AiQuotaOutcome;
}

interface AiUsageEventRow {
  profile_id: string;
  organization_id?: string | null;
  team_id?: string | null;
  model?: string | null;
  status: string;
  input_tokens?: number | null;
  output_tokens?: number | null;
  web_search_count?: number | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export function createAiRequestHash(input: { profileId: string; teamId?: string; message: string }): string {
  return createHash("sha256")
    .update([input.profileId, input.teamId ?? "clubhouse", normalizeQuestion(input.message)].join("\n"))
    .digest("hex");
}

export async function enforceAiUsageLimits(
  supabase: SupabaseClient,
  input: AiUsageLimitInput,
): Promise<AiUsageLimitResult> {
  const now = input.now ?? new Date();
  if (input.config.requestCooldownSeconds > 0) {
    const cooldownStart = new Date(now.getTime() - input.config.requestCooldownSeconds * 1000).toISOString();
    const { data, error } = await supabase
      .from("ai_usage_events")
      .select("id,status,created_at")
      .eq("profile_id", input.profileId)
      .eq("request_hash", input.requestHash)
      .gte("created_at", cooldownStart)
      .limit(1)
      .maybeSingle();
    if (error) throw usageError(error);
    if (data) {
      return {
        allowed: false,
        status: "duplicate",
        code: "AI_DUPLICATE_COOLDOWN",
        message: "That question is already being handled. Give it a moment, then ask again.",
      };
    }
  }

  const timezone = input.timezone ?? input.config.defaultTimezone;
  const monthStart = startOfMonthInTimeZone(now, timezone).toISOString();
  const rows = await fetchUsageRows(supabase, monthStart);
  const stats = summarizeAiUsageWindows(rows, input, now, timezone);
  return evaluateAiUsageLimits(input, stats);
}

export function evaluateAiUsageLimits(
  input: Pick<AiUsageLimitInput, "teamId" | "role" | "requiresWebSearch" | "config" | "isAdmin">,
  stats: AiUsageWindowStats,
): AiUsageLimitResult {
  const userRequestLimit = input.isAdmin && input.config.internalTestingEnabled
    ? input.config.adminTestingRequestLimit
    : input.config.dailyRoleRequestLimits[input.role];
  if (stats.userDailyRequests >= userRequestLimit) {
    return {
      allowed: false,
      status: "rate_limited",
      code: "AI_DAILY_USER_LIMIT",
      message: "You've reached today's Ask Clubhouse limit. It resets at midnight.",
    };
  }

  if (input.teamId) {
    if (stats.teamDailyRequests >= input.config.dailyTeamRequestLimit) {
      return {
        allowed: false,
        status: "rate_limited",
        code: "AI_DAILY_TEAM_LIMIT",
        message: "Ask Clubhouse has reached this team's current usage limit.",
      };
    }
    if (stats.teamMonthlyRequests >= input.config.monthlyTeamRequestLimit) {
      return {
        allowed: false,
        status: "rate_limited",
        code: "AI_MONTHLY_TEAM_REQUEST_LIMIT",
        message: "Ask Clubhouse has reached this team's current usage limit.",
      };
    }
    if (stats.teamMonthlyCostUsd >= input.config.monthlyTeamCostLimitUsd) {
      return {
        allowed: false,
        status: "rate_limited",
        code: "AI_MONTHLY_TEAM_COST_LIMIT",
        message: "Ask Clubhouse has reached this team's current usage limit.",
      };
    }
  }

  if (stats.globalMonthlyCostUsd >= input.config.monthlyGlobalCostLimitUsd) {
    return {
      allowed: false,
      status: "rate_limited",
      code: "AI_MONTHLY_GLOBAL_COST_LIMIT",
      message: "Ask Clubhouse has reached its current usage limit. Try again later.",
    };
  }

  if (input.requiresWebSearch) {
    if (stats.userDailyWebSearches >= input.config.dailyRoleWebSearchLimits[input.role]) {
      return {
        allowed: false,
        status: "rate_limited",
        code: "AI_DAILY_USER_WEB_SEARCH_LIMIT",
        message: "Ask Clubhouse has reached today's web research limit. Try an internal team-data question. It resets at midnight.",
      };
    }
    if (input.teamId && stats.teamDailyWebSearches >= input.config.dailyTeamWebSearchLimit) {
      return {
        allowed: false,
        status: "rate_limited",
        code: "AI_DAILY_TEAM_WEB_SEARCH_LIMIT",
        message: "Ask Clubhouse has reached this team's current web research limit.",
      };
    }
  }

  return { allowed: true };
}

export function summarizeAiUsageWindows(
  rows: AiUsageEventRow[],
  input: Pick<AiUsageLimitInput, "profileId" | "organizationId" | "teamId">,
  now: Date,
  timezone = "America/New_York",
): AiUsageWindowStats {
  const dayStartMs = startOfDayInTimeZone(now, timezone).getTime();
  const monthStartMs = startOfMonthInTimeZone(now, timezone).getTime();
  const auditRows = rows.filter((row) => !["duplicate", "rate_limited", "started"].includes(row.status));
  const quotaRows = auditRows.filter(countsTowardRequestQuota);
  const dailyRows = quotaRows.filter((row) => Date.parse(row.created_at) >= dayStartMs);
  const teamMonthlyRows = input.teamId ? quotaRows.filter((row) => row.team_id === input.teamId && Date.parse(row.created_at) >= monthStartMs) : [];
  const dailyAuditRows = auditRows.filter((row) => Date.parse(row.created_at) >= dayStartMs);
  const teamMonthlyAuditRows = input.teamId ? auditRows.filter((row) => row.team_id === input.teamId && Date.parse(row.created_at) >= monthStartMs) : [];

  return {
    userDailyRequests: dailyRows.filter((row) => row.profile_id === input.profileId).length,
    teamDailyRequests: input.teamId ? dailyRows.filter((row) => row.team_id === input.teamId).length : 0,
    teamMonthlyRequests: teamMonthlyRows.length,
    userDailyWebSearches: sumWebSearches(dailyAuditRows.filter((row) => row.profile_id === input.profileId)),
    teamDailyWebSearches: input.teamId ? sumWebSearches(dailyAuditRows.filter((row) => row.team_id === input.teamId)) : 0,
    teamMonthlyCostUsd: sumEstimatedCost(teamMonthlyAuditRows),
    globalMonthlyCostUsd: sumEstimatedCost(auditRows.filter((row) => Date.parse(row.created_at) >= monthStartMs)),
  };
}

export function countsTowardRequestQuota(event: {
  status?: string;
  quotaOutcome?: AiQuotaOutcome;
  metadata?: Record<string, unknown> | null;
}): boolean {
  if (event.quotaOutcome) return event.quotaOutcome === "useful_answer";
  const accounting = asRecord(event.metadata?.usageAccounting);
  if (typeof accounting?.countsTowardRequestQuota === "boolean") return accounting.countsTowardRequestQuota;
  if (typeof accounting?.countsTowardRequestQuota === "string") return accounting.countsTowardRequestQuota === "true";
  return ["completed", "no_data", "low_sample"].includes(event.status ?? "");
}

export async function startAiUsageEvent(supabase: SupabaseClient, input: StartUsageInput): Promise<string | undefined> {
  const { data, error } = await supabase
    .from("ai_usage_events")
    .insert({
      profile_id: input.profileId,
      organization_id: input.organizationId ?? null,
      team_id: input.teamId ?? null,
      season_id: input.seasonId ?? null,
      conversation_id: input.conversationId ?? null,
      request_hash: input.requestHash,
      model: input.model,
      status: "started",
      safe_tool_names: input.toolNames ?? [],
      safe_tool_params: input.toolParams ?? [],
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();
  if (error) throw usageError(error);
  return data?.id;
}

export async function finishAiUsageEvent(supabase: SupabaseClient, input: FinishUsageInput): Promise<void> {
  if (!input.usageEventId) return;
  const cost = calculateAIRequestCost({
    model: input.providerUsage?.model ?? "unknown",
    inputTokens: input.providerUsage?.inputTokens,
    cachedInputTokens: input.providerUsage?.cachedInputTokens,
    cacheWriteTokens: input.providerUsage?.cacheWriteTokens,
    outputTokens: input.providerUsage?.outputTokens,
    webSearchCount: input.webSearchCount,
  });
  const countsInQuota = countsTowardRequestQuota({ status: input.status, quotaOutcome: input.quotaOutcome });
  const { error } = await supabase
    .from("ai_usage_events")
    .update({
      message_id: input.messageId ?? null,
      status: usageStatus(input.status),
      input_tokens: input.providerUsage?.inputTokens ?? null,
      output_tokens: input.providerUsage?.outputTokens ?? null,
      total_tokens: input.providerUsage?.totalTokens ?? null,
      model: input.providerUsage?.model ?? undefined,
      tool_call_count: input.toolCallCount,
      web_search_count: input.webSearchCount,
      safe_tool_names: input.toolNames ?? undefined,
      safe_tool_params: input.toolParams ?? undefined,
      latency_ms: input.latencyMs,
      error_code: input.errorCode ?? null,
      metadata: {
        ...(input.metadata ?? {}),
        usageAccounting: {
          cachedInputTokens: input.providerUsage?.cachedInputTokens ?? null,
          cacheWriteTokens: input.providerUsage?.cacheWriteTokens ?? null,
          reasoningTokens: input.providerUsage?.reasoningTokens ?? null,
          estimatedModelCostUsd: cost.modelTokenCost,
          estimatedWebCostUsd: cost.webSearchCost,
          estimatedTotalCostUsd: cost.estimatedTotalCost,
          pricingVersion: cost.pricingVersion,
          pricedModel: cost.pricedModel,
          pricingFound: cost.pricingFound,
          countsTowardRequestQuota: countsInQuota,
          quotaOutcome: input.quotaOutcome ?? null,
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.usageEventId);
  if (error) throw usageError(error);
}

async function fetchUsageRows(supabase: SupabaseClient, since: string): Promise<AiUsageEventRow[]> {
  const pageSize = 1000;
  const rows: AiUsageEventRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("ai_usage_events")
      .select("profile_id,organization_id,team_id,model,status,input_tokens,output_tokens,web_search_count,metadata,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw usageError(error);
    const page = (data ?? []) as AiUsageEventRow[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

function sumWebSearches(rows: AiUsageEventRow[]): number {
  return rows.reduce((sum, row) => sum + Math.max(0, row.web_search_count ?? 0), 0);
}

function sumEstimatedCost(rows: AiUsageEventRow[]): number {
  return rows.reduce((sum, row) => {
    const accounting = asRecord(row.metadata?.usageAccounting);
    const stored = Number(accounting?.estimatedTotalCostUsd);
    if (Number.isFinite(stored) && stored >= 0) return sum + stored;
    return sum + calculateAIRequestCost({
      model: row.model ?? "unknown",
      inputTokens: row.input_tokens ?? undefined,
      cachedInputTokens: numberValue(accounting?.cachedInputTokens),
      cacheWriteTokens: numberValue(accounting?.cacheWriteTokens),
      outputTokens: row.output_tokens ?? undefined,
      webSearchCount: row.web_search_count ?? undefined,
    }).estimatedTotalCost;
  }, 0);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function numberValue(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function usageError(error: { code?: string; message?: string }): AiUsageStoreError {
  if (error.code === "42P01" || error.code === "PGRST205" || /ai_usage_events|schema cache/i.test(error.message ?? "")) {
    return new AiUsageStoreError("missing_storage", "Ask Clubhouse usage storage is not ready yet.");
  }
  return new AiUsageStoreError("storage_error", error.message ?? "Unable to record AI usage.");
}

function usageStatus(status: AskClubhouseStatus): "completed" | "failed" | "rate_limited" | "duplicate" | "unavailable" | "refused" {
  if (status === "completed" || status === "no_data" || status === "low_sample" || status === "needs_clarification") return "completed";
  if (status === "rate_limited" || status === "duplicate" || status === "unavailable" || status === "refused") return status;
  return "failed";
}

function normalizeQuestion(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase().slice(0, 500);
}

function startOfDayInTimeZone(date: Date, timezone: string): Date {
  const parts = timeZoneParts(date, timezone);
  return startOfLocalDateInTimeZone(parts.year, parts.month, parts.day, timezone);
}

function startOfMonthInTimeZone(date: Date, timezone: string): Date {
  const parts = timeZoneParts(date, timezone);
  return startOfLocalDateInTimeZone(parts.year, parts.month, 1, timezone);
}

function startOfLocalDateInTimeZone(year: number, month: number, day: number, timezone: string): Date {
  const localMidnightAsUtc = Date.UTC(year, month - 1, day);
  let candidate = new Date(localMidnightAsUtc - timeZoneOffsetMs(new Date(localMidnightAsUtc), timezone));
  const correctedOffset = timeZoneOffsetMs(candidate, timezone);
  if (candidate.getTime() !== localMidnightAsUtc - correctedOffset) {
    candidate = new Date(localMidnightAsUtc - correctedOffset);
  }
  return candidate;
}

function timeZoneParts(date: Date, timezone: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: validTimeZone(timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  return { year: values.year, month: values.month, day: values.day };
}

function timeZoneOffsetMs(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: validTimeZone(timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  return Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second) - date.getTime();
}

function validTimeZone(timezone: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
    return timezone;
  } catch {
    return "America/New_York";
  }
}

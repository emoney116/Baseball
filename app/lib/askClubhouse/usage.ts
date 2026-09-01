import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AskClubhouseConfig } from "./config";
import type { AIProviderUsage, AskClubhouseStatus } from "./types";

export class AiUsageStoreError extends Error {
  code: "missing_storage" | "storage_error";

  constructor(code: AiUsageStoreError["code"], message: string) {
    super(message);
    this.name = "AiUsageStoreError";
    this.code = code;
  }
}

export interface AiUsageLimitInput {
  profileId: string;
  teamId?: string;
  requestHash: string;
  config: AskClubhouseConfig;
  now?: Date;
}

export interface AiUsageLimitResult {
  allowed: boolean;
  status?: "rate_limited" | "duplicate";
  message?: string;
  code?: string;
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
  const dayStart = startOfUtcDay(input.now ?? new Date()).toISOString();
  if (input.config.requestCooldownSeconds > 0) {
    const cooldownStart = new Date((input.now ?? new Date()).getTime() - input.config.requestCooldownSeconds * 1000).toISOString();
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

  const userCount = await countUsage(supabase, {
    profileId: input.profileId,
    since: dayStart,
  });
  if (userCount >= input.config.dailyUserRequestLimit) {
    return {
      allowed: false,
      status: "rate_limited",
      code: "AI_DAILY_USER_LIMIT",
      message: "You've reached today's Ask Clubhouse limit. Try again tomorrow.",
    };
  }

  if (input.teamId) {
    const teamCount = await countUsage(supabase, {
      teamId: input.teamId,
      since: dayStart,
    });
    if (teamCount >= input.config.dailyTeamRequestLimit) {
      return {
        allowed: false,
        status: "rate_limited",
        code: "AI_DAILY_TEAM_LIMIT",
        message: "This team's Ask Clubhouse limit has been reached for today. Try again tomorrow.",
      };
    }
  }

  return { allowed: true };
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
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.usageEventId);
  if (error) throw usageError(error);
}

async function countUsage(
  supabase: SupabaseClient,
  input: { profileId?: string; teamId?: string; since: string },
): Promise<number> {
  let query = supabase
    .from("ai_usage_events")
    .select("id", { count: "exact", head: true })
    .gte("created_at", input.since);
  if (input.profileId) query = query.eq("profile_id", input.profileId);
  if (input.teamId) query = query.eq("team_id", input.teamId);
  const { count, error } = await query;
  if (error) throw usageError(error);
  return count ?? 0;
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

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

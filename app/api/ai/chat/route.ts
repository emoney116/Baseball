import { NextRequest, NextResponse } from "next/server";
import { getAskClubhouseConfig } from "../../../lib/askClubhouse/config";
import { boundConversationHistory, generateAskClubhouseReply } from "../../../lib/askClubhouse/engine";
import { OpenAIProvider } from "../../../lib/askClubhouse/provider";
import { AskClubhouseScopeError, loadAskClubhouseData } from "../../../lib/askClubhouse/serverData";
import { classifyAskClubhouseIntent } from "../../../lib/askClubhouse/tools";
import type { AskClubhouseApiRequest, AskClubhouseApiResponse } from "../../../lib/askClubhouse/types";
import {
  AiUsageStoreError,
  createAiRequestHash,
  enforceAiUsageLimits,
  finishAiUsageEvent,
  startAiUsageEvent,
} from "../../../lib/askClubhouse/usage";
import { createClient } from "../../../lib/supabase/server";

export async function POST(request: NextRequest) {
  const requestStartedAt = Date.now();
  const config = getAskClubhouseConfig();
  let body: AskClubhouseApiRequest;

  try {
    body = await request.json();
  } catch {
    return json({
      ok: false,
      status: "failed",
      answer: "Ask Clubhouse could not read that request. Try again.",
      code: "AI_BAD_JSON",
    }, 400);
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return json({
      ok: false,
      status: "failed",
      answer: "Ask Clubhouse needs a question first.",
      code: "AI_EMPTY_MESSAGE",
    }, 400);
  }

  if (message.length > config.maxInputCharacters) {
    return json({
      ok: false,
      status: "failed",
      answer: `That question is too long for Ask Clubhouse. Keep it under ${config.maxInputCharacters.toLocaleString()} characters.`,
      code: "AI_INPUT_TOO_LONG",
    }, 413);
  }

  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return json({
        ok: false,
        status: "failed",
        answer: "Sign in to use Ask Clubhouse.",
        code: "AI_AUTH_REQUIRED",
      }, 401);
    }

    const { data, scope } = await loadAskClubhouseData(
      supabase,
      userData.user,
      body.uiContext?.teamId,
      body.uiContext?.seasonId,
      body.uiContext?.teamScopes,
    );
    const currentTeam = data.teamContext?.currentTeam;
    const history = boundConversationHistory(body.messages, config.contextMessageLimit);
    const intent = classifyAskClubhouseIntent(message, data.players, history);
    const requestHash = createAiRequestHash({
      profileId: scope.profileId,
      teamId: currentTeam?.teamId,
      message,
    });

    const limits = await enforceAiUsageLimits(supabase, {
      profileId: scope.profileId,
      teamId: currentTeam?.teamId,
      requestHash,
      config,
    });
    if (!limits.allowed) {
      return json({
        ok: false,
        status: limits.status ?? "rate_limited",
        answer: limits.message ?? "You've reached today's Ask Clubhouse limit. Try again tomorrow.",
        code: limits.code,
        usage: {
          model: config.model,
          toolCallCount: 0,
          webSearchCount: 0,
          latencyMs: Date.now() - requestStartedAt,
        },
      });
    }

    const conversationId = await ensureConversation(supabase, {
      conversationId: body.conversationId,
      profileId: scope.profileId,
      organizationId: currentTeam?.organizationId,
      teamId: currentTeam?.teamId,
      seasonId: currentTeam?.seasonId,
      title: message,
      scope: {
        source: body.uiContext?.launchSurface ?? "analytics",
        teams: scope.selectedTeams.map((team) => ({ teamId: team.teamId, seasonId: team.seasonId, teamName: team.teamName })),
      },
    });
    const userMessageId = await insertMessage(supabase, {
      conversationId,
      profileId: scope.profileId,
      role: "user",
      content: message,
      metadata: {
        uiContext: body.uiContext ?? {},
      },
    });

    const usageEventId = await startAiUsageEvent(supabase, {
      profileId: scope.profileId,
      organizationId: currentTeam?.organizationId,
      teamId: currentTeam?.teamId,
      seasonId: currentTeam?.seasonId,
      conversationId,
      requestHash,
      model: config.model,
      metadata: {
        userMessageId,
        inputCharacters: message.length,
        contextMessageLimit: config.contextMessageLimit,
        maxOutputTokens: config.maxOutputTokens,
        route: intent.route,
        selectedTeamIds: scope.selectedTeams.map((team) => team.teamId),
      },
    });

    const provider = config.hasProviderKey
      ? new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY, model: config.model })
      : undefined;
    const reply = await generateAskClubhouseReply({
      data,
      message,
      conversationId,
      history,
      uiContext: body.uiContext,
      config,
      provider,
    });

    const assistantContent = reply.answer ?? "Ask Clubhouse could not produce an answer for that question.";
    const assistantMessageId = await insertMessage(supabase, {
      conversationId,
      profileId: scope.profileId,
      role: "assistant",
      content: assistantContent,
      metadata: {
        status: reply.status,
        route: reply.route,
        actions: reply.actions ?? [],
        evidence: reply.evidence ?? [],
        followUps: reply.followUps ?? [],
        usage: reply.usage ?? {},
      },
    });

    await finishAiUsageEvent(supabase, {
      usageEventId,
      messageId: assistantMessageId,
      status: reply.status,
      providerUsage: reply.providerUsage,
      toolCallCount: reply.toolNames.length,
      toolNames: reply.toolNames,
      toolParams: reply.toolParams,
      webSearchCount: reply.webSearchCount,
      latencyMs: Date.now() - requestStartedAt,
      errorCode: reply.code,
    });
    await touchConversation(supabase, conversationId);

    return json({
      ok: reply.ok,
      status: reply.status,
      route: reply.route,
      conversationId,
      message: {
        id: assistantMessageId,
        role: "assistant",
        content: assistantContent,
        createdAt: new Date().toISOString(),
      },
      answer: assistantContent,
      evidence: reply.evidence,
      actions: reply.actions,
      followUps: reply.followUps,
      usage: reply.usage,
      code: reply.code,
    });
  } catch (error) {
    if (error instanceof AskClubhouseScopeError) {
      return json({
        ok: false,
        status: "failed",
        answer: "That team scope is not available to this account.",
        code: "AI_SCOPE_FORBIDDEN",
      }, 403);
    }
    if (error instanceof AiUsageStoreError && error.code === "missing_storage") {
      return json({
        ok: false,
        status: "unavailable",
        answer: "Ask Clubhouse is finishing setup. Try again after the latest database update finishes.",
        code: "AI_STORAGE_NOT_READY",
        usage: {
          model: config.model,
          toolCallCount: 0,
          webSearchCount: 0,
          latencyMs: Date.now() - requestStartedAt,
        },
      });
    }
    return json({
      ok: false,
      status: "failed",
      answer: "Ask Clubhouse is temporarily unavailable. Try again in a bit.",
      code: "AI_SERVER_ERROR",
      usage: {
        model: config.model,
        toolCallCount: 0,
        webSearchCount: 0,
        latencyMs: Date.now() - requestStartedAt,
      },
    }, 500);
  }
}

function json(payload: AskClubhouseApiResponse, status = 200) {
  return NextResponse.json(payload, { status });
}

async function ensureConversation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    conversationId?: string;
    profileId: string;
    organizationId?: string;
    teamId?: string;
    seasonId?: string;
    title: string;
    scope: Record<string, unknown>;
  },
): Promise<string> {
  if (input.conversationId) {
    const { data, error } = await supabase
      .from("ai_conversations")
      .select("id")
      .eq("id", input.conversationId)
      .eq("profile_id", input.profileId)
      .maybeSingle();
    if (error) throw conversationStorageError(error);
    if (data?.id) return data.id;
  }

  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({
      profile_id: input.profileId,
      organization_id: input.organizationId ?? null,
      team_id: input.teamId ?? null,
      season_id: input.seasonId ?? null,
      title: compactTitle(input.title),
      scope: input.scope,
    })
    .select("id")
    .single();
  if (error) throw conversationStorageError(error);
  return data.id;
}

async function insertMessage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    conversationId: string;
    profileId: string;
    role: "user" | "assistant";
    content: string;
    metadata?: Record<string, unknown>;
  },
): Promise<string> {
  const { data, error } = await supabase
    .from("ai_messages")
    .insert({
      conversation_id: input.conversationId,
      profile_id: input.profileId,
      role: input.role,
      content: input.content,
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();
  if (error) throw conversationStorageError(error);
  return data.id;
}

async function touchConversation(supabase: Awaited<ReturnType<typeof createClient>>, conversationId: string) {
  await supabase
    .from("ai_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);
}

function conversationStorageError(error: { code?: string; message?: string }): Error {
  if (error.code === "42P01" || error.code === "PGRST205" || /ai_(conversations|messages)|schema cache/i.test(error.message ?? "")) {
    return new AiUsageStoreError("missing_storage", "Ask Clubhouse conversation storage is not ready yet.");
  }
  return new Error(error.message ?? "Unable to save Ask Clubhouse conversation.");
}

function compactTitle(message: string): string {
  const title = message.trim().replace(/\s+/g, " ");
  return title.length > 72 ? `${title.slice(0, 69)}...` : title;
}

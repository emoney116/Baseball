import type { SupabaseClient } from "@supabase/supabase-js";
import { listPlayerContexts, loadPlayerSession, type PlayerSession } from "./playerAccess.ts";
import { PlayerLinkError } from "./playerAccountLinks.ts";
import { playerAskContext } from "./playerAskScope.ts";
import { generateAskClubhouseReply, type GenerateAskReplyInput, type GenerateAskReplyResult } from "./askClubhouse/engine.ts";

export type ReadyPlayerSession = PlayerSession & Required<Pick<PlayerSession, "context" | "data" | "access">>;
export function requirePlayerAskSession(session: PlayerSession): asserts session is ReadyPlayerSession {
  if (!session.context || !session.data || !session.access?.capabilities.canUseAskClubhouse)
    throw new PlayerLinkError("An approved player context with Ask Clubhouse access is required.", 403);
}

export async function loadOtherPlayerAskTeams(db: SupabaseClient, profileId: string, current: ReadyPlayerSession) {
  const contexts = await listPlayerContexts(db, profileId);
  if (contexts.length > 8) throw new PlayerLinkError("Choose one team to ask about. All-team questions currently support up to eight player contexts.", 400);
  const sessions = [current];
  for (const context of contexts) {
    if (context.membershipId === current.context.membershipId) continue;
    const session = await loadPlayerSession(db, profileId, { playerId: context.playerId, teamId: context.team.teamId, seasonId: context.team.seasonId });
    requirePlayerAskSession(session);
    sessions.push(session);
  }
  return sessions;
}

// Each approved identity stays separate. Never merge same-name players or mix team denominators.
export async function generatePlayerTeamsReply(sessions: ReadyPlayerSession[], input: GenerateAskReplyInput): Promise<GenerateAskReplyResult> {
  const replies: GenerateAskReplyResult[] = [];
  for (const session of sessions) {
    requirePlayerAskSession(session);
    replies.push(await generateAskClubhouseReply({ ...input, data: session.data, history: [],
      uiContext: playerAskContext(session.context, {
        timeZone: input.uiContext?.timeZone,
        analytics: { domain: input.uiContext?.analytics?.domain, source: input.uiContext?.analytics?.source },
      }),
    }));
  }
  const first = replies[0];
  if (!first) throw new PlayerLinkError("No approved player contexts are available.", 403);
  if (replies.length === 1) return first;
  const tokenKeys = ["inputTokens", "cachedInputTokens", "cacheWriteTokens", "outputTokens", "reasoningTokens", "totalTokens"] as const;
  return { ...first,
    quotaOutcome: replies.some(reply => reply.quotaOutcome === "useful_answer") ? "useful_answer" : "not_counted",
    ok: replies.every(reply => reply.ok),
    status: replies.find(reply => !reply.ok)?.status ?? (replies.some(reply => reply.status === "low_sample") ? "low_sample" : "completed"),
    answer: replies.map((reply, index) => {
      const { context } = sessions[index];
      return `${context.team.teamName} · ${context.team.seasonName} · ${context.name}\n\n${reply.answer ?? "No answer available for this context."}`;
    }).join("\n\n"),
    // Drill-in requires selecting the exact team first; do not point a combined answer at the active team's URL.
    actions: [], followUps: [],
    visuals: replies.flatMap((reply, index) => (reply.visuals ?? []).map(visual => ({ ...visual, title: `${sessions[index].context.team.teamName} · ${sessions[index].context.team.seasonName}: ${visual.title}` }))),
    evidence: replies.flatMap(reply => reply.evidence ?? []),
    toolResults: replies.flatMap(reply => reply.toolResults),
    toolNames: replies.flatMap(reply => reply.toolNames),
    toolParams: replies.flatMap(reply => reply.toolParams),
    webSearchCount: replies.reduce((sum, reply) => sum + reply.webSearchCount, 0),
    providerUsage: { model: first.providerUsage?.model, ...Object.fromEntries(tokenKeys.map(key => [key, replies.reduce((sum, reply) => sum + (reply.providerUsage?.[key] ?? 0), 0)])) },
    usage: first.usage ? { ...first.usage, toolCallCount: replies.reduce((sum, reply) => sum + reply.toolNames.length, 0), webSearchCount: replies.reduce((sum, reply) => sum + reply.webSearchCount, 0), latencyMs: replies.reduce((sum, reply) => sum + (reply.usage?.latencyMs ?? 0), 0) } : undefined,
  };
}

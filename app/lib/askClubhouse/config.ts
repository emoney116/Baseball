export interface AskClubhouseConfig {
  model: string;
  hasProviderKey: boolean;
  webSearchEnabled: boolean;
  dailyUserRequestLimit: number;
  dailyRoleRequestLimits: Record<AiUsageRole, number>;
  dailyTeamRequestLimit: number;
  monthlyTeamRequestLimit: number;
  monthlyTeamCostLimitUsd: number;
  monthlyGlobalCostLimitUsd: number;
  dailyRoleWebSearchLimits: Record<AiUsageRole, number>;
  dailyTeamWebSearchLimit: number;
  maxToolCallsPerRequest: number;
  maxWebSearchesPerRequest: number;
  maxInputCharacters: number;
  maxOutputTokens: number;
  requestCooldownSeconds: number;
  contextMessageLimit: number;
  toolResultLimit: number;
}

export type AiUsageRole = "coach" | "player" | "parent" | "fan" | "unknown";

const DEFAULT_MODEL = "gpt-5-mini";

export function getAskClubhouseConfig(env: NodeJS.ProcessEnv = process.env): AskClubhouseConfig {
  const legacyUserLimit = readNumber(env.AI_DAILY_USER_REQUEST_LIMIT, 50, 1, 10000);
  const hasLegacyUserLimit = Boolean(env.AI_DAILY_USER_REQUEST_LIMIT?.trim());
  return {
    model: readString(env.OPENAI_AI_MODEL, DEFAULT_MODEL),
    hasProviderKey: Boolean(readString(env.OPENAI_API_KEY, "")),
    webSearchEnabled: readBoolean(env.AI_WEB_SEARCH_ENABLED, false),
    dailyUserRequestLimit: legacyUserLimit,
    dailyRoleRequestLimits: {
      coach: readNumber(env.AI_DAILY_COACH_REQUEST_LIMIT, hasLegacyUserLimit ? legacyUserLimit : 30, 1, 10000),
      player: readNumber(env.AI_DAILY_PLAYER_REQUEST_LIMIT, hasLegacyUserLimit ? legacyUserLimit : 10, 1, 10000),
      parent: readNumber(env.AI_DAILY_PARENT_REQUEST_LIMIT, hasLegacyUserLimit ? legacyUserLimit : 5, 1, 10000),
      fan: readNumber(env.AI_DAILY_FAN_REQUEST_LIMIT, hasLegacyUserLimit ? legacyUserLimit : 5, 1, 10000),
      unknown: readNumber(env.AI_DAILY_UNKNOWN_REQUEST_LIMIT, hasLegacyUserLimit ? legacyUserLimit : 5, 1, 10000),
    },
    dailyTeamRequestLimit: readNumber(env.AI_DAILY_TEAM_REQUEST_LIMIT, 150, 1, 50000),
    monthlyTeamRequestLimit: readNumber(env.AI_MONTHLY_TEAM_REQUEST_LIMIT, 3000, 1, 500000),
    monthlyTeamCostLimitUsd: readMoney(env.AI_MONTHLY_TEAM_COST_LIMIT_USD, 25, 0.5, 100000),
    monthlyGlobalCostLimitUsd: readMoney(env.AI_MONTHLY_GLOBAL_COST_LIMIT_USD, 100, 1, 1000000),
    dailyRoleWebSearchLimits: {
      coach: readNumber(env.AI_DAILY_COACH_WEB_SEARCH_LIMIT, 10, 0, 1000),
      player: readNumber(env.AI_DAILY_PLAYER_WEB_SEARCH_LIMIT, 3, 0, 1000),
      parent: readNumber(env.AI_DAILY_PARENT_WEB_SEARCH_LIMIT, 2, 0, 1000),
      fan: readNumber(env.AI_DAILY_FAN_WEB_SEARCH_LIMIT, 1, 0, 1000),
      unknown: readNumber(env.AI_DAILY_UNKNOWN_WEB_SEARCH_LIMIT, 1, 0, 1000),
    },
    dailyTeamWebSearchLimit: readNumber(env.AI_DAILY_TEAM_WEB_SEARCH_LIMIT, 30, 0, 5000),
    maxToolCallsPerRequest: readNumber(env.AI_MAX_TOOL_CALLS_PER_REQUEST, 6, 1, 12),
    maxWebSearchesPerRequest: readNumber(env.AI_MAX_WEB_SEARCHES_PER_REQUEST, 1, 0, 3),
    maxInputCharacters: readNumber(env.AI_MAX_INPUT_CHARACTERS, 4000, 200, 20000),
    maxOutputTokens: readNumber(env.AI_MAX_OUTPUT_TOKENS, 700, 120, 3000),
    requestCooldownSeconds: readNumber(env.AI_REQUEST_COOLDOWN_SECONDS, 6, 0, 120),
    contextMessageLimit: readNumber(env.AI_CONTEXT_MESSAGE_LIMIT, 8, 0, 20),
    toolResultLimit: readNumber(env.AI_TOOL_RESULT_LIMIT, 8, 3, 20),
  };
}

export function resolveAiUsageRole(teamRole?: string, profileRole?: string): AiUsageRole {
  const role = (teamRole?.trim() || profileRole?.trim() || "").toUpperCase();
  if (/\bPLAYER\b/.test(role)) return "player";
  if (/\bPARENT\b/.test(role)) return "parent";
  if (/\bFAN\b/.test(role)) return "fan";
  if (/\b(OWNER|ADMIN|HEAD_COACH|ASSISTANT_COACH|STAFF|COACH)\b/.test(role)) return "coach";
  return "unknown";
}

function readString(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed || fallback;
}

function readNumber(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function readMoney(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed * 100) / 100));
}

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value?.trim()) return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

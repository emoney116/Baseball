export interface AskClubhouseConfig {
  model: string;
  hasProviderKey: boolean;
  dailyUserRequestLimit: number;
  dailyTeamRequestLimit: number;
  maxToolCallsPerRequest: number;
  maxWebSearchesPerRequest: number;
  maxInputCharacters: number;
  maxOutputTokens: number;
  requestCooldownSeconds: number;
  contextMessageLimit: number;
  toolResultLimit: number;
}

const DEFAULT_MODEL = "gpt-5-mini";

export function getAskClubhouseConfig(env: NodeJS.ProcessEnv = process.env): AskClubhouseConfig {
  return {
    model: readString(env.OPENAI_AI_MODEL, DEFAULT_MODEL),
    hasProviderKey: Boolean(readString(env.OPENAI_API_KEY, "")),
    dailyUserRequestLimit: readNumber(env.AI_DAILY_USER_REQUEST_LIMIT, 50, 1, 10000),
    dailyTeamRequestLimit: readNumber(env.AI_DAILY_TEAM_REQUEST_LIMIT, 300, 1, 50000),
    maxToolCallsPerRequest: readNumber(env.AI_MAX_TOOL_CALLS_PER_REQUEST, 6, 1, 12),
    maxWebSearchesPerRequest: readNumber(env.AI_MAX_WEB_SEARCHES_PER_REQUEST, 1, 0, 3),
    maxInputCharacters: readNumber(env.AI_MAX_INPUT_CHARACTERS, 4000, 200, 20000),
    maxOutputTokens: readNumber(env.AI_MAX_OUTPUT_TOKENS, 700, 120, 3000),
    requestCooldownSeconds: readNumber(env.AI_REQUEST_COOLDOWN_SECONDS, 6, 0, 120),
    contextMessageLimit: readNumber(env.AI_CONTEXT_MESSAGE_LIMIT, 8, 0, 20),
    toolResultLimit: readNumber(env.AI_TOOL_RESULT_LIMIT, 8, 3, 20),
  };
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

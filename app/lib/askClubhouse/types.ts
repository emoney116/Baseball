import type {
  AnalyticsQuery,
  AnalyticsQueryContext,
  AnalyticsSource,
} from "../analyticsQuery";
import type { ID } from "../../types";

export type AskClubhouseMessageRole = "user" | "assistant";
export type AskClubhouseStatus =
  | "completed"
  | "refused"
  | "needs_clarification"
  | "no_data"
  | "rate_limited"
  | "duplicate"
  | "unavailable"
  | "failed";

export interface AskClubhouseClientMessage {
  id?: ID;
  role: AskClubhouseMessageRole;
  content: string;
  createdAt?: string;
}

export interface AskClubhouseUiContext {
  teamId?: ID;
  seasonId?: ID;
  organizationId?: ID;
  analytics?: Partial<AnalyticsQuery>;
}

export interface AskClubhouseApiRequest {
  message: string;
  conversationId?: ID;
  messages?: AskClubhouseClientMessage[];
  uiContext?: AskClubhouseUiContext;
}

export interface AskClubhouseAction {
  type: "open_analytics";
  label: string;
  query: Partial<AnalyticsQuery> & {
    domain: AnalyticsQuery["domain"];
    source: AnalyticsSource;
  };
  playerId?: ID;
}

export interface AskClubhouseEvidenceItem {
  title: string;
  summary: string;
}

export interface AskClubhouseUsageSnapshot {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  model?: string;
  toolCallCount: number;
  webSearchCount: number;
  latencyMs: number;
}

export interface AskClubhouseApiResponse {
  ok: boolean;
  status: AskClubhouseStatus;
  conversationId?: ID;
  message?: AskClubhouseClientMessage;
  answer?: string;
  evidence?: AskClubhouseEvidenceItem[];
  actions?: AskClubhouseAction[];
  followUps?: string[];
  usage?: AskClubhouseUsageSnapshot;
  code?: string;
}

export interface AskClubhouseToolCell {
  metricId: string;
  label: string;
  value?: number | string;
  display: string;
  kind: string;
  sample?: string;
}

export interface AskClubhouseToolRow {
  playerId: ID;
  playerName: string;
  jerseyNumber?: number;
  primaryPosition?: string;
  metrics: AskClubhouseToolCell[];
  sampleCount: number;
}

export interface AskClubhouseToolResult {
  name: string;
  title: string;
  summary: string;
  query?: Omit<AnalyticsQuery, "context"> & { context?: AnalyticsQueryContext };
  rows?: AskClubhouseToolRow[];
  totals?: AskClubhouseToolRow;
  warnings?: string[];
  parameters?: Record<string, unknown>;
}

export interface AIProviderUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  model?: string;
}

export interface AIProviderResult {
  text: string;
  usage?: AIProviderUsage;
  model?: string;
}

export interface AIProvider {
  readonly model: string;
  generate(input: {
    system: string;
    prompt: string;
    maxOutputTokens: number;
  }): Promise<AIProviderResult>;
}

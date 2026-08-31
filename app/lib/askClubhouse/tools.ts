import type { AppData, ID, Player } from "../../types";
import {
  defaultAnalyticsSort,
  executeAnalyticsQuery,
  formatAnalyticsValue,
  metricById,
  type AnalyticsMetricFormat,
  type AnalyticsQuery,
  type AnalyticsRow,
  type AnalyticsSource,
} from "../analyticsQuery.ts";
import type { AskClubhouseConfig } from "./config";
import type {
  AskClubhouseAction,
  AskClubhouseStatus,
  AskClubhouseToolCell,
  AskClubhouseToolResult,
  AskClubhouseToolRow,
  AskClubhouseUiContext,
} from "./types";

export interface AskToolPlan {
  status: AskClubhouseStatus | "data";
  answer?: string;
  toolRequests: AskToolRequest[];
  actions: AskClubhouseAction[];
  followUps: string[];
  clarification?: string;
}

export interface AskToolRequest {
  name: AskToolName;
  query: AnalyticsQuery;
  metricIds: string[];
  playerId?: ID;
  parameters?: Record<string, unknown>;
}

export type AskToolName =
  | "getHittingLeaderboard"
  | "getPlayerHittingStats"
  | "compareHittingSources"
  | "getPitchingLeaderboard"
  | "getPlayerPitchingStats"
  | "getDefenseLeaderboard"
  | "getPlayerDefenseStats"
  | "getWeightRoomLeaderboard"
  | "getPracticeSummary";

const BASEBALL_DEFINITIONS: Array<{ pattern: RegExp; answer: string; followUps: string[] }> = [
  {
    pattern: /\b(ops|on-base plus slugging)\b/i,
    answer: "OPS means on-base percentage plus slugging percentage. It is useful for a quick offensive snapshot, but Clubhouse should still separate contact quality, swing decisions, and game production when evaluating development.",
    followUps: ["Who leads our game AVG?", "Compare practice contact to games", "Who has the best hard-contact rate?"],
  },
  {
    pattern: /\b(babip)\b/i,
    answer: "BABIP is batting average on balls in play. It helps separate balls that became hits from strikeouts, walks, and home runs, but small samples can move around quickly.",
    followUps: ["Show game hitting leaders", "Who has the most balls in play?", "Which hitters have the best contact rate?"],
  },
  {
    pattern: /\b(csw)\b/i,
    answer: "CSW% is called strikes plus whiffs divided by total pitches. It is a fast way to see whether a pitcher is earning strikes without relying only on balls put in play.",
    followUps: ["Which pitchers have the best Strike %?", "Show pitching velocity leaders", "Who is in the zone most often?"],
  },
  {
    pattern: /\b(zone rate|zone %|zone percentage)\b/i,
    answer: "Zone% is the share of charted pitches that were in the strike zone. In Clubhouse, it only uses pitches with tracked locations, so the denominator matters.",
    followUps: ["Who is in the zone most often?", "Show bullpen strike rates", "Compare pitching velocity leaders"],
  },
];

const OUT_OF_SCOPE_PATTERN =
  /\b(essay|homework|recipe|vacation|travel|weather|stock|crypto|bitcoin|election|politics|movie|song|lyrics|dating|medical|lawyer|legal)\b/i;

export function buildAskClubhouseToolPlan(
  data: AppData,
  message: string,
  uiContext: AskClubhouseUiContext | undefined,
  config: AskClubhouseConfig,
): AskToolPlan {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();
  const currentTeam = data.teamContext?.currentTeam;
  const context = {
    teamId: currentTeam?.teamId,
    seasonId: currentTeam?.seasonId,
    organizationId: currentTeam?.organizationId,
    role: currentTeam?.role,
  };

  if (OUT_OF_SCOPE_PATTERN.test(trimmed) && !/\b(baseball|hitting|pitch|practice|game|player|team|clubhouse|weight room)\b/i.test(trimmed)) {
    return {
      status: "refused",
      answer: "I can help with Clubhouse 9 team data, player development, baseball, and weight room context. I cannot help with that topic here.",
      toolRequests: [],
      actions: [],
      followUps: ["Who has the highest practice Contact %?", "Which pitchers throw the most strikes?", "Who leads Weight Room Development?"],
    };
  }

  const definition = BASEBALL_DEFINITIONS.find((item) => item.pattern.test(trimmed));
  if (definition && !looksLikeTeamDataQuestion(lower)) {
    return {
      status: "completed",
      answer: definition.answer,
      toolRequests: [],
      actions: [],
      followUps: definition.followUps,
    };
  }

  const playerMatch = findRequestedPlayer(data.players, lower);
  if (playerMatch.status === "ambiguous") {
    return {
      status: "needs_clarification",
      answer: `I found more than one possible player: ${playerMatch.players.map((player) => player.name).join(", ")}. Which one do you mean?`,
      toolRequests: [],
      actions: [],
      followUps: playerMatch.players.slice(0, 3).map((player) => `Show ${player.name}'s analytics`),
    };
  }

  const requests: AskToolRequest[] = [];
  const actions: AskClubhouseAction[] = [];
  const domain = inferDomain(lower, uiContext);
  const source = inferSource(lower, uiContext, domain);
  const metricId = inferMetric(lower, domain, source);
  const mode = needsSituationalMode(lower) ? "situational" as const : "box-score" as const;

  if (lower.includes("practice summary") || lower.includes("current practice") || lower.includes("today's practice") || lower.includes("today practice")) {
    const request = analyticsRequest("getPracticeSummary", {
      domain: "development",
      source: "all",
      mode: "box-score",
      timeRange: "season",
      developmentView: "overview",
      groupBy: "player",
      sort: { metricId: "practiceReps", direction: "desc" },
      limit: config.toolResultLimit,
      context,
    }, ["practiceReps", "attendancePct"]);
    requests.push(request);
    actions.push(analyticsAction("Open practice analytics", request.query));
  } else if (lower.includes("practice vs game") || lower.includes("games vs practice") || lower.includes("practice and game")) {
    const practiceRequest = analyticsRequest("compareHittingSources", {
      domain: "hitting",
      source: "practice",
      mode: "box-score",
      timeRange: "season",
      groupBy: "player",
      sort: { metricId: "contactPct", direction: "desc" },
      limit: config.toolResultLimit,
      context,
    }, ["swings", "contactPct", "hardPct", "avgEv"]);
    const gamesRequest = analyticsRequest("compareHittingSources", {
      domain: "hitting",
      source: "games",
      mode: "box-score",
      timeRange: "season",
      groupBy: "player",
      sort: { metricId: "avg", direction: "desc" },
      limit: config.toolResultLimit,
      context,
    }, ["trackedBip", "hits", "avg", "slg"]);
    requests.push(practiceRequest, gamesRequest);
    actions.push(analyticsAction("Open practice hitting", practiceRequest.query));
    actions.push(analyticsAction("Open game hitting", gamesRequest.query));
  } else if (playerMatch.status === "single") {
    const request = analyticsRequest(playerToolName(domain), {
      domain,
      source,
      mode,
      timeRange: "season",
      groupBy: "player",
      sort: defaultAnalyticsSort(domain, source, mode),
      limit: config.toolResultLimit,
      context,
    }, primaryMetricsFor(domain, source, metricId), playerMatch.player.id);
    requests.push(request);
    actions.push(analyticsAction(`Open ${playerMatch.player.name} analytics`, request.query, playerMatch.player.id));
  } else {
    const request = analyticsRequest(leaderboardToolName(domain), {
      domain,
      source,
      mode,
      timeRange: "season",
      groupBy: "player",
      sort: { metricId, direction: "desc" },
      limit: config.toolResultLimit,
      context,
    }, primaryMetricsFor(domain, source, metricId));
    requests.push(request);
    actions.push(analyticsAction(`Open ${domainLabel(domain)} analytics`, request.query));
  }

  const boundedRequests = requests.slice(0, config.maxToolCallsPerRequest);
  return {
    status: "data",
    toolRequests: boundedRequests,
    actions: actions.slice(0, 3),
    followUps: followUpsFor(domain, source, playerMatch.status === "single" ? playerMatch.player : undefined),
  };
}

export function runAskClubhouseTools(
  data: AppData,
  requests: AskToolRequest[],
  config: AskClubhouseConfig,
): AskClubhouseToolResult[] {
  return requests.slice(0, config.maxToolCallsPerRequest).map((request) => {
    const result = executeAnalyticsQuery(data, {
      ...request.query,
      limit: Math.min(request.query.limit ?? config.toolResultLimit, config.toolResultLimit),
    });
    const rows = request.playerId
      ? result.rows.filter((row) => row.player.id === request.playerId)
      : result.rows.filter((row) => row.sampleCount > 0).slice(0, config.toolResultLimit);
    const compactRows = rows.map((row) => compactRow(row, request.metricIds));
    const summary = compactRows.length
      ? `${result.title} · ${result.scopeLabel} · ${result.sampleLabel}`
      : `No qualified rows in ${result.title} for ${result.scopeLabel}. ${result.sampleLabel}`;
    return {
      name: request.name,
      title: readableToolName(request.name),
      summary,
      query: result.query,
      rows: compactRows,
      totals: result.teamTotals ? compactRow(result.teamTotals, request.metricIds) : undefined,
      warnings: result.warnings.slice(0, 3),
      parameters: request.parameters,
    };
  });
}

export function fallbackAnswerFromTools(plan: AskToolPlan, toolResults: AskClubhouseToolResult[]): string {
  if (plan.answer) return plan.answer;
  const first = toolResults[0];
  if (!first || !first.rows?.length) return "I checked the current team data, but there is not enough logged data for a confident answer yet.";
  const top = first.rows[0];
  const keyMetric = top.metrics.find((metric) => metric.kind === "available") ?? top.metrics[0];
  const sample = keyMetric?.sample ? ` (${keyMetric.sample})` : "";
  return `${top.playerName} is the top result I found for this question: ${keyMetric?.label ?? "Metric"} ${keyMetric?.display ?? "—"}${sample}.`;
}

export function summarizeToolEvidence(toolResults: AskClubhouseToolResult[]) {
  return toolResults.slice(0, 4).map((tool) => ({
    title: tool.title,
    summary: tool.summary,
  }));
}

function analyticsRequest(
  name: AskToolName,
  query: AnalyticsQuery,
  metricIds: string[],
  playerId?: ID,
): AskToolRequest {
  return {
    name,
    query: {
      ...query,
      metrics: undefined,
      filters: query.mode === "situational" ? query.filters ?? {} : {},
    },
    metricIds,
    playerId,
    parameters: {
      domain: query.domain,
      source: query.source,
      metricIds,
      playerId,
      limit: query.limit,
    },
  };
}

function compactRow(row: AnalyticsRow, metricIds: string[]): AskClubhouseToolRow {
  return {
    playerId: row.player.id,
    playerName: row.player.name,
    jerseyNumber: row.player.jerseyNumber,
    primaryPosition: row.player.primaryPosition,
    sampleCount: row.sampleCount,
    metrics: metricIds
      .map((metricId) => compactCell(metricId, row))
      .filter((cell): cell is AskClubhouseToolCell => Boolean(cell)),
  };
}

function compactCell(metricId: string, row: AnalyticsRow): AskClubhouseToolCell | undefined {
  const cell = row.cells[metricId];
  const metric = metricById(metricId);
  if (!cell || !metric) return undefined;
  return {
    metricId,
    label: metric.label,
    value: cell.value,
    display: cell.display,
    kind: cell.kind,
    sample: sampleText(cell.sample),
  };
}

function sampleText(sample: AnalyticsRow["cells"][string]["sample"]): string | undefined {
  if (!sample) return undefined;
  if (typeof sample.numerator === "number" && typeof sample.denominator === "number") {
    return `${sample.numerator}/${sample.denominator}${sample.label ? ` ${sample.label}` : ""}`;
  }
  if (typeof sample.denominator === "number") return `${sample.denominator}${sample.label ? ` ${sample.label}` : " tracked"}`;
  return undefined;
}

function inferDomain(lower: string, uiContext: AskClubhouseUiContext | undefined): AnalyticsQuery["domain"] {
  if (/\b(weight|lift|lifting|strength|workout|development)\b/.test(lower)) return "development";
  if (/\b(pitcher|pitching|bullpen|strike|zone|whiff|csw|velo|velocity|command)\b/.test(lower)) return "pitching";
  if (/\b(defense|defensive|fielding|clean|error|throw acc|rep)\b/.test(lower)) return "defense";
  if (/\b(hit|hitting|hitter|contact|hard|ev|exit|batting|avg|slug|ops|babip|swing)\b/.test(lower)) return "hitting";
  return uiContext?.analytics?.domain ?? "hitting";
}

function inferSource(lower: string, uiContext: AskClubhouseUiContext | undefined, domain: AnalyticsQuery["domain"]): AnalyticsSource {
  if (domain === "development") return "all";
  if (/\b(live bp|live-bp|livebp)\b/.test(lower)) return "live-bp";
  if (/\b(practice|cage|machine|tee|front toss|coach bp|bullpen)\b/.test(lower)) return "practice";
  if (/\b(game|games|batting average|avg|slg|slug|babip)\b/.test(lower)) return "games";
  return uiContext?.analytics?.source && uiContext.analytics.source !== "all" ? uiContext.analytics.source : "all";
}

function inferMetric(lower: string, domain: AnalyticsQuery["domain"], source: AnalyticsSource): string {
  if (domain === "development") return "weightScore";
  if (domain === "defense") {
    if (/\b(error|errors)\b/.test(lower)) return "errors";
    if (/\b(throw|arm)\b/.test(lower)) return "throwAcc";
    return "cleanPct";
  }
  if (domain === "pitching") {
    if (/\b(max velo|max velocity|hardest|fastest)\b/.test(lower)) return "maxPitchVelo";
    if (/\b(velo|velocity|speed)\b/.test(lower)) return "avgPitchVelo";
    if (/\b(zone|command)\b/.test(lower)) return "zonePct";
    if (/\b(whiff|swing.?miss)\b/.test(lower)) return "whiffPct";
    if (/\b(csw)\b/.test(lower)) return "cswPct";
    return "strikePct";
  }
  if (source === "games") {
    if (/\b(slg|slug)\b/.test(lower)) return "slg";
    if (/\b(extra|xbh)\b/.test(lower)) return "xbh";
    if (/\b(hit|hits)\b/.test(lower)) return "hits";
    return "avg";
  }
  if (/\b(max ev|max exit|hardest)\b/.test(lower)) return "maxEv";
  if (/\b(ev|exit)\b/.test(lower)) return "avgEv";
  if (/\b(hard|barrel|impact)\b/.test(lower)) return "hardPct";
  if (/\b(whiff|miss)\b/.test(lower)) return "swingMissPct";
  return "contactPct";
}

function primaryMetricsFor(domain: AnalyticsQuery["domain"], source: AnalyticsSource, metricId: string): string[] {
  if (domain === "development") return unique(["weightScore", "workouts", "practiceReps", metricId]);
  if (domain === "defense") return unique(["reps", "cleanPct", "errors", "throwAcc", metricId]);
  if (domain === "pitching") return unique(["pitches", "strikePct", "zonePct", "avgPitchVelo", "maxPitchVelo", metricId]);
  if (source === "games") return unique(["trackedBip", "hits", "avg", "slg", "babip", metricId]);
  return unique(["swings", "contactPct", "hardPct", "avgEv", "maxEv", metricId]);
}

function needsSituationalMode(lower: string): boolean {
  return /\b(pitch type|slider|fastball|curve|changeup|count|lefty|righty|handed|live bp thrower|machine|coach throwing|player throwing)\b/.test(lower);
}

function looksLikeTeamDataQuestion(lower: string): boolean {
  return /\b(our|my|team|player|who|which|leader|leaders|highest|lowest|best|practice|game|season|clubhouse|metrolina)\b/.test(lower);
}

function findRequestedPlayer(players: Player[], lower: string): { status: "none" } | { status: "single"; player: Player } | { status: "ambiguous"; players: Player[] } {
  const candidates = players.filter((player) => {
    const name = player.name.toLowerCase();
    const parts = name.split(/\s+/).filter(Boolean);
    return lower.includes(name) || parts.some((part) => part.length >= 4 && lower.includes(part));
  });
  const unique = [...new Map(candidates.map((player) => [player.id, player])).values()];
  if (unique.length === 1) return { status: "single", player: unique[0] };
  if (unique.length > 1) return { status: "ambiguous", players: unique };
  return { status: "none" };
}

function leaderboardToolName(domain: AnalyticsQuery["domain"]): AskToolName {
  if (domain === "pitching") return "getPitchingLeaderboard";
  if (domain === "defense") return "getDefenseLeaderboard";
  if (domain === "development") return "getWeightRoomLeaderboard";
  return "getHittingLeaderboard";
}

function playerToolName(domain: AnalyticsQuery["domain"]): AskToolName {
  if (domain === "pitching") return "getPlayerPitchingStats";
  if (domain === "defense") return "getPlayerDefenseStats";
  return "getPlayerHittingStats";
}

function readableToolName(name: AskToolName): string {
  return name
    .replace(/^get/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (char) => char.toUpperCase());
}

function domainLabel(domain: AnalyticsQuery["domain"]): string {
  if (domain === "development") return "weight room";
  return domain;
}

function analyticsAction(label: string, query: AnalyticsQuery, playerId?: ID): AskClubhouseAction {
  return {
    type: "open_analytics",
    label,
    playerId,
    query: {
      domain: query.domain,
      source: query.source,
      mode: query.mode,
      timeRange: query.timeRange,
      developmentView: query.developmentView,
      filters: query.filters,
      eventIds: query.eventIds,
      sort: query.sort,
      groupBy: "player",
    },
  };
}

function followUpsFor(domain: AnalyticsQuery["domain"], source: AnalyticsSource, player?: Player): string[] {
  if (player) {
    return [
      `What should I notice about ${player.name}?`,
      `Show ${player.name}'s practice trends`,
      `Compare ${player.name} in games and practice`,
    ];
  }
  if (domain === "pitching") return ["Which pitchers have the best Strike %?", "Who has the best Avg Pitch Velo?", "Who is in the zone most often?"];
  if (domain === "defense") return ["Who has the cleanest defensive reps?", "Who has the best throw accuracy?", "Which positions need more reps?"];
  if (domain === "development") return ["Who leads Weight Room Development?", "Who completed the most workouts?", "Who needs a weight room follow-up?"];
  return source === "games"
    ? ["Who leads game AVG?", "Compare practice and games", "Who has the most extra-base hits?"]
    : ["Who has the highest practice Contact %?", "Who has the highest Avg EV?", "Who has the highest practice Hard %?"];
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function formatMetricForPrompt(value: number | string | undefined, format: AnalyticsMetricFormat): string {
  return formatAnalyticsValue(value, format);
}

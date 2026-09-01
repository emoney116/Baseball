import type { AppData, ID, PitchType, Player } from "../../types.ts";
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
import type { AskClubhouseConfig } from "./config.ts";
import type {
  AskClubhouseAction,
  AskClubhouseClientMessage,
  AskClubhouseRoute,
  AskClubhouseStatus,
  AskClubhouseToolCell,
  AskClubhouseToolResult,
  AskClubhouseToolRow,
  AskClubhouseUiContext,
} from "./types.ts";

export interface AskToolPlan {
  status: AskClubhouseStatus | "data" | "provider";
  route: AskClubhouseRoute;
  requiresWebSearch: boolean;
  answer?: string;
  toolRequests: AskToolRequest[];
  actions: AskClubhouseAction[];
  followUps: string[];
  clarification?: string;
  interpretation?: string;
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
  | "getPracticeSummary"
  | "getDataCoverage";

export interface AskIntentClassification {
  route: AskClubhouseRoute;
  requiresWebSearch: boolean;
  reason: string;
}

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

const CURRENT_BASEBALL_CONTEXT_PATTERN = /\b(nfhs|ncaa|mlb|official rule|rulebook|pitch count limit|current rule|latest rule|this season'?s? rule|this year|current season|world series|age benchmark|age average|good for (?:his|her|their|my) age)\b/i;
const BASEBALL_KNOWLEDGE_PATTERN = /\b(baseball|softball|balk|ops|babip|csw|zone rate|infield fly|obstruction|interference|pitch count|curveball|slider|fastball|changeup|bunt|cutoff|relay|approach|mechanics|launch angle|exit velocity|batting|pitching|fielding|world series|major league|minor league)\b/i;
const TEAM_DATA_PATTERN = /\b(player|players|leader|leaders|highest|lowest|best|hottest|improved|practice|game|season|clubhouse|analytics|weight room|bullpen|roster|compare|tracked|reps|contact|hard %|avg ev|velocity|velo|strike %|zone %)\b/i;

export function classifyAskClubhouseIntent(
  message: string,
  players: Player[] = [],
  history: AskClubhouseClientMessage[] = [],
): AskIntentClassification {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();
  const messageTokens = new Set(lower.split(/[^a-z0-9]+/).filter((token) => token.length >= 3));
  const baseballContext = BASEBALL_KNOWLEDGE_PATTERN.test(trimmed);
  const contextualTeamReference = /\b(?:our|my|this) team\b/i.test(trimmed);
  const explicitTeamData = TEAM_DATA_PATTERN.test(trimmed) || players.some((player) => (
    lower.includes(player.name.toLowerCase())
    || player.name.toLowerCase().split(/[^a-z0-9]+/).some((token) => token.length >= 3 && messageTokens.has(token))
  ));
  const currentBaseballContext = CURRENT_BASEBALL_CONTEXT_PATTERN.test(trimmed);
  const compactFollowUp = /^(how|what) about\b|^why\??$|^and\b/i.test(trimmed);
  const priorTeamContext = history.slice(-4).some((item) => TEAM_DATA_PATTERN.test(item.content));
  const usesTeamData = explicitTeamData
    || (contextualTeamReference && !baseballContext)
    || (compactFollowUp && priorTeamContext && baseballContext);
  const asksForExternalInterpretation = /\b(is that good|how does that compare|benchmark|for (?:his|her|their|my) age|rule|legal|allowed)\b/i.test(trimmed);

  if (OUT_OF_SCOPE_PATTERN.test(trimmed) && !baseballContext) {
    return { route: "refuse", requiresWebSearch: false, reason: "The request is outside baseball and Clubhouse data." };
  }
  if (usesTeamData && (asksForExternalInterpretation || currentBaseballContext)) {
    return { route: "mixed", requiresWebSearch: currentBaseballContext, reason: "The answer combines authorized Clubhouse data with baseball context." };
  }
  if (usesTeamData) {
    return { route: "clubhouse_data", requiresWebSearch: false, reason: "The request asks about the user's authorized Clubhouse data." };
  }
  if (baseballContext) {
    return { route: "baseball_knowledge", requiresWebSearch: currentBaseballContext, reason: currentBaseballContext ? "The baseball answer may have changed and needs a current source." : "The request is stable baseball knowledge." };
  }
  return { route: "refuse", requiresWebSearch: false, reason: "The request does not match Clubhouse data or baseball knowledge." };
}

export function buildAskClubhouseToolPlan(
  data: AppData,
  message: string,
  uiContext: AskClubhouseUiContext | undefined,
  config: AskClubhouseConfig,
  history: AskClubhouseClientMessage[] = [],
): AskToolPlan {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();
  const classification = classifyAskClubhouseIntent(trimmed, data.players, history);
  const currentTeam = data.teamContext?.currentTeam;
  const context = {
    teamId: currentTeam?.teamId,
    seasonId: currentTeam?.seasonId,
    organizationId: currentTeam?.organizationId,
    role: currentTeam?.role,
  };

  if (classification.route === "refuse") {
    return {
      status: "refused",
      route: classification.route,
      requiresWebSearch: false,
      answer: "I can help with Clubhouse 9 team data, player development, baseball, and weight room context. I cannot help with that topic here.",
      toolRequests: [],
      actions: [],
      followUps: ["Who has the highest practice Contact %?", "Which pitchers throw the most strikes?", "Who leads Weight Room Development?"],
    };
  }

  const definition = BASEBALL_DEFINITIONS.find((item) => item.pattern.test(trimmed));
  if (definition && classification.route === "baseball_knowledge" && !classification.requiresWebSearch) {
    return {
      status: "completed",
      route: classification.route,
      requiresWebSearch: false,
      answer: definition.answer,
      toolRequests: [],
      actions: [],
      followUps: definition.followUps,
    };
  }

  if (classification.route === "baseball_knowledge") {
    return {
      status: "provider",
      route: classification.route,
      requiresWebSearch: classification.requiresWebSearch,
      toolRequests: [],
      actions: [],
      followUps: ["How does that apply in a game?", "What should a coach watch for?", "Give me a simple example"],
    };
  }

  const playerMatch = findRequestedPlayer(data.players, lower);
  if (playerMatch.status === "ambiguous") {
    return {
      status: "needs_clarification",
      route: classification.route,
      requiresWebSearch: classification.requiresWebSearch,
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
  const pitchTypes = inferPitchTypes(lower);
  const filters = pitchTypes.length ? { pitchTypes } : {};

  if (lower.includes("practice summary") || lower.includes("current practice") || lower.includes("today's practice") || lower.includes("today practice")) {
    const request = analyticsRequest("getPracticeSummary", {
      domain: "development",
      source: "all",
      mode: "box-score",
      timeRange: "season",
      developmentView: "overview",
      groupBy: "player",
      filters,
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
      filters,
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
      filters,
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
      filters,
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
      filters,
      sort: { metricId, direction: "desc" },
      limit: config.toolResultLimit,
      context,
    }, primaryMetricsFor(domain, source, metricId));
    requests.push(request);
    actions.push(analyticsAction(`Open ${domainLabel(domain)} analytics`, request.query));
  }

  if (needsPitchTypeCoverage(lower)) {
    const coverageQuery = requests[0]?.query ?? {
      domain,
      source,
      mode: "situational" as const,
      timeRange: "season" as const,
      groupBy: "player" as const,
      filters,
      sort: { metricId, direction: "desc" as const },
      limit: config.toolResultLimit,
      context,
    };
    requests.push(analyticsRequest("getDataCoverage", coverageQuery, [metricId]));
  }

  const boundedRequests = requests.slice(0, config.maxToolCallsPerRequest);
  return {
    status: "data",
    route: classification.route,
    requiresWebSearch: classification.requiresWebSearch,
    toolRequests: boundedRequests,
    actions: currentTeam ? actions.slice(0, 3) : [],
    followUps: followUpsFor(domain, source, playerMatch.status === "single" ? playerMatch.player : undefined),
    interpretation: /\bhottest\b/.test(lower)
      ? "Interpret hottest as current performance using qualified rate metrics and supporting contact quality, not raw rep volume. State that interpretation."
      : undefined,
  };
}

export function runAskClubhouseTools(
  data: AppData,
  requests: AskToolRequest[],
  config: AskClubhouseConfig,
): AskClubhouseToolResult[] {
  return requests.slice(0, config.maxToolCallsPerRequest).map((request) => {
    if (request.name === "getDataCoverage") return buildDataCoverageResult(data, request);
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
      filters: query.filters,
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

function inferPitchTypes(lower: string): PitchType[] {
  const candidates: Array<{ type: PitchType; pattern: RegExp }> = [
    { type: "4-Seam", pattern: /\b(4[- ]?seam|four[- ]?seam|fastball|fb)\b/ },
    { type: "2-Seam", pattern: /\b(2[- ]?seam|two[- ]?seam)\b/ },
    { type: "Sinker", pattern: /\bsinker(s)?\b/ },
    { type: "Cutter", pattern: /\bcutter(s)?\b/ },
    { type: "Slider", pattern: /\bslider(s)?\b/ },
    { type: "Curveball", pattern: /\b(curve|curveball)(s)?\b/ },
    { type: "Changeup", pattern: /\b(change|changeup)(s)?\b/ },
    { type: "Splitter", pattern: /\b(split|splitter)(s)?\b/ },
    { type: "Knuckleball", pattern: /\b(knuckleball)(s)?\b/ },
  ];
  return candidates.filter((candidate) => candidate.pattern.test(lower)).map((candidate) => candidate.type);
}

function needsPitchTypeCoverage(lower: string): boolean {
  return /\b(pitch types?|fastballs?|sliders?|curves?|curveballs?|changeups?|sinkers?|cutters?|splitters?|knuckleballs?|two[- ]?seam|four[- ]?seam)\b/.test(lower);
}

function buildDataCoverageResult(data: AppData, request: AskToolRequest): AskClubhouseToolResult {
  const pitchTypes = request.query.filters?.pitchTypes ?? [];
  const rankingMetric = request.query.sort?.metricId ?? request.metricIds[0];
  const minimumSample = metricById(rankingMetric)?.minimumSample ?? 1;
  const isPitching = request.query.domain === "pitching";
  const rawEvents = isPitching ? data.pitchEvents : data.hittingEvents;
  const events = rawEvents.filter((event) => !pitchTypes.length || (event.pitchType && pitchTypes.includes(event.pitchType)));
  const byLabel = [...events.reduce((counts, event) => {
    const label = event.pitchType ?? "Untracked pitch type";
    counts.set(label, (counts.get(label) ?? 0) + 1);
    return counts;
  }, new Map<string, number>())]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, 10);
  const playerIds = new Set(events.map((event) => isPitching && "pitcherId" in event ? event.pitcherId : "hitterId" in event ? event.hitterId : undefined).filter(Boolean));
  const sessionIds = new Set(events.map((event) => event.sessionId).filter(Boolean));
  const pitchLabel = pitchTypes.length ? pitchTypes.join(", ") : "all pitch types";
  return {
    name: request.name,
    title: "Data Coverage",
    summary: `${events.length} tracked ${isPitching ? "pitches" : "hitting events"} for ${pitchLabel} across ${playerIds.size} players and ${sessionIds.size} sessions.`,
    query: request.query,
    parameters: request.parameters,
    coverage: {
      label: pitchLabel,
      tracked: events.length,
      minimumSample,
      playerCount: playerIds.size,
      sessionCount: sessionIds.size,
      byLabel,
    },
  };
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

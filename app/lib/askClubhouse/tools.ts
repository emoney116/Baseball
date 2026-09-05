import type { AppData, ID, Player } from "../../types.ts";
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
import { canUseExternalResearch } from "./entitlements.ts";
import {
  messageHasExplicitPlayerReference,
  resolveAskClubhousePlayer,
  type AskClubhousePlayerResolution,
} from "./entityResolution.ts";
import { diagnosePlayerDevelopment, type DevelopmentDiagnosisRequest, type DevelopmentDiagnosisResult } from "./diagnosis.ts";
import {
  EMPTY_BASEBALL_KNOWLEDGE_PROVIDER,
  findTrustedKnowledge,
  type BaseballKnowledgeItem,
  type BaseballKnowledgeMatchStatus,
  type BaseballKnowledgeProvider,
} from "./knowledge.ts";
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
import { composeAskClubhouseQueryPlan, type AskClubhouseQueryPlan } from "./queryPlan.ts";

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
  knowledgeStatus: BaseballKnowledgeMatchStatus;
  knowledgeItems: BaseballKnowledgeItem[];
  externalResearchRequired: boolean;
  queryPlan?: AskClubhouseQueryPlan;
  diagnosis?: DevelopmentDiagnosisResult;
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
  | "comparePitchTypes"
  | "getPitchingLeaderboard"
  | "getPlayerPitchingStats"
  | "getDefenseLeaderboard"
  | "getPlayerDefenseStats"
  | "getWeightRoomLeaderboard"
  | "getPracticeSummary"
  | "compareAnalyticsPeriods"
  | "getDataCoverage";

export interface AskIntentClassification {
  route: AskClubhouseRoute;
  requiresWebSearch: boolean;
  reason: string;
  knowledgeStatus: BaseballKnowledgeMatchStatus;
  knowledgeItems: BaseballKnowledgeItem[];
  externalResearchRequired: boolean;
}

export interface AskIntentOptions {
  webSearchEnabled?: boolean;
  knowledgeProvider?: BaseballKnowledgeProvider;
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
const BASEBALL_KNOWLEDGE_PATTERN = /\b(baseball|softball|balk|ops|obp|slg|era|whip|k%|bb%|babip|csw|contact %|contact rate|hard contact|strike %|zone rate|chase rate|infield fly|dropped third|force play|tag.?up|appeal|obstruction|interference|designated hitter|substitution|set position|pitch count|plate appearance|at-bat|hard-hit|extra-base|curveballs?|sliders?|fastballs?|changeups?|bunts?|cutoff|relay|approach|mechanics|launch angle|exit velocity|batting|pitching|fielding|command|control|whiff|pitch recognition|two-strike|breaking balls?|plate discipline|barrel|glove.?side|arm.?side|pitch sequencing|count leverage|routine play|forehand|backhand|double-play|catcher|baserunner|behind the runner|first step|practice.?to.?game|training load|strikeout|walk rate|contact|strike|timing|spin|recognize|opposite field|sacrifice fly|world series|major league|minor league|mph)(?=\W|$)/i;
const TEAM_DATA_PATTERN = /\b(player|players|leader|leaders|highest|lowest|best|hottest|improved|practice|games?|season|clubhouse|analytics|weight room|bullpen|roster|compare|tracked|reps|metrics|contact|hard %|avg ev|velocity|velo|strike %|zone %)\b/i;

function isDevelopmentQuestion(lower: string) {
  return /\b(how (?:can|do) (?:i|we|he|she|they)|what should .*work on|improve .*slider|hit .*better|handle .*better)\b/.test(lower)
    && /\b(sliders?|curveballs?|breaking balls?|fastballs?|pitching|command)\b/.test(lower);
}

export function classifyAskClubhouseIntent(
  message: string,
  players: Player[] = [],
  history: AskClubhouseClientMessage[] = [],
  options: AskIntentOptions = {},
): AskIntentClassification {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();
  const knowledgeItems = findTrustedKnowledge(options.knowledgeProvider ?? EMPTY_BASEBALL_KNOWLEDGE_PROVIDER, knowledgeQuery(trimmed));
  const baseballContext = BASEBALL_KNOWLEDGE_PATTERN.test(trimmed) || knowledgeItems.length > 0;
  const definitionQuestion = /^(what is|what are|what does|define|explain|what(?:'s| is) the difference between)\b/i.test(trimmed)
    && !/\b(my|our|this|team|player|practice|game|clubhouse)\b/i.test(trimmed);
  const contextualTeamReference = /\b(?:our|my|this) team'?s?\b/i.test(trimmed);
  const personalDataReference = /\b(?:my|our|this)\s+(?:hitting|pitching|defense|performance|data|results|stats|spray chart|heat ?map|pitch location|breaking balls?|fastballs?|sliders?|contact|velocity)\b/i.test(trimmed)
    || /\b(?:am|do|have) i\b.*\b(?:improv\w*|perform\w*|hitt?\w*|pitch\w*|contact|breaking balls?|fastballs?|sliders?)\b/i.test(trimmed)
    || /\bwhat should i work on\b/i.test(trimmed);
  const explicitTeamData = (!definitionQuestion && TEAM_DATA_PATTERN.test(trimmed))
    || messageHasExplicitPlayerReference(trimmed, players);
  const currentBaseballContext = CURRENT_BASEBALL_CONTEXT_PATTERN.test(trimmed);
  const developmentQuestion = isDevelopmentQuestion(lower);
  const knowledgeStatus: BaseballKnowledgeMatchStatus = !baseballContext
    ? "not_needed"
    : knowledgeItems.length ? "trusted_match" : "knowledge_miss";
  const externalResearchRequired = currentBaseballContext && knowledgeStatus === "knowledge_miss";
  const requiresWebSearch = externalResearchRequired && Boolean(options.webSearchEnabled);
  const compactFollowUp = /^(how|what) about\b|^why\??$|^and\b/i.test(trimmed);
  const priorTeamContext = history.slice(-4).some((item) => TEAM_DATA_PATTERN.test(item.content));
  const usesTeamData = explicitTeamData
    || personalDataReference
    || developmentQuestion
    || (contextualTeamReference && (!baseballContext || /\b(?:data|stats|analytics|metrics|launch|contact|velocity|performance|results)\b/i.test(trimmed)))
    || (compactFollowUp && priorTeamContext && baseballContext);
  const asksForExternalInterpretation = /\b(is that good|how does that compare|benchmark|for (?:his|her|their|my) age|for (?:a|this) high[- ]school hitter|for this level|development context|about (?:his|her|their|my|our) development|rule|legal|allowed)\b/i.test(trimmed);

  if (OUT_OF_SCOPE_PATTERN.test(trimmed) && !baseballContext) {
    return {
      route: "out_of_scope",
      requiresWebSearch: false,
      reason: "The request is outside baseball and Clubhouse data.",
      knowledgeStatus,
      knowledgeItems,
      externalResearchRequired: false,
    };
  }
  if (usesTeamData && (asksForExternalInterpretation || currentBaseballContext)) {
    return {
      route: "mixed",
      requiresWebSearch,
      reason: "The answer combines authorized Clubhouse data with baseball context.",
      knowledgeStatus,
      knowledgeItems,
      externalResearchRequired,
    };
  }
  if (usesTeamData) {
    return {
      route: "clubhouse_data",
      requiresWebSearch: false,
      reason: "The request asks about the user's authorized Clubhouse data.",
      knowledgeStatus,
      knowledgeItems,
      externalResearchRequired: false,
    };
  }
  if (baseballContext) {
    return {
      route: externalResearchRequired ? "external_research_required" : "baseball_knowledge",
      requiresWebSearch,
      reason: externalResearchRequired ? "No trusted current baseball knowledge item matched this question." : "The request is stable or trusted baseball knowledge.",
      knowledgeStatus,
      knowledgeItems,
      externalResearchRequired,
    };
  }
  return {
    route: "out_of_scope",
    requiresWebSearch: false,
    reason: "The request does not match Clubhouse data or baseball knowledge.",
    knowledgeStatus,
    knowledgeItems,
    externalResearchRequired: false,
  };
}

export function buildAskClubhouseToolPlan(
  data: AppData,
  message: string,
  uiContext: AskClubhouseUiContext | undefined,
  config: AskClubhouseConfig,
  history: AskClubhouseClientMessage[] = [],
  knowledgeProvider: BaseballKnowledgeProvider = EMPTY_BASEBALL_KNOWLEDGE_PROVIDER,
): AskToolPlan {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();
  const currentTeam = data.teamContext?.currentTeam;
  const researchEnabled = canUseExternalResearch({
    role: currentTeam?.role === "PLAYER" ? "player" : "coach",
    teamId: currentTeam?.teamId,
    organizationId: currentTeam?.organizationId,
  }, config);
  const classifiedIntent = classifyAskClubhouseIntent(trimmed, data.players, history, {
    webSearchEnabled: researchEnabled,
    knowledgeProvider,
  });
  const classification = isVisualFollowUp(lower, uiContext)
    ? { ...classifiedIntent, route: "clubhouse_data" as const, requiresWebSearch: false, externalResearchRequired: false }
    : classifiedIntent;
  const context = {
    teamId: currentTeam?.teamId,
    seasonId: currentTeam?.seasonId,
    organizationId: currentTeam?.organizationId,
    role: currentTeam?.role,
  };

  if (classification.route === "out_of_scope") {
    return {
      status: "refused",
      route: classification.route,
      requiresWebSearch: false,
      answer: "I can help with Clubhouse 9 team data, player development, baseball, and weight room context. I cannot help with that topic here.",
      toolRequests: [],
      actions: [],
      followUps: ["Who has the highest practice Contact %?", "Which pitchers throw the most strikes?", "Who leads Weight Room Development?"],
      knowledgeStatus: classification.knowledgeStatus,
      knowledgeItems: classification.knowledgeItems,
      externalResearchRequired: false,
    };
  }

  const definition = BASEBALL_DEFINITIONS.find((item) => item.pattern.test(trimmed));
  if (definition && classification.route === "baseball_knowledge" && !classification.requiresWebSearch) {
    return {
      status: "completed",
      route: classification.route,
      requiresWebSearch: false,
      answer: classification.knowledgeItems[0]?.content ?? definition.answer,
      toolRequests: [],
      actions: [],
      followUps: definition.followUps,
      knowledgeStatus: classification.knowledgeStatus,
      knowledgeItems: classification.knowledgeItems,
      externalResearchRequired: false,
    };
  }

  if (classification.route === "baseball_knowledge" && classification.knowledgeItems.length) {
    return {
      status: "completed",
      route: classification.route,
      requiresWebSearch: false,
      answer: classification.knowledgeItems[0].content,
      toolRequests: [],
      actions: [],
      followUps: ["How does that apply in a game?", "What should a coach watch for?", "Give me a simple example"],
      knowledgeStatus: classification.knowledgeStatus,
      knowledgeItems: classification.knowledgeItems,
      externalResearchRequired: false,
    };
  }

  if (classification.route === "external_research_required") {
    if (!classification.requiresWebSearch) {
      return {
        status: "completed",
        route: classification.route,
        requiresWebSearch: false,
        answer: "That's a baseball rules or current-context question. I can answer from Clubhouse's verified baseball knowledge when available, but current-source research isn't enabled in this beta yet.",
        toolRequests: [],
        actions: [],
        followUps: ["What is OPS?", "What is a balk generally?", "Ask about your Clubhouse data"],
        knowledgeStatus: classification.knowledgeStatus,
        knowledgeItems: classification.knowledgeItems,
        externalResearchRequired: true,
      };
    }
    return {
      status: "provider",
      route: classification.route,
      requiresWebSearch: true,
      toolRequests: [],
      actions: [],
      followUps: ["How does that apply in a game?", "What should a coach watch for?", "Give me a simple example"],
      knowledgeStatus: classification.knowledgeStatus,
      knowledgeItems: classification.knowledgeItems,
      externalResearchRequired: true,
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
      knowledgeStatus: classification.knowledgeStatus,
      knowledgeItems: classification.knowledgeItems,
      externalResearchRequired: false,
    };
  }

  const playerMatch = resolveAskClubhousePlayer({
    data,
    message: trimmed,
    route: classification.route,
    uiContext,
    knowledgeItems: classification.knowledgeItems,
  });
  if (playerMatch.status === "ambiguous") {
    const playerLabels = playerMatch.players.map(playerClarificationLabel);
    return {
      status: "needs_clarification",
      route: classification.route,
      requiresWebSearch: classification.requiresWebSearch,
      answer: `I found more than one possible player: ${playerLabels.join(", ")}. Which one do you mean?`,
      toolRequests: [],
      actions: [],
      followUps: playerMatch.players.slice(0, 3).map((player) => `Show ${playerClarificationLabel(player)} analytics`),
      knowledgeStatus: classification.knowledgeStatus,
      knowledgeItems: classification.knowledgeItems,
      externalResearchRequired: classification.externalResearchRequired,
    };
  }

  const visualContextPlayer = uiContext?.visualContext?.playerId
    ? data.players.find((player) => player.id === uiContext.visualContext?.playerId)
    : undefined;
  const queryPlan = composeAskClubhouseQueryPlan(trimmed, uiContext, playerMatch.status === "single" ? playerMatch.player : visualContextPlayer);
  if (needsVisualClarification(lower, uiContext, queryPlan.playerId)) {
    const answer = "Do you want a pitch-location heat map or a spray heat map?";
    return {
      status: "needs_clarification",
      route: classification.route,
      requiresWebSearch: false,
      answer,
      toolRequests: [],
      actions: [],
      followUps: ["Show the pitch-location heat map", "Show the spray heat map"],
      clarification: answer,
      knowledgeStatus: classification.knowledgeStatus,
      knowledgeItems: classification.knowledgeItems,
      externalResearchRequired: false,
      queryPlan,
    };
  }
  if (queryPlan.unsupportedFilters.length) {
    return {
      status: "needs_clarification",
      route: classification.route,
      requiresWebSearch: false,
      answer: unsupportedFilterAnswer(queryPlan.unsupportedFilters),
      toolRequests: [],
      actions: [],
      followUps: followUpsFor(queryPlan.domain, queryPlan.scope.source),
      clarification: unsupportedFilterAnswer(queryPlan.unsupportedFilters),
      knowledgeStatus: classification.knowledgeStatus,
      knowledgeItems: classification.knowledgeItems,
      externalResearchRequired: false,
      queryPlan,
    };
  }

  const diagnosisRequest = buildDevelopmentDiagnosisRequest(lower, queryPlan, playerMatch);
  if (diagnosisRequest === "clarify") {
    const answer = "Do you want me to look at a specific player's tracked data, or give general baseball advice?";
    return {
      status: "needs_clarification",
      route: classification.route,
      requiresWebSearch: false,
      answer,
      toolRequests: [],
      actions: [],
      followUps: ["How can Jacob Seamon hit sliders better?", "What is slider recognition?"],
      clarification: answer,
      knowledgeStatus: classification.knowledgeStatus,
      knowledgeItems: classification.knowledgeItems,
      externalResearchRequired: false,
      queryPlan,
    };
  }
  if (diagnosisRequest) {
    const diagnosis = diagnosePlayerDevelopment(data, diagnosisRequest, knowledgeProvider);
    const actionQuery = analyticsQueryFromPlan(queryPlan);
    return {
      status: "completed",
      route: "clubhouse_data",
      requiresWebSearch: false,
      answer: formatDiagnosisAnswer(diagnosis),
      toolRequests: [],
      actions: currentTeam ? [analyticsAction(`Open ${diagnosis.playerName}'s analytics`, actionQuery, diagnosis.playerId)] : [],
      followUps: [`Show ${diagnosis.playerName}'s last 3 practices`, `Compare ${diagnosis.playerName} in games and practice`, "What should I track next?"],
      interpretation: "Diagnose the player's tracked signal before offering a development recommendation.",
      knowledgeStatus: diagnosis.knowledgeItems.length ? "trusted_match" : "knowledge_miss",
      knowledgeItems: diagnosis.knowledgeItems,
      externalResearchRequired: false,
      queryPlan,
      diagnosis,
    };
  }

  const requests: AskToolRequest[] = [];
  const actions: AskClubhouseAction[] = [];
  const domain = queryPlan.domain;
  const source = queryPlan.scope.source;
  const metricId = queryPlan.metric;
  const mode = needsSituationalMode(lower) || Object.keys(queryPlan.filters).length ? "situational" as const : "box-score" as const;
  const filters = queryPlan.filters;

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
  } else if (queryPlan.comparison?.dimension === "period") {
    const periods = periodRanges(data, queryPlan.scope.timeRange);
    const playerId = playerMatch.status === "single" ? playerMatch.player.id : undefined;
    const recentRequest = analyticsRequest("compareAnalyticsPeriods", {
      domain,
      source,
      mode,
      timeRange: "custom",
      customDateRange: periods.recent,
      groupBy: "player",
      filters,
      sort: { metricId, direction: "desc" },
      limit: config.toolResultLimit,
      context,
    }, primaryMetricsFor(domain, source, metricId), playerId);
    const priorRequest = analyticsRequest("compareAnalyticsPeriods", {
      domain,
      source,
      mode,
      timeRange: "custom",
      customDateRange: periods.prior,
      groupBy: "player",
      filters,
      sort: { metricId, direction: "desc" },
      limit: config.toolResultLimit,
      context,
    }, primaryMetricsFor(domain, source, metricId), playerId);
    requests.push(recentRequest, priorRequest);
    actions.push(analyticsAction("Open recent analytics", recentRequest.query, playerId));
  } else if (queryPlan.comparison?.dimension === "pitcherHand" && queryPlan.filters.pitcherHands?.length) {
    const playerId = playerMatch.status === "single" ? playerMatch.player.id : undefined;
    for (const hand of queryPlan.filters.pitcherHands) {
      const handFilters = { ...filters, pitcherHands: [hand] as Array<"R" | "L" | "S"> };
      requests.push(analyticsRequest("compareHittingSources", {
        domain: "hitting",
        source,
        mode: "situational",
        timeRange: queryPlan.scope.timeRange,
        groupBy: "player",
        filters: handFilters,
        sort: { metricId, direction: "desc" },
        limit: config.toolResultLimit,
        context,
      }, primaryMetricsFor("hitting", source, metricId), playerId));
    }
    if (requests.length) actions.push(analyticsAction("Open handedness comparison", requests[0].query, playerId));
  } else if (queryPlan.comparison?.dimension === "pitchType") {
    const playerId = playerMatch.status === "single" ? playerMatch.player.id : undefined;
    const pitchGroups = queryPlan.filters.pitchTypes?.length && queryPlan.filters.pitchTypes.length > 1
      ? queryPlan.filters.pitchTypes.map((pitchType) => [pitchType])
      : [["4-Seam" as const], ["Slider", "Curveball", "Changeup", "Splitter"] as const];
    for (const pitchGroup of pitchGroups) {
      requests.push(analyticsRequest("comparePitchTypes", {
        domain,
        source,
        mode: "situational",
        timeRange: queryPlan.scope.timeRange,
        groupBy: "player",
        filters: { ...filters, pitchTypes: [...pitchGroup] },
        sort: { metricId, direction: "desc" },
        limit: config.toolResultLimit,
        context,
      }, primaryMetricsFor(domain, source, metricId), playerId));
    }
    if (requests.length) actions.push(analyticsAction("Open pitch-type comparison", requests[0].query, playerId));
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
  for (const request of boundedRequests) {
    request.parameters = {
      ...request.parameters,
      minimumSample: queryPlan.minimumSample,
      partialDimensions: queryPlan.partialDimensions,
    };
  }
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
    knowledgeStatus: classification.knowledgeStatus,
    knowledgeItems: classification.knowledgeItems,
    externalResearchRequired: classification.externalResearchRequired,
    queryPlan,
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
    const minimumSample = typeof request.parameters?.minimumSample === "number" ? request.parameters.minimumSample : undefined;
    const partialDimensions = Array.isArray(request.parameters?.partialDimensions)
      ? request.parameters.partialDimensions.filter((item): item is string => typeof item === "string")
      : [];
    const warnings = [...result.warnings];
    if (minimumSample !== undefined && rows.some((row) => row.cells[request.query.sort?.metricId ?? ""]?.kind === "insufficient-sample")) {
      warnings.push(`Some rows are below the ${minimumSample}-sample minimum for this metric.`);
    }
    if (partialDimensions.length) warnings.push(`Coverage is partial for ${partialDimensions.join(", ")}; untracked values were not inferred.`);
    return {
      name: request.name,
      title: readableToolName(request.name),
      summary,
      query: result.query,
      rows: compactRows,
      totals: result.teamTotals ? compactRow(result.teamTotals, request.metricIds) : undefined,
      warnings: [...new Set(warnings)].slice(0, 3),
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

export function summarizeKnowledgeEvidence(knowledgeItems: BaseballKnowledgeItem[]) {
  return knowledgeItems.slice(0, 3).map((item) => ({
    id: item.id,
    documentId: item.documentId,
    chunkId: item.chunkId,
    title: `Baseball Knowledge · ${item.title}`,
    summary: [item.source, item.version, item.status].filter(Boolean).join(" · "),
    source: item.source,
    version: item.version,
    status: item.status,
    url: item.sourceReference?.startsWith("http") ? item.sourceReference : undefined,
  }));
}

function buildDevelopmentDiagnosisRequest(
  lower: string,
  queryPlan: AskClubhouseQueryPlan,
  playerMatch: AskClubhousePlayerResolution,
): DevelopmentDiagnosisRequest | "clarify" | undefined {
  if (!isDevelopmentQuestion(lower)) return undefined;
  if (playerMatch.status !== "single") return "clarify";
  const domain = /\b(improve|throw|locate|command|pitching)\b/.test(lower) && !/\bhit|hitting|hitter\b/.test(lower) ? "pitching" : queryPlan.domain === "pitching" ? "pitching" : "hitting";
  return {
    domain,
    playerId: playerMatch.player.id,
    source: queryPlan.scope.source,
    pitchType: queryPlan.filters.pitchTypes?.[0],
  };
}

function formatDiagnosisAnswer(diagnosis: DevelopmentDiagnosisResult): string {
  return [
    "WHAT I SEE",
    diagnosis.whatISee,
    "",
    "YOUR DATA",
    ...diagnosis.dataPoints.map((point) => `- ${point}`),
    "",
    "WHAT TO WORK ON",
    diagnosis.focus,
    "",
    "PRACTICE IDEA",
    diagnosis.practiceIdea,
    "",
    "WATCH NEXT",
    diagnosis.watchNext,
  ].join("\n");
}

function unsupportedFilterAnswer(filters: string[]): string {
  return `I can answer the supported parts of this question, but ${filters.join(" and ")} ${filters.length === 1 ? "is" : "are"} not tracked well enough for a reliable split. I won't guess or silently ignore that filter.`;
}

export function analyticsQueryFromPlan(plan: AskClubhouseQueryPlan): AnalyticsQuery {
  return {
    domain: plan.domain,
    source: plan.scope.source,
    mode: Object.keys(plan.filters).length ? "situational" : "box-score",
    timeRange: plan.scope.timeRange,
    customDateRange: plan.scope.customDateRange,
    eventIds: plan.scope.eventIds,
    groupBy: "player",
    filters: plan.filters,
    sort: { metricId: plan.metric, direction: plan.ranking?.direction ?? "desc" },
    limit: plan.ranking?.limit ?? 8,
  };
}

function periodRanges(data: AppData, timeRange: AnalyticsQuery["timeRange"]) {
  const anchor = [
    ...data.practices.map((item) => item.date),
    ...data.games.map((item) => item.date),
    ...(data.workoutSessions ?? []).map((item) => item.date),
  ].sort().at(-1) ?? new Date().toISOString().slice(0, 10);
  const days = timeRange === "7d" ? 7 : 30;
  const recentStart = shiftDate(anchor, -(days - 1));
  const priorEnd = shiftDate(recentStart, -1);
  return {
    recent: { start: recentStart, end: anchor },
    prior: { start: shiftDate(priorEnd, -(days - 1)), end: priorEnd },
  };
}

function shiftDate(value: string, offset: number): string {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
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
      playerIds: playerId ? [playerId] : query.playerIds,
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

function needsVisualClarification(lower: string, uiContext?: AskClubhouseUiContext, playerId?: ID): boolean {
  if (!/\b(heat|heat map|heat chart)\b/.test(lower)) return false;
  if (/\b(spray|location|where|miss|beat)\b/.test(lower)) return false;
  return !playerId && !uiContext?.visualContext;
}

function isVisualFollowUp(lower: string, uiContext?: AskClubhouseUiContext): boolean {
  if (!uiContext?.visualContext) return false;
  return /\b(show|same|that|those|this|heat|spray|dots?|counts?|percent(?:age)?s?|map|chart|how did (?:he|she|they)|how (?:is|are) (?:he|she|they) doing)\b/.test(lower);
}

function playerClarificationLabel(player: Player): string {
  const jersey = player.jerseyNumber ? `#${player.jerseyNumber}` : undefined;
  return [player.name, jersey, player.primaryPosition].filter(Boolean).join(" · ");
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

function knowledgeQuery(query: string) {
  const version = query.match(/\b20\d{2}\b/)?.[0];
  const governingBody = /\bnfhs\b/i.test(query) ? "NFHS" : /\bncaa\b/i.test(query) ? "NCAA" : undefined;
  const category = /\b(rule|rulebook|balk|legal|allowed|infield fly|dropped third|obstruction|interference|force play|tag.?up|appeal|designated hitter|substitution|set position)\b/i.test(query)
    ? "Rules"
    : /\b(is that good|benchmark|for (?:his|her|their|my) age|age average)\b/i.test(query)
      ? "Development"
      : undefined;
  return {
    query,
    category,
    level: governingBody === "NFHS" ? "High School" : governingBody === "NCAA" ? "College" : undefined,
    governingBody,
    version,
    limit: 3,
  };
}

export function formatMetricForPrompt(value: number | string | undefined, format: AnalyticsMetricFormat): string {
  return formatAnalyticsValue(value, format);
}

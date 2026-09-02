import type { AppData, ID } from "../../types.ts";
import {
  executeAnalyticsQuery,
  metricById,
  type AnalyticsQuery,
  type AnalyticsResult,
} from "../analyticsQuery.ts";
import { sampleState } from "./queryPlan.ts";
import { analyticsQueryFromPlan, type AskToolPlan } from "./tools.ts";
import type {
  AskClubhouseUiContext,
  AskClubhouseVisual,
  AskClubhouseVisualContext,
  AskClubhouseVisualMetric,
  AskClubhouseVisualMode,
  AskClubhouseVisualType,
} from "./types.ts";

const VISUAL_TYPES = new Set<AskClubhouseVisualType>(["spray_chart", "pitch_location", "metric_summary", "comparison", "trend"]);
const VISUAL_MODES = new Set<AskClubhouseVisualMode>(["spray", "dots", "count", "percent", "heat"]);
const VISUAL_FILTER_KEYS = new Set([
  "pitcherHands", "batterHands", "pitchTypes", "exactCounts", "countGroups", "drillTypes",
  "liveBpThrowerSources", "battedBallTypes", "pitchVelocityMin", "pitchVelocityMax",
  "pitchLocationRegions", "directions", "gameStates", "innings", "outs", "runnerStates",
  "opponents", "homeAway", "gamePitchOutcomes", "gameBipOutcomes",
]);

export function buildAskClubhouseVisuals(input: {
  data: AppData;
  message: string;
  plan: AskToolPlan;
  uiContext?: AskClubhouseUiContext;
}): AskClubhouseVisual[] {
  if (!input.plan.queryPlan || !shouldRenderVisual(input.message, input.uiContext?.visualContext)) return [];

  const requestedTypes = selectVisualTypes(input.message, input.plan.queryPlan.domain, input.plan.queryPlan.filters, input.uiContext?.visualContext);
  if (!requestedTypes.length) return [];
  const playerId = input.plan.queryPlan.playerId ?? input.uiContext?.visualContext?.playerId;
  if (playerId && !input.data.players.some((player) => player.id === playerId)) return [];

  const baseQuery = input.plan.toolRequests.find((request) => request.name !== "getDataCoverage")?.query
    ?? analyticsQueryFromPlan(input.plan.queryPlan);
  const inherited = input.uiContext?.analytics;
  const query: AnalyticsQuery = {
    ...baseQuery,
    eventIds: baseQuery.eventIds ?? inherited?.eventIds,
    filters: { ...(inherited?.filters ?? {}), ...(baseQuery.filters ?? {}) },
    playerIds: playerId ? [playerId] : undefined,
  };
  if (!requestedTypes.some((type) => isSupportedVisualQuery(query, type, playerId))) return [];

  const result = executeAnalyticsQuery(input.data, query);
  const row = playerId ? result.rows.find((item) => item.player.id === playerId) : undefined;
  const minimumSample = input.plan.queryPlan.minimumSample;
  const state = sampleState(row?.sampleCount ?? 0, minimumSample);
  const visuals: AskClubhouseVisual[] = [];

  if (row && row.sampleCount > 0 && shouldIncludeMetricSummary(input.message, requestedTypes[0])) {
    const metrics = summaryMetrics(result, row.player.id, query.domain);
    if (metrics.length) {
      visuals.push({
        type: "metric_summary",
        mode: "dots",
        title: `${row.player.name}'s results`,
        domain: query.domain,
        playerId,
        query: serializableVisualQuery(query),
        sample: state,
        coverage: {
          label: query.domain === "pitching" ? "pitches" : "tracked events",
          qualifyingEvents: row.sampleCount,
          trackedEvents: row.sampleCount,
          minimumSample,
        },
        metrics,
      });
    }
  }

  if (requestedTypes.includes("spray_chart")) {
    const chart = result.sprayChart;
    if (chart?.trackedLocations) {
      const requestedMode = selectVisualMode(input.message, "spray_chart", input.uiContext?.visualContext);
      const mode = chart.trackedLocations < minimumSample && requestedMode === "heat" ? "spray" : requestedMode;
      visuals.push({
        type: "spray_chart",
        mode,
        title: "Spray chart",
        domain: query.domain,
        playerId,
        query: serializableVisualQuery(query),
        sample: sampleState(chart.ballsInPlay, minimumSample),
        coverage: {
          label: "balls in play",
          qualifyingEvents: chart.ballsInPlay,
          trackedEvents: chart.trackedLocations,
          minimumSample,
        },
        points: chart.points.slice(-120),
      });
    }
  }

  if (requestedTypes.includes("pitch_location")) {
    const chart = result.pitchLocationChart;
    if (chart?.trackedLocations) {
      const requestedMode = selectVisualMode(input.message, "pitch_location", input.uiContext?.visualContext);
      const mode = chart.trackedLocations < minimumSample && requestedMode === "heat" ? "dots" : requestedMode;
      visuals.push({
        type: "pitch_location",
        mode,
        title: "Pitch location",
        domain: query.domain,
        playerId,
        query: serializableVisualQuery(query),
        sample: sampleState(chart.qualifyingEvents, minimumSample),
        coverage: {
          label: "qualifying pitches",
          qualifyingEvents: chart.qualifyingEvents,
          trackedEvents: chart.trackedLocations,
          minimumSample,
        },
        points: chart.points.slice(-120),
      });
    }
  }

  return visuals.filter(isAskClubhouseVisual).slice(0, 3);
}

export function visualContextFrom(visual: AskClubhouseVisual): AskClubhouseVisualContext {
  return { type: visual.type, mode: visual.mode, playerId: visual.playerId, query: visual.query };
}

export function isAskClubhouseVisual(value: unknown): value is AskClubhouseVisual {
  if (!value || typeof value !== "object") return false;
  const visual = value as Partial<AskClubhouseVisual>;
  if (!VISUAL_TYPES.has(visual.type as AskClubhouseVisualType) || !VISUAL_MODES.has(visual.mode as AskClubhouseVisualMode)) return false;
  if (!visual.query || !visual.domain || visual.query.domain !== visual.domain || !visual.query.source) return false;
  return Object.keys(visual.query.filters ?? {}).every((key) => VISUAL_FILTER_KEYS.has(key));
}

function shouldRenderVisual(message: string, context?: AskClubhouseVisualContext) {
  return /\b(show|chart|map|heat|spray|location|where (?:am|is)|how (?:am|is) .+\b(hitting|pitching|locating)|percentages?|counts?)\b/i.test(message)
    || Boolean(context && /\b(only|same|that|those|percent|count|heat|spray|location|down|up|away|in|how did (?:he|she|they)|how (?:is|are) (?:he|she|they) doing)\b/i.test(message));
}

function selectVisualType(
  message: string,
  domain: AnalyticsQuery["domain"],
  context?: AskClubhouseVisualContext,
): AskClubhouseVisualType | undefined {
  const lower = message.toLowerCase();
  if (/\bspray\b/.test(lower)) return "spray_chart";
  if (/\b(location|locating|where am i missing|where is .*missing|where .*beat)\b/.test(lower)) return "pitch_location";
  if (/\bheat\b/.test(lower)) return context?.type === "spray_chart" || context?.type === "pitch_location"
    ? context.type
    : domain === "pitching" || domain === "hitting" ? "pitch_location" : undefined;
  if (context?.type === "spray_chart" || context?.type === "pitch_location") return context.type;
  if (domain === "pitching") return "pitch_location";
  if (domain === "hitting") return "pitch_location";
  return undefined;
}

function selectVisualTypes(
  message: string,
  domain: AnalyticsQuery["domain"],
  filters: AnalyticsQuery["filters"],
  context?: AskClubhouseVisualContext,
) {
  const primary = selectVisualType(message, domain, context);
  if (!primary) return [];
  const lower = message.toLowerCase();
  const isExplicitSpatialRequest = /\b(spray|location|where|heat|chart|map)\b/.test(lower);
  if (domain === "hitting" && primary === "pitch_location" && filters?.pitchTypes?.length && !isExplicitSpatialRequest && !context) {
    return ["pitch_location", "spray_chart"] as AskClubhouseVisualType[];
  }
  return [primary];
}

function selectVisualMode(
  message: string,
  type: AskClubhouseVisualType,
  context?: AskClubhouseVisualContext,
): AskClubhouseVisualMode {
  const lower = message.toLowerCase();
  if (/\b(percent|percentage|%)\b/.test(lower)) return "percent";
  if (/\b(counts?|#)\b/.test(lower)) return "count";
  if (/\bheat\b/.test(lower)) return "heat";
  if (type === "spray_chart" && /\bspray\b/.test(lower)) return "spray";
  if (context?.type === type) return context.mode;
  return type === "spray_chart" ? "spray" : "dots";
}

function shouldIncludeMetricSummary(message: string, type: AskClubhouseVisualType) {
  return type !== "metric_summary" && /\b(how|show|results|hitting|pitching|locating|performance|chart|map)\b/i.test(message);
}

function summaryMetrics(result: AnalyticsResult, playerId: ID, domain: AnalyticsQuery["domain"]): AskClubhouseVisualMetric[] {
  const row = result.rows.find((item) => item.player.id === playerId);
  if (!row) return [];
  const ids = domain === "pitching"
    ? ["pitches", "strikePct", "avgPitchVelo", "maxPitchVelo", "cswPct"]
    : ["swings", "contactPct", "hardPct", "avgEv", "maxEv"];
  return ids.flatMap((id) => {
    const cell = row.cells[id];
    const metric = metricById(id);
    if (!cell || !metric || cell.display === "—") return [];
    const denominator = cell.sample?.denominator;
    return [{ id, label: metric.label, value: cell.display, sample: denominator ? `${denominator} tracked` : undefined }];
  }).slice(0, 5);
}

function serializableVisualQuery(query: AnalyticsQuery): AskClubhouseVisual["query"] {
  return {
    domain: query.domain,
    source: query.source,
    mode: query.mode,
    view: query.view,
    timeRange: query.timeRange,
    customDateRange: query.customDateRange,
    eventIds: query.eventIds,
    playerIds: query.playerIds,
    filters: query.filters,
    sort: query.sort,
  };
}

function isSupportedVisualQuery(query: AnalyticsQuery, type: AskClubhouseVisualType, playerId?: ID) {
  if (!playerId || query.domain === "defense" || query.domain === "development") return false;
  if (type === "spray_chart") return query.domain === "hitting";
  return type === "pitch_location" && (query.domain === "hitting" || query.domain === "pitching");
}

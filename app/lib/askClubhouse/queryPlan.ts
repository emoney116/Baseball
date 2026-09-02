import type { BattedBallType, Direction, ID, PitchType, Player } from "../../types.ts";
import {
  metricById,
  type AnalyticsFilters,
  type AnalyticsPitchLocationRegion,
  type AnalyticsQuery,
  type AnalyticsSource,
} from "../analyticsQuery.ts";
import type { AskClubhouseUiContext } from "./types.ts";

export type AskClubhouseComparisonDimension = "source" | "pitchType" | "pitcherHand" | "batterHand" | "period";

export interface AskClubhouseQueryComparison {
  dimension: AskClubhouseComparisonDimension;
  groups: string[];
}

export interface AskClubhouseQueryPlan {
  domain: AnalyticsQuery["domain"];
  metric: string;
  scope: {
    source: AnalyticsSource;
    timeRange: AnalyticsQuery["timeRange"];
    customDateRange?: AnalyticsQuery["customDateRange"];
    eventIds?: ID[];
  };
  filters: AnalyticsFilters;
  playerId?: ID;
  comparison?: AskClubhouseQueryComparison;
  ranking?: {
    direction: "asc" | "desc";
    limit: number;
  };
  minimumSample: number;
  unsupportedFilters: string[];
  partialDimensions: string[];
}

const PITCH_TYPES: Array<{ type: PitchType; pattern: RegExp }> = [
  { type: "4-Seam", pattern: /\b(4[- ]?seam|four[- ]?seam|fastball|fb)s?\b/ },
  { type: "2-Seam", pattern: /\b(2[- ]?seam|two[- ]?seam)s?\b/ },
  { type: "Sinker", pattern: /\bsinkers?\b/ },
  { type: "Cutter", pattern: /\bcutters?\b/ },
  { type: "Slider", pattern: /\bsliders?\b/ },
  { type: "Curveball", pattern: /\b(curve|curveball)s?\b/ },
  { type: "Changeup", pattern: /\b(change|changeup)s?\b/ },
  { type: "Splitter", pattern: /\b(split|splitter)s?\b/ },
  { type: "Knuckleball", pattern: /\bknuckleballs?\b/ },
];

export function composeAskClubhouseQueryPlan(
  message: string,
  uiContext?: AskClubhouseUiContext,
  player?: Player,
): AskClubhouseQueryPlan {
  const lower = message.trim().toLowerCase();
  const visualFollowUp = isVisualFollowUp(lower, uiContext);
  const resolvedContext = visualFollowUp && uiContext?.visualContext
    ? { ...uiContext, analytics: uiContext.visualContext.query }
    : uiContext;
  const domain = inferDomain(lower, resolvedContext);
  const comparison = inferComparison(lower);
  const source = inferSource(lower, resolvedContext, domain, comparison);
  const metric = inferMetric(lower, domain, source);
  const pitchTypes = inferPitchTypes(lower);
  const filters: AnalyticsFilters = { ...(resolvedContext?.analytics?.filters ?? {}) };
  if (pitchTypes.length) filters.pitchTypes = pitchTypes;

  const velocityRange = inferVelocityRange(lower);
  if (velocityRange.minimum !== undefined) filters.pitchVelocityMin = velocityRange.minimum;
  if (velocityRange.maximum !== undefined) filters.pitchVelocityMax = velocityRange.maximum;

  const pitchLocationRegions = inferPitchLocationRegions(lower);
  if (pitchLocationRegions.length) filters.pitchLocationRegions = pitchLocationRegions;

  const directions = inferDirections(lower);
  if (directions.length) filters.directions = directions;

  const pitcherHand = inferHand(lower, "pitcher");
  const batterHand = inferHand(lower, "batter");
  if (pitcherHand.length && domain === "hitting") filters.pitcherHands = pitcherHand;
  if (batterHand.length && domain === "pitching") filters.batterHands = batterHand;

  const countGroups = inferCountGroups(lower);
  if (countGroups.length && domain === "pitching") filters.countGroups = countGroups;

  const battedBallTypes = inferBattedBallTypes(lower);
  if (battedBallTypes.length) filters.battedBallTypes = battedBallTypes;

  const drillTypes = inferDrillTypes(lower);
  if (drillTypes.length && domain === "hitting") filters.drillTypes = drillTypes;

  const unsupportedFilters: string[] = [];
  if (countGroups.length && domain === "hitting") unsupportedFilters.push("count on hitting events");
  if (directions.length && source === "games") unsupportedFilters.push("game spray direction");
  if (battedBallTypes.length && source === "games") unsupportedFilters.push("game batted-ball type");
  if (/\b(handedness|left-handed|right-handed)\b/.test(lower) && domain !== "hitting" && domain !== "pitching") unsupportedFilters.push("handedness for this domain");
  if (/\b(launch angle|spray angle)\b/.test(lower)) unsupportedFilters.push("launch angle");
  if (/\b(batter handedness|pitcher handedness)\b/.test(lower) && !pitcherHand.length && !batterHand.length) unsupportedFilters.push("handedness without a specific side");

  const partialDimensions = [
    pitchTypes.length ? "pitch type" : "",
    velocityRange.minimum !== undefined || velocityRange.maximum !== undefined ? "pitch velocity" : "",
    pitchLocationRegions.length ? "pitch location" : "",
    pitcherHand.length ? "pitcher handedness" : "",
    batterHand.length ? "batter handedness" : "",
    directions.length ? "spray" : "",
  ].filter(Boolean);

  return {
    domain,
    metric,
    scope: {
      source,
      timeRange: visualFollowUp ? resolvedContext?.analytics?.timeRange ?? inferTimeRange(lower) : inferTimeRange(lower),
      customDateRange: visualFollowUp ? resolvedContext?.analytics?.customDateRange : undefined,
      eventIds: visualFollowUp ? resolvedContext?.analytics?.eventIds : undefined,
    },
    filters,
    playerId: player?.id,
    comparison,
    ranking: /\b(who|which player|leader|best|highest|lowest|most|least|hottest)\b/.test(lower)
      ? { direction: /\b(lowest|least)\b/.test(lower) ? "asc" : "desc", limit: 8 }
      : undefined,
    minimumSample: metricById(metric)?.minimumSample ?? 1,
    unsupportedFilters: unique(unsupportedFilters),
    partialDimensions: unique(partialDimensions),
  };
}

export function sampleState(sample: number, minimumSample: number): "insufficient" | "limited" | "qualified" {
  if (sample <= 0) return "insufficient";
  if (sample < minimumSample) return "insufficient";
  if (sample < minimumSample * 2) return "limited";
  return "qualified";
}

function isVisualFollowUp(lower: string, uiContext?: AskClubhouseUiContext) {
  if (!uiContext?.visualContext) return false;
  return /\b(show|same|that|those|this|heat|spray|dots?|counts?|percent(?:age)?s?|map|chart|how did (?:he|she|they)|how (?:is|are) (?:he|she|they) doing)\b/.test(lower);
}

export function inferPitchTypes(lower: string): PitchType[] {
  return PITCH_TYPES.filter((candidate) => candidate.pattern.test(lower)).map((candidate) => candidate.type);
}

function inferDomain(lower: string, uiContext?: AskClubhouseUiContext): AnalyticsQuery["domain"] {
  if (/\b(weight|lift|lifting|strength|workout|attendance|development)\b/.test(lower)) return "development";
  if (/\b(pitcher|pitching|bullpen|strike|zone|whiff|csw|velo|velocity|command|slider.*pitch|improve .*slider)\b/.test(lower)) return "pitching";
  if (/\b(defense|defensive|fielding|clean|error|throw acc|rep|backhand|forehand)\b/.test(lower)) return "defense";
  if (/\b(hit|hitting|hitter|contact|hard|ev|exit|batting|avg|slug|ops|babip|swing|curveball|fastball|offspeed|chase)\b/.test(lower)) return "hitting";
  return uiContext?.analytics?.domain ?? "hitting";
}

function inferSource(lower: string, uiContext: AskClubhouseUiContext | undefined, domain: AnalyticsQuery["domain"], comparison?: AskClubhouseQueryComparison): AnalyticsSource {
  if (domain === "development") return "all";
  if (comparison?.dimension === "source") return "all";
  if (/\b(live bp|live-bp|livebp)\b/.test(lower)) return "live-bp";
  if (/\b(practice|cage|machine|tee|front toss|coach bp)\b/.test(lower)) return "practice";
  if (/\b(game|games|batting average|avg|slg|slug|babip)\b/.test(lower)) return "games";
  return uiContext?.analytics?.source && uiContext.analytics.source !== "all" ? uiContext.analytics.source : "all";
}

function inferTimeRange(lower: string): AnalyticsQuery["timeRange"] {
  if (/\blast\s+7\s+days?|this week\b/.test(lower)) return "7d";
  if (/\blast\s+30\s+days?|this month\b/.test(lower)) return "30d";
  if (/\b(custom|between)\b/.test(lower)) return "custom";
  return "season";
}

function inferMetric(lower: string, domain: AnalyticsQuery["domain"], source: AnalyticsSource): string {
  if (domain === "development") {
    if (/\b(workouts?|missed workouts?)\b/.test(lower)) return "workouts";
    if (/\b(practice reps?|training volume)\b/.test(lower)) return "practiceReps";
    return "weightScore";
  }
  if (domain === "defense") {
    if (/\b(error|errors)\b/.test(lower)) return "errors";
    if (/\b(throw|arm|accuracy)\b/.test(lower)) return "throwAcc";
    return "cleanPct";
  }
  if (domain === "pitching") {
    if (/\b(max velo|max velocity|hardest|fastest)\b/.test(lower)) return "maxPitchVelo";
    if (/\b(velo|velocity|speed)\b/.test(lower)) return "avgPitchVelo";
    if (/\b(zone|command|locate)\b/.test(lower)) return "zonePct";
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
  if (/\b(reps?|volume)\b/.test(lower)) return "swings";
  return "contactPct";
}

function inferComparison(lower: string): AskClubhouseQueryComparison | undefined {
  if (/\b(practice|games?)\b.*\b(vs|versus|compared? with|and)\b.*\b(practice|games?)\b/.test(lower)) return { dimension: "source", groups: ["practice", "games"] };
  if (/\b(fastballs?|4[- ]?seam)\b.*\b(vs|versus|compared? with|and)\b.*\b(offspeed|breaking|sliders?|curveballs?|changeups?)\b/.test(lower)) return { dimension: "pitchType", groups: ["4-Seam", "offspeed"] };
  if (/\b(lhp|left[- ]handed)\b.*\b(vs|versus|compared? with|and)\b.*\b(rhp|right[- ]handed)\b/.test(lower)) return { dimension: "pitcherHand", groups: ["L", "R"] };
  if (/\b(last 3|last three)\b.*\b(practice|session)/.test(lower)) return { dimension: "period", groups: ["recent", "prior"] };
  if (/\b(changed|improv\w*|trending|trend)\b/.test(lower)) return { dimension: "period", groups: ["recent", "prior"] };
  return undefined;
}

function inferVelocityRange(lower: string): { minimum?: number; maximum?: number } {
  const above = lower.match(/\b(?:over|above|more than|at least)\s+(\d{2,3})(?:\.\d+)?\s*mph\b/);
  const below = lower.match(/\b(?:under|below|less than|at most)\s+(\d{2,3})(?:\.\d+)?\s*mph\b/);
  return { minimum: above ? Number(above[1]) : undefined, maximum: below ? Number(below[1]) : undefined };
}

function inferPitchLocationRegions(lower: string): AnalyticsPitchLocationRegion[] {
  const regions: AnalyticsPitchLocationRegion[] = [];
  if (/\bdown\s+and\s+away\b/.test(lower)) regions.push("down_and_away");
  else if (/\bup\s+and\s+away\b/.test(lower)) regions.push("up_and_away");
  else if (/\bdown\s+and\s+in\b/.test(lower)) regions.push("down_and_in");
  else if (/\bup\s+and\s+in\b/.test(lower)) regions.push("up_and_in");
  else if (/\bdown(?:ward| low)?\b/.test(lower)) regions.push("down");
  else if (/\bup(?:ward| high)?\b/.test(lower)) regions.push("up");
  else if (/\bmiddle|middle[- ]in\b/.test(lower)) regions.push("middle");
  return regions;
}

function inferDirections(lower: string): Direction[] {
  if (/\b(opposite field|oppo)\b/.test(lower)) return ["Opposite", "Opposite-center"];
  if (/\b(pull|pulling)\b/.test(lower)) return ["Pull", "Pull-center"];
  if (/\b(up the middle|middle)\b/.test(lower)) return ["Middle", "Center"];
  return [];
}

function inferHand(lower: string, subject: "pitcher" | "batter"): Array<"R" | "L" | "S"> {
  const prefix = subject === "pitcher" ? "(?:pitcher|lefty|righty)?" : "(?:batter|hitter)?";
  const values: Array<"R" | "L" | "S"> = [];
  if (new RegExp(`\\b${prefix}\\s*(?:lhp|left[- ]handed|lefty)\\b`).test(lower)) values.push("L");
  if (new RegExp(`\\b${prefix}\\s*(?:rhp|right[- ]handed|righty)\\b`).test(lower)) values.push("R");
  return values;
}

function inferCountGroups(lower: string): Array<"ahead" | "even" | "behind" | "two-strike"> {
  if (/\b(two[- ]strike|2[- ]strike)\b/.test(lower)) return ["two-strike"];
  if (/\bahead in the count\b/.test(lower)) return ["ahead"];
  if (/\bbehind in the count\b/.test(lower)) return ["behind"];
  if (/\beven count\b/.test(lower)) return ["even"];
  return [];
}

function inferBattedBallTypes(lower: string): BattedBallType[] {
  if (/\bground balls?\b/.test(lower)) return ["Ground ball"];
  if (/\bline drives?\b/.test(lower)) return ["Line drive"];
  if (/\bfly balls?\b/.test(lower)) return ["Fly ball"];
  if (/\bpop ups?\b/.test(lower)) return ["Pop up"];
  return [];
}

function inferDrillTypes(lower: string): string[] {
  return ["Tee", "Front Toss", "Machine", "Coach BP"].filter((drill) => lower.includes(drill.toLowerCase()));
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

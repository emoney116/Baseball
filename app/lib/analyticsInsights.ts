import type { AppData, PitchType } from "../types.ts";
import { ANALYTICS_METRICS } from "./analyticsCatalog.ts";
import {
  executeAnalyticsQuery,
  type AnalyticsCell,
  type AnalyticsCountGroup,
  type AnalyticsDomain,
  type AnalyticsFilters,
  type AnalyticsQuery,
  type AnalyticsResult,
} from "./analyticsQuery.ts";

export type AnalyticsInsightsDomain = "hitting" | "pitching" | "defense" | "team";

export type AnalyticsInsightTrend = {
  direction: "up" | "down" | "neutral";
  display: string;
  favorable: boolean;
};

export type AnalyticsInsightRow = {
  id: string;
  label: string;
  primaryMetricId: string;
  primary: AnalyticsCell;
  secondaryMetricId?: string;
  secondary?: AnalyticsCell;
  sample?: string;
  trend?: AnalyticsInsightTrend;
  drillQuery?: Partial<AnalyticsQuery>;
};

export type AnalyticsInsightSection = {
  id: string;
  title: string;
  detailTitle?: string;
  rows: AnalyticsInsightRow[];
  emptyMessage?: string;
};

export type AnalyticsInsightTakeaway = {
  id: string;
  tone: "positive" | "development" | "neutral";
  text: string;
};

export type AnalyticsInsightsModel = {
  domain: AnalyticsInsightsDomain;
  sourceLabel: string;
  sections: AnalyticsInsightSection[];
  takeaways: AnalyticsInsightTakeaway[];
};

export type AnalyticsInsightsOptions = { today?: string };

const GAME_SOURCES = ["games"] as const;
const lowerIsBetter = new Set([
  "strikeoutPct", "walkPctAllowed", "ballPct", "swingMissPct", "chasePct", "errorPct", "errors", "fieldingErrors", "throwingErrors", "decisionErrors", "missedReps", "inaccurateThrows",
]);

/**
 * Creates team-first Insights from the canonical Analytics query engine. Every
 * figure below is a team total from executeAnalyticsQuery; this module only
 * decides which bounded queries are useful to show together.
 */
export function buildAnalyticsInsights(
  data: AppData,
  baseQuery: AnalyticsQuery,
  domain: AnalyticsInsightsDomain,
  options: AnalyticsInsightsOptions = {},
): AnalyticsInsightsModel {
  if (domain === "team") return buildTeamInsights(data, baseQuery, options);
  if (domain === "hitting") return buildHittingInsights(data, baseQuery, options);
  if (domain === "pitching") return buildPitchingInsights(data, baseQuery, options);
  return buildDefenseInsights(data, baseQuery, options);
}

function buildHittingInsights(data: AppData, base: AnalyticsQuery, options: AnalyticsInsightsOptions): AnalyticsInsightsModel {
  const hasGames = selectedSources(base).includes("games");
  const overviewMetrics = hasGames
    ? ["ops", "avg", "obp", "slg", "strikeoutPct", "walkPct"]
    : ["contactPct", "hardPct", "avgEv", "ev90", "swingPct", "chasePct"];
  const overviewQuery = queryFor(base, "hitting", overviewMetrics);
  const overview = resultFor(data, overviewQuery, options);
  const sections: AnalyticsInsightSection[] = [sectionFromMetrics(data, "offense-overview", hasGames ? "Offense Overview" : "Practice Offense", overview, overviewMetrics, base, options)];

  if (hasGames) {
    const gameBase = gameQuery(base, "hitting");
    sections.push(situationSection(data, gameBase, options));
    sections.push(countSection(data, gameBase, options));
    sections.push(matchupSection(data, gameBase, options));
    sections.push(inningSection(data, gameBase, options));
    sections.push(hotColdSection(data, gameBase, options));
  } else {
    sections.push(sectionFromMetrics(data, "practice-contact", "Contact Quality", overview, ["contactPct", "hardPct", "avgEv", "ev90", "pullPct", "middlePct", "oppoPct"], base, options));
    sections.push(sectionFromMetrics(data, "practice-approach", "Approach", overview, ["swingPct", "takePct", "chasePct", "zoneContactPct", "twoStrikeContactPct"], base, options));
  }

  return {
    domain: "hitting",
    sourceLabel: overview.sourceLabel,
    sections: sections.filter((section) => section.rows.length || section.emptyMessage),
    takeaways: hittingTakeaways(overview, hasGames ? sections.find((section) => section.id === "situational-hitting") : undefined),
  };
}

function buildPitchingInsights(data: AppData, base: AnalyticsQuery, options: AnalyticsInsightsOptions): AnalyticsInsightsModel {
  const overviewMetrics = ["whip", "strikeoutPctAllowed", "walkPctAllowed", "strikeoutMinusWalkPct", "strikePct", "firstPitchStrikePct", "cswPct", "whiffPct", "zonePct"];
  const overview = resultFor(data, queryFor(base, "pitching", overviewMetrics), options);
  const sections: AnalyticsInsightSection[] = [sectionFromMetrics(data, "pitching-overview", "Pitching Overview", overview, overviewMetrics, base, options)];

  if (selectedSources(base).includes("games")) {
    const games = gameQuery(base, "pitching");
    sections.push(sectionFromMetrics(data, "inning-efficiency", "Inning Efficiency", resultFor(data, queryFor(games, "pitching", ["pitchesPerInning", "pitchesPerBatterFaced", "pitchesPerOut", "threePitchOutRate", "fourPitchOutRate", "thirteenPitchInningRate", "fifteenPitchInningRate", "oneTwoThreeInningRate", "leadoffOutRate", "scorelessInningRate"]), options), ["pitchesPerInning", "pitchesPerBatterFaced", "pitchesPerOut", "threePitchOutRate", "fourPitchOutRate", "thirteenPitchInningRate", "fifteenPitchInningRate", "oneTwoThreeInningRate", "leadoffOutRate", "scorelessInningRate"], games, options, "Pitching Efficiency"));
    sections.push(sectionFromMetrics(data, "two-strike-pitching", "Two-Strike Performance", resultFor(data, queryFor(games, "pitching", ["twoStrikeFinishRate", "putawayRate", "strikeoutPctAllowed", "contactAllowedPct"]), options), ["twoStrikeFinishRate", "putawayRate", "strikeoutPctAllowed", "contactAllowedPct"], games, options));
  }

  const commandMetrics = ["strikePct", "ballPct", "firstPitchStrikePct", "zonePct", "calledStrikePct", "swStrPct", "cswPct", "whiffPct", "chasePctAllowed"];
  sections.push(sectionFromMetrics(data, "command", "Leadoff & Command", resultFor(data, queryFor(base, "pitching", commandMetrics), options), commandMetrics, base, options));
  sections.push(pitchMixSection(data, base, options));

  return {
    domain: "pitching",
    sourceLabel: overview.sourceLabel,
    sections: sections.filter((section) => section.rows.length || section.emptyMessage),
    takeaways: pitchingTakeaways(sections),
  };
}

function buildDefenseInsights(data: AppData, base: AnalyticsQuery, options: AnalyticsInsightsOptions): AnalyticsInsightsModel {
  const metrics = ["reps", "cleanPct", "errorPct", "throwAcc", "greatPlays", "fieldingErrors", "throwingErrors", "decisionErrors"];
  const overview = resultFor(data, queryFor(base, "defense", metrics), options);
  const positions = ["C", "1B", "2B", "3B", "SS", "OF"];
  const positionRows = positions.flatMap((position) => {
    const query = queryFor(base, "defense", ["reps", "cleanPct", "throwAcc"], { defensePositions: [position] });
    const result = resultFor(data, query, options);
    const reps = totalCell(result, "reps");
    const clean = totalCell(result, "cleanPct");
    if (!usable(reps) && !usable(clean)) return [];
    return [insightRow(`${position.toLowerCase()}-position`, position, clean ?? unavailable("cleanPct"), "cleanPct", reps, "reps", query)];
  });
  return {
    domain: "defense",
    sourceLabel: overview.sourceLabel,
    sections: [
      sectionFromMetrics(data, "defense-overview", "Defense Overview", overview, metrics, base, options),
      { id: "position-performance", title: "Position Performance", rows: positionRows, emptyMessage: positionRows.length ? undefined : "Not enough position-tagged practice data yet." },
    ].filter((section) => section.rows.length || section.emptyMessage),
    takeaways: defenseTakeaways(overview),
  };
}

function buildTeamInsights(data: AppData, base: AnalyticsQuery, options: AnalyticsInsightsOptions): AnalyticsInsightsModel {
  const hitting = resultFor(data, queryFor(base, "hitting", ["contactPct", "hardPct", "strikeoutPct", "walkPct", "pullPct", "middlePct", "oppoPct"]), options);
  const pitching = resultFor(data, queryFor(base, "pitching", ["strikePct", "firstPitchStrikePct", "zonePct", "cswPct", "threePitchOutRate"]), options);
  const defense = resultFor(data, queryFor(base, "defense", ["cleanPct", "throwAcc", "errorPct"]), options);
  return {
    domain: "team",
    sourceLabel: selectedSources(base).map(sourceLabel).join(" + "),
    sections: [
      sectionFromMetrics(data, "offensive-identity", "Offensive Identity", hitting, ["contactPct", "hardPct", "strikeoutPct", "walkPct", "pullPct", "middlePct", "oppoPct"], base, options),
      sectionFromMetrics(data, "pitching-identity", "Pitching Identity", pitching, ["strikePct", "firstPitchStrikePct", "zonePct", "cswPct", "threePitchOutRate"], base, options),
      sectionFromMetrics(data, "defensive-identity", "Defensive Identity", defense, ["cleanPct", "throwAcc", "errorPct"], base, options),
    ].filter((section) => section.rows.length || section.emptyMessage),
    takeaways: [...hittingTakeaways(hitting), ...pitchingTakeaways([]), ...defenseTakeaways(defense)].slice(0, 4),
  };
}

function situationSection(data: AppData, base: AnalyticsQuery, options: AnalyticsInsightsOptions): AnalyticsInsightSection {
  const situations: Array<{ id: string; label: string; filters: AnalyticsFilters }> = [
    { id: "risp", label: "RISP", filters: { runnerStates: ["risp"] } },
    { id: "risp-two-outs", label: "RISP, 2 Outs", filters: { runnerStates: ["risp"], outs: ["2"] } },
    { id: "two-outs", label: "2 Outs", filters: { outs: ["2"] } },
    { id: "first-pitch", label: "First Pitch", filters: { countGroups: ["first-pitch"] } },
    { id: "two-strikes", label: "Two Strikes", filters: { countGroups: ["two-strike"] } },
    { id: "leading", label: "Leading", filters: { gameStates: ["winning"] } },
    { id: "tied", label: "Tied", filters: { gameStates: ["tied"] } },
    { id: "trailing", label: "Trailing", filters: { gameStates: ["losing"] } },
  ];
  const rows = situations.flatMap((situation) => {
    const query = queryFor(base, "hitting", ["avg", "ops", "pa"], situation.filters);
    const result = resultFor(data, query, options);
    const avg = totalCell(result, "avg");
    if (!usable(avg)) return [];
    return [insightRow(situation.id, situation.label, avg, "avg", totalCell(result, "ops"), "ops", query, sampleText(totalCell(result, "pa"), "PA"))];
  });
  return { id: "situational-hitting", title: "Situational Hitting", detailTitle: "Situational Hitting", rows, emptyMessage: rows.length ? undefined : "No qualifying Game situations yet." };
}

function countSection(data: AppData, base: AnalyticsQuery, options: AnalyticsInsightsOptions): AnalyticsInsightSection {
  const groups: Array<[string, string]> = [["first-pitch", "0-0"], ["ahead", "Hitter Ahead"], ["even", "Even"], ["behind", "Pitcher Ahead"], ["two-strike", "Two Strikes"], ["full-count", "Full Count"]];
  const rows = groups.flatMap(([group, label]) => {
    const query = queryFor(base, "hitting", ["avg", "ops", "pa"], { countGroups: [group as AnalyticsCountGroup] });
    const result = resultFor(data, query, options);
    const avg = totalCell(result, "avg");
    return usable(avg) ? [insightRow(`count-${group}`, label, avg, "avg", totalCell(result, "ops"), "ops", query, sampleText(totalCell(result, "pa"), "PA"))] : [];
  });
  return { id: "count-performance", title: "Count Performance", rows, emptyMessage: rows.length ? undefined : "No qualifying count data yet." };
}

function matchupSection(data: AppData, base: AnalyticsQuery, options: AnalyticsInsightsOptions): AnalyticsInsightSection {
  const rows = (["R", "L"] as const).flatMap((hand) => {
    const query = queryFor(base, "hitting", ["avg", "ops", "strikeoutPct", "contactPct", "pa"], { pitcherHands: [hand] });
    const result = resultFor(data, query, options);
    const avg = totalCell(result, "avg");
    return usable(avg) ? [insightRow(`vs-${hand.toLowerCase()}hp`, `vs ${hand}HP`, avg, "avg", totalCell(result, "ops"), "ops", query, sampleText(totalCell(result, "pa"), "PA"))] : [];
  });
  return { id: "matchup", title: "Matchup", rows, emptyMessage: rows.length ? undefined : "No pitcher-hand matchups recorded yet." };
}

function inningSection(data: AppData, base: AnalyticsQuery, options: AnalyticsInsightsOptions): AnalyticsInsightSection {
  const rows = ["1", "2", "3", "4", "5", "6", "7", "8", "9"].flatMap((inning) => {
    const query = queryFor(base, "hitting", ["avg", "ops", "pa"], { innings: [inning] });
    const result = resultFor(data, query, options);
    const avg = totalCell(result, "avg");
    return usable(avg) ? [insightRow(`inning-${inning}`, `${inning}${ordinalSuffix(Number(inning))} Inning`, avg, "avg", totalCell(result, "ops"), "ops", query, sampleText(totalCell(result, "pa"), "PA"))] : [];
  });
  return { id: "inning-performance", title: "Inning Performance", rows, emptyMessage: rows.length ? undefined : "No inning-level Game data yet." };
}

function hotColdSection(data: AppData, base: AnalyticsQuery, options: AnalyticsInsightsOptions): AnalyticsInsightSection {
  const query = queryFor({ ...base, timeRange: "30d", eventIds: undefined }, "hitting", ["ops", "pa"]);
  const result = resultFor(data, query, options);
  const qualified = result.rows.filter((row) => numeric(row.cells.pa) >= 10 && usable(row.cells.ops));
  const hot = [...qualified].sort((left, right) => numeric(right.cells.ops) - numeric(left.cells.ops)).slice(0, 3);
  const cold = [...qualified].sort((left, right) => numeric(left.cells.ops) - numeric(right.cells.ops)).slice(0, 3);
  const toRow = (kind: "hot" | "cold", row: typeof qualified[number], index: number): AnalyticsInsightRow => ({
    id: `${kind}-${row.player.id}-${index}`,
    label: `${kind === "hot" ? "Hot" : "Cold"} · #${row.player.jerseyNumber} ${denseName(row.player.name)}`,
    primaryMetricId: "ops",
    primary: row.cells.ops,
    sample: sampleText(row.cells.pa, "PA"),
    drillQuery: { ...query, playerIds: [row.player.id] },
  });
  const rows = [...hot.map((row, index) => toRow("hot", row, index)), ...cold.map((row, index) => toRow("cold", row, index))];
  return { id: "hot-cold", title: "Hot / Cold · Last 30 Days", rows, emptyMessage: rows.length ? undefined : "No qualified 30-day OPS leaders yet (minimum 10 PA)." };
}

function pitchMixSection(data: AppData, base: AnalyticsQuery, options: AnalyticsInsightsOptions): AnalyticsInsightSection {
  const pitchTypes = ["4-Seam", "2-Seam", "Sinker", "Cutter", "Slider", "Curveball", "Changeup", "Splitter"];
  const rows = pitchTypes.flatMap((pitchType) => {
    const query = queryFor(base, "pitching", ["pitches", "cswPct", "strikePct", "avgPitchVelo"], { pitchTypes: [pitchType as PitchType] });
    const result = resultFor(data, query, options);
    const pitches = totalCell(result, "pitches");
    return usable(pitches) ? [insightRow(`pitch-${pitchType}`, pitchType, pitches, "pitches", totalCell(result, "cswPct"), "cswPct", query)] : [];
  });
  return { id: "pitch-mix", title: "Pitch Mix Quick Look", rows, emptyMessage: rows.length ? undefined : "No pitch-type data in this selection." };
}

function sectionFromMetrics(data: AppData, id: string, title: string, result: AnalyticsResult, metricIds: string[], base: AnalyticsQuery, options: AnalyticsInsightsOptions, detailTitle?: string): AnalyticsInsightSection {
  const rows = metricIds.flatMap((metricId) => {
    const metric = totalCell(result, metricId);
    if (!usable(metric)) return [];
    const definition = ANALYTICS_METRICS.find((item) => item.id === metricId);
    const trend = trendFor(data, result.query, metricId, metric, options);
    return [insightRow(metricId, definition?.fullName ?? metricId, metric, metricId, undefined, undefined, result.query, sampleText(metric), trend)];
  });
  return { id, title, detailTitle, rows, emptyMessage: rows.length ? undefined : "Not enough tracked data yet." };
}

function insightRow(id: string, label: string, primary: AnalyticsCell, primaryMetricId: string, secondary?: AnalyticsCell, secondaryMetricId?: string, drillQuery?: Partial<AnalyticsQuery>, sample?: string, trend?: AnalyticsInsightTrend): AnalyticsInsightRow {
  return { id, label, primaryMetricId, primary, secondaryMetricId, secondary, drillQuery, sample, trend };
}

function resultFor(data: AppData, query: AnalyticsQuery, options: AnalyticsInsightsOptions) {
  return executeAnalyticsQuery(data, query, options);
}

function totalCell(result: AnalyticsResult, metricId: string) {
  return result.teamTotals?.cells[metricId];
}

function queryFor(base: AnalyticsQuery, domain: AnalyticsDomain, metrics: string[], filters: AnalyticsFilters = {}): AnalyticsQuery {
  return { ...base, domain, mode: "box-score", groupBy: "player", metrics, filters: { ...base.filters, ...filters } };
}

function gameQuery(base: AnalyticsQuery, domain: AnalyticsDomain): AnalyticsQuery {
  return { ...base, domain, source: "games", fieldSources: [...GAME_SOURCES], mode: "box-score", groupBy: "player", filters: base.filters ?? {} };
}

function selectedSources(query: AnalyticsQuery): Array<"games" | "practice" | "live-bp"> {
  if (query.fieldSources?.length) return query.fieldSources;
  if (query.source !== "all") return [query.source];
  return query.domain === "pitching" ? ["games", "practice", "live-bp"] : query.domain === "defense" ? ["practice"] : ["practice", "live-bp"];
}

function trendFor(data: AppData, base: AnalyticsQuery, metricId: string, current: AnalyticsCell, options: AnalyticsInsightsOptions): AnalyticsInsightTrend | undefined {
  if (base.eventIds?.length || (base.timeRange !== "7d" && base.timeRange !== "30d")) return undefined;
  const days = base.timeRange === "7d" ? 7 : 30;
  const anchor = options.today ?? new Date().toISOString().slice(0, 10);
  const previousEnd = shiftDate(anchor, -(days + 1));
  const previousStart = shiftDate(previousEnd, -days);
  const previous = resultFor(data, { ...base, timeRange: "custom", customDateRange: { start: previousStart, end: previousEnd } }, options);
  const previousCell = totalCell(previous, metricId);
  if (!usable(previousCell) || typeof current.value !== "number" || typeof previousCell.value !== "number") return undefined;
  const delta = current.value - previousCell.value;
  const threshold = metricThreshold(metricId);
  if (Math.abs(delta) < threshold) return { direction: "neutral", display: "No material change", favorable: false };
  const higherIsBetter = !lowerIsBetter.has(metricId) && (ANALYTICS_METRICS.find((metric) => metric.id === metricId)?.higherIsBetter ?? true);
  const favorable = higherIsBetter ? delta > 0 : delta < 0;
  return { direction: delta > 0 ? "up" : "down", display: `${delta > 0 ? "+" : "-"}${formatTrendDelta(metricId, Math.abs(delta))}`, favorable };
}

function shiftDate(date: string, days: number) {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

function metricThreshold(metricId: string) {
  const format = ANALYTICS_METRICS.find((metric) => metric.id === metricId)?.format;
  return format === "percentage" ? 0.1 : format === "decimal" ? 0.005 : 0.01;
}

function formatTrendDelta(metricId: string, value: number) {
  const format = ANALYTICS_METRICS.find((metric) => metric.id === metricId)?.format;
  if (format === "percentage") return `${value.toFixed(1)} pts`;
  if (format === "decimal") return value.toFixed(3).replace(/^0/, "");
  if (format === "velocity" || format === "ev") return value.toFixed(1);
  return value.toFixed(2);
}

function usable(cell?: AnalyticsCell): cell is AnalyticsCell {
  return Boolean(cell && cell.kind !== "not-tracked" && cell.kind !== "not-applicable" && cell.value !== undefined);
}

function unavailable(metricId: string): AnalyticsCell {
  return { metricId, display: "—", kind: "not-tracked" };
}

function numeric(cell?: AnalyticsCell) {
  return typeof cell?.value === "number" ? cell.value : 0;
}

function sampleText(cell?: AnalyticsCell, fallback?: string) {
  const denominator = cell?.sample?.denominator;
  if (!denominator) return undefined;
  return `${denominator} ${cell.sample?.label ?? fallback ?? "samples"}`;
}

function denseName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0][0]}. ${parts.at(-1)}` : name;
}

function ordinalSuffix(value: number) {
  if (value % 100 >= 11 && value % 100 <= 13) return "th";
  return value % 10 === 1 ? "st" : value % 10 === 2 ? "nd" : value % 10 === 3 ? "rd" : "th";
}

function sourceLabel(source: string) {
  return source === "live-bp" ? "Live BP" : source[0].toUpperCase() + source.slice(1);
}

function hittingTakeaways(overview: AnalyticsResult, situations?: AnalyticsInsightSection): AnalyticsInsightTakeaway[] {
  const takeaways: AnalyticsInsightTakeaway[] = [];
  const contact = totalCell(overview, "contactPct");
  const chase = totalCell(overview, "chasePct");
  const risp = situations?.rows.find((row) => row.id === "risp");
  if (usable(risp?.primary) && numeric(risp.primary) >= 0.3) takeaways.push({ id: "risp-strength", tone: "positive", text: "RISP batting average is a current team strength in the selected Game sample." });
  if (usable(contact) && usable(chase) && numeric(chase) > numeric(contact) * 0.45) takeaways.push({ id: "chase-focus", tone: "development", text: "Chase rate is elevated relative to contact; pitch selection is a useful development focus." });
  if (!takeaways.length) takeaways.push({ id: "hitting-context", tone: "neutral", text: "Use the situational rows to move directly into the filtered player table." });
  return takeaways;
}

function pitchingTakeaways(sections: AnalyticsInsightSection[]): AnalyticsInsightTakeaway[] {
  const efficiency = sections.find((section) => section.id === "inning-efficiency");
  const threePitch = efficiency?.rows.find((row) => row.primaryMetricId === "threePitchOutRate");
  return usable(threePitch?.primary) && numeric(threePitch.primary) >= 30
    ? [{ id: "three-pitch-strength", tone: "positive", text: "The selected Game sample is producing a strong rate of three-pitch outs." }]
    : [{ id: "pitching-context", tone: "neutral", text: "Use Pitching Efficiency to inspect exact canonical inning and two-strike rates." }];
}

function defenseTakeaways(overview: AnalyticsResult): AnalyticsInsightTakeaway[] {
  const clean = totalCell(overview, "cleanPct");
  if (usable(clean) && numeric(clean) >= 80) return [{ id: "defense-clean", tone: "positive", text: "Practice defensive reps are converting cleanly in the selected sample." }];
  return [{ id: "defense-context", tone: "neutral", text: "Game fielding totals remain unavailable until fielder attribution is captured." }];
}

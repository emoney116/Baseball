import type {
  AppData,
  BattedBallType,
  Direction,
  DefenseDrillContext,
  DefenseEvent,
  DefenseOutcome,
  DefenseRepSubtype,
  DefenseRepType,
  DefenseThrowResult,
  GameBallInPlayOutcome,
  GameEvent,
  HittingEvent,
  ID,
  LiveBpThrowerSource,
  PlateAppearance,
  PitchEvent,
  PitchLocationGridZoneId,
  PitchType,
  Player,
  Practice,
  ZonePoint,
} from "../types.ts";
import { isPracticeHardContactEvent } from "./hittingTaxonomy.ts";
import { legacyGamePointToCanonical } from "./sprayChart.ts";
import {
  calculateDefenseStats,
  defenseEventDrillContext,
  defenseEventPosition,
  defenseEventRepSubtype,
  defenseEventRepType,
  defenseEventResult,
  defenseEventThrowResult,
} from "./stats.ts";
import { buildWeightRoomScoreRows, type WeightRoomWindow } from "./weightRoom.ts";
import {
  ANALYTICS_FILTER_CATALOG,
  ANALYTICS_METRICS as CATALOG_ANALYTICS_METRICS,
  ANALYTICS_SAMPLE_THRESHOLDS as CATALOG_ANALYTICS_SAMPLE_THRESHOLDS,
  analyticsViewsFor,
  normalizeAnalyticsView,
  type AnalyticsViewDefinition,
  type AnalyticsViewId,
} from "./analyticsCatalog.ts";

export type AnalyticsDomain = "hitting" | "pitching" | "defense" | "development";
export type AnalyticsSource = "all" | "games" | "practice" | "live-bp";
export type AnalyticsMode = "box-score" | "situational";
export type AnalyticsTimeRange = "7d" | "30d" | "season" | "custom";
export type AnalyticsDevelopmentView = "overview" | "weight-room" | "attendance" | "trends";
export type AnalyticsValueKind = "available" | "insufficient-sample" | "not-tracked" | "not-applicable";
export type AnalyticsMetricFormat = "integer" | "percentage" | "decimal" | "ev" | "velocity" | "text";
export type AnalyticsSortDirection = "asc" | "desc";
export type AnalyticsGroupBy = "player";
export type AnalyticsFilterAvailability = "supported" | "partial" | "unsupported" | "not-applicable";
export type AnalyticsPitchLocationRegion =
  | "in_zone" | "out_of_zone" | "up" | "middle" | "down"
  | "in" | "away" | "up_and_in" | "up_and_away" | "down_and_in" | "down_and_away"
  | "arm_side" | "glove_side" | "up_arm_side" | "up_glove_side" | "down_arm_side" | "down_glove_side"
  | PitchLocationGridZoneId;
export type AnalyticsCountGroup = "first-pitch" | "ahead" | "even" | "behind" | "two-strike" | "full-count";
export type AnalyticsGameState = "winning" | "tied" | "losing";
export type AnalyticsRunnerState = "bases-empty" | "runners-on" | "risp";

export interface AnalyticsQueryContext {
  teamId?: ID;
  seasonId?: ID;
  organizationId?: ID;
  role?: string;
}

export interface AnalyticsDateRange {
  start?: string;
  end?: string;
}

export interface AnalyticsFilters {
  pitcherHands?: Array<"R" | "L" | "S">;
  batterHands?: Array<"R" | "L" | "S">;
  pitchTypes?: PitchType[];
  exactCounts?: string[];
  countGroups?: AnalyticsCountGroup[];
  drillTypes?: string[];
  liveBpThrowerSources?: LiveBpThrowerSource[];
  battedBallTypes?: BattedBallType[];
  defenseStations?: string[];
  defensePositions?: string[];
  defenseDrills?: DefenseDrillContext[];
  defenseRepTypes?: DefenseRepType[];
  defenseRepSubtypes?: DefenseRepSubtype[];
  defenseResults?: DefenseOutcome[];
  defenseThrowResults?: DefenseThrowResult[];
  pitchVelocityMin?: number;
  pitchVelocityMax?: number;
  pitchLocationRegions?: AnalyticsPitchLocationRegion[];
  directions?: Direction[];
  gameStates?: AnalyticsGameState[];
  innings?: string[];
  outs?: string[];
  runnerStates?: AnalyticsRunnerState[];
  opponents?: string[];
  homeAway?: Array<"Home" | "Away" | "Neutral">;
  gamePitchOutcomes?: string[];
  gameBipOutcomes?: string[];
}

export interface AnalyticsQuery {
  domain: AnalyticsDomain;
  source: AnalyticsSource;
  mode: AnalyticsMode;
  view?: AnalyticsViewId;
  timeRange: AnalyticsTimeRange;
  developmentView?: AnalyticsDevelopmentView;
  customDateRange?: AnalyticsDateRange;
  eventIds?: ID[];
  /** Internal, authorized player scope used by player-detail and Ask Clubhouse visual queries. */
  playerIds?: ID[];
  filters?: AnalyticsFilters;
  metrics?: string[];
  groupBy: AnalyticsGroupBy;
  sort?: {
    metricId: string;
    direction: AnalyticsSortDirection;
  };
  limit?: number;
  context?: AnalyticsQueryContext;
}

export interface AnalyticsMetricDefinition {
  id: string;
  label: string;
  fullName?: string;
  domain: AnalyticsDomain;
  format: AnalyticsMetricFormat;
  supportedSources: AnalyticsSource[];
  sourceAvailability?: Partial<Record<AnalyticsSource, "supported" | "partial" | "derivable" | "not-tracked">>;
  minimumSample?: number;
  qualification?: string;
  higherIsBetter?: boolean;
  presetGroups?: Array<"standard" | "advanced" | "development">;
  displayOrder?: number;
  sortable: boolean;
  situationalSupport: boolean;
  definition: string;
}

export interface AnalyticsFilterDefinition {
  id: keyof AnalyticsFilters;
  label: string;
  section: string;
  domains: AnalyticsDomain[];
  supportedSources: AnalyticsSource[];
  type: "multi-select" | "range" | "pitch-location";
  options: Array<{ value: string; label: string }>;
  availability: AnalyticsFilterAvailability;
  capabilityNote?: string;
  dynamicOptions?: "opponents" | "innings";
}

export interface AnalyticsEventOption {
  id: ID;
  label: string;
  meta?: string;
  date?: string;
  source: Exclude<AnalyticsSource, "all">;
}

export interface AnalyticsCell {
  metricId: string;
  value?: number | string;
  display: string;
  sortValue?: number | string;
  kind: AnalyticsValueKind;
  sample?: {
    numerator?: number;
    denominator?: number;
    label?: string;
  };
  sourceScope?: AnalyticsSource[];
}

export interface AnalyticsColumn {
  metricId: string;
  label: string;
  align: "left" | "right" | "center";
  definition?: string;
  sortable: boolean;
}

export interface AnalyticsRow {
  player: Player;
  cells: Record<string, AnalyticsCell>;
  sampleCount: number;
  rowKind?: "player" | "group" | "team";
  groupKey?: string;
  groupLabel?: string;
  groupMeta?: string;
}

export interface AnalyticsSummaryItem {
  label: string;
  value: string;
  sub?: string;
}

export interface AnalyticsInsight {
  id: string;
  label: string;
  title: string;
  value: string;
  meta?: string;
  playerId?: ID;
}

export interface AnalyticsSprayChart {
  points: Array<ZonePoint & { id: ID }>;
  ballsInPlay: number;
  trackedLocations: number;
}

export interface AnalyticsPitchLocationChart {
  points: Array<ZonePoint & { id: ID; chartOutcome?: "hit" | "out" | "contact" | "miss" }>;
  qualifyingEvents: number;
  trackedLocations: number;
  metricLabel: "Batting average" | "Contact rate" | "Pitch density";
}

export interface AnalyticsResult {
  query: AnalyticsQuery;
  title: string;
  sourceLabel: string;
  availableColumns: AnalyticsColumn[];
  columns: AnalyticsColumn[];
  rows: AnalyticsRow[];
  teamTotals?: AnalyticsRow;
  summary: AnalyticsSummaryItem[];
  insights: AnalyticsInsight[];
  availableEvents: AnalyticsEventOption[];
  filterDefinitions: AnalyticsFilterDefinition[];
  warnings: string[];
  scopeLabel: string;
  sampleLabel: string;
  availableViews: AnalyticsViewDefinition[];
  sprayChart?: AnalyticsSprayChart;
  pitchLocationChart?: AnalyticsPitchLocationChart;
}

export interface AskClubhouseQuestion {
  id: string;
  label: string;
  domain: AnalyticsDomain;
  query: Omit<AnalyticsQuery, "context">;
  rankingMetricId: string;
  criteria: string;
}

export interface AskClubhouseResponse {
  question: AskClubhouseQuestion;
  result: AnalyticsResult;
  lines: Array<{ playerId: ID; label: string; value: string; sample?: string }>;
}

export const ANALYTICS_SAMPLE_THRESHOLDS = {
  ...CATALOG_ANALYTICS_SAMPLE_THRESHOLDS,
} as const;

export const ANALYTICS_METRICS = CATALOG_ANALYTICS_METRICS;
export const ANALYTICS_FILTERS = ANALYTICS_FILTER_CATALOG;

export const ASK_CLUBHOUSE_QUESTIONS: AskClubhouseQuestion[] = [
  askQuestion("highest-practice-contact", "Who has the highest practice Contact %?", "hitting", "contactPct", "Practice Contact %, minimum 12 swings", {
    domain: "hitting",
    source: "practice",
    mode: "box-score",
    timeRange: "season",
    groupBy: "player",
    sort: { metricId: "contactPct", direction: "desc" },
    limit: 5,
  }),
  askQuestion("highest-avg-ev", "Who has the highest Avg EV this season?", "hitting", "avgEv", "Average EV, minimum 3 recorded samples", {
    domain: "hitting",
    source: "all",
    mode: "box-score",
    timeRange: "season",
    groupBy: "player",
    sort: { metricId: "avgEv", direction: "desc" },
    limit: 5,
  }),
  askQuestion("highest-hard-hit", "Who has the highest practice Hard %?", "hitting", "hardPct", "Practice Hard %, minimum 8 balls in play", {
    domain: "hitting",
    source: "practice",
    mode: "box-score",
    timeRange: "season",
    groupBy: "player",
    sort: { metricId: "hardPct", direction: "desc" },
    limit: 5,
  }),
  askQuestion("best-strike-pct", "Which pitchers have the best Strike %?", "pitching", "strikePct", "Strike %, minimum 18 pitches", {
    domain: "pitching",
    source: "all",
    mode: "box-score",
    timeRange: "season",
    groupBy: "player",
    sort: { metricId: "strikePct", direction: "desc" },
    limit: 5,
  }),
  askQuestion("highest-zone-pct", "Which pitchers are in the zone most often?", "pitching", "zonePct", "Zone %, minimum 18 pitches", {
    domain: "pitching",
    source: "all",
    mode: "box-score",
    timeRange: "season",
    groupBy: "player",
    sort: { metricId: "zonePct", direction: "desc" },
    limit: 5,
  }),
  askQuestion("weight-room-development", "Who leads Weight Room Development?", "development", "weightScore", "Existing Weight Room Development score", {
    domain: "development",
    source: "all",
    mode: "box-score",
    timeRange: "season",
    developmentView: "weight-room",
    groupBy: "player",
    sort: { metricId: "weightScore", direction: "desc" },
    limit: 5,
  }),
];

export function executeAnalyticsQuery(data: AppData, input: AnalyticsQuery, options: { today?: string } = {}): AnalyticsResult {
  let query = normalizeAnalyticsQuery(input);
  const warnings = validateAnalyticsContext(data, query);
  const sourceLabel = sourceLabels[query.source];
  const scopeLabel = buildScopeLabel(data, query);
  const availableEvents = buildEventOptions(data, query.domain, query.source);
  if (query.eventIds?.length) {
    const availableEventIds = new Set(availableEvents.map((event) => event.id));
    const selectedEventIds = query.eventIds.filter((id) => availableEventIds.has(id));
    query = { ...query, eventIds: selectedEventIds.length ? selectedEventIds : undefined };
  }
  const filterDefinitions = availableFilterDefinitions(data, query);

  const result = query.domain === "hitting"
    ? buildHittingResult(data, query, warnings, availableEvents, filterDefinitions, scopeLabel, sourceLabel, options.today)
    : query.domain === "pitching"
      ? buildPitchingResult(data, query, warnings, availableEvents, filterDefinitions, scopeLabel, sourceLabel, options.today)
      : query.domain === "defense"
        ? buildDefenseResult(data, query, warnings, availableEvents, filterDefinitions, scopeLabel, sourceLabel, options.today)
        : buildDevelopmentResult(data, query, warnings, availableEvents, filterDefinitions, scopeLabel, sourceLabel, options.today);

  const viewedResult = applyAnalyticsView(data, result, options.today);
  return {
    ...viewedResult,
    availableViews: analyticsViewsFor(query.domain, query.source),
    rows: sortAnalyticsRows(viewedResult.rows, viewedResult.columns, query).slice(0, query.limit ?? viewedResult.rows.length),
  };
}

export function runAskClubhouseQuestion(data: AppData, questionId: string, context?: AnalyticsQueryContext, options: { today?: string } = {}): AskClubhouseResponse | undefined {
  const question = ASK_CLUBHOUSE_QUESTIONS.find((item) => item.id === questionId);
  if (!question) return undefined;
  const result = executeAnalyticsQuery(data, { ...question.query, context }, options);
  const lines = result.rows
    .filter((row) => {
      const cell = row.cells[question.rankingMetricId];
      return cell && cell.kind === "available";
    })
    .slice(0, 5)
    .map((row, index) => {
      const cell = row.cells[question.rankingMetricId];
      return {
        playerId: row.player.id,
        label: `${index + 1}. ${row.player.name}`,
        value: cell.display,
        sample: sampleText(cell),
      };
    });
  return { question, result, lines };
}

export function defaultAnalyticsSort(domain: AnalyticsDomain, source: AnalyticsSource, mode: AnalyticsMode): AnalyticsQuery["sort"] {
  if (mode === "situational") {
    if (domain === "hitting") return { metricId: "contactPct", direction: "desc" };
    if (domain === "pitching") return { metricId: "strikePct", direction: "desc" };
    if (domain === "defense") return { metricId: "cleanPct", direction: "desc" };
  }
  if (domain === "development") return { metricId: "weightScore", direction: "desc" };
  if (source === "games" && domain === "hitting") return { metricId: "avg", direction: "desc" };
  return { metricId: "player", direction: "asc" };
}

export function formatAnalyticsValue(value: number | string | undefined, format: AnalyticsMetricFormat): string {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "string") return value;
  if (!Number.isFinite(value)) return "—";
  if (format === "integer") return String(Math.round(value));
  if (format === "percentage") return `${value.toFixed(0)}%`;
  if (format === "decimal") return value.toFixed(3).replace(/^0/, "");
  if (format === "ev" || format === "velocity") return value.toFixed(1);
  return String(value);
}

export function metricById(metricId: string): AnalyticsMetricDefinition | undefined {
  return ANALYTICS_METRICS.find((metricItem) => metricItem.id === metricId);
}

export function analyticsEventSummary(eventIds: ID[] | undefined, availableEvents: AnalyticsEventOption[]): string {
  if (!eventIds?.length) return "All Events";
  if (eventIds.length === 1) return availableEvents.find((event) => event.id === eventIds[0])?.label ?? "1 Event";
  return `${eventIds.length} Events`;
}

function buildHittingResult(
  data: AppData,
  query: AnalyticsQuery,
  warnings: string[],
  availableEvents: AnalyticsEventOption[],
  filterDefinitions: AnalyticsFilterDefinition[],
  scopeLabel: string,
  sourceLabel: string,
  today?: string,
): AnalyticsResult {
  if (query.source === "games") {
    warnings.push("Game hitting uses completed logged plate appearances when available. A dash means that outcome has not been recorded for the selected games.");
    const gameEvents = filterGameEvents(data, query, today);
    const rows = currentRosterPlayers(data).map((player) => gameHittingRow(player, gameEvents.filter((event) => event.batterId === player.id), data.plateAppearances));
    const teamTotals = gameHittingTeamRow(data, gameEvents);
    return {
      ...assembleResult("Team Hitting", data, query, sourceLabel, rows, teamTotals, ["pa", "ab", "hits", "singles", "doubles", "triples", "homeRuns", "walks", "strikeouts", "hitByPitch", "outs", "xbh", "totalBases", "obp", "avg", "slg", "ops", "iso", "babip", "hrPct", "xbhPct", "tbPerAb"], warnings, availableEvents, filterDefinitions, scopeLabel),
      sprayChart: buildGameSprayChart(gameEvents),
      pitchLocationChart: buildGameHittingPitchLocationChart(gameEvents),
    };
  }

  const events = filterHittingEvents(data, query, today);
  const rows = currentRosterPlayers(data).map((player) => hittingRow(player, events.filter((event) => event.hitterId === player.id)));
  const teamTotals = hittingTeamRow(data, events);
  const columns = ["opportunities", "swings", "contacts", "contactPct", "hardPct", "avgEv", "maxEv", "takes", "bip", "misses", "fouls", "swingPct", "bipPct", "swingMissPct", "foulPct", "takePct", "zoneSwingPct", "zoneContactPct", "chasePct", "outZoneContactPct", "hard", "barrelPct", "softPct", "lineDrivePct", "groundBallPct", "flyBallPct", "popUpPct", "groundBalls", "lineDrives", "flyBalls", "popUps", "gbFbRatio", "airPct", "pullPct", "middlePct", "oppoPct", "medianEv", "ev90", "ev95", "evSamples"];
  if (query.source === "all") warnings.push("Hitting All combines compatible practice and Live BP swing-event metrics. Traditional game batting appears in the Games source until full PA results are tracked.");
  return {
    ...assembleResult("Team Hitting", data, query, sourceLabel, rows, teamTotals, columns, warnings, availableEvents, filterDefinitions, scopeLabel),
    sprayChart: buildHittingSprayChart(events),
    pitchLocationChart: buildHittingPitchLocationChart(events),
  };
}

function buildHittingSprayChart(events: HittingEvent[]): AnalyticsSprayChart {
  const ballsInPlay = events.filter((event) => event.action === "Ball in play");
  return {
    points: ballsInPlay.flatMap((event) => event.fieldLocation ? [{ id: event.id, ...event.fieldLocation }] : []),
    ballsInPlay: ballsInPlay.length,
    trackedLocations: ballsInPlay.filter((event) => Boolean(event.fieldLocation)).length,
  };
}

function buildHittingPitchLocationChart(events: HittingEvent[]): AnalyticsPitchLocationChart {
  return {
    points: events.flatMap((event) => event.pitchLocation ? [{
      id: event.id,
      ...event.pitchLocation,
      chartOutcome: event.action === "Ball in play" || event.action === "Foul" ? "contact" : "miss",
    }] : []),
    qualifyingEvents: events.length,
    trackedLocations: events.filter((event) => Boolean(event.pitchLocation)).length,
    metricLabel: "Contact rate",
  };
}

function buildGameHittingPitchLocationChart(events: GameEvent[]): AnalyticsPitchLocationChart {
  const hitOutcomes = new Set(["Single", "Double", "Triple", "Home Run"]);
  const points = events.flatMap((event) => {
    if (!event.location) return [];
    const chartOutcome: "hit" | "out" | undefined = event.ballInPlayOutcome
      ? hitOutcomes.has(event.ballInPlayOutcome) ? "hit" : "out"
      : undefined;
    return [{ id: event.id, ...event.location, chartOutcome }];
  });
  return {
    points,
    qualifyingEvents: events.length,
    trackedLocations: points.length,
    metricLabel: "Batting average",
  };
}

function buildGameSprayChart(events: GameEvent[]): AnalyticsSprayChart {
  const ballsInPlay = events.filter((event) => Boolean(event.ballInPlayOutcome));
  return {
    points: ballsInPlay.flatMap((event) => event.fieldLocation ? [{ id: event.id, ...legacyGamePointToCanonical(event.fieldLocation) }] : []),
    ballsInPlay: ballsInPlay.length,
    trackedLocations: ballsInPlay.filter((event) => Boolean(event.fieldLocation)).length,
  };
}

function buildPitchingResult(
  data: AppData,
  query: AnalyticsQuery,
  warnings: string[],
  availableEvents: AnalyticsEventOption[],
  filterDefinitions: AnalyticsFilterDefinition[],
  scopeLabel: string,
  sourceLabel: string,
  today?: string,
): AnalyticsResult {
  const practiceEvents = query.source === "games" ? [] : filterPitchEvents(data, query, today);
  const gameEvents = query.source === "practice" || query.source === "live-bp" ? [] : filterGameEvents(data, query, today);
  const rows = currentRosterPlayers(data)
    .filter((player) => player.isPitcher || practiceEvents.some((event) => event.pitcherId === player.id) || gameEvents.some((event) => event.pitcherId === player.id))
    .map((player) => pitchingRow(player, practiceEvents.filter((event) => event.pitcherId === player.id), gameEvents.filter((event) => event.pitcherId === player.id)));
  const teamTotals = pitchingTeamRow(data, practiceEvents, gameEvents);
  if (query.source === "games") warnings.push("Game pitching currently supports pitch-level metrics, not full innings/ERA/WHIP.");
  return {
    ...assembleResult("Team Pitching", data, query, sourceLabel, rows, teamTotals, ["pitches", "strikePct", "zonePct", "avgPitchVelo", "maxPitchVelo", "balls", "strikes", "ballPct", "swingPctAllowed", "whiffPct", "swStrPct", "calledStrikePct", "cswPct", "contactAllowedPct", "zoneWhiffPct", "outZoneWhiffPct", "firstPitchStrikePct", "medianPitchVelo", "p90PitchVelo", "minPitchVelo", "veloSpread"], warnings, availableEvents, filterDefinitions, scopeLabel),
    pitchLocationChart: buildPitchLocationChart(practiceEvents, gameEvents),
  };
}

function buildPitchLocationChart(practiceEvents: PitchEvent[], gameEvents: GameEvent[]): AnalyticsPitchLocationChart {
  const hitOutcomes = new Set(["Single", "Double", "Triple", "Home Run"]);
  const points = [
    ...practiceEvents.flatMap((event) => event.location ? [{ id: event.id, ...event.location }] : []),
    ...gameEvents.flatMap((event) => event.location ? [{
      id: event.id,
      ...event.location,
      chartOutcome: event.ballInPlayOutcome
        ? hitOutcomes.has(event.ballInPlayOutcome) ? "hit" : "out"
        : undefined,
    }] : []),
  ];
  return {
    points,
    qualifyingEvents: practiceEvents.length + gameEvents.length,
    trackedLocations: points.length,
    metricLabel: "Pitch density",
  };
}

function buildDefenseResult(
  data: AppData,
  query: AnalyticsQuery,
  warnings: string[],
  availableEvents: AnalyticsEventOption[],
  filterDefinitions: AnalyticsFilterDefinition[],
  scopeLabel: string,
  sourceLabel: string,
  today?: string,
): AnalyticsResult {
  if (query.source === "games" || query.source === "live-bp") {
    warnings.push("Defense V1 is currently powered by practice defensive reps. Game and Live BP defensive box score stats are documented as future tracking gaps.");
    const rows = currentRosterPlayers(data).map((player) => defenseRow(player, []));
    const teamTotals = defenseTeamRow(data, []);
    return assembleResult("Team Defense", data, query, sourceLabel, rows, teamTotals, ["positionWorked", "reps", "cleanReps", "errors", "fieldingErrors", "throwingErrors", "decisionErrors", "missedReps", "errorPct", "cleanPct", "throwAcc", "throws", "accurateThrows", "inaccurateThrows", "greatPlays"], warnings, availableEvents, filterDefinitions, scopeLabel);
  }
  const events = filterDefenseEvents(data, query, today);
  const rows = currentRosterPlayers(data).map((player) => defenseRow(player, events.filter((event) => event.playerId === player.id)));
  const teamTotals = defenseTeamRow(data, events);
  return assembleResult("Team Defense", data, query, sourceLabel, rows, teamTotals, ["positionWorked", "reps", "cleanReps", "errors", "fieldingErrors", "throwingErrors", "decisionErrors", "missedReps", "errorPct", "cleanPct", "throwAcc", "throws", "accurateThrows", "inaccurateThrows", "greatPlays"], warnings, availableEvents, filterDefinitions, scopeLabel);
}

function buildDevelopmentResult(
  data: AppData,
  query: AnalyticsQuery,
  warnings: string[],
  availableEvents: AnalyticsEventOption[],
  filterDefinitions: AnalyticsFilterDefinition[],
  scopeLabel: string,
  sourceLabel: string,
  today?: string,
): AnalyticsResult {
  warnings.push("Development V1 keeps Weight Room Score separate from total baseball development until broader formulas are defined.");
  const dateRange = resolveDateRange(data, query, today);
  const practices = filterPracticesByDate(data.practices, dateRange, query);
  const practiceIds = new Set(practices.map((practice) => practice.id));
  const weightWindow = weightRoomWindowForRange(query.timeRange);
  const rowsByPlayer = buildWeightRoomScoreRows(currentRosterPlayers(data), data.workoutSessions, data.workoutEntries, weightWindow, dateRange.end ?? today);
  const weightByPlayer = new Map(rowsByPlayer.map((row) => [row.player.id, row]));
  const rows = currentRosterPlayers(data).map((player) => {
    const workouts = data.workoutSessions.filter((session) => session.playerId === player.id && dateInRange(session.date, dateRange));
    const completed = workouts.filter((session) => session.completed).length;
    const attendance = data.attendance.filter((item) => item.playerId === player.id && practiceIds.has(item.practiceId));
    const attended = attendance.filter((item) => item.status === "Present" || item.status === "Late").length;
    const hittingReps = data.hittingEvents.filter((event) => event.hitterId === player.id && practiceIds.has(event.practiceId)).length;
    const pitches = data.pitchEvents.filter((event) => event.pitcherId === player.id && practiceIds.has(event.practiceId)).length;
    const defense = data.defenseEvents.filter((event) => event.playerId === player.id && practiceIds.has(event.practiceId)).length;
    const weight = weightByPlayer.get(player.id);
    return makeRow(player, {
      weightScore: cellFromNumber(weight?.score, "integer", weight?.qualified ? "available" : weight ? "insufficient-sample" : "not-tracked", {
        denominator: weight?.completedSessions,
        label: weight ? `${weight.completedSessions ?? 0} completed workouts` : undefined,
      }),
      workouts: countCell(completed, workouts.length),
      workoutCompletionPct: rateCell(completed, workouts.length, "workouts", ANALYTICS_SAMPLE_THRESHOLDS.weightRoomWorkouts),
      attendancePct: rateCell(attended, attendance.length || practices.length, "attendance"),
      practiceReps: countCell(hittingReps + pitches + defense, hittingReps + pitches + defense),
    });
  });
  const teamTotals = developmentTeamRow(data, rows, practices);
  return assembleResult("Team Development", data, query, sourceLabel, rows, teamTotals, ["weightScore", "workouts", "workoutCompletionPct", "attendancePct", "practiceReps"], warnings, availableEvents, filterDefinitions, scopeLabel);
}

function applyAnalyticsView(data: AppData, result: AnalyticsResult, today?: string): AnalyticsResult {
  const viewId = normalizeAnalyticsView(result.query.domain, result.query.source, result.query.view);
  const definition = analyticsViewsFor(result.query.domain, result.query.source).find((item) => item.id === viewId);
  if (!definition?.groupBy) return result;
  const groupBy = definition.groupBy;

  const warnings = [...result.warnings];
  let rows: AnalyticsRow[] = [];
  let totalEvents = 0;
  let groupedEvents = 0;

  if (result.query.domain === "hitting") {
    if (result.query.source === "games") {
      const events = filterGameEvents(data, result.query, today);
      const groups = groupItems(events, (event) => gameHittingGroup(data, event, groupBy));
      totalEvents = events.length;
      groupedEvents = groupSize(groups);
      rows = [...groups.entries()].map(([key, group], index) => groupAnalyticsRow(gameHittingRow(groupPlayer(data, key, index), group.items, data.plateAppearances), key, group.label));
    } else {
      const events = filterHittingEvents(data, result.query, today);
      const groups = groupItems(events, (event) => practiceHittingGroup(data, event, groupBy));
      totalEvents = events.length;
      groupedEvents = groupSize(groups);
      rows = [...groups.entries()].map(([key, group], index) => groupAnalyticsRow(hittingRow(groupPlayer(data, key, index), group.items), key, group.label));
    }
  } else if (result.query.domain === "pitching") {
    const practiceEvents = result.query.source === "games" ? [] : filterPitchEvents(data, result.query, today);
    const gameEvents = result.query.source === "practice" || result.query.source === "live-bp" ? [] : filterGameEvents(data, result.query, today);
    const practiceGroups = groupItems(practiceEvents, (event) => practicePitchingGroup(data, event, groupBy));
    const gameGroups = groupItems(gameEvents, (event) => gamePitchingGroup(data, event, groupBy));
    const keys = [...new Set([...practiceGroups.keys(), ...gameGroups.keys()])];
    totalEvents = practiceEvents.length + gameEvents.length;
    groupedEvents = groupSize(practiceGroups) + groupSize(gameGroups);
    rows = keys.map((key, index) => {
      const practiceGroup = practiceGroups.get(key);
      const gameGroup = gameGroups.get(key);
      const label = practiceGroup?.label ?? gameGroup?.label ?? key;
      return groupAnalyticsRow(pitchingRow(groupPlayer(data, key, index), practiceGroup?.items ?? [], gameGroup?.items ?? []), key, label);
    });
  } else if (result.query.domain === "defense") {
    const events = filterDefenseEvents(data, result.query, today);
    const groups = groupItems(events, (event) => defenseGroup(event, groupBy));
    totalEvents = events.length;
    groupedEvents = groupSize(groups);
    rows = [...groups.entries()].map(([key, group], index) => groupAnalyticsRow(defenseRow(groupPlayer(data, key, index), group.items), key, group.label));
  }

  if (totalEvents && groupedEvents < totalEvents) {
    warnings.push(`${definition.label} is available on ${groupedEvents} of ${totalEvents} qualifying events; unclassified events are excluded from this view.`);
  }
  return { ...result, rows, warnings: [...new Set(warnings)], insights: [] };
}

function groupItems<T>(items: T[], resolve: (item: T) => { key: string; label: string } | undefined): Map<string, { label: string; items: T[] }> {
  const groups = new Map<string, { label: string; items: T[] }>();
  for (const item of items) {
    const group = resolve(item);
    if (!group) continue;
    const current = groups.get(group.key);
    if (current) current.items.push(item);
    else groups.set(group.key, { label: group.label, items: [item] });
  }
  return groups;
}

function groupSize<T>(groups: Map<string, { items: T[] }>): number {
  return [...groups.values()].reduce((total, group) => total + group.items.length, 0);
}

function practiceHittingGroup(data: AppData, event: HittingEvent, groupBy: NonNullable<AnalyticsViewDefinition["groupBy"]>) {
  if (groupBy === "count") return countGroupLabel(hittingEventCount(data, event));
  if (groupBy === "pitch-type" && event.pitchType) return { key: event.pitchType, label: event.pitchType };
  if (groupBy === "hand") {
    const pitcher = data.players.find((player) => player.id === event.pitcherId);
    return pitcher ? { key: pitcher.throws, label: `vs ${pitcher.throws}HP` } : undefined;
  }
  if (groupBy === "batted-ball" && event.contactResult) return { key: event.contactResult, label: event.contactResult };
  if (groupBy === "spray" && event.direction) {
    const label = directionBucket(event.direction);
    return { key: label, label };
  }
  return undefined;
}

function gameHittingGroup(data: AppData, event: GameEvent, groupBy: NonNullable<AnalyticsViewDefinition["groupBy"]>) {
  if (groupBy === "count") return countGroupLabel(event.countBefore);
  if (groupBy === "pitch-type" && event.pitchType) return { key: event.pitchType, label: event.pitchType };
  if (groupBy === "hand") {
    const pitcher = data.players.find((player) => player.id === event.pitcherId);
    return pitcher ? { key: pitcher.throws, label: `vs ${pitcher.throws}HP` } : undefined;
  }
  if (groupBy === "game-state") {
    const state = gameStateForEvent(event);
    return { key: state, label: state === "winning" ? "Winning" : state === "losing" ? "Trailing" : "Tied" };
  }
  if (groupBy === "batted-ball") {
    const label = gameContactTypeToBattedBall(event.contactType) ?? event.ballInPlayOutcome;
    return label ? { key: label, label } : undefined;
  }
  return undefined;
}

function practicePitchingGroup(data: AppData, event: PitchEvent, groupBy: NonNullable<AnalyticsViewDefinition["groupBy"]>) {
  if (groupBy === "count") return countGroupLabel(event.countBefore);
  if (groupBy === "pitch-type") return { key: event.pitchType, label: event.pitchType };
  if (groupBy === "hand") {
    const batter = data.players.find((player) => player.id === event.hitterId);
    return batter ? { key: batter.bats, label: `vs ${batter.bats}HB` } : undefined;
  }
  if (groupBy === "batted-ball" && event.battedBall) return { key: event.battedBall, label: event.battedBall };
  if (groupBy === "spray" && event.location) return locationGroup(event.location, { pitcherRelative: true, pitcherThrows: data.players.find((player) => player.id === event.pitcherId)?.throws });
  return undefined;
}

function gamePitchingGroup(data: AppData, event: GameEvent, groupBy: NonNullable<AnalyticsViewDefinition["groupBy"]>) {
  if (groupBy === "count") return countGroupLabel(event.countBefore);
  if (groupBy === "pitch-type" && event.pitchType) return { key: event.pitchType, label: event.pitchType };
  if (groupBy === "hand") {
    const batter = data.players.find((player) => player.id === event.batterId);
    return batter ? { key: batter.bats, label: `vs ${batter.bats}HB` } : undefined;
  }
  if (groupBy === "game-state") {
    const state = gameStateForEvent(event);
    return { key: state, label: state === "winning" ? "Winning" : state === "losing" ? "Trailing" : "Tied" };
  }
  if (groupBy === "batted-ball") {
    const label = gameContactTypeToBattedBall(event.contactType) ?? event.ballInPlayOutcome;
    return label ? { key: label, label } : undefined;
  }
  if (groupBy === "spray" && event.location) return locationGroup(event.location, { pitcherRelative: true, pitcherThrows: data.players.find((player) => player.id === event.pitcherId)?.throws });
  return undefined;
}

function defenseGroup(event: DefenseEvent, groupBy: NonNullable<AnalyticsViewDefinition["groupBy"]>) {
  if (groupBy === "position") {
    const value = defenseEventPosition(event, "");
    return value ? { key: value, label: value } : undefined;
  }
  if (groupBy === "rep-type") {
    const value = defenseEventRepType(event);
    return value ? { key: value, label: value } : undefined;
  }
  if (groupBy === "drill") {
    const value = defenseEventDrillContext(event);
    return value ? { key: value, label: value } : undefined;
  }
  return undefined;
}

function countGroupLabel(count?: { balls: number; strikes: number }) {
  return count ? { key: countLabel(count), label: countLabel(count) } : undefined;
}

function locationGroup(location: { x: number; y: number }, orientation: LocationOrientation = {}) {
  const vertical = location.y < 0.34 ? "Up" : location.y > 0.66 ? "Down" : "Middle";
  const horizontal = locationHorizontalLabel(location.x, orientation);
  if (horizontal === "Unknown") return undefined;
  const label = horizontal === "Middle" ? vertical : vertical === "Middle" ? horizontal : `${vertical} & ${horizontal}`;
  return { key: label.toLowerCase().replaceAll(" ", "-"), label };
}

function groupPlayer(data: AppData, key: string, index: number): Player {
  return { ...teamPlayer(data), id: `analytics-group:${key}`, name: key, jerseyNumber: index + 1, isPitcher: false, isHitter: false };
}

function groupAnalyticsRow(row: AnalyticsRow, key: string, label: string): AnalyticsRow {
  return { ...row, rowKind: "group", groupKey: key, groupLabel: label };
}

function assembleResult(
  title: string,
  data: AppData,
  query: AnalyticsQuery,
  sourceLabel: string,
  rows: AnalyticsRow[],
  teamTotals: AnalyticsRow | undefined,
  metricIds: string[],
  warnings: string[],
  availableEvents: AnalyticsEventOption[],
  filterDefinitions: AnalyticsFilterDefinition[],
  scopeLabel: string,
): AnalyticsResult {
  const availableColumns = metricIds
    .map((metricId) => metricById(metricId))
    .filter((metricItem): metricItem is AnalyticsMetricDefinition => Boolean(metricItem))
    .filter((metricItem) => metricItem.supportedSources.includes(query.source) || (query.source === "all" && metricItem.supportedSources.includes("all")))
    .map((metricItem) => ({
      metricId: metricItem.id,
      label: metricItem.label,
      align: metricItem.format === "text" ? "left" as const : "right" as const,
      definition: metricItem.definition,
      sortable: metricItem.sortable,
    }));
  const selectedMetrics = query.metrics?.length ? query.metrics : undefined;
  const availableColumnById = new Map(availableColumns.map((column) => [column.metricId, column]));
  const columns = selectedMetrics
    ? selectedMetrics.flatMap((metricId) => {
      const column = availableColumnById.get(metricId);
      return column ? [column] : [];
    })
    : availableColumns;
  const sampleCount = rows.reduce((total, row) => total + row.sampleCount, 0);
  const playersWithData = rows.filter((row) => row.sampleCount > 0).length;
  return {
    query,
    title,
    sourceLabel,
    availableColumns,
    columns,
    rows,
    teamTotals,
    summary: buildSummary(data, query, rows, teamTotals),
    insights: buildInsights(query, rows),
    availableEvents,
    filterDefinitions,
    warnings: [...new Set(warnings)],
    scopeLabel,
    sampleLabel: `${sampleCount.toLocaleString()} tracked ${sampleCount === 1 ? "event" : "events"} · ${playersWithData} ${playersWithData === 1 ? "player" : "players"}`,
    availableViews: analyticsViewsFor(query.domain, query.source),
  };
}

function hittingRow(player: Player, events: HittingEvent[]): AnalyticsRow {
  const swings = events.filter((event) => event.action !== "Took pitch").length;
  const takes = events.filter((event) => event.action === "Took pitch").length;
  const misses = events.filter((event) => event.action === "Miss").length;
  const fouls = events.filter((event) => event.action === "Foul").length;
  const contacts = events.filter((event) => event.action === "Ball in play" || event.action === "Foul").length;
  const ballsInPlay = events.filter((event) => event.action === "Ball in play").length;
  const hard = events.filter(isPracticeHardContactEvent).length;
  const barrels = events.filter((event) => event.contactQuality === "Barrel").length;
  const evs = events.map((event) => event.exitVelocityMph).filter(isNumber);
  const located = events.filter((event) => event.pitchLocation);
  const inZone = located.filter((event) => isAnalyticsZonePoint(event.pitchLocation));
  const outOfZone = located.filter((event) => !isAnalyticsZonePoint(event.pitchLocation));
  const inZoneSwings = inZone.filter(isHittingSwing);
  const inZoneContacts = inZoneSwings.filter(isHittingContact);
  const chases = outOfZone.filter(isHittingSwing);
  const outOfZoneContacts = chases.filter(isHittingContact);
  const groundBalls = events.filter((event) => event.contactResult === "Ground ball").length;
  const lineDrives = events.filter((event) => event.contactResult === "Line drive").length;
  const flyBalls = events.filter((event) => event.contactResult === "Fly ball").length;
  const popUps = events.filter((event) => event.contactResult === "Pop up").length;
  const softContact = events.filter((event) => event.contactQuality === "Poor" || event.contactQuality === "Weak").length;
  const directed = events.filter((event) => event.action === "Ball in play" && event.direction);
  return makeRow(player, {
    opportunities: countCell(events.length, events.length),
    takes: countCell(takes, events.length),
    swings: countCell(swings, events.length),
    contacts: countCell(contacts, swings),
    bip: countCell(ballsInPlay, events.length),
    misses: countCell(misses, swings),
    fouls: countCell(fouls, swings),
    swingPct: rateCell(swings, events.length, "swings"),
    bipPct: rateCell(ballsInPlay, swings, "balls in play", ANALYTICS_SAMPLE_THRESHOLDS.hittingSwings),
    contactPct: rateCell(contacts, swings, "contact", ANALYTICS_SAMPLE_THRESHOLDS.hittingSwings),
    swingMissPct: rateCell(misses, swings, "misses", ANALYTICS_SAMPLE_THRESHOLDS.hittingSwings),
    foulPct: rateCell(fouls, swings, "fouls", ANALYTICS_SAMPLE_THRESHOLDS.hittingSwings),
    takePct: rateCell(takes, events.length, "takes"),
    zoneSwingPct: rateCell(inZoneSwings.length, inZone.length, "in-zone swings", ANALYTICS_SAMPLE_THRESHOLDS.hittingSwings),
    zoneContactPct: rateCell(inZoneContacts.length, inZoneSwings.length, "in-zone contact", ANALYTICS_SAMPLE_THRESHOLDS.hittingSwings),
    chasePct: rateCell(chases.length, outOfZone.length, "chases", ANALYTICS_SAMPLE_THRESHOLDS.hittingSwings),
    outZoneContactPct: rateCell(outOfZoneContacts.length, chases.length, "out-of-zone contact", ANALYTICS_SAMPLE_THRESHOLDS.hittingSwings),
    hard: countCell(hard, ballsInPlay),
    hardPct: rateCell(hard, ballsInPlay, "hard contact", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
    barrelPct: rateCell(barrels, ballsInPlay, "impact contact", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
    lineDrivePct: rateCell(lineDrives, ballsInPlay, "line drives", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
    groundBallPct: rateCell(groundBalls, ballsInPlay, "ground balls", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
    flyBallPct: rateCell(flyBalls, ballsInPlay, "fly balls", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
    popUpPct: rateCell(popUps, ballsInPlay, "pop ups", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
    groundBalls: countCell(groundBalls, ballsInPlay),
    lineDrives: countCell(lineDrives, ballsInPlay),
    flyBalls: countCell(flyBalls, ballsInPlay),
    popUps: countCell(popUps, ballsInPlay),
    softPct: rateCell(softContact, ballsInPlay, "poor or weak contact", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
    gbFbRatio: decimalRateCell(groundBalls, flyBalls, "GB/FB", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
    airPct: rateCell(lineDrives + flyBalls + popUps, ballsInPlay, "air balls", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
    pullPct: rateCell(directed.filter((event) => directionBucket(event.direction) === "Pull").length, directed.length, "pull-side balls", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
    middlePct: rateCell(directed.filter((event) => directionBucket(event.direction) === "Middle").length, directed.length, "middle-field balls", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
    oppoPct: rateCell(directed.filter((event) => directionBucket(event.direction) === "Opposite").length, directed.length, "opposite-field balls", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
    avgEv: averageCell(evs, "ev", ANALYTICS_SAMPLE_THRESHOLDS.exitVelocitySamples),
    medianEv: percentileCell(evs, 0.5, "ev", ANALYTICS_SAMPLE_THRESHOLDS.exitVelocitySamples),
    ev90: percentileCell(evs, 0.9, "ev", ANALYTICS_SAMPLE_THRESHOLDS.exitVelocityPercentileSamples),
    ev95: percentileCell(evs, 0.95, "ev", ANALYTICS_SAMPLE_THRESHOLDS.exitVelocityPercentileSamples),
    maxEv: maxCell(evs, "ev"),
    evSamples: countCell(evs.length, evs.length),
  });
}

function hittingTeamRow(data: AppData, events: HittingEvent[]): AnalyticsRow {
  const eligibleIds = currentRosterPlayerIdSet(data);
  return hittingRow(teamPlayer(data), events.filter((event) => eligibleIds.has(event.hitterId)));
}

function gameHittingRow(player: Player, events: GameEvent[], plateAppearances: PlateAppearance[]): AnalyticsRow {
  const bip = events.filter((event) => event.ballInPlayOutcome);
  const appearanceIds = new Set(events.flatMap((event) => event.plateAppearanceId ? [event.plateAppearanceId] : []));
  const completedAppearances = plateAppearances.filter((appearance) => appearance.hitterId === player.id && Boolean(appearance.endedAt) && appearanceIds.has(appearance.id));
  const useCompletedAppearances = completedAppearances.length > 0;
  const outcomes = completedAppearances.flatMap((appearance) => appearance.outcome ? [appearance.outcome] : []);
  const atBats = useCompletedAppearances
    ? outcomes.filter((outcome) => outcome !== "Walk" && outcome !== "HBP").length
    : bip.filter((event) => event.ballInPlayOutcome && gameAtBatOutcomes.has(event.ballInPlayOutcome)).length;
  const hits = useCompletedAppearances
    ? outcomes.filter((outcome) => ["Single", "Double", "Triple", "Home run"].includes(outcome)).length
    : bip.filter((event) => event.ballInPlayOutcome && hitOutcomes.has(event.ballInPlayOutcome)).length;
  const doubles = useCompletedAppearances ? outcomes.filter((outcome) => outcome === "Double").length : bip.filter((event) => event.ballInPlayOutcome === "Double").length;
  const triples = useCompletedAppearances ? outcomes.filter((outcome) => outcome === "Triple").length : bip.filter((event) => event.ballInPlayOutcome === "Triple").length;
  const homeRuns = useCompletedAppearances ? outcomes.filter((outcome) => outcome === "Home run").length : bip.filter((event) => event.ballInPlayOutcome === "Home Run").length;
  const singles = useCompletedAppearances ? outcomes.filter((outcome) => outcome === "Single").length : bip.filter((event) => event.ballInPlayOutcome === "Single").length;
  const walks = outcomes.filter((outcome) => outcome === "Walk").length;
  const hitByPitch = outcomes.filter((outcome) => outcome === "HBP").length;
  const strikeouts = outcomes.filter((outcome) => outcome === "Strikeout looking" || outcome === "Strikeout swinging").length;
  const outs = useCompletedAppearances ? outcomes.filter((outcome) => outcome.endsWith("out") || outcome.startsWith("Strikeout")).length : Math.max(0, atBats - hits);
  const xbh = doubles + triples + homeRuns;
  const totalBases = hits + doubles + triples * 2 + homeRuns * 3;
  const babipDenominator = Math.max(0, bip.length - homeRuns);
  const plateAppearancesCount = completedAppearances.length;
  const gameSample = plateAppearancesCount || bip.length;
  const onBaseNumerator = hits + walks + hitByPitch;
  const obp = plateAppearancesCount ? onBaseNumerator / plateAppearancesCount : undefined;
  const slg = atBats ? totalBases / atBats : undefined;
  return makeRow(player, {
    pa: plateAppearancesCount ? countCell(plateAppearancesCount, plateAppearancesCount) : cell("—", undefined, "not-tracked"),
    trackedBip: countCell(bip.length, gameSample),
    ab: countCell(atBats, gameSample),
    hits: countCell(hits, gameSample),
    singles: countCell(singles, gameSample),
    doubles: countCell(doubles, gameSample),
    triples: countCell(triples, gameSample),
    homeRuns: countCell(homeRuns, gameSample),
    walks: plateAppearancesCount ? countCell(walks, plateAppearancesCount) : cell("—", undefined, "not-tracked"),
    strikeouts: plateAppearancesCount ? countCell(strikeouts, plateAppearancesCount) : cell("—", undefined, "not-tracked"),
    hitByPitch: plateAppearancesCount ? countCell(hitByPitch, plateAppearancesCount) : cell("—", undefined, "not-tracked"),
    outs: countCell(outs, gameSample),
    xbh: countCell(xbh, gameSample),
    totalBases: countCell(totalBases, gameSample),
    obp: obp === undefined ? cell("—", undefined, "not-tracked") : cellFromNumber(obp, "decimal", "available", { numerator: onBaseNumerator, denominator: plateAppearancesCount, label: "OBP" }),
    avg: decimalRateCell(hits, atBats, "AVG"),
    slg: decimalRateCell(totalBases, atBats, "SLG"),
    ops: obp === undefined || slg === undefined ? cell("—", undefined, "not-tracked") : cellFromNumber(obp + slg, "decimal", "available", { denominator: plateAppearancesCount, label: "OPS" }),
    iso: decimalRateCell(totalBases - hits, atBats, "ISO"),
    babip: decimalRateCell(hits - homeRuns, babipDenominator, "BABIP"),
    hrPct: rateCell(homeRuns, atBats, "home runs", 1),
    xbhPct: rateCell(xbh, atBats, "extra-base hits", 1),
    tbPerAb: decimalRateCell(totalBases, atBats, "TB/AB"),
  });
}

function gameHittingTeamRow(data: AppData, events: GameEvent[]): AnalyticsRow {
  const eligibleIds = currentRosterPlayerIdSet(data);
  return gameHittingRow(teamPlayer(data), events.filter((event) => event.batterId ? eligibleIds.has(event.batterId) : false), data.plateAppearances);
}

function pitchingRow(player: Player, pitchEvents: PitchEvent[], gameEvents: GameEvent[]): AnalyticsRow {
  const pitches = [
    ...pitchEvents.map(practicePitchSample),
    ...gameEvents.map(gamePitchSample),
  ];
  const swings = pitches.filter((pitch) => pitch.isSwing).length;
  const whiffs = pitches.filter((pitch) => pitch.isWhiff).length;
  const velocities = pitches.map((pitch) => pitch.velocity).filter(isNumber);
  const locatedPitches = pitches.filter((pitch) => pitch.hasLocation);
  const firstPitches = pitches.filter((pitch) => pitch.countBefore?.balls === 0 && pitch.countBefore?.strikes === 0);
  const strikes = pitches.filter((pitch) => pitch.isStrike).length;
  const contacts = pitches.filter((pitch) => pitch.isContact).length;
  const calledStrikes = pitches.filter((pitch) => pitch.isCalledStrike).length;
  const inZoneSwings = pitches.filter((pitch) => pitch.hasLocation && pitch.isZone && pitch.isSwing);
  const outOfZoneSwings = pitches.filter((pitch) => pitch.hasLocation && !pitch.isZone && pitch.isSwing);
  return makeRow(player, {
    pitches: countCell(pitches.length, pitches.length),
    balls: countCell(pitches.length - strikes, pitches.length),
    strikes: countCell(strikes, pitches.length),
    strikePct: rateCell(strikes, pitches.length, "strikes", ANALYTICS_SAMPLE_THRESHOLDS.pitchingPitches),
    ballPct: rateCell(pitches.length - strikes, pitches.length, "balls", ANALYTICS_SAMPLE_THRESHOLDS.pitchingPitches),
    swingPctAllowed: rateCell(swings, pitches.length, "swings", ANALYTICS_SAMPLE_THRESHOLDS.pitchingPitches),
    zonePct: rateCell(locatedPitches.filter((pitch) => pitch.isZone).length, locatedPitches.length, "zone pitches", ANALYTICS_SAMPLE_THRESHOLDS.pitchingPitches),
    whiffPct: rateCell(whiffs, swings, "whiffs", ANALYTICS_SAMPLE_THRESHOLDS.pitchingPitches),
    swStrPct: rateCell(whiffs, pitches.length, "swinging strikes", ANALYTICS_SAMPLE_THRESHOLDS.pitchingPitches),
    calledStrikePct: rateCell(calledStrikes, pitches.length, "called strikes", ANALYTICS_SAMPLE_THRESHOLDS.pitchingPitches),
    cswPct: rateCell(calledStrikes + whiffs, pitches.length, "CSW", ANALYTICS_SAMPLE_THRESHOLDS.pitchingPitches),
    contactAllowedPct: rateCell(contacts, swings, "contact", ANALYTICS_SAMPLE_THRESHOLDS.pitchingPitches),
    zoneWhiffPct: rateCell(inZoneSwings.filter((pitch) => pitch.isWhiff).length, inZoneSwings.length, "in-zone whiffs", ANALYTICS_SAMPLE_THRESHOLDS.pitchingPitches),
    outZoneWhiffPct: rateCell(outOfZoneSwings.filter((pitch) => pitch.isWhiff).length, outOfZoneSwings.length, "out-of-zone whiffs", ANALYTICS_SAMPLE_THRESHOLDS.pitchingPitches),
    firstPitchStrikePct: rateCell(firstPitches.filter((pitch) => pitch.isStrike).length, firstPitches.length, "first-pitch strikes", 8),
    avgPitchVelo: averageCell(velocities, "velocity", 3),
    medianPitchVelo: percentileCell(velocities, 0.5, "velocity", 3),
    p90PitchVelo: percentileCell(velocities, 0.9, "velocity", ANALYTICS_SAMPLE_THRESHOLDS.pitchingVelocityPercentileSamples),
    maxPitchVelo: maxCell(velocities, "velocity"),
    minPitchVelo: minCell(velocities, "velocity"),
    veloSpread: spreadCell(velocities, "velocity", 3),
  });
}

function pitchingTeamRow(data: AppData, pitchEvents: PitchEvent[], gameEvents: GameEvent[]): AnalyticsRow {
  const eligibleIds = currentRosterPlayerIdSet(data);
  return pitchingRow(
    teamPlayer(data),
    pitchEvents.filter((event) => eligibleIds.has(event.pitcherId)),
    gameEvents.filter((event) => event.pitcherId ? eligibleIds.has(event.pitcherId) : false),
  );
}

function defenseRow(player: Player, events: DefenseEvent[]): AnalyticsRow {
  const stats = calculateDefenseStats(events);
  const positions = events.map((event) => defenseEventPosition(event, "")).filter(Boolean);
  const position = mostCommonString(positions) ?? (events.length ? player.primaryPosition : "—");
  return makeRow(player, {
    positionWorked: cell(position, position, events.length ? "available" : "not-tracked"),
    reps: countCell(stats.totalReps, stats.totalReps),
    cleanReps: countCell(stats.cleanReps, stats.totalReps),
    cleanPct: rateCell(stats.cleanReps, stats.totalReps, "clean reps", ANALYTICS_SAMPLE_THRESHOLDS.defenseReps),
    errors: countCell(stats.errors, stats.totalReps),
    fieldingErrors: countCell(events.filter((event) => event.outcome === "Error" && event.errorType === "Fielding").length, stats.totalReps),
    throwingErrors: countCell(events.filter((event) => event.outcome === "Error" && event.errorType === "Throwing").length, stats.totalReps),
    decisionErrors: countCell(events.filter((event) => event.outcome === "Error" && event.errorType === "Decision").length, stats.totalReps),
    missedReps: countCell(events.filter((event) => event.outcome === "Missed Rep").length, stats.totalReps),
    errorPct: rateCell(stats.errors, stats.totalReps, "errors", ANALYTICS_SAMPLE_THRESHOLDS.defenseReps),
    greatPlays: countCell(stats.greatPlays, stats.totalReps),
    throws: countCell(stats.throwAttempts, stats.throwAttempts),
    accurateThrows: countCell(stats.accurateThrows, stats.throwAttempts),
    inaccurateThrows: countCell(events.filter((event) => event.throwResult === "Inaccurate").length, stats.throwAttempts),
    throwAcc: rateCell(stats.accurateThrows, stats.throwAttempts, "accurate throws", ANALYTICS_SAMPLE_THRESHOLDS.defenseReps),
  });
}

function defenseTeamRow(data: AppData, events: DefenseEvent[]): AnalyticsRow {
  const eligibleIds = currentRosterPlayerIdSet(data);
  return defenseRow(teamPlayer(data), events.filter((event) => eligibleIds.has(event.playerId)));
}

function developmentTeamRow(data: AppData, rows: AnalyticsRow[], practices: Practice[]): AnalyticsRow {
  const player = teamPlayer(data);
  const workouts = rows.reduce((total, row) => total + numericCell(row, "workouts"), 0);
  const reps = rows.reduce((total, row) => total + numericCell(row, "practiceReps"), 0);
  const attendanceValues = rows.map((row) => row.cells.attendancePct?.value).filter(isNumber);
  const weightValues = rows.map((row) => row.cells.weightScore?.value).filter(isNumber);
  return makeRow(player, {
    weightScore: cellFromNumber(average(weightValues), "integer", weightValues.length ? "available" : "not-tracked"),
    workouts: countCell(workouts, workouts),
    workoutCompletionPct: cell("—", undefined, "not-tracked"),
    attendancePct: cellFromNumber(average(attendanceValues), "percentage", practices.length ? "available" : "not-tracked"),
    practiceReps: countCell(reps, reps),
  });
}

function buildSummary(data: AppData, query: AnalyticsQuery, rows: AnalyticsRow[], teamTotals?: AnalyticsRow): AnalyticsSummaryItem[] {
  const playersWithData = rows.filter((row) => row.sampleCount > 0).length;
  const items: AnalyticsSummaryItem[] = [
    { label: "Players", value: String(currentRosterPlayers(data).length), sub: `${playersWithData} with data` },
  ];
  if (teamTotals) {
    const metricIds = query.domain === "hitting"
      ? query.source === "games"
        ? ["hits", "avg", "slg"]
        : ["swings", "contactPct", "hardPct", "avgEv"]
      : query.domain === "pitching"
        ? ["pitches", "strikePct", "zonePct", "avgPitchVelo"]
        : query.domain === "defense"
          ? ["reps", "cleanPct", "errors", "throwAcc"]
          : ["workouts", "attendancePct", "practiceReps"];
    for (const metricId of metricIds) {
      const metricItem = metricById(metricId);
      const totalCell = teamTotals.cells[metricId];
      if (!metricItem || !totalCell) continue;
      items.push({ label: metricItem.label, value: totalCell.display, sub: sampleText(totalCell) });
    }
  }
  return items.slice(0, 5);
}

function buildInsights(query: AnalyticsQuery, rows: AnalyticsRow[]): AnalyticsInsight[] {
  const metricIds = query.domain === "hitting"
    ? query.source === "games" ? ["avg", "hits"] : ["contactPct", "hardPct", "avgEv"]
    : query.domain === "pitching"
      ? ["strikePct", "zonePct", "avgPitchVelo"]
      : query.domain === "defense"
        ? ["cleanPct", "throwAcc", "greatPlays"]
        : ["weightScore", "attendancePct", "practiceReps"];
  return metricIds.flatMap((metricId) => {
    const metricItem = metricById(metricId);
    if (!metricItem) return [];
    const sortedRows = [...rows]
      .filter((row) => row.player.id !== "team-total")
      .filter((row) => row.cells[metricId]?.kind === "available")
      .sort((left, right) => compareCell(right.cells[metricId], left.cells[metricId]));
    const leader = sortedRows[0];
    if (!leader) return [];
    return [{
      id: `${query.domain}-${metricId}`,
      label: metricItem.label,
      title: leader.player.name,
      value: leader.cells[metricId].display,
      meta: sampleText(leader.cells[metricId]),
      playerId: leader.player.id,
    }];
  }).slice(0, 4);
}

function filterHittingEvents(data: AppData, query: AnalyticsQuery, today?: string): HittingEvent[] {
  const dateRange = resolveDateRange(data, query, today);
  const sessions = new Map(data.hittingSessions.map((session) => [session.id, session]));
  return data.hittingEvents.filter((event) => {
    const practice = data.practices.find((item) => item.id === event.practiceId);
    const session = sessions.get(event.sessionId);
    const isLive = event.isLiveBp || session?.type === "Live BP";
    if (query.source === "practice" && isLive) return false;
    if (query.source === "live-bp" && !isLive) return false;
    if (isLive && query.filters?.liveBpThrowerSources?.length && !query.filters.liveBpThrowerSources.includes(liveBpThrowerSource(session))) return false;
    if (query.source === "games") return false;
    if (query.playerIds?.length && !query.playerIds.includes(event.hitterId)) return false;
    if (!practice || !dateInRange(practice.date, dateRange)) return false;
    if (query.eventIds?.length && !query.eventIds.includes(practice.id) && !query.eventIds.includes(event.sessionId)) return false;
    return hittingEventMatchesFilters(data, event, query.filters);
  });
}

function filterPitchEvents(data: AppData, query: AnalyticsQuery, today?: string): PitchEvent[] {
  const dateRange = resolveDateRange(data, query, today);
  const sessions = new Map(data.pitchingSessions.map((session) => [session.id, session]));
  return data.pitchEvents.filter((event) => {
    const practice = data.practices.find((item) => item.id === event.practiceId);
    const session = sessions.get(event.sessionId);
    const isLive = session?.type === "Live BP";
    if (query.source === "practice" && isLive) return false;
    if (query.source === "live-bp" && !isLive) return false;
    if (isLive && query.filters?.liveBpThrowerSources?.length && !query.filters.liveBpThrowerSources.includes(liveBpThrowerSource(session))) return false;
    if (query.source === "games") return false;
    if (query.playerIds?.length && !query.playerIds.includes(event.pitcherId)) return false;
    if (!practice || !dateInRange(practice.date, dateRange)) return false;
    if (query.eventIds?.length && !query.eventIds.includes(practice.id) && !query.eventIds.includes(event.sessionId)) return false;
    return pitchEventMatchesFilters(data, event, query.filters);
  });
}

function filterDefenseEvents(data: AppData, query: AnalyticsQuery, today?: string): DefenseEvent[] {
  const dateRange = resolveDateRange(data, query, today);
  return data.defenseEvents.filter((event) => {
    const practice = data.practices.find((item) => item.id === event.practiceId);
    if (!practice || !dateInRange(practice.date, dateRange)) return false;
    if (query.eventIds?.length && !query.eventIds.includes(practice.id) && !query.eventIds.includes(event.sessionId)) return false;
    if (query.filters?.defenseStations?.length && !query.filters.defenseStations.includes(event.station)) return false;
    if (query.filters?.defensePositions?.length && !query.filters.defensePositions.includes(defenseEventPosition(event, ""))) return false;
    if (query.filters?.defenseDrills?.length && !query.filters.defenseDrills.includes(defenseEventDrillContext(event) as DefenseDrillContext)) return false;
    if (query.filters?.defenseRepTypes?.length && !query.filters.defenseRepTypes.includes(defenseEventRepType(event))) return false;
    if (query.filters?.defenseRepSubtypes?.length && !query.filters.defenseRepSubtypes.includes(defenseEventRepSubtype(event) as DefenseRepSubtype)) return false;
    if (query.filters?.defenseResults?.length && !query.filters.defenseResults.includes(defenseEventResult(event))) return false;
    if (query.filters?.defenseThrowResults?.length) {
      const throwResult = defenseEventThrowResult(event);
      if (!throwResult || !query.filters.defenseThrowResults.includes(throwResult)) return false;
    }
    return true;
  });
}

function filterGameEvents(data: AppData, query: AnalyticsQuery, today?: string): GameEvent[] {
  const dateRange = resolveDateRange(data, query, today);
  const games = new Map(data.games.map((game) => [game.id, game]));
  return data.gameEvents.filter((event) => {
    if ((event.recordStatus ?? "confirmed") !== "confirmed" || event.eventKind === "correction") return false;
    if (query.playerIds?.length) {
      const playerId = query.domain === "pitching" ? event.pitcherId : event.batterId;
      if (!playerId || !query.playerIds.includes(playerId)) return false;
    }
    const game = games.get(event.gameId);
    if (!game || !dateInRange(game.date, dateRange)) return false;
    if (query.eventIds?.length && !query.eventIds.includes(game.id)) return false;
    if (query.filters?.opponents?.length && !query.filters.opponents.includes(game.opponent)) return false;
    if (query.filters?.homeAway?.length && !query.filters.homeAway.includes(game.homeAway as "Home" | "Away" | "Neutral")) return false;
    if (query.filters?.innings?.length && !query.filters.innings.includes(String(event.inning))) return false;
    if (query.filters?.outs?.length && !query.filters.outs.includes(String(event.outsBefore))) return false;
    if (query.filters?.exactCounts?.length && (!event.countBefore || !query.filters.exactCounts.includes(countLabel(event.countBefore)))) return false;
    if (query.filters?.countGroups?.length) {
      const group = countGroup(event.countBefore);
      if (!group || !query.filters.countGroups.some((selected) => countMatchesGroup(event.countBefore, selected))) return false;
    }
    if (query.filters?.gameStates?.length && !query.filters.gameStates.includes(gameStateForEvent(event))) return false;
    if (query.filters?.runnerStates?.length && !query.filters.runnerStates.some((state) => runnerStateMatches(event, state))) return false;
    if (query.domain === "hitting" && query.filters?.pitchTypes?.length && (!event.pitchType || !query.filters.pitchTypes.includes(event.pitchType))) return false;
    if (query.domain === "pitching" && query.filters?.pitchTypes?.length && (!event.pitchType || !query.filters.pitchTypes.includes(event.pitchType))) return false;
    if (query.domain === "pitching" && query.filters?.batterHands?.length) {
      const batter = data.players.find((player) => player.id === event.batterId);
      if (!batter || !query.filters.batterHands.includes(batter.bats)) return false;
    }
    if (query.domain === "hitting" && query.filters?.pitcherHands?.length) {
      const pitcher = data.players.find((player) => player.id === event.pitcherId);
      if (!pitcher || !query.filters.pitcherHands.includes(pitcher.throws)) return false;
    }
    if (query.filters?.gamePitchOutcomes?.length && (!event.pitchOutcome || !query.filters.gamePitchOutcomes.includes(event.pitchOutcome))) return false;
    if (query.filters?.gameBipOutcomes?.length && (!event.ballInPlayOutcome || !query.filters.gameBipOutcomes.includes(event.ballInPlayOutcome))) return false;
    if (query.filters?.battedBallTypes?.length) {
      const contactType = gameContactTypeToBattedBall(event.contactType);
      if (!contactType || !query.filters.battedBallTypes.includes(contactType)) return false;
    }
    if (!velocityMatches(event.velocity, query.filters?.pitchVelocityMin, query.filters?.pitchVelocityMax)) return false;
    if (query.filters?.pitchLocationRegions?.length) {
      const locationContext = query.domain === "pitching"
        ? { pitcherRelative: true, pitcherThrows: data.players.find((player) => player.id === event.pitcherId)?.throws }
        : { batterHand: data.players.find((player) => player.id === event.batterId)?.bats };
      if (!query.filters.pitchLocationRegions.some((region) => pitchLocationMatches(event.location, region, locationContext))) return false;
    }
    return true;
  });
}

function hittingEventMatchesFilters(data: AppData, event: HittingEvent, filters?: AnalyticsFilters): boolean {
  if (!filters) return true;
  if (filters.pitchTypes?.length && (!event.pitchType || !filters.pitchTypes.includes(event.pitchType))) return false;
  if (filters.battedBallTypes?.length && (!event.contactResult || !filters.battedBallTypes.includes(event.contactResult))) return false;
  if (filters.drillTypes?.length) {
    const session = data.hittingSessions.find((item) => item.id === event.sessionId);
    if (!session || !filters.drillTypes.includes(session.type)) return false;
  }
  if (filters.pitcherHands?.length) {
    const pitcher = data.players.find((player) => player.id === event.pitcherId);
    if (!pitcher || !filters.pitcherHands.includes(pitcher.throws)) return false;
  }
  const count = hittingEventCount(data, event);
  if (filters.exactCounts?.length && (!count || !filters.exactCounts.includes(countLabel(count)))) return false;
  if (filters.countGroups?.length && (!count || !filters.countGroups.some((selected) => countMatchesGroup(count, selected)))) return false;
  if (!velocityMatches(event.velocity, filters.pitchVelocityMin, filters.pitchVelocityMax)) return false;
  if (filters.pitchLocationRegions?.length && !filters.pitchLocationRegions.some((region) => pitchLocationMatches(event.pitchLocation, region, { batterHand: data.players.find((player) => player.id === event.hitterId)?.bats }))) return false;
  if (filters.directions?.length && (!event.direction || !filters.directions.includes(directionBucket(event.direction)))) return false;
  return true;
}

function liveBpThrowerSource(session?: { liveBpThrowerSource?: LiveBpThrowerSource; type?: string }): LiveBpThrowerSource {
  if (session?.type === "Live BP") return session.liveBpThrowerSource ?? "PLAYER";
  return session?.liveBpThrowerSource ?? "PLAYER";
}

function pitchEventMatchesFilters(data: AppData, event: PitchEvent, filters?: AnalyticsFilters): boolean {
  if (!filters) return true;
  if (filters.pitchTypes?.length && !filters.pitchTypes.includes(event.pitchType)) return false;
  if (filters.batterHands?.length) {
    const batter = data.players.find((player) => player.id === event.hitterId);
    if (!batter || !filters.batterHands.includes(batter.bats)) return false;
  }
  if (filters.exactCounts?.length && (!event.countBefore || !filters.exactCounts.includes(countLabel(event.countBefore)))) return false;
  if (filters.countGroups?.length && (!event.countBefore || !filters.countGroups.some((selected) => countMatchesGroup(event.countBefore, selected)))) return false;
  if (!velocityMatches(event.velocity, filters.pitchVelocityMin, filters.pitchVelocityMax)) return false;
  if (filters.pitchLocationRegions?.length && !filters.pitchLocationRegions.some((region) => pitchLocationMatches(event.location, region, { pitcherRelative: true, pitcherThrows: data.players.find((player) => player.id === event.pitcherId)?.throws }))) return false;
  return true;
}

function velocityMatches(value: number | undefined, minimum?: number, maximum?: number): boolean {
  if (minimum === undefined && maximum === undefined) return true;
  if (value === undefined) return false;
  return (minimum === undefined || value >= minimum) && (maximum === undefined || value <= maximum);
}

function pitchLocationMatches(
  location: { x: number; y: number } | undefined,
  region: AnalyticsPitchLocationRegion,
  orientation: LocationOrientation = {},
): boolean {
  if (!location) return false;
  if (region.startsWith("pitch_r")) return pitchLocationGridZoneIdForPoint(location) === region;
  if (region === "in_zone") return isAnalyticsZonePoint(location);
  if (region === "out_of_zone") return !isAnalyticsZonePoint(location);
  const vertical = location.y < 0.34 ? "up" : location.y > 0.66 ? "down" : "middle";
  const horizontal = locationHorizontalLabel(location.x, orientation).toLowerCase().replace(" ", "_");
  if (region === "middle") return vertical === "middle" && horizontal === "middle";
  if (region === "up" || region === "down") return vertical === region && horizontal === "middle";
  if (["in", "away", "arm_side", "glove_side"].includes(region)) return horizontal === region && vertical === "middle";
  const [expectedVertical, expectedHorizontal] = region.includes("_and_")
    ? region.split("_and_")
    : region.match(/^(up|down)_(arm_side|glove_side)$/)?.slice(1) ?? [];
  return vertical === expectedVertical && horizontal === expectedHorizontal;
}

function pitchLocationGridZoneIdForPoint(location: { x: number; y: number; zoneId?: string }): PitchLocationGridZoneId {
  if (location.zoneId?.match(/^pitch_r[1-5]c[1-5]$/)) return location.zoneId as PitchLocationGridZoneId;
  const row = Math.min(5, Math.max(1, Math.floor(location.y * 5) + 1));
  const column = Math.min(5, Math.max(1, Math.floor(location.x * 5) + 1));
  return `pitch_r${row}c${column}` as PitchLocationGridZoneId;
}

function locationHorizontalLabel(
  x: number,
  { batterHand, pitcherThrows, pitcherRelative }: LocationOrientation,
): "In" | "Away" | "Arm Side" | "Glove Side" | "Middle" | "Unknown" {
  if (x >= 0.34 && x <= 0.66) return "Middle";
  if (pitcherRelative) {
    if (pitcherThrows !== "R" && pitcherThrows !== "L") return "Unknown";
    const isArmSide = pitcherThrows === "L" ? x > 0.66 : x < 0.34;
    return isArmSide ? "Arm Side" : "Glove Side";
  }
  const isInside = batterHand === "L" ? x > 0.66 : x < 0.34;
  return isInside ? "In" : "Away";
}

type LocationOrientation = {
  batterHand?: "R" | "L" | "S";
  pitcherRelative?: boolean;
  pitcherThrows?: "R" | "L" | "S";
};

function resolveDateRange(_data: AppData, query: AnalyticsQuery, today?: string): AnalyticsDateRange {
  if (query.timeRange === "season") return {};
  if (query.timeRange === "custom") return query.customDateRange ?? {};
  const anchor = today ?? new Date().toISOString().slice(0, 10);
  const end = new Date(`${anchor}T12:00:00`);
  const start = new Date(end);
  start.setDate(start.getDate() - (query.timeRange === "7d" ? 7 : 30));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function weightRoomWindowForRange(timeRange: AnalyticsTimeRange): WeightRoomWindow {
  if (timeRange === "7d") return "This Week";
  if (timeRange === "30d") return "This Month";
  return "This Season";
}

function dateInRange(date: string, range: AnalyticsDateRange): boolean {
  if (range.start && date < range.start) return false;
  if (range.end && date > range.end) return false;
  return true;
}

function filterPracticesByDate(practices: Practice[], range: AnalyticsDateRange, query: AnalyticsQuery): Practice[] {
  return practices.filter((practice) => dateInRange(practice.date, range) && (!query.eventIds?.length || query.eventIds.includes(practice.id)));
}

function buildEventOptions(data: AppData, domain: AnalyticsDomain, source: AnalyticsSource): AnalyticsEventOption[] {
  const practiceOptions = data.practices.map((practice) => ({
    id: practice.id,
    label: `${shortDate(practice.date)} Practice`,
    meta: practice.name,
    date: practice.date,
    source: "practice" as const,
  }));
  const gameOptions = data.games.map((game) => ({
    id: game.id,
    label: `${shortDate(game.date)} vs ${game.opponent}`,
    meta: game.result ? `${game.result} ${game.metrolinaScore}-${game.opponentScore}` : game.location,
    date: game.date,
    source: "games" as const,
  }));
  const liveOptions = [
    ...data.hittingSessions.filter((session) => session.type === "Live BP").map((session) => sessionEventOption(data, session.id, session.practiceId, "Live BP - Hitting")),
    ...data.pitchingSessions.filter((session) => session.type === "Live BP").map((session) => sessionEventOption(data, session.id, session.practiceId, "Live BP - Pitching")),
  ];
  const hittingSessionOptions = domain === "hitting"
    ? data.hittingSessions
      .filter((session) => session.type !== "Live BP")
      .map((session) => sessionEventOption(data, session.id, session.practiceId, `${session.type} Hitting`, "practice"))
    : [];
  const defenseSessionOptions = domain === "defense"
    ? data.defenseSessions.map((session) => sessionEventOption(data, session.id, session.practiceId, `${session.drillContext ?? session.station} Defense`, "practice"))
    : [];
  const sources = source === "all" ? ["games", "practice", "live-bp"] : [source];
  return [
    ...(sources.includes("games") ? gameOptions : []),
    ...(sources.includes("practice") ? [...practiceOptions, ...hittingSessionOptions, ...defenseSessionOptions] : []),
    ...(sources.includes("live-bp") ? liveOptions : []),
  ]
    .filter((event) => domain !== "defense" || event.source !== "games")
    .sort((left, right) => (right.date ?? "").localeCompare(left.date ?? ""));
}

function sessionEventOption(data: AppData, id: ID, practiceId: ID, labelPrefix: string, source: AnalyticsEventOption["source"] = "live-bp"): AnalyticsEventOption {
  const practice = data.practices.find((item) => item.id === practiceId);
  return {
    id,
    label: `${practice ? shortDate(practice.date) : "Session"} ${labelPrefix}`,
    meta: practice?.name,
    date: practice?.date,
    source,
  };
}

function availableFilterDefinitions(data: AppData, query: AnalyticsQuery): AnalyticsFilterDefinition[] {
  return ANALYTICS_FILTERS
    .filter((filterItem) => filterItem.domains.includes(query.domain) && filterItem.supportedSources.includes(query.source))
    .map((filterItem) => {
      if (filterItem.dynamicOptions === "opponents") {
        const opponents = [...new Set(data.games.map((game) => game.opponent).filter(Boolean))].sort();
        return { ...filterItem, options: opponents.map((value) => ({ value, label: value })) };
      }
      if (filterItem.dynamicOptions === "innings") {
        const innings = [...new Set(data.gameEvents.map((event) => event.inning))].sort((left, right) => left - right);
        return { ...filterItem, options: innings.map((value) => ({ value: String(value), label: `${ordinal(value)} Inning` })) };
      }
      return filterItem;
    });
}

function normalizeAnalyticsQuery(query: AnalyticsQuery): AnalyticsQuery {
  const source = query.domain === "development" ? "all" : query.source;
  const mode = query.domain === "development" ? "box-score" : query.mode;
  const sort = query.sort ?? defaultAnalyticsSort(query.domain, source, mode);
  return {
    ...query,
    source,
    mode,
    view: normalizeAnalyticsView(query.domain, source, query.view),
    groupBy: "player",
    sort,
    filters: query.filters ?? {},
    playerIds: query.playerIds?.length ? [...new Set(query.playerIds)] : undefined,
  };
}

function validateAnalyticsContext(data: AppData, query: AnalyticsQuery): string[] {
  const warnings: string[] = [];
  const current = data.teamContext?.currentTeam;
  if (!current) return warnings;
  if (query.context?.teamId && query.context.teamId !== current.teamId) warnings.push("Analytics query was scoped back to the currently selected team.");
  if (query.context?.seasonId && current.seasonId && query.context.seasonId !== current.seasonId) warnings.push("Analytics query was scoped back to the currently selected season.");
  return warnings;
}

function sortAnalyticsRows(rows: AnalyticsRow[], columns: AnalyticsColumn[], query: AnalyticsQuery): AnalyticsRow[] {
  const sort = query.sort ?? defaultAnalyticsSort(query.domain, query.source, query.mode) ?? { metricId: "player", direction: "asc" as const };
  const direction = sort.direction === "asc" ? 1 : -1;
  const isColumn = columns.some((column) => column.metricId === sort.metricId);
  return rows.slice().sort((left, right) => {
    if (sort.metricId === "player" || !isColumn) return (left.player.jerseyNumber - right.player.jerseyNumber) || left.player.name.localeCompare(right.player.name);
    const comparison = compareCell(left.cells[sort.metricId], right.cells[sort.metricId]);
    if (comparison !== 0) return comparison * direction;
    return (left.player.jerseyNumber - right.player.jerseyNumber) || left.player.name.localeCompare(right.player.name);
  });
}

function compareCell(left?: AnalyticsCell, right?: AnalyticsCell): number {
  const leftValue = left?.sortValue ?? left?.value;
  const rightValue = right?.sortValue ?? right?.value;
  if (typeof leftValue === "number" && typeof rightValue === "number") return leftValue - rightValue;
  if (typeof leftValue === "string" && typeof rightValue === "string") return leftValue.localeCompare(rightValue);
  if (leftValue === undefined) return rightValue === undefined ? 0 : -1;
  if (rightValue === undefined) return 1;
  return 0;
}

function makeRow(player: Player, cells: Record<string, AnalyticsCell>): AnalyticsRow {
  return {
    player,
    cells,
    sampleCount: Object.values(cells).reduce((max, item) => Math.max(max, item.sample?.denominator ?? (typeof item.value === "number" ? Number(item.value > 0) : 0)), 0),
  };
}

function cell(display: string, value: number | string | undefined, kind: AnalyticsValueKind, sample?: AnalyticsCell["sample"]): AnalyticsCell {
  return { metricId: "", display, value, sortValue: value, kind, sample };
}

function cellFromNumber(value: number | undefined, format: AnalyticsMetricFormat, kind: AnalyticsValueKind = "available", sample?: AnalyticsCell["sample"]): AnalyticsCell {
  return { metricId: "", value, display: formatAnalyticsValue(value, format), sortValue: value, kind: value === undefined ? "not-tracked" : kind, sample };
}

function countCell(value: number, sample: number): AnalyticsCell {
  return sample ? cellFromNumber(value, "integer", "available", { denominator: sample }) : cell("—", undefined, "not-tracked");
}

function rateCell(numerator: number, denominator: number, label: string, minSample = 1): AnalyticsCell {
  if (!denominator) return cell("—", undefined, "not-tracked");
  const value = (numerator / denominator) * 100;
  return cellFromNumber(value, "percentage", denominator < minSample ? "insufficient-sample" : "available", { numerator, denominator, label });
}

function decimalRateCell(numerator: number, denominator: number, label: string, minSample = 1): AnalyticsCell {
  if (!denominator) return cell("—", undefined, "not-tracked");
  return cellFromNumber(numerator / denominator, "decimal", denominator < minSample ? "insufficient-sample" : "available", { numerator, denominator, label });
}

function averageCell(values: number[], format: AnalyticsMetricFormat, minSample: number): AnalyticsCell {
  if (!values.length) return cell("—", undefined, "not-tracked");
  return cellFromNumber(average(values), format, values.length < minSample ? "insufficient-sample" : "available", { denominator: values.length, label: "samples" });
}

function maxCell(values: number[], format: AnalyticsMetricFormat): AnalyticsCell {
  if (!values.length) return cell("—", undefined, "not-tracked");
  return cellFromNumber(Math.max(...values), format, "available", { denominator: values.length, label: "samples" });
}

function minCell(values: number[], format: AnalyticsMetricFormat): AnalyticsCell {
  if (!values.length) return cell("—", undefined, "not-tracked");
  return cellFromNumber(Math.min(...values), format, "available", { denominator: values.length, label: "samples" });
}

function percentileCell(values: number[], percentile: number, format: AnalyticsMetricFormat, minSample: number): AnalyticsCell {
  if (!values.length) return cell("—", undefined, "not-tracked");
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(percentile * sorted.length) - 1));
  return cellFromNumber(sorted[index], format, values.length < minSample ? "insufficient-sample" : "available", { denominator: values.length, label: "samples" });
}

function spreadCell(values: number[], format: AnalyticsMetricFormat, minSample: number): AnalyticsCell {
  if (!values.length) return cell("—", undefined, "not-tracked");
  return cellFromNumber(Math.max(...values) - Math.min(...values), format, values.length < minSample ? "insufficient-sample" : "available", { denominator: values.length, label: "samples" });
}

function sampleText(cellItem?: AnalyticsCell): string | undefined {
  if (!cellItem?.sample) return undefined;
  const { numerator, denominator, label } = cellItem.sample;
  if (typeof numerator === "number" && typeof denominator === "number") return `${numerator}/${denominator}${label ? ` ${label}` : ""}`;
  if (typeof denominator === "number" && label) return `${denominator} ${label}`;
  if (typeof denominator === "number") return `${denominator} tracked`;
  return undefined;
}

function numericCell(row: AnalyticsRow, metricId: string): number {
  const value = row.cells[metricId]?.value;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function currentRosterPlayers(data: AppData): Player[] {
  const current = data.teamContext?.currentTeam;
  const memberships = data.playerTeamMemberships ?? [];
  if (current && memberships.length) {
    const eligibleIds = new Set(
      memberships
        .filter((membership) => membership.active && membership.teamId === current.teamId && (!current.seasonId || !membership.seasonId || membership.seasonId === current.seasonId))
        .map((membership) => membership.playerId),
    );
    return data.players.filter((player) => !player.archived && player.rosterStatus !== "Cut" && eligibleIds.has(player.id));
  }
  return data.players.filter((player) => !player.archived && player.rosterStatus !== "Cut");
}

function currentRosterPlayerIdSet(data: AppData): Set<ID> {
  return new Set(currentRosterPlayers(data).map((player) => player.id));
}

function teamPlayer(data: AppData): Player {
  return {
    id: "team-total",
    name: "TEAM",
    jerseyNumber: 0,
    primaryPosition: "UTL",
    bats: "R",
    throws: "R",
    graduationYear: 0,
    avatarColor: "neutral",
    isPitcher: true,
    isHitter: true,
    createdAt: "",
    updatedAt: "",
    notes: data.teamContext?.currentTeam?.teamName,
  };
}

function practicePitchSample(event: PitchEvent) {
  return {
    isStrike: event.isStrike,
    isSwing: event.isSwing,
    isZone: event.isZone,
    hasLocation: Boolean(event.location),
    isWhiff: Boolean(event.isWhiff || event.outcome === "Whiff"),
    isCalledStrike: Boolean(event.isCalledStrike || event.outcome === "Called Strike"),
    isContact: event.outcome === "Foul" || event.outcome === "Ball in play",
    velocity: event.velocity,
    countBefore: event.countBefore,
  };
}

function gamePitchSample(event: GameEvent) {
  return {
    isStrike: event.pitchOutcome !== "Ball",
    isSwing: event.pitchOutcome === "Swinging Strike" || event.pitchOutcome === "Foul" || event.pitchOutcome === "In Play",
    isZone: isAnalyticsZonePoint(event.location),
    hasLocation: Boolean(event.location),
    isWhiff: event.pitchOutcome === "Swinging Strike",
    isCalledStrike: event.pitchOutcome === "Called Strike",
    isContact: event.pitchOutcome === "Foul" || event.pitchOutcome === "In Play",
    velocity: event.velocity,
    countBefore: event.countBefore,
  };
}

function isHittingSwing(event: HittingEvent): boolean {
  return event.action !== "Took pitch";
}

function isHittingContact(event: HittingEvent): boolean {
  return event.action === "Foul" || event.action === "Ball in play";
}

function isAnalyticsZonePoint(location: unknown): boolean {
  if (!location || typeof location !== "object") return false;
  const point = location as { x?: unknown; y?: unknown; isZone?: unknown; zoneId?: unknown };
  if (typeof point.zoneId === "string") {
    const modernGrid = point.zoneId.match(/^pitch_r([1-5])c([1-5])$/);
    if (modernGrid) {
      const row = Number(modernGrid[1]);
      const column = Number(modernGrid[2]);
      return row >= 2 && row <= 4 && column >= 2 && column <= 4;
    }
    if (point.zoneId.startsWith("zone_")) return true;
    if (point.zoneId.startsWith("outside_")) return false;
  }
  if (typeof point.isZone === "boolean") return point.isZone;
  if (typeof point.x !== "number" || typeof point.y !== "number") return false;
  return point.x >= 0.22 && point.x <= 0.78 && point.y >= 0.18 && point.y <= 0.82;
}

function countGroup(count?: { balls: number; strikes: number }): "ahead" | "even" | "behind" | "two-strike" | undefined {
  if (!count) return undefined;
  if (count.strikes >= 2) return "two-strike";
  if (count.balls > count.strikes) return "ahead";
  if (count.strikes > count.balls) return "behind";
  return "even";
}

function countMatchesGroup(count: { balls: number; strikes: number } | undefined, group: AnalyticsCountGroup): boolean {
  if (!count) return false;
  if (group === "first-pitch") return count.balls === 0 && count.strikes === 0;
  if (group === "full-count") return count.balls === 3 && count.strikes === 2;
  return countGroup(count) === group;
}

function countLabel(count: { balls: number; strikes: number }): string {
  return `${count.balls}-${count.strikes}`;
}

function hittingEventCount(data: AppData, event: HittingEvent): { balls: number; strikes: number } | undefined {
  if (!event.plateAppearanceId) return undefined;
  const linked = data.pitchEvents
    .filter((pitch) => pitch.plateAppearanceId === event.plateAppearanceId)
    .sort((left, right) => Math.abs(new Date(left.createdAt).getTime() - new Date(event.createdAt).getTime()) - Math.abs(new Date(right.createdAt).getTime() - new Date(event.createdAt).getTime()))[0];
  return linked?.countBefore;
}

function gameStateForEvent(event: GameEvent): AnalyticsGameState {
  if (event.metrolinaRunsBefore > event.opponentRunsBefore) return "winning";
  if (event.metrolinaRunsBefore < event.opponentRunsBefore) return "losing";
  return "tied";
}

function runnerStateMatches(event: GameEvent, state: AnalyticsRunnerState): boolean {
  const runners = event.runnersBefore ?? event.stateBefore?.runners ?? {};
  const occupied = Boolean(runners.first || runners.second || runners.third);
  if (state === "bases-empty") return !occupied;
  if (state === "runners-on") return occupied;
  return Boolean(runners.second || runners.third);
}

function gameContactTypeToBattedBall(value?: string): BattedBallType | undefined {
  if (value === "Ground Ball") return "Ground ball";
  if (value === "Line Drive") return "Line drive";
  if (value === "Fly Ball") return "Fly ball";
  if (value === "Pop Up") return "Pop up";
  return undefined;
}

function directionBucket(direction?: Direction): "Pull" | "Middle" | "Opposite" {
  if (direction === "Pull" || direction === "Pull-center" || direction === "3B side") return "Pull";
  if (direction === "Opposite" || direction === "Opposite-center" || direction === "1B side") return "Opposite";
  return "Middle";
}

function ordinal(value: number): string {
  const remainder100 = value % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
}

function buildScopeLabel(data: AppData, query: AnalyticsQuery): string {
  const team = data.teamContext?.currentTeam;
  const range = query.timeRange === "season"
    ? team?.seasonName ?? "Season"
    : query.timeRange === "7d"
      ? "Last 7 days"
      : query.timeRange === "30d"
        ? "Last 30 days"
        : "Custom";
  return `${range} · ${sourceLabels[query.source]}`;
}

function askQuestion(id: string, label: string, domain: AnalyticsDomain, rankingMetricId: string, criteria: string, query: Omit<AnalyticsQuery, "context">): AskClubhouseQuestion {
  return { id, label, domain, rankingMetricId, criteria, query };
}

function average(values: number[]): number | undefined {
  if (!values.length) return undefined;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function shortDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${date}T12:00:00`));
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function mostCommonString(values: string[]): string | undefined {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0];
}

const sourceLabels: Record<AnalyticsSource, string> = {
  all: "All",
  games: "Games",
  practice: "Practice",
  "live-bp": "Live BP",
};

const hitOutcomes = new Set<GameBallInPlayOutcome>(["Single", "Double", "Triple", "Home Run"]);
const gameAtBatOutcomes = new Set<GameBallInPlayOutcome>(["Single", "Double", "Triple", "Home Run", "Ground Out", "Fly Out", "Line Out", "Pop Out", "Error", "Fielder's Choice"]);

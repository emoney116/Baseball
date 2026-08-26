import type {
  AppData,
  BattedBallType,
  DefenseEvent,
  GameBallInPlayOutcome,
  GameEvent,
  HittingEvent,
  ID,
  LiveBpThrowerSource,
  PitchEvent,
  PitchType,
  Player,
  Practice,
} from "../types";
import { isPracticeHardContactEvent } from "./hittingTaxonomy.ts";
import { buildWeightRoomScoreRows, type WeightRoomWindow } from "./weightRoom.ts";

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
  countGroups?: Array<"ahead" | "even" | "behind" | "two-strike">;
  drillTypes?: string[];
  liveBpThrowerSources?: LiveBpThrowerSource[];
  battedBallTypes?: BattedBallType[];
  defenseStations?: string[];
}

export interface AnalyticsQuery {
  domain: AnalyticsDomain;
  source: AnalyticsSource;
  mode: AnalyticsMode;
  timeRange: AnalyticsTimeRange;
  developmentView?: AnalyticsDevelopmentView;
  customDateRange?: AnalyticsDateRange;
  eventIds?: ID[];
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
  domain: AnalyticsDomain;
  format: AnalyticsMetricFormat;
  supportedSources: AnalyticsSource[];
  minimumSample?: number;
  sortable: boolean;
  situationalSupport: boolean;
  definition: string;
}

export interface AnalyticsFilterDefinition {
  id: keyof AnalyticsFilters;
  label: string;
  domain: AnalyticsDomain;
  supportedSources: AnalyticsSource[];
  type: "multi-select";
  options: Array<{ value: string; label: string }>;
  availability: AnalyticsFilterAvailability;
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
  hittingSwings: 12,
  hittingBallsInPlay: 8,
  exitVelocitySamples: 3,
  pitchingPitches: 18,
  defenseReps: 8,
  weightRoomWorkouts: 1,
} as const;

export const ANALYTICS_METRICS: AnalyticsMetricDefinition[] = [
  metric("opportunities", "Opp", "hitting", "integer", ["all", "practice", "live-bp"], "Tracked pitches/opportunities in compatible hitting contexts.", true, true),
  metric("takes", "Takes", "hitting", "integer", ["all", "practice", "live-bp"], "Taken pitches in compatible hitting contexts.", true, true),
  metric("swings", "Swings", "hitting", "integer", ["all", "practice", "live-bp"], "Swings logged in practice or Live BP.", true, true),
  metric("contacts", "Contact", "hitting", "integer", ["all", "practice", "live-bp"], "Fouls plus balls in play.", true, true),
  metric("bip", "BIP", "hitting", "integer", ["all", "practice", "live-bp"], "Balls put in play.", true, true),
  metric("misses", "Miss", "hitting", "integer", ["all", "practice", "live-bp"], "Swing-and-miss results.", true, true),
  metric("fouls", "Foul", "hitting", "integer", ["all", "practice", "live-bp"], "Foul balls.", true, true),
  metric("contactPct", "Contact %", "hitting", "percentage", ["all", "practice", "live-bp"], "Balls in play plus fouls divided by swings.", true, true, ANALYTICS_SAMPLE_THRESHOLDS.hittingSwings),
  metric("swingMissPct", "Whiff %", "hitting", "percentage", ["all", "practice", "live-bp"], "Misses divided by swings.", true, true, ANALYTICS_SAMPLE_THRESHOLDS.hittingSwings),
  metric("takePct", "Take %", "hitting", "percentage", ["all", "practice", "live-bp"], "Taken pitches divided by tracked opportunities.", true, true),
  metric("hard", "Hard", "hitting", "integer", ["all", "practice", "live-bp"], "Explicit hard-contact balls in play.", true, true),
  metric("hardPct", "Hard %", "hitting", "percentage", ["all", "practice", "live-bp"], "Explicit hard-contact outcomes divided by balls in play.", true, true, ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
  metric("barrelPct", "Impact %", "hitting", "percentage", ["all", "practice", "live-bp"], "Legacy barrel/impact-quality contact divided by balls in play. This is not a true barrel calculation.", true, true, ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
  metric("lineDrivePct", "LD %", "hitting", "percentage", ["all", "practice", "live-bp"], "Line drives divided by balls in play.", true, true, ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
  metric("groundBallPct", "GB %", "hitting", "percentage", ["all", "practice", "live-bp"], "Ground balls divided by balls in play.", true, true, ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
  metric("flyBallPct", "FB %", "hitting", "percentage", ["all", "practice", "live-bp"], "Fly balls divided by balls in play.", true, true, ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
  metric("avgEv", "Avg EV", "hitting", "ev", ["all", "practice", "live-bp"], "Average exit velocity from recorded EV samples only.", true, true, ANALYTICS_SAMPLE_THRESHOLDS.exitVelocitySamples),
  metric("maxEv", "Max EV", "hitting", "ev", ["all", "practice", "live-bp"], "Highest recorded exit velocity in the selected scope.", true, true, 1),
  metric("evSamples", "EV", "hitting", "integer", ["all", "practice", "live-bp"], "Count of swings with recorded exit velocity.", true, true),
  metric("trackedBip", "BIP", "hitting", "integer", ["games"], "Logged game balls in play. Current game tracking does not yet preserve every plate appearance.", true, false),
  metric("ab", "AB", "hitting", "integer", ["games"], "Supported at-bat outcomes from logged game balls in play.", true, false),
  metric("hits", "H", "hitting", "integer", ["games"], "Hits from logged game balls in play.", true, false),
  metric("singles", "1B", "hitting", "integer", ["games"], "Singles from logged game balls in play.", true, false),
  metric("doubles", "2B", "hitting", "integer", ["games"], "Doubles from logged game balls in play.", true, false),
  metric("triples", "3B", "hitting", "integer", ["games"], "Triples from logged game balls in play.", true, false),
  metric("homeRuns", "HR", "hitting", "integer", ["games"], "Home runs from logged game balls in play.", true, false),
  metric("outs", "Outs", "hitting", "integer", ["games"], "Tracked at-bat outs from logged game balls in play.", true, false),
  metric("xbh", "XBH", "hitting", "integer", ["games"], "Extra-base hits from logged game balls in play.", true, false),
  metric("totalBases", "TB", "hitting", "integer", ["games"], "Total bases from logged game balls in play.", true, false),
  metric("avg", "AVG", "hitting", "decimal", ["games"], "Hits divided by supported at-bats from logged game balls in play.", true, false),
  metric("slg", "SLG", "hitting", "decimal", ["games"], "Total bases divided by supported at-bats from logged game balls in play.", true, false),
  metric("iso", "ISO", "hitting", "decimal", ["games"], "Slugging percentage minus batting average from supported at-bats.", true, false),
  metric("babip", "BABIP", "hitting", "decimal", ["games"], "Hits excluding home runs divided by tracked balls in play excluding home runs.", true, false),
  metric("pitches", "Pitches", "pitching", "integer", ["all", "practice", "live-bp", "games"], "Logged pitches in the selected scope.", true, true),
  metric("strikePct", "Strike %", "pitching", "percentage", ["all", "practice", "live-bp", "games"], "Strikes divided by total pitches.", true, true, ANALYTICS_SAMPLE_THRESHOLDS.pitchingPitches),
  metric("whiffPct", "Whiff %", "pitching", "percentage", ["all", "practice", "live-bp", "games"], "Whiffs divided by swings.", true, true, ANALYTICS_SAMPLE_THRESHOLDS.pitchingPitches),
  metric("cswPct", "CSW %", "pitching", "percentage", ["all", "practice", "live-bp", "games"], "Called strikes plus whiffs divided by total pitches.", true, true, ANALYTICS_SAMPLE_THRESHOLDS.pitchingPitches),
  metric("avgPitchVelo", "Avg Pitch Velo", "pitching", "velocity", ["all", "practice", "live-bp", "games"], "Average recorded pitch velocity.", true, true, 3),
  metric("maxPitchVelo", "Max Pitch Velo", "pitching", "velocity", ["all", "practice", "live-bp", "games"], "Highest recorded pitch velocity.", true, true, 1),
  metric("reps", "Reps", "defense", "integer", ["all", "practice"], "Logged defensive reps.", true, true),
  metric("cleanPct", "Clean %", "defense", "percentage", ["all", "practice"], "Clean, good, or great defensive reps divided by total reps.", true, true, ANALYTICS_SAMPLE_THRESHOLDS.defenseReps),
  metric("errors", "Errors", "defense", "integer", ["all", "practice"], "Logged defensive errors.", true, true),
  metric("greatPlays", "Great Plays", "defense", "integer", ["all", "practice"], "Logged great plays.", true, true),
  metric("weightScore", "Weight Room Score", "development", "integer", ["all"], "Existing Weight Room Development score. This is not a total baseball development score.", true, false, ANALYTICS_SAMPLE_THRESHOLDS.weightRoomWorkouts),
  metric("workouts", "Workouts", "development", "integer", ["all"], "Completed workout sessions.", true, false),
  metric("workoutCompletionPct", "Workout Completion", "development", "percentage", ["all"], "Completed workouts divided by assigned workout sessions.", true, false),
  metric("attendancePct", "Attendance", "development", "percentage", ["all"], "Present or late attendance divided by practices in the selected scope.", true, false),
  metric("practiceReps", "Practice Reps", "development", "integer", ["all"], "Tracked hitting swings, pitches, and defensive reps.", true, false),
];

export const ANALYTICS_FILTERS: AnalyticsFilterDefinition[] = [
  {
    id: "pitcherHands",
    label: "Pitcher Hand",
    domain: "hitting",
    supportedSources: ["all", "practice", "live-bp"],
    type: "multi-select",
    options: handednessOptions(),
    availability: "partial",
  },
  {
    id: "batterHands",
    label: "Batter Hand",
    domain: "pitching",
    supportedSources: ["all", "practice", "live-bp", "games"],
    type: "multi-select",
    options: handednessOptions(),
    availability: "supported",
  },
  {
    id: "pitchTypes",
    label: "Pitch Type",
    domain: "hitting",
    supportedSources: ["all", "practice", "live-bp", "games"],
    type: "multi-select",
    options: ["4-Seam", "2-Seam", "Sinker", "Cutter", "Slider", "Curveball", "Changeup", "Splitter", "Knuckleball", "Other"].map((value) => ({ value, label: value })),
    availability: "supported",
  },
  {
    id: "pitchTypes",
    label: "Pitch Type",
    domain: "pitching",
    supportedSources: ["all", "practice", "live-bp", "games"],
    type: "multi-select",
    options: ["4-Seam", "2-Seam", "Sinker", "Cutter", "Slider", "Curveball", "Changeup", "Splitter", "Knuckleball", "Other"].map((value) => ({ value, label: value })),
    availability: "supported",
  },
  {
    id: "countGroups",
    label: "Count",
    domain: "pitching",
    supportedSources: ["all", "practice", "live-bp"],
    type: "multi-select",
    options: [
      { value: "ahead", label: "Ahead" },
      { value: "even", label: "Even" },
      { value: "behind", label: "Behind" },
      { value: "two-strike", label: "Two Strike" },
    ],
    availability: "supported",
  },
  {
    id: "drillTypes",
    label: "Drill",
    domain: "hitting",
    supportedSources: ["practice", "live-bp"],
    type: "multi-select",
    options: ["Tee", "Front Toss", "Machine", "Coach BP", "Other"].map((value) => ({ value, label: value })),
    availability: "supported",
  },
  {
    id: "liveBpThrowerSources",
    label: "Thrower",
    domain: "hitting",
    supportedSources: ["all", "live-bp"],
    type: "multi-select",
    options: [
      { value: "PLAYER", label: "Player" },
      { value: "COACH", label: "Coach" },
      { value: "MACHINE", label: "Machine" },
    ],
    availability: "partial",
  },
  {
    id: "liveBpThrowerSources",
    label: "Thrower",
    domain: "pitching",
    supportedSources: ["all", "live-bp"],
    type: "multi-select",
    options: [
      { value: "PLAYER", label: "Player" },
      { value: "COACH", label: "Coach" },
      { value: "MACHINE", label: "Machine" },
    ],
    availability: "supported",
  },
  {
    id: "battedBallTypes",
    label: "Batted Ball",
    domain: "hitting",
    supportedSources: ["all", "practice", "live-bp"],
    type: "multi-select",
    options: ["Ground ball", "Line drive", "Fly ball", "Pop up"].map((value) => ({ value, label: value })),
    availability: "supported",
  },
  {
    id: "defenseStations",
    label: "Position / Station",
    domain: "defense",
    supportedSources: ["all", "practice"],
    type: "multi-select",
    options: ["Infield", "Outfield", "Catching", "PFP", "Situational defense", "Team defense"].map((value) => ({ value, label: value })),
    availability: "supported",
  },
];

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
  askQuestion("highest-csw", "Which pitchers have the highest CSW %?", "pitching", "cswPct", "CSW %, minimum 18 pitches", {
    domain: "pitching",
    source: "all",
    mode: "box-score",
    timeRange: "season",
    groupBy: "player",
    sort: { metricId: "cswPct", direction: "desc" },
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
  const filterDefinitions = availableFilterDefinitions(query);

  const result = query.domain === "hitting"
    ? buildHittingResult(data, query, warnings, availableEvents, filterDefinitions, scopeLabel, sourceLabel, options.today)
    : query.domain === "pitching"
      ? buildPitchingResult(data, query, warnings, availableEvents, filterDefinitions, scopeLabel, sourceLabel, options.today)
      : query.domain === "defense"
        ? buildDefenseResult(data, query, warnings, availableEvents, filterDefinitions, scopeLabel, sourceLabel, options.today)
        : buildDevelopmentResult(data, query, warnings, availableEvents, filterDefinitions, scopeLabel, sourceLabel, options.today);

  return {
    ...result,
    rows: sortAnalyticsRows(result.rows, result.columns, query).slice(0, query.limit ?? result.rows.length),
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
    warnings.push("Game hitting currently uses logged game balls in play only; walks, strikeouts, and complete PA totals are not yet tracked as terminal game outcomes.");
    const gameEvents = filterGameEvents(data, query, today);
    const rows = currentRosterPlayers(data).map((player) => gameHittingRow(player, gameEvents.filter((event) => event.batterId === player.id)));
    const teamTotals = gameHittingTeamRow(data, gameEvents);
    return assembleResult("Team Hitting", data, query, sourceLabel, rows, teamTotals, ["trackedBip", "ab", "hits", "singles", "doubles", "triples", "homeRuns", "outs", "xbh", "totalBases", "avg", "slg", "iso", "babip"], warnings, availableEvents, filterDefinitions, scopeLabel);
  }

  const events = filterHittingEvents(data, query, today);
  const rows = currentRosterPlayers(data).map((player) => hittingRow(player, events.filter((event) => event.hitterId === player.id)));
  const teamTotals = hittingTeamRow(data, events);
  const columns = ["opportunities", "takes", "swings", "contacts", "bip", "misses", "fouls", "contactPct", "swingMissPct", "hard", "hardPct", "barrelPct", "lineDrivePct", "groundBallPct", "flyBallPct", "takePct", "avgEv", "maxEv", "evSamples"];
  if (query.source === "all") warnings.push("Hitting All combines compatible practice and Live BP swing-event metrics. Traditional game batting appears in the Games source until full PA results are tracked.");
  return assembleResult("Team Hitting", data, query, sourceLabel, rows, teamTotals, columns, warnings, availableEvents, filterDefinitions, scopeLabel);
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
  return assembleResult("Team Pitching", data, query, sourceLabel, rows, teamTotals, ["pitches", "strikePct", "whiffPct", "cswPct", "avgPitchVelo", "maxPitchVelo"], warnings, availableEvents, filterDefinitions, scopeLabel);
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
  if (query.source === "games" || query.source === "live-bp") warnings.push("Defense V1 is currently powered by practice defensive reps. Game defensive box score stats are documented as a future tracking gap.");
  const events = filterDefenseEvents(data, { ...query, source: query.source === "games" || query.source === "live-bp" ? "practice" : query.source }, today);
  const rows = currentRosterPlayers(data).map((player) => defenseRow(player, events.filter((event) => event.playerId === player.id)));
  const teamTotals = defenseTeamRow(data, events);
  return assembleResult("Team Defense", data, query, sourceLabel, rows, teamTotals, ["reps", "cleanPct", "errors", "greatPlays"], warnings, availableEvents, filterDefinitions, scopeLabel);
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
  const selectedMetrics = query.metrics?.length ? new Set(query.metrics) : undefined;
  const columns = selectedMetrics ? availableColumns.filter((column) => selectedMetrics.has(column.metricId)) : availableColumns;
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
  return makeRow(player, {
    opportunities: countCell(events.length, events.length),
    takes: countCell(takes, events.length),
    swings: countCell(swings, events.length),
    contacts: countCell(contacts, swings),
    bip: countCell(ballsInPlay, events.length),
    misses: countCell(misses, swings),
    fouls: countCell(fouls, swings),
    contactPct: rateCell(contacts, swings, "contact", ANALYTICS_SAMPLE_THRESHOLDS.hittingSwings),
    swingMissPct: rateCell(misses, swings, "misses", ANALYTICS_SAMPLE_THRESHOLDS.hittingSwings),
    takePct: rateCell(takes, events.length, "takes"),
    hard: countCell(hard, ballsInPlay),
    hardPct: rateCell(hard, ballsInPlay, "hard contact", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
    barrelPct: rateCell(barrels, ballsInPlay, "impact contact", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
    lineDrivePct: rateCell(events.filter((event) => event.contactResult === "Line drive").length, ballsInPlay, "line drives", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
    groundBallPct: rateCell(events.filter((event) => event.contactResult === "Ground ball").length, ballsInPlay, "ground balls", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
    flyBallPct: rateCell(events.filter((event) => event.contactResult === "Fly ball").length, ballsInPlay, "fly balls", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
    avgEv: averageCell(evs, "ev", ANALYTICS_SAMPLE_THRESHOLDS.exitVelocitySamples),
    maxEv: maxCell(evs, "ev"),
    evSamples: countCell(evs.length, evs.length),
  });
}

function hittingTeamRow(data: AppData, events: HittingEvent[]): AnalyticsRow {
  const eligibleIds = currentRosterPlayerIdSet(data);
  return hittingRow(teamPlayer(data), events.filter((event) => eligibleIds.has(event.hitterId)));
}

function gameHittingRow(player: Player, events: GameEvent[]): AnalyticsRow {
  const bip = events.filter((event) => event.ballInPlayOutcome);
  const atBats = bip.filter((event) => event.ballInPlayOutcome && gameAtBatOutcomes.has(event.ballInPlayOutcome)).length;
  const hits = bip.filter((event) => event.ballInPlayOutcome && hitOutcomes.has(event.ballInPlayOutcome)).length;
  const doubles = bip.filter((event) => event.ballInPlayOutcome === "Double").length;
  const triples = bip.filter((event) => event.ballInPlayOutcome === "Triple").length;
  const homeRuns = bip.filter((event) => event.ballInPlayOutcome === "Home Run").length;
  const singles = bip.filter((event) => event.ballInPlayOutcome === "Single").length;
  const outs = Math.max(0, atBats - hits);
  const xbh = doubles + triples + homeRuns;
  const totalBases = hits + doubles + triples * 2 + homeRuns * 3;
  const babipDenominator = Math.max(0, bip.length - homeRuns);
  return makeRow(player, {
    trackedBip: countCell(bip.length, bip.length),
    ab: countCell(atBats, bip.length),
    hits: countCell(hits, bip.length),
    singles: countCell(singles, bip.length),
    doubles: countCell(doubles, bip.length),
    triples: countCell(triples, bip.length),
    homeRuns: countCell(homeRuns, bip.length),
    outs: countCell(outs, bip.length),
    xbh: countCell(xbh, bip.length),
    totalBases: countCell(totalBases, bip.length),
    avg: decimalRateCell(hits, atBats, "AVG"),
    slg: decimalRateCell(totalBases, atBats, "SLG"),
    iso: decimalRateCell(totalBases - hits, atBats, "ISO"),
    babip: decimalRateCell(hits - homeRuns, babipDenominator, "BABIP"),
  });
}

function gameHittingTeamRow(data: AppData, events: GameEvent[]): AnalyticsRow {
  const eligibleIds = currentRosterPlayerIdSet(data);
  return gameHittingRow(teamPlayer(data), events.filter((event) => event.batterId ? eligibleIds.has(event.batterId) : false));
}

function pitchingRow(player: Player, pitchEvents: PitchEvent[], gameEvents: GameEvent[]): AnalyticsRow {
  const pitches = [
    ...pitchEvents.map(practicePitchSample),
    ...gameEvents.map(gamePitchSample),
  ];
  const swings = pitches.filter((pitch) => pitch.isSwing).length;
  const whiffs = pitches.filter((pitch) => pitch.isWhiff).length;
  const velocities = pitches.map((pitch) => pitch.velocity).filter(isNumber);
  return makeRow(player, {
    pitches: countCell(pitches.length, pitches.length),
    strikePct: rateCell(pitches.filter((pitch) => pitch.isStrike).length, pitches.length, "strikes", ANALYTICS_SAMPLE_THRESHOLDS.pitchingPitches),
    whiffPct: rateCell(whiffs, swings, "whiffs", ANALYTICS_SAMPLE_THRESHOLDS.pitchingPitches),
    cswPct: rateCell(pitches.filter((pitch) => pitch.isCalledStrike || pitch.isWhiff).length, pitches.length, "CSW", ANALYTICS_SAMPLE_THRESHOLDS.pitchingPitches),
    avgPitchVelo: averageCell(velocities, "velocity", 3),
    maxPitchVelo: maxCell(velocities, "velocity"),
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
  const clean = events.filter((event) => event.outcome !== "Error" && event.outcome !== "Missed Rep").length;
  return makeRow(player, {
    reps: countCell(events.length, events.length),
    cleanPct: rateCell(clean, events.length, "clean reps", ANALYTICS_SAMPLE_THRESHOLDS.defenseReps),
    errors: countCell(events.filter((event) => event.outcome === "Error").length, events.length),
    greatPlays: countCell(events.filter((event) => event.outcome === "Great Play").length, events.length),
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
        ? ["pitches", "strikePct", "cswPct", "avgPitchVelo"]
        : query.domain === "defense"
          ? ["reps", "cleanPct", "errors"]
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
      ? ["strikePct", "cswPct", "avgPitchVelo"]
      : query.domain === "defense"
        ? ["cleanPct", "greatPlays"]
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
    return true;
  });
}

function filterGameEvents(data: AppData, query: AnalyticsQuery, today?: string): GameEvent[] {
  const dateRange = resolveDateRange(data, query, today);
  const games = new Map(data.games.map((game) => [game.id, game]));
  return data.gameEvents.filter((event) => {
    const game = games.get(event.gameId);
    if (!game || !dateInRange(game.date, dateRange)) return false;
    if (query.eventIds?.length && !query.eventIds.includes(game.id)) return false;
    if (query.domain === "hitting" && query.filters?.pitchTypes?.length && (!event.pitchType || !query.filters.pitchTypes.includes(event.pitchType))) return false;
    if (query.domain === "pitching" && query.filters?.pitchTypes?.length && (!event.pitchType || !query.filters.pitchTypes.includes(event.pitchType))) return false;
    if (query.domain === "pitching" && query.filters?.batterHands?.length) {
      const batter = data.players.find((player) => player.id === event.batterId);
      if (!batter || !query.filters.batterHands.includes(batter.bats)) return false;
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
  if (filters.countGroups?.length && !filters.countGroups.includes(countGroup(event.countBefore))) return false;
  return true;
}

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
  const sources = source === "all" ? ["games", "practice", "live-bp"] : [source];
  return [
    ...(sources.includes("games") ? gameOptions : []),
    ...(sources.includes("practice") ? [...practiceOptions, ...hittingSessionOptions] : []),
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

function availableFilterDefinitions(query: AnalyticsQuery): AnalyticsFilterDefinition[] {
  if (query.mode !== "situational") return [];
  return ANALYTICS_FILTERS.filter((filterItem) => filterItem.domain === query.domain && filterItem.supportedSources.includes(query.source));
}

function normalizeAnalyticsQuery(query: AnalyticsQuery): AnalyticsQuery {
  const source = query.domain === "development" ? "all" : query.source;
  const mode = query.domain === "development" ? "box-score" : query.mode;
  const sort = query.sort ?? defaultAnalyticsSort(query.domain, source, mode);
  return {
    ...query,
    source,
    mode,
    groupBy: "player",
    sort,
    filters: mode === "situational" ? query.filters : {},
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

function decimalRateCell(numerator: number, denominator: number, label: string): AnalyticsCell {
  if (!denominator) return cell("—", undefined, "not-tracked");
  return cellFromNumber(numerator / denominator, "decimal", "available", { numerator, denominator, label });
}

function averageCell(values: number[], format: AnalyticsMetricFormat, minSample: number): AnalyticsCell {
  if (!values.length) return cell("—", undefined, "not-tracked");
  return cellFromNumber(average(values), format, values.length < minSample ? "insufficient-sample" : "available", { denominator: values.length, label: "samples" });
}

function maxCell(values: number[], format: AnalyticsMetricFormat): AnalyticsCell {
  if (!values.length) return cell("—", undefined, "not-tracked");
  return cellFromNumber(Math.max(...values), format, "available", { denominator: values.length, label: "samples" });
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
    isWhiff: Boolean(event.isWhiff || event.outcome === "Whiff"),
    isCalledStrike: Boolean(event.isCalledStrike || event.outcome === "Called Strike"),
    velocity: event.velocity,
  };
}

function gamePitchSample(event: GameEvent) {
  return {
    isStrike: event.pitchOutcome !== "Ball",
    isSwing: event.pitchOutcome === "Swinging Strike" || event.pitchOutcome === "Foul" || event.pitchOutcome === "In Play",
    isWhiff: event.pitchOutcome === "Swinging Strike",
    isCalledStrike: event.pitchOutcome === "Called Strike",
    velocity: event.velocity,
  };
}

function countGroup(count?: { balls: number; strikes: number }): "ahead" | "even" | "behind" | "two-strike" {
  if (!count) return "even";
  if (count.strikes >= 2) return "two-strike";
  if (count.balls > count.strikes) return "ahead";
  if (count.strikes > count.balls) return "behind";
  return "even";
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

function metric(id: string, label: string, domain: AnalyticsDomain, format: AnalyticsMetricFormat, supportedSources: AnalyticsSource[], definition: string, sortable: boolean, situationalSupport: boolean, minimumSample?: number): AnalyticsMetricDefinition {
  return { id, label, domain, format, supportedSources, definition, sortable, situationalSupport, minimumSample };
}

function askQuestion(id: string, label: string, domain: AnalyticsDomain, rankingMetricId: string, criteria: string, query: Omit<AnalyticsQuery, "context">): AskClubhouseQuestion {
  return { id, label, domain, rankingMetricId, criteria, query };
}

function handednessOptions() {
  return [
    { value: "R", label: "R" },
    { value: "L", label: "L" },
    { value: "S", label: "Switch" },
  ];
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

const sourceLabels: Record<AnalyticsSource, string> = {
  all: "All",
  games: "Games",
  practice: "Practice",
  "live-bp": "Live BP",
};

const hitOutcomes = new Set<GameBallInPlayOutcome>(["Single", "Double", "Triple", "Home Run"]);
const gameAtBatOutcomes = new Set<GameBallInPlayOutcome>(["Single", "Double", "Triple", "Home Run", "Ground Out", "Fly Out", "Line Out", "Pop Out", "Error", "Fielder's Choice"]);

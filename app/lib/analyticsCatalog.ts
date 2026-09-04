import type { PitchType } from "../types.ts";
import type {
  AnalyticsColumn,
  AnalyticsDomain,
  AnalyticsFilterDefinition,
  AnalyticsFieldSource,
  AnalyticsMetricDefinition,
  AnalyticsQuery,
  AnalyticsSource,
} from "./analyticsQuery.ts";

export type AnalyticsViewId =
  | "overview"
  | "counts"
  | "pitch-types"
  | "vs-hand"
  | "game-state"
  | "batted-ball"
  | "spray-location"
  | "positions"
  | "rep-types"
  | "drills"
  | "weight-room"
  | "attendance"
  | "trends";

export type AnalyticsColumnPreset = "standard" | "advanced" | "development" | "custom";
export type AnalyticsViewCapability = "supported" | "partial" | "derivable" | "not-tracked";

export interface AnalyticsViewDefinition {
  id: AnalyticsViewId;
  label: string;
  domains: AnalyticsDomain[];
  sources: AnalyticsSource[];
  groupBy?: "count" | "pitch-type" | "hand" | "game-state" | "batted-ball" | "spray" | "position" | "rep-type" | "drill";
  capability: AnalyticsViewCapability;
  description: string;
}

export interface SerializedAnalyticsContext {
  domain: AnalyticsDomain;
  source: AnalyticsSource;
  fieldSources?: AnalyticsFieldSource[];
  view: AnalyticsViewId;
  timeRange: AnalyticsQuery["timeRange"];
  eventIds: string[];
  filters: NonNullable<AnalyticsQuery["filters"]>;
  metrics: string[];
  sort?: AnalyticsQuery["sort"];
  context?: AnalyticsQuery["context"];
}

export const ANALYTICS_SAMPLE_THRESHOLDS = {
  hittingSwings: 12,
  hittingBallsInPlay: 8,
  exitVelocitySamples: 3,
  exitVelocityPercentileSamples: 10,
  pitchingPitches: 18,
  pitchingVelocityPercentileSamples: 10,
  defenseReps: 8,
  weightRoomWorkouts: 1,
} as const;

const pitchTypeOptions = (["4-Seam", "2-Seam", "Sinker", "Cutter", "Slider", "Curveball", "Changeup", "Splitter", "Knuckleball", "Other"] satisfies PitchType[])
  .map((value) => ({ value, label: value }));
const handOptions = [
  { value: "R", label: "Right" },
  { value: "L", label: "Left" },
  { value: "S", label: "Switch" },
];
const countOptions = ["0-0", "1-0", "0-1", "2-0", "1-1", "0-2", "3-0", "2-1", "1-2", "3-1", "2-2", "3-2"]
  .map((value) => ({ value, label: value }));

export const ANALYTICS_VIEW_CATALOG: AnalyticsViewDefinition[] = [
  view("overview", "Overview", ["hitting", "pitching"], ["all", "games", "practice", "live-bp"], undefined, "supported", "Player-level team table using the selected source and filters."),
  view("counts", "Counts", ["hitting", "pitching"], ["games", "practice", "live-bp", "all"], "count", "partial", "Count splits from tracked count-before data. Hitting practice coverage requires linked pitch data."),
  view("pitch-types", "Pitch Types", ["hitting", "pitching"], ["all", "games", "practice", "live-bp"], "pitch-type", "supported", "Pitch-type splits from tracked pitch classifications."),
  view("vs-hand", "vs LHP / RHP", ["hitting"], ["games", "practice", "live-bp", "all"], "hand", "partial", "Pitcher-handedness splits where an identified pitcher is attached to the event."),
  view("vs-hand", "vs LHB / RHB", ["pitching"], ["games", "practice", "live-bp", "all"], "hand", "partial", "Batter-handedness splits where an identified hitter is attached to the event."),
  view("game-state", "Game State", ["hitting", "pitching"], ["games"], "game-state", "supported", "Winning, tied, and trailing splits from the score before each event."),
  view("batted-ball", "Batted Ball", ["hitting", "pitching"], ["games", "practice", "live-bp", "all"], "batted-ball", "supported", "Tracked contact-type splits."),
  view("spray-location", "Spray / Location", ["hitting"], ["practice", "live-bp", "all"], "spray", "supported", "Pull, middle, and opposite-field splits from tracked direction."),
  view("spray-location", "Location", ["pitching"], ["games", "practice", "live-bp", "all"], "spray", "supported", "Pitch-location region splits from charted pitch locations."),
  view("overview", "Overview", ["development"], ["all"], undefined, "supported", "Combined tracked development overview."),
  view("weight-room", "Weight Room", ["development"], ["all"], undefined, "supported", "Weight Room participation and development score."),
  view("attendance", "Attendance", ["development"], ["all"], undefined, "supported", "Practice attendance coverage."),
  view("trends", "Trends", ["development"], ["all"], undefined, "derivable", "Bounded period comparisons from calculated Clubhouse data."),
  view("overview", "Overview", ["defense"], ["all", "practice"], undefined, "supported", "Player-level defensive practice results."),
  view("positions", "Positions", ["defense"], ["all", "practice"], "position", "supported", "Defensive results grouped by tracked position."),
  view("rep-types", "Rep Types", ["defense"], ["all", "practice"], "rep-type", "supported", "Defensive results grouped by rep type."),
  view("drills", "Drills", ["defense"], ["all", "practice"], "drill", "supported", "Defensive results grouped by drill."),
];

export const ANALYTICS_METRICS: AnalyticsMetricDefinition[] = [
  metric("opportunities", "Opp", "hitting", "integer", ["all", "practice", "live-bp"], "Tracked hitting opportunities."),
  metric("takes", "Take", "hitting", "integer", ["all", "practice", "live-bp"], "Taken pitches."),
  metric("swings", "SW", "hitting", "integer", ["all", "practice", "live-bp"], "Tracked swings."),
  metric("contacts", "CT", "hitting", "integer", ["all", "practice", "live-bp"], "Fouls plus balls in play."),
  metric("bip", "BIP", "hitting", "integer", ["all", "practice", "live-bp"], "Balls put in play."),
  metric("misses", "Whiff", "hitting", "integer", ["all", "practice", "live-bp"], "Swing-and-miss results."),
  metric("fouls", "Foul", "hitting", "integer", ["all", "practice", "live-bp"], "Foul balls."),
  metric("swingPct", "Swing%", "hitting", "percentage", ["all", "practice", "live-bp"], "Swings divided by tracked opportunities."),
  metric("bipPct", "BIP%", "hitting", "percentage", ["all", "practice", "live-bp"], "Balls in play divided by swings."),
  metric("contactPct", "Contact%", "hitting", "percentage", ["all", "practice", "live-bp"], "Contact divided by swings.", ANALYTICS_SAMPLE_THRESHOLDS.hittingSwings),
  metric("swingMissPct", "Whiff%", "hitting", "percentage", ["all", "practice", "live-bp"], "Misses divided by swings.", ANALYTICS_SAMPLE_THRESHOLDS.hittingSwings),
  metric("foulPct", "Foul%", "hitting", "percentage", ["all", "practice", "live-bp"], "Fouls divided by swings.", ANALYTICS_SAMPLE_THRESHOLDS.hittingSwings),
  metric("takePct", "Take%", "hitting", "percentage", ["all", "practice", "live-bp"], "Takes divided by tracked opportunities."),
  metric("zoneSwingPct", "Zone SW%", "hitting", "percentage", ["all", "practice", "live-bp"], "Swings at charted in-zone pitches divided by charted in-zone opportunities.", ANALYTICS_SAMPLE_THRESHOLDS.hittingSwings),
  metric("zoneContactPct", "Zone CT%", "hitting", "percentage", ["all", "practice", "live-bp"], "Contact on charted in-zone swings.", ANALYTICS_SAMPLE_THRESHOLDS.hittingSwings),
  metric("chasePct", "Chase%", "hitting", "percentage", ["all", "practice", "live-bp"], "Swings at charted out-of-zone pitches divided by out-of-zone opportunities.", ANALYTICS_SAMPLE_THRESHOLDS.hittingSwings),
  metric("outZoneContactPct", "O-Zone CT%", "hitting", "percentage", ["all", "practice", "live-bp"], "Contact on charted out-of-zone swings.", ANALYTICS_SAMPLE_THRESHOLDS.hittingSwings),
  metric("hard", "Hard", "hitting", "integer", ["all", "practice", "live-bp"], "Explicit hard-contact balls in play."),
  metric("hardPct", "Hard%", "hitting", "percentage", ["all", "practice", "live-bp"], "Hard contact divided by balls in play.", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
  metric("barrelPct", "Impact%", "hitting", "percentage", ["all", "practice", "live-bp"], "Coach-entered barrel/impact-quality contact divided by balls in play; not a Statcast barrel.", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
  metric("lineDrivePct", "LD%", "hitting", "percentage", ["all", "practice", "live-bp"], "Line drives divided by balls in play.", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
  metric("groundBallPct", "GB%", "hitting", "percentage", ["all", "practice", "live-bp"], "Ground balls divided by balls in play.", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
  metric("flyBallPct", "FB%", "hitting", "percentage", ["all", "practice", "live-bp"], "Fly balls divided by balls in play.", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
  metric("popUpPct", "PU%", "hitting", "percentage", ["all", "practice", "live-bp"], "Pop ups divided by balls in play.", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
  metric("groundBalls", "GB", "hitting", "integer", ["all", "practice", "live-bp"], "Tracked ground balls."),
  metric("lineDrives", "LD", "hitting", "integer", ["all", "practice", "live-bp"], "Tracked line drives."),
  metric("flyBalls", "FB", "hitting", "integer", ["all", "practice", "live-bp"], "Tracked fly balls."),
  metric("popUps", "PU", "hitting", "integer", ["all", "practice", "live-bp"], "Tracked pop ups."),
  metric("softPct", "Soft%", "hitting", "percentage", ["all", "practice", "live-bp"], "Poor or weak contact divided by balls in play.", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
  metric("gbFbRatio", "GB/FB", "hitting", "decimal", ["all", "practice", "live-bp"], "Ground balls divided by fly balls; unavailable when no fly balls are tracked.", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
  metric("airPct", "Air%", "hitting", "percentage", ["all", "practice", "live-bp"], "Line drives, fly balls, and pop ups divided by balls in play.", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
  metric("pullPct", "Pull%", "hitting", "percentage", ["all", "practice", "live-bp"], "Pull-side balls in play divided by balls in play.", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
  metric("middlePct", "Mid%", "hitting", "percentage", ["all", "practice", "live-bp"], "Middle-field balls in play divided by balls in play.", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
  metric("oppoPct", "Oppo%", "hitting", "percentage", ["all", "practice", "live-bp"], "Opposite-field balls in play divided by balls in play.", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
  metric("avgEv", "Avg EV", "hitting", "ev", ["all", "practice", "live-bp"], "Average recorded exit velocity.", ANALYTICS_SAMPLE_THRESHOLDS.exitVelocitySamples),
  metric("medianEv", "Med EV", "hitting", "ev", ["all", "practice", "live-bp"], "Median recorded exit velocity.", ANALYTICS_SAMPLE_THRESHOLDS.exitVelocitySamples),
  metric("ev90", "90th EV", "hitting", "ev", ["all", "practice", "live-bp"], "90th-percentile recorded exit velocity.", ANALYTICS_SAMPLE_THRESHOLDS.exitVelocityPercentileSamples),
  metric("ev95", "95th EV", "hitting", "ev", ["all", "practice", "live-bp"], "95th-percentile recorded exit velocity.", ANALYTICS_SAMPLE_THRESHOLDS.exitVelocityPercentileSamples),
  metric("maxEv", "Max EV", "hitting", "ev", ["all", "practice", "live-bp"], "Highest recorded exit velocity.", 1),
  metric("evSamples", "EV N", "hitting", "integer", ["all", "practice", "live-bp"], "Events with recorded exit velocity."),
  metric("pa", "PA", "hitting", "integer", ["games"], "Completed logged plate appearances."),
  metric("trackedBip", "BIP", "hitting", "integer", ["games"], "Logged game balls in play; not complete plate appearances."),
  metric("ab", "AB", "hitting", "integer", ["games"], "Completed logged plate appearances that count as at bats."),
  metric("hits", "H", "hitting", "integer", ["games"], "Hits from logged game balls in play."),
  metric("singles", "1B", "hitting", "integer", ["games"], "Singles."),
  metric("doubles", "2B", "hitting", "integer", ["games"], "Doubles."),
  metric("triples", "3B", "hitting", "integer", ["games"], "Triples."),
  metric("homeRuns", "HR", "hitting", "integer", ["games"], "Home runs."),
  metric("walks", "BB", "hitting", "integer", ["games"], "Completed plate appearances ending in a walk."),
  metric("strikeouts", "SO", "hitting", "integer", ["games"], "Completed plate appearances ending in a strikeout."),
  metric("hitByPitch", "HBP", "hitting", "integer", ["games"], "Completed plate appearances ending in hit by pitch."),
  metric("outs", "Outs", "hitting", "integer", ["games"], "Tracked at-bat outs."),
  metric("xbh", "XBH", "hitting", "integer", ["games"], "Extra-base hits."),
  metric("totalBases", "TB", "hitting", "integer", ["games"], "Total bases."),
  metric("avg", "AVG", "hitting", "decimal", ["games"], "Hits divided by supported at-bats."),
  metric("obp", "OBP", "hitting", "decimal", ["games"], "Times on base divided by completed logged plate appearances."),
  metric("slg", "SLG", "hitting", "decimal", ["games"], "Total bases divided by supported at-bats."),
  metric("ops", "OPS", "hitting", "decimal", ["games"], "On-base percentage plus slugging percentage."),
  metric("iso", "ISO", "hitting", "decimal", ["games"], "SLG minus AVG."),
  metric("babip", "BABIP", "hitting", "decimal", ["games"], "Non-home-run hits divided by tracked non-home-run balls in play."),
  metric("hrPct", "HR/AB%", "hitting", "percentage", ["games"], "Home runs divided by supported at-bats."),
  metric("xbhPct", "XBH/AB%", "hitting", "percentage", ["games"], "Extra-base hits divided by supported at-bats."),
  metric("tbPerAb", "TB/AB", "hitting", "decimal", ["games"], "Total bases divided by supported at-bats."),
  metric("pitches", "P", "pitching", "integer", ["all", "practice", "live-bp", "games"], "Logged pitches."),
  metric("balls", "Ball", "pitching", "integer", ["all", "practice", "live-bp", "games"], "Logged balls."),
  metric("strikes", "Strike", "pitching", "integer", ["all", "practice", "live-bp", "games"], "Logged strikes."),
  metric("strikePct", "Strike%", "pitching", "percentage", ["all", "practice", "live-bp", "games"], "Strikes divided by pitches.", ANALYTICS_SAMPLE_THRESHOLDS.pitchingPitches),
  metric("ballPct", "Ball%", "pitching", "percentage", ["all", "practice", "live-bp", "games"], "Balls divided by pitches.", ANALYTICS_SAMPLE_THRESHOLDS.pitchingPitches),
  metric("swingPctAllowed", "Swing%", "pitching", "percentage", ["all", "practice", "live-bp", "games"], "Swings divided by pitches.", ANALYTICS_SAMPLE_THRESHOLDS.pitchingPitches),
  metric("zonePct", "Zone%", "pitching", "percentage", ["all", "practice", "live-bp", "games"], "Charted in-zone pitches divided by charted pitches.", ANALYTICS_SAMPLE_THRESHOLDS.pitchingPitches),
  metric("whiffPct", "Whiff%", "pitching", "percentage", ["all", "practice", "live-bp", "games"], "Whiffs divided by swings.", ANALYTICS_SAMPLE_THRESHOLDS.pitchingPitches),
  metric("swStrPct", "SwStr%", "pitching", "percentage", ["all", "practice", "live-bp", "games"], "Swinging strikes divided by pitches.", ANALYTICS_SAMPLE_THRESHOLDS.pitchingPitches),
  metric("calledStrikePct", "CS%", "pitching", "percentage", ["all", "practice", "live-bp", "games"], "Called strikes divided by pitches.", ANALYTICS_SAMPLE_THRESHOLDS.pitchingPitches),
  metric("cswPct", "CSW%", "pitching", "percentage", ["all", "practice", "live-bp", "games"], "Called strikes plus whiffs divided by pitches.", ANALYTICS_SAMPLE_THRESHOLDS.pitchingPitches),
  metric("contactAllowedPct", "Contact%", "pitching", "percentage", ["all", "practice", "live-bp", "games"], "Fouls plus balls in play divided by swings.", ANALYTICS_SAMPLE_THRESHOLDS.pitchingPitches),
  metric("zoneWhiffPct", "Z-Whiff%", "pitching", "percentage", ["all", "practice", "live-bp", "games"], "Whiffs on charted in-zone swings.", ANALYTICS_SAMPLE_THRESHOLDS.pitchingPitches),
  metric("outZoneWhiffPct", "O-Whiff%", "pitching", "percentage", ["all", "practice", "live-bp", "games"], "Whiffs on charted out-of-zone swings.", ANALYTICS_SAMPLE_THRESHOLDS.pitchingPitches),
  metric("firstPitchStrikePct", "FPS%", "pitching", "percentage", ["all", "practice", "live-bp", "games"], "Strikes on tracked 0-0 pitches.", 8),
  metric("avgPitchVelo", "Avg Velo", "pitching", "velocity", ["all", "practice", "live-bp", "games"], "Average recorded pitch velocity.", 3),
  metric("medianPitchVelo", "Med Velo", "pitching", "velocity", ["all", "practice", "live-bp", "games"], "Median recorded pitch velocity.", 3),
  metric("p90PitchVelo", "90th Velo", "pitching", "velocity", ["all", "practice", "live-bp", "games"], "90th-percentile recorded pitch velocity.", ANALYTICS_SAMPLE_THRESHOLDS.pitchingVelocityPercentileSamples),
  metric("maxPitchVelo", "Max Velo", "pitching", "velocity", ["all", "practice", "live-bp", "games"], "Highest recorded pitch velocity.", 1),
  metric("minPitchVelo", "Min Velo", "pitching", "velocity", ["all", "practice", "live-bp", "games"], "Lowest recorded pitch velocity.", 1),
  metric("veloSpread", "Velo Spread", "pitching", "velocity", ["all", "practice", "live-bp", "games"], "Highest minus lowest recorded pitch velocity.", 3),
  metric("positionWorked", "Pos", "defense", "text", ["all", "practice"], "Most common tracked defensive position."),
  metric("reps", "REP", "defense", "integer", ["all", "practice"], "Logged defensive reps."),
  metric("cleanReps", "Clean", "defense", "integer", ["all", "practice"], "Clean, good, or great reps."),
  metric("cleanPct", "Clean%", "defense", "percentage", ["all", "practice"], "Clean, good, or great reps divided by reps.", ANALYTICS_SAMPLE_THRESHOLDS.defenseReps),
  metric("errors", "Err", "defense", "integer", ["all", "practice"], "Logged defensive errors."),
  metric("fieldingErrors", "Fld Err", "defense", "integer", ["all", "practice"], "Errors recorded as fielding errors."),
  metric("throwingErrors", "Thr Err", "defense", "integer", ["all", "practice"], "Errors recorded as throwing errors."),
  metric("decisionErrors", "Dec Err", "defense", "integer", ["all", "practice"], "Errors recorded as decision errors."),
  metric("missedReps", "Missed", "defense", "integer", ["all", "practice"], "Logged missed reps."),
  metric("errorPct", "Err%", "defense", "percentage", ["all", "practice"], "Logged errors divided by defensive reps.", ANALYTICS_SAMPLE_THRESHOLDS.defenseReps),
  metric("greatPlays", "Great", "defense", "integer", ["all", "practice"], "Logged great plays."),
  metric("throws", "THR", "defense", "integer", ["all", "practice"], "Throws with a tracked result."),
  metric("accurateThrows", "Acc", "defense", "integer", ["all", "practice"], "Accurate tracked throws."),
  metric("inaccurateThrows", "Inacc", "defense", "integer", ["all", "practice"], "Inaccurate tracked throws."),
  metric("throwAcc", "Throw%", "defense", "percentage", ["all", "practice"], "Accurate throws divided by tracked throws.", ANALYTICS_SAMPLE_THRESHOLDS.defenseReps),
  metric("weightScore", "Weight", "development", "integer", ["all"], "Existing Weight Room Development score.", ANALYTICS_SAMPLE_THRESHOLDS.weightRoomWorkouts),
  metric("workouts", "Workouts", "development", "integer", ["all"], "Completed workout sessions."),
  metric("workoutCompletionPct", "Workout%", "development", "percentage", ["all"], "Completed workouts divided by assigned workouts."),
  metric("attendancePct", "Attend%", "development", "percentage", ["all"], "Present or late attendance divided by practices."),
  metric("practiceReps", "Reps", "development", "integer", ["all"], "Tracked hitting, pitching, and defensive reps."),
];

export const ANALYTICS_FILTER_CATALOG: AnalyticsFilterDefinition[] = [
  filter("pitchTypes", "Pitch Type", "Pitch", ["hitting", "pitching"], ["all", "games", "practice", "live-bp"], pitchTypeOptions),
  filter("pitchVelocityMin", "Velocity", "Pitch", ["hitting", "pitching"], ["all", "games", "practice", "live-bp"], [], "range"),
  filter("pitchLocationRegions", "Pitch Location", "Pitch", ["hitting"], ["all", "games", "practice", "live-bp"], [
    { value: "in_zone", label: "In Zone" }, { value: "out_of_zone", label: "Out of Zone" },
    { value: "up", label: "Up" }, { value: "middle", label: "Middle" }, { value: "down", label: "Down" },
    { value: "in", label: "In" }, { value: "away", label: "Away" },
    { value: "up_and_in", label: "Up & In" }, { value: "up_and_away", label: "Up & Away" },
    { value: "down_and_in", label: "Down & In" }, { value: "down_and_away", label: "Down & Away" },
  ], "pitch-location", "supported", "Hitter-relative orientation based on the selected batter's side."),
  filter("pitchLocationRegions", "Pitch Location", "Pitch", ["pitching"], ["all", "games", "practice", "live-bp"], [
    { value: "in_zone", label: "In Zone" }, { value: "out_of_zone", label: "Out of Zone" },
    { value: "up", label: "Up" }, { value: "middle", label: "Middle" }, { value: "down", label: "Down" },
    { value: "arm_side", label: "Arm Side" }, { value: "glove_side", label: "Glove Side" },
    { value: "up_arm_side", label: "Up & Arm Side" }, { value: "up_glove_side", label: "Up & Glove Side" },
    { value: "down_arm_side", label: "Down & Arm Side" }, { value: "down_glove_side", label: "Down & Glove Side" },
  ], "pitch-location", "supported", "Pitcher-relative orientation using the tracked pitcher's throwing hand."),
  filter("exactCounts", "Exact Count", "Count", ["hitting", "pitching"], ["all", "games", "practice", "live-bp"], countOptions, "multi-select", "partial", "Practice hitting requires linked pitch/count data."),
  filter("countGroups", "Count Group", "Count", ["hitting", "pitching"], ["all", "games", "practice", "live-bp"], [
    { value: "first-pitch", label: "First Pitch" }, { value: "ahead", label: "Hitter Ahead" },
    { value: "even", label: "Even" }, { value: "behind", label: "Pitcher Ahead" },
    { value: "two-strike", label: "Two Strike" }, { value: "full-count", label: "Full Count" },
  ], "multi-select", "partial", "Practice hitting requires linked pitch/count data."),
  filter("pitcherHands", "Pitcher Hand", "Matchup", ["hitting"], ["all", "games", "practice", "live-bp"], handOptions, "multi-select", "partial", "Only events with an identified pitcher qualify."),
  filter("batterHands", "Batter Hand", "Matchup", ["pitching"], ["all", "games", "practice", "live-bp"], handOptions, "multi-select", "partial", "Only events with an identified hitter qualify."),
  filter("gameStates", "Score State", "Game State", ["hitting", "pitching"], ["games"], [
    { value: "winning", label: "Winning" }, { value: "tied", label: "Tied" }, { value: "losing", label: "Trailing" },
  ]),
  filter("innings", "Inning", "Game State", ["hitting", "pitching"], ["games"], [], "multi-select", "supported", undefined, "innings"),
  filter("outs", "Outs", "Game State", ["hitting", "pitching"], ["games"], [0, 1, 2].map((value) => ({ value: String(value), label: `${value} Out${value === 1 ? "" : "s"}` }))),
  filter("runnerStates", "Runners", "Game State", ["hitting", "pitching"], ["games"], [
    { value: "bases-empty", label: "Bases Empty" }, { value: "runners-on", label: "Runners On" }, { value: "risp", label: "RISP" },
  ]),
  filter("homeAway", "Home / Away", "Game", ["hitting", "pitching"], ["games"], [
    { value: "Home", label: "Home" }, { value: "Away", label: "Away" }, { value: "Neutral", label: "Neutral" },
  ]),
  filter("opponents", "Opponent", "Game", ["hitting", "pitching"], ["games"], [], "multi-select", "supported", undefined, "opponents"),
  filter("gamePitchOutcomes", "Pitch Outcome", "Result", ["hitting", "pitching"], ["games"], ["Ball", "Called Strike", "Swinging Strike", "Foul", "In Play", "HBP"].map(option)),
  filter("gameBipOutcomes", "Play Outcome", "Result", ["hitting"], ["games"], ["Single", "Double", "Triple", "Home Run", "Ground Out", "Fly Out", "Line Out", "Pop Out", "Error", "Fielder's Choice", "Sac Fly", "Sac Bunt", "Double Play"].map(option)),
  filter("battedBallTypes", "Batted Ball", "Contact", ["hitting", "pitching"], ["all", "games", "practice", "live-bp"], ["Ground ball", "Line drive", "Fly ball", "Pop up"].map(option), "multi-select", "partial", "Games use scored contact type when present."),
  filter("directions", "Spray Direction", "Contact", ["hitting"], ["all", "practice", "live-bp"], ["Pull", "Middle", "Opposite"].map(option)),
  filter("drillTypes", "Drill", "Practice", ["hitting"], ["practice", "live-bp"], ["Tee", "Front Toss", "Machine", "Hack Attack - FB", "Hack Attack - CB", "Coach BP", "Live BP", "Other"].map(option)),
  filter("liveBpThrowerSources", "Thrower", "Practice", ["hitting", "pitching"], ["all", "live-bp"], [
    { value: "PLAYER", label: "Player" }, { value: "COACH", label: "Coach" }, { value: "MACHINE", label: "Machine" },
  ], "multi-select", "partial"),
  filter("defenseStations", "Station", "Defense", ["defense"], ["all", "practice"], ["Infield", "Outfield", "Catching", "PFP", "Situational defense", "Team defense"].map(option)),
  filter("defensePositions", "Position", "Defense", ["defense"], ["all", "practice"], ["P", "C", "1B", "2B", "3B", "SS", "INF", "LF", "CF", "RF", "OF"].map(option)),
  filter("defenseDrills", "Drill", "Defense", ["defense"], ["all", "practice"], ["Infield Ground Balls", "Backhands", "Forehands", "Slow Rollers", "Double Plays", "First Base Picks", "Outfield Fly Balls", "Outfield Routes", "Cutoffs & Relays", "Catcher Blocking", "Catcher Throwdowns", "Bunt Defense", "Pitcher Fielding Practice", "Team Defense", "Other"].map(option)),
  filter("defenseRepTypes", "Rep Type", "Defense", ["defense"], ["all", "practice"], ["Ground Ball", "Fly Ball", "Line Drive", "Double Play", "Throw", "Block", "Pick", "Bunt", "Other"].map(option)),
  filter("defenseRepSubtypes", "Subtype", "Defense", ["defense"], ["all", "practice"], ["Routine", "Forehand", "Backhand", "Slow Roller", "Charge", "Drop Step", "Over Shoulder", "Cutoff", "Relay", "Block", "Throwdown", "Pick", "Bunt", "Other"].map(option)),
  filter("defenseResults", "Result", "Defense", ["defense"], ["all", "practice"], ["Clean", "Error", "Good Play", "Great Play", "Missed Rep"].map(option)),
  filter("defenseThrowResults", "Throw", "Defense", ["defense"], ["all", "practice"], ["Accurate", "Inaccurate", "No Throw"].map(option)),
];

export const ANALYTICS_COLUMN_PRESETS: Record<Exclude<AnalyticsColumnPreset, "custom">, string[]> = {
  standard: [
    "pa", "ab", "hits", "singles", "doubles", "triples", "homeRuns", "walks", "hitByPitch", "strikeouts", "obp", "avg", "slg", "ops",
    "opportunities", "swings", "contacts", "bip", "swingPct", "contactPct", "hardPct", "avgEv", "maxEv",
    "pitches", "balls", "strikes", "strikePct", "zonePct", "whiffPct", "cswPct", "firstPitchStrikePct", "avgPitchVelo", "maxPitchVelo",
    "positionWorked", "reps", "cleanPct", "errors", "throwAcc",
    "workouts", "attendancePct", "practiceReps",
  ],
  advanced: [
    "pa", "ab", "hits", "walks", "hitByPitch", "strikeouts", "obp", "avg", "slg", "ops", "iso", "babip", "hrPct", "xbhPct", "tbPerAb", "swingPct", "bipPct", "contactPct", "swingMissPct", "foulPct", "zoneSwingPct", "zoneContactPct", "chasePct", "outZoneContactPct",
    "hardPct", "barrelPct", "softPct", "lineDrivePct", "groundBallPct", "flyBallPct", "popUpPct", "gbFbRatio", "airPct",
    "ballPct", "swingPctAllowed", "whiffPct", "swStrPct", "calledStrikePct", "cswPct", "contactAllowedPct", "zoneWhiffPct", "outZoneWhiffPct", "firstPitchStrikePct", "zonePct", "throwAcc", "errorPct", "workoutCompletionPct",
  ],
  development: [
    "contactPct", "hardPct", "avgEv", "medianEv", "ev90", "ev95", "maxEv", "pullPct", "middlePct", "oppoPct", "zoneContactPct", "chasePct",
    "strikePct", "cswPct", "whiffPct", "zonePct", "firstPitchStrikePct", "avgPitchVelo", "medianPitchVelo", "p90PitchVelo", "maxPitchVelo", "minPitchVelo", "veloSpread",
    "cleanPct", "throwAcc", "greatPlays", "missedReps", "weightScore", "workoutCompletionPct", "attendancePct", "practiceReps",
  ],
};

for (const [index, definition] of ANALYTICS_METRICS.entries()) {
  definition.presetGroups = (["standard", "advanced", "development"] as const)
    .filter((preset) => ANALYTICS_COLUMN_PRESETS[preset].includes(definition.id));
  definition.displayOrder = index;
}

export function analyticsViewsFor(domain: AnalyticsDomain, source: AnalyticsSource): AnalyticsViewDefinition[] {
  const seen = new Set<string>();
  return ANALYTICS_VIEW_CATALOG.filter((definition) => {
    if (!definition.domains.includes(domain) || !definition.sources.includes(source) || definition.capability === "not-tracked") return false;
    const key = `${definition.id}:${definition.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function analyticsSourcesForDomain(domain: AnalyticsDomain): AnalyticsSource[] {
  if (domain === "development") return ["all"];
  if (domain === "defense") return ["practice", "all"];
  return ["games", "practice", "live-bp", "all"];
}

export function normalizeAnalyticsView(domain: AnalyticsDomain, source: AnalyticsSource, viewId?: string): AnalyticsViewId {
  const views = analyticsViewsFor(domain, source);
  return views.some((viewDefinition) => viewDefinition.id === viewId) ? viewId as AnalyticsViewId : views[0]?.id ?? "overview";
}

export function analyticsPresetColumnIds(columns: AnalyticsColumn[], preset: Exclude<AnalyticsColumnPreset, "custom">): string[] {
  const available = new Set(columns.map((column) => column.metricId));
  return ANALYTICS_COLUMN_PRESETS[preset].filter((metricId) => available.has(metricId));
}

export function analyticsMetricColumnGroup(metricId: string): string {
  const definition = ANALYTICS_METRICS.find((metric) => metric.id === metricId);
  if (definition?.presetGroups?.includes("standard")) return "Core";
  if (definition?.presetGroups?.includes("advanced")) return "Rates & Outcomes";
  return "Development";
}

export function defaultAnalyticsMetricIds(domain: AnalyticsDomain, source: AnalyticsSource, fieldSources?: AnalyticsFieldSource[]): string[] {
  const resolvedSources: AnalyticsFieldSource[] = fieldSources?.length
    ? fieldSources
    : source === "all"
      ? domain === "pitching" ? ["games", "practice", "live-bp"] : domain === "defense" ? ["practice"] : ["practice", "live-bp"]
      : [source];
  const supported = new Set(
    ANALYTICS_METRICS
      .filter((metricDefinition) => metricDefinition.domain === domain && resolvedSources.some((fieldSource) => metricDefinition.supportedSources.includes(fieldSource)))
      .map((metricDefinition) => metricDefinition.id),
  );
  return ANALYTICS_COLUMN_PRESETS.standard.filter((metricId) => supported.has(metricId));
}

export function serializeAnalyticsContext(query: AnalyticsQuery, visibleMetricIds: string[]): SerializedAnalyticsContext {
  return {
    domain: query.domain,
    source: query.source,
    fieldSources: query.fieldSources?.length ? [...query.fieldSources] : undefined,
    view: normalizeAnalyticsView(query.domain, query.source, query.view),
    timeRange: query.timeRange,
    eventIds: [...(query.eventIds ?? [])],
    filters: { ...(query.filters ?? {}) },
    metrics: [...visibleMetricIds],
    sort: query.sort ? { ...query.sort } : undefined,
    context: query.context ? { ...query.context } : undefined,
  };
}

function view(
  id: AnalyticsViewId,
  label: string,
  domains: AnalyticsDomain[],
  sources: AnalyticsSource[],
  groupBy: AnalyticsViewDefinition["groupBy"],
  capability: AnalyticsViewCapability,
  description: string,
): AnalyticsViewDefinition {
  return { id, label, domains, sources, groupBy, capability, description };
}

function metric(
  id: string,
  label: string,
  domain: AnalyticsDomain,
  format: AnalyticsMetricDefinition["format"],
  supportedSources: AnalyticsSource[],
  definition: string,
  minimumSample?: number,
): AnalyticsMetricDefinition {
  return {
    id,
    label,
    fullName: label,
    domain,
    format,
    supportedSources,
    sourceAvailability: Object.fromEntries(supportedSources.map((source) => [source, "supported"])),
    definition,
    qualification: minimumSample ? `${minimumSample}+ qualifying samples` : undefined,
    higherIsBetter: !["misses", "swingMissPct", "chasePct", "ballPct", "errorPct", "errors", "fieldingErrors", "throwingErrors", "decisionErrors", "missedReps", "inaccurateThrows"].includes(id),
    sortable: true,
    situationalSupport: true,
    minimumSample,
  };
}

function filter(
  id: AnalyticsFilterDefinition["id"],
  label: string,
  section: string,
  domains: AnalyticsDomain[],
  supportedSources: AnalyticsSource[],
  options: AnalyticsFilterDefinition["options"],
  type: AnalyticsFilterDefinition["type"] = "multi-select",
  availability: AnalyticsFilterDefinition["availability"] = "supported",
  capabilityNote?: string,
  dynamicOptions?: AnalyticsFilterDefinition["dynamicOptions"],
): AnalyticsFilterDefinition {
  return { id, label, section, domains, supportedSources, options, type, availability, capabilityNote, dynamicOptions };
}

function option(value: string) {
  return { value, label: value };
}

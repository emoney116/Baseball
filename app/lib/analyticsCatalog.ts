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

export type AnalyticsColumnPreset =
  | "standard" | "advanced" | "approach" | "contact" | "batted-ball" | "baserunning"
  | "command" | "efficiency" | "velocity" | "pitch-mix" | "development" | "position" | "custom";
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

const METRIC_FULL_NAMES: Record<string, string> = {
  opportunities: "Opportunities", takes: "Taken Pitches", swings: "Swings", contacts: "Contacts", bip: "Balls in Play", misses: "Swing and Misses", fouls: "Foul Balls",
  swingPct: "Swing Percentage", bipPct: "Balls in Play Percentage", contactPct: "Contact Percentage", swingMissPct: "Whiff Percentage", foulPct: "Foul Percentage", takePct: "Take Percentage",
  zoneSwingPct: "Zone Swing Percentage", zoneContactPct: "Zone Contact Percentage", chasePct: "Chase Percentage", outZoneContactPct: "Out-of-Zone Contact Percentage",
  hard: "Hard Contact", hardPct: "Hard Contact Percentage", barrelPct: "Impact Contact Percentage", softPct: "Soft Contact Percentage",
  lineDrivePct: "Line Drive Percentage", groundBallPct: "Ground Ball Percentage", flyBallPct: "Fly Ball Percentage", popUpPct: "Pop Up Percentage", groundBalls: "Ground Balls", lineDrives: "Line Drives", flyBalls: "Fly Balls", popUps: "Pop Ups", gbFbRatio: "Ground Ball to Fly Ball Ratio", airPct: "Air Ball Percentage",
  pullPct: "Pull Percentage", middlePct: "Middle Percentage", oppoPct: "Opposite Field Percentage", avgEv: "Average Exit Velocity", medianEv: "Median Exit Velocity", ev90: "90th Percentile Exit Velocity", ev95: "95th Percentile Exit Velocity", maxEv: "Maximum Exit Velocity", evSamples: "Exit Velocity Samples",
  pa: "Plate Appearances", ab: "At Bats", hits: "Hits", singles: "Singles", doubles: "Doubles", triples: "Triples", homeRuns: "Home Runs", walks: "Walks", strikeouts: "Strikeouts", hitByPitch: "Hit By Pitch", outs: "Batting Outs", xbh: "Extra-Base Hits", totalBases: "Total Bases", avg: "Batting Average", obp: "On-Base Percentage", slg: "Slugging Percentage", ops: "On-Base Plus Slugging", iso: "Isolated Power", babip: "Batting Average on Balls in Play", hrPct: "Home Run Rate", xbhPct: "Extra-Base Hit Rate", tbPerAb: "Total Bases per At Bat",
  pitches: "Pitches", balls: "Balls", strikes: "Strikes", strikePct: "Strike Percentage", ballPct: "Ball Percentage", swingPctAllowed: "Swing Percentage Allowed", zonePct: "Zone Percentage", whiffPct: "Whiff Percentage", swStrPct: "Swinging Strike Percentage", calledStrikePct: "Called Strike Percentage", cswPct: "Called Strike Plus Whiff Percentage", contactAllowedPct: "Contact Percentage Allowed", zoneContactAllowedPct: "Zone Contact Percentage Allowed", chasePctAllowed: "Chase Percentage Allowed", zoneWhiffPct: "Zone Whiff Percentage", outZoneWhiffPct: "Out-of-Zone Whiff Percentage", firstPitchStrikePct: "First-Pitch Strike Percentage", avgPitchVelo: "Average Velocity", medianPitchVelo: "Median Velocity", p90PitchVelo: "90th Percentile Velocity", maxPitchVelo: "Maximum Velocity", minPitchVelo: "Minimum Velocity", veloSpread: "Velocity Delta",
  positionWorked: "Position Worked", reps: "Defensive Repetitions", cleanReps: "Clean Repetitions", cleanPct: "Clean Percentage", errors: "Errors", fieldingErrors: "Fielding Errors", throwingErrors: "Throwing Errors", decisionErrors: "Decision Errors", missedReps: "Missed Repetitions", errorPct: "Error Percentage", greatPlays: "Great Plays", throws: "Throw Attempts", accurateThrows: "Accurate Throws", inaccurateThrows: "Inaccurate Throws", throwAcc: "Throw Accuracy Percentage",
  trackedBip: "Tracked Game Balls in Play", weightScore: "Weight Room Development Score", workouts: "Completed Workouts", workoutCompletionPct: "Workout Completion Percentage", attendancePct: "Practice Attendance Percentage", practiceReps: "Practice Repetitions",
  gamesPlayed: "Games Played", pitchesPerPlateAppearance: "Pitches per Plate Appearance", runs: "Runs Scored", rbi: "Runs Batted In", sacrificeFlies: "Sacrifice Flies", sacrificeBunts: "Sacrifice Bunts", reachedOnError: "Reached on Error", fieldersChoice: "Fielder's Choice", stolenBases: "Stolen Bases", caughtStealing: "Caught Stealing", stolenBaseAttempts: "Stolen Base Attempts", stolenBasePct: "Stolen Base Percentage", strikeoutPct: "Strikeout Percentage", walkPct: "Walk Percentage", walkToStrikeout: "Walk to Strikeout Ratio", paPerStrikeout: "Plate Appearances per Strikeout", paPerWalk: "Plate Appearances per Walk", xbhHitPct: "Extra-Base Hit Percentage", hrPaPct: "Home Run Percentage", tbPerPa: "Total Bases per Plate Appearance",
  calledStrikePctHitting: "Called Strike Percentage", swingingStrikePctHitting: "Swinging Strike Percentage", firstPitchSwingPct: "First-Pitch Swing Percentage", twoStrikeContactPct: "Two-Strike Contact Percentage",
  appearances: "Pitching Appearances", gamesStarted: "Games Started", inningsPitched: "Innings Pitched", battersFaced: "Batters Faced", hitsAllowed: "Hits Allowed", runsAllowed: "Runs Allowed", homeRunsAllowed: "Home Runs Allowed", walksAllowed: "Walks Allowed", hitBatters: "Hit Batters", wildPitches: "Wild Pitches", whip: "Walks and Hits per Inning Pitched", strikeoutPctAllowed: "Strikeout Percentage", walkPctAllowed: "Walk Percentage", strikeoutMinusWalkPct: "Strikeout Minus Walk Percentage", strikeoutToWalk: "Strikeout to Walk Ratio", strikeoutsPerNine: "Strikeouts per Nine Innings", walksPerNine: "Walks per Nine Innings", hitsPerNine: "Hits per Nine Innings", homeRunsPerNine: "Home Runs per Nine Innings", opponentAvg: "Opponent Batting Average", opponentObp: "Opponent On-Base Percentage", opponentSlg: "Opponent Slugging Percentage", opponentOps: "Opponent On-Base Plus Slugging", opponentBabip: "Opponent Batting Average on Balls in Play", ballsInPlayAllowed: "Balls in Play Allowed", groundBallsAllowed: "Ground Balls Allowed", lineDrivesAllowed: "Line Drives Allowed", flyBallsAllowed: "Fly Balls Allowed", popUpsAllowed: "Pop Ups Allowed", groundBallPctAllowed: "Ground Ball Percentage Allowed", lineDrivePctAllowed: "Line Drive Percentage Allowed", flyBallPctAllowed: "Fly Ball Percentage Allowed", popUpPctAllowed: "Pop Up Percentage Allowed", gbFbRatioAllowed: "Ground Ball to Fly Ball Ratio Allowed", airPctAllowed: "Air Ball Percentage Allowed", hardContactAllowed: "Hard Contact Allowed", hardContactAllowedPct: "Hard Contact Percentage Allowed", softContactAllowedPct: "Soft Contact Percentage Allowed",
  pitchesPerInning: "Pitches per Inning", pitchesPerBatterFaced: "Pitches per Batter Faced", pitchesPerOut: "Pitches per Out", threePitchOuts: "Three-Pitch Outs", threePitchOutRate: "Three-Pitch Out Rate", fourPitchOuts: "Four-Pitch Outs", fourPitchOutRate: "Four-Pitch Out Rate", thirteenPitchInnings: "13-Pitch Innings", thirteenPitchInningRate: "13-Pitch Inning Rate", fifteenPitchInnings: "15-Pitch Innings", fifteenPitchInningRate: "15-Pitch Inning Rate", oneTwoThreeInnings: "1-2-3 Innings", oneTwoThreeInningRate: "1-2-3 Inning Rate", leadoffOuts: "Leadoff Outs", leadoffOutRate: "Leadoff Out Rate", scorelessInningRate: "Scoreless Inning Rate", twoStrikeFinishRate: "Two-Strike Finish Rate", putawayRate: "Putaway Rate",
};

const METRIC_KEYS: Record<string, string> = {
  avgEv: "average_exit_velocity",
  medianEv: "median_exit_velocity",
  ev90: "exit_velocity_90th_percentile",
  ev95: "exit_velocity_95th_percentile",
  maxEv: "maximum_exit_velocity",
  avgPitchVelo: "average_pitch_velocity",
  medianPitchVelo: "median_pitch_velocity",
  p90PitchVelo: "pitch_velocity_90th_percentile",
  minPitchVelo: "minimum_pitch_velocity",
  maxPitchVelo: "maximum_pitch_velocity",
  veloSpread: "velocity_delta",
};

function metricKey(id: string): string {
  return METRIC_KEYS[id] ?? id.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

export const ANALYTICS_METRICS: AnalyticsMetricDefinition[] = [
  metric("opportunities", "Opp", "hitting", "integer", ["all", "games", "practice", "live-bp"], "Tracked hitting opportunities."),
  metric("takes", "Take", "hitting", "integer", ["all", "games", "practice", "live-bp"], "Taken pitches."),
  metric("swings", "SW", "hitting", "integer", ["all", "games", "practice", "live-bp"], "Tracked swings."),
  metric("contacts", "CT", "hitting", "integer", ["all", "games", "practice", "live-bp"], "Fouls plus balls in play."),
  metric("bip", "BIP", "hitting", "integer", ["all", "games", "practice", "live-bp"], "Balls put in play."),
  metric("misses", "Whiff", "hitting", "integer", ["all", "games", "practice", "live-bp"], "Swing-and-miss results."),
  metric("fouls", "Foul", "hitting", "integer", ["all", "games", "practice", "live-bp"], "Foul balls."),
  metric("swingPct", "Swing%", "hitting", "percentage", ["all", "games", "practice", "live-bp"], "Swings divided by tracked opportunities."),
  metric("bipPct", "BIP%", "hitting", "percentage", ["all", "games", "practice", "live-bp"], "Balls in play divided by swings."),
  metric("contactPct", "Contact%", "hitting", "percentage", ["all", "games", "practice", "live-bp"], "Contact divided by swings.", ANALYTICS_SAMPLE_THRESHOLDS.hittingSwings),
  metric("swingMissPct", "Whiff%", "hitting", "percentage", ["all", "games", "practice", "live-bp"], "Misses divided by swings.", ANALYTICS_SAMPLE_THRESHOLDS.hittingSwings),
  metric("foulPct", "Foul%", "hitting", "percentage", ["all", "games", "practice", "live-bp"], "Fouls divided by swings.", ANALYTICS_SAMPLE_THRESHOLDS.hittingSwings),
  metric("takePct", "Take%", "hitting", "percentage", ["all", "games", "practice", "live-bp"], "Takes divided by tracked opportunities."),
  metric("zoneSwingPct", "Zone SW%", "hitting", "percentage", ["all", "games", "practice", "live-bp"], "Swings at charted in-zone pitches divided by charted in-zone opportunities.", ANALYTICS_SAMPLE_THRESHOLDS.hittingSwings),
  metric("zoneContactPct", "Zone CT%", "hitting", "percentage", ["all", "games", "practice", "live-bp"], "Contact on charted in-zone swings.", ANALYTICS_SAMPLE_THRESHOLDS.hittingSwings),
  metric("chasePct", "Chase%", "hitting", "percentage", ["all", "games", "practice", "live-bp"], "Swings at charted out-of-zone pitches divided by out-of-zone opportunities.", ANALYTICS_SAMPLE_THRESHOLDS.hittingSwings),
  metric("outZoneContactPct", "O-Zone CT%", "hitting", "percentage", ["all", "games", "practice", "live-bp"], "Contact on charted out-of-zone swings.", ANALYTICS_SAMPLE_THRESHOLDS.hittingSwings),
  metric("hard", "Hard", "hitting", "integer", ["all", "practice", "live-bp"], "Explicit hard-contact balls in play."),
  metric("hardPct", "Hard%", "hitting", "percentage", ["all", "practice", "live-bp"], "Hard contact divided by balls in play.", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
  metric("barrelPct", "Impact%", "hitting", "percentage", ["all", "practice", "live-bp"], "Coach-entered barrel/impact-quality contact divided by balls in play; not a Statcast barrel.", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
  metric("lineDrivePct", "LD%", "hitting", "percentage", ["all", "games", "practice", "live-bp"], "Line drives divided by balls in play.", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
  metric("groundBallPct", "GB%", "hitting", "percentage", ["all", "games", "practice", "live-bp"], "Ground balls divided by balls in play.", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
  metric("flyBallPct", "FB%", "hitting", "percentage", ["all", "games", "practice", "live-bp"], "Fly balls divided by balls in play.", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
  metric("popUpPct", "PU%", "hitting", "percentage", ["all", "games", "practice", "live-bp"], "Pop ups divided by balls in play.", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
  metric("groundBalls", "GB", "hitting", "integer", ["all", "games", "practice", "live-bp"], "Tracked ground balls."),
  metric("lineDrives", "LD", "hitting", "integer", ["all", "games", "practice", "live-bp"], "Tracked line drives."),
  metric("flyBalls", "FB", "hitting", "integer", ["all", "games", "practice", "live-bp"], "Tracked fly balls."),
  metric("popUps", "PU", "hitting", "integer", ["all", "games", "practice", "live-bp"], "Tracked pop ups."),
  metric("softPct", "Soft%", "hitting", "percentage", ["all", "practice", "live-bp"], "Poor or weak contact divided by balls in play.", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
  metric("gbFbRatio", "GB/FB", "hitting", "decimal", ["all", "games", "practice", "live-bp"], "Ground balls divided by fly balls; unavailable when no fly balls are tracked.", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
  metric("airPct", "Air%", "hitting", "percentage", ["all", "games", "practice", "live-bp"], "Line drives, fly balls, and pop ups divided by balls in play.", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
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
  metric("pitchesPerPlateAppearance", "P/PA", "hitting", "ratio", ["games"], "Confirmed pitches divided by completed plate appearances with a recorded pitch sequence."),
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
  metric("gamesPlayed", "GP", "hitting", "integer", ["games"], "Distinct confirmed games with a batter or baserunner event."),
  metric("runs", "R", "hitting", "integer", ["games"], "Confirmed runner movements to home for the player."),
  metric("rbi", "RBI", "hitting", "integer", ["games"], "Confirmed runs batted in recorded on the batter's event."),
  metric("sacrificeFlies", "SF", "hitting", "integer", ["games"], "Confirmed sacrifice fly outcomes."),
  metric("sacrificeBunts", "SH", "hitting", "integer", ["games"], "Confirmed sacrifice bunt outcomes."),
  metric("reachedOnError", "ROE", "hitting", "integer", ["games"], "Confirmed reached-on-error outcomes."),
  metric("fieldersChoice", "FC", "hitting", "integer", ["games"], "Confirmed fielder's-choice outcomes."),
  metric("stolenBases", "SB", "hitting", "integer", ["games"], "Confirmed stolen-base runner actions."),
  metric("caughtStealing", "CS", "hitting", "integer", ["games"], "Confirmed caught-stealing runner actions."),
  metric("stolenBaseAttempts", "SBA", "hitting", "integer", ["games"], "Stolen-base attempts: stolen bases plus caught stealing."),
  metric("stolenBasePct", "SB%", "hitting", "percentage", ["games"], "Stolen bases divided by stolen-base attempts (SB plus CS)."),
  metric("strikeoutPct", "K%", "hitting", "percentage", ["games"], "Strikeouts divided by completed plate appearances."),
  metric("walkPct", "BB%", "hitting", "percentage", ["games"], "Walks divided by completed plate appearances."),
  metric("walkToStrikeout", "BB/K", "hitting", "ratio", ["games"], "Walks divided by strikeouts."),
  metric("paPerStrikeout", "PA/K", "hitting", "ratio", ["games"], "Plate appearances divided by strikeouts."),
  metric("paPerWalk", "PA/BB", "hitting", "ratio", ["games"], "Plate appearances divided by walks."),
  metric("xbhHitPct", "XBH%", "hitting", "percentage", ["games"], "Extra-base hits divided by hits."),
  metric("hrPaPct", "HR%", "hitting", "percentage", ["games"], "Home runs divided by completed plate appearances."),
  metric("tbPerPa", "TB/PA", "hitting", "decimal", ["games"], "Total bases divided by completed plate appearances."),
  metric("calledStrikePctHitting", "CS%", "hitting", "percentage", ["games"], "Called strikes divided by tracked game pitches."),
  metric("swingingStrikePctHitting", "SwStr%", "hitting", "percentage", ["games"], "Swinging strikes divided by tracked game pitches."),
  metric("firstPitchSwingPct", "FPSw%", "hitting", "percentage", ["games"], "Swings on 0-0 pitches divided by tracked 0-0 pitches."),
  metric("twoStrikeContactPct", "2S CT%", "hitting", "percentage", ["games"], "Contacts on two-strike swings divided by tracked two-strike swings."),
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
  metric("zoneContactAllowedPct", "Z-Contact%", "pitching", "percentage", ["all", "practice", "live-bp", "games"], "Contact on charted in-zone swings divided by charted in-zone swings.", ANALYTICS_SAMPLE_THRESHOLDS.pitchingPitches),
  metric("chasePctAllowed", "Chase%", "pitching", "percentage", ["all", "practice", "live-bp", "games"], "Out-of-zone swings divided by charted out-of-zone pitches.", ANALYTICS_SAMPLE_THRESHOLDS.pitchingPitches),
  metric("zoneWhiffPct", "Z-Whiff%", "pitching", "percentage", ["all", "practice", "live-bp", "games"], "Whiffs on charted in-zone swings.", ANALYTICS_SAMPLE_THRESHOLDS.pitchingPitches),
  metric("outZoneWhiffPct", "O-Whiff%", "pitching", "percentage", ["all", "practice", "live-bp", "games"], "Whiffs on charted out-of-zone swings.", ANALYTICS_SAMPLE_THRESHOLDS.pitchingPitches),
  metric("firstPitchStrikePct", "FPS%", "pitching", "percentage", ["all", "practice", "live-bp", "games"], "Strikes on tracked 0-0 pitches.", 8),
  metric("avgPitchVelo", "AvgV", "pitching", "velocity", ["all", "practice", "live-bp", "games"], "Average recorded pitch velocity.", 3),
  metric("medianPitchVelo", "MedV", "pitching", "velocity", ["all", "practice", "live-bp", "games"], "Median recorded pitch velocity.", 3),
  metric("p90PitchVelo", "V90", "pitching", "velocity", ["all", "practice", "live-bp", "games"], "90th-percentile recorded pitch velocity.", ANALYTICS_SAMPLE_THRESHOLDS.pitchingVelocityPercentileSamples),
  metric("maxPitchVelo", "MaxV", "pitching", "velocity", ["all", "practice", "live-bp", "games"], "Highest recorded pitch velocity.", 1),
  metric("minPitchVelo", "MinV", "pitching", "velocity", ["all", "practice", "live-bp", "games"], "Lowest recorded pitch velocity.", 1),
  metric("veloSpread", "VeloΔ", "pitching", "velocity", ["all", "practice", "live-bp", "games"], "Highest minus lowest recorded pitch velocity.", 3),
  metric("ballsInPlayAllowed", "BIP", "pitching", "integer", ["all", "practice", "live-bp", "games"], "Balls put in play against the pitcher."),
  metric("groundBallsAllowed", "GB", "pitching", "integer", ["all", "practice", "live-bp", "games"], "Classified ground balls allowed."),
  metric("lineDrivesAllowed", "LD", "pitching", "integer", ["all", "practice", "live-bp", "games"], "Classified line drives allowed."),
  metric("flyBallsAllowed", "FB", "pitching", "integer", ["all", "practice", "live-bp", "games"], "Classified fly balls allowed."),
  metric("popUpsAllowed", "PU", "pitching", "integer", ["all", "practice", "live-bp", "games"], "Classified pop ups allowed."),
  metric("groundBallPctAllowed", "GB%", "pitching", "percentage", ["all", "practice", "live-bp", "games"], "Classified ground balls divided by classified balls in play allowed.", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
  metric("lineDrivePctAllowed", "LD%", "pitching", "percentage", ["all", "practice", "live-bp", "games"], "Classified line drives divided by classified balls in play allowed.", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
  metric("flyBallPctAllowed", "FB%", "pitching", "percentage", ["all", "practice", "live-bp", "games"], "Classified fly balls divided by classified balls in play allowed.", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
  metric("popUpPctAllowed", "PU%", "pitching", "percentage", ["all", "practice", "live-bp", "games"], "Classified pop ups divided by classified balls in play allowed.", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
  metric("gbFbRatioAllowed", "GB/FB", "pitching", "ratio", ["all", "practice", "live-bp", "games"], "Classified ground balls allowed divided by classified fly balls allowed.", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
  metric("airPctAllowed", "Air%", "pitching", "percentage", ["all", "practice", "live-bp", "games"], "Classified line drives, fly balls, and pop ups divided by classified balls in play allowed.", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
  metric("hardContactAllowed", "Hard", "pitching", "integer", ["all", "practice", "live-bp"], "Explicit hard-contact balls in play allowed."),
  metric("hardContactAllowedPct", "Hard%", "pitching", "percentage", ["all", "practice", "live-bp"], "Hard contact allowed divided by quality-classified balls in play allowed.", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
  metric("softContactAllowedPct", "Soft%", "pitching", "percentage", ["all", "practice", "live-bp"], "Weak contact allowed divided by quality-classified balls in play allowed.", ANALYTICS_SAMPLE_THRESHOLDS.hittingBallsInPlay),
  metric("appearances", "APP", "pitching", "integer", ["games"], "Distinct confirmed games with a logged pitch by the pitcher."),
  metric("gamesStarted", "GS", "pitching", "integer", ["games"], "Games where the player is the recorded starting pitcher."),
  metric("inningsPitched", "IP", "pitching", "innings", ["games"], "Outs recorded divided by three, formatted as baseball innings."),
  metric("battersFaced", "BF", "pitching", "integer", ["games"], "Completed plate appearances faced by the pitcher."),
  metric("hitsAllowed", "H", "pitching", "integer", ["games"], "Hits on completed plate appearances faced."),
  metric("runsAllowed", "R", "pitching", "integer", ["games"], "Opponent runs recorded while the pitcher is attached to the confirmed event."),
  metric("homeRunsAllowed", "HR", "pitching", "integer", ["games"], "Home runs on completed plate appearances faced."),
  metric("walksAllowed", "BB", "pitching", "integer", ["games"], "Walks on completed plate appearances faced."),
  metric("hitBatters", "HBP", "pitching", "integer", ["games"], "Hit batters on completed plate appearances faced."),
  metric("wildPitches", "WP", "pitching", "integer", ["games"], "Confirmed runner events marked Wild Pitch."),
  metric("whip", "WHIP", "pitching", "decimal", ["games"], "Walks plus hits divided by innings pitched."),
  metric("strikeoutPctAllowed", "K%", "pitching", "percentage", ["games"], "Strikeouts divided by batters faced."),
  metric("walkPctAllowed", "BB%", "pitching", "percentage", ["games"], "Walks divided by batters faced."),
  metric("strikeoutMinusWalkPct", "K-BB%", "pitching", "percentage", ["games"], "Strikeout percentage minus walk percentage."),
  metric("strikeoutToWalk", "K/BB", "pitching", "ratio", ["games"], "Strikeouts divided by walks."),
  metric("strikeoutsPerNine", "K/9", "pitching", "ratio", ["games"], "Strikeouts times nine divided by innings pitched."),
  metric("walksPerNine", "BB/9", "pitching", "ratio", ["games"], "Walks times nine divided by innings pitched."),
  metric("hitsPerNine", "H/9", "pitching", "ratio", ["games"], "Hits allowed times nine divided by innings pitched."),
  metric("homeRunsPerNine", "HR/9", "pitching", "ratio", ["games"], "Home runs allowed times nine divided by innings pitched."),
  metric("opponentAvg", "Opp AVG", "pitching", "decimal", ["games"], "Hits allowed divided by opponent at-bats."),
  metric("opponentObp", "Opp OBP", "pitching", "decimal", ["games"], "Opponent times on base divided by completed plate appearances faced."),
  metric("opponentSlg", "Opp SLG", "pitching", "decimal", ["games"], "Opponent total bases divided by opponent at-bats."),
  metric("opponentOps", "Opp OPS", "pitching", "decimal", ["games"], "Opponent OBP plus opponent SLG."),
  metric("opponentBabip", "Opp BABIP", "pitching", "decimal", ["games"], "Non-home-run hits allowed divided by non-home-run balls in play."),
  metric("pitchesPerInning", "P/IP", "pitching", "ratio", ["games"], "Pitches divided by innings pitched."),
  metric("pitchesPerBatterFaced", "P/BF", "pitching", "ratio", ["games"], "Pitches divided by batters faced."),
  metric("pitchesPerOut", "P/Out", "pitching", "ratio", ["games"], "Pitches divided by outs recorded."),
  metric("threePitchOuts", "3PO", "pitching", "integer", ["games"], "Retired plate appearances with exactly three confirmed pitches."),
  metric("threePitchOutRate", "3PO%", "pitching", "percentage", ["games"], "Three-pitch outs divided by retired plate appearances."),
  metric("fourPitchOuts", "4PO", "pitching", "integer", ["games"], "Retired plate appearances with exactly four confirmed pitches."),
  metric("fourPitchOutRate", "4PO%", "pitching", "percentage", ["games"], "Four-pitch outs divided by retired plate appearances."),
  metric("thirteenPitchInnings", "13PI", "pitching", "integer", ["games"], "Completed pitcher innings with thirteen or fewer pitches."),
  metric("thirteenPitchInningRate", "13PI%", "pitching", "percentage", ["games"], "13-pitch innings divided by completed pitcher innings."),
  metric("fifteenPitchInnings", "15PI", "pitching", "integer", ["games"], "Completed pitcher innings with fifteen or fewer pitches."),
  metric("fifteenPitchInningRate", "15PI%", "pitching", "percentage", ["games"], "15-pitch innings divided by completed pitcher innings."),
  metric("oneTwoThreeInnings", "123", "pitching", "integer", ["games"], "Completed three-out innings with no batter reaching base."),
  metric("oneTwoThreeInningRate", "123%", "pitching", "percentage", ["games"], "1-2-3 innings divided by completed pitcher innings."),
  metric("leadoffOuts", "LOO", "pitching", "integer", ["games"], "Leadoff batters retired."),
  metric("leadoffOutRate", "LOO%", "pitching", "percentage", ["games"], "Leadoff batters retired divided by leadoff batters faced."),
  metric("scorelessInningRate", "Zero%", "pitching", "percentage", ["games"], "Scoreless completed pitcher innings divided by completed pitcher innings."),
  metric("twoStrikeFinishRate", "Finish%", "pitching", "percentage", ["games"], "Two-strike plate appearances ending in an out divided by plate appearances reaching two strikes."),
  metric("putawayRate", "PutAway%", "pitching", "percentage", ["games"], "Strikeouts divided by plate appearances reaching two strikes."),
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
    "pa", "ab", "hits", "avg", "obp", "slg", "ops",
    "opportunities", "swings", "contacts", "bip", "swingPct", "contactPct", "hardPct", "avgEv", "maxEv",
    "inningsPitched", "battersFaced", "strikeouts", "walksAllowed", "whip", "pitches",
    "positionWorked", "reps", "cleanPct", "errors", "throwAcc",
    "workouts", "attendancePct", "practiceReps",
  ],
  advanced: [
    "gamesPlayed", "singles", "doubles", "triples", "homeRuns", "outs", "xbh", "hrPct", "xbhPct", "tbPerAb", "runs", "rbi", "totalBases", "walks", "hitByPitch", "strikeouts", "sacrificeFlies", "sacrificeBunts", "reachedOnError", "fieldersChoice", "iso", "babip", "xbhHitPct", "hrPaPct", "tbPerPa", "strikeoutPct", "walkPct", "walkToStrikeout", "paPerStrikeout", "paPerWalk", "pitchesPerPlateAppearance",
    "appearances", "gamesStarted", "hitsAllowed", "runsAllowed", "homeRunsAllowed", "hitBatters", "wildPitches", "strikeoutPctAllowed", "walkPctAllowed", "strikeoutMinusWalkPct", "strikeoutToWalk", "strikeoutsPerNine", "walksPerNine", "hitsPerNine", "homeRunsPerNine", "opponentAvg", "opponentObp", "opponentSlg", "opponentOps", "opponentBabip",
    "throwAcc", "errorPct", "workoutCompletionPct",
  ],
  approach: [
    "opportunities", "takes", "swings", "contacts", "misses", "fouls", "swingPct", "takePct", "contactPct", "swingMissPct", "foulPct", "zoneSwingPct", "zoneContactPct", "chasePct", "outZoneContactPct", "calledStrikePctHitting", "swingingStrikePctHitting", "firstPitchSwingPct", "twoStrikeContactPct",
  ],
  contact: [
    "bip", "trackedBip", "bipPct", "hard", "hardPct", "barrelPct", "softPct", "avgEv", "medianEv", "ev90", "ev95", "maxEv", "evSamples",
    "ballsInPlayAllowed", "groundBallsAllowed", "lineDrivesAllowed", "flyBallsAllowed", "popUpsAllowed", "groundBallPctAllowed", "lineDrivePctAllowed", "flyBallPctAllowed", "popUpPctAllowed", "gbFbRatioAllowed", "airPctAllowed", "hardContactAllowed", "hardContactAllowedPct", "softContactAllowedPct",
  ],
  "batted-ball": [
    "groundBalls", "lineDrives", "flyBalls", "popUps", "groundBallPct", "lineDrivePct", "flyBallPct", "popUpPct", "gbFbRatio", "airPct", "pullPct", "middlePct", "oppoPct",
  ],
  command: [
    "pitches", "strikes", "balls", "strikePct", "ballPct", "swingPctAllowed", "firstPitchStrikePct", "zonePct", "calledStrikePct", "swStrPct", "cswPct", "whiffPct", "zoneWhiffPct", "outZoneWhiffPct", "contactAllowedPct", "zoneContactAllowedPct", "chasePctAllowed",
  ],
  efficiency: [
    "inningsPitched", "battersFaced", "pitches", "pitchesPerInning", "pitchesPerBatterFaced", "pitchesPerOut", "threePitchOuts", "threePitchOutRate", "fourPitchOuts", "fourPitchOutRate", "thirteenPitchInnings", "thirteenPitchInningRate", "fifteenPitchInnings", "fifteenPitchInningRate", "oneTwoThreeInnings", "oneTwoThreeInningRate", "leadoffOuts", "leadoffOutRate", "scorelessInningRate", "twoStrikeFinishRate", "putawayRate",
  ],
  velocity: [
    "avgPitchVelo", "medianPitchVelo", "p90PitchVelo", "minPitchVelo", "maxPitchVelo", "veloSpread",
  ],
  baserunning: [
    "stolenBases", "caughtStealing", "stolenBaseAttempts", "stolenBasePct",
  ],
  "pitch-mix": [
    "pitches", "strikePct", "ballPct", "swingPctAllowed", "whiffPct", "cswPct", "zonePct", "avgPitchVelo", "maxPitchVelo",
  ],
  development: [
    "contactPct", "hardPct", "avgEv", "medianEv", "ev90", "ev95", "maxEv", "pullPct", "middlePct", "oppoPct", "zoneContactPct", "chasePct",
    "strikePct", "cswPct", "whiffPct", "zonePct", "firstPitchStrikePct", "avgPitchVelo", "medianPitchVelo", "p90PitchVelo", "maxPitchVelo", "minPitchVelo", "veloSpread",
    "cleanPct", "throwAcc", "greatPlays", "missedReps", "weightScore", "workoutCompletionPct", "attendancePct", "practiceReps",
  ],
  position: [
    "positionWorked", "reps", "cleanReps", "cleanPct", "errors", "fieldingErrors", "throwingErrors", "decisionErrors", "missedReps", "errorPct", "greatPlays", "throws", "accurateThrows", "inaccurateThrows", "throwAcc",
  ],
};

for (const [index, definition] of ANALYTICS_METRICS.entries()) {
  definition.presetGroups = (Object.keys(ANALYTICS_COLUMN_PRESETS) as Array<Exclude<AnalyticsColumnPreset, "custom">>)
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
  if (definition?.presetGroups?.includes("efficiency")) return "Efficiency";
  if (definition?.presetGroups?.includes("command")) return "Command";
  if (definition?.presetGroups?.includes("velocity")) return "Velocity";
  if (definition?.presetGroups?.includes("pitch-mix")) return "Pitch Mix";
  if (definition?.presetGroups?.includes("baserunning")) return "Baserunning";
  if (definition?.presetGroups?.includes("approach")) return "Approach";
  if (definition?.presetGroups?.includes("contact")) return "Contact";
  if (definition?.presetGroups?.includes("batted-ball")) return "Batted Ball";
  if (definition?.presetGroups?.includes("position")) return "Position";
  if (definition?.presetGroups?.includes("advanced")) return "Rates & Outcomes";
  return "Development";
}

export function analyticsPresetsForDomain(domain: AnalyticsDomain): Array<Exclude<AnalyticsColumnPreset, "custom">> {
  if (domain === "hitting") return ["standard", "advanced", "approach", "contact", "batted-ball", "baserunning", "development"];
  if (domain === "pitching") return ["standard", "advanced", "command", "efficiency", "contact", "velocity", "pitch-mix", "development"];
  if (domain === "defense") return ["standard", "development", "position"];
  return ["standard", "development"];
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
    key: metricKey(id),
    label,
    fullName: METRIC_FULL_NAMES[id] ?? label,
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

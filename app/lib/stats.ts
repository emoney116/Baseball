import type {
  AppData,
  Direction,
  HittingEvent,
  HittingSession,
  ID,
  PitchEvent,
  PitchType,
  PitchingSession,
  Practice,
} from "../types";

export interface PitchingStats {
  totalPitches: number;
  strikes: number;
  balls: number;
  strikePct: number;
  ballPct: number;
  firstPitchStrikePct: number;
  zonePct: number;
  chasePct: number;
  whiffPct: number;
  swingPct: number;
  calledStrikePct: number;
  cswPct: number;
  contactPct: number;
  hardContactPct: number;
  groundBallPct: number;
  lineDrivePct: number;
  flyBallPct: number;
  walkRate: number;
  strikeoutRate: number;
  battersFaced: number;
  pitchesPerBatter: number;
  avgVelocity?: number;
  maxVelocity?: number;
  minVelocity?: number;
  intendedTargetHitPct: number;
  gloveSideMissPct: number;
  armSideMissPct: number;
  missHighPct: number;
  missLowPct: number;
  byPitchType: Record<string, PitchTypeStats>;
}

export interface PitchTypeStats {
  pitchType: PitchType;
  pitches: number;
  usagePct: number;
  strikePct: number;
  zonePct: number;
  whiffPct: number;
  avgVelocity?: number;
  maxVelocity?: number;
  minVelocity?: number;
}

export interface HittingStats {
  totalSwings: number;
  pitchesSeen: number;
  swingPct: number;
  contactPct: number;
  whiffPct: number;
  hardHitPct: number;
  barrelPct: number;
  lineDrivePct: number;
  groundBallPct: number;
  flyBallPct: number;
  pullPct: number;
  middlePct: number;
  oppositePct: number;
  qualityContactPct: number;
  liveBpHits: number;
  liveBpAtBats: number;
  liveBpAvg: number;
  liveBpObp: number;
  liveBpSlg: number;
  liveBpOps: number;
  strikeoutPct: number;
  walkPct: number;
  ballsInPlay: number;
  extraBaseHits: number;
  exitVelocityRecorded: number;
  avgExitVelocity?: number;
  maxExitVelocity?: number;
  hardAvgExitVelocity?: number;
}

export interface Leader<T> {
  playerId: ID;
  name: string;
  value: number;
  sample: number;
  label: string;
  meta?: T;
}

export function calculatePitchingStats(events: PitchEvent[]): PitchingStats {
  const totalPitches = events.length;
  const strikes = events.filter((event) => event.isStrike).length;
  const balls = events.filter((event) => event.outcome === "Ball").length;
  const swings = events.filter((event) => event.isSwing).length;
  const whiffs = events.filter((event) => event.isWhiff).length;
  const calledStrikes = events.filter((event) => event.isCalledStrike).length;
  const ballsInPlay = events.filter((event) => event.isBallInPlay).length;
  const contacts = events.filter((event) => event.isBallInPlay || event.outcome === "Foul").length;
  const hardContacts = events.filter((event) => event.contactQuality === "Hard contact").length;
  const groundBalls = events.filter((event) => event.battedBall === "Ground ball").length;
  const lineDrives = events.filter((event) => event.battedBall === "Line drive").length;
  const flyBalls = events.filter((event) => event.battedBall === "Fly ball").length;
  const zonePitches = events.filter((event) => event.isZone).length;
  const chases = events.filter((event) => event.isChase).length;
  const firstPitchEvents = events.filter((event) => event.countBefore?.balls === 0 && event.countBefore?.strikes === 0);
  const velocities = events.map((event) => event.velocity).filter(isNumber);
  const missed = events.filter((event) => event.missedIntendedLocation && event.location && event.intendedTarget);
  const targetHits = events.filter((event) => !event.missedIntendedLocation && event.intendedTarget).length;
  const battersFaced = Math.max(1, firstPitchEvents.length);
  const liveEnders = events.filter(
    (event) => event.outcome === "HBP" || event.outcome === "Ball in play" || event.countAfter?.balls === 0 || event.countAfter?.strikes === 0,
  ).length;
  const estimatedWalks = events.filter((event) => event.countBefore?.balls === 3 && event.outcome === "Ball").length;
  const estimatedKs = events.filter((event) => event.countBefore?.strikes === 2 && (event.outcome === "Whiff" || event.outcome === "Called Strike")).length;
  const byPitchType = groupPitchTypes(events);

  return {
    totalPitches,
    strikes,
    balls,
    strikePct: pct(strikes, totalPitches),
    ballPct: pct(balls, totalPitches),
    firstPitchStrikePct: pct(firstPitchEvents.filter((event) => event.isStrike).length, firstPitchEvents.length),
    zonePct: pct(zonePitches, totalPitches),
    chasePct: pct(chases, events.filter((event) => event.isSwing && !event.isZone).length || swings),
    whiffPct: pct(whiffs, swings),
    swingPct: pct(swings, totalPitches),
    calledStrikePct: pct(calledStrikes, totalPitches),
    cswPct: pct(calledStrikes + whiffs, totalPitches),
    contactPct: pct(contacts, swings),
    hardContactPct: pct(hardContacts, ballsInPlay),
    groundBallPct: pct(groundBalls, ballsInPlay),
    lineDrivePct: pct(lineDrives, ballsInPlay),
    flyBallPct: pct(flyBalls, ballsInPlay),
    walkRate: pct(estimatedWalks, liveEnders || battersFaced),
    strikeoutRate: pct(estimatedKs, liveEnders || battersFaced),
    battersFaced,
    pitchesPerBatter: totalPitches / battersFaced,
    avgVelocity: average(velocities),
    maxVelocity: velocities.length ? Math.max(...velocities) : undefined,
    minVelocity: velocities.length ? Math.min(...velocities) : undefined,
    intendedTargetHitPct: pct(targetHits, events.filter((event) => event.intendedTarget).length),
    gloveSideMissPct: pct(missed.filter((event) => (event.location?.x ?? 0) < (event.intendedTarget?.x ?? 0)).length, missed.length),
    armSideMissPct: pct(missed.filter((event) => (event.location?.x ?? 0) > (event.intendedTarget?.x ?? 0)).length, missed.length),
    missHighPct: pct(missed.filter((event) => (event.location?.y ?? 0) < (event.intendedTarget?.y ?? 0)).length, missed.length),
    missLowPct: pct(missed.filter((event) => (event.location?.y ?? 0) > (event.intendedTarget?.y ?? 0)).length, missed.length),
    byPitchType,
  };
}

export function calculateHittingStats(events: HittingEvent[]): HittingStats {
  const pitchesSeen = events.length;
  const swings = events.filter((event) => event.action !== "Took pitch").length;
  const misses = events.filter((event) => event.action === "Miss").length;
  const ballsInPlay = events.filter((event) => event.action === "Ball in play").length;
  const contacts = events.filter((event) => event.action === "Ball in play" || event.action === "Foul").length;
  const hard = events.filter((event) => event.contactQuality === "Hard" || event.contactQuality === "Barrel").length;
  const barrels = events.filter((event) => event.contactQuality === "Barrel").length;
  const lines = events.filter((event) => event.contactResult === "Line drive").length;
  const ground = events.filter((event) => event.contactResult === "Ground ball").length;
  const fly = events.filter((event) => event.contactResult === "Fly ball").length;
  const pull = events.filter((event) => isPull(event.direction)).length;
  const middle = events.filter((event) => isMiddle(event.direction)).length;
  const oppo = events.filter((event) => isOppo(event.direction)).length;
  const live = events.filter((event) => event.isLiveBp);
  const liveHits = live.filter((event) => event.action === "Ball in play" && (event.contactQuality === "Hard" || event.contactQuality === "Barrel" || event.contactResult === "Line drive")).length;
  const extraBaseHits = live.filter((event) => event.contactQuality === "Barrel").length;
  const liveAtBats = Math.max(1, live.filter((event) => event.action !== "Took pitch").length);
  const walks = live.filter((event) => event.action === "Took pitch").length;
  const strikeouts = live.filter((event) => event.action === "Miss").length;
  const totalBases = liveHits + extraBaseHits * 2;
  const liveAvg = liveHits / liveAtBats;
  const liveObp = (liveHits + walks) / Math.max(1, liveAtBats + walks);
  const liveSlg = totalBases / liveAtBats;
  const exitVelocities = events.map((event) => event.exitVelocityMph).filter(isNumber);
  const hardExitVelocities = events
    .filter((event) => event.contactQuality === "Hard" || event.contactQuality === "Barrel")
    .map((event) => event.exitVelocityMph)
    .filter(isNumber);

  return {
    totalSwings: swings,
    pitchesSeen,
    swingPct: pct(swings, pitchesSeen),
    contactPct: pct(contacts, swings),
    whiffPct: pct(misses, swings),
    hardHitPct: pct(hard, ballsInPlay),
    barrelPct: pct(barrels, ballsInPlay),
    lineDrivePct: pct(lines, ballsInPlay),
    groundBallPct: pct(ground, ballsInPlay),
    flyBallPct: pct(fly, ballsInPlay),
    pullPct: pct(pull, ballsInPlay),
    middlePct: pct(middle, ballsInPlay),
    oppositePct: pct(oppo, ballsInPlay),
    qualityContactPct: pct(hard + events.filter((event) => event.contactQuality === "Solid").length, ballsInPlay),
    liveBpHits: liveHits,
    liveBpAtBats: liveAtBats,
    liveBpAvg: liveAvg,
    liveBpObp: liveObp,
    liveBpSlg: liveSlg,
    liveBpOps: liveObp + liveSlg,
    strikeoutPct: pct(strikeouts, liveAtBats),
    walkPct: pct(walks, liveAtBats + walks),
    ballsInPlay,
    extraBaseHits,
    exitVelocityRecorded: exitVelocities.length,
    avgExitVelocity: average(exitVelocities),
    maxExitVelocity: exitVelocities.length ? Math.max(...exitVelocities) : undefined,
    hardAvgExitVelocity: average(hardExitVelocities),
  };
}

export function playerPitchEvents(data: AppData, playerId: ID): PitchEvent[] {
  return data.pitchEvents.filter((event) => event.pitcherId === playerId);
}

export function playerHittingEvents(data: AppData, playerId: ID): HittingEvent[] {
  return data.hittingEvents.filter((event) => event.hitterId === playerId);
}

export function practicePitchEvents(data: AppData, practiceId: ID): PitchEvent[] {
  return data.pitchEvents.filter((event) => event.practiceId === practiceId);
}

export function practiceHittingEvents(data: AppData, practiceId: ID): HittingEvent[] {
  return data.hittingEvents.filter((event) => event.practiceId === practiceId);
}

export function activePractice(data: AppData): Practice | undefined {
  return data.practices.find((practice) => practice.id === data.settings.activePracticeId);
}

export function activePitchingSessions(data: AppData): PitchingSession[] {
  const practice = activePractice(data);
  if (!practice) return [];
  return data.pitchingSessions.filter((session) => session.practiceId === practice.id && !session.endedAt);
}

export function activeHittingSessions(data: AppData): HittingSession[] {
  const practice = activePractice(data);
  if (!practice) return [];
  return data.hittingSessions.filter((session) => session.practiceId === practice.id && !session.endedAt);
}

export function buildPitchingLeaders(data: AppData, metric: keyof PitchingStats, minPitches = 18): Leader<PitchingStats>[] {
  return data.players
    .filter((player) => player.isPitcher && !player.archived)
    .map((player) => {
      const events = playerPitchEvents(data, player.id);
      const stats = calculatePitchingStats(events);
      return {
        playerId: player.id,
        name: player.name,
        value: Number(stats[metric] ?? 0),
        sample: stats.totalPitches,
        label: metricLabel(metric),
        meta: stats,
      };
    })
    .filter((leader) => leader.sample >= minPitches)
    .sort((a, b) => b.value - a.value);
}

export function buildHittingLeaders(data: AppData, metric: keyof HittingStats, minSwings = 12): Leader<HittingStats>[] {
  return data.players
    .filter((player) => player.isHitter && !player.archived)
    .map((player) => {
      const events = playerHittingEvents(data, player.id);
      const stats = calculateHittingStats(events);
      return {
        playerId: player.id,
        name: player.name,
        value: Number(stats[metric] ?? 0),
        sample: stats.totalSwings,
        label: metricLabel(metric),
        meta: stats,
      };
    })
    .filter((leader) => leader.sample >= minSwings)
    .sort((a, b) => b.value - a.value);
}

export function trendByPractice<TEvent extends { practiceId: ID }>(
  practices: Practice[],
  events: TEvent[],
  calculateValue: (practiceEvents: TEvent[]) => number,
): Array<{ label: string; value: number }> {
  return practices
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((practice) => ({
      label: shortDate(practice.date),
      value: calculateValue(events.filter((event) => event.practiceId === practice.id)),
    }));
}

export function formatPct(value: number | undefined, digits = 0): string {
  if (!isNumber(value)) return "--";
  return `${value.toFixed(digits)}%`;
}

export function formatDecimal(value: number | undefined, digits = 3): string {
  if (!isNumber(value)) return "--";
  return value.toFixed(digits).replace(/^0/, "");
}

export function formatNumber(value: number | undefined, digits = 0): string {
  if (!isNumber(value)) return "--";
  return value.toFixed(digits);
}

export function average(values: number[]): number | undefined {
  if (!values.length) return undefined;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function pct(value: number, total: number): number {
  if (!total) return 0;
  return (value / total) * 100;
}

export function shortDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${date}T12:00:00`));
}

export function fullDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${date}T12:00:00`));
}

function groupPitchTypes(events: PitchEvent[]): Record<string, PitchTypeStats> {
  return events.reduce<Record<string, PitchTypeStats>>((groups, event) => {
    const group = groups[event.pitchType] ?? {
      pitchType: event.pitchType,
      pitches: 0,
      usagePct: 0,
      strikePct: 0,
      zonePct: 0,
      whiffPct: 0,
    };
    const groupEvents = events.filter((item) => item.pitchType === event.pitchType);
    const velocities = groupEvents.map((item) => item.velocity).filter(isNumber);

    groups[event.pitchType] = {
      ...group,
      pitches: groupEvents.length,
      usagePct: pct(groupEvents.length, events.length),
      strikePct: pct(groupEvents.filter((item) => item.isStrike).length, groupEvents.length),
      zonePct: pct(groupEvents.filter((item) => item.isZone).length, groupEvents.length),
      whiffPct: pct(groupEvents.filter((item) => item.isWhiff).length, groupEvents.filter((item) => item.isSwing).length),
      avgVelocity: average(velocities),
      maxVelocity: velocities.length ? Math.max(...velocities) : undefined,
      minVelocity: velocities.length ? Math.min(...velocities) : undefined,
    };

    return groups;
  }, {});
}

function isPull(direction?: Direction): boolean {
  return Boolean(direction && ["Pull", "LF", "LCF", "3B side"].includes(direction));
}

function isMiddle(direction?: Direction): boolean {
  return Boolean(direction && ["Center", "CF", "Middle"].includes(direction));
}

function isOppo(direction?: Direction): boolean {
  return Boolean(direction && ["Opposite", "Opposite-center", "RF", "RCF", "1B side"].includes(direction));
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function metricLabel(metric: string): string {
  const labels: Record<string, string> = {
    hardHitPct: "Hard-hit %",
    barrelPct: "Barrel %",
    contactPct: "Contact %",
    lineDrivePct: "Line-drive %",
    whiffPct: "Whiff %",
    liveBpOps: "Live BP OPS",
    strikePct: "Strike %",
    cswPct: "CSW %",
    firstPitchStrikePct: "First-pitch strike %",
    avgVelocity: "Average velocity",
    intendedTargetHitPct: "Command %",
  };

  return labels[metric] ?? metric;
}

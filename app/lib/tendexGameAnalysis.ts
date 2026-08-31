import type { GameEvent, ID, PitchType, Player } from "../types";

export const TENDEX_COUNT_BUCKETS = [
  { key: "first", label: "First Pitch", counts: ["0-0"] },
  { key: "pitcherAhead", label: "Pitcher Ahead", counts: ["0-1", "0-2", "1-2"] },
  { key: "hitterAhead", label: "Hitter Ahead", counts: ["1-0", "2-0", "2-1", "3-0", "3-1"] },
  { key: "even", label: "Even", counts: ["1-1", "2-2"] },
  { key: "twoStrike", label: "Two Strike", counts: ["0-2", "1-2", "2-2", "3-2"] },
  { key: "full", label: "Full Count", counts: ["3-2"] },
] as const;

export const TENDEX_PITCH_TYPES: PitchType[] = ["4-Seam", "2-Seam", "Sinker", "Cutter", "Slider", "Curveball", "Changeup", "Splitter", "Other"];

export type TendexPitch = {
  event: GameEvent;
  gameId: ID;
  pitcherId?: ID;
  batterId?: ID;
  batterSide: "R" | "L" | "S" | "Unknown";
  type?: PitchType;
  result: NonNullable<GameEvent["pitchOutcome"]>;
  count: string;
  countBucket: string;
  outs: number;
  previousPitchType?: PitchType;
  previousPitchResult?: GameEvent["pitchOutcome"];
  isFinalPitch: boolean;
};

export type TendexMetric = { numerator: number; denominator: number; percent: number };

const pct = (numerator: number, denominator: number) => denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
const metric = (numerator: number, denominator: number): TendexMetric => ({ numerator, denominator, percent: pct(numerator, denominator) });
const countKey = (event: GameEvent) => `${event.countBefore?.balls ?? 0}-${event.countBefore?.strikes ?? 0}`;
const countBucket = (count: string) => TENDEX_COUNT_BUCKETS.find((bucket) => bucket.counts.some((item) => item === count))?.key ?? "other";
const isSwing = (pitch: TendexPitch) => ["Swinging Strike", "Foul", "In Play"].includes(pitch.result);
const isStrike = (pitch: TendexPitch) => ["Called Strike", "Swinging Strike", "Foul", "In Play"].includes(pitch.result);
const isInZone = (event: GameEvent) => Boolean(event.location && event.location.x >= 0.3 && event.location.x <= 0.7 && event.location.y >= 0.24 && event.location.y <= 0.76);

export function normalizeTendexPitches(events: GameEvent[], players: Player[]): TendexPitch[] {
  const playerMap = new Map(players.map((player) => [player.id, player]));
  const chronological = events
    .filter((event) => event.pitchOutcome && (event.recordStatus ?? "confirmed") === "confirmed" && ["pitch", "play"].includes(event.eventKind ?? "pitch"))
    .slice()
    .sort((a, b) => (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0) || a.createdAt.localeCompare(b.createdAt));
  const previousByPlateAppearance = new Map<ID, TendexPitch>();

  return chronological.map((event) => {
    const plateAppearanceId = event.plateAppearanceId ?? `${event.gameId}:${event.plateAppearanceNumber ?? "unknown"}`;
    const previous = previousByPlateAppearance.get(plateAppearanceId);
    const count = countKey(event);
    const pitch: TendexPitch = {
      event,
      gameId: event.gameId,
      pitcherId: event.pitcherId,
      batterId: event.batterId,
      batterSide: playerMap.get(event.batterId ?? "")?.bats ?? "Unknown",
      type: event.pitchType,
      result: event.pitchOutcome!,
      count,
      countBucket: countBucket(count),
      outs: event.outsBefore,
      previousPitchType: previous?.type,
      previousPitchResult: previous?.result,
      isFinalPitch: event.eventKind === "play" || Boolean(event.ballInPlayOutcome)
        || ((event.countBefore?.strikes ?? 0) === 2 && ["Called Strike", "Swinging Strike"].includes(event.pitchOutcome!))
        || ((event.countBefore?.balls ?? 0) === 3 && event.pitchOutcome === "Ball")
        || event.pitchOutcome === "HBP",
    };
    previousByPlateAppearance.set(plateAppearanceId, pitch);
    return pitch;
  });
}

export function buildTendexMetrics(pitches: TendexPitch[]) {
  const typed = pitches.filter((pitch): pitch is TendexPitch & { type: PitchType } => Boolean(pitch.type));
  const located = pitches.filter((pitch) => pitch.event.location);
  const swings = pitches.filter(isSwing);
  const outside = located.filter((pitch) => !isInZone(pitch.event));
  const twoStrike = pitches.filter((pitch) => pitch.event.countBefore?.strikes === 2);
  const firstPitch = pitches.filter((pitch) => pitch.count === "0-0");
  const velocities = pitches.map((pitch) => pitch.event.velocity).filter((value): value is number => value !== undefined);
  const mix = TENDEX_PITCH_TYPES.map((type) => ({ type, count: typed.filter((pitch) => pitch.type === type).length }))
    .filter((row) => row.count > 0)
    .map((row) => ({ ...row, percent: pct(row.count, typed.length) }))
    .sort((a, b) => b.count - a.count);
  const rowsFor = (predicate: (pitch: TendexPitch) => boolean) => {
    const rows = typed.filter(predicate);
    return TENDEX_PITCH_TYPES.map((type) => ({ type, count: rows.filter((pitch) => pitch.type === type).length }))
      .filter((row) => row.count > 0)
      .map((row) => ({ ...row, percent: pct(row.count, rows.length) }))
      .sort((a, b) => b.count - a.count);
  };

  return {
    total: pitches.length,
    typed: typed.length,
    located: located.length,
    mix,
    quality: {
      strike: metric(pitches.filter(isStrike).length, pitches.length),
      csw: metric(pitches.filter((pitch) => ["Called Strike", "Swinging Strike"].includes(pitch.result)).length, pitches.length),
      whiff: metric(pitches.filter((pitch) => pitch.result === "Swinging Strike").length, swings.length),
      zone: metric(located.filter((pitch) => isInZone(pitch.event)).length, located.length),
      chase: metric(outside.filter(isSwing).length, outside.length),
      inPlay: metric(pitches.filter((pitch) => pitch.result === "In Play").length, pitches.length),
      putAway: metric(twoStrike.filter((pitch) => pitch.isFinalPitch && ["Called Strike", "Swinging Strike"].includes(pitch.result)).length, twoStrike.length),
      firstPitchStrike: metric(firstPitch.filter(isStrike).length, firstPitch.length),
    },
    velocity: {
      average: velocities.length ? velocities.reduce((sum, value) => sum + value, 0) / velocities.length : undefined,
      maximum: velocities.length ? Math.max(...velocities) : undefined,
      sample: velocities.length,
    },
    countBuckets: TENDEX_COUNT_BUCKETS.map((bucket) => ({ ...bucket, pitches: pitches.filter((pitch) => bucket.counts.some((count) => count === pitch.count)), rows: rowsFor((pitch) => bucket.counts.some((count) => count === pitch.count)) })),
    byOuts: [0, 1, 2].map((outs) => ({ outs, pitches: pitches.filter((pitch) => pitch.outs === outs), rows: rowsFor((pitch) => pitch.outs === outs) })),
    byBatterSide: (["R", "L", "S", "Unknown"] as const).map((side) => ({ side, pitches: pitches.filter((pitch) => pitch.batterSide === side), rows: rowsFor((pitch) => pitch.batterSide === side) })),
    sequences: [undefined, ...TENDEX_PITCH_TYPES].map((previousType) => ({ previousType, pitches: pitches.filter((pitch) => pitch.previousPitchType === previousType), rows: rowsFor((pitch) => pitch.previousPitchType === previousType) })),
    outcomeByType: TENDEX_PITCH_TYPES.map((type) => {
      const rows = typed.filter((pitch) => pitch.type === type);
      return {
        type,
        total: rows.length,
        strikes: rows.filter(isStrike).length,
        whiffs: rows.filter((pitch) => pitch.result === "Swinging Strike").length,
        inPlay: rows.filter((pitch) => pitch.result === "In Play").length,
        hits: rows.filter((pitch) => ["Single", "Double", "Triple", "Home Run"].includes(pitch.event.ballInPlayOutcome ?? "")).length,
        strikeouts: rows.filter((pitch) => pitch.isFinalPitch && ["Called Strike", "Swinging Strike"].includes(pitch.result) && pitch.event.countBefore?.strikes === 2).length,
      };
    }).filter((row) => row.total > 0),
  };
}

type PredictionContext = { pitcherId?: ID; batterSide?: string; count: string; previousPitchType?: PitchType; outs: number };

function matches(pitch: TendexPitch, context: PredictionContext, fields: Array<"pitcher" | "count" | "bucket" | "side" | "previous" | "outs">) {
  return fields.every((field) => {
    if (field === "pitcher") return Boolean(context.pitcherId) && pitch.pitcherId === context.pitcherId;
    if (field === "count") return pitch.count === context.count;
    if (field === "bucket") return pitch.countBucket === countBucket(context.count);
    if (field === "side") return Boolean(context.batterSide && context.batterSide !== "Unknown") && pitch.batterSide === context.batterSide;
    if (field === "previous") return Boolean(context.previousPitchType) && pitch.previousPitchType === context.previousPitchType;
    return pitch.outs === context.outs;
  });
}

function selectPrior(pitches: TendexPitch[], context: PredictionContext, minimum: number) {
  const tiers: Array<{ source: string; fields: Parameters<typeof matches>[2] }> = [
    { source: "pitcher-count-side-sequence-outs", fields: ["pitcher", "count", "side", "previous", "outs"] },
    { source: "pitcher-count-side", fields: ["pitcher", "count", "side"] },
    { source: "pitcher-count-bucket-side", fields: ["pitcher", "bucket", "side"] },
    { source: "pitcher-count", fields: ["pitcher", "count"] },
    { source: "pitcher-count-bucket", fields: ["pitcher", "bucket"] },
    { source: "pitcher-side", fields: ["pitcher", "side"] },
    { source: "pitcher", fields: ["pitcher"] },
    { source: "all-season", fields: [] },
  ];
  for (const tier of tiers) {
    const rows = pitches.filter((pitch) => pitch.type && matches(pitch, context, tier.fields));
    if (rows.length >= (tier.source === "pitcher" || tier.source === "all-season" ? 1 : minimum)) return { rows, source: tier.source };
  }
  return { rows: [] as TendexPitch[], source: "uniform" };
}

export function buildTendexPrediction(seasonPitches: TendexPitch[], gamePitches: TendexPitch[], context: PredictionContext, shrinkageK = 50) {
  const season = selectPrior(seasonPitches, context, 10);
  const game = selectPrior(gamePitches, context, 1);
  const seasonCounts = new Map(TENDEX_PITCH_TYPES.map((type) => [type, season.rows.filter((pitch) => pitch.type === type).length]));
  const gameCounts = new Map(TENDEX_PITCH_TYPES.map((type) => [type, game.rows.filter((pitch) => pitch.type === type).length]));
  const probabilities = TENDEX_PITCH_TYPES.map((type) => {
    const prior = season.rows.length ? (seasonCounts.get(type) ?? 0) / season.rows.length : 1 / TENDEX_PITCH_TYPES.length;
    const raw = (prior * shrinkageK + (gameCounts.get(type) ?? 0)) / (shrinkageK + game.rows.length);
    return { type, probability: Math.round(raw * 100), raw };
  }).sort((a, b) => b.raw - a.raw);
  const totalRounded = probabilities.reduce((sum, row) => sum + row.probability, 0);
  if (probabilities.length && totalRounded !== 100) probabilities[0].probability += 100 - totalRounded;
  const gap = (probabilities[0]?.probability ?? 0) - (probabilities[1]?.probability ?? 0);
  const confidence = season.rows.length === 0 && game.rows.length < 12 ? "Collecting" : gap >= 18 && (season.rows.length >= 20 || game.rows.length >= 20) ? "Strong" : gap >= 10 && (season.rows.length >= 10 || game.rows.length >= 8) ? "Medium" : "Lean";
  return {
    model: "hierarchical-bayes-season-game-v1",
    probabilities: probabilities.map((row) => ({ type: row.type, probability: row.probability })),
    topPitch: probabilities[0]?.type,
    topProbability: probabilities[0]?.probability ?? 0,
    confidence,
    evidence: { seasonSample: season.rows.length, gameSample: game.rows.length, priorSource: season.source, gameSource: game.source, priorWeight: pct(shrinkageK, shrinkageK + game.rows.length), gameWeight: pct(game.rows.length, shrinkageK + game.rows.length) },
  };
}

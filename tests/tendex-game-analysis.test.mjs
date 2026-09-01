import assert from "node:assert/strict";
import test from "node:test";
import { buildTendexMetrics, buildTendexPrediction, normalizeTendexPitches } from "../app/lib/tendexGameAnalysis.ts";

const players = [
  { id: "pitcher", name: "Pitcher", bats: "R", throws: "R" },
  { id: "batter", name: "Batter", bats: "L", throws: "R" },
];

function event(index, patch = {}) {
  return {
    id: `e${index}`,
    gameId: patch.gameId ?? "g1",
    inning: 1,
    half: "Top",
    pitcherId: "pitcher",
    batterId: "batter",
    pitchType: "4-Seam",
    pitchOutcome: "Called Strike",
    eventKind: "pitch",
    sequenceNumber: index,
    plateAppearanceId: patch.plateAppearanceId ?? "pa1",
    countBefore: { balls: 0, strikes: 0 },
    countAfter: { balls: 0, strikes: 1 },
    outsBefore: 0,
    outsAfter: 0,
    metrolinaRunsBefore: 0,
    metrolinaRunsAfter: 0,
    opponentRunsBefore: 0,
    opponentRunsAfter: 0,
    situations: [],
    recordStatus: "confirmed",
    createdAt: `2026-08-28T12:00:${String(index).padStart(2, "0")}.000Z`,
    ...patch,
  };
}

test("Tendex metrics calculate CSW, whiff, chase, zone, and sequence denominators", () => {
  const pitches = normalizeTendexPitches([
    event(1, { location: { x: 0.5, y: 0.5 } }),
    event(2, { pitchType: "Slider", pitchOutcome: "Swinging Strike", countBefore: { balls: 0, strikes: 1 }, location: { x: 0.82, y: 0.5 } }),
    event(3, { pitchType: "Slider", pitchOutcome: "Foul", countBefore: { balls: 0, strikes: 2 }, location: { x: 0.75, y: 0.5 } }),
  ], players);
  const metrics = buildTendexMetrics(pitches);
  assert.deepEqual(metrics.quality.csw, { numerator: 2, denominator: 3, percent: 67 });
  assert.deepEqual(metrics.quality.whiff, { numerator: 1, denominator: 2, percent: 50 });
  assert.deepEqual(metrics.quality.zone, { numerator: 1, denominator: 3, percent: 33 });
  assert.deepEqual(metrics.quality.chase, { numerator: 2, denominator: 2, percent: 100 });
  assert.equal(metrics.sequences.find((row) => row.previousType === "4-Seam")?.rows[0].type, "Slider");
});

test("Tendex prediction preserves a strong season prior against one live pitch", () => {
  const seasonEvents = [
    ...Array.from({ length: 80 }, (_, index) => event(index + 1, { gameId: "season", plateAppearanceId: `s${index}` })),
    ...Array.from({ length: 20 }, (_, index) => event(index + 101, { gameId: "season", plateAppearanceId: `x${index}`, pitchType: "Slider" })),
  ];
  const gameEvents = [event(201, { gameId: "live", plateAppearanceId: "live-pa", pitchType: "Slider" })];
  const prediction = buildTendexPrediction(
    normalizeTendexPitches(seasonEvents, players),
    normalizeTendexPitches(gameEvents, players),
    { pitcherId: "pitcher", batterSide: "L", count: "0-0", outs: 0 },
  );
  assert.equal(prediction.model, "hierarchical-bayes-season-game-v1");
  assert.equal(prediction.topPitch, "4-Seam");
  assert.ok(prediction.topProbability > 70);
  assert.equal(prediction.evidence.gameSample, 1);
  assert.equal(prediction.probabilities.reduce((sum, row) => sum + row.probability, 0), 100);
});

test("voided pitches never enter Tendex metrics or prediction samples", () => {
  const pitches = normalizeTendexPitches([event(1), event(2, { recordStatus: "voided", pitchType: "Slider" })], players);
  assert.equal(pitches.length, 1);
  assert.equal(buildTendexMetrics(pitches).total, 1);
});

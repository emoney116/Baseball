import assert from "node:assert/strict";
import test from "node:test";
import { calculateHittingStats, calculatePitchingStats, pct } from "../app/lib/stats.ts";
import { isPracticeHardContactEvent, PRACTICE_HITTING_RESULT_OPTIONS } from "../app/lib/hittingTaxonomy.ts";

const now = "2026-08-12T22:00:00.000Z";

function hittingEvent(id, action, contactResult, contactQuality, direction = "Middle", overrides = {}) {
  return {
    id,
    practiceId: "practice-test",
    sessionId: "session-hit",
    hitterId: "player-hitter",
    eventNumber: Number(id.replace(/\D/g, "")) || 1,
    action,
    contactResult,
    contactQuality,
    direction,
    isLiveBp: false,
    createdAt: now,
    ...overrides,
  };
}

function pitchEvent(id, outcome, overrides = {}) {
  const isBip = outcome === "Ball in play";
  const isSwing = ["Swing", "Whiff", "Foul", "Ball in play"].includes(outcome);
  const location = outcome === "Ball"
    ? { x: 0.5, y: 0.1, zoneId: "pitch_r1c3", zoneLabel: "Up", isZone: false }
    : { x: 0.5, y: 0.5, zoneId: "pitch_r3c3", zoneLabel: "Middle", isZone: true };
  return {
    id,
    practiceId: "practice-test",
    sessionId: "session-pitch",
    pitcherId: "player-pitcher",
    pitchNumber: Number(id.replace(/\D/g, "")) || 1,
    pitchType: "4-Seam",
    outcome,
    isStrike: outcome !== "Ball" && outcome !== "HBP",
    isSwing,
    isZone: location.isZone,
    isWhiff: outcome === "Whiff",
    isCalledStrike: outcome === "Called Strike",
    isBallInPlay: isBip,
    location,
    createdAt: now,
    ...overrides,
  };
}

test("practice hitting metrics preserve sample denominators", () => {
  const stats = calculateHittingStats([
    hittingEvent("he-1", "Miss"),
    hittingEvent("he-2", "Foul"),
    hittingEvent("he-3", "Ball in play", "Line drive", "Barrel"),
    hittingEvent("he-4", "Ball in play", "Ground ball", "Hard"),
    hittingEvent("he-5", "Ball in play", "Fly ball", "Solid"),
  ]);

  assert.equal(stats.totalSwings, 5);
  assert.equal(stats.ballsInPlay, 3);
  assert.equal(stats.contactPct, 80);
  assert.equal(Math.round(stats.hardHitPct), 67);
  assert.equal(Math.round(stats.barrelPct), 33);
  assert.equal(Math.round(stats.lineDrivePct), 33);
});

test("practice hitting taxonomy centralizes hard-contact outcomes", () => {
  const events = PRACTICE_HITTING_RESULT_OPTIONS.map((option, index) => hittingEvent(
    `he-tax-${index}`,
    option.action,
    option.contactResult,
    option.contactQuality,
  ));
  const hardLabels = events
    .filter(isPracticeHardContactEvent)
    .map((event) => PRACTICE_HITTING_RESULT_OPTIONS.find((option) => option.contactResult === event.contactResult && option.contactQuality === event.contactQuality)?.label)
    .filter(Boolean);

  assert.deepEqual(hardLabels, ["Hard Ground Ball", "Line Drive", "Hard Fly Ball"]);
  assert.equal(isPracticeHardContactEvent(hittingEvent("he-fly", "Ball in play", "Fly ball", "Solid")), false);
  assert.equal(isPracticeHardContactEvent(hittingEvent("he-miss", "Miss")), false);
});

test("practice hitting metrics calculate exit velocity from recorded swings only", () => {
  const stats = calculateHittingStats([
    hittingEvent("he-1", "Ball in play", "Line drive", "Hard", "Middle", { exitVelocityMph: 88 }),
    hittingEvent("he-2", "Miss"),
    hittingEvent("he-3", "Ball in play", "Ground ball", "Hard", "Middle", { exitVelocityMph: 91.5 }),
    hittingEvent("he-4", "Ball in play", "Line drive", "Solid", "Middle", { exitVelocityMph: 86 }),
  ]);

  assert.equal(stats.totalSwings, 4);
  assert.equal(stats.exitVelocityRecorded, 3);
  assert.equal(stats.avgExitVelocity, 88.5);
  assert.equal(stats.maxExitVelocity, 91.5);
  assert.equal(stats.hardAvgExitVelocity, 89.75);
});

test("practice pitching metrics calculate strikes, zone, CSW, and velocity", () => {
  const stats = calculatePitchingStats([
    pitchEvent("pe-1", "Called Strike", { velocity: 82 }),
    pitchEvent("pe-2", "Whiff", { velocity: 84 }),
    pitchEvent("pe-3", "Ball", { isStrike: false, isZone: false, velocity: 81 }),
    pitchEvent("pe-4", "Foul", { velocity: 83 }),
    pitchEvent("pe-5", "Ball in play", { battedBall: "Ground ball", velocity: 85 }),
  ]);

  assert.equal(stats.totalPitches, 5);
  assert.equal(stats.strikes, 4);
  assert.equal(stats.strikePct, 80);
  assert.equal(stats.zonePct, 80);
  assert.equal(stats.cswPct, 40);
  assert.equal(stats.avgVelocity, 83);
  assert.equal(stats.maxVelocity, 85);
});

test("attendance helper treats zero sample as zero percent", () => {
  assert.equal(pct(0, 0), 0);
});

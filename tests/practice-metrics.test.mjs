import assert from "node:assert/strict";
import test from "node:test";
import { calculateHittingStats, calculatePitchingStats, pct } from "../app/lib/stats.ts";

const now = "2026-08-12T22:00:00.000Z";

function hittingEvent(id, action, contactResult, contactQuality, direction = "Middle") {
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
  };
}

function pitchEvent(id, outcome, overrides = {}) {
  const isBip = outcome === "Ball in play";
  const isSwing = ["Swing", "Whiff", "Foul", "Ball in play"].includes(outcome);
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
    isZone: true,
    isWhiff: outcome === "Whiff",
    isCalledStrike: outcome === "Called Strike",
    isBallInPlay: isBip,
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

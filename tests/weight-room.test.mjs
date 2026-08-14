import assert from "node:assert/strict";
import test from "node:test";
import { buildWeightRoomLeaderboard, calculateWeightRoomScore } from "../app/lib/weightRoom.ts";

const now = "2026-08-13T22:00:00.000Z";

function player(id, name, weight) {
  return {
    id,
    name,
    jerseyNumber: Number(id.replace(/\D/g, "")) || 1,
    primaryPosition: "CF",
    bats: "R",
    throws: "R",
    graduationYear: 2027,
    avatarColor: "#9f244c",
    isPitcher: true,
    isHitter: true,
    weight,
    createdAt: now,
    updatedAt: now,
  };
}

function session(id, playerId, date, completed = true, effortScore = 8) {
  return {
    id,
    playerId,
    date,
    weekOf: "2026-08-10",
    day: "Thu",
    completed,
    effortScore,
    createdAt: now,
    updatedAt: now,
  };
}

function entry(id, sessionId, playerId, exercise, overrides = {}) {
  return {
    id,
    sessionId,
    playerId,
    exercise,
    kind: "Lift",
    setNumber: Number(id.replace(/\D/g, "")) || 1,
    weight: 100,
    reps: 5,
    sets: 1,
    rpe: 8,
    status: "Completed",
    entrySource: "COACH",
    createdAt: now,
    ...overrides,
  };
}

test("weight room leaderboard rewards development over raw size", () => {
  const improving = player("p1", "Improving Sophomore", 150);
  const strong = player("p2", "Big Senior", 220);
  const sessions = [
    session("ws1", improving.id, "2026-08-11", true, 9),
    session("ws2", improving.id, "2026-08-13", true, 9),
    session("ws3", strong.id, "2026-08-11", true, 7),
    session("ws4", strong.id, "2026-08-13", false, 7),
  ];
  const entries = [
    entry("we1", "ws1", improving.id, "Back Squat", { weight: 180, reps: 5, priorValue: 150 }),
    entry("we2", "ws2", improving.id, "Back Squat", { weight: 185, reps: 5, priorValue: 155 }),
    entry("we3", "ws3", strong.id, "Back Squat", { weight: 300, reps: 5, priorValue: 300 }),
    entry("we4", "ws4", strong.id, "Back Squat", { weight: 300, reps: 5, priorValue: 300 }),
    entry("we5", "ws3", strong.id, "Bench Press", { weight: 225, reps: 5, priorValue: 225 }),
    entry("we6", "ws4", strong.id, "Bench Press", { weight: 225, reps: 5, priorValue: 225 }),
  ];

  const rows = buildWeightRoomLeaderboard([strong, improving], sessions, entries, "This Season");

  assert.equal(rows[0].player.id, improving.id);
  assert.ok(rows[0].score > rows[1].score);
});

test("weight room scoring tolerates missing optional weigh-in and RPE data", () => {
  const athlete = player("p3", "No Weigh In", undefined);
  const sessions = [session("ws5", athlete.id, "2026-08-11", true, 0)];
  const entries = Array.from({ length: 4 }, (_, index) =>
    entry(`we-missing-${index}`, "ws5", athlete.id, "Pull Ups", {
      kind: "Test",
      weight: undefined,
      reps: 8 + index,
      rpe: undefined,
      priorValue: index === 0 ? 7 : undefined,
    }),
  );

  const score = calculateWeightRoomScore(athlete, sessions, entries);

  assert.equal(score.qualified, true);
  assert.ok(score.score > 0);
  assert.equal(score.breakdown.find((part) => part.label === "Relative Performance")?.value, 0);
});

test("weight room scoring treats lower timed results as improvement", () => {
  const athlete = player("p4", "Fast Runner", 170);
  const sessions = [session("ws6", athlete.id, "2026-08-13", true, 8)];
  const entries = [
    entry("we-speed-1", "ws6", athlete.id, "Sprint", { kind: "Speed", weight: undefined, value: 6.5, unit: "sec", priorValue: 7 }),
    entry("we-speed-2", "ws6", athlete.id, "Sprint", { kind: "Speed", weight: undefined, value: 6.6, unit: "sec", priorValue: 7.1 }),
    entry("we-speed-3", "ws6", athlete.id, "Sprint", { kind: "Speed", weight: undefined, value: 6.55, unit: "sec", priorValue: 7 }),
    entry("we-speed-4", "ws6", athlete.id, "Sprint", { kind: "Speed", weight: undefined, value: 6.45, unit: "sec", priorValue: 7 }),
  ];

  const score = calculateWeightRoomScore(athlete, sessions, entries);

  assert.equal(score.qualified, true);
  assert.ok(score.progressPct > 0);
});

test("weight room entries remain append-shaped across concurrent station logging", () => {
  const athlete = player("p5", "Concurrent Athlete", 180);
  const sessions = [session("ws7", athlete.id, "2026-08-13", true, 8)];
  const squatEntries = Array.from({ length: 20 }, (_, index) =>
    entry(`we-squat-${index}`, "ws7", athlete.id, "Back Squat", { weight: 185 + index, reps: 5, priorValue: 180 }),
  );
  const benchEntries = Array.from({ length: 20 }, (_, index) =>
    entry(`we-bench-${index}`, "ws7", athlete.id, "Bench Press", { weight: 135 + index, reps: 6, priorValue: 130 }),
  );
  const rows = buildWeightRoomLeaderboard([athlete], sessions, [...squatEntries, ...benchEntries], "This Season");

  assert.equal(rows.length, 1);
  assert.equal(rows[0].sets, 40);
  assert.equal(rows[0].volume, [...squatEntries, ...benchEntries].reduce((total, item) => total + item.weight * item.reps, 0));
});

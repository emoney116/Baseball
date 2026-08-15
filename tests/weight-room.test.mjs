import assert from "node:assert/strict";
import test from "node:test";
import {
  WEIGHT_ROOM_MIN_TRACKED_SETS,
  buildWeightRoomLeaderboard,
  calculateWeightRoomScore,
} from "../app/lib/weightRoom.ts";

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

function session(id, playerId, date, completed = true, effortScore = 8, overrides = {}) {
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
    ...overrides,
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
    session("ws1", improving.id, "2026-08-11", true, 9, { bodyWeight: 150 }),
    session("ws2", improving.id, "2026-08-13", true, 9, { bodyWeight: 150 }),
    session("ws3", strong.id, "2026-08-11", true, 7, { bodyWeight: 220 }),
    session("ws4", strong.id, "2026-08-13", false, 7, { bodyWeight: 220 }),
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
  assert.equal(score.relativePerformanceAvailable, false);
  assert.equal(score.effortAvailable, false);
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

test("weight room qualification keeps athletes below minimum samples out of ranking", () => {
  const athlete = player("p6", "Building Sample", 180);
  const sessions = [session("ws8", athlete.id, "2026-08-13", true, 8)];
  const entries = Array.from({ length: WEIGHT_ROOM_MIN_TRACKED_SETS - 1 }, (_, index) =>
    entry(`we-qual-${index}`, "ws8", athlete.id, "Back Squat", { weight: 185 + index, reps: 5 }),
  );

  const score = calculateWeightRoomScore(athlete, sessions, entries);
  const rows = buildWeightRoomLeaderboard([athlete], sessions, entries, "This Season");

  assert.equal(score.qualified, false);
  assert.equal(score.score, 0);
  assert.equal(rows.length, 0);
});

test("weight room scoring does not turn one no-comparison workout into a perfect leader", () => {
  const athlete = player("p7", "Single Lift", 180);
  const sessions = [session("ws9", athlete.id, "2026-08-13", true, 8)];
  const entries = Array.from({ length: WEIGHT_ROOM_MIN_TRACKED_SETS }, (_, index) =>
    entry(`we-single-${index}`, "ws9", athlete.id, "Back Squat", {
      weight: 400,
      reps: 5,
      rpe: undefined,
      priorValue: undefined,
    }),
  );

  const score = calculateWeightRoomScore(athlete, sessions, entries);

  assert.equal(score.qualified, true);
  assert.ok(score.score < 100);
  assert.equal(score.hasComparableHistory, false);
  assert.ok(score.reasons.includes("Baseline established"));
});

test("weight room scoring uses recent workout bodyweight for relative performance", () => {
  const athlete = player("p8", "Recent Weigh In", 120);
  const sessions = [session("ws10", athlete.id, "2026-08-13", true, 8, { bodyWeight: 200 })];
  const entries = Array.from({ length: WEIGHT_ROOM_MIN_TRACKED_SETS }, (_, index) =>
    entry(`we-relative-${index}`, "ws10", athlete.id, "Back Squat", {
      weight: 200,
      reps: 5,
      priorValue: 200,
    }),
  );

  const score = calculateWeightRoomScore(athlete, sessions, entries);
  const relative = score.breakdown.find((part) => part.label === "Relative Performance");

  assert.equal(score.relativePerformanceAvailable, true);
  assert.equal(relative?.value, 12);
});

test("weight room leaderboard periods can rank different athletes", () => {
  const week = player("p9", "Week Mover", 175);
  const month = player("p10", "Month Mover", 175);
  const season = player("p11", "Season Mover", 175);
  const sessions = [
    session("ws-week-1", week.id, "2026-08-11", true, 8, { bodyWeight: 175 }),
    session("ws-week-2", week.id, "2026-08-13", true, 8, { bodyWeight: 175 }),
    session("ws-month-1", month.id, "2026-08-02", true, 9, { bodyWeight: 175 }),
    session("ws-month-2", month.id, "2026-08-04", true, 9, { bodyWeight: 175 }),
    session("ws-season-1", season.id, "2026-07-12", true, 10, { bodyWeight: 175 }),
    session("ws-season-2", season.id, "2026-07-14", true, 10, { bodyWeight: 175 }),
  ];
  const entries = [
    entry("we-week-1", "ws-week-1", week.id, "Back Squat", { weight: 190, priorValue: 175 }),
    entry("we-week-2", "ws-week-2", week.id, "Back Squat", { weight: 192, priorValue: 178 }),
    entry("we-month-1", "ws-month-1", month.id, "Back Squat", { weight: 205, priorValue: 175 }),
    entry("we-month-2", "ws-month-2", month.id, "Back Squat", { weight: 207, priorValue: 177 }),
    entry("we-season-1", "ws-season-1", season.id, "Back Squat", { weight: 220, priorValue: 175 }),
    entry("we-season-2", "ws-season-2", season.id, "Back Squat", { weight: 222, priorValue: 177 }),
  ];

  const weekRows = buildWeightRoomLeaderboard([week, month, season], sessions, entries, "This Week", "2026-08-14");
  const monthRows = buildWeightRoomLeaderboard([week, month, season], sessions, entries, "This Month", "2026-08-14");
  const seasonRows = buildWeightRoomLeaderboard([week, month, season], sessions, entries, "This Season", "2026-08-14");

  assert.equal(weekRows[0].player.id, week.id);
  assert.equal(monthRows[0].player.id, month.id);
  assert.equal(seasonRows[0].player.id, season.id);
});

test("weight room scoring counts modified tracked sets without treating skipped sets as complete", () => {
  const athlete = player("p12", "Modified Athlete", 180);
  const sessions = [session("ws11", athlete.id, "2026-08-13", true, 8, { bodyWeight: 180 })];
  const entries = [
    entry("we-mod-1", "ws11", athlete.id, "Back Squat", { status: "Modified", sets: WEIGHT_ROOM_MIN_TRACKED_SETS, weight: 160, priorValue: 150 }),
    entry("we-skip-1", "ws11", athlete.id, "Back Squat", { status: "Skipped", sets: 10, weight: 500, priorValue: 450 }),
  ];

  const score = calculateWeightRoomScore(athlete, sessions, entries);

  assert.equal(score.qualified, true);
  assert.equal(score.sets, WEIGHT_ROOM_MIN_TRACKED_SETS);
});

test("weight room scoring caps extreme improvement outliers", () => {
  const athlete = player("p13", "Outlier Athlete", 180);
  const sessions = [session("ws12", athlete.id, "2026-08-11", true, 8), session("ws13", athlete.id, "2026-08-13", true, 8)];
  const entries = [
    entry("we-outlier-1", "ws12", athlete.id, "Back Squat", { weight: 1000, priorValue: 10 }),
    entry("we-outlier-2", "ws13", athlete.id, "Back Squat", { weight: 1200, priorValue: 10 }),
  ];

  const score = calculateWeightRoomScore(athlete, sessions, entries);

  assert.equal(score.progressPct, 20);
});

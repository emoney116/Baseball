import assert from "node:assert/strict";
import test from "node:test";
import { applyGameAdjustment, applyRunnerAction, applyScoredPlay, applyTrackedPitch, moveRunnerToDestination, restoreGameSnapshot, snapshotGame, suggestedPlayMovements, validateScoredPlay } from "../app/lib/gameTracking.ts";

test("tracked pitches preserve the Tendex-style count rules", () => {
  let game = makeGame();
  game = applyTrackedPitch(game, "Called Strike");
  game = applyTrackedPitch(game, "Foul");
  game = applyTrackedPitch(game, "Foul");
  assert.deepEqual([game.balls, game.strikes, game.outs], [0, 2, 0]);
  game = applyTrackedPitch(game, "Swinging Strike");
  assert.deepEqual([game.balls, game.strikes, game.outs], [0, 0, 1]);
  assert.equal(game.currentBatterId, "p2");
});

test("walks force only runners who must advance", () => {
  const game = makeGame({ balls: 3, runners: { first: "r1", second: "r2", third: "r3" } });
  const next = applyTrackedPitch(game, "Ball");
  assert.equal(next.metrolinaScore, 1);
  assert.deepEqual(next.runners, { first: "p1", second: "r1", third: "r2" });
});

test("away team runs score in the top half", () => {
  const game = makeGame({ homeAway: "Away", half: "Top", runners: { second: "r2", third: "r3" } });
  const next = applyTrackedPitch(game, "In Play", "Single");
  assert.equal(next.metrolinaScore, 2);
  assert.equal(next.opponentScore, 0);
  assert.deepEqual(next.runners, { first: "p1" });
});

test("home runs clear the bases and score every occupied runner", () => {
  const game = makeGame({ homeAway: "Home", half: "Bottom", runners: { first: "r1", second: "r2", third: "r3" } });
  const next = applyTrackedPitch(game, "In Play", "Home Run");
  assert.equal(next.metrolinaScore, 4);
  assert.deepEqual(next.runners, {});
});

test("third out transitions the half inning and clears the bases", () => {
  const game = makeGame({ outs: 2, runners: { first: "r1" } });
  const next = applyTrackedPitch(game, "In Play", "Ground Out");
  assert.equal(next.half, "Bottom");
  assert.equal(next.inning, 1);
  assert.equal(next.outs, 0);
  assert.deepEqual(next.runners, {});
});

test("runner events support steals, caught stealing, and snapshot undo", () => {
  const game = makeGame({ runners: { first: "r1" } });
  const before = snapshotGame(game);
  const stolen = applyRunnerAction(game, "Stolen Base", "first");
  assert.deepEqual(stolen.runners, { second: "r1" });
  const caught = applyRunnerAction(stolen, "Caught Stealing", "second");
  assert.equal(caught.outs, 1);
  assert.deepEqual(caught.runners, {});
  assert.deepEqual(snapshotGame(restoreGameSnapshot(caught, before)), before);
});

test("drag-style runner moves support direct bases and home without overwriting another runner", () => {
  const game = makeGame({ runners: { first: "r1", third: "r3" } });
  const moved = moveRunnerToDestination(game, "first", "second");
  assert.deepEqual(moved.runners, { second: "r1", third: "r3" });
  const blocked = moveRunnerToDestination(moved, "second", "third");
  assert.deepEqual(blocked.runners, moved.runners);
  const scored = moveRunnerToDestination(blocked, "third", "home");
  assert.deepEqual(scored.runners, { second: "r1" });
  assert.equal(scored.metrolinaScore, 1);
});

test("manual third-out corrections use the same inning transition", () => {
  const game = makeGame({ outs: 2, runners: { first: "r1" } });
  const next = applyGameAdjustment(game, "outs", 1);
  assert.equal(next.half, "Bottom");
  assert.equal(next.outs, 0);
  assert.deepEqual(next.runners, {});
});

test("scored plays use the scorer's runner destinations instead of automatic advancement", () => {
  const game = makeGame({ runners: { first: "r1", second: "r2" } });
  const next = applyScoredPlay(game, {
    outcome: "Single",
    contactType: "Line Drive",
    movements: [
      { runnerId: "r2", from: "second", to: "third", result: "safe", reason: "On hit" },
      { runnerId: "r1", from: "first", to: "second", result: "safe", reason: "On hit" },
      { runnerId: "p1", from: "batter", to: "first", result: "safe", reason: "Batter result" },
    ],
  });
  assert.equal(next.metrolinaScore, 0);
  assert.deepEqual(next.runners, { first: "p1", second: "r1", third: "r2" });
});

test("play validation requires every runner and prevents duplicate occupied bases", () => {
  const game = makeGame({ runners: { first: "r1" } });
  const errors = validateScoredPlay(game, {
    outcome: "Single",
    contactType: "Ground Ball",
    movements: [
      { runnerId: "r1", from: "first", to: "second", result: "safe", reason: "On hit" },
      { runnerId: "p1", from: "batter", to: "second", result: "safe", reason: "Batter result" },
    ],
  });
  assert.ok(errors.some((error) => error.includes("same base")));
});

test("suggested play paths are drafts that include the batter and every occupied base", () => {
  const game = makeGame({ runners: { first: "r1", third: "r3" } });
  const movements = suggestedPlayMovements(game, "Double");
  assert.deepEqual(new Set(movements.map((movement) => movement.from)), new Set(["batter", "first", "third"]));
  assert.equal(movements.find((movement) => movement.from === "batter")?.to, "second");
});

test("fielder's choice draft records the forced runner out and preserves the batter", () => {
  const game = makeGame({ runners: { first: "r1" } });
  const movements = suggestedPlayMovements(game, "Fielder's Choice");
  assert.deepEqual(movements.map(({ from, to }) => ({ from, to })), [
    { from: "first", to: "out" },
    { from: "batter", to: "first" },
  ]);
  const next = applyScoredPlay(game, { outcome: "Fielder's Choice", contactType: "Ground Ball", movements });
  assert.deepEqual(next.runners, { first: "p1" });
  assert.equal(next.outs, 1);
});

test("held runners count as occupying their base during play validation", () => {
  const game = makeGame({ runners: { first: "r1" } });
  const errors = validateScoredPlay(game, {
    outcome: "Fielder's Choice",
    contactType: "Ground Ball",
    movements: [
      { runnerId: "r1", from: "first", to: "hold", result: "held", reason: "Other" },
      { runnerId: "p1", from: "batter", to: "first", result: "safe", reason: "Batter result" },
    ],
  });
  assert.ok(errors.some((error) => error.includes("same base")));
  assert.ok(errors.some((error) => error.includes("must record a runner out")));
});

test("sacrifices are rejected with two outs", () => {
  const game = makeGame({ outs: 2, runners: { third: "r3" } });
  const errors = validateScoredPlay(game, {
    outcome: "Sac Fly",
    contactType: "Fly Ball",
    movements: [
      { runnerId: "r3", from: "third", to: "home", result: "safe", reason: "Tag up" },
      { runnerId: "p1", from: "batter", to: "out", result: "out", reason: "Batter result" },
    ],
  });
  assert.ok(errors.some((error) => error.includes("two outs")));
});

function makeGame(patch = {}) {
  return {
    id: "game-1",
    date: "2026-08-25",
    opponent: "Opponent",
    homeAway: "Away",
    location: "Field",
    type: "Scrimmage",
    metrolinaScore: 0,
    opponentScore: 0,
    inning: 1,
    half: "Top",
    outs: 0,
    balls: 0,
    strikes: 0,
    runners: {},
    lineup: ["p1", "p2", "p3"],
    positions: {},
    currentBatterId: "p1",
    createdAt: "2026-08-25T12:00:00.000Z",
    updatedAt: "2026-08-25T12:00:00.000Z",
    ...patch,
  };
}

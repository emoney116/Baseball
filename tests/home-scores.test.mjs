import test from "node:test";
import assert from "node:assert/strict";
import { recentHomeScores } from "../app/lib/homeScores.ts";
const now = Date.parse("2026-09-09T12:00:00Z");
const score = { id: "g", teamId: "mine", teamName: "Team", opponent: "Opponent", ourScore: 7, opponentScore: 4, date: "2026-09-08", result: "W" };
test("shows direct and followed team final scores only", () => {
  const results = recentHomeScores([score, { ...score, id: "f", teamId: "followed" }, { ...score, id: "other", teamId: "other" }], ["mine", "followed"], now);
  assert.deepEqual(results.map(row => row.id), ["g", "f"]);
});
test("scores reject unfinished, malformed, future, and stale games", () => {
  const games = [{ ...score, result: "" }, { ...score, date: "2027-01-01" }, { ...score, date: "2020-01-01" }, { ...score, ourScore: NaN }];
  assert.deepEqual(recentHomeScores(games, ["mine"], now), []);
});
test("scores deduplicate and respect zero scores", () => {
  assert.equal(recentHomeScores([{ ...score, ourScore: 0 }, score], ["mine"], now).length, 1);
});

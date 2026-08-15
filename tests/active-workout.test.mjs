import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceWorkoutGroupStation,
  createWorkoutGroups,
  moveWorkoutGroupMember,
  setWorkoutGroupStation,
  upsertWorkoutSetByKey,
} from "../app/lib/activeWorkout.ts";

test("active workout auto groups distribute athletes evenly for common roster sizes", () => {
  assert.deepEqual(createWorkoutGroups(ids(20), 4).map((group) => group.playerIds.length), [5, 5, 5, 5]);
  assert.deepEqual(createWorkoutGroups(ids(24), 4).map((group) => group.playerIds.length), [6, 6, 6, 6]);
  assert.deepEqual(createWorkoutGroups(ids(23), 4).map((group) => group.playerIds.length), [6, 6, 6, 5]);
  assert.deepEqual(createWorkoutGroups(ids(18), 3).map((group) => group.playerIds.length), [6, 6, 6]);
  assert.deepEqual(createWorkoutGroups(ids(18), 5).map((group) => group.playerIds.length), [4, 4, 4, 3, 3]);
});

test("active workout station movement does not assume group count equals exercise count", () => {
  let groups = createWorkoutGroups(ids(18), 3);
  groups = setWorkoutGroupStation(groups, "group-1", 4, 5);
  assert.equal(groups[0].stationIndex, 4);
  groups = advanceWorkoutGroupStation(groups, "group-1", 5, 1);
  assert.equal(groups[0].stationIndex, 0);

  groups = createWorkoutGroups(ids(25), 5);
  groups = setWorkoutGroupStation(groups, "group-5", 2, 3);
  assert.equal(groups[4].stationIndex, 2);
  groups = advanceWorkoutGroupStation(groups, "group-5", 3, 1);
  assert.equal(groups[4].stationIndex, 0);
});

test("active workout manual movement keeps a player in one group", () => {
  const groups = moveWorkoutGroupMember(createWorkoutGroups(ids(8), 2), "p1", "group-2");
  assert.equal(groups.filter((group) => group.playerIds.includes("p1")).length, 1);
  assert.equal(groups.find((group) => group.id === "group-2").playerIds.includes("p1"), true);
  assert.equal(groups.find((group) => group.id === "group-1").playerIds.includes("p1"), false);
});

test("active workout duplicate set protection replaces the same athlete exercise set", () => {
  const first = { id: "set-1", playerId: "p1", exercise: "Back Squat", setNumber: 2, weight: 225 };
  const correction = { id: "set-2", playerId: "p1", exercise: "Back Squat", setNumber: 2, weight: 235 };
  const differentAthlete = { id: "set-3", playerId: "p2", exercise: "Back Squat", setNumber: 2, weight: 185 };
  const entries = upsertWorkoutSetByKey(upsertWorkoutSetByKey([first], differentAthlete), correction);
  assert.equal(entries.length, 2);
  assert.equal(entries.find((entry) => entry.playerId === "p1").weight, 235);
  assert.equal(entries.find((entry) => entry.playerId === "p2").weight, 185);
});

function ids(count) {
  return Array.from({ length: count }, (_, index) => `p${index + 1}`);
}

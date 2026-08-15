import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceWorkoutGroupStation,
  copyExercisePresetToStations,
  copyGroupPresetToWorkout,
  createBlankWorkoutSetup,
  createEmptyWorkoutGroups,
  createWorkoutGroups,
  moveWorkoutGroupMember,
  plannedWorkoutSetCount,
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

test("new active workout setup starts blank until the coach configures it", () => {
  const setup = createBlankWorkoutSetup();
  assert.equal(setup.stations.length, 0);
  assert.equal(setup.groups.length, 0);
  assert.equal(setup.groups.flatMap((group) => group.playerIds).length, 0);
  assert.equal(plannedWorkoutSetCount({ stations: setup.stations, groups: setup.groups, athleteCount: 20, mode: "Groups" }), 0);
});

test("empty groups can exist without assigning athletes", () => {
  const groups = createEmptyWorkoutGroups(4, 0);
  assert.equal(groups.length, 4);
  assert.deepEqual(groups.map((group) => group.playerIds), [[], [], [], []]);
  assert.equal(plannedWorkoutSetCount({ stations: [{ id: "station-1", name: "Back Squat", displayOrder: 1, targetSets: 4 }], groups, athleteCount: 20, mode: "Groups" }), 0);
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

test("active workout targets do not force actual athlete results", () => {
  const target = { id: "station-1", name: "Back Squat", displayOrder: 1, targetSets: 4, targetReps: 6 };
  assert.equal(plannedWorkoutSetCount({ stations: [target], groups: createWorkoutGroups(["p1"], 1), athleteCount: 1, mode: "Groups" }), 4);

  const entries = [
    { id: "set-1", playerId: "p1", exercise: "Back Squat", setNumber: 1, weight: 225, reps: 6 },
    { id: "set-2", playerId: "p1", exercise: "Back Squat", setNumber: 2, weight: 225, reps: 5 },
    { id: "set-3", playerId: "p1", exercise: "Back Squat", setNumber: 3, weight: 225, reps: 7 },
    { id: "set-4", playerId: "p1", exercise: "Back Squat", setNumber: 4, weight: 215, reps: 4 },
  ];
  assert.deepEqual(entries.map((entry) => entry.reps), [6, 5, 7, 4]);
});

test("exercise and group presets copy independently", () => {
  const exercisePreset = [{ name: "Back Squat", targetSets: 4 }, { name: "Plank", targetSets: 1 }];
  const groupPreset = createWorkoutGroups(ids(8), 2);
  const copiedStations = copyExercisePresetToStations(exercisePreset);
  const copiedGroups = copyGroupPresetToWorkout(groupPreset, copiedStations.length);

  assert.deepEqual(copiedStations.map((station) => station.name), ["Back Squat", "Plank"]);
  assert.deepEqual(copiedGroups.map((group) => group.playerIds.length), [4, 4]);

  copiedStations[0].targetSets = 3;
  copiedGroups[0].playerIds.pop();

  assert.equal(exercisePreset[0].targetSets, 4);
  assert.deepEqual(groupPreset.map((group) => group.playerIds.length), [4, 4]);
});

function ids(count) {
  return Array.from({ length: count }, (_, index) => `p${index + 1}`);
}

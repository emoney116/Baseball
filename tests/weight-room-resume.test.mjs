import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resumableWeightRoomWorkout } from "../app/lib/weightRoom.ts";

const workout = (id, status) => ({ id, status, title: id, date: "2026-08-15" });

test("only active and paused team workouts can resume", () => {
  for (const status of ["SCHEDULED", "COMPLETED", "CANCELLED"]) {
    assert.equal(resumableWeightRoomWorkout([workout("old", status)], "old"), undefined);
  }
  for (const status of ["ACTIVE", "PAUSED"]) {
    const row = workout("live", status);
    assert.equal(resumableWeightRoomWorkout([row]), row);
  }
});

test("stale completed selection does not shadow the actual live workout", () => {
  const live = workout("new", "ACTIVE");
  assert.equal(resumableWeightRoomWorkout([workout("old", "COMPLETED"), live], "old"), live);
});

test("preferred running workout wins and session end immediately removes resume", () => {
  const first = workout("first", "ACTIVE");
  const selected = workout("selected", "PAUSED");
  assert.equal(resumableWeightRoomWorkout([first, selected], "selected"), selected);
  selected.status = "COMPLETED";
  first.status = "COMPLETED";
  assert.equal(resumableWeightRoomWorkout([first, selected], "selected"), undefined);
});

test("coach resume does not infer a running team session from incomplete athlete sets", () => {
  const page = readFileSync("app/page.tsx", "utf8");
  assert.doesNotMatch(page, /openWorkoutRow/);
  assert.match(page, /const persistedActiveWorkout = resumableWeightRoomWorkout/);
  assert.match(page, /const activeWorkoutRunning = Boolean\(persistedActiveWorkout\)/);
});

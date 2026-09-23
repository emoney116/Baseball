import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resumableWeightRoomWorkout, completedWeightRoomWorkoutForEvent } from "../app/lib/weightRoom.ts";

const workout = (id, status) => ({ id, status, title: id, date: "2026-08-15" });

test("completed scheduled lifts open their saved workout rather than a duplicate", () => {
  const completed = { ...workout("saved", "COMPLETED"), scheduleEventId: "lift" };
  const cancelled = { ...workout("empty", "CANCELLED"), scheduleEventId: "lift" };
  assert.equal(completedWeightRoomWorkoutForEvent([cancelled, completed], "lift"), completed);
  assert.equal(completedWeightRoomWorkoutForEvent([completed], "another-lift"), undefined);
  assert.equal(completedWeightRoomWorkoutForEvent([completed]), undefined);
  assert.equal(completedWeightRoomWorkoutForEvent([cancelled], "lift"), undefined);
  const page = readFileSync("app/ClubhouseWorkspace.tsx", "utf8");
  const start = page.slice(page.indexOf("function startWeightRoomWorkout("), page.indexOf("function completeWeightRoomWorkout("));
  assert.match(start, /if \(!activeWorkout && completedWorkout\)/);
  assert.ok(start.indexOf("openCompletedWeightRoomWorkout(completedWorkout)") < start.indexOf('createId("wrw")'));
});

test("Weight Room overview shares the Home Clubhouse Score card", () => {
  const page = readFileSync("app/ClubhouseWorkspace.tsx", "utf8");
  const overview = page.slice(page.indexOf('<section className="weight-room-overview-grid">'), page.indexOf('<section className="weight-room-overview-grid">') + 400);
  assert.match(overview, /<WeightRoomLeaderCard data=\{data\} onPlayer=\{onOpenPlayer\}/);
  assert.doesNotMatch(overview, /<WeightRoomLeaders /);
});

test("new workout and Lift share one snapshot and the referenced Lift saves first", () => {
  const page = readFileSync("app/ClubhouseWorkspace.tsx", "utf8");
  const start = page.slice(page.indexOf("function startWeightRoomWorkout("), page.indexOf("function completeWeightRoomWorkout("));
  assert.match(start, /weightRoomWorkouts: upsertById/);
  assert.match(start, /scheduleEvents: current\.scheduleEvents/);
  assert.doesNotMatch(start, /createScheduleEvent\(/);
  const repository = readFileSync("app/data/supabaseRepository.ts", "utf8");
  const parentSave = repository.indexOf("if (workoutScheduleIds.size) await syncScheduleEvents");
  assert.ok(parentSave > 0 && parentSave < repository.indexOf("await syncActiveWeightRoomSetup"));
});

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
  const page = readFileSync("app/ClubhouseWorkspace.tsx", "utf8");
  assert.doesNotMatch(page, /openWorkoutRow/);
  assert.match(page, /const persistedActiveWorkout = resumableWeightRoomWorkout/);
  assert.match(page, /const activeWorkoutRunning = Boolean\(persistedActiveWorkout\)/);
});

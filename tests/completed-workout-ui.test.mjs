import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("completed workouts render as a read-only box score with correction controls", () => {
  const page = readFileSync("app/page.tsx", "utf8");
  const styles = readFileSync("app/globals.css", "utf8");

  assert.match(page, /function WeightRoomCompletedWorkoutSummary/);
  assert.doesNotMatch(page, /className="weight-room-completed-title"/);
  assert.match(page, /tab === "Overview" && \(/);
  assert.match(page, /Exercise Results/);
  assert.match(page, /Athlete Box Score/);
  assert.match(page, /Exercise Drilldown/);
  assert.match(page, /weight-room-completed-exercise-picker/);
  assert.match(page, /Personal Records/);
  assert.match(page, /Edit Results/);
  assert.match(page, /completedMode === "summary"/);
  assert.match(page, /completedMode === "editing"/);
  assert.match(page, /!completedMode && !setupOpen/);
  assert.match(page, />\s*Save Workout\s*</);
  assert.match(page, /toggleExerciseSort\("rank"\)/);
  assert.match(page, /toggleExerciseSort\("topResult"\)/);
  assert.match(page, /toggleAthleteSort\("exercises"\)/);
  assert.match(page, /toggleAthleteSort\("results"\)/);
  assert.match(page, /formatWorkoutEntryValueForStation/);
  assert.match(page, /uniqueLatestWorkoutEntries\(entriesForDate\)/);
  assert.match(page, /personalRecordsForWorkout/);
  assert.match(page, /bestWorkoutEntryForStation/);

  assert.match(styles, /weight-room-completed-layout/);
  assert.match(styles, /weight-room-completed-metric/);
  assert.match(styles, /weight-room-completed-exercise-table/);
  assert.match(styles, /weight-room-completed-athlete-table/);
  assert.match(styles, /weight-room-completed-drill-table/);
  assert.match(styles, /white-space:\s*nowrap/);
});

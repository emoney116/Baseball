import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("completed workouts render as a read-only box score with correction controls", () => {
  const page = readFileSync("app/page.tsx", "utf8");
  const styles = readFileSync("app/globals.css", "utf8");

  assert.match(page, /function WeightRoomCompletedWorkoutSummary/);
  assert.match(page, /Read-only summary/);
  assert.match(page, /Exercise Results/);
  assert.match(page, /Athlete Box Score/);
  assert.match(page, /Exercise Drilldown/);
  assert.match(page, /Personal Records/);
  assert.match(page, /Edit Results/);
  assert.match(page, /completedMode === "editing" \? "Review Results" : "Edit Workout"/);
  assert.match(page, />\s*Save Workout\s*</);
  assert.match(page, /uniqueLatestWorkoutEntries\(entriesForDate\)/);
  assert.match(page, /personalRecordsForWorkout/);
  assert.match(page, /bestWorkoutEntryForStation/);

  assert.match(styles, /weight-room-completed-layout/);
  assert.match(styles, /weight-room-completed-exercise-table/);
  assert.match(styles, /weight-room-completed-athlete-table/);
  assert.match(styles, /weight-room-completed-drill-table/);
});

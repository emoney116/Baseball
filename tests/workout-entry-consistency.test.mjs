import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('max-rep entries make load opt-in while retaining recorded and configured loads',()=>{
  const source=readFileSync('app/components/TeamTrainingViews.tsx','utf8');
  assert.match(source,/optionalLoad = station.targetStyle === "Max Reps" && station.testConditions\?\.loadLb === undefined && station.targetValue === undefined/);
  assert.match(source,/useState\(entry\?\.weight !== undefined\)/);
  assert.match(source,/optionalLoad \? includeLoad : station.measurementType === "WEIGHT_REPS"/);
  assert.match(source,/Add load/);
});

test('testing entries share box-score layout and retain conflict-safe RPC writes',()=>{
  const source=readFileSync('app/components/WorkoutTestingConsole.tsx','utf8');
  assert.match(source,/weight-room-individual-box-score/);
  assert.match(source,/role="columnheader">Athlete/);
  assert.match(source,/correct_workout_test/);
  assert.match(source,/expected_revision: draft.revision/);
  assert.match(source,/record_workout_test/);
  assert.match(source,/request_id: draft.request/);
  assert.match(source,/onStatus\?\.\(/);
  assert.match(source,/Workout paused\. Resume Workout/);
  assert.match(source,/new attempts require a new workout/);
});

test('workout header derives status from server observation and persisted completion',()=>{
  const source=readFileSync('app/ClubhouseWorkspace.tsx','utf8');
  assert.match(source,/observedWorkoutStatus \?\? \(activeWorkout\?\.status === "COMPLETED" \? "Completed"/);
  assert.match(source,/onStatus=\{setObservedWorkoutStatus\}/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("active weight room setup keeps exercise saves and preset UI clean", () => {
  const page = readFileSync("app/page.tsx", "utf8");
  const repository = readFileSync("app/data/supabaseRepository.ts", "utf8");
  const setupSync = repository.match(/async function syncActiveWeightRoomSetup[\s\S]*?async function syncWorkoutData/)?.[0] ?? "";
  const exerciseUpsertBlock = setupSync.match(/const exerciseRows = \[\.\.\.setupExerciseNames\][\s\S]*?const \{ data: exerciseRows/)?.[0] ?? "";

  assert.match(exerciseUpsertBlock, /id:\s*definition\?\.id[\s\S]*createRemoteId\(\)/);
  assert.match(exerciseUpsertBlock, /id:\s*row\.id/);
  assert.match(exerciseUpsertBlock, /from\("exercises"\)\.upsert\(exerciseRows,\s*\{\s*onConflict:\s*"organization_id,name"\s*\}\)/);
  assert.match(repository, /upsertOrderedWorkoutRows\(\s*supabase,\s*"weight_room_workout_stations"/);
  assert.match(repository, /upsertOrderedWorkoutRows\(\s*supabase,\s*"weight_room_workout_groups"/);
  assert.match(repository, /normalizeWorkoutDisplayOrder\(rows\)/);
  assert.match(repository, /display_order:\s*index \+ 1/);
  assert.match(repository, /"workout_id,player_id"/);

  assert.doesNotMatch(page, /Exercises and groups are independent/);
  assert.doesNotMatch(page, /<span>Workout Setup<\/span>/);
  assert.doesNotMatch(page, /Setup auto-saves/);
  assert.doesNotMatch(page, /changes stations here/);
  assert.doesNotMatch(page, /same workout data/);
  assert.match(page, /placeholder="Enter preset name\.\.\."/);
  assert.match(page, /className="weight-room-current-stations__head"/);
  assert.match(page, /className="weight-room-station-add-row"/);
  assert.match(page, /className="weight-room-group-add-row"/);
  assert.match(page, /weight-room-athlete-multi-picker/);
  assert.match(page, /Select All/);
  assert.match(page, /function WeightRoomExerciseLibraryCard/);
  assert.match(page, /weight-room-library-presets/);
  assert.match(page, /Create Exercise Preset/);
  assert.match(page, /Save Exercise/);
  assert.match(page, /formatWorkoutEntryValueForStation/);
  assert.match(page, /leaders=\{weightLeaderRows\}/);
  assert.doesNotMatch(page, /exercisePresetsFromTemplates/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("active weight room setup keeps exercise saves and preset UI clean", () => {
  const page = readFileSync("app/page.tsx", "utf8");
  const repository = readFileSync("app/data/supabaseRepository.ts", "utf8");
  const setupSync = repository.match(/async function syncActiveWeightRoomSetup[\s\S]*?async function syncWorkoutData/)?.[0] ?? "";
  const exerciseUpsertBlock = setupSync.match(/const exerciseRows = \[\.\.\.setupExerciseNames\][\s\S]*?const \{ data: exerciseRows/)?.[0] ?? "";

  assert.doesNotMatch(exerciseUpsertBlock, /id:\s*definition\?\.id/);
  assert.doesNotMatch(exerciseUpsertBlock, /id:\s*row\.id/);
  assert.match(exerciseUpsertBlock, /from\("exercises"\)\.upsert\(exerciseRows,\s*\{\s*onConflict:\s*"organization_id,name"\s*\}\)/);

  assert.doesNotMatch(page, /Exercises and groups are independent/);
  assert.doesNotMatch(page, /<span>Workout Setup<\/span>/);
  assert.match(page, /placeholder="Enter preset name\.\.\."/);
  assert.match(page, /className="weight-room-current-stations__head"/);
  assert.match(page, /className="weight-room-station-add-row"/);
  assert.match(page, /className="weight-room-group-add-row"/);
  assert.doesNotMatch(page, /exercisePresetsFromTemplates/);
});

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

test("shared dropdown menus stay viewport safe inside modals and small screens", () => {
  const page = readFileSync("app/page.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");
  const choiceSelect = page.match(/function ChoiceSelect[\s\S]*?function TeamSwitcher/)?.[0] ?? "";

  assert.match(choiceSelect, /createPortal\(/);
  assert.match(choiceSelect, /getBoundingClientRect\(\)/);
  assert.match(choiceSelect, /window\.addEventListener\("scroll",\s*updateMenuPosition,\s*true\)/);
  assert.match(choiceSelect, /data-placement=\{menuPosition\.placement\}/);
  assert.match(choiceSelect, /choice-select__menu--portal/);
  assert.match(choiceSelect, /placement:\s*"top"\s*\|\s*"bottom"\s*\|\s*"sheet"/);
  assert.match(choiceSelect, /menuPosition\.placement === "sheet"/);
  assert.match(choiceSelect, /choice-select__sheet-scrim/);
  assert.match(choiceSelect, /event\.key === "Enter" \|\| event\.key === " "/);
  assert.match(choiceSelect, /scrollIntoView\(\{\s*block:\s*"nearest"\s*\}\)/);
  assert.match(choiceSelect, /maxHeight:\s*menuPosition\.maxHeight/);
  assert.match(page, /function ImportChoiceField[\s\S]*?<ChoiceSelect/);
  assert.doesNotMatch(page, /import-choice__menu/);
  assert.match(page, /weight-room-auto-group-choice/);
  assert.match(css, /\.choice-select__menu--portal\s*\{[\s\S]*position:\s*fixed/);
  assert.match(css, /z-index:\s*10000/);
  assert.match(css, /max-width:\s*calc\(100vw - 24px\)/);
  assert.match(css, /overscroll-behavior:\s*contain/);
  assert.match(css, /-webkit-overflow-scrolling:\s*touch/);
  assert.match(css, /\.choice-select__sheet-scrim\s*\{/);
  assert.match(css, /\.choice-select__menu--portal\.weight-room-auto-group-choice button small/);
  assert.match(css, /\*\s*\{[\s\S]*scrollbar-width:\s*none/);
  assert.match(css, /\*::-webkit-scrollbar\s*\{[\s\S]*display:\s*none/);
  assert.match(css, /\.scrollbar-none\s*\{/);
  assert.match(css, /\.scroll-fade-bottom::after/);
  assert.doesNotMatch(css, /scrollbar-width:\s*(thin|auto)/);
  assert.doesNotMatch(css, /import-choice__menu/);
});

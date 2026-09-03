import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("product logos stay light-mode safe and theme preference persists per device", () => {
  const css = readFileSync("app/globals.css", "utf8");
  const themePreference = readFileSync("app/lib/themePreference.ts", "utf8");
  const logoSources = [
    "app/page.tsx",
    "app/setup/page.tsx",
    "app/components/visuals.tsx",
    "app/join/[token]/JoinInvitationClient.tsx",
    "app/org/[id]/page.tsx",
    "app/org/[id]/manage/page.tsx",
    "app/team/[id]/page.tsx",
    "app/game/[id]/page.tsx",
  ].map((file) => readFileSync(file, "utf8")).join("\n");

  assert.match(css, /\[data-theme="light"\] \.brand-mark-image\s*\{/);
  assert.match(css, /\[data-theme="light"\] \.brand-wordmark--product\s*\{/);
  assert.doesNotMatch(logoSources, /<img(?![^>]*brand-mark-image)[^>]*BRAND_ASSETS\.mark/);
  assert.doesNotMatch(logoSources, /<img(?![^>]*brand-wordmark--product)[^>]*BRAND_ASSETS\.wordmark/);

  assert.match(themePreference, /DEVICE_THEME_STORAGE_KEY = "clubhouse9-theme:device"/);
  assert.match(themePreference, /THEME_COOKIE_NAME = "clubhouse9-theme"/);
  assert.match(themePreference, /window\.localStorage\.setItem\(DEVICE_THEME_STORAGE_KEY, theme\)/);
  assert.match(themePreference, /document\.cookie = `\$\{THEME_COOKIE_NAME\}=/);
  assert.match(themePreference, /document\.documentElement\.style\.colorScheme = theme/);
  assert.match(themePreference, /document\.cookie\.match/);
});

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
  assert.match(repository, /upsertOrderedPresetRows\(\s*supabase,\s*"weight_room_exercise_preset_items"/);
  assert.match(repository, /upsertOrderedPresetRows\(\s*supabase,\s*"weight_room_group_preset_groups"/);
  assert.match(repository, /function upsertOrderedRowsByParent/);
  assert.match(repository, /normalizeWorkoutDisplayOrder\(rows\)/);
  assert.match(repository, /normalizePresetDisplayOrder\(rows\)/);
  assert.match(repository, /display_order:\s*index \+ 1/);
  assert.match(repository, /"workout_id,player_id"/);

  assert.doesNotMatch(page, /Exercises and groups are independent/);
  assert.doesNotMatch(page, /<span>Workout Setup<\/span>/);
  assert.doesNotMatch(page, /Setup auto-saves/);
  assert.doesNotMatch(page, /changes stations here/);
  assert.doesNotMatch(page, /same workout data/);
  assert.match(page, /placeholder="Enter preset name\.\.\."/);
  assert.match(page, /const \[groupsEnabled, setGroupsEnabled\] = useState\(true\)/);
  assert.match(page, /Turn Groups on in Setup before using group mode/);
  assert.match(page, /onGroupsEnabledChange/);
  assert.match(page, /className=\{`ui-switch \$\{enabled \? "is-on" : ""\}`\}/);
  assert.match(page, /Groups disabled\. Individual mode stays available\./);
  assert.match(page, /Edit Setup/);
  assert.match(page, /showSelectedDescription=\{false\}/);
  assert.doesNotMatch(page, /Use Individual Mode/);
  assert.doesNotMatch(page, /Start Groups/);
  assert.doesNotMatch(page, /Skip Setup/);
  assert.match(page, /className="weight-room-current-stations__head"/);
  assert.match(page, /className="weight-room-station-add-row"/);
  assert.match(page, /className="weight-room-group-add-row"/);
  assert.match(page, /weight-room-athlete-multi-picker/);
  assert.match(page, /Select All/);
  assert.match(page, /function ScrollablePanel/);
  assert.match(page, /function useScrollEdges/);
  assert.match(page, /SCROLL_EDGE_THRESHOLD/);
  assert.match(page, /scroll-cue-panel/);
  assert.match(page, /has-scroll-left/);
  assert.match(page, /has-scroll-right/);
  assert.match(page, /function WeightRoomExerciseLibraryCard/);
  assert.match(page, /weight-room-exercise-left-column/);
  assert.match(page, /weight-room-presets-card/);
  assert.match(page, /Team Exercise Library/);
  assert.match(page, /weight-room-library-presets/);
  assert.match(page, /weight-room-library-presets__list/);
  assert.match(page, /weight-room-library-filters/);
  assert.match(page, /Create Exercise Preset/);
  assert.match(page, /Edit Exercise Preset/);
  assert.match(page, /weight-room-exercise-preset-modal/);
  assert.match(page, /weight-room-preset-builder/);
  assert.match(page, /const \[presetStations, setPresetStations\]/);
  assert.match(page, /weight-room-current-stations--preset/);
  assert.match(page, /function reorderPresetStation/);
  assert.match(page, /onDragOver=\{\(event\) =>/);
  assert.match(page, /is-athlete-drop-target/);
  assert.doesNotMatch(page, /movePresetExercise/);
  assert.match(page, /function archivePreset/);
  assert.match(page, /onSavePreset\(\{ \.\.\.preset, archived: true \}\)/);
  assert.match(page, /useState<WeightRoomExerciseCategory \| "">\(""\)/);
  assert.match(page, /useState<WorkoutMeasurementType \| "">\(""\)/);
  assert.match(page, /placeholder="Choose category"/);
  assert.match(page, /placeholder="Choose measurement"/);
  assert.match(page, /disabled=\{!draftName\.trim\(\) \|\| !draftCategory \|\| !draftMeasurementType\}/);
  assert.match(page, /type WeightRoomExerciseResultSortKey/);
  assert.match(page, /WeightRoomSortHeader label="Latest"/);
  assert.match(page, /workoutEntryChangeDisplay/);
  assert.match(page, /weight-room-exercise-mode-select/);
  assert.match(page, /targetStyleOptionsForMeasurement\(exerciseDefinition\.measurementType\)/);
  assert.match(page, /function workoutEntryStationContext/);
  assert.match(page, /function workoutEntryMatchesResultMode/);
  assert.match(page, /workoutEntryPersistedStation\(data, entry\)/);
  assert.match(page, /\.filter\(\(entry\) => workoutEntryMatchesResultMode\(data, entry, selectedResultMode, exerciseDefinition\)\)/);
  assert.match(page, /bestWorkoutEntryForStation\(entries, displayStation\)/);
  assert.match(page, /workoutEntryComparableForStation\(latest, displayStation\)/);
  assert.match(page, /athleteDetailsRef/);
  assert.match(page, /getBoundingClientRect\(\)\.height/);
  assert.match(page, /weight-room-exercise-progress-scroll/);
  assert.doesNotMatch(page, /Exercise Breakdown/);
  assert.doesNotMatch(page, /e1RM/);
  assert.doesNotMatch(page, /All Categories/);
  assert.match(page, /const workoutActionLabel = activeWorkoutRunning \? "Resume Workout" : "Start Workout"/);
  assert.match(page, /Save Exercise/);
  assert.match(page, /placeholder="Enter exercise\.\.\."/);
  assert.match(page, /formatWorkoutEntryValueForStation/);
  assert.match(page, /leaders=\{weightLeaderRows\}/);
  assert.doesNotMatch(page, /Exercise View/);
  assert.doesNotMatch(page, /`\$\{presets\.length\} saved`/);
  assert.doesNotMatch(page, /exercisePresetsFromTemplates/);
  assert.doesNotMatch(page, /globalQuery/);
  assert.doesNotMatch(page, /global-search/);
  assert.doesNotMatch(page, /<span>\{paused \? "Paused - data preserved" : setupOpen \? "Setup mode" : "Saved"\}<\/span>/);
});

test("shared dropdown menus stay viewport safe inside modals and small screens", () => {
  const page = readFileSync("app/page.tsx", "utf8");
  const sharedSelect = readFileSync("app/components/ClubhouseSelect.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");

  assert.match(sharedSelect, /createPortal\(/);
  assert.match(sharedSelect, /getBoundingClientRect\(\)/);
  assert.match(sharedSelect, /window\.visualViewport/);
  assert.match(sharedSelect, /availableBelow/);
  assert.match(sharedSelect, /availableAbove/);
  assert.match(sharedSelect, /orientationchange/);
  assert.match(sharedSelect, /type Placement = "top" \| "bottom" \| "sheet"/);
  assert.match(sharedSelect, /clubhouse-option-overlay__scrim/);
  assert.match(sharedSelect, /scrollIntoView\(\{ block: "nearest" \}\)/);
  assert.match(sharedSelect, /aria-selected/);
  assert.match(page, /function ImportChoiceField[\s\S]*?<ChoiceSelect/);
  assert.doesNotMatch(page, /import-choice__menu/);
  assert.match(page, /step !== "preview" && \(\s*<section className="builder-mode-row"/);
  assert.match(page, /step !== "preview" && files\.length > 0 && \(/);
  assert.match(page, /<label className="staff-detected staff-detected--selectable">/);
  assert.match(page, /label: "Use Existing"/);
  assert.match(page, /label: "Create New"/);
  assert.doesNotMatch(page, /Use Existing Player/);
  assert.doesNotMatch(page, /Create New Player/);
  assert.match(page, /weight-room-auto-group-choice/);
  assert.match(page, /ClubhouseSelect as ChoiceSelect/);
  assert.match(css, /\.choice-select__menu--portal\s*\{[\s\S]*position:\s*fixed/);
  assert.match(css, /z-index:\s*10000/);
  assert.match(css, /max-width:\s*calc\(100vw - 24px\)/);
  assert.match(css, /overscroll-behavior:\s*contain/);
  assert.match(css, /scroll-snap-type:\s*none/);
  assert.match(css, /touch-action:\s*pan-y/);
  assert.match(css, /-webkit-overflow-scrolling:\s*touch/);
  assert.match(css, /\.choice-select__sheet-scrim\s*\{/);
  assert.match(css, /\.choice-select__menu-edge--top/);
  assert.match(css, /\.choice-select__menu-edge--bottom/);
  assert.match(css, /\.choice-select__menu--portal\.weight-room-auto-group-choice button small/);
  assert.match(css, /\*\s*\{[\s\S]*scrollbar-width:\s*none/);
  assert.match(css, /\*::-webkit-scrollbar\s*\{[\s\S]*display:\s*none/);
  assert.match(css, /\.scrollbar-none\s*\{/);
  assert.match(css, /\.scroll-fade-bottom::after/);
  assert.match(css, /\.scroll-cue-panel\s*\{/);
  assert.match(css, /\.scroll-cue-panel\.has-scroll-down \.scroll-cue-panel__cue--down/);
  assert.match(css, /\.scroll-cue-panel\.has-scroll-right \.scroll-cue-panel__cue--right/);
  assert.match(css, /place-items:\s*center/);
  assert.match(css, /\.choice-select__menu--portal\.has-scroll-up\.has-scroll-down/);
  assert.match(css, /\.weight-room-presets-card/);
  assert.match(css, /\.weight-room-exercise-left-column/);
  assert.match(css, /\.weight-room-exercise-list-scroll \.scroll-cue-panel__body/);
  assert.match(css, /\.weight-room-individual-strip-panel/);
  assert.match(css, /\.weight-room-current-stations--preset/);
  assert.match(css, /\.weight-room-current-stations--preset > \.weight-room-station-add-row/);
  assert.match(css, /\.weight-room-group-editor__list section\.is-athlete-drop-target/);
  assert.match(css, /--canvas:\s*#101315/);
  assert.match(css, /--surface:\s*rgba\(23, 28, 32, 0\.82\)/);
  assert.match(css, /--surface-raised:\s*rgba\(29, 34, 39, 0\.86\)/);
  assert.match(css, /--surface-selected:\s*rgba\(194, 47, 98, 0\.18\)/);
  assert.match(css, /\.ui-switch\s*\{/);
  assert.match(css, /\.ui-switch\.is-on/);
  assert.match(css, /\.weight-room-group-editor\.is-disabled \.weight-room-group-editor__content/);
  assert.match(css, /\.weight-room-group-disabled-note/);
  assert.match(css, /\.panel,\s*\.team-workspace-header,\s*\.modal-panel/);
  assert.match(css, /\.weight-room-player-list__scroll-panel/);
  assert.match(css, /--weight-room-athlete-detail-height/);
  assert.match(css, /\.weight-room-athlete-workspace\s*\{[\s\S]*align-items:\s*start/);
  assert.match(css, /\.weight-room-athlete-workspace \.weight-room-player-list\s*\{[\s\S]*height:\s*var\(--weight-room-athlete-detail-height\)/);
  assert.match(css, /\.weight-room-athlete-workspace \.weight-room-player-list\s*\{[\s\S]*max-height:\s*var\(--weight-room-athlete-detail-height\)/);
  assert.match(css, /\.weight-room-athlete-workspace \.weight-room-player-list\s*\{[\s\S]*display:\s*flex/);
  assert.match(css, /\.weight-room-exercise-box-table \.weight-room-athlete-table__head,\s*\.weight-room-exercise-box-table \.weight-room-athlete-table__row\s*\{[\s\S]*--weight-room-exercise-progress-columns/);
  assert.match(css, /\.weight-room-exercise-progress-scroll \.scroll-cue-panel__body/);
  assert.doesNotMatch(css, /weight-room-exercise-breakdown/);
  assert.match(css, /\.weight-room-exercise-preset-modal/);
  assert.match(css, /height:\s*min\(680px,\s*calc\(100dvh - 28px\)\)/);
  assert.match(css, /\.weight-room-exercise-preset-modal \.weight-room-preset-builder__scroll \.scroll-cue-panel__body\s*\{[\s\S]*height:\s*100%/);
  assert.match(css, /\.weight-room-exercise-mode-select/);
  assert.match(css, /\.weight-room-exercise-info-panel > div\s*\{[\s\S]*grid-auto-flow:\s*column/);
  assert.match(css, /\.weight-room-exercise-results \.weight-room-result-table__head button/);
  assert.match(css, /\.modal-body\s*\{[\s\S]*overflow:\s*auto/);
  assert.match(css, /\.modal-panel\.has-scroll-bottom \.modal-scroll-fade--bottom/);
  assert.match(css, /\.modal-panel > \.modal-footer-slot > \.modal-actions/);
  assert.match(page, /document\.body\.style\.overflow = "hidden"/);
  assert.match(page, /ResizeObserver/);
  assert.doesNotMatch(css, /scrollbar-width:\s*(thin|auto)/);
  assert.doesNotMatch(css, /import-choice__menu/);
  assert.doesNotMatch(css, /\.import-row-choice \.choice-select__menu/);
  assert.match(css, /\.import-row-choice \.choice-select__button strong\s*\{[\s\S]*white-space:\s*nowrap/);
});

test("roster dropdown controls stay shared and roster sync skips stale memberships", () => {
  const page = readFileSync("app/page.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");
  const route = readFileSync("app/api/roster/sync/route.ts", "utf8");
  const repository = readFileSync("app/data/supabaseRepository.ts", "utf8");
  const types = readFileSync("app/types.ts", "utf8");
  const rosterImport = readFileSync("app/lib/rosterImport.ts", "utf8");

  assert.match(types, /export type Throws = "R" \| "L" \| "S"/);
  assert.match(page, /const THROWS_OPTIONS: Player\["throws"\]\[] = \["R", "L", "S"\]/);
  assert.match(page, /const GRADUATION_YEAR_START = 2026/);
  assert.match(page, /const GRADUATION_YEAR_END = GRADUATION_YEAR_START \+ 100/);
  assert.match(page, /function graduationYearOptions/);
  assert.match(page, /aria-label="Graduation"[\s\S]*options=\{graduationYearOptions\(form\.graduationYear\)\}/);
  assert.match(page, /aria-label="Graduation year"[\s\S]*options=\{graduationYearOptions\(row\.graduationYear\)\}/);
  assert.doesNotMatch(page, /ManualNumberCell label="Graduation/);
  assert.doesNotMatch(page, /options=\{\["R", "L"\]\.map/);
  assert.match(page, /\{!inTeamContext && \(\s*<TopCommand/);

  assert.match(route, /const submittedPlayerIds = new Set/);
  assert.match(route, /submittedPlayerIds\.has\(membership\.playerId\)/);
  assert.match(repository, /const submittedPlayerIds = new Set/);
  assert.match(repository, /submittedPlayerIds\.has\(membership\.playerId\)/);
  assert.match(rosterImport, /"SWITCH"/);

  assert.match(css, /\.choice-select\.status-select-wrap--varsity/);
  assert.match(css, /\.choice-select\.import-choice/);
  assert.match(css, /\.choice-select\.filter-select/);
  assert.doesNotMatch(css, /^\.status-select-wrap--varsity/m);
  assert.doesNotMatch(css, /^\.import-choice\s*\{/m);
  assert.doesNotMatch(css, /^\.filter-select\s*\{/m);
  assert.doesNotMatch(css, /\.status-select-wrap \.choice-select__menu/);
});

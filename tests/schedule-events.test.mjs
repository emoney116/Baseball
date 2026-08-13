import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("unified schedule keeps practice and game records linked without duplicate calendar rows", () => {
  const migration = readFileSync("supabase/migrations/20260812213000_unified_team_schedule.sql", "utf8");
  const repository = readFileSync("app/data/supabaseRepository.ts", "utf8");
  const page = readFileSync("app/page.tsx", "utf8");

  assert.match(migration, /create table if not exists public\.schedule_events/);
  assert.match(migration, /practice_id uuid references public\.practices\(id\) on delete cascade/);
  assert.match(migration, /game_id uuid references public\.games\(id\) on delete cascade/);
  assert.match(migration, /workout_session_id uuid references public\.workout_sessions\(id\) on delete cascade/);
  assert.match(migration, /create unique index if not exists schedule_events_practice_id_key/);
  assert.match(migration, /create unique index if not exists schedule_events_game_id_key/);
  assert.match(migration, /select\s+p\.id,[\s\S]*p\.id,[\s\S]*from public\.practices p/);
  assert.match(migration, /select\s+g\.id,[\s\S]*g\.id,[\s\S]*from public\.games g/);
  assert.match(migration, /where se\.practice_id = p\.id/);
  assert.match(migration, /where se\.game_id = g\.id/);

  assert.match(repository, /await syncPractices\(supabase, foundation, next\.practices\);[\s\S]*await syncGames\(supabase, foundation, next\);[\s\S]*await syncScheduleEvents\(supabase, foundation, next\);/);
  assert.match(repository, /function isStandaloneScheduleEvent\(event: ScheduleEvent\)/);
  assert.match(repository, /\.filter\(isStandaloneScheduleEvent\)/);
  assert.match(repository, /const practiceRows = data\.practices\.map/);
  assert.match(repository, /id: practice\.id,[\s\S]*practice_id: practice\.id/);
  assert.match(repository, /const gameRows = data\.games\.map/);
  assert.match(repository, /id: game\.id,[\s\S]*game_id: game\.id/);
  assert.match(repository, /from\("schedule_events"\)\.upsert\(rows, \{ onConflict: "id" \}\)/);

  assert.match(page, /const TEAM_NAV_ITEMS[\s\S]*label: "Schedule"/);
  assert.match(page, /function buildScheduleItems\(data: AppData\)/);
  assert.match(page, /const practiceItems: ScheduleItem\[\] = data\.practices\.map/);
  assert.match(page, /const gameItems: ScheduleItem\[\] = data\.games\.map/);
  assert.match(page, /const liftItems: ScheduleItem\[\] = \[\.\.\.workoutsByDate\.entries\(\)\]\.map/);
  assert.match(page, /const genericItems: ScheduleItem\[\] = \(data\.scheduleEvents \?\? \[\]\)[\s\S]*\.filter\(\(event\) => !event\.practiceId && !event\.gameId && !event\.workoutSessionId\)/);
  assert.match(page, /function ScheduleEventModal/);
  assert.match(page, /onCreatePractice\(practice, attendance\)/);
  assert.match(page, /onCreateGame\(\{/);
  assert.match(page, /onCreateEvent\(\{/);
});

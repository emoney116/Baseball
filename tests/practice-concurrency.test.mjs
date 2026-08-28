import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("practice architecture supports concurrent sessions and append-only events", () => {
  const migration = readFileSync("supabase/migrations/20260813190000_practice_concurrency.sql", "utf8");
  const repository = readFileSync("app/data/supabaseRepository.ts", "utf8");
  const page = readFileSync("app/page.tsx", "utf8");
  const helpers = readFileSync("app/lib/practiceConcurrency.ts", "utf8");
  const styles = readFileSync("app/globals.css", "utf8");

  assert.match(migration, /create table if not exists public\.practice_session_contributors/);
  assert.match(migration, /unique \(session_id, profile_id\)/);
  assert.match(migration, /practice_attendance_practice_player_key/);
  assert.match(migration, /assign_practice_event_sequence/);
  assert.match(migration, /for each row execute function public\.assign_practice_event_sequence\(\)/);
  assert.match(migration, /pitch_events_session_id_idx/);
  assert.match(migration, /hitting_events_session_id_idx/);
  assert.match(migration, /defense_events_session_id_idx/);
  assert.match(migration, /is_session_staff\(session_id\)/);

  assert.match(repository, /await syncPracticeSessions\(supabase, next\);[\s\S]*await syncPracticeSessionContributors\(supabase, next\);[\s\S]*await syncPracticeEvents\(supabase, next\);/);
  assert.match(repository, /from\("practice_session_contributors"\)\.upsert\(rows, \{ onConflict: "session_id,profile_id" \}\)/);
  assert.doesNotMatch(repository, /id: contributor\.id,[\s\S]*session_id: contributor\.sessionId/);
  assert.match(repository, /created_by_profile_id: event\.createdByProfileId/);
  assert.match(repository, /idempotency_key: event\.idempotencyKey/);
  assert.match(repository, /session_sequence: event\.sessionSequence/);

  assert.match(helpers, /function appendPracticeEvents/);
  assert.match(helpers, /function upsertPracticeAttendance/);
  assert.match(helpers, /function deriveConcurrentPracticeTotals/);
  assert.match(helpers, /function touchSessionContributor/);
  assert.match(helpers, /byPracticePlayer\.set\(key, \{ \.\.\.byPracticePlayer\.get\(key\), \.\.\.row \}\)/);

  assert.match(page, /function PracticeActiveSessionsCard/);
  assert.match(page, /function buildActivePracticeSessions/);
  assert.match(page, /const PRACTICE_ACTIVE_SESSION_GRACE_MS = 2 \* 60 \* 1000/);
  assert.match(page, /function isPracticeSessionLive/);
  assert.match(page, /function practiceSessionLastActivityAt/);
  const activityStart = page.indexOf("function practiceSessionLastActivityAt");
  const activityEnd = page.indexOf("function practiceSessionActivityLabel", activityStart);
  const activityFunction = page.slice(activityStart, activityEnd);
  assert.match(activityFunction, /practiceSessionContributors/);
  assert.match(activityFunction, /hittingEvents/);
  assert.match(activityFunction, /pitchEvents/);
  assert.doesNotMatch(activityFunction, /updatedAt/);
  assert.match(page, /const persistQueueRef = useRef<Promise<void>>\(Promise\.resolve\(\)\)/);
  assert.match(page, /const persistSequenceRef = useRef\(0\)/);
  assert.match(page, /persistQueueRef\.current[\s\S]*await supabaseAppRepository\.sync\(previous, next\)/);
  assert.match(page, /function isPracticeSessionReusable/);
  assert.doesNotMatch(page, /function buildPracticeActivityFeed/);
  assert.match(page, /const activeSessions = practice && !practiceEndedAt \? buildActivePracticeSessions/);
  assert.match(page, /onOpenSession=\{resumePracticeSession\}/);
  assert.match(page, /onSessionHeartbeat=\{touchActivePracticeSession\}/);
  assert.match(page, /touchSessionContributor/);
  assert.match(page, /nextSessionSequence/);
  assert.match(page, /const profileId = current\.teamContext\?\.profile\?\.id/);
  assert.match(page, /createdByProfileId: profileId/);
  assert.match(page, /entrySource: "COACH"/);
  assert.match(page, /session\.practiceId === practiceId && isPracticeSessionReusable\(session\) && isPracticeSessionLive\(data, session\.id, nowMs\)/);
  assert.match(page, /const heartbeat = window\.setInterval/);
  assert.match(page, /Save Notes/);
  assert.doesNotMatch(page, /End Session<\/button>/);
  assert.doesNotMatch(page, /window\.confirm\(`\$\{activeSessions\.length\} session/);

  assert.match(styles, /\.practice-active-sessions-card/);
  assert.match(styles, /@media \(min-width: 981px\) and \(max-height: 720px\)/);
  assert.match(styles, /\.ops-sidebar[\s\S]*overflow-y: auto/);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { gzipSync } from 'node:zlib';
import { readAllRows } from '../app/lib/readAllRows.ts';
import { currentStartedPractice } from '../app/lib/practiceStart.ts';
import {readPracticeRunnerActions} from '../app/lib/practiceRunnerActions.ts';

const source = readFileSync('app/data/supabaseRepository.ts', 'utf8');
function repository(client) {
  const context = { exports: {}, require: () => ({ createClient: () => client, readPracticeRunnerActions, readAllRows, currentStartedPractice, APP_NAME: 'Clubhouse 9', exactRosterWorkingData: data => data }),
    fetch: async () => ({ ok: true, json: async () => ({ organizations: [], teams: [] }) }) };
  vm.runInNewContext(ts.transpileModule(`${source}\nexport { ensureOwnProfile, loadAppData };`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return context.exports;
}
const api = repository();
const profile = { id: 'profile', email: 'coach@example.test', first_name: 'Test', last_name: 'Coach', display_name: 'Test Coach', role: 'COACH', avatar_url: '/existing.png' };
function database(fixtures = {}, errors = {}) {
  const calls = [], events = [];
  const rows = structuredClone(fixtures);
  return { calls, events, auth: {}, rpc(name,args) { calls.push({table:name,args});return {order:()=>({range:async()=>({data:[],error:null})})}; }, from(table) {
    const call = { table, filters: [], orders: [] }; calls.push(call);
    const query = {
      select() { return query; }, eq(key, value) { call.filters.push(['eq', key, value]); return query; },
      in(key, value) { call.filters.push(['in', key, value]); return query; },
      gt(key, value) { call.filters.push(['gt', key, value]); return query; },
      order(key) { call.orders.push(key); return query; }, or() { return query; }, limit(value) { call.limit = value; return query; },
      maybeSingle() { call.single = true; return query; },
      upsert(value) { call.write = value; return query; },
      then(resolve, reject) {
        events.push(`start:${table}`);
        return new Promise(done => setTimeout(done, 2)).then(() => {
          events.push(`end:${table}`);
          if (errors[table]) return { data: null, error: errors[table] };
          if (call.write) { rows[table] = [{ ...rows[table]?.[0], ...call.write }]; return { data: null, error: null }; }
          if (table === 'game_lineups') assert.ok(!call.orders.includes('id'), 'lineups use a composite key, not id');
          let data = (rows[table] ?? []).filter(row => call.filters.every(([op, key, value]) => op === 'eq' ? row[key] === value : op === 'in' ? value.includes(row[key]) : row[key] > value));
          if (call.orders.includes('id')) data = [...data].sort((a, b) => a.id.localeCompare(b.id));
          if (call.limit) data = data.slice(0, call.limit);
          return { data: call.single ? data[0] ?? null : data, error: null };
        }).then(resolve, reject);
      },
    }; return query;
  } };
}
const profileInput = { id: profile.id, email: profile.email, firstName: profile.first_name, lastName: profile.last_name, displayName: profile.display_name };

test('unchanged profiles load with one read and no writes', async () => {
  const db = database({ profiles: [profile] });
  const result = await api.ensureOwnProfile(db, profileInput);
  assert.equal(db.calls.length, 1);
  assert.ok(db.calls.every(call => !call.write));
  assert.equal(result.avatarUrl, profile.avatar_url);
  assert.equal(result.id, profile.id);
});
test('changed and missing profiles still persist and re-read authoritative values', async () => {
  for (const profiles of [[profile], []]) {
    const db = database({ profiles });
    const result = await api.ensureOwnProfile(db, { ...profileInput, firstName: 'Updated' });
    assert.equal(db.calls.length, 3);
    assert.equal(db.calls.filter(call => call.write).length, 1);
    assert.equal(result.firstName, 'Updated');
  }
});
test('profile read errors fail closed, without attempted writes', async () => {
  const db = database({}, { profiles: { message: 'permission denied' } });
  await assert.rejects(api.ensureOwnProfile(db, profileInput), /permission denied/);
  assert.equal(db.calls.length, 1);
});

const foundation = { organizationId: 'org', teamId: 'team', seasonId: 'season', teamContext: { profile: { id: 'profile' }, availableTeams: [] } };
test('team loading retains complete data while independent auxiliary reads overlap', async () => {
  const db = database();
  const data = await api.loadAppData(db, foundation);
  for (const key of ['players', 'games', 'gameEvents', 'plateAppearances', 'practices', 'pitchEvents', 'hittingEvents', 'workoutEntries']) assert.equal(data[key].length, 0, key);
  const starts = ['roster_imports', 'schedule_events', 'profile_follows', 'profile_follow_exclusions', 'profile_team_pins'].map(table => db.events.indexOf(`start:${table}`));
  const firstEnd = Math.min(...['roster_imports', 'schedule_events', 'profile_follows', 'profile_follow_exclusions', 'profile_team_pins'].map(table => db.events.indexOf(`end:${table}`)));
  assert.ok(starts.every(index => index >= 0 && index < firstEnd), 'independent reads must start together');
});
test('game reads are scoped to selected games and lineup composite keys stay valid', async () => {
  const db = database({ games: [{ id: 'game', team_id: 'team', season_id: 'season', game_date: '2026-09-17', opponent: 'Other team' }] });
  const data = await api.loadAppData(db, foundation);
  assert.equal(data.games.length, 1);
  for (const table of ['game_lineups', 'game_pitch_events', 'plate_appearances']) {
    const calls = db.calls.filter(call => call.table === table);
    assert.ok(calls.length);
    assert.ok(calls.every(call => call.filters.some(([op, key, ids]) => op === 'in' && key === 'game_id' && ids.length === 1 && ids[0] === 'game')));
  }
});
test('failed team reads do not render a successful partial dataset', async () => {
  const db = database({}, { practices: { message: 'connection failed' } });
  await assert.rejects(api.loadAppData(db, foundation), /connection failed/);
});
test('scoped history retains practice appearances and all pages of game history', async () => {
  const gameEvents = Array.from({ length: 1002 }, (_, index) => ({ id: String(index).padStart(5, '0'), game_id: 'game', created_at: `2026-${index}` }));
  const db = database({
    games: [{ id: 'game', team_id: 'team', season_id: 'season', game_date: '2026-09-17' }],
    practices: [{ id: 'practice', team_id: 'team', season_id: 'season', practice_date: '2026-09-17' }],
    game_pitch_events: [...gameEvents, { id: 'foreign', game_id: 'other-game' }],
    plate_appearances: [{ id: 'game-pa', game_id: 'game' }, { id: 'practice-pa', practice_id: 'practice' }, { id: 'both-pa', game_id: 'game', practice_id: 'practice' }, { id: 'foreign-pa', game_id: 'other-game' }],
  });
  const data = await api.loadAppData(db, foundation);
  assert.equal(data.gameEvents.length, 1002);
  assert.equal(new Set(data.gameEvents.map(row => row.id)).size, 1002);
  assert.deepEqual(Array.from(data.plateAppearances, row => row.id).sort(), ['both-pa', 'game-pa', 'practice-pa']);
});
test('workout polling reads only scoped workout data and retains exercise identity', async () => {
  const db = database({
    weight_room_workouts: [{ id: 'w', team_id: 'team', season_id: 'season' }, { id: 'foreign', team_id: 'other', season_id: 'season' }],
    workout_sessions: [{ id: 's', team_id: 'team', season_id: 'season', player_id: 'p' }],
    workout_sets: [{ id: 'set', workout_session_id: 's', exercise_id: 'e', player_id: 'p', value: 42 }],
    exercises: [{ id: 'e', name: 'Vertical', kind: 'Jump' }],
    weight_room_workout_stations: [{ id: 'station', workout_id: 'w' }, { id: 'other', workout_id: 'foreign' }],
  });
  const result = await repository(db).supabaseAppRepository.loadWeightRoom('team', 'season');
  assert.equal(result.weightRoomWorkouts.length, 1);
  assert.equal(result.weightRoomWorkoutStations.length, 1);
  assert.equal(result.workoutEntries[0].exercise, 'Vertical');
  assert.equal(result.workoutEntries[0].value, 42);
  assert.ok(db.calls.every(call => /^(weight_room_workout|workout_|exercises)/.test(call.table)));
  assert.ok(db.calls.every(call => call.filters.length > 0));
  assert.ok(db.calls.every(call => !call.write));
  const empty = database();
  const emptyResult = await repository(empty).supabaseAppRepository.loadWeightRoom('team', 'season');
  assert.equal(emptyResult.workoutEntries.length, 0);
  assert.equal(empty.calls.length, 2, 'empty scope must not become an unfiltered child query');
});

test('contributors and games cannot pull another team history into the workspace', async () => {
  const db = database({
    player_team_memberships: [{ id: 'm', player_id: 'p', team_id: 'team', season_id: 'season' }],
    players: [{ id: 'p', first_name: 'Test', last_name: 'Player' }],
    practices: [{ id: 'practice', team_id: 'team', season_id: 'season' }],
    practice_sessions: [{ id: 'session', practice_id: 'practice', player_id: 'p', category: 'hitting' }],
    practice_session_contributors: [{ id: 'c', session_id: 'session' }, { id: 'other', session_id: 'foreign' }],
    games: [{ id: 'foreign', team_id: 'other', season_id: 'season' }],
  });
  const result = await api.loadAppData(db, foundation);
  assert.equal(result.games.length, 0);
  assert.equal(result.practiceSessionContributors.length, 1);
  assert.ok(db.calls.filter(call => call.table === 'practice_session_contributors').every(call => call.filters.some(([op, key]) => op === 'in' && key === 'session_id')));
});

test('idle Practice overview polls lifecycle and attendance, not unrelated event history', async () => {
  const db = database({ practices: [{ id: 'p', team_id: 'team', season_id: 'season' }], practice_attendance: [{ id: 'a', practice_id: 'p', player_id: 'player', status: 'Present' }] });
  const result = await repository(db).supabaseAppRepository.loadPracticeOverview('team', 'season');
  assert.equal(result.practices.length, 1);
  assert.equal(result.attendance.length, 1);
  assert.ok(db.calls.every(call => ['practices', 'practice_attendance'].includes(call.table)));
  const workspace = readFileSync('app/ClubhouseWorkspace.tsx', 'utf8');
  const polling = workspace.slice(workspace.indexOf('let cancelled = false, reading = false;'), workspace.indexOf('function persistChange'));
  assert.doesNotMatch(polling, /supabaseAppRepository\.load\(/);
  assert.match(polling, /document.visibilityState !== "visible"/);
  assert.match(polling, /clearInterval/);
});

test('entry defers workspace code, never replaces authoritative access checks', () => {
  const entry = readFileSync('app/page.tsx', 'utf8');
  const workspace = readFileSync('app/ClubhouseWorkspace.tsx', 'utf8');
  assert.match(entry, /dynamic\(\(\) => import\("\.\/ClubhouseWorkspace"\)/);
  assert.doesNotMatch(entry, /import .+ from "\.\/(?:data|ClubhouseWorkspace)/);
  assert.match(entry, /PASSWORD_RECOVERY/);
  assert.match(entry, /SIGNED_OUT/);
  assert.match(entry, /checkSequence\.current\+\+/);
  assert.match(workspace, /await authRepository.getState\(\)/);
  assert.match(workspace, /fetch\(`\/api\/player\/session/);
  assert.match(source, /await supabase.auth.getUser\(\)/);
});

test('production entry stays within its initial JavaScript budget', () => {
  const html = readFileSync('.next/server/app/index.html', 'utf8');
  const scripts = [...new Set([...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(match => match[1]))];
  assert.ok(scripts.length > 0);
  const chunks = scripts.map(path => readFileSync(`.next/${path.replace('/_next/', '')}`));
  const bytes = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const gzip = chunks.reduce((sum, chunk) => sum + gzipSync(chunk).length, 0);
  assert.ok(bytes < 1_000_000, `Initial entry JavaScript grew to ${bytes} bytes`);
  assert.ok(gzip < 300_000, `Compressed entry JavaScript grew to ${gzip} bytes`);
});

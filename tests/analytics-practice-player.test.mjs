import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleData } from '../app/data/sampleData.ts';
import { executeAnalyticsQuery } from '../app/lib/analyticsQuery.ts';
import { practicePitching } from '../app/lib/practicePitching.ts';
import { weightRoomAnalyticsRecords } from '../app/lib/weightRoomAnalytics.ts';
import { safePlayerRow, loadPlayerSession } from '../app/lib/playerAccess.ts';
import { playerServiceFixture, uuid } from './helpers/playerServiceFixture.mjs';

const context = (result, before = 0, after = before) => ({ source: 'Live BP', thrower: 'PLAYER', mode: 'GAME', result, before: { balls: 0, strikes: 0, outs: before, pa: 1, runners: [] }, after: { balls: 0, strikes: 0, outs: after, pa: 2, runners: [] } });
const query = domain => ({ domain, source: 'all', fieldSources: ['practice', 'live-bp'], mode: 'box-score', timeRange: 'season', filters: {}, groupBy: 'player' });
function fixture() {
  const d = structuredClone(sampleData);
  d.players = d.players.slice(0, 2);
  d.practices = [{ ...d.practices[0], id: 'qa-practice', date: '2026-10-22' }];
  d.pitchingSessions = [{ id: 'qa-pitch-session', practiceId: 'qa-practice', pitcherId: d.players[0].id, type: 'Live BP' }];
  d.hittingSessions = [{ id: 'qa-hit-session', practiceId: 'qa-practice', hitterId: d.players[1].id, type: 'Live BP' }];
  const results = [['Single',0,0], ['Walk',0,0], ['Strikeout',0,1], ['Out',1,2], ['Home Run',2,2], ['HBP',2,2], ['Foul',2,2]];
  d.pitchEvents = results.map(([result,before,after], i) => ({ ...d.pitchEvents[0], id: `pitch-${i}`, pitcherId: d.players[0].id, practiceId: 'qa-practice', sessionId: 'qa-pitch-session', velocity: 70+i, liveBpContext: context(result,before,after), isStrike: result !== 'Walk', outcome: result === 'Walk' ? 'Ball' : 'Called strike', createdAt: '2026-10-22T18:00:00Z' }));
  d.hittingEvents = results.map(([result,before,after], i) => ({ ...d.hittingEvents[0], id: `hit-${i}`, hitterId: d.players[1].id, practiceId: 'qa-practice', sessionId: 'qa-hit-session', action: ['Single','Out','Home Run'].includes(result) ? 'Ball in play' : result === 'Strikeout' ? 'Miss' : result === 'Foul' ? 'Foul' : 'Took pitch', isLiveBp: true, exitVelocityMph: ['Single','Home Run'].includes(result) ? 90 : undefined, liveBpContext: context(result,before,after) }));
  d.gameEvents = [];
  return d;
}
test('practice pitching exposes recorded BF/K/BB/H, real innings, opponent rates and velocity', () => {
  const d = fixture(), r = executeAnalyticsQuery(d, query('pitching'));
  const row = r.rows.find(r => r.player.id === d.players[0].id);
  for (const [metric, value] of Object.entries({ pitches: 7, battersFaced: 6, pitcherStrikeouts: 1, walksAllowed: 1, hitsAllowed: 2, hitBatters: 1, avgPitchVelo: 73, maxPitchVelo: 76, opponentAvg: .5, opponentSlg: 1.25, whip: 4.5 })) assert.equal(row.cells[metric].value, value, metric);
  assert.equal(row.cells.inningsPitched.display, '0.2');
  assert.equal(row.cells.strikeoutsPerNine.value, 13.5);
  assert.equal(row.cells.hitsPerNine.value, 27);
  assert.ok(r.availableColumns.some(c => c.metricId === 'pitcherStrikeouts'));
  assert.ok(!r.availableEvents.some(e => e.id === 'qa-hit-session'));
});
test('practice batting uses terminal outcomes, not swings as at-bats, and does not use pitch velo as EV', () => {
  const d = fixture(), r = executeAnalyticsQuery(d, query('hitting'));
  const row = r.rows.find(r => r.player.id === d.players[1].id);
  assert.equal(row.cells.pa.value, 6);
  assert.equal(row.cells.ab.value, 4);
  assert.equal(row.cells.hits.value, 2);
  assert.equal(row.cells.avg.value, .5);
  assert.equal(row.cells.maxEv.value, 90);
  assert.ok(!r.availableEvents.some(e => e.id === 'qa-pitch-session'));
});
test('unknown outs and coach/machine pitches cannot fabricate practice innings or player outcomes', () => {
  const events = fixture().pitchEvents;
  assert.equal(practicePitching(events.map(e => ({ ...e, liveBpContext: { ...e.liveBpContext, mode: 'AB' } }))).outs, undefined);
  assert.equal(practicePitching(events.map(e => ({ ...e, liveBpContext: { ...e.liveBpContext, thrower: 'COACH' } }))).battersFaced, 0);
  assert.equal(practicePitching([...events, ...events]).battersFaced, 6);
});
test('athlete and practice filters cannot broaden to other players or events', () => {
  const d = fixture();
  assert.equal(executeAnalyticsQuery(d, { ...query('pitching'), eventIds: ['missing'] }).rows.some(r => r.sampleCount), false);
  const own = executeAnalyticsQuery(d, { ...query('pitching'), playerIds: [d.players[0].id] });
  assert.deepEqual(own.rows.map(r => r.player.id), [d.players[0].id]);
});

test('own-player pitch-type splits retain scoped aggregate rows', () => {
  const d = fixture();
  d.pitchEvents.forEach(e => { e.pitchType = 'Fastball'; });
  const result = executeAnalyticsQuery(d, { ...query('pitching'), view: 'pitch-types', playerIds: [d.players[0].id] });
  assert.ok(result.rows.length > 0);
  assert.equal(result.rows[0].rowKind, 'group');
  assert.equal(result.rows[0].cells.pitches.value, 7);
});
test('Weight Room records honor athlete, exercise, workout/date filters and never turn timed defaults into volume', () => {
  const d = fixture(), p = d.players[0].id;
  d.workoutSessions = [{ id: 's', playerId: p, date: '2026-10-14' }];
  d.workoutEntries = [{ id:'a',sessionId:'s',playerId:p,exercise:'Bench',weight:45,reps:20,unit:'lb' },{ id:'b',sessionId:'s',playerId:p,exercise:'Dash',weight:225,reps:5,value:4,unit:'sec' },{ id:'c',sessionId:'s',playerId:p,exercise:'Bench',unit:'lb',status:'Completed' }];
  const rows = weightRoomAnalyticsRecords(d,{playerIds:[p],eventIds:['workout-day:2026-10-14']});
  assert.equal(rows.length,3);
  assert.equal(rows.reduce((s,r)=>s+r.volume,0),900);
  assert.equal(weightRoomAnalyticsRecords(d,{playerIds:[d.players[1].id]}).length,0);
  assert.equal(weightRoomAnalyticsRecords(d,{start:'2026-10-15'}).length,0);
  assert.equal(weightRoomAnalyticsRecords(d,{eventIds:['missing']}).length,0);
});
test('server projection keeps own measured fields but redacts teammate contexts and private metadata', () => {
  const row = safePlayerRow('hitting', { hitter_id:'own', live_bp_context:{...context('Single'), defensiveActions:[{playerId:'other',grade:'PRIVATE'}],before:{outs:0,runnerIds:{1:'own',2:'other'}}} });
  assert.equal(row.live_bp_context.before.runnerIds[1],'own');
  assert.equal(row.live_bp_context.before.runnerIds[2],'occupied-2');
  assert.doesNotMatch(JSON.stringify(row),/other|PRIVATE/);
  assert.deepEqual(safePlayerRow('set',{test_conditions:{key:'pull-ups-60'},test_side:'Left',notes:'PRIVATE'}),{test_conditions:{key:'pull-ups-60'},test_side:'Left'});
});
test('authenticated player-service fixture supplies only own analytics primitives', async () => {
  const f = playerServiceFixture();
  f.tables.players[0].metadata.weightLb = 166.1;
  const session = await loadPlayerSession(f.db,uuid(1));
  assert.equal(session.data.players.length,1);
  assert.equal(session.data.players[0].weight,166.1);
  assert.equal(session.data.hittingEvents.every(e=>e.hitterId===f.own),true);
  await assert.rejects(loadPlayerSession(f.db,uuid(1),{playerId:f.other}),e=>e.status===403);
});

test('player workout projection retains only referenced measurement definitions and rejects completion volume', async () => {
  const f = playerServiceFixture(), team = uuid(20), season = uuid(30);
  f.tables.workout_sessions = [{ id:uuid(200),player_id:f.own,team_id:team,season_id:season,session_date:'2026-10-14' }];
  f.tables.workout_sets = [{ id:uuid(201),player_id:f.own,workout_session_id:uuid(200),workout_station_id:uuid(202),exercise_id:uuid(203),weight:100,reps:20,unit:'lb' }];
  f.tables.exercises = [{ id:uuid(203),name:'Footwork',kind:'Custom',unit:'lb' }];
  f.tables.weight_room_workout_stations = [{ id:uuid(202),workout_id:uuid(204),exercise_name:'Footwork',measurement_type:'COMPLETION',notes:'PRIVATE STATION NOTE' },{ id:uuid(205),exercise_name:'OTHER STATION' }];
  const session = await loadPlayerSession(f.db,uuid(1));
  assert.equal(session.data.weightRoomWorkoutStations.length,1);
  assert.equal(session.data.weightRoomWorkoutStations[0].measurementType,'COMPLETION');
  assert.doesNotMatch(JSON.stringify(session.data.weightRoomWorkoutStations),/PRIVATE|OTHER/);
  assert.equal(weightRoomAnalyticsRecords(session.data,{})[0].volume,0);
});

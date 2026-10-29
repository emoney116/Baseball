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

function mixedFixture() {
  const d=fixture(), hitter=d.players[1].id, pitcher=d.players[0].id;
  d.games=[{...d.games[0],id:'qa-game',date:'2026-10-22'}];
  d.plateAppearances=[];
  d.gameEvents=['Double','Ground Out','Walk'].map((result,i)=>({id:`game-${i}`,gameId:'qa-game',batterId:hitter,pitcherId:pitcher,plateAppearanceId:`game-pa-${i}`,sequenceNumber:i+1,inning:1,half:'Top',pitchType:'4-Seam',pitchOutcome:result==='Walk'?'Ball':'In Play',ballInPlayOutcome:result==='Walk'?undefined:result,countBefore:result==='Walk'?{balls:3,strikes:0}:{balls:0,strikes:0},outsBefore:0,outsAfter:result==='Ground Out'?1:0,metrolinaRunsBefore:0,metrolinaRunsAfter:0,opponentRunsBefore:0,opponentRunsAfter:0,velocity:80,createdAt:'2026-10-22T18:00:00Z'}));
  d.hittingEvents.forEach(e=>{e.pitchType='4-Seam';});
  d.pitchEvents.forEach(e=>{e.pitchType='4-Seam';});
  return d;
}

test('Practice plus Live BP and Games share one batting line with recomputed advanced rates',()=>{
  const d=mixedFixture(), result=executeAnalyticsQuery(d,{...query('hitting'),fieldSources:['practice','live-bp','games'],playerIds:[d.players[1].id]});
  assert.equal(result.rows.length,1);
  const c=result.rows[0].cells;
  for(const [id,value] of Object.entries({pa:9,ab:6,hits:3,totalBases:7,walks:2,strikeouts:1,avg:.5,slg:7/6,iso:4/6,babip:.5,strikeoutPct:100/9,walkPct:200/9})) assert.ok(Math.abs(c[id].value-value)<1e-9,`${id}: ${c[id].value}`);
  assert.ok(Math.abs(c.ops.value-(6/9+7/6))<1e-9);
  assert.ok(result.availableColumns.some(c=>c.metricId==='twoStrikeContactPct'));
});

test('mixed count and pitch-type splits include Games without creating a second player line',()=>{
  const d=mixedFixture(), q={...query('hitting'),fieldSources:['practice','live-bp','games'],playerIds:[d.players[1].id]};
  const split=executeAnalyticsQuery(d,{...q,view:'pitch-types'});
  assert.equal(split.rows.length,1);
  assert.equal(split.rows[0].cells.pa.value,9);
  assert.equal(split.rows[0].cells.hits.value,3);
  const counted=executeAnalyticsQuery(d,{...q,filters:{exactCounts:['0-0'],pitchTypes:['4-Seam']}});
  assert.equal(counted.rows[0].cells.pa.value,8);
  assert.equal(counted.rows[0].cells.walks.value,1);
  assert.equal(executeAnalyticsQuery(d,{...q,filters:{pitchTypes:['Slider']}}).rows[0].sampleCount,0);
});

test('pitching sources classify ordinary Practice too, respect event evidence, and do not leak Games into coach splits',()=>{
  const d=mixedFixture(), hitter=d.players[1].id;
  d.hittingSessions.push({id:'coach',practiceId:'qa-practice',hitterId:hitter,type:'Coach BP'},{id:'machine',practiceId:'qa-practice',hitterId:hitter,type:'Machine'},{id:'unknown',practiceId:'qa-practice',hitterId:hitter,type:'Other'});
  for(const id of ['coach','machine','unknown']) d.hittingEvents.push({...d.hittingEvents[0],id,sessionId:id,isLiveBp:false,liveBpContext:{...context('Single'),thrower:undefined}});
  const q={...query('hitting'),fieldSources:['practice','live-bp','games'],playerIds:[hitter]};
  for(const [source,count] of [['COACH',1],['MACHINE',1],['PLAYER',10]]){
    const result=executeAnalyticsQuery(d,{...q,filters:{liveBpThrowerSources:[source]}});
    assert.equal(result.rows[0].cells.opportunities.value,count,source);
  }
  const all=executeAnalyticsQuery(d,q);
  assert.equal(all.rows[0].cells.opportunities.value,13);
  assert.ok(all.filterDefinitions.some(f=>f.id==='liveBpThrowerSources'));
});

test('pitching combines all field sources and retains exact count and pitch-type filters',()=>{
  const d=mixedFixture(), q={...query('pitching'),fieldSources:['practice','live-bp','games'],playerIds:[d.players[0].id]};
  const result=executeAnalyticsQuery(d,q), c=result.rows[0].cells;
  assert.equal(c.pitches.value,10);assert.equal(c.battersFaced.value,9);assert.equal(c.hitsAllowed.value,3);assert.equal(c.walksAllowed.value,2);
  const narrowed=executeAnalyticsQuery(d,{...q,filters:{pitchTypes:['4-Seam'],exactCounts:['0-0']}});
  assert.equal(narrowed.rows[0].cells.pitches.value,9);
});

test('a nonterminal pitch matching a filter cannot import the later game outcome',()=>{
  const d=mixedFixture(), hitter=d.players[1].id;
  d.gameEvents=[{...d.gameEvents[0],pitchOutcome:'Called Strike',ballInPlayOutcome:undefined,countBefore:{balls:0,strikes:0}}];
  d.plateAppearances=[{id:'game-pa-0',hitterId:hitter,outcome:'Double',endedAt:'2026-10-22T18:05:00Z'}];
  const r=executeAnalyticsQuery(d,{...query('hitting'),fieldSources:['games'],playerIds:[hitter],filters:{exactCounts:['0-0']}});
  assert.equal(r.rows[0].cells.hits.value,undefined);
  assert.equal(r.rows[0].cells.pa.value,undefined);
});

test('own running events cannot count another hitter plate appearance',()=>{
  const d=mixedFixture(), hitter=d.players[1].id;
  d.gameEvents.push({...d.gameEvents[0],id:'other-hit',plateAppearanceId:'other-pa',batterId:d.players[0].id,runnerId:hitter,runnerMovements:[{runnerId:hitter,from:'third',to:'home'}]});
  const r=executeAnalyticsQuery(d,{...query('hitting'),fieldSources:['games'],playerIds:[hitter]}),c=r.rows[0].cells;
  assert.equal(c.pa.value,3);assert.equal(c.hits.value,1);assert.equal(c.runs.value,1);
});

test('Practice P/PA and approach metrics use recorded complete sequences',()=>{
  const d=fixture(), hitter=d.players[1].id;
  d.hittingEvents=d.hittingEvents.slice(0,2).map((e,i)=>({...e,eventNumber:i+1,action:i?'Ball in play':'Took pitch',liveBpContext:{...context(i?'Single':'Called Strike'),before:{balls:0,strikes:i,outs:0,pa:1,runners:[]}}}));
  const c=executeAnalyticsQuery(d,{...query('hitting'),playerIds:[hitter]}).rows[0].cells;
  assert.equal(c.pitchesPerPlateAppearance.value,2);assert.equal(c.calledStrikePctHitting.value,50);assert.equal(c.firstPitchSwingPct.value,0);
});
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

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildClubhouseWeightRoomScore,combineScore,scorePercentile,SCORE_CANDIDATES} from '../app/lib/clubhouseWeightRoomScore.ts';

function fixture(dates=['2026-09-15']) {
  const data={players:Array.from({length:6},(_,i)=>({id:`p${i}`,name:`Player ${i}`})),workoutSessions:[],workoutEntries:[],weightRoomWorkouts:[],weightRoomWorkoutStations:[],weightRoomWorkoutGroupMembers:[]};
  for(const [n,date] of dates.entries()) {
    const id=`w${n}`;
    data.weightRoomWorkouts.push({id,date,status:'COMPLETED',createdBy:'coach'});
    for(let k=0;k<5;k++)data.weightRoomWorkoutStations.push({id:`${id}s${k}`,workoutId:id,exerciseName:`Exercise ${k}`,targetSets:1,testConditions:k===2?{key:'hold',mode:'MAX_DURATION',loadLb:25}:k<2?{key:`loaded${k}`,mode:'FIXED_LOAD_TIMED_REPS',loadLb:k===0?45:135,durationSeconds:60}:{key:`body${k}`,mode:'TIMED_REPS',durationSeconds:60}});
    for(let p=0;p<6;p++) {
      data.workoutSessions.push({id:`${id}p${p}`,playerId:`p${p}`,date});
      data.weightRoomWorkoutGroupMembers.push({workoutId:id,playerId:`p${p}`,participantStatus:'ASSIGNED'});
      for(let k=0;k<5;k++) {
        const station=data.weightRoomWorkoutStations.find(s=>s.id===`${id}s${k}`);
        data.workoutEntries.push({id:`${id}p${p}e${k}`,sessionId:`${id}p${p}`,playerId:`p${p}`,activeWorkoutId:id,workoutStationId:station.id,exercise:station.exerciseName,createdAt:`${date}T12:00:00Z`,createdByProfileId:'coach',entrySource:'COACH',setNumber:1,sets:1,testAttempt:1,testConditions:station.testConditions,weight:k<2?station.testConditions.loadLb:undefined,reps:k!==2?10+p+n:undefined,value:k===2?20+p+n:undefined});
      }
    }
  }
  return data;
}
const score=data=>buildClubhouseWeightRoomScore(data,SCORE_CANDIDATES.performance80);

test('fixed-load repetitions and held duration are distinct real performance measures',()=>{
  const data=fixture(),result=score(data);
  assert.equal(result.leaders.length,6);
  assert.equal(result.leaders[0].player.id,'p5');
  assert.ok(result.rows[5].score>result.rows[0].score);
  assert.equal(result.rows[0].volume,1800);
  assert.equal(result.rows[0].dimensions.progress,undefined);
  assert.equal(result.rows[0].dimensions.consistency,undefined);
});
test('body weight never converts a fixed test prescription into relative strength',()=>{
  const data=fixture(),before=score(data);
  data.workoutSessions.forEach((s,i)=>s.bodyWeight=i===0?90:250);
  assert.deepEqual(score(data),before);
});
test('unprogrammed, self-logged and extra attempts or sets cannot inflate score',()=>{
  const data=fixture(),before=score(data).leaders;
  const row=data.workoutEntries[0];
  data.workoutEntries.push(...[{activeWorkoutId:'missing'},{entrySource:'PLAYER'},{testAttempt:2},{setNumber:2},{sets:100}].map((change,i)=>({...row,id:`extra${i}`,createdAt:'2026-09-15T13:00:00Z',reps:9999,...change})));
  assert.deepEqual(score(data).leaders,before);
});
test('duplicate canonical IDs and occupied programmed slots never add points',()=>{
  const data=fixture(),before=score(data).leaders;
  data.workoutEntries.push(data.workoutEntries[0],{...data.workoutEntries[0],id:'duplicate-slot',createdAt:'2026-09-15T13:00:00Z',reps:9999});
  assert.deepEqual(score(data).leaders,before);
});
test('skipping a weak measured exercise makes athlete unqualified, not more competitive',()=>{
  const data=fixture();data.workoutEntries=data.workoutEntries.filter(e=>e.id!=='w0p0e0');
  assert.equal(score(data).rows[0].qualified,false);
  assert.equal(score(data).leaders.length,5);
});
test('missing global measures and unavailable dimensions are omitted, not zeroed',()=>{
  const data=fixture();data.workoutEntries=data.workoutEntries.filter(e=>e.workoutStationId!=='w0s0');
  const result=score(data);
  assert.equal(result.rows[0].dimensions.work,undefined);
  assert.deepEqual(result.rows[0].effectiveWeights,{performance:1});
  assert.equal(combineScore({performance:80},{performance:40,work:20,progress:25,consistency:15}).value,80);
});
test('fewer than five comparable athletes or three exercises does not qualify',()=>{
  const data=fixture();data.players=data.players.slice(0,4);
  assert.equal(score(data).leaders.length,0);
  const fewer=fixture();fewer.workoutEntries=fewer.workoutEntries.filter(e=>['w0s0','w0s1'].includes(e.workoutStationId));
  assert.equal(score(fewer).leaders.length,0);
});
test('ties share midrank; extreme magnitude has a bounded effect',()=>{
  assert.equal(scorePercentile(10,[10,10,10,10,10]),50);
  assert.equal(scorePercentile(20,[1,2,3,4,20]),scorePercentile(20000,[1,2,3,4,20000]));
});
test('mismatched test conditions, assignments and dates fail closed',()=>{
  for(const mutate of [d=>d.workoutEntries[0].testConditions={...d.workoutEntries[0].testConditions,durationSeconds:120},d=>d.workoutSessions[0].date='2026-09-14',d=>d.weightRoomWorkoutGroupMembers[0].participantStatus='NOT_ASSIGNED']) {
    const data=fixture();mutate(data);assert.equal(score(data).rows[0].qualified,false);
  }
});
test('progress needs matching prior-period records; consistency needs three assigned dates',()=>{
  const data=fixture(['2026-08-01','2026-09-13','2026-09-14','2026-09-15']);
  const result=score(data);
  assert.ok(result.rows[0].dimensions.progress>50);
  assert.equal(result.rows[0].dimensions.consistency,100);
  data.weightRoomWorkoutGroupMembers=[];
  assert.equal(score(data).rows[0].dimensions.consistency,undefined);
});
test('different incomplete program histories cannot win by cherry-picking one workout',()=>{
  const data=fixture(['2026-09-14','2026-09-15']);
  data.workoutEntries=data.workoutEntries.filter(e=>e.id!=='w1p0e0');
  assert.equal(score(data).rows[0].qualified,false);
});
test('Team Home card has fixed leaders and navigation, no category selector',()=>{
  const ui=readFileSync('app/components/WeightRoomLeaderCard.tsx','utf8');
  assert.match(ui,/Weight Room Leaders/);assert.match(ui,/View Weight Room/);assert.match(ui,/How Clubhouse Score works/);
  assert.doesNotMatch(ui,/ChoiceSelect|<select|<details|Metric definitions/);
});

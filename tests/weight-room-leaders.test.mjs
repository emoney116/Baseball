import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateWeightRoomScore,workoutEntryVolume} from '../app/lib/weightRoom.ts';
import {buildWeightRoomLeaders} from '../app/lib/weightRoomLeaders.ts';
import {workoutAnswer} from '../app/lib/askClubhouse/workoutAnswers.ts';
const players=[{id:'a',name:'A'},{id:'b',name:'B'}];
const sessions=players.map(p=>({id:p.id,playerId:p.id,date:'2026-09-15',completed:false,bodyWeight:p.id==='a'?110:200}));
const entry=(id,playerId,reps,loadLb=45)=>({id,playerId,sessionId:playerId,exercise:'Bench',weight:loadLb,reps,sets:1,testConditions:{mode:'FIXED_LOAD_TIMED_REPS',loadLb,durationSeconds:60}});
test('fixed test loads do not reward lower body weight as strength or overall score',()=>{
  const rows=[entry('1','a',10),entry('2','a',3,135),entry('3','a',4),entry('4','a',5)];
  const score=calculateWeightRoomScore(players[0],[sessions[0]],rows);
  assert.equal(score.relativePerformanceAvailable,false);
  assert.equal(score.qualified,false);
  assert.equal(score.score,0);
});
test('volume is load times reps, excluding durations and unloaded repetitions',()=>{
  assert.equal(workoutEntryVolume(entry('1','a',10)),450);
  assert.equal(workoutEntryVolume({value:80,unit:'sec'}),0);
  assert.equal(workoutEntryVolume({reps:80,unit:'reps'}),0);
});
test('leaders dedupe events, require two loaded entries and separate test conditions',()=>{
  const a=entry('1','a',10),b=entry('2','b',20);
  const model=buildWeightRoomLeaders(players,sessions,[a,a,b,entry('3','b',30),entry('4','b',999,135),{...entry('5','a',999),status:'Skipped'}]);
  assert.equal(model.athletesTrained,2);
  assert.equal(model.volumeLeaders.length,1);
  assert.equal(model.volumeLeaders[0].player.id,'b');
  assert.equal(model.tests.length,2);
  assert.equal(model.tests.find(t=>t.condition.includes('45 lb')).rows[0].value,30);
  assert.equal(model.consistencyLeaders.length,0);
});

test('Ask volume uses the same scoped canonical model as the leader view',()=>{
  const entries=[entry('1','a',10),entry('2','a',20),entry('3','b',30),entry('4','b',40)];
  const data={players,workoutSessions:sessions,workoutEntries:entries};
  const answer=workoutAnswer(data,'Who had the most workout volume?',{launchSurface:'weight_room',analytics:{customDateRange:{start:'2026-09-15',end:'2026-09-15'}}},new Date('2026-09-21'));
  assert.match(answer.answer,/4,500 lb-reps/);
  assert.match(answer.answer,/B: 3,150 lb-reps/);
  assert.match(answer.answer,/A: 1,350 lb-reps/);
});

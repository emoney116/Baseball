import test from 'node:test';
import assert from 'node:assert/strict';
import { workoutAnswer } from '../app/lib/askClubhouse/workoutAnswers.ts';
const now = new Date('2026-09-16T01:00:00Z');
const context = {timeZone:'America/New_York',launchSurface:'weight_room'};
const conditions = {key:'push-ups-60',mode:'TIMED_REPS',durationSeconds:60};
const row = (id,sessionId,reps,extra={}) => ({id,sessionId,reps,playerId:'m',exercise:'Push-Ups',testConditions:conditions,...extra});
const data = {players:[{id:'m',name:'Mylo White'},{id:'j',name:'Jacob Seamon'}],workoutSessions:[{id:'start',date:'2026-08-01'},{id:'last',date:'2026-09-08'},{id:'now',date:'2026-09-15'}],workoutEntries:[row('1','start',10),row('2','last',20),row('3','now',30),row('4','now',40,{playerId:'j'})]};
const answer = (q,d=data) => workoutAnswer(d,q,context,now);
for (const q of [
  'How did Mylo improve in each exercise from last week to this week?',
  'Compare Mylo White pushups last week versus this week',
  'What changed in Mylo push-ups this week?',
  'Show Mylo exercise progress this week',
]) test(q,()=>{
  const result=answer(q);
  assert.equal(result.status,'completed');
  assert.match(result.answer,/20 reps to 30 reps; \+10 reps \(50%\), improved/);
  assert.doesNotMatch(result.answer,/Jacob Seamon/);
});
for (const q of ['How did Mylo improve in each exercise from season begin to now?', 'Compare Mylo pushups this season', 'Mylo exercise progress this month']) test(q,()=>{
  assert.match(answer(q).answer,/10 reps to 30 reps; \+20 reps \(200%\)/);
});
for (const [q,pattern] of [
  ['Total pushups this week',/70 total reps/],
  ['Total pushups last week',/20 total reps/],
  ['Total pushups this month',/90 total reps/],
  ['Total pushups last month',/10 total reps/],
  ['Total pushups this season',/100 total reps/],
  ['Who did the most pushups today?',/Jacob Seamon - 40 reps/],
  ['What was the average pushups today?',/35 reps average/],
  ['Average pushups this week',/35 reps average/],
]) test(q,()=>assert.match(answer(q).answer,pattern));
test('decline, no change and zero baseline are explicit',()=>{
  for(const [before,after,pattern] of [[30,20,/decreased/],[20,20,/unchanged/],[0,20,/percentage change unavailable from a zero baseline/]]) {
    assert.match(answer('Mylo pushups progress this week',{...data,workoutEntries:[row('a','last',before),row('b','now',after)]}).answer,pattern);
  }
});
test('missing baseline is not zero and changed conditions cannot create improvement',()=>{
  for(const extra of [{testConditions:{...conditions,durationSeconds:120}},{testConditions:{...conditions,loadLb:45}},{testSide:'Left'}]) {
    const result=answer('Mylo pushups progress this week',{...data,workoutEntries:[row('a','last',20),row('b','now',30,extra)]});
    assert.match(result.answer,/no comparable/);
    assert.doesNotMatch(result.answer,/20 reps to 30 reps/);
  }
});
test('best attempts exclude duplicate, skipped and unauthorized records',()=>{
  const d={...data,workoutEntries:[...data.workoutEntries,row('3','now',999),row('x','now',999,{status:'Skipped'}),row('y','now',999,{playerId:'outside'}),row('z','now',25)]};
  assert.match(answer('Mylo pushups progress this week',d).answer,/20 reps to 30 reps/);
});
test('one season observation cannot establish improvement',()=>{
  assert.match(answer('Mylo exercise progress this season',{...data,workoutEntries:[row('one','now',30)]}).answer,/no comparable baseline/);
});
test('max duration progress retains seconds and side',()=>{
  const extra={exercise:'Side Plank',reps:undefined,testConditions:{key:'plank',mode:'MAX_DURATION'},testSide:'Left'};
  assert.match(answer('Mylo side plank progress this week',{...data,workoutEntries:[row('a','last',undefined,{...extra,value:60}),row('b','now',undefined,{...extra,value:78})]}).answer,/Left.*1:00 held to 1:18 held; \+18 seconds \(30%\)/);
});
test('unspecified comparison asks for dates',()=>assert.equal(answer('How did Mylo improve in each exercise?').status,'needs_clarification'));

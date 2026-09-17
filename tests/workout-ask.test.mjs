import test from 'node:test';
import assert from 'node:assert/strict';
import { workoutAnswer } from '../app/lib/askClubhouse/workoutAnswers.ts';
import { buildAskClubhouseToolPlan } from '../app/lib/askClubhouse/tools.ts';
import { getAskClubhouseConfig } from '../app/lib/askClubhouse/config.ts';
import { readFileSync } from 'node:fs';
const now = new Date('2026-09-16T01:00:00Z');
const context = {timeZone:'America/New_York',launchSurface:'weight_room'};
const conditions = {key:'push-ups-60',mode:'TIMED_REPS',durationSeconds:60};
const row = (id,playerId,reps,extra={}) => ({id,playerId,reps,exercise:'Push-Ups',sessionId:'today',testConditions:conditions,...extra});
const data = {players:[{id:'a',name:'Jacob Seamon'},{id:'b',name:'Mylo White'}],workoutSessions:[{id:'today',date:'2026-09-15'},{id:'old',date:'2026-09-14'}],workoutEntries:[row('1','a',24),row('2','b',51),row('3','a',999,{sessionId:'old'}),row('4','a',999,{status:'Skipped'}),row('5','absent',999)]};
test('team pushup totals use canonical date, skip excluded rows and retain zeros',()=>{
  const answer=workoutAnswer(data,'total amount of pushups done by our team today',context,now);
  assert.match(answer.answer,/75 total reps/);
  assert.match(answer.answer,/2026-09-15/);
  assert.equal(answer.status,'completed');
  const zero=workoutAnswer({...data,workoutEntries:[row('0','a',0)]},'total push ups today',context,now);
  assert.match(zero.answer,/0 total reps/);
});
test('best exercise result respects ties, test conditions, laterality and duration',()=>{
  const input={...data,workoutEntries:[row('1','a',24),row('2','b',24),row('3','b',50,{testConditions:{...conditions,durationSeconds:120}}),row('4','a',undefined,{exercise:'Side Plank',value:78,testConditions:{key:'plank',mode:'MAX_DURATION'},testSide:'Left'}),row('5','b',undefined,{exercise:'Side Plank',value:60,testConditions:{key:'plank',mode:'MAX_DURATION'},testSide:'Right'})]};
  const answer=workoutAnswer(input,'who was the best in each exercise completed today',context,now).answer;
  assert.match(answer,/Jacob Seamon and Mylo White.*24 reps \(tie\)/);
  assert.match(answer,/120 sec.*50 reps/);
  assert.match(answer,/Left.*1:18 held/);
  assert.match(answer,/Right.*1:00 held/);
});
test('selected recap date, named player and duplicate canonical IDs are handled',()=>{
  const input={...data,workoutEntries:[...data.workoutEntries,data.workoutEntries[0]]};
  const scoped={...context,analytics:{customDateRange:{start:'2026-09-15',end:'2026-09-15'}}};
  assert.match(workoutAnswer(input,'total pushups by Jacob Seamon',scoped,now).answer,/24 total reps/);
  assert.equal(workoutAnswer(input,'total pushups',context,now).status,'needs_clarification');
  assert.equal(workoutAnswer({...data,workoutEntries:[]},'total pushups today',context,now).status,'no_data');
});
test('Ask routes exact workout questions to a grounded answer without a provider',()=>{
  const plan=buildAskClubhouseToolPlan(data,'total amount of pushups done by our team today',context,getAskClubhouseConfig({}),[],undefined,now);
  assert.equal(plan.status,'completed');
  assert.match(plan.answer,/75 total reps/);
});
test('mobile nav hides for shared and portaled dialogs, and Ask retains test metadata',()=>{
  assert.match(readFileSync('app/pwa.css','utf8'),/body:has\(\[role="dialog"\][\s\S]*dialog\[open\]\) \.bottom-nav/);
  const mapper=readFileSync('app/lib/askClubhouse/serverData.ts','utf8');
  for(const field of ['test_conditions','test_side','test_attempt']) assert.ok(mapper.includes(`row.${field}`));
});
test('review prompts are scoped and its primary Ask action follows Edit Workout',()=>{
  const page=readFileSync('app/ClubhouseWorkspace.tsx','utf8');
  assert.match(page,/weight_room: \[\s*\{ label: "Who leads Weight Room Development\?"/);
  assert.match(page,/!weighInOpen && <AskClubhouseFab onClick=\{\(\) => onAsk\(\)\}/);
  assert.match(page,/suggestions=\{askLaunchContext.surface === "weight_room" && askLaunchContext.analytics\?\.customDateRange/);
  const header=page.slice(page.indexOf('function WeightRoomActiveHeader('),page.indexOf('function WeightRoomActiveWeighIns('));
  assert.match(header,/Edit Workout[\s\S]*className="primary-button"[^>]*onClick=\{onAsk\}/);
});

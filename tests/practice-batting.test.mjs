import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBpPitch,initialBpSettings,initialBpState} from '../app/lib/liveBp.ts';
import {practiceBatting} from '../app/lib/practiceBatting.ts';
import {interpretVoice,canFastSaveVoice} from '../app/lib/voiceIntent.ts';
const settings={...initialBpSettings('batter'),source:'COACH',mode:'GAME',alignment:{CF:'fielder'}};
const state={...initialBpState(),situationKnown:true};
for(const result of ['Single','Double','Triple','Home Run','Reached on Error','Walk','HBP','Out']) {
  for(let mask=0;mask<8;mask++)test(`${result} deterministic base occupancy ${mask}`,()=>{
    const runners=[1,2,3].filter(b=>mask & (1<<(b-1)));
    const before={...state,runners,runnerIds:Object.fromEntries(runners.map(b=>[b,`00000000-0000-4000-8000-00000000000${b}`]))};
    const draft=['Walk','HBP'].includes(result)?{outcome:result==='Walk'?'Ball':'HBP'}:{outcome:'Ball in play',result};
    if(result==='Walk'){before.balls=3;before.countKnown=true;}
    const built=buildBpPitch(settings,before,draft);
    assert.equal(new Set(built.stateAfter.runners).size,built.stateAfter.runners.length);
    if(result==='Double')assert.deepEqual(built.stateAfter.runners.sort(),runners.includes(1)?[2,3]:[2]);
    if(result==='Triple')assert.deepEqual(built.stateAfter.runners,[3]);
    if(result==='Home Run')assert.deepEqual(built.stateAfter.runners,[]);
  });
}
test('explicit runner override wins over double default',()=>{
  const built=buildBpPitch(settings,{...state,runners:[1]},{outcome:'Ball in play',result:'Double',runnerOutcomes:{1:'score'}});
  assert.deepEqual(built.stateAfter.runners,[2]);
});
const event=(result,runnerOutcomes,extra={})=>({hitterId:'batter',liveBpContext:{result,before:{outs:0,runnerIds:{2:'runner'}},runnerOutcomes,...extra}});
test('canonical outcomes yield hits runs RBI and exclude errors from RBI',()=>{
  const events=[event('Double',{batter:'2',2:'score'}),event('Reached on Error',{batter:'1',2:'score'}),event('Ball in play'),event('Home Run',{batter:'score'}),event('Walk',{batter:'1'})];
  const batting=practiceBatting(events,events,'batter');
  assert.equal(batting.hits,2);assert.equal(batting.ab,3);assert.equal(batting.pa,4);assert.equal(batting.rbi,2);assert.equal(batting.runs,1);
  assert.equal(practiceBatting([],events,'runner').runs,2);
  assert.equal(practiceBatting([],events,'unrelated').runSamples,0);
  assert.equal(practiceBatting(events,events).runs,3);
});
test('missing runner evidence stays unavailable; errors, double play and third out do not invent RBI',()=>{
  assert.equal(practiceBatting([event('Single')],[]).rbiSamples,0);
  for(const e of [event('Single',{batter:'1',2:'score'},{runnerReasons:{2:'On throwing error'}}),event('Out',{batter:'out',2:'score',1:'out'}),event('Out',{batter:'out',2:'score'},{before:{outs:2}})])assert.equal(practiceBatting([e],[e]).rbi,0);
});
const context={domain:'live-bp',settings,state,roster:[{id:'batter',aliases:['Batter']},{id:'fielder',aliases:['Fielder']}],bats:'R'};
for(const direction of ['left-center','right center','down the right field line','down the left field line'])test(`spray: ${direction}`,()=>{
  const p=interpretVoice(`fly ball ${direction} double`,context,'test',.94);
  assert.deepEqual(p.unresolvedFields,[]);assert.ok(p.draft.spray);assert.equal(canFastSaveVoice(p),true);
});
test('complete simple CF error can Fast-save without broad complex-narration threshold reduction',()=>{
  const p=interpretVoice('fly ball center field center fielder made an error',context,'test',.94);
  assert.deepEqual(p.unresolvedFields,[]);assert.equal(canFastSaveVoice(p),true);
  assert.equal(canFastSaveVoice({...p,confidence:{...p.confidence,transcription:.6}}),false);
  assert.equal(canFastSaveVoice({...p,unresolvedFields:['fielder unclear']}),false);
});

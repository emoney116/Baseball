import test from 'node:test';
import assert from 'node:assert/strict';
import {TypedVoiceV2,v2Action,v2FastPath,parseV2Batch,V2_TOOL_SCHEMAS} from '../app/lib/voiceV2Tools.ts';
import {initialBpSettings,initialBpState} from '../app/lib/liveBp.ts';
const runner='00000000-0000-4000-8000-000000000004';
const context=()=>({domain:'live-bp',settings:{...initialBpSettings('h'),mode:'AB',pitchMode:'ONE',pitchType:'4-Seam',alignment:{SS:'f'},ev:true,spray:true},state:{...initialBpState(),countKnown:true,situationKnown:true,runners:[1],runnerIds:{1:runner}},roster:[{id:'h',aliases:['Taylor']},{id:'n',aliases:['Morgan']},{id:'f',aliases:['Reese']},{id:runner,aliases:['Casey']}]});
const engine=()=>new TypedVoiceV2(context(),true);
test('Typed tools are strict, bounded, and QA-only',()=>{
  assert.equal(V2_TOOL_SCHEMAS.length,19);assert.throws(()=>new TypedVoiceV2(context()),/disabled/);
  assert.throws(()=>parseV2Batch({decision:'ignore',reason:'noise',actions:[],database:{}}),/unknown/);
  assert.throws(()=>v2Action('set_count',{balls:9,strikes:0}),/number/);
});
test('Complete simple commands route locally with no provider',()=>{
  const s=engine();for(const [i,text] of ['Whiff','Ball','Foul','Called strike'].entries()){const a=v2FastPath(text,s.context);assert.ok(a);s.apply(a,i,i*1000);}
  assert.equal(s.commits.filter(c=>c.kind==='pitch').length,4);
});
test('One developing play preserves late EV and explicit runner movement',()=>{
  const s=engine();s.apply([v2Action('open_play',{draft:{battedBall:'Line drive',spray:{x:.8,y:.3}}})],0,0);
  s.apply([v2Action('update_play',{draft:{ev:94}})],1,2000);
  s.apply([v2Action('update_play',{draft:{result:'Single'}}),v2Action('record_runner_action',{from:1,to:3,outcome:'safe',reason:'On last play'}),v2Action('complete_play')],2,4000);
  assert.equal(s.commits.length,1);assert.equal(s.commits[0].draft.ev,94);assert.equal(s.context.state.runnerIds[3],runner);
});
test('Invalid late tool rolls back entire batch including earlier context',()=>{
  const s=engine(),before=structuredClone(s.context);
  assert.throws(()=>s.apply([v2Action('set_hitter',{playerId:'n'}),v2Action('record_runner_action',{from:2,to:4,outcome:'safe',reason:'Other'})],0,0));
  assert.deepEqual(s.context,before);assert.equal(s.commits.length,0);assert.equal(s.version,0);
});
test('Unknown identity, base collision and stale versions cannot auto-apply',()=>{
  const s=engine();assert.throws(()=>s.apply([v2Action('set_hitter',{playerId:'unknown'})],0,0),/roster/);
  assert.throws(()=>s.apply([v2Action('set_runners',{runners:[{base:1,playerId:'r'},{base:1,playerId:'n'}]})],0,0),/collision/);
  s.apply([v2Action('set_count',{balls:1,strikes:1})],0,0);
  assert.throws(()=>s.apply([v2Action('undo_last_action')],1,1000,0),/Stale/);
});
test('Context transition flushes prior hitter play before updating hitter',()=>{
  const s=engine();s.apply([v2Action('open_play',{draft:{battedBall:'Line drive'}})],0,0);
  s.apply([v2Action('set_hitter',{playerId:'n'})],1,1000);
  assert.equal(s.commits[0].before.settings.hitterId,'h');assert.equal(s.context.settings.hitterId,'n');
});
test('Undo cancels provisional first and corrections require exact recent event',()=>{
  const s=engine();s.apply([v2Action('record_pitch',{draft:{outcome:'Ball in play',battedBall:'Line drive',result:'Single',ev:94}})],0,0);
  const id=s.commits[0].id;s.apply([v2Action('correct_recent_event',{eventId:id,draft:{ev:91}})],1,1000);
  assert.equal(s.commits[0].draft.ev,91);
  assert.equal(s.corrections[0].before.ev,94);assert.equal(s.corrections[0].after.ev,91);
  assert.throws(()=>s.apply([v2Action('correct_recent_event',{eventId:id,draft:{ev:90}})],2,31000),/30 seconds/);
  s.apply([v2Action('open_play',{draft:{battedBall:'Fly ball'}}),v2Action('undo_last_action')],2,2000);assert.equal(s.commits.length,1);assert.equal(s.openPlay,null);
});

test('Multi-runner single preserves both starting runners and batter',()=>{
  const s=engine();s.context.state.runners=[1,2];
  s.apply([v2Action('open_play',{draft:{battedBall:'Line drive',result:'Single'}}),v2Action('record_runner_action',{from:2,to:4,outcome:'safe',reason:'On last play'}),v2Action('record_runner_action',{from:1,to:3,outcome:'safe',reason:'On last play'}),v2Action('complete_play')],0,0);
  assert.deepEqual([...s.context.state.runners].sort(),[1,3]);assert.equal(s.commits[0].draft.runnerOutcomes[2],'score');
});

test('Sacrifice and error reasons remain canonical structured evidence',()=>{
  for(const [result,battedBall,base,to,reason] of [['Sac Bunt','Bunt',2,3,'On last play'],['Sac Fly','Fly ball',3,4,'Tag up'],['Reached on Error','Ground ball',3,4,'On throwing error']]){
    const s=engine();s.context.state.runners=[base];s.context.state.runnerIds={};
    s.apply([v2Action('open_play',{draft:{battedBall,result}}),v2Action('record_runner_action',{from:base,to,outcome:'safe',reason}),v2Action('complete_play')],0,0);
    assert.equal(s.commits[0].draft.runnerReasons[base],reason);
    assert.equal(s.context.state.outs,result==='Reached on Error'?0:1);
  }
});

test('Question and provider prompt echo cannot enter the scoring fast path',async()=>{
  const s=engine();assert.equal(v2FastPath('Ball?',s.context),null);
  const result=await s.receive('Baseball practice vocabulary: ball, whiff.',0,0,async()=>{throw new Error('Must not call provider');});
  assert.equal(result.status,'ignored');assert.equal(s.commits.length,0);
});

test('Genuine ambiguity queues dependent capture without state mutation',async()=>{
  const s=engine(),before=structuredClone(s.context);
  const reason=async()=>({batch:{decision:'review',reason:'Two plausible players',actions:[]},latencyMs:1});
  assert.equal((await s.receive('Someone is hitting',0,0,reason)).status,'review');
  assert.equal((await s.receive('Ball',1,1000,reason)).status,'waiting');
  assert.equal(s.waiting[0].text,'Ball');assert.deepEqual(s.context,before);
});

test('Developing play stays provisional through pauses and expires boundedly',()=>{
  const s=engine();s.apply([v2Action('open_play',{draft:{battedBall:'Line drive'}})],0,0);
  assert.equal(s.flush(1,3000),null);assert.equal(s.commits.length,0);
  assert.equal(s.flush(1,30000).status,'auto');assert.equal(s.commits.length,1);
});

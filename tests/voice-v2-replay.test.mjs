import test from 'node:test';
import assert from 'node:assert/strict';
import {VoiceV2Replay} from '../app/lib/voiceV2Replay.ts';
import {initialBpSettings,initialBpState} from '../app/lib/liveBp.ts';
const context=()=>({domain:'live-bp',settings:{...initialBpSettings('h'),pitchMode:'ONE',pitchType:'4-Seam',ev:true,spray:true},state:initialBpState(),roster:[{id:'h',aliases:['Taylor']},{id:'n',aliases:['Morgan']}]});
const p=(sequence,text,extra={})=>({sequence,at:sequence*3000,text,intent:'scoring',transcription:'clear',alternatives:[],...extra});
test('V2 simulation requires explicit QA opt-in',()=>assert.throws(()=>new VoiceV2Replay(context()),/disabled/));
test('developing BIP and late EV/outcome become one canonical pitch',()=>{
 const r=new VoiceV2Replay(context(),true);
 r.receive(p(1,'Line drive right'));r.receive(p(2,'94 exit'));r.receive(p(3,'single',{explicitEnd:true}));
 assert.equal(r.committed.length,1);assert.equal(r.committed[0].draft.ev,94);assert.equal(r.committed[0].draft.result,'Single');
});
test('rapid complete pitches remain independent',()=>{
 const r=new VoiceV2Replay(context(),true);['Whiff','Ball','Foul'].forEach((t,i)=>r.receive(p(i,t)));
 assert.equal(r.committed.length,3);
});
test('coaching and questions cannot turn into scoring even when containing metrics',()=>{
 const r=new VoiceV2Replay(context(),true);r.receive(p(1,'Was that 94?',{intent:'question'}));r.receive(p(2,'Stay short',{intent:'coaching'}));
 assert.equal(r.committed.length,0);assert.equal(r.receipts.filter(x=>x.status==='ignored').length,2);
});
test('genuine ambiguity blocks dependent actions without losing receipts',()=>{
 const r=new VoiceV2Replay(context(),true);r.receive(p(1,'Morgan hitting',{alternatives:['two players']}));r.receive(p(2,'Ball'));
 assert.deepEqual(r.receipts.map(x=>x.status),['review','waiting']);
});
test('new hitter finalizes old BIP before switching context',()=>{
 const r=new VoiceV2Replay(context(),true);r.receive(p(1,'Line drive right'));r.receive(p(2,'Morgan is hitting',{intent:'context'}));
 assert.equal(r.committed.length,1);assert.equal(r.committed[0].context.settings.hitterId,'h');assert.equal(r.context.settings.hitterId,'n');
});
test('Undo cancels provisional play before touching committed pitch',()=>{
 const r=new VoiceV2Replay(context(),true);r.receive(p(1,'Ball'));r.receive(p(2,'Line drive right'));r.receive(p(3,'undo'));
 assert.equal(r.pending,null);assert.equal(r.committed.length,1);
});
test('capture order is mandatory',()=>{const r=new VoiceV2Replay(context(),true);r.receive(p(2,'Ball'));assert.throws(()=>r.receive(p(1,'Foul')),/sequence/);});
test('optional BIP details cannot keep a provisional play open indefinitely',()=>{
 const r=new VoiceV2Replay(context(),true);r.receive(p(1,'Line drive right'));r.tick(15000);
 assert.equal(r.pending,null);assert.equal(r.committed.length,1);assert.equal(r.committed[0].draft.ev,undefined);
});

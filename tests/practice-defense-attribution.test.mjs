import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBpPitch,initialBpSettings,initialBpState} from '../app/lib/liveBp.ts';
import {resolvePracticeDefender,projectPracticeDefense} from '../app/lib/practiceDefense.ts';
import {interpretVoice} from '../app/lib/voiceIntent.ts';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const settings=()=>({...initialBpSettings(id(1)),defense:'OFF',alignment:{'1B':id(2),SS:id(3),'3B':id(4),LF:id(5),CF:id(6)}});
for(const [name,sequence,battedBall] of [['GB 1B',['1B'],'Ground ball'],['GB SS to 1B',['SS','1B'],'Ground ball'],['GB 3B to 1B',['3B','1B'],'Ground ball'],['LF catch',['LF'],'Fly ball'],['CF catch',['CF'],'Fly ball']])test(name+' uses captured alignment with default OFF',()=>{
  const built=buildBpPitch(settings(),initialBpState(),{outcome:'Ball in play',battedBall,result:'Out',fieldingSequence:sequence});
  assert.deepEqual(built.context.defensiveActions.map(a=>a.playerId),sequence.map(p=>settings().alignment[p]));
  if(sequence.length>1)assert.deepEqual(built.context.defensiveActions[1].roles,['receive']);
});
for(const errorType of [undefined,'Fielding','Throwing'])test('known-position error preserves subtype '+errorType,()=>{
  const built=buildBpPitch(settings(),initialBpState(),{outcome:'Ball in play',battedBall:'Ground ball',position:'1B',result:'Reached on Error',defenseResult:'Error',errorType});
  assert.equal(built.context.defensiveActions[0].playerId,id(2));
  assert.equal(built.context.defensiveActions[0].errorType,errorType);
});
test('explicit identity wins; missing or ambiguous assignment never guesses',()=>{
  assert.equal(resolvePracticeDefender({alignment:{}},'1B'),undefined);
  assert.equal(resolvePracticeDefender({alignment:{SS:id(2),'1B':id(2)}},'1B'),undefined);
  assert.equal(resolvePracticeDefender({alignment:{'1B':id(2)}},'1B',id(3)).playerId,id(3));
});
test('group and position changes do not rewrite earlier attribution',()=>{
  const s=settings(),draft={outcome:'Ball in play',battedBall:'Ground ball',result:'Out',fieldingSequence:['1B']};
  s.activeDefensePresetId='team-1';
  const first=buildBpPitch(s,initialBpState(),draft);
  s.alignment['1B']=id(7);
  s.activeDefensePresetId='team-2';
  const second=buildBpPitch(s,initialBpState(),draft);
  assert.equal(first.context.defenseSnapshot.alignment['1B'],id(2));
  assert.equal(second.context.defensiveActions[0].playerId,id(7));
  assert.equal(first.context.defenseSnapshot.groupId,'team-1');
  assert.equal(second.context.defenseSnapshot.groupId,'team-2');
});

test('V1 narrated positions reach the canonical attribution pipeline',()=>{
  for(const [text,expected] of [['Ground ball to first, out.',['1B']],['Ground ball to short shortstop throws to first out',['SS','1B']],['Fly ball center caught',['CF']],['Ground ball first baseman error',['1B']]]) {
    const s=settings();
    const intent=interpretVoice(text,{domain:'live-bp',settings:s,state:initialBpState(),roster:[]},id(20),.99);
    const built=buildBpPitch(s,initialBpState(),intent.draft);
    assert.deepEqual(built.context.defensiveActions.map(a=>a.position),expected,text);
  }
});
test('projection dedupes persisted reps and follows canonical Undo removal',()=>{
  const context=buildBpPitch(settings(),initialBpState(),{outcome:'Ball in play',battedBall:'Ground ball',result:'Out',fieldingSequence:['SS','1B']}).context;
  const event={id:id(10),practiceId:id(11),sessionId:id(12),eventNumber:1,liveBpContext:context};
  const rows=projectPracticeDefense([event],[]);
  assert.equal(rows.length,2);
  assert.equal(projectPracticeDefense([event],[{...rows[0],id:id(10),idempotencyKey:id(10)}]).length,2);
  assert.deepEqual(projectPracticeDefense([],[]),[]);
  assert.deepEqual(projectPracticeDefense([{...event,liveBpContext:{result:'Out'}}],[]),[]);
});

test('named defender does not replace hitter and preserves explicit identity provenance',()=>{
  const s=settings();
  const roster=[{id:id(1),aliases:['Hitter']},{id:id(2),aliases:['Trevor']}];
  const intent=interpretVoice('Ground ball Trevor made an error',{domain:'live-bp',settings:s,state:initialBpState(),roster},id(21),.99);
  assert.equal(intent.playerId,id(1));
  assert.equal(intent.draft.defenderId,id(2));
  const built=buildBpPitch(s,initialBpState(),intent.draft);
  assert.equal(built.context.defensiveActions[0].attribution,'explicit-player');
  assert.equal(built.context.defensiveActions[0].result,'Error');
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {practiceBatting} from '../app/lib/practiceBatting.ts';
import {projectPracticeRunners,readPracticeRunnerActions} from '../app/lib/practiceRunnerActions.ts';
import {buildBpPitch,initialBpSettings,initialBpState} from '../app/lib/liveBp.ts';
const action=(patch={})=>({id:'a',practiceId:'p',roundId:'r',version:1,createdAt:'2026-09-17T20:00:00Z',from:3,to:4,outcome:'safe',reason:'On last play',runnerId:'runner',...patch});
const event=(result='Single',runnerOutcomes={2:'score',1:'3',batter:'1'},runnerIds={1:'first',2:'second'})=>({id:'pitch',practiceId:'p',liveBpRoundId:'r',hitterId:'hitter',liveBpContext:{result,before:{outs:0,runnerIds},runnerOutcomes}});
test('standalone named and anonymous scores count for team; only known identity counts for player',()=>{
  const actions=[action(),action({id:'b',runnerId:undefined})];
  assert.equal(practiceBatting([],[],undefined,actions).runs,2);
  assert.equal(practiceBatting([],[],'runner',actions).runs,1);
  assert.equal(practiceBatting([],[],'unrelated',actions).runs,0);
  assert.equal(practiceBatting([],[],undefined,actions).rbi,0);
});
test('multiple runners and batter preserve all outcomes without changing batting denominator',()=>{
  const e=event();const totals=practiceBatting([e],[e]);
  assert.equal(projectPracticeRunners([e]).length,3);
  assert.equal(totals.runs,1);assert.equal(totals.rbi,1);assert.equal(totals.runnerAdvances,2);assert.equal(totals.pa,1);
});
test('linked duplicate uses play + runner + destination, not merely play or base',()=>{
  const e=event();const a=action({pitchId:'pitch',from:3,runnerId:'second'});
  assert.equal(practiceBatting([e],[e],undefined,[a,a]).runs,1);
  assert.equal(practiceBatting([e],[e],undefined,[a,action({id:'different',pitchId:'pitch',runnerId:'other'})]).runs,2);
  assert.equal(practiceBatting([e],[e],undefined,[{...a,pitchId:'another'}]).runs,2);
});
test('anonymous linked evidence deduplicates only exact occupied base and destination',()=>{
  const e=event('Single',{3:'score'},{});
  assert.equal(practiceBatting([e],[e],undefined,[action({runnerId:undefined,pitchId:'pitch'})]).runs,1);
});
test('error advances and outs do not invent RBI; safe at same base is not advancement',()=>{
  const actions=[action({reason:'On error'}),action({id:'out',from:1,to:2,outcome:'out'}),action({id:'safe',from:2,to:2})];
  const t=practiceBatting([],[],undefined,actions);
  assert.equal(t.runs,1);assert.equal(t.rbi,0);assert.equal(t.runnerOuts,1);assert.equal(t.runnerAdvances,1);
});
test('all supported base advances preserve endpoints and source reasons',()=>{
  for(const [from,to] of [[1,2],[1,3],[1,4],[2,3],[2,4],[3,4]])for(const reason of ['Stolen base','On throw','On error','Tag up','Wild pitch','Passed ball']) {
    const t=practiceBatting([],[],undefined,[action({from,to,reason})]);
    assert.equal(t.runnerAdvances,1);assert.equal(t.runs,to===4?1:0);assert.equal(t.rbi,0);
  }
});
test('sacrifices retain batter outs, run, advancement and distinct sacrifice metrics',()=>{
  const bunt=event('Sac Bunt',{2:'3',batter:'out'});
  const fly=event('Sac Fly',{3:'score',batter:'out'},{3:'runner'});
  const t=practiceBatting([bunt,fly],[bunt,fly]);
  assert.equal(t.sacrificeBunts,1);assert.equal(t.sacrificeFlies,1);assert.equal(t.outs,2);assert.equal(t.ab,0);
  assert.equal(t.runs,1);assert.equal(t.rbi,1);assert.equal(t.runnerAdvances,2);
});
test('walk force projection comes from canonical state engine; pitcher and contact data unchanged',()=>{
  const settings={...initialBpSettings('hitter'),mode:'GAME'};
  const state={...initialBpState(),balls:3,runners:[1,2,3],runnerIds:{1:'10000000-0000-4000-8000-000000000001',2:'10000000-0000-4000-8000-000000000002',3:'10000000-0000-4000-8000-000000000003'}};
  const pitch=buildBpPitch(settings,state,{outcome:'Ball'});
  const e={...event(),liveBpContext:pitch.context};
  const t=practiceBatting([e],[e]);
  assert.equal(t.walks,1);assert.equal(t.runs,1);assert.equal(t.rbi,1);assert.equal(t.ab,0);
});
test('reader paginates bounded scopes and fails closed rather than returning false zero',async()=>{
  let calls=0;
  const client={rpc:(_name,args)=>{assert.ok(args.practice_ids.length<=100);return {order:()=>({range:async()=>{calls++;return {data:[],error:null};}})};}};
  await readPracticeRunnerActions(client,Array.from({length:101},(_,i)=>String(i)));assert.equal(calls,2);
  await assert.rejects(()=>readPracticeRunnerActions({rpc:()=>({order:()=>({range:async()=>({error:{message:'not authorized'}})})})},['p']),/unavailable/);
});

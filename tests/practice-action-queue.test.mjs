import test from 'node:test';
import assert from 'node:assert/strict';
import {PracticeActionQueue,rebasePracticeEdit} from '../app/lib/practiceActionQueue.ts';
const turn=()=>new Promise(resolve=>setImmediate(resolve));
for(const size of [5,10])test(`${size} captured actions commit in capture order despite reverse response order`,async()=>{
  const queue=new PracticeActionQueue(),saved=[];
  const tickets=Array.from({length:size},(_,i)=>queue.reserve({hitter:'Mylo',i}));
  const work=[...tickets].reverse().map(ticket=>queue.execute(ticket,async()=>{saved.push(ticket.sequence);}));
  await Promise.all(work);
  assert.deepEqual(saved,Array.from({length:size},(_,i)=>i+1));assert.equal(queue.pending,0);
});
test('delayed Voice pitch precedes manual hitter change; next Voice uses changed hitter',async()=>{
  const q=new PracticeActionQueue();let hitter='Mylo';const pitches=[];
  const first=q.reserve({hitter});
  const manual=q.enqueue({hitter},async()=>{hitter='JP';});
  const last=q.reserve({hitter});
  const next=q.execute(last,async()=>pitches.push(hitter));
  await turn();assert.equal(hitter,'Mylo');
  await q.execute(first,async()=>pitches.push(hitter));await manual;await next;
  assert.deepEqual(pitches,['Mylo','JP']);
});
test('Review retains subsequent captures until explicitly resolved',async()=>{
  const q=new PracticeActionQueue();let resolveReview;const saved=[];
  const first=q.reserve({});const second=q.reserve({});
  const a=q.execute(first,()=>new Promise(resolve=>{resolveReview=resolve;}));
  const b=q.execute(second,async()=>saved.push(2));await turn();assert.deepEqual(saved,[]);
  resolveReview();await a;await b;assert.deepEqual(saved,[2]);
});
test('cap does not delete accepted actions',()=>{
  const q=new PracticeActionQueue();for(let i=0;i<32;i++)q.reserve({});
  assert.throws(()=>q.reserve({}),/32 actions/);assert.equal(q.pending,32);
});
test('manual edit preserves preceding count progression',()=>{
  assert.deepEqual(rebasePracticeEdit({hitter:'Mylo',balls:0},{hitter:'JP',balls:0},{hitter:'Mylo',balls:1}),{hitter:'JP',balls:1});
});

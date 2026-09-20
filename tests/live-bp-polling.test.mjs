import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startLiveBpPolling} from '../app/lib/liveBpPolling.ts';
test('repeated Practice/Live BP navigation returns timers and focus listeners to baseline',async()=>{
  const timers=new Set(),listeners=new Set();let reads=0;
  const host={visible:()=>true,interval:fn=>{timers.add(fn);return()=>timers.delete(fn);},focus:fn=>{listeners.add(fn);return()=>listeners.delete(fn);}};
  for(let navigation=0;navigation<50;navigation++) {
    const stop=startLiveBpPolling(async signal=>{assert.equal(signal.aborted,false);reads++;},host);
    assert.equal(timers.size,1);assert.equal(listeners.size,1);
    for(const fn of timers)fn();await Promise.resolve();stop();
    assert.equal(timers.size,0);assert.equal(listeners.size,0);
  }
  assert.equal(reads,50);
});
test('slow read coalesces interval/focus triggers and aborts on unmount',async()=>{
  let tick,focus,release,signal,reads=0,visible=true;
  const stop=startLiveBpPolling(async s=>{reads++;signal=s;await new Promise(resolve=>release=resolve);},{visible:()=>visible,interval:fn=>{tick=fn;return()=>{};},focus:fn=>{focus=fn;return()=>{};}});
  tick();for(let i=0;i<50;i++){tick();focus();}assert.equal(reads,1);
  release();await Promise.resolve();await Promise.resolve();visible=false;tick();assert.equal(reads,1);
  stop();assert.equal(signal.aborted,true);visible=true;focus();assert.equal(reads,1);
});

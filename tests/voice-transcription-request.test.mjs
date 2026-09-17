import test from 'node:test';
import assert from 'node:assert/strict';
import {requestVoiceTranscription} from '../app/lib/voiceTranscriptionRequest.ts';
const response=(status,data)=>new Response(JSON.stringify(data),{status});
test('429 backs off twice, renews metering identity, then returns actual transcript',async()=>{
  let attempts=0,renewals=0;const delays=[];
  const result=await requestVoiceTranscription({request:async()=>++attempts<3?response(429,{message:'Busy'}):response(200,{transcript:'Whiff',confidence:.9}),wait:async ms=>delays.push(ms),renewRequest:()=>renewals++});
  assert.deepEqual(result,{transcript:'Whiff',confidence:.9});assert.deepEqual(delays,[1000,2000]);assert.equal(renewals,2);
});
test('persistent 429 is bounded and never marked saved',async()=>{
  let attempts=0;
  await assert.rejects(requestVoiceTranscription({request:async()=>{attempts++;return response(429,{message:'Rate limited'});},wait:async()=>{},renewRequest:()=>{}}),/Rate limited/);
  assert.equal(attempts,3);
});
for(const message of ['Network offline','TimeoutError'])test(`${message} remains failed, not a speculative successful retry`,async()=>{
  let attempts=0;
  await assert.rejects(requestVoiceTranscription({request:async()=>{attempts++;throw new Error(message);},wait:async()=>{},renewRequest:()=>{}}),new RegExp(message));assert.equal(attempts,1);
});
test('empty provider response stays unresolved',async()=>{
  await assert.rejects(requestVoiceTranscription({request:async()=>response(200,{transcript:''}),wait:async()=>{},renewRequest:()=>{}}),/Audio retained/);
});
test('missing acoustic confidence is not invented',async()=>{
  const result=await requestVoiceTranscription({request:async()=>response(200,{transcript:'Ball'}),wait:async()=>{},renewRequest:()=>{}});
  assert.equal(result.confidence,null);
});

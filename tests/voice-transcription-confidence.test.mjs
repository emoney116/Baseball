import test from 'node:test';
import assert from 'node:assert/strict';
import {voiceTokenConfidence} from '../app/lib/voiceTranscriptionConfidence.ts';

test('transcription gate uses the weakest spoken token, not a flattering average',()=>{
  assert.equal(voiceTokenConfidence([{token:'Slider',logprob:-.001},{token:'79',logprob:Math.log(.6)},{token:'whiff',logprob:-.001}]),.6);
});
test('punctuation does not penalize otherwise clear spoken tokens',()=>{
  assert.ok(voiceTokenConfidence([{token:'Whiff',logprob:-.001},{token:'.',logprob:-2}])>.99);
});
test('missing or invalid provider evidence fails closed',()=>{
  for(const value of [null,[],[{}],[{token:'79',logprob:NaN}],[{token:'79',logprob:1}]]) assert.equal(voiceTokenConfidence(value),null);
});

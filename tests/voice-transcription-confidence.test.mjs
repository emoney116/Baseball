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
test('recognized speed units do not force Review but numeric evidence still does',()=>{
  const tokens=[['Line',.99],[' drive',.99],[' center',.94],[' field',.99],[' 94',.99],[' miles',.7],[' an',.99],[' hour',.8],[' exit',.99],[' velocity',.99]].map(([token,p])=>({token,logprob:Math.log(p)}));
  assert.equal(voiceTokenConfidence(tokens),.94);
  tokens[4].logprob=Math.log(.6);assert.equal(voiceTokenConfidence(tokens),.6);
});
test('nonmeasurement words and alternatives retain confidence protection',()=>{
  assert.equal(voiceTokenConfidence([{token:'Miles',logprob:Math.log(.5)},{token:' hitting',logprob:0}]),.5);
  assert.equal(voiceTokenConfidence([{token:'Miles',logprob:Math.log(.5)},{token:' hit it 94 mph',logprob:0}]),.5);
  assert.equal(voiceTokenConfidence([{token:'94 mph',logprob:0},{token:' or',logprob:Math.log(.5)},{token:' 96',logprob:0}]),.5);
});

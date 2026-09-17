import test from 'node:test';
import assert from 'node:assert/strict';
import {validateVoiceProposal} from '../app/lib/voiceInterpretationProposal.ts';

test('AI proposal retains explicit measurements',()=>{
  assert.equal(validateVoiceProposal({normalized:'slider 78 whiff',warnings:[]},'slider at 78 swung through it').normalized,'slider 78 whiff');
});
test('AI cannot introduce an unspoken measurement',()=>{
  assert.throws(()=>validateVoiceProposal({normalized:'slider 84 whiff',warnings:[]},'slider whiff'),/unspoken/);
});
test('AI cannot resolve spoken alternatives without a warning',()=>{
  assert.throws(()=>validateVoiceProposal({normalized:'slider 82',warnings:[]},'82 or 84'),/alternatives/);
});
for(const proposal of [null,{}, {normalized:'',warnings:[]},{normalized:'ball',warnings:[],save:true},{normalized:'ball',warnings:'none'}]) {
  test(`invalid AI proposal ${JSON.stringify(proposal)}`,()=>assert.throws(()=>validateVoiceProposal(proposal,'ball')));
}

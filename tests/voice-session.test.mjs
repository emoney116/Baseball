import test from 'node:test';
import assert from 'node:assert/strict';
import {appendVoiceFragment, voiceSessionAction} from '../app/lib/voiceSession.ts';
import {interpretVoice} from '../app/lib/voiceIntent.ts';
import {initialBpSettings, initialBpState} from '../app/lib/liveBp.ts';
import {parseVoiceCommand} from '../app/lib/voiceCommands.ts';
const context = {domain:'live-bp', settings:{...initialBpSettings('h'), velocity:true, pitchMode:'MULTI', pitchType:'4-Seam'}, state:initialBpState(), roster:[{id:'h',aliases:['Mylo']}], bats:'R'};
for (const units of ['mile an hour','miles an hour','miles per hour','mph']) test(`velocity units: ${units}`, () => {
  const intent = interpretVoice(`slider 84 ${units} swing and miss`, context, 'one');
  assert.equal(intent.draft.velocity,84);
  assert.deepEqual(intent.unresolvedFields,[]);
});
test('fragment accumulates without manufacturing a pitch result', () => {
  const fragment = interpretVoice('84 mile an hour',context,'one');
  assert.equal(fragment.draft.velocity,84);
  assert.equal(fragment.draft.outcome,'');
  assert.ok(fragment.unresolvedFields.includes('pitch result'));
  const result = interpretVoice(appendVoiceFragment(fragment.transcript,'slider swing and miss'),context,'one');
  assert.equal(result.draft.velocity,84);
  assert.equal(result.draft.outcome,'Whiff');
  assert.deepEqual(result.unresolvedFields,[]);
});
test('spoken velocity numbers normalize without altering four seam', () => {
  const intent = interpretVoice('four seam eighty four miles an hour called strike',context,'one');
  assert.equal(intent.draft.velocity,84);
  assert.equal(intent.draft.pitchType,'4-Seam');
  assert.deepEqual(intent.unresolvedFields,[]);
});
test('explicit velocity survives disabled manual prompting', () => {
  const intent=interpretVoice('84 mile an hour slider whiff',{...context,settings:{...context.settings,velocity:false}},'one');
  assert.equal(intent.draft.velocity,84);
  assert.deepEqual(intent.ignoredFields,[]);
  assert.deepEqual(intent.unresolvedFields,[]);
});
test('conflicting velocity is not silently overwritten', () => {
  const intent=interpretVoice(appendVoiceFragment('84 mph','86 mph slider whiff'),context,'one');
  assert.ok(intent.unresolvedFields.some(field=>field.includes('multiple numbers')));
});
test('session controls require exact commands, not incidental baseball speech', () => {
  assert.equal(voiceSessionAction('save pitch'),'save');
  assert.equal(voiceSessionAction('discard that'),'discard');
  assert.equal(voiceSessionAction('mute'),'mute');
  assert.equal(voiceSessionAction('he made the save'),null);
  assert.equal(voiceSessionAction('swing and miss'),null);
});
test('pending description is bounded', () => assert.throws(()=>appendVoiceFragment('x'.repeat(700),'slider')));
test('enable velocity is a context command, not a baseball event', () => {
  const command=parseVoiceCommand('enable velocity',context.roster,context.settings);
  assert.equal(command.kind,'context');
  assert.deepEqual(command.patch,{velocity:true});
  assert.equal(command.eventText,'');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {interpretVoice,canFastSaveVoice} from '../app/lib/voiceIntent.ts';
import {parseVoiceCommand} from '../app/lib/voiceCommands.ts';
import {voiceSpeechSuggestions} from '../app/lib/voiceSpeechRecovery.ts';
import {initialBpSettings,initialBpState} from '../app/lib/liveBp.ts';

const roster=[{id:'jett',aliases:['Jett Gibbs','Jett','Gibbs']},{id:'andrew',aliases:['Andrew Peters','Andrew','Peters']}];
const settings={...initialBpSettings('andrew'),source:'COACH',pitchMode:'ONE',pitchType:'4-Seam'};
const state=initialBpState();
const context={domain:'live-bp',settings,state,roster,bats:'R'};
for(const phrase of ['ball','ball outside','ball away','ball one outside','bal','bal outside','bal away','ball down away'])test(`short pitch: ${phrase}`,()=>{
  assert.equal(parseVoiceCommand(phrase,roster,settings,state),null);
  const parsed=interpretVoice(phrase,context,'speech-test',.95);
  assert.equal(parsed.draft.outcome,'Ball');
  assert.deepEqual(parsed.unresolvedFields,[]);
  assert.equal(parsed.playerId,'andrew');
  assert.equal(canFastSaveVoice(parsed),true);
});
for(const phrase of ['Jett is hitting','Jet is hitting','Jett hitting','Jet Gibbs is hitting'])test(`roster context: ${phrase}`,()=>{
  const parsed=parseVoiceCommand(phrase,roster,settings,state);
  assert.equal(parsed.kind,'context');assert.equal(parsed.patch.hitterId,'jett');assert.deepEqual(parsed.problems,[]);
});
test('spelling-equivalent roster collision requires review',()=>{
  const parsed=parseVoiceCommand('Jet is hitting',[...roster,{id:'other',aliases:['Jet Jones','Jet']}],settings,state);
  assert.ok(parsed.problems.length);assert.equal(parsed.patch.hitterId,undefined);
});
for(const phrase of ['fall','fall outside','fall away'])test(`ambiguous result needs explicit selection: ${phrase}`,()=>{
  const parsed=interpretVoice(phrase,context,'speech-test',.99);
  assert.equal(canFastSaveVoice(parsed),false);
  const options=voiceSpeechSuggestions(phrase,roster);
  assert.equal(options.length,2);
  for(const option of options)assert.deepEqual(interpretVoice(option,context,'speech-test',1).unresolvedFields,[]);
});
test('heading suggests a uniquely matched hitter without auto-changing context',()=>{
  assert.equal(parseVoiceCommand('jet is heading',roster,settings,state),null);
  assert.deepEqual(voiceSpeechSuggestions('jet is heading',roster),['Jett Gibbs is hitting']);
  for(const text of ['jet is heading home','jet is heading to first','jet fell outside','fall season','fall down the stairs','unknown is heading'])assert.deepEqual(voiceSpeechSuggestions(text,roster),[]);
});

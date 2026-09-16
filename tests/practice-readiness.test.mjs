import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVoiceCommand } from '../app/lib/voiceCommands.ts';
import { interpretVoice, canFastSaveVoice } from '../app/lib/voiceIntent.ts';
import { voiceSessionAction } from '../app/lib/voiceSession.ts';
import { initialBpSettings, initialBpState, buildBpPitch } from '../app/lib/liveBp.ts';

const roster = [{id:'m',aliases:['Mylo']},{id:'d',aliases:['Darren']},{id:'j',aliases:['JP']}];
for (const [phrase, key, value] of [
  ['Start tracking velocity','velocity',true],['Stop tracking velocity','velocity',false],
  ['Track locations now','location',true],['Do not track locations','location',false],
  ['Turn counts on','countTracking',true],['Turn counts off','countTracking',false],
  ['Track defense','defense','ALL'],['Stop tracking defense','defense','OFF'],
  ['Track exit velo','ev',true],['Stop tracking exit velo','ev',false],
  ['Track spray','spray',true],['Stop tracking spray','spray',false],
]) test(`setting command: ${phrase}`, () => {
  const command = parseVoiceCommand(phrase,roster,initialBpSettings('m'));
  assert.equal(command.patch[key],value);
  assert.equal(command.kind,'context');
  assert.equal(command.eventText,'');
});

for (const phrase of ['Undo','Undo that','Undo last pitch','Take that back']) test(phrase,()=>assert.equal(voiceSessionAction(phrase),'undo'));

test('count and runner context persist independently of prompting defaults',()=>{
  const settings = initialBpSettings('m');
  const command = parseVoiceCommand('Runner on first, one out, start one and one',roster,settings);
  assert.deepEqual(command.problems,[]);
  assert.deepEqual(command.patch,{});
  const before = {...initialBpState(),...command.statePatch};
  const pitch = buildBpPitch(settings,before,{outcome:'Foul'});
  assert.deepEqual(pitch.stateAfter.runners,[1]);
  assert.equal(pitch.stateAfter.outs,1);
  assert.equal(pitch.stateAfter.balls,1);
  assert.equal(pitch.stateAfter.strikes,2);
  assert.equal(pitch.context.countTracked,true);
  assert.equal(settings.countTracking,undefined);
});

test('same hitter new PA retains pitcher and separates PA',()=>{
  const settings = {...initialBpSettings('m'),source:'PLAYER',pitcherId:'d'};
  const command = parseVoiceCommand('Mylo gets another at-bat',roster,settings,{...initialBpState(),pa:4});
  assert.equal(command.patch.hitterId,'m');
  assert.equal(command.statePatch.pa,5);
  assert.equal({...settings,...command.patch}.pitcherId,'d');
});

test('spoken optional evidence survives canonical builder with all defaults off',()=>{
  const settings = {...initialBpSettings('m'),source:'PLAYER',pitcherId:'d'};
  const context = {domain:'live-bp',settings,state:initialBpState(),roster,bats:'R'};
  const voice = interpretVoice('Slider 79 down away, line drive left center, 92 exit velo, double',context,'override',0.99);
  assert.deepEqual(voice.unresolvedFields,[]);
  assert.equal(canFastSaveVoice(voice),true);
  const saved = buildBpPitch(settings,context.state,voice.draft);
  assert.equal(saved.hitting.velocity,79);
  assert.equal(saved.hitting.exit_velocity_mph,92);
  assert.equal(saved.pitching.pitch_type,'Slider');
  assert.deepEqual(saved.hitting.pitch_location,{x:0.7,y:0.9});
  assert.ok(saved.hitting.field_location);
  const next = interpretVoice('Whiff',context,'next',0.99);
  assert.equal(next.draft.velocity,undefined);
  assert.equal(next.draft.pitchType,undefined);
});

test('Practice single default forces minimum bases and explicit movement overrides',()=>{
  const settings = {...initialBpSettings('m'),mode:'GAME'};
  const before = {...initialBpState(),runners:[1],outs:1};
  const draft = {outcome:'Ball in play',result:'Single'};
  assert.deepEqual(buildBpPitch(settings,before,draft).context.runnerOutcomes,{'1':'2',batter:'1'});
  assert.deepEqual(buildBpPitch(settings,before,{...draft,runnerOutcomes:{1:'3'}}).context.runnerOutcomes,{'1':'3',batter:'1'});
  assert.deepEqual(buildBpPitch(settings,{...before,runners:[2]},draft).context.runnerOutcomes,{'2':'2',batter:'1'});
});

test('explicit corrections replace only the stated field before saving',()=>{
  const context = {domain:'live-bp',settings:initialBpSettings('m'),state:initialBpState(),roster,bats:'R'};
  const pitch = interpretVoice('Slider 78... actually 81, down away, whiff',context,'corrected',0.99);
  assert.equal(pitch.draft.velocity,81);
  assert.deepEqual(pitch.unresolvedFields,[]);
  assert.deepEqual(parseVoiceCommand('Runner on first, no second',roster,context.settings).statePatch.runners,[2]);
  assert.equal(parseVoiceCommand('JP hitting, make that Mylo',roster,context.settings).patch.hitterId,'m');
});

test('manual measurements feed the next Voice result, spoken values override them',()=>{
  const context = {domain:'live-bp',settings:initialBpSettings('m'),state:initialBpState(),roster,bats:'R',manualDraft:{outcome:'',velocity:80,location:{x:.3,y:.7},pitchType:'Slider'}};
  const first=interpretVoice('Whiff',context,'manual-voice',.99);
  assert.equal(first.draft.velocity,80);
  assert.deepEqual(first.draft.location,{x:.3,y:.7});
  assert.equal(first.draft.pitchType,'Slider');
  const second=interpretVoice('Curve 75 middle whiff',context,'override-manual',.99);
  assert.equal(second.draft.velocity,75);
  assert.equal(second.draft.pitchType,'Curveball');
  assert.deepEqual(second.draft.location,{x:.5,y:.5});
});

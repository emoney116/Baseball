import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVoiceCommand } from '../app/lib/voiceCommands.ts';
import { interpretVoice, canFastSaveVoice } from '../app/lib/voiceIntent.ts';
import { voiceSessionAction } from '../app/lib/voiceSession.ts';
import { initialBpSettings, initialBpState, buildBpPitch } from '../app/lib/liveBp.ts';
import { formatBpRecent } from '../app/lib/liveBpRecent.ts';

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

test('multiple explicit runners remain independent and survive FREE context provenance',()=>{
  const settings = initialBpSettings('m');
  const state = {...initialBpState(),situationKnown:true,runners:[1,2],outs:1};
  const voice = interpretVoice('Single to center, runner from second scores, runner from first goes to second', {domain:'live-bp',settings,state,roster}, 'multi-runner', .99);
  assert.deepEqual(voice.unresolvedFields,[]);
  assert.deepEqual(voice.draft.runnerOutcomes,{'1':'2','2':'score'});
  const built = buildBpPitch(settings,state,voice.draft);
  assert.deepEqual(built.context.runnerOutcomes,{'1':'2','2':'score',batter:'1'});
  assert.deepEqual(built.stateAfter.runners.sort(),[1,2]);
  assert.equal(built.stateAfter.outs,1);
  const reversed=interpretVoice('Single to center runner from first goes to second runner from second scores',{domain:'live-bp',settings,state,roster},'reverse-runners',.99);
  assert.deepEqual(reversed.unresolvedFields,[]);
  assert.deepEqual(reversed.draft.runnerOutcomes,voice.draft.runnerOutcomes);
});

test('explicit pitch-type correction removes the superseded type but not other data',()=>{
  const voice = interpretVoice('Slider 79 whiff, that was a curve not a slider', {domain:'live-bp',settings:initialBpSettings('m'),state:initialBpState(),roster}, 'type-correction', .99);
  assert.deepEqual(voice.unresolvedFields,[]);
  assert.equal(voice.draft.pitchType,'Curveball');
  assert.equal(voice.draft.velocity,79);
});

test('full narrated sacrifice and subsequent scoring error retain all representable components',()=>{
  const players = [...roster,{id:'a',aliases:['Andrew'],bats:'R'},{id:'c',aliases:['Catcher']}];
  const original = {...initialBpSettings('m'),source:'PLAYER',pitcherId:'d',alignment:{P:'d','1B':'j',C:'c'}};
  const text = 'Andrew is hitting now. There is a guy on second base. 84-mile-an-hour fastball, low and away. He bunted the ball. It was a successful sac bunt. The runner moved to third. Andrew was thrown out at first by the pitcher to the first baseman. The runner from third attempted to advance to home and was safe at home due to an error from the throw from the first baseman to the catcher.';
  const command = parseVoiceCommand(text,players,original);
  assert.deepEqual(command.problems,[]);
  const settings = {...original,...command.patch};
  const state = {...initialBpState(),...command.statePatch};
  const voice = interpretVoice(command.eventText,{domain:'live-bp',settings,state,roster:players},'rich-sac',.99);
  assert.deepEqual(voice.unresolvedFields,[]);
  const built = buildBpPitch(settings,state,voice.draft);
  assert.equal(built.hitting.velocity,84);
  assert.equal(built.context.result,'Sac Bunt');
  assert.equal(built.context.battedBallType,'Bunt');
  assert.deepEqual(built.context.runnerOutcomes,{'2':'score',batter:'out'});
  assert.deepEqual(built.context.runnerReasons,{'2':'On throwing error'});
  assert.deepEqual(built.context.runnerMovements,[{runnerBase:2,from:'2',to:'3'},{runnerBase:2,from:'3',to:'score'}]);
  assert.equal(built.stateAfter.outs,1);
  assert.deepEqual(built.stateAfter.runners,[]);
  assert.deepEqual(built.context.fieldingSequence.map(step=>step.position),['P','1B','C']);
  assert.equal(built.defense.player_id,'j');
  assert.equal(built.defense.error_type,'Throwing');
});

for (const [text, state, expected] of [
  ['Walk',{balls:3,runners:[1,2,3]},'Walk'],
  ['Strikeout looking',{strikes:2},'Strikeout'],
  ['Strikeout swinging',{strikes:2},'Strikeout'],
  ['Foul',{balls:1,strikes:2},'Foul'],
  ['Ground ball to short, shortstop throws to first, out',{},'Out'],
  ['Ground ball third, throwing error, runner safe at first',{},'Reached on Error'],
  ['Fly ball center, caught',{},'Out'],
]) test(`field narration: ${text}`,()=>{
  const settings={...initialBpSettings('m'),mode:'GAME',alignment:{SS:'j','3B':'d',CF:'j'}};
  // Assign distinct defenders for canonical roster/alignment validation.
  settings.alignment.CF='cf';
  const before={...initialBpState(),...state};
  const intent=interpretVoice(text,{domain:'live-bp',settings,state:before,roster},'scenario',.99);
  assert.deepEqual(intent.unresolvedFields,[]);
  const built=buildBpPitch(settings,before,intent.draft);
  assert.equal(built.context.result,expected);
  if (text==='Foul') assert.deepEqual([built.stateAfter.balls,built.stateAfter.strikes],[1,2]);
});

test('walk and strikeout do not fabricate missing count',()=>{
  for (const text of ['Walk','Strikeout looking','Strikeout swinging']) {
    const intent=interpretVoice(text,{domain:'live-bp',settings:initialBpSettings('m'),state:initialBpState(),roster},'unknown-count',.99);
    assert.equal(canFastSaveVoice(intent),false);
    assert.ok(intent.unresolvedFields.some(field=>field.includes('known')));
  }
});

test('recent event readback uses saved evidence even when metrics are absent',()=>{
  assert.equal(formatBpRecent({pitch_type:'Slider',velocity:79,live_bp_context:{result:'Whiff'}}),'Slider · 79 mph · Whiff');
  assert.equal(formatBpRecent({velocity:null,exit_velocity_mph:null,action:'Foul'}),'Foul');
  assert.equal(formatBpRecent(),'');
});

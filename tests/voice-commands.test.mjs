import test from 'node:test';
import assert from 'node:assert/strict';
import {parseVoiceCommand} from '../app/lib/voiceCommands.ts';
import {interpretVoice} from '../app/lib/voiceIntent.ts';
import {initialBpSettings,initialBpState} from '../app/lib/liveBp.ts';
const roster=[{id:'d',aliases:['Darren Adams','Darren','Adams','3']},{id:'m',aliases:['Mylo White','Mylo','White']},{id:'j',aliases:['JP Smith','JP','Smith']}];
test('real audio runner-at-base compounds establish state before event interpretation',()=>{
  const settings=initialBpSettings('m');
  for(const [text,bases] of [['Runner at first base, single to left.',[1]],['Runners at first base and second base. Single to center, runner from second scores, runner from first goes to second.',[1,2]]]) {
    const command=parseVoiceCommand(text,roster,settings);
    assert.equal(command.kind,'compound');assert.deepEqual(command.statePatch.runners,bases);
    const intent=interpretVoice(command.eventText,{domain:'live-bp',settings,state:{...initialBpState(),...command.statePatch},roster},'runner-at');
    assert.deepEqual(intent.unresolvedFields,[]);
  }
});
test('explicit ball four establishes terminal count without changing tracking preference',()=>{
  const settings=initialBpSettings('m');settings.countTracking=false;
  const command=parseVoiceCommand('Bases loaded, ball four.',roster,settings);
  assert.equal(command.kind,'compound');assert.equal(command.eventText,'ball');
  assert.equal(command.statePatch.balls,3);assert.equal(command.statePatch.countKnown,true);
  assert.equal(command.patch.countTracking,undefined);
});
test('real tag-up narration keeps catch, batter out, and explicit runner score',()=>{
  const settings=initialBpSettings('m');
  const command=parseVoiceCommand('Runner at third base, one out. Fly ball to center, caught, runner tags and scores.',roster,settings);
  const intent=interpretVoice(command.eventText,{domain:'live-bp',settings,state:{...initialBpState(),...command.statePatch},roster},'tag-up');
  assert.deepEqual(intent.unresolvedFields,[]);
  assert.equal(intent.draft.result,'Out');assert.equal(intent.draft.position,'CF');
  assert.equal(intent.draft.runnerOutcomes['3'],'score');assert.equal(intent.draft.runnerReasons['3'],'Tag up');
});
test('real provider ordinal and source article transcripts are context only',()=>{
  const settings=initialBpSettings('m');
  const runner=parseVoiceCommand('Runner on 2nd with 1 out.',roster,settings);
  assert.equal(runner.kind,'context'); assert.deepEqual(runner.statePatch.runners,[2]); assert.equal(runner.statePatch.outs,1);
  const source=parseVoiceCommand('The machine is pitching.',roster,settings);
  assert.equal(source.kind,'context'); assert.equal(source.patch.source,'MACHINE'); assert.deepEqual(source.problems,[]);
  const loaded=parseVoiceCommand('Base is loaded. Nobody out.',roster,settings);
  assert.equal(loaded.kind,'context'); assert.deepEqual(loaded.statePatch.runners,[1,2,3]); assert.equal(loaded.statePatch.outs,0);
  const name=parseVoiceCommand('Milo is hitting.',roster,settings);
  assert.equal(name.patch.hitterId,'m'); assert.deepEqual(name.problems,[]);
  const ambiguous=parseVoiceCommand('Milo is hitting.',[...roster,{id:'other',aliases:['Milo']}],settings);
  assert.ok(ambiguous.problems.length); assert.equal(ambiguous.patch.hitterId,undefined);
  const initials=parseVoiceCommand('J.P. is hitting now.',roster,settings);
  assert.equal(initials.patch.hitterId,'j'); assert.deepEqual(initials.problems,[]);
  const coach=parseVoiceCommand('Coach Darren is pitching.',roster,settings);
  assert.equal(coach.patch.source,'COACH'); assert.equal(coach.patch.pitcherId,undefined); assert.deepEqual(coach.problems,[]);
  const pitcher=parseVoiceCommand('Aidan is pitching now.',[{id:'a',aliases:['Aiden']}],settings);
  assert.equal(pitcher.patch.pitcherId,'a');
  assert.ok(parseVoiceCommand('Aidan is pitching now.',[{id:'a',aliases:['Aiden']},{id:'b',aliases:['Aidan']}],settings).problems.length);
});
for (const [phrase, source, pitch] of [
  ['Coach is pitching fastballs only.', 'COACH', '4-Seam'],
  ['Coach is throwing fastballs only.', 'COACH', '4-Seam'],
  ['Fastballs only.', 'MACHINE', '4-Seam'],
  ["We're throwing sliders only now.", 'MACHINE', 'Slider'],
  ['Darren is throwing changeups only.', 'PLAYER', 'Changeup'],
  ['Machine is throwing fastballs.', 'MACHINE', '4-Seam'],
  ['Machine fastballs only.', 'MACHINE', '4-Seam'],
]) test(`persistent pitch program: ${phrase}`, () => {
  const settings=initialBpSettings('m');
  const c=parseVoiceCommand(phrase,roster,settings);
  assert.equal(c?.kind,'context'); assert.deepEqual(c.problems,[]);
  const next={...settings,...c.patch};
  assert.equal(next.source,source); assert.equal(next.pitchMode,'ONE'); assert.equal(next.pitchType,pitch);
  const event=interpretVoice('84 low and away swing and miss',{domain:'live-bp',settings:next,state:initialBpState(),roster},'test');
  assert.equal(event.draft.pitchType,pitch); assert.equal(event.draft.velocity,84);
});
for (const phrase of ['We are now in multi pitch mode.','Multiple pitches now.','Mix pitches.',"We're mixing pitches.",'Pitchers can throw anything now.']) test(`multi mode clears event inheritance: ${phrase}`,()=>{
  const settings={...initialBpSettings('m'),pitchMode:'ONE',pitchType:'4-Seam'};
  const c=parseVoiceCommand(phrase,roster,settings);
  assert.equal(c?.kind,'context'); assert.equal(c.patch.pitchMode,'MULTI');
  const event=interpretVoice('79 down and away whiff',{domain:'live-bp',settings:{...settings,...c.patch},state:initialBpState(),roster},'test');
  assert.equal(event.draft.pitchType,undefined);
});
test('source, hitter, PA and situation changes preserve pitch program',()=>{
  let settings={...initialBpSettings('m'),pitchMode:'ONE',pitchType:'Slider'};
  let state=initialBpState();
  for(const phrase of ['Coach is pitching','Machine is pitching','Darren is pitching','JP is hitting now','Mylo gets another at bat','Reset the count','Start the count one and one','Runner on second with one out']) {
    const c=parseVoiceCommand(phrase,roster,settings,state);
    assert.equal(c.kind,'context'); assert.deepEqual(c.problems,[]);
    settings={...settings,...c.patch}; state={...state,...c.statePatch};
    assert.equal(settings.pitchMode,'ONE'); assert.equal(settings.pitchType,'Slider');
  }
  assert.deepEqual(state.runners,[2]); assert.equal(state.outs,1); assert.equal(state.balls,1); assert.equal(state.strikes,1);
});
for(const [phrase,key,value] of [['Darren is pitching','pitcherId','d'],['Mylo is hitting','hitterId','m'],['JP is now hitting','hitterId','j'],["Mylo's hitting",'hitterId','m'],['Mylo is up','hitterId','m'],['Put Mylo in','hitterId','m'],['Coach is pitching','source','COACH'],['Machine is pitching','source','MACHINE'],['#3 is pitching','pitcherId','d']])test(phrase,()=>{const c=parseVoiceCommand(phrase,roster,initialBpSettings('m'));assert.equal(c.kind,'context');assert.equal(c.patch[key],value);assert.deepEqual(c.problems,[]);assert.equal(c.eventText,'');});
test('context survives hitter-only change, event resolves current identities',()=>{let settings=initialBpSettings('m');for(const phrase of ['Darren is pitching','Mylo is hitting','JP is now hitting'])settings={...settings,...parseVoiceCommand(phrase,roster,settings).patch};assert.equal(settings.pitcherId,'d');assert.equal(settings.hitterId,'j');const i=interpretVoice('Slider 79 down and away swing and miss',{domain:'live-bp',roster,settings,state:initialBpState(),bats:'R'},'test');assert.equal(i.playerId,'j');assert.equal(i.pitcherId,'d');assert.equal(i.draft.outcome,'Whiff');});
test('compound separates context from exactly one event',()=>{const c=parseVoiceCommand('JP is hitting, four seam 84 middle called strike',roster,initialBpSettings('m'));assert.equal(c.kind,'compound');assert.equal(c.patch.hitterId,'j');assert.equal(c.eventText,'four seam 84 middle called strike');});
for(const phrase of ['Team 1 is on defense','Teams 2 and 3 are on defense','Team 2 is hitting','Next rotation'])test(`group contract defers: ${phrase}`,()=>{const c=parseVoiceCommand(phrase,roster,initialBpSettings('m'));assert.ok(c.group);assert.ok(c.problems.length);assert.deepEqual(c.patch,{});});
test('named defense preset is reused',()=>{const s=initialBpSettings('m');s.defensePresets=[{id:'one',name:'Team 1',alignment:{SS:'j'},positions:['SS'],defense:'SELECTED'}];const c=parseVoiceCommand('Team 1 is on defense',roster,s);assert.equal(c.patch.alignment.SS,'j');assert.deepEqual(c.problems,[]);});
test('unknown and duplicate names do not guess',()=>{assert.match(parseVoiceCommand('Daren is pitching',roster,initialBpSettings('m')).problems[0],/Daren/i);assert.ok(parseVoiceCommand('Darren is pitching',[...roster,{id:'other',aliases:['Darren']}],initialBpSettings('m')).problems.length);});
test('optional absent velocity does not block',()=>{const settings={...initialBpSettings('m'),velocity:true};const i=interpretVoice('the slider was then swing and miss',{domain:'live-bp',settings,state:initialBpState(),roster},'test');assert.equal(i.draft.velocity,undefined);assert.deepEqual(i.unresolvedFields,[]);});
test('unknown wording is quoted explicitly',()=>{const i=interpretVoice('slider whiff banana',{domain:'live-bp',settings:initialBpSettings('m'),state:initialBpState(),roster},'test');assert.ok(i.unresolvedFields.some(p=>p.includes('banana')));});
test('receiving error preserves LF to second sequence without inventing batter result',()=>{const settings={...initialBpSettings('m'),defense:'ALL',alignment:{LF:'d','2B':'j'},spray:true};const i=interpretVoice('Ball was hit to left, left fielder threw to second baseman at second and second baseman made an error fielding it on the tag',{domain:'live-bp',settings,state:initialBpState(),roster},'test');assert.deepEqual(i.draft.fieldingSequence,['LF','2B']);assert.equal(i.draft.position,'2B');assert.equal(i.draft.errorType,'Fielding');assert.equal(i.draft.result,undefined);assert.ok(i.draft.spray);});

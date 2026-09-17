import test from 'node:test';
import assert from 'node:assert/strict';
import {parseVoiceCommand} from '../app/lib/voiceCommands.ts';
import {interpretVoice,assertVoiceIntent,canFastSaveVoice} from '../app/lib/voiceIntent.ts';
import {initialBpSettings,initialBpState} from '../app/lib/liveBp.ts';
import {VOICE_POSITIONS} from '../app/lib/voiceBaseballLanguage.ts';
import {voiceIdentityMatches,voiceRosterAliases} from '../app/lib/voiceVocabulary.ts';

test('real audio: full-name vowel spelling variant remains roster bounded',()=>{
  assert.equal(voiceIdentityMatches({id:'j',aliases:['Jackson Pierce']},'Jackson Pearce'),true);
  assert.equal(voiceIdentityMatches({id:'j',aliases:['Jackson Pierce']},'Jackson Price'),false);
  assert.equal(voiceIdentityMatches({id:'j',aliases:['Jackson Pierce']},'Jackson'),false);
});
test('generated initials never override another explicit roster name',()=>{
  const players=[{id:'j',name:'Jackson Pierce'},{id:'jp',name:'JP HostedQA'}];
  assert.equal(voiceRosterAliases(players[0],players).includes('JP'),false);
  assert.equal(voiceRosterAliases(players[1],players).includes('JP'),true);
});

const roster=[{id:'j',aliases:['Jackson Pierce','Jackson','JP'],bats:'R'},{id:'m',aliases:['Mylo'],bats:'R'}];
const settings={...initialBpSettings('m'),pitchMode:'MULTI',pitchType:'4-Seam',source:'MACHINE',mode:'FREE'};
const context={domain:'live-bp',roster,settings,state:initialBpState(),bats:'R'};
test('alignment pitcher assignment also changes canonical pitch source',()=>{
  const parsed=parseVoiceCommand('Jackson is playing pitcher',roster,settings);
  assert.equal(parsed.patch.source,'PLAYER');assert.equal(parsed.patch.pitcherId,'j');
});
for(const phrase of ['Put Jackson in for Mylo at short','Jackson replaces Mylo at short']) {
  test(`safe substitution: ${phrase}`,()=>{
    const parsed=parseVoiceCommand(phrase,roster,{...settings,alignment:{SS:'m'}});
    assert.deepEqual(parsed.problems,[]);assert.equal(parsed.patch.alignment.SS,'j');
    assert.ok(parseVoiceCommand(phrase,roster,settings).problems.length);
  });
}
test('real audio: count as one and one',()=>{
  const parsed=parseVoiceCommand('Count as one and one.',roster,settings);
  assert.equal(parsed.statePatch.balls,1);assert.equal(parsed.statePatch.strikes,1);
});
test('real audio: joined hardline drive',()=>{
  const parsed=interpretVoice('Hardline drive.',context,'qa',.44);
  assert.equal(parsed.draft.battedBall,'Line drive');assert.equal(parsed.draft.contactQuality,'Hard');
  assert.deepEqual(parsed.unresolvedFields,[]);assert.equal(canFastSaveVoice(parsed),false);
});
for(const [position,canonical] of Object.entries(VOICE_POSITIONS)) {
  for(const phrase of [`Jackson Pierce is now playing ${position}`,`Put Jackson at ${position}`,`Jackson at ${position}`,`Move Jackson to ${position}`,`Jackson goes to ${position}`]) {
    test(`alignment: ${phrase}`,()=>{
      const result=parseVoiceCommand(phrase,roster,settings);
      assert.equal(result?.kind,'context');assert.deepEqual(result.problems,[]);
      assert.equal(result.patch.alignment[canonical],'j');assert.equal(result.eventText,'');
    });
  }
}
const words=['zero','one','two','three'];
for(let balls=0;balls<=3;balls++)for(let strikes=0;strikes<=2;strikes++) {
  for(const phrase of [`Count is ${words[balls]} and ${words[strikes]}`,`${words[balls]} balls ${words[strikes]} strikes`,`${balls}-${strikes}`,`Start him ${words[balls]}-${words[strikes]}`]) {
    test(`count: ${phrase}`,()=>{
      const result=parseVoiceCommand(phrase,roster,settings);
      assert.equal(result?.kind,'context');assert.equal(result.statePatch.balls,balls);assert.equal(result.statePatch.strikes,strikes);
    });
  }
}
for(const [quality,canonical] of [['hard','Hard'],['smoked','Hard'],['soft','Weak'],['weak','Weak'],['medium','Solid'],['barreled','Hard']]) {
  for(const [bip,expected] of [['line drive','Line drive'],['grounder','Ground ball'],['fly ball','Fly ball'],['popup','Pop up']]) {
    for(const unit of ['mph exit velocity','mile an hour exit velocity','off the bat','exit']) {
      const phrase=`${quality} ${bip} center field 94 ${unit}`;
      test(`contact/EV: ${phrase}`,()=>{
        const intent=interpretVoice(phrase,context,'qa',.99);
        assert.equal(intent.draft.battedBall,expected);assert.equal(intent.draft.contactQuality,canonical);
        assert.equal(intent.draft.ev,94);assert.equal(intent.draft.velocity,undefined);
        assert.deepEqual(intent.unresolvedFields,[]);assertVoiceIntent(intent);
      });
    }
  }
}
for(const pitch of ['fastball','slider','changeup','cutter'])for(const velocity of [74,84])for(const result of ['whiff','foul','called strike','ball']) {
  test(`pitch: ${pitch} ${velocity} ${result}`,()=>{
    const intent=interpretVoice(`${pitch} ${velocity} low away ${result}`,context,'qa',.99);
    assert.equal(intent.draft.velocity,velocity);assert.equal(intent.draft.ev,undefined);assert.deepEqual(intent.unresolvedFields,[]);
  });
}
test('independent velocities and coach quality',()=>{
  const intent=interpretVoice('84 mile an hour fastball low and away hard line drive right center 96 exit velo single',context,'qa',.99);
  assert.equal(intent.draft.velocity,84);assert.equal(intent.draft.ev,96);assert.equal(intent.draft.contactQuality,'Hard');assert.deepEqual(intent.unresolvedFields,[]);
});
test('alignment movement removes old position without a stat',()=>{
  const first=parseVoiceCommand('Jackson at first',roster,settings);
  const next=parseVoiceCommand('Move Jackson to third',roster,{...settings,...first.patch});
  assert.equal(next.patch.alignment['1B'],undefined);assert.equal(next.patch.alignment['3B'],'j');
});
test('critical-field Fast gate uses known context but retains ambiguity',()=>{
  assert.equal(canFastSaveVoice(interpretVoice('Whiff',context,'qa',.82)),true);
  assert.equal(canFastSaveVoice(interpretVoice('Slider 79 down away whiff',context,'qa',.9)),true);
  assert.equal(canFastSaveVoice(interpretVoice('Slider 79 down away whiff',context,'qa',.5)),false);
  assert.equal(canFastSaveVoice(interpretVoice('82 or 84',context,'qa',.99)),false);
  assert.equal(canFastSaveVoice(interpretVoice('Line drive center',context,'qa',.82)),false);
});

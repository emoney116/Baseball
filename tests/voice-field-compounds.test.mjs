import test from 'node:test';
import assert from 'node:assert/strict';
import {parseVoiceCommand} from '../app/lib/voiceCommands.ts';
import {initialBpSettings,initialBpState} from '../app/lib/liveBp.ts';
import {correctedVoiceText} from '../app/lib/voiceSession.ts';

const roster=[{id:'jacob',aliases:['Jacob Seamon','Jacob']}];
const settings={...initialBpSettings('current-hitter'),source:'COACH',alignment:{SS:'jacob'}};
for(const [side,position] of [['left','LF'],['center','CF'],['right','RF']]) {
  for(const location of [side,`${side} field`,`${side}field`,`${side}-field`]) {
    for(const phrase of [`Jacob is playing ${location}`,`Jacob playing ${location}`,`Move Jacob to ${location}`]) {
      test(`alignment: ${phrase}`,()=>{
        const command=parseVoiceCommand(phrase,roster,settings,initialBpState());
        assert.ok(command);
        assert.deepEqual(command.problems,[]);
        assert.deepEqual(command.patch.alignment,{[position]:'jacob'});
        assert.equal(command.patch.hitterId,undefined);
        assert.equal(command.eventText,'');
        assert.equal(command.action,undefined);
      });
    }
  }
  test(`${side}field spray and ${side}fielder errors normalize like spaced phrases`,()=>{
    assert.equal(correctedVoiceText(`line drive ${side}field 94 exit`),correctedVoiceText(`line drive ${side} field 94 exit`));
    assert.equal(correctedVoiceText(`${side}fielder made an error`),correctedVoiceText(`${side} fielder made an error`));
    assert.equal(correctedVoiceText(`${side}field made an error`),correctedVoiceText(`${side} field made an error`));
    assert.equal(parseVoiceCommand(`line drive ${side}field`,roster,settings,initialBpState()),null);
  });
}
test('unknown or ambiguous alignment identity reviews instead of switching hitter',()=>{
  for(const players of [[],[...roster,{id:'other',aliases:['Jacob']} ]]) {
    const command=parseVoiceCommand('Jacob is playing centerfield',players,settings,initialBpState());
    assert.ok(command.problems.length);
    assert.equal(command.patch.hitterId,undefined);
    assert.equal(command.patch.alignment,undefined);
    assert.equal(command.eventText,'');
  }
});

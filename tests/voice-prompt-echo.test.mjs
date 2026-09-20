import test from 'node:test';
import assert from 'node:assert/strict';
import {VOICE_TRANSCRIPTION_PROMPT,isVoicePromptEcho} from '../app/lib/voiceTranscriptionPrompt.ts';
test('long provider echoes are rejected with or without injected heading',()=>{
 assert.equal(isVoicePromptEcho(VOICE_TRANSCRIPTION_PROMPT),true);
 assert.equal(isVoicePromptEcho(VOICE_TRANSCRIPTION_PROMPT.split(': ')[1]),true);
});
test('baseball commands and pitch-program lists are not prompt echoes',()=>{
 for(const text of ['Ball outside.','Fastball, slider, changeup, curveball, cutter.','84 fastball low away hard line drive right 94 exit single runner to third'])assert.equal(isVoicePromptEcho(text),false);
});

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { encodeVoiceWav, validateVoiceWav } from '../app/lib/voiceAudio.ts';

const input = 'C:/Users/ebost/OneDrive/Documents/Sound Recordings/1_27.m4a';
const out = 'C:/Users/ebost/.codex/qa-audio-1-27';
fs.mkdirSync(out, {recursive:true});
const ffmpeg = execFileSync('python',['-c','import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'],{encoding:'utf8'}).trim();
// Boundaries follow detected pauses; short incidental noise is kept with its utterance.
const boundaries = [0,2.65,5.64,8.4,11.25,15.2,17.55,20.85,24.45,26.7,30.0,34.3,38.65,40.0,43.58,47.9,51.6,56.0,60.35,64.45,66.3,68.4,70.25,73.05,77.65,81.55,88.75,95.38];
for(let i=0;i<27;i++) {
  const file=path.join(out,`${String(i+1).padStart(2,'0')}.wav`);
  const raw=execFileSync(ffmpeg,['-v','error','-ss',String(boundaries[i]),'-i',input,'-t',String(boundaries[i+1]-boundaries[i]),'-ac','1','-ar','16000','-f','f32le','pipe:1']);
  const samples=new Float32Array(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));
  const wav=new Uint8Array(encodeVoiceWav(samples,16000));
  validateVoiceWav(wav);
  fs.writeFileSync(file,wav);
}

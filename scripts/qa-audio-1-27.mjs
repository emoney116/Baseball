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
const trim = process.argv.includes('--trim');
for(let i=0;i<27;i++) {
  const file=path.join(out,`${String(i+1).padStart(2,'0')}${trim ? '-trim' : ''}.wav`);
  const raw=execFileSync(ffmpeg,['-v','error','-ss',String(boundaries[i]),'-i',input,'-t',String(boundaries[i+1]-boundaries[i]),'-ac','1','-ar','16000','-f','f32le','pipe:1']);
  let samples=new Float32Array(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));
  if (trim) {
    // Only trim quiet outer padding; preserve internal pauses and 150 ms around speech.
    const frame=320, active=[];
    for(let start=0;start<samples.length;start+=frame) {
      const end=Math.min(start+frame,samples.length);
      let energy=0;
      for(let j=start;j<end;j++) energy+=samples[j]*samples[j];
      if(Math.sqrt(energy/(end-start))>0.012) active.push(start);
    }
    if(active.length) samples=samples.slice(Math.max(0,active[0]-2400),Math.min(samples.length,active.at(-1)+frame+2400));
  }
  const wav=new Uint8Array(encodeVoiceWav(samples,16000));
  validateVoiceWav(wav);
  fs.writeFileSync(file,wav);
}

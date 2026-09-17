import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const root = 'C:/Users/ebost/OneDrive/Documents/Sound Recordings';
const out = 'C:/Users/ebost/.codex/qa-audio-phase2';
const ffmpeg = execFileSync('python', ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'], {encoding:'utf8'}).trim();
const manifest = [];
for (const file of ['28_42','43_53','54','55-60','61-87','88_93']) {
  const input = path.join(root, `${file}.m4a`);
  const result = spawnSync(ffmpeg, ['-hide_banner','-i',input,'-af','silencedetect=noise=-32dB:d=1.0','-f','null','NUL'], {encoding:'utf8'});
  if(result.status !== 0) throw new Error(result.stderr);
  const [,h,m,s] = result.stderr.match(/Duration: (\d+):(\d+):([\d.]+)/);
  const duration = Number(h)*3600 + Number(m)*60 + Number(s);
  const pauses = [...result.stderr.matchAll(/silence_start: ([\d.-]+)\s*\n[^\n]*silence_end: ([\d.]+)/g)].map(x => [Number(x[1]),Number(x[2])]);
  const boundaries = file === '54' ? [0,duration] : [0,...pauses.filter(([a,b])=>a>0.2 && b<duration-0.2).map(([a,b])=>(a+b)/2),duration];
  fs.mkdirSync(path.join(out,file), {recursive:true});
  const segments = [];
  for(let i=0;i<boundaries.length-1;i++) {
    const target=path.join(out,file,`${String(i+1).padStart(2,'0')}.wav`);
    execFileSync(ffmpeg,['-v','error','-y','-ss',String(boundaries[i]),'-i',input,'-t',String(boundaries[i+1]-boundaries[i]),'-ac','1','-ar','16000','-c:a','pcm_s16le','-fflags','+bitexact',target]);
    segments.push({segment:i+1,start:boundaries[i],end:boundaries[i+1],file:target});
  }
  manifest.push({file,duration,pauses,segments});
}
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
console.log(manifest.map(({file,duration,segments})=>({file,duration,segments:segments.length})));

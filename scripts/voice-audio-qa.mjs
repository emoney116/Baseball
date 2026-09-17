import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';

// Local/private audio only. This harness never reads credentials or calls a provider.
const [input,output,ffmpeg='ffmpeg']=process.argv.slice(2);
if(!input||!output)throw new Error('Usage: node scripts/voice-audio-qa.mjs INPUT OUTPUT_DIRECTORY [FFMPEG]');
const source=resolve(input),destination=resolve(output);
mkdirSync(destination,{recursive:true});
const scan=spawnSync(ffmpeg,['-i',source,'-af','silencedetect=noise=-32dB:d=0.45','-f','null','-'],{encoding:'utf8'});
if(scan.status!==0)throw new Error(scan.stderr);
const duration=scan.stderr.match(/Duration: (\d+):(\d+):([\d.]+)/);
if(!duration)throw new Error('Audio duration unavailable.');
const total=Number(duration[1])*3600+Number(duration[2])*60+Number(duration[3]);
const pauses=[...scan.stderr.matchAll(/silence_start: ([\d.-]+)[\s\S]*?silence_end: ([\d.]+)/g)].map(m=>[Math.max(0,Number(m[1])),Number(m[2])]);
let start=0;const segments=[];
for(const [begin,end] of [...pauses,[total,total]]) {
  if(begin-start>.25)segments.push({start:Math.max(0,start-.15),end:Math.min(total,begin+.2)});
  start=end;
}
for(const [index,segment] of segments.entries()) {
  segment.file=join(destination,`${String(index+1).padStart(2,'0')}.wav`);
  const converted=spawnSync(ffmpeg,['-y','-i',source,'-ss',String(segment.start),'-t',String(segment.end-segment.start),'-ar','16000','-ac','1','-c:a','pcm_s16le','-fflags','+bitexact','-flags:a','+bitexact','-map_metadata','-1',segment.file],{encoding:'utf8'});
  if(converted.status!==0)throw new Error(converted.stderr);
}
const manifest={source,duration:total,segmentation:'Silence proposals; verify transcript boundaries before acceptance.',segments};
writeFileSync(join(destination,'manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify(manifest,null,2));

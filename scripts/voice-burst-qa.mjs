import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';

// Assemble real human clips with field-speed gaps; never synthesize expected speech.
const [ffmpeg,output,...files]=process.argv.slice(2);
if(!ffmpeg||!output||files.length<2)throw new Error('Usage: node scripts/voice-burst-qa.mjs FFMPEG OUTPUT CLIP...');
const args=['-y',...files.flatMap(file=>['-i',resolve(file)])];
const filters=files.map((_,i)=>`[${i}:a]aresample=16000,silenceremove=start_periods=1:start_threshold=-35dB,areverse,silenceremove=start_periods=1:start_threshold=-35dB,areverse,apad=pad_dur=0.55[a${i}]`);
filters.push(`${files.map((_,i)=>`[a${i}]`).join('')}concat=n=${files.length}:v=0:a=1[out]`);
args.push('-filter_complex',filters.join(';'),'-map','[out]','-ac','1','-ar','16000','-c:a','pcm_s16le','-fflags','+bitexact','-flags:a','+bitexact','-map_metadata','-1',resolve(output));
const result=spawnSync(ffmpeg,args,{encoding:'utf8'});
if(result.status!==0)throw new Error(result.stderr);
console.log(JSON.stringify({output:resolve(output),clips:files.map(resolvePath=>resolve(resolvePath)),gapSeconds:.55}));

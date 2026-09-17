import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseEnv } from 'node:util';

const input = 'C:/Users/ebost/OneDrive/Documents/Sound Recordings/1_27.m4a';
const out = 'C:/Users/ebost/.codex/qa-audio-1-27';
fs.mkdirSync(out, {recursive:true});
const envFile=process.env.QA_VOICE_ENV_FILE || path.join(out,'.env.preview.local');
const env = parseEnv(fs.readFileSync(envFile,'utf8'));
const key = env.OPENAI_VOICE_API_KEY || env.OPENAI_API_KEY;
if (!key && !process.argv.includes('--segment-only')) throw new Error('Provider credential unavailable');
const ffmpeg = execFileSync('python',['-c','import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'],{encoding:'utf8'}).trim();
// Boundaries follow detected pauses; short incidental noise is kept with its utterance.
const boundaries = [0,2.65,5.64,8.4,11.25,15.2,17.55,20.85,24.45,26.7,30.0,34.3,38.65,40.0,43.58,47.9,51.6,56.0,60.35,64.45,66.3,68.4,70.25,73.05,77.65,81.55,88.75,95.38];
const results=[];
for(let i=0;i<27;i++) {
  const file=path.join(out,`${String(i+1).padStart(2,'0')}.wav`);
  execFileSync(ffmpeg,['-v','error','-y','-ss',String(boundaries[i]),'-i',input,'-t',String(boundaries[i+1]-boundaries[i]),'-ac','1','-ar','16000','-c:a','pcm_s16le',file]);
  if(process.argv.includes('--segment-only')) continue;
  const form=new FormData();
  form.append('file',new Blob([fs.readFileSync(file)],{type:'audio/wav'}),'event.wav');
  form.append('model','whisper-1'); form.append('language','en'); form.append('response_format','verbose_json');
  const start=performance.now();
  const response=await fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${key}`},body:form,signal:AbortSignal.timeout(30000)});
  const data=await response.json();
  const row={command:i+1,start:boundaries[i],end:boundaries[i+1],status:response.status,latencyMs:Math.round(performance.now()-start),provider:'OpenAI',model:'whisper-1',data};
  results.push(row); fs.writeFileSync(path.join(out,'transcripts.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify({command:row.command,status:row.status,latencyMs:row.latencyMs,transcript:data.text,error:data.error?.code}));
  if(!response.ok) break;
}

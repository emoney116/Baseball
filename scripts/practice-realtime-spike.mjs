import WebSocket from 'ws';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {parseEnv} from 'node:util';
import {spawnSync} from 'node:child_process';
const [directory,envFile,ffmpeg,indexText='5']=process.argv.slice(2);
if(process.env.CLUBHOUSE_VOICE_V2_QA!=='true')throw new Error('QA flag required');
const env=parseEnv(readFileSync(envFile,'utf8'));
const manifest=JSON.parse(readFileSync(join(directory,'source-manifest.json'),'utf8'));
const index=Number(indexText),start=index*30;
if(!Number.isInteger(index)||start<0||start>=manifest.durationSeconds)throw new Error('Invalid chunk');
const audio=spawnSync(ffmpeg,['-ss',String(start),'-i',manifest.source,'-t','30','-f','s16le','-ar','24000','-ac','1','pipe:1'],{maxBuffer:4*1024*1024});
if(audio.status!==0)throw new Error('Decode failed');
const events=[],began=Date.now();
const ws=new WebSocket('wss://api.openai.com/v1/realtime?intent=transcription',{headers:{Authorization:`Bearer ${env.OPENAI_VOICE_API_KEY||env.OPENAI_API_KEY}`}});
let configured=false,done=false;
const timer=setTimeout(()=>finish('timeout'),60000);
function finish(status){if(done)return;done=true;clearTimeout(timer);writeFileSync(join(directory,`realtime-${index}.json`),JSON.stringify({model:'gpt-live-transcribe',index,status,elapsedMs:Date.now()-began,transport:'WebSocket PCM24k; accelerated upload, not live latency measurement',events},null,2));ws.close();console.log(`Realtime chunk ${index}: ${status}`);}
ws.on('open',()=>ws.send(JSON.stringify({type:'session.update',session:{type:'transcription',audio:{input:{format:{type:'audio/pcm',rate:24000},transcription:{model:'gpt-live-transcribe'},turn_detection:null}}}})));
ws.on('message',message=>{
 const event=JSON.parse(message.toString());events.push({receivedMs:Date.now()-began,event});
 if(event.type==='error')return finish('provider_error');
 if((event.type==='session.updated'||event.type==='transcription_session.updated')&&!configured){configured=true;
  for(let offset=0;offset<audio.stdout.length;offset+=24000)ws.send(JSON.stringify({type:'input_audio_buffer.append',audio:audio.stdout.subarray(offset,offset+24000).toString('base64')}));
  ws.send(JSON.stringify({type:'input_audio_buffer.commit'}));
 }
 if(event.type==='conversation.item.input_audio_transcription.completed')finish('completed');
});
ws.on('error',()=>finish('connection_error'));
ws.on('close',()=>finish('closed_before_completion'));

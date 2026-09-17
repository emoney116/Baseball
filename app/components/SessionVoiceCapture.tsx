"use client";
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Mic, MicOff, Square } from 'lucide-react';
import type { MicVAD } from '@ricky0123/vad-web';
import { encodeVoiceWav, VOICE_MAX_SECONDS, VOICE_SAMPLE_RATE } from '../lib/voiceAudio';
import { practiceActionQueue, type PracticeActionTicket } from '../lib/practiceActionQueue';
import { requestVoiceTranscription } from '../lib/voiceTranscriptionRequest';

type Capture = {ticket:PracticeActionTicket;samples:Float32Array;requestId:string;status:'captured'|'transcribing'|'waiting'|'review'|'failed';error?:string};
export function SessionVoiceCapture({ practiceId, contextKey, disabled, onTranscript, canProcess }: {
  practiceId:string;contextKey:string;disabled?:boolean;
  onTranscript:(text:string,confidence:number|null,requestId:string)=>Promise<boolean>;
  canProcess:()=>boolean;
}) {
  const [state,setState]=useState<'off'|'starting'|'listening'|'muted'>('off');
  const [items,setItems]=useState<Capture[]>([]),[error,setError]=useState('');
  const captures=useRef<Capture[]>([]),vad=useRef<MicVAD|null>(null),stream=useRef<MediaStream|null>(null);
  const handler=useRef(onTranscript),currentContext=useRef(contextKey);
  const ready=useRef(canProcess);
  const mounted=useRef(true),active=useRef(false),workers=useRef(0),generation=useRef(0);
  const speech=useRef<PracticeActionTicket|null>(null),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const timeline=practiceActionQueue(practiceId);
  const playback=useRef<AudioContext|null>(null);
  const [qaResults,setQaResults]=useState<{sequence:number;transcript:string;transcriptionMs:number;completed:boolean;saved?:boolean}[]>([]);
  const [maximumDepth,setMaximumDepth]=useState(0);
  useLayoutEffect(()=>{handler.current=onTranscript;currentContext.current=contextKey;ready.current=canProcess;},[onTranscript,contextKey,canProcess]);
  function publish(){if(mounted.current){setItems(captures.current.map(item=>({...item})));setMaximumDepth(value=>Math.max(value,captures.current.length));}}
  function retry(requestId:string) {
    const item=captures.current.find(row=>row.requestId===requestId);if(!item)return;
    item.requestId=crypto.randomUUID();item.status='captured';item.error=undefined;pump();
  }
  function discard(requestId:string) {
    const item=captures.current.find(row=>row.requestId===requestId);if(!item)return;
    timeline.discard(item.ticket);captures.current=captures.current.filter(row=>row!==item);publish();
  }
  async function mute(end=false) {
    active.current=false;generation.current++;clearTimeout(timer.current);
    const detector=vad.current;vad.current=null;
    // Stop capture only: flushing, transcription, Review and accepted work survive mute.
    try {detector?.setOptions({submitUserSpeechOnPause:true});await detector?.pause();}
    catch {if(mounted.current)setError('Final phrase could not be captured. Earlier queued phrases are retained.');}
    finally {
      stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;
      await playback.current?.close().catch(()=>undefined);playback.current=null;
      await detector?.destroy().catch(()=>undefined);
      if(speech.current){timeline.discard(speech.current);speech.current=null;}
      if(mounted.current)setState(end?'off':'muted');
    }
  }
  useEffect(()=>{
    mounted.current=true;
    const hidden=()=>{if(document.hidden)void mute();};
    const unloading=(event:BeforeUnloadEvent)=>{if(captures.current.length){event.preventDefault();event.returnValue='';}};
    document.addEventListener('visibilitychange',hidden);window.addEventListener('beforeunload',unloading);
    return()=>{mounted.current=false;void mute();document.removeEventListener('visibilitychange',hidden);window.removeEventListener('beforeunload',unloading);};
  // Capture lifecycle is tied to Practice, never a pending save or a context render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[practiceId]);
  function pump() {
    while(workers.current<3) {
      const item=captures.current.find(row=>row.status==='captured');if(!item)break;
      item.status='transcribing';workers.current++;publish();void transcribe(item);
    }
  }
  async function transcribe(item:Capture) {
    // Invoked only by capture/retry event workers, never during rendering.
    // eslint-disable-next-line react-hooks/purity
    const started=performance.now();
    try {
      const result=await requestVoiceTranscription({
        request:()=>fetch(`/api/voice/transcribe?practiceId=${encodeURIComponent(practiceId)}&requestId=${item.requestId}`,{
          method:'POST',headers:{'Content-Type':'audio/wav'},body:encodeVoiceWav(item.samples,VOICE_SAMPLE_RATE),signal:AbortSignal.timeout(25000),
        }),
        wait:ms=>new Promise(resolve=>setTimeout(resolve,ms)),
        renewRequest:()=>{item.requestId=crypto.randomUUID();},
      });
      item.status='waiting';publish();workers.current--;pump();
      if(process.env.NEXT_PUBLIC_VERCEL_ENV==='preview')setQaResults(rows=>[...rows,{sequence:item.ticket.sequence,transcript:result.transcript,transcriptionMs:Math.round(performance.now()-started),completed:false}]);
      const saved=await timeline.execute(item.ticket,async()=>{
        // A predecessor can finish its network write before React publishes the
        // reconciled context. Never treat that brief busy window as a discard.
        await new Promise(resolve=>setTimeout(resolve,0));
        while(mounted.current && !ready.current())await new Promise(resolve=>setTimeout(resolve,25));
        if(!mounted.current)throw new Error('Voice view closed with an unresolved capture.');
        item.status='review';publish();
        const accepted=await handler.current(result.transcript,typeof result.confidence==='number'?result.confidence:null,item.requestId);
        if(!accepted&&mounted.current)setError('Phrase was not saved. Review the console before continuing.');
        return accepted;
      });
      captures.current=captures.current.filter(row=>row!==item);publish();
      if(process.env.NEXT_PUBLIC_VERCEL_ENV==='preview')setQaResults(rows=>rows.map(row=>row.sequence===item.ticket.sequence?{...row,completed:true,saved}:row));
    } catch(e) {
      if(item.status==='transcribing'){workers.current--;pump();}
      // Worker records live in captures.current; publish creates immutable UI snapshots.
      // eslint-disable-next-line react-hooks/immutability
      item.status='failed';item.error=e instanceof Error?e.message:'Voice failed. Audio retained.';publish();
    }
  }
  async function start(recording?:File) {
    if(disabled||state==='starting'||active.current)return;
    if(captures.current.length>=24){setError('24 Voice phrases pending. Resolve Review before unmuting.');return;}
    setState('starting');setError('');const token=++generation.current;
    try {
      let source:AudioBufferSourceNode|undefined;
      let mic:MediaStream;
      if(recording&&process.env.NEXT_PUBLIC_VERCEL_ENV==='preview') {
        if(recording.size>20*1024*1024)throw new Error('QA recording is too large.');
        const audio=new AudioContext();playback.current=audio;
        const decoded=await audio.decodeAudioData(await recording.arrayBuffer());
        const destination=audio.createMediaStreamDestination();source=audio.createBufferSource();source.buffer=decoded;source.connect(destination);
        mic=destination.stream;
      } else mic=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true}});
      if(token!==generation.current){mic.getTracks().forEach(track=>track.stop());return;}
      stream.current=mic;
      const {MicVAD}=await import('@ricky0123/vad-web');
      const detector=await MicVAD.new({
        model:'v5',startOnLoad:false,baseAssetPath:'/voice-assets/',onnxWASMBasePath:'/voice-assets/',getStream:async()=>mic,
        submitUserSpeechOnPause:true,redemptionMs:350,minSpeechMs:80,preSpeechPadMs:300,
        onSpeechStart:()=>{
          if(!active.current)return;
          try {speech.current=timeline.reserve(currentContext.current);}
          catch(e){setError((e as Error).message);void mute();return;}
          clearTimeout(timer.current);
          timer.current=setTimeout(()=>{setError(`Voice paused at ${VOICE_MAX_SECONDS} seconds. Resolve the captured narration before continuing.`);void mute();},(VOICE_MAX_SECONDS-1)*1000);
        },
        onVADMisfire:()=>{clearTimeout(timer.current);if(speech.current)timeline.discard(speech.current);speech.current=null;},
        onSpeechEnd:samples=>{
          clearTimeout(timer.current);const ticket=speech.current;speech.current=null;if(!ticket)return;
          captures.current.push({ticket,samples,requestId:crypto.randomUUID(),status:'captured'});publish();pump();
          if(captures.current.length>=24){setError('24 Voice phrases pending. Capture paused; all captured phrases retained.');void mute();}
        },
      });
      if(token!==generation.current){await detector.destroy();return;}
      vad.current=detector;active.current=true;await detector.start();setState('listening');
      if(source){source.onended=()=>{setTimeout(()=>void mute(),1200);};await playback.current?.resume();source.start();}
    } catch {await mute();setError('Microphone could not start. Check permission; manual entry remains available.');}
  }
  const reviews=items.filter(item=>item.status==='review').length;
  return <div>
    <button type="button" className="secondary-button" disabled={disabled&&state!=='listening'} onClick={()=>{if(state==='listening'||state==='starting')void mute();else void start();}}>
      {state==='listening'?<MicOff size={18}/>:<Mic size={18}/>}{state==='listening'?'Mute':state==='starting'?'Cancel microphone':state==='off'?'Start listening':'Unmute'}
    </button>
    {state!=='off'&&<button type="button" className="icon-button" aria-label="End Voice session" title="End Voice session" onClick={()=>void mute(true)}><Square size={18}/></button>}
    <span role="status">{state==='listening'?'Voice Live':state==='starting'?'Starting microphone':'Voice muted'} · {reviews?`${reviews} needs review${items.length>reviews?` · ${items.length-reviews} waiting`:''}`:items.length?`${items.length} processing`:'Caught up'}</span>
    {error&&<p role="alert">{error}</p>}
    {process.env.NEXT_PUBLIC_VERCEL_ENV==='preview'&&<details><summary>Continuous audio QA</summary>
      <input type="file" accept="audio/wav,.wav" aria-label="QA continuous recording" disabled={state==='listening'||state==='starting'} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void start(file);}}/>
      <output aria-label="QA capture results">{JSON.stringify(qaResults)}</output>
      <output aria-label="QA maximum queue depth">{maximumDepth}</output>
    </details>}
    {items.filter(item=>item.status==='failed').map(item=><div key={item.requestId} role="alert">{item.error}
      <button type="button" onClick={()=>retry(item.requestId)}>Retry</button>
      <button type="button" onClick={()=>discard(item.requestId)}>Discard phrase</button>
    </div>)}
  </div>;
}

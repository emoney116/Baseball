"use client";
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Mic, MicOff, Square } from 'lucide-react';
import type { MicVAD } from '@ricky0123/vad-web';
import { encodeVoiceWav, VOICE_MAX_SECONDS, VOICE_SAMPLE_RATE } from '../lib/voiceAudio';
import { practiceActionQueue, type PracticeActionTicket } from '../lib/practiceActionQueue';
import { requestVoiceTranscription } from '../lib/voiceTranscriptionRequest';
import styles from './VoiceEntry.module.css';
import { assembleVoiceFragments } from '../lib/voiceEventAssembler';
import { HeldVoiceAudio } from '../lib/heldVoiceAudio';

type Capture = {ticket:PracticeActionTicket;samples:Float32Array;sampleRate?:number;requestId:string;status:'captured'|'transcribing'|'waiting'|'review'|'failed';error?:string;endedAt:number;explicitEnd?:boolean;transcript?:string;confidence?:number|null;absorbed?:boolean;assembly?:{text:string;confidence:number|null;merged:Capture[]};retryCommit?:()=>void;discardRequested?:boolean};
export function SessionVoiceCapture({ practiceId, contextKey, disabled, onTranscript, onDetail, canProcess, continuousEnabled=true }: {
  practiceId:string;contextKey:string;disabled?:boolean;
  continuousEnabled?:boolean;
  onTranscript:(text:string,confidence:number|null,requestId:string)=>Promise<boolean>;
  onDetail?:(text:string,confidence:number|null)=>Promise<boolean>;
  canProcess:()=>boolean;
}) {
  const [state,setState]=useState<'off'|'starting'|'listening'|'muted'>('off');
  const [items,setItems]=useState<Capture[]>([]),[error,setError]=useState('');
  const captures=useRef<Capture[]>([]),vad=useRef<MicVAD|null>(null),stream=useRef<MediaStream|null>(null);
  const handler=useRef(onTranscript),currentContext=useRef(contextKey);
  const detail=useRef(onDetail);
  const ready=useRef(canProcess);
  const mounted=useRef(true),active=useRef(false),workers=useRef(0),generation=useRef(0);
  const speech=useRef<PracticeActionTicket|null>(null),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const timeline=practiceActionQueue(practiceId);
  const playback=useRef<AudioContext|null>(null);
  const [qaResults,setQaResults]=useState<{sequence:number;transcript:string;transcriptionMs:number;completed:boolean;saved?:boolean;mergedInto?:number;assembledTranscript?:string}[]>([]);
  const [maximumDepth,setMaximumDepth]=useState(0);
  const [provisional,setProvisional]=useState('');
  const [holding,setHolding]=useState(false),[holdSeconds,setHoldSeconds]=useState(0);
  const [holdReady,setHoldReady]=useState(false),[cancelHold,setCancelHold]=useState(false);
  const holdOrigin=useRef<{x:number;y:number}|null>(null),holdCancelled=useRef(false);
  const held=useRef(false),holdFinish=useRef<((cancel?:boolean)=>void)|null>(null);
  useLayoutEffect(()=>{handler.current=onTranscript;detail.current=onDetail;currentContext.current=contextKey;ready.current=canProcess;},[onTranscript,onDetail,contextKey,canProcess]);
  function publish(){if(mounted.current){setItems(captures.current.map(item=>({...item})));setMaximumDepth(value=>Math.max(value,captures.current.length));}}
  function retry(requestId:string) {
    const item=captures.current.find(row=>row.requestId===requestId);if(!item)return;
    if(item.retryCommit){item.status='waiting';item.error=undefined;item.retryCommit();publish();return;}
    item.requestId=crypto.randomUUID();item.status='captured';item.error=undefined;pump();
  }
  function discard(requestId:string) {
    const item=captures.current.find(row=>row.requestId===requestId);if(!item)return;
    item.discardRequested=true;item.retryCommit?.();
    const batch=[item,...(item.assembly?.merged??[])];for(const row of batch)timeline.discard(row.ticket);
    captures.current=captures.current.filter(row=>!batch.includes(row));publish();
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
    const hidden=()=>{if(document.hidden){held.current=false;holdFinish.current?.(true);void mute();}};
    const unloading=(event:BeforeUnloadEvent)=>{if(captures.current.length){event.preventDefault();event.returnValue='';}};
    document.addEventListener('visibilitychange',hidden);window.addEventListener('beforeunload',unloading);
    return()=>{mounted.current=false;held.current=false;holdFinish.current?.(true);void mute();document.removeEventListener('visibilitychange',hidden);window.removeEventListener('beforeunload',unloading);};
  // Capture lifecycle is tied to Practice, never a pending save or a context render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[practiceId]);
  useEffect(()=>{if(!continuousEnabled && active.current)void mute(true);
  // Turning off continuous stops capture, not its queued work.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[continuousEnabled]);
  function pump() {
    while(workers.current<3) {
      const item=captures.current.find(row=>row.status==='captured');if(!item)break;
      item.status='transcribing';workers.current++;publish();void transcribe(item);
    }
  }
  async function beginHold() {
    if(disabled || held.current || captures.current.length>=24)return;
    held.current=true;setHolding(true);setHoldReady(false);setHoldSeconds(0);setError('');
    const resume=active.current;
    let ticket:PracticeActionTicket;
    try{ticket=timeline.reserve(currentContext.current);}catch(e){held.current=false;setHolding(false);setError((e as Error).message);return;}
    await mute(true);
    let mic:MediaStream|undefined,audio:AudioContext|undefined,processor:ScriptProcessorNode|undefined,source:MediaStreamAudioSourceNode|undefined;
    let buffer:HeldVoiceAudio|undefined,done=false;
    let clock:ReturnType<typeof setInterval>|undefined;
    const finish=(cancel=false)=>{
      if(done)return;done=true;held.current=false;clearInterval(clock);
      processor?.disconnect();source?.disconnect();mic?.getTracks().forEach(track=>track.stop());
      const rate=audio?.sampleRate??VOICE_SAMPLE_RATE;void audio?.close();holdFinish.current=null;
      if(mounted.current)setHolding(false);
      const pcm=buffer?.finish(cancel);
      if(!pcm||pcm.length<rate*.2)timeline.discard(ticket);
      else {
        // Same PCM encoder/provider and ordered queue as continuous capture.
        captures.current.push({ticket,samples:pcm,sampleRate:rate,requestId:crypto.randomUUID(),status:'captured',endedAt:Date.now(),explicitEnd:true});publish();pump();
      }
      if(resume&&mounted.current)void start();
    };
    holdFinish.current=finish;
    if(!held.current||!mounted.current){finish(true);return;}
    try {
      mic=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true}});
      if(done||!held.current){mic.getTracks().forEach(track=>track.stop());finish(true);return;}
      audio=new AudioContext();await audio.resume();
      if(done||!held.current){void audio.close();finish(true);return;}
      source=audio.createMediaStreamSource(mic);processor=audio.createScriptProcessor(2048,1,1);
      buffer=new HeldVoiceAudio(audio.sampleRate);
      const silent=audio.createGain();silent.gain.value=0;
      processor.onaudioprocess=event=>{
        if(done)return;
        if(buffer!.append(event.inputBuffer.getChannelData(0))){setError('30-second rep limit reached; the captured rep is processing.');finish();}
      };
      source.connect(processor);processor.connect(silent);silent.connect(audio.destination);
      setHoldReady(true);
      // This clock starts in the pointer-down handler, never during render.
      // eslint-disable-next-line react-hooks/purity
      const began=Date.now();clock=setInterval(()=>{
        const seconds=Math.floor((Date.now()-began)/1000);if(mounted.current)setHoldSeconds(seconds);
        if(seconds>=VOICE_MAX_SECONDS){setError('30-second rep limit reached; the captured rep is processing.');finish();}
      },250);
    }catch{finish(true);if(mounted.current)setError('Microphone could not start. Check permission; manual entry remains available.');}
  }
  function releaseHold(cancel=false){held.current=false;holdFinish.current?.(cancel);holdOrigin.current=null;holdCancelled.current=false;setCancelHold(false);}
  async function transcribe(item:Capture) {
    // Invoked only by capture/retry event workers, never during rendering.
    // eslint-disable-next-line react-hooks/purity
    const started=performance.now();
    try {
      const result=item.transcript?{transcript:item.transcript,confidence:item.confidence??null}:await requestVoiceTranscription({
        request:()=>fetch(`/api/voice/transcribe?practiceId=${encodeURIComponent(practiceId)}&requestId=${item.requestId}`,{
          method:'POST',headers:{'Content-Type':'audio/wav'},body:encodeVoiceWav(item.samples,item.sampleRate??VOICE_SAMPLE_RATE),signal:AbortSignal.timeout(25000),
        }),
        wait:ms=>new Promise(resolve=>setTimeout(resolve,ms)),
        renewRequest:()=>{item.requestId=crypto.randomUUID();},
      });
      item.transcript=result.transcript;item.confidence=result.confidence;
      item.status='waiting';publish();workers.current--;pump();
      if(process.env.NEXT_PUBLIC_VERCEL_ENV==='preview')setQaResults(rows=>[...rows,{sequence:item.ticket.sequence,transcript:result.transcript,transcriptionMs:Math.round(performance.now()-started),completed:false}]);
      // Only the immediately adjacent capture can supply missing details. A
      // manual action or another pitch between them forbids stitching.
      let predecessor=captures.current.find(row=>row.ticket.sequence===item.ticket.sequence-1);
      while(mounted.current && predecessor && predecessor.status!=='review' && predecessor.status!=='failed') {
        if(item.absorbed)return;
        await new Promise(resolve=>setTimeout(resolve,25));
        predecessor=captures.current.find(row=>row.ticket.sequence===item.ticket.sequence-1);
      }
      if(item.absorbed)return;
      const {text:assembled,confidence,merged}=item.assembly??await assembleVoiceFragments(item,{
        next:sequence=>captures.current.find(row=>row.ticket.sequence===sequence),speaking:()=>speech.current,
        interrupted:()=>timeline.pending>captures.current.length+(speech.current?1:0),active:()=>mounted.current,
        now:()=>Date.now(),wait:()=>new Promise(resolve=>setTimeout(resolve,25)),provisional:text=>{if(mounted.current)setProvisional(text);},
      });
      // Mutable worker record; publish() exposes separate immutable UI snapshots.
      // eslint-disable-next-line react-hooks/immutability
      item.assembly={text:assembled,confidence,merged};
      if(predecessor?.status==='review' && item.ticket.capturedAt-predecessor.ticket.capturedAt<=15000
        && detail.current && await detail.current(result.transcript,result.confidence)) {
        timeline.discard(item.ticket);
        captures.current=captures.current.filter(row=>row!==item);publish();
        if(process.env.NEXT_PUBLIC_VERCEL_ENV==='preview')setQaResults(rows=>rows.map(row=>row.sequence===item.ticket.sequence?{...row,completed:true}:row));
        return;
      }
      const saved=await timeline.execute(item.ticket,async()=>{
        // A predecessor can finish its network write before React publishes the
        // reconciled context. Never treat that brief busy window as a discard.
        await new Promise(resolve=>setTimeout(resolve,0));
        while(mounted.current && !ready.current())await new Promise(resolve=>setTimeout(resolve,25));
        if(!mounted.current)throw new Error('Voice view closed with an unresolved capture.');
        while(mounted.current&&!item.discardRequested){
          item.status='review';publish();
          try {
            const accepted=await handler.current(assembled,typeof confidence==='number'?confidence:null,item.requestId);
            if(accepted&&mounted.current)setError('');
            return accepted;
          }catch(e){
            item.status='failed';item.error=e instanceof Error?e.message:'Event not saved. Retry or discard.';publish();
            await new Promise<void>(resolve=>{item.retryCommit=resolve;});item.retryCommit=undefined;
          }
        }
        return false;
      });
      for(const fragment of merged)timeline.discard(fragment.ticket);
      captures.current=captures.current.filter(row=>row!==item&&!merged.includes(row));publish();
      if(process.env.NEXT_PUBLIC_VERCEL_ENV==='preview')setQaResults(rows=>rows.map(row=>row.sequence===item.ticket.sequence?{...row,completed:true,saved,assembledTranscript:assembled}:merged.some(fragment=>fragment.ticket.sequence===row.sequence)?{...row,completed:true,saved,mergedInto:item.ticket.sequence}:row));
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
          captures.current.push({ticket,samples,requestId:crypto.randomUUID(),status:'captured',endedAt:Date.now()});publish();pump();
          if(captures.current.length>=24){setError('24 Voice phrases pending. Capture paused; all captured phrases retained.');void mute();}
        },
      });
      if(token!==generation.current){await detector.destroy();return;}
      vad.current=detector;active.current=true;await detector.start();setState('listening');
      if(source){source.onended=()=>{setTimeout(()=>void mute(),1200);};await playback.current?.resume();source.start();}
    } catch {await mute();setError('Microphone could not start. Check permission; manual entry remains available.');}
  }
  const reviews=items.filter(item=>item.status==='review').length;
  return <div className={styles.capture}>
    {continuousEnabled&&<button type="button" className="secondary-button" disabled={holding||(disabled&&state!=='listening')} onClick={()=>{if(state==='listening'||state==='starting')void mute();else void start();}}>
      {state==='listening'?<MicOff size={18}/>:<Mic size={18}/>}{state==='listening'?'Mute':state==='starting'?'Cancel microphone':state==='off'?'Start listening':'Unmute'}
    </button>}
    <button type="button" className={styles.holdButton} aria-label="Hold to Talk" aria-pressed={holding} disabled={disabled&&!holding}
      onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();holdOrigin.current={x:event.clientX,y:event.clientY};holdCancelled.current=false;setCancelHold(false);event.currentTarget.setPointerCapture(event.pointerId);void beginHold();}}
      onPointerMove={event=>{const origin=holdOrigin.current;if(!origin)return;const cancel=Math.hypot(event.clientX-origin.x,event.clientY-origin.y)>90;holdCancelled.current=cancel;setCancelHold(cancel);}}
      onPointerUp={()=>releaseHold(holdCancelled.current)} onPointerCancel={()=>releaseHold(true)} onLostPointerCapture={()=>{if(held.current)releaseHold(true);}}
      onContextMenu={event=>event.preventDefault()}
      onKeyDown={event=>{if(event.key==='Escape')releaseHold(true);else if((event.key===' '||event.key==='Enter')&&!event.repeat){event.preventDefault();void beginHold();}}}
      onKeyUp={event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();releaseHold();}}}>
      <Mic size={18}/>{holding?(cancelHold?'Release to Cancel':holdReady?'Release to Process':'Starting mic…'):'Hold to Talk'}
    </button>
    {state!=='off'&&<button type="button" className="icon-button" aria-label="End Voice session" title="End Voice session" onClick={()=>void mute(true)}><Square size={18}/></button>}
    <span role="status">{holding?(holdReady?`Recording Rep${holdSeconds>=25?` · ${30-holdSeconds}s left`:''}`:'Preparing microphone'):provisional?'Listening for details…':`${state==='listening'?'Voice Live':state==='starting'?'Starting microphone':'Voice muted'} · ${reviews?`${reviews} needs review${items.length>reviews?` · ${items.length-reviews} waiting`:''}`:items.length?`${items.length} processing`:'Caught up'}`}</span>
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

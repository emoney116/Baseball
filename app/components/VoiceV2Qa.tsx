"use client";
import {useLayoutEffect,useRef,useState} from 'react';
import {Send,Check,Undo2} from 'lucide-react';
import {TypedVoiceV2,parseV2Batch,v2Action} from '../lib/voiceV2Tools';
import type {VoiceContext} from '../lib/voiceIntent';
import type {BpDraft} from '../lib/liveBp';

export function VoiceV2Qa({context,onChange}:{context:VoiceContext;onChange:(context:VoiceContext,draft:BpDraft|undefined,label:string)=>void}) {
  const session=useRef<TypedVoiceV2|null>(null),sequence=useRef(0),chain=useRef(Promise.resolve());
  const latest=useRef(context);
  useLayoutEffect(()=>{latest.current=context;},[context]);
  const [enabled,setEnabled]=useState(false),[text,setText]=useState(''),[status,setStatus]=useState('QA simulation');
  const [snapshot,setSnapshot]=useState<{draft?:BpDraft;reviews:TypedVoiceV2['reviews'];waiting:TypedVoiceV2['waiting']}>({reviews:[],waiting:[]});
  const publish=()=>{const s=session.current;if(s)setSnapshot({draft:s.openPlay?structuredClone(s.openPlay.draft):undefined,reviews:[...s.reviews],waiting:[...s.waiting]});};
  const update=()=>{
    const s=session.current!;
    const last=s.commits.at(-1)?.draft;
    onChange(s.context,s.openPlay?.draft,[last?.pitchType,last?.outcome,last?.battedBall,last?.ev?`${last.ev} EV`:null,last?.result].filter(Boolean).join(' · '));
    publish();
  };
  const send=()=>{
    const captured=text.trim();if(!captured)return;setText('');
    const id=++sequence.current,at=Date.now();
    chain.current=chain.current.then(async()=>{
      const s=session.current;if(!s)return;
      const signature=(value:VoiceContext)=>JSON.stringify([value.settings,value.state]);
      if(signature(latest.current)!==signature(s.context)){
        if(s.openPlay){s.reviews.push({sequence:id,text:captured,reason:'Manual context changed during developing play'});publish();return;}
        s.context=structuredClone(latest.current);s.commits=[];s.version++;
      }
      const captureSignature=signature(latest.current);setStatus('Processing play…');
      const result=await s.receive(captured,id,at,async(transcript,current)=>{
        const response=await fetch('/api/voice/v2-qa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:transcript,context:current.context,openPlay:current.openPlay,commits:current.commits.slice(-3)})});
        if(!response.ok)throw new Error('Reasoning unavailable; resolve in Review');
        const data=await response.json();
        if(session.current!==s||signature(latest.current)!==captureSignature)throw new Error('Manual context changed while reasoning; Review required');
        return {batch:parseV2Batch(data.batch),latencyMs:data.latencyMs};
      });
      if(session.current!==s)return;
      setStatus(`${result.status} · ${result.route} · ${Math.round(result.latencyMs)} ms`);
      if(signature(latest.current)===captureSignature)update();else publish();
    }).catch(()=>setStatus('Capture buffer full; resolve Review before continuing'));
  };
  return <details><summary>Voice V2 · Local QA</summary>
    <label><input type="checkbox" checked={enabled} onChange={event=>{setEnabled(event.target.checked);session.current=event.target.checked?new TypedVoiceV2(context,true):null;setSnapshot({reviews:[],waiting:[]});}}/> Typed-tool simulation</label>
    {enabled&&<>
      <form onSubmit={event=>{event.preventDefault();send();}} style={{display:'flex',gap:8}}>
        <input aria-label="QA transcript" value={text} maxLength={2000} onChange={event=>setText(event.target.value)} style={{minWidth:0,flex:1}}/>
        <button type="submit" aria-label="Process transcript" title="Process transcript"><Send size={18}/></button>
      </form>
      <p role="status">{status}</p>
      {snapshot.draft&&<p>Listening… {snapshot.draft.battedBall} · {snapshot.draft.ev??'—'} EV · {snapshot.draft.result??'—'}</p>}
      <button type="button" title="Complete developing play" onClick={()=>{session.current?.flush(++sequence.current,Date.now(),true);update();}}><Check size={16}/> Complete play</button>
      <button type="button" title="Undo simulation action" onClick={()=>{session.current?.apply([v2Action('undo_last_action')],++sequence.current,Date.now());update();}}><Undo2 size={16}/> Undo</button>
      {Boolean(snapshot.reviews.length)&&<details><summary>{snapshot.reviews.length} needs review · {snapshot.waiting.length} waiting</summary>{snapshot.reviews.map(item=><p key={item.sequence}>{item.text}: {item.reason}</p>)}{snapshot.waiting.map(item=><p key={item.sequence}>Waiting: {item.text}</p>)}</details>}
    </>}
  </details>;
}

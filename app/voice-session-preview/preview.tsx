"use client";
import { useState } from 'react';
import { VoiceEntry } from '../components/VoiceEntry';
import { initialBpSettings, initialBpState, type BpSettings } from '../lib/liveBp';
import {LiveBpConsole} from '../components/LiveBpConsole';
import {BpSegments} from '../components/LiveBpControls';
import type {Player} from '../types';
const qaPlayers:Player[]=['Taylor','Morgan','Reese'].map((name,index)=>({id:`00000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`,name,jerseyNumber:index+1,primaryPosition:'SS',bats:'R',throws:'R',graduationYear:2027,avatarColor:'#a0162b',isPitcher:true,isHitter:true,createdAt:'2026-09-21',updatedAt:'2026-09-21'}));
export function VoiceSessionPreview({typedEnabled=false}:{typedEnabled?:boolean}) {
  const [mode,setMode]=useState('V1');
  const [settings,setSettings] = useState<BpSettings>({...initialBpSettings('h'),velocity:true,pitchType:'4-Seam',pitchMode:'MULTI'});
  const [count,setCount] = useState(0);
  return <main style={{maxWidth:1000,margin:'auto',padding:16}}>
    {typedEnabled&&<BpSegments label="QA Voice version" value={mode} onChange={setMode} options={[{value:'V1',label:'V1'},{value:'V2',label:'V2'}]}/>}
    {mode==='V2'?<LiveBpConsole visualPreview active practiceId="10000000-0000-4000-8000-000000000076" players={qaPlayers} onExit={()=>setMode('V1')} onSaved={()=>{}} onAsk={()=>{}} charts={()=>null} createPlayer={()=>null} pitchLocationControl={()=>null} sheet={(title,close,children)=><section role="dialog" aria-label={title}><button onClick={close}>Close</button>{children}</section>}/>:<>
    <h1>Voice QA</h1><output aria-label="Saved events">{count}</output>
    <VoiceEntry practiceId="10000000-0000-4000-8000-000000000071"
      context={{domain:'live-bp',settings,state:initialBpState(),roster:[{id:'h',aliases:['Mylo White','Mylo']},{id:'p',aliases:['Darren Adams','Darren']}],bats:'R'}}
      onSave={async()=>{setCount(n=>n+1);return true;}}
      onCommand={async(command,eventId,event)=>{void eventId;setSettings(s=>({...s,...command.patch}));if(event)setCount(n=>n+1);return true;}}
      onEdit={()=>{}} onUndo={()=>setCount(n=>Math.max(0,n-1))}/>
    </>}
  </main>;
}

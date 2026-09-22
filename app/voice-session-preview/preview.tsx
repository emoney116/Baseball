"use client";
import { useState } from 'react';
import { VoiceEntry } from '../components/VoiceEntry';
import { initialBpSettings, initialBpState, type BpSettings } from '../lib/liveBp';
export function VoiceSessionPreview() {
  const [settings,setSettings] = useState<BpSettings>({...initialBpSettings('h'),velocity:true,pitchType:'4-Seam',pitchMode:'MULTI'});
  const [count,setCount] = useState(0);
  return <main style={{maxWidth:1000,margin:'auto',padding:16}}>
    <h1>Voice QA</h1><output aria-label="Saved events">{count}</output>
    <VoiceEntry practiceId="10000000-0000-4000-8000-000000000071"
      context={{domain:'live-bp',settings,state:initialBpState(),roster:[{id:'h',aliases:['Mylo White','Mylo']},{id:'p',aliases:['Darren Adams','Darren']}],bats:'R'}}
      onSave={async()=>{setCount(n=>n+1);return true;}}
      onCommand={async(command,eventId,event)=>{void eventId;setSettings(s=>({...s,...command.patch}));if(event)setCount(n=>n+1);return true;}}
      onEdit={()=>{}} onUndo={()=>setCount(n=>Math.max(0,n-1))}/>
  </main>;
}

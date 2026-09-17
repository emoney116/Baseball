import { correctedVoiceText, appendVoiceFragment, isVoiceDetailFragment } from './voiceSession.ts';

export const VOICE_CONTINUATION_MS = 2400;
export const VOICE_MAX_FRAGMENTS = 8;
const contact = /\b(?:line drive|ground ball|fly ball|pop up|bunt)\b/;
const outcome = /\b(?:single|double|triple|home run|out|reached on error|sacrifice)\b/;
const newPitch = /\b(?:fastball|slider|curveball|changeup|cutter|sinker|whiff|foul|called strike|ball)\b/;

export function likelyVoiceContinuation(text:string):boolean {
  const value=correctedVoiceText(text);
  return contact.test(value) && !outcome.test(value);
}

export function voiceFragmentRelation(pending:string,next:string):'detail'|'boundary'|'flush' {
  const value=correctedVoiceText(next);
  if(/^(?:that's it|that is it|end rep|next|next pitch|that's the play|that is the play)$/.test(value))return 'flush';
  if(!contact.test(correctedVoiceText(pending)))return 'boundary';
  if(isVoiceDetailFragment(value))return 'detail';
  if(/^(?:actually|make that) (?:\d{2,3})(?: exit(?: velo(?:city)?)?)?$/.test(value) && /\b(?:exit|ev)\b/.test(pending))return 'detail';
  if(newPitch.test(value) || contact.test(value) || /\b(?:hitting|pitching|batting|playing|count|undo)\b/.test(value))return 'boundary';
  if(/^(?:(?:single|double|triple|out) )?(?:the )?runner\b/.test(value)
    || /^(?:the )?(?:shortstop|first baseman|second baseman|third baseman|catcher|(?:left|right|center) field(?:er)?)\b/.test(value)
    || /^.+? (?:scores|scored)(?:\b|$)/.test(value))return 'detail';
  return 'boundary';
}

export function mergeVoiceDetail(pending:string,next:string):string {
  const correction=correctedVoiceText(next).match(/^(?:actually|make that) (\d{2,3})(?: exit(?: velo(?:city)?)?)?$/);
  if(correction) {
    const matches=[...pending.matchAll(/\b(\d{2,3}) (?:exit(?: velo(?:city)?)?|ev)\b/gi)];
    if(matches.length===1)return pending.replace(matches[0][0],`${correction[1]} exit`);
  }
  return appendVoiceFragment(pending,next);
}

export type VoiceAssemblyFragment = {ticket:{sequence:number;capturedAt:number};endedAt:number;explicitEnd?:boolean;transcript?:string;confidence?:number|null;absorbed?:boolean;status:string};

/** Capture order, not provider completion order, determines continuation eligibility. */
export async function assembleVoiceFragments<T extends VoiceAssemblyFragment>(first:T, options:{
  next:(sequence:number)=>T|undefined; speaking:()=>{sequence:number;capturedAt:number}|null;
  interrupted:()=>boolean; active:()=>boolean; wait:()=>Promise<void>; now:()=>number;
  provisional:(text:string)=>void;
}) {
  let text=first.transcript??'',confidence=first.confidence??null,tail=first;
  const merged:T[]=[];
  if(first.explicitEnd || !likelyVoiceContinuation(text))return {text,confidence,merged};
  options.provisional(text);
  for(let count=1;count<VOICE_MAX_FRAGMENTS;count++) {
    let next:T|undefined;
    while(options.active()) {
      next=options.next(tail.ticket.sequence+1);
      const speech=options.speaking();
      const speaking=speech?.sequence===tail.ticket.sequence+1 && speech.capturedAt-tail.endedAt<=VOICE_CONTINUATION_MS;
      if(next || (!speaking && options.now()-tail.endedAt>=VOICE_CONTINUATION_MS) || options.interrupted())break;
      await options.wait();
    }
    if(!next || next.explicitEnd || next.ticket.capturedAt-tail.endedAt>VOICE_CONTINUATION_MS)break;
    while(options.active() && !next.transcript && next.status!=='failed')await options.wait();
    if(!next.transcript)break;
    const relation=voiceFragmentRelation(text,next.transcript);
    if(relation==='boundary')break;
    // Reaching a safe text limit flushes this rep; later audio remains queued.
    if(relation==='detail') {try{text=mergeVoiceDetail(text,next.transcript);}catch{break;}}
    next.absorbed=true;merged.push(next);tail=next;
    confidence=typeof confidence==='number'&&typeof next.confidence==='number'?Math.min(confidence,next.confidence):null;
    options.provisional(text);
    if(relation==='flush')break;
  }
  options.provisional('');
  return {text,confidence,merged};
}

import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {interpretVoice,canFastSaveVoice} from '../app/lib/voiceIntent.ts';
import {parseVoiceCommand} from '../app/lib/voiceCommands.ts';
import {voiceTokenConfidence} from '../app/lib/voiceTranscriptionConfidence.ts';
import {initialBpSettings,initialBpState} from '../app/lib/liveBp.ts';
import {VoiceV2Replay} from '../app/lib/voiceV2Replay.ts';
const dir=process.argv[2],read=n=>JSON.parse(readFileSync(join(dir,n),'utf8'));
const roster=read('participant-roster.json').map(p=>({id:p.id,aliases:[p.first_name,`${p.first_name} ${p.last_name}`]}));
// Expected event counts were annotated from the held-out RAW text, before reading
// model proposals. They are text-level targets, not independent audio truth.
const targets=[{index:7,units:['Ball','foul','fly ball right field, triple.'],pitches:3,context:0},
 {index:19,units:['I need a pitch, bro.'],pitches:0,context:0},
 {index:31,units:['This is just fastball.'],pitches:null,context:null},
 {index:43,units:['Ball one.','Fly ball, center field, out.',"We'll get there."],pitches:2,context:0},
 {index:55,units:['Ground ball third base out.','Levi is hitting.'],pitches:1,context:1},
 {index:67,units:['Ground ball shortstop.'],pitches:1,context:0}];
const results=targets.map(target=>{
 const raw=read(`raw-${String(target.index).padStart(3,'0')}.json`);
 const ctx={domain:'live-bp',roster,settings:{...initialBpSettings(roster[0].id),pitchMode:'ONE',pitchType:'4-Seam',ev:true,spray:true},state:initialBpState()};
 const v1=target.units.map((text,i)=>{
  const command=parseVoiceCommand(text,roster,ctx.settings,ctx.state);
  const confidence=voiceTokenConfidence(raw.rawProviderResponse.logprobs);
  const parsed=interpretVoice(text,ctx,`holdout-${i}`,confidence);
  return {text,command,confidence,acousticScope:'entire original chunk, not independent short capture',draft:parsed.draft,unresolved:parsed.unresolvedFields,auto:command?.kind==='context'&&!command.problems.length?true:canFastSaveVoice(parsed)};
 });
 const proposed=read(`v2-reasoning-r2-holdout-${target.index}.json`);
 const v2=new VoiceV2Replay(ctx,true);
 proposed.proposal.segments.forEach((s,i)=>v2.receive({sequence:i,at:raw.startSeconds*1000+i,text:s.normalized,intent:s.intent,alternatives:s.alternatives,transcription:'clear'}));
 v2.flush();
 return {target,v1,v2:{receipts:v2.receipts,pitches:v2.committed.length,context:v2.receipts.filter(r=>r.reason==='Validated context command').length,latencyMs:proposed.latencyMs,acousticAssumption:'clear for semantic-only simulation; not measured confidence'},countTargetMet:target.pitches===null?null:v2.committed.length===target.pitches&&v2.receipts.filter(r=>r.reason==='Validated context command').length===target.context};
});
writeFileSync(join(dir,'holdout-comparison.json'),JSON.stringify({caveat:'NOT live accuracy or no-intervention benchmark. Chunk acoustics differ from live capture; V2 clear-speech assumption is unverified. Count matches do not prove field correctness.',results},null,2));
console.log(JSON.stringify(results.map(r=>({index:r.target.index,expectedPitches:r.target.pitches,V2Pitches:r.v2.pitches,expectedContext:r.target.context,V2Context:r.v2.context,countTargetMet:r.countTargetMet,review:r.v2.receipts.filter(s=>s.status==='review').map(s=>s.reason)})),null,2));

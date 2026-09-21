import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {parseEnv} from 'node:util';
import {TypedVoiceV2} from '../app/lib/voiceV2Tools.ts';
import {reasonVoiceV2} from '../app/lib/voiceV2Reasoning.ts';
import {interpretVoice,canFastSaveVoice} from '../app/lib/voiceIntent.ts';
import {parseVoiceCommand} from '../app/lib/voiceCommands.ts';
import {initialBpSettings,initialBpState} from '../app/lib/liveBp.ts';

const [dir,envPath,mode='prepare']=process.argv.slice(2);
if(process.env.CLUBHOUSE_VOICE_V2_QA!=='true')throw new Error('Explicit QA flag required');
const read=name=>JSON.parse(readFileSync(join(dir,name),'utf8'));
const freezePath=join(dir,'typed-v2-frozen-manifest.json');
const hashes=()=>Object.fromEntries(['app/lib/voiceV2Tools.ts','app/lib/voiceV2Reasoning.ts'].map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]));
if(mode==='prepare'){
  if(existsSync(freezePath))throw new Error('Frozen manifest already exists; do not overwrite holdout');
  writeFileSync(freezePath,JSON.stringify({createdAt:new Date().toISOString(),development:[0,1,5,14,25,38,50,63],holdout:[9,21,33,45,57,69],hashes:hashes(),scope:'Text-level simulation, not original live microphone/transcription accuracy. Starting state is controlled, not reconstructed.'},null,2));
  console.log('Frozen before opening fresh holdout');
}else{
  const manifest=read('typed-v2-frozen-manifest.json');
  if(JSON.stringify(manifest.hashes)!==JSON.stringify(hashes()))throw new Error('Implementation changed after freeze');
  const targets=read('typed-v2-targets.json');
  const env=parseEnv(readFileSync(envPath,'utf8'));
  const roster=read('participant-roster.json').map(p=>({id:p.id,aliases:[p.first_name,`${p.first_name} ${p.last_name}`]}));
  for(const target of targets.filter(t=>t.split===mode)){
    const output=join(dir,`typed-v2-${mode}-${target.index}.json`);if(existsSync(output))continue;
    const ctx={domain:'live-bp',roster,settings:{...initialBpSettings(roster[0].id),mode:'AB',source:'COACH',pitchMode:'ONE',pitchType:'4-Seam',ev:true,spray:true},state:{...initialBpState(),countKnown:true,situationKnown:true}};
    const s=new TypedVoiceV2(ctx,true),rows=[];
    for(const [i,text] of target.units.entries()){
      const began=performance.now();
      const command=parseVoiceCommand(text,roster,ctx.settings,ctx.state),intent=interpretVoice(text,ctx,`replay-${i}`,1);
      const v1={auto:command?.kind==='context'&&!command.problems.length?true:canFastSaveVoice(intent),command,draft:intent.draft,unresolved:intent.unresolvedFields,latencyMs:performance.now()-began};
      let provider;
      const before=s.commits.length;
      const result=await s.receive(text,i,target.index*30000+i*3000,async(t,session)=>{provider=await reasonVoiceV2(t,session,env.OPENAI_VOICE_API_KEY||env.OPENAI_API_KEY);return provider;});
      rows.push({text,v1,v2:result,provider,commits:s.commits.slice(before),provisional:s.openPlay?.draft,review:s.reviews.at(-1)});
    }
    if(!s.reviews.length)s.flush(target.units.length,target.index*30000+29000,true);
    writeFileSync(output,JSON.stringify({target,assumptions:'Clear transcript semantics; controlled starting hitter/source/empty bases. No production writes. V1 isolated clause policy; V2 ordered state. Not an end-to-end V1 audio replay.',rows,final:{commits:s.commits,openPlay:s.openPlay,reviews:s.reviews,waiting:s.waiting,context:s.context}},null,2));
    console.log(JSON.stringify({index:target.index,split:mode,routes:rows.map(r=>r.v2.route),status:rows.map(r=>r.v2.status),latency:rows.map(r=>Math.round(r.v2.latencyMs)),commits:s.commits.length,reviews:s.reviews.length}));
  }
}

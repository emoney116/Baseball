import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {getSprayLane} from '../app/lib/sprayChart.ts';
const dir=process.argv[2];
const read=n=>JSON.parse(readFileSync(join(dir,n),'utf8'));
const clips=readdirSync(dir).filter(n=>/^typed-v2-(development|holdout)-\d+\.json$/.test(n)).map(read);
const roster=read('participant-roster.json');
const median=values=>{const a=[...values].sort((a,b)=>a-b);return a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2;};
const matches=(draft,expected)=>draft&&Object.entries(expected.draft??{}).every(([key,value])=>draft[key]===value)&&(!expected.spray||(expected.spray==='SS'?draft.position==='SS':getSprayLane(draft.spray??{x:.5,y:.9})?.index===({LF:0,CF:2,RF:4})[expected.spray]));
const holdout=clips.filter(c=>c.target.split==='holdout').map(c=>{
  const expected=c.target.expected[0],v1=c.rows[0].v1,pitches=c.final.commits.filter(x=>x.kind==='pitch');
  const player=expected.playerAlias?roster.filter(p=>p.first_name.toLowerCase()===expected.playerAlias.toLowerCase()):[];
  const auto1=v1.auto,auto2=c.final.commits.length>0&&!c.final.reviews.length;
  const correct1=auto1&&(expected.kind==='pitch'?matches(v1.draft,expected):expected.kind==='context'&&player.length===1&&v1.command?.patch?.hitterId===player[0].id);
  const correct2=auto2&&(expected.kind==='pitch'?pitches.length===1&&matches(pitches[0].draft,expected):expected.kind==='context'&&player.length===1&&c.final.context.settings.hitterId===player[0].id&&pitches.length===0);
  return {index:c.target.index,kind:expected.kind,v1:{auto:auto1,correct:!!correct1,review:!auto1},v2:{auto:auto2,correct:!!correct2,review:c.final.reviews.length>0,pitches:pitches.length}};
});
const rows=clips.flatMap(c=>c.rows);
const summary={scope:'Frozen text-level, controlled-context replay. Not microphone/transcription/live-save accuracy. Manual clause segmentation is shared by both paths. No historical writes.',clips:clips.length,clauses:rows.length,holdout,
  latency:{fastN:rows.filter(r=>r.v2.route==='fast').length,fastMedianMs:median(rows.filter(r=>r.v2.route==='fast').map(r=>r.v2.latencyMs)),reasoningN:rows.filter(r=>r.v2.route==='reasoning').length,reasoningMedianMs:median(rows.filter(r=>r.v2.route==='reasoning').map(r=>r.v2.latencyMs)),databaseSave:'NOT MEASURED',screenSync:'NOT MEASURED'},
  usage:rows.reduce((s,r)=>({input:s.input+(r.provider?.usage?.input_tokens??0),output:s.output+(r.provider?.usage?.output_tokens??0)}),{input:0,output:0}),
  recommendation:'KEEP V1 AND IMPROVE. Typed V2 fails zero false-action gate. Do not promote.'};
writeFileSync(join(dir,'typed-v2-comparison.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));

// Executes repository read plans over an isolated PostgREST transport with private exported rows.
// No credentials, network, writes or historical mutation. Counts JSON bodies, not billed wire bytes.
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {createClient} from '@supabase/supabase-js';
import {readAllRows} from '../app/lib/readAllRows.ts';
import {readPracticeRunnerActions} from '../app/lib/practiceRunnerActions.ts';
import {currentStartedPractice} from '../app/lib/practiceStart.ts';
const dir=process.argv[2];
const read=n=>JSON.parse(readFileSync(join(dir,n),'utf8'));
const raw=read('canonical-readonly.json'),support=read('supporting-readonly.json'),roster=read('participant-roster.json');
const practice=raw.practice;
const fixtures={practices:[practice],practice_sessions:support.sessions,hitting_events:[],pitch_events:support.pitch_events??[],defense_events:raw.defense??[],players:roster.map(p=>({...p,organization_id:practice.organization_id,active:true})),player_team_memberships:support.memberships,
  read_practice_runner_actions:(raw.actions??[]).filter(a=>a.kind==='runner'&&!a.undone).map(a=>({id:a.id,round_id:a.round_id,version:a.version,created_at:a.created_at,practice_id:practice.id,movement:{from:a.detail.from,to:a.detail.to,outcome:a.detail.outcome??'safe',reason:a.detail.reason,runnerId:a.detail.runnerId??a.before_state?.runnerIds?.[a.detail.from]??null,pitchId:a.detail.pitchId??null,source:a.detail.source??null}}))};
let calls=[];
const client=createClient('http://isolated-qa.invalid','fixture-only',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input,init)=>{
  const url=new URL(String(input));const table=url.pathname.split('/').at(-1);
  let rows=structuredClone(fixtures[table]??[]);
  for(const [key,value] of url.searchParams){
    if(['select','order','limit','offset'].includes(key))continue;
    if(value.startsWith('eq.'))rows=rows.filter(r=>String(r[key])===value.slice(3));
    if(value.startsWith('gt.'))rows=rows.filter(r=>String(r[key])>value.slice(3));
    if(value.startsWith('in.(')){const ids=value.slice(4,-1).split(',').map(x=>x.replaceAll('"',''));rows=rows.filter(r=>ids.includes(String(r[key])));}
  }
  if(url.searchParams.get('order')?.startsWith('id'))rows.sort((a,b)=>a.id.localeCompare(b.id));
  const offset=Number(url.searchParams.get('offset')??0),limit=Number(url.searchParams.get('limit')??rows.length);
  rows=rows.slice(offset,offset+limit);
  const accept=new Headers(init?.headers).get('accept');
  const body=JSON.stringify(accept?.includes('vnd.pgrst.object')?rows[0]??null:rows);
  calls.push({table,method:init?.method??'GET',bytes:Buffer.byteLength(body),rows:rows.length});
  return new Response(body,{status:200,headers:{'content-type':'application/json'}});
}}});
const source=readFileSync('app/data/supabaseRepository.ts','utf8');
const context={exports:{},console,require:()=>({createClient:()=>client,readAllRows,readPracticeRunnerActions,currentStartedPractice,APP_NAME:'Clubhouse 9',exactRosterWorkingData:d=>d}),fetch:async()=>({ok:true,json:async()=>({organizations:[],teams:[]})})};
vm.runInNewContext(ts.transpileModule(source+'\nexport {loadAppData};',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
const foundation={organizationId:practice.organization_id,teamId:practice.team_id,seasonId:practice.season_id,teamContext:{profile:{id:'isolated'},availableTeams:[]}};
const results=[];
for(const count of [1,10,50,100])for(const mode of ['workspace','practice']) {
  calls=[];
  for(let n=1;n<=count;n++) {
    // Use real row sizes, cycling only in simulated state for the 100-event estimate.
    fixtures.hitting_events=Array.from({length:n},(_,i)=>({...raw.hitting[i%raw.hitting.length],id:`qa-${String(i).padStart(5,'0')}`}));
    if(mode==='workspace')await context.exports.loadAppData(client,foundation);
    else await context.exports.supabaseAppRepository.loadLiveBpPractice(practice.id);
  }
  results.push({mode,events:count,requests:calls.length,jsonBytes:calls.reduce((s,c)=>s+c.bytes,0),bytesPerEvent:Math.round(calls.reduce((s,c)=>s+c.bytes,0)/count),tables:[...new Set(calls.map(c=>c.table))]});
}
const report={method:'Actual repository + Supabase JS request execution with isolated fixture transport; JSON body bytes only. Excludes auth, save POST/RPC, polling, headers, compression and other-team/history data. Not a production billing measurement.',results};
writeFileSync(join(dir,'egress-read-plan.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));

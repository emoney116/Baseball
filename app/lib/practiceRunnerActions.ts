import type { SupabaseClient } from '@supabase/supabase-js';
import type { HittingEvent } from '../types.ts';

export type PracticeRunnerAction = {
  id:string; practiceId:string; roundId:string; version:number; createdAt:string;
  from:number; to:number; outcome:'safe'|'out'; reason:string;
  runnerId?:string; pitchId?:string; source?:string;
};
export type RunnerPrimitive = {
  id:string; practiceId:string; roundId?:string; pitchId?:string;
  runnerId?:string; from:string; to:string; reason?:string;
};

export async function readPracticeRunnerActions(client:SupabaseClient, practiceIds:string[]):Promise<PracticeRunnerAction[]> {
  const result:PracticeRunnerAction[]=[];
  for(let start=0;start<practiceIds.length;start+=100) {
    for(let offset=0;;offset+=1000) {
      const {data,error}=await client.rpc('read_practice_runner_actions',{practice_ids:practiceIds.slice(start,start+100)}).order('id').range(offset,offset+999);
      if(error)throw new Error('Runner Analytics unavailable: '+error.message);
      result.push(...(data??[]).map(mapPracticeRunnerAction));
      if(!data||data.length<1000)break;
    }
  }
  return result;
}

export function mapPracticeRunnerAction(row:{id:string;practice_id:string;round_id:string;version:number;created_at:string;movement:Record<string,unknown>}):PracticeRunnerAction {
  const m=row.movement;
  return {id:row.id,practiceId:row.practice_id,roundId:row.round_id,version:row.version,createdAt:row.created_at,
    from:Number(m.from),to:Number(m.to),outcome:m.outcome==='out'?'out':'safe',reason:String(m.reason??''),
    runnerId:typeof m.runnerId==='string'?m.runnerId:undefined,pitchId:typeof m.pitchId==='string'?m.pitchId:undefined,
    source:typeof m.source==='string'?m.source:undefined};
}

// A linked action duplicates a pitch outcome only with the same runner and destination.
// Anonymous runners use the occupied starting base, never a guessed player identity.
export function projectPracticeRunners(events:HittingEvent[],actions:PracticeRunnerAction[]=[]):RunnerPrimitive[] {
  const result:RunnerPrimitive[]=[];
  const embedded=new Set<string>();
  const key=(p:RunnerPrimitive)=>`${p.practiceId}:${p.roundId}:${p.pitchId}:${p.runnerId??'base:'+p.from}:${p.to}`;
  for(const e of events)for(const [from,to] of Object.entries(e.liveBpContext?.runnerOutcomes??{})) {
    const p:RunnerPrimitive={id:`${e.id}:${from}`,practiceId:e.practiceId,roundId:e.liveBpRoundId,pitchId:e.id,from,to,
      runnerId:from==='batter'?e.hitterId:e.liveBpContext?.before.runnerIds?.[Number(from)],reason:e.liveBpContext?.runnerReasons?.[from]};
    if(!embedded.has(key(p)))result.push(p);
    embedded.add(key(p));
  }
  const seen=new Set<string>();
  for(const a of actions) {
    if(seen.has(a.id)||a.reason==='Pinch runner')continue;
    seen.add(a.id);
    const p:RunnerPrimitive={id:a.id,practiceId:a.practiceId,roundId:a.roundId,pitchId:a.pitchId,runnerId:a.runnerId,
      from:String(a.from),to:a.outcome==='out'?'out':a.to===4?'score':String(a.to),reason:a.reason};
    if(a.pitchId&&embedded.has(key(p)))continue;
    result.push(p);
  }
  return result;
}

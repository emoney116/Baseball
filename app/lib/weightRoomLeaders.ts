import type {Player,WorkoutEntry,WorkoutSession} from '../types.ts';
import {workoutEntryVolume} from './weightRoom.ts';
import {comparableWorkoutResult} from './askClubhouse/workoutProgress.ts';

export function buildWeightRoomLeaders(players:Player[],sessions:WorkoutSession[],entries:WorkoutEntry[]) {
  const roster=new Map(players.filter(p=>!p.archived).map(p=>[p.id,p]));
  const sessionById=new Map(sessions.filter(s=>roster.has(s.playerId)).map(s=>[s.id,s]));
  const seen=new Set<string>();
  const valid=entries.filter(e=>{
    if(seen.has(e.id)||e.status==='Skipped'||!roster.has(e.playerId)||sessionById.get(e.sessionId)?.playerId!==e.playerId)return false;
    seen.add(e.id);return true;
  });
  const athletes=[...roster.values()].map(player=>{
    const rows=valid.filter(e=>e.playerId===player.id);
    const days=new Set(rows.map(e=>sessionById.get(e.sessionId)!.date));
    const loaded=rows.filter(e=>workoutEntryVolume(e)>0);
    return {player,volume:loaded.reduce((s,e)=>s+workoutEntryVolume(e),0),loadedEntries:loaded.length,days:days.size,entries:rows.length};
  });
  const groups=new Map<string,{exercise:string;condition:string;unit:string;rows:{player:Player;value:number;eventId:string}[]}>();
  for(const e of valid) {
    const metric=comparableWorkoutResult(e);
    // Timed test performance is a test result, never estimated maximal strength.
    if(!metric||!e.testConditions)continue;
    const group=groups.get(metric.key)??{exercise:e.exercise,condition:metric.condition,unit:metric.timed?'sec':'reps',rows:[]};
    const old=group.rows.find(r=>r.player.id===e.playerId);
    if(!old)group.rows.push({player:roster.get(e.playerId)!,value:metric.value,eventId:e.id});
    else if(metric.value>old.value){old.value=metric.value;old.eventId=e.id;}
    groups.set(metric.key,group);
  }
  return {
    athletesTrained:athletes.filter(a=>a.entries>0).length,
    recordedDays:new Set(valid.map(e=>sessionById.get(e.sessionId)!.date)).size,
    volume:athletes.reduce((s,a)=>s+a.volume,0),
    volumeLeaders:athletes.filter(a=>a.loadedEntries>=2).sort((a,b)=>b.volume-a.volume||a.player.name.localeCompare(b.player.name)),
    consistencyLeaders:athletes.filter(a=>a.days>=2).sort((a,b)=>b.days-a.days||a.player.name.localeCompare(b.player.name)),
    tests:[...groups.entries()].map(([key,g])=>({key,...g,rows:g.rows.sort((a,b)=>b.value-a.value||a.player.name.localeCompare(b.player.name))})),
  };
}

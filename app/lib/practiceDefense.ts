import type {DefenseEvent,HittingEvent} from '../types.ts';
import type {BpPosition} from './liveBp.ts';

export type DefenseSnapshot={alignment:Partial<Record<BpPosition,string>>;groupId?:string};
export type DefensiveParticipation={position:BpPosition;playerId:string;roles:('field'|'throw'|'receive')[];result:'Clean'|'Error'|'Great Play'|'Missed Rep';errorType?:'Fielding'|'Throwing'|'Decision';attribution:'explicit-player'|'event-alignment'};

export function practiceDefenseRoles(event:DefenseEvent) {
  return event.liveBpContext?.defensiveActions?.filter(action=>action.playerId===event.playerId).flatMap(action=>action.roles);
}

// Only pass an event-time snapshot. An ended round's current settings are not history.
export function resolvePracticeDefender(snapshot:DefenseSnapshot,position?:BpPosition,explicitPlayerId?:string) {
  if(explicitPlayerId) return {playerId:explicitPlayerId,position,attribution:'explicit-player' as const};
  const playerId=position?snapshot.alignment[position]:undefined;
  if(!playerId||Object.values(snapshot.alignment).filter(id=>id===playerId).length!==1)return undefined;
  return {playerId,position,attribution:'event-alignment' as const};
}

export function projectPracticeDefense(hitting:HittingEvent[],persisted:DefenseEvent[]):DefenseEvent[] {
  const result=[...persisted];
  for(const event of hitting)for(const action of event.liveBpContext?.defensiveActions??[]) {
    const id=`${event.id}:defense:${action.playerId}`;
    if(result.some(row=>row.id===id||(row.playerId===action.playerId&&(row.id===event.id||row.idempotencyKey===event.id))))continue;
    result.push({id,practiceId:event.practiceId,sessionId:event.sessionId,playerId:action.playerId,eventNumber:event.eventNumber,
      liveBpRoundId:event.liveBpRoundId,liveBpContext:event.liveBpContext,createdAt:event.createdAt,
      entrySource:event.entrySource,positionWorked:action.position,station:['LF','CF','RF'].includes(action.position)?'Outfield':action.position==='C'?'Catching':action.position==='P'?'PFP':'Infield',
      outcome:action.result,result:action.result,errorType:action.errorType,
      coachNote:`Derived from event-time defensive participation (${action.attribution}).`,
    });
  }
  return result;
}

import { BP_POSITIONS, validateBpState, type BpPosition, type BpSettings, type BpState } from './liveBp.ts';

export type BpDefenseRep = {position:BpPosition;result:'Clean'|'Error'|'Missed Rep'|'Great Play';errorType?:'Fielding'|'Throwing'|'Decision';lastPlay?:boolean};

/** A fielding-only action never fabricates contact, a pitch, or runner movement. */
export function buildBpDefenseRep(settings:BpSettings,state:BpState,rep:BpDefenseRep) {
  validateBpState(state);
  if(!rep || !BP_POSITIONS.includes(rep.position) || !['Clean','Error','Missed Rep','Great Play'].includes(rep.result)
    || (rep.errorType!==undefined && !['Fielding','Throwing','Decision'].includes(rep.errorType))) throw new Error('Choose a defensive position and result.');
  const playerId=settings.alignment[rep.position];
  if(!playerId)throw new Error('Assign a fielder to this position.');
  return {stateBefore:state,lastPlay:rep.lastPlay===true,defense:{player_id:playerId,position_worked:rep.position,
    station:['LF','CF','RF'].includes(rep.position)?'Outfield':rep.position==='C'?'Catching':rep.position==='P'?'PFP':'Infield',
    outcome:rep.result,result:rep.result,error_type:rep.result==='Error'?rep.errorType:undefined,
    rep_type:null},context:{standaloneDefense:true,before:state,after:state,source:settings.source}};
}

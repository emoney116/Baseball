import type {HittingEvent} from '../types.ts';
import {projectPracticeRunners,type PracticeRunnerAction} from './practiceRunnerActions.ts';

export const PRACTICE_BATTING_METRICS = ['pa','ab','hits','singles','doubles','triples','homeRuns','walks','hitByPitch','strikeouts','outs','xbh','totalBases','runs','rbi','sacrificeFlies','sacrificeBunts','reachedOnError','fieldersChoice','runnerAdvances','runnerOuts','stolenBases','caughtStealing','stolenBaseAttempts','avg','obp','slg','ops'] as const;
export const PRACTICE_BATTING_DERIVED_METRICS = ['iso','babip','hrPct','xbhPct','tbPerAb','strikeoutPct','walkPct','walkToStrikeout','paPerStrikeout','paPerWalk','xbhHitPct','hrPaPct','tbPerPa','stolenBasePct','pitchesPerPlateAppearance','calledStrikePctHitting','swingingStrikePctHitting','firstPitchSwingPct','twoStrikeContactPct'] as const;
const terminal = new Set(['Single','Double','Triple','Home Run','Walk','HBP','Strikeout','Out','Sac Fly','Sac Bunt','Reached on Error','Fielders Choice']);

// Read canonical Practice outcomes only. Unknown BIP is not an out or an at-bat.
export function practiceBatting(events: HittingEvent[], runnerEvents: HittingEvent[], playerId?: string|string[], actions:PracticeRunnerAction[]=[] ) {
  const uniqueEvents=[...new Map(events.map(event=>[event.id,event])).values()];
  const completed=events.filter(e=>e.liveBpContext && terminal.has(e.liveBpContext.result));
  const sequences=new Map<string,HittingEvent[]>();
  for(const event of uniqueEvents) {
    const context=event.liveBpContext;
    if(!context || !(context.countTracked ?? context.mode!=='FREE') || !Number.isInteger(context.before.pa))continue;
    const key=`${event.practiceId}:${event.hitterId}:${event.liveBpRoundId??event.sessionId}:${context.before.pa}`;
    sequences.set(key,[...(sequences.get(key)??[]),event]);
  }
  const completeSequences=[...sequences.values()].filter(group=>{
    const ordered=[...group].sort((a,b)=>a.eventNumber-b.eventNumber),first=ordered[0].liveBpContext!,last=ordered.at(-1)!.liveBpContext!;
    return first.before.balls===0 && first.before.strikes===0 && terminal.has(last.result) && group.filter(event=>terminal.has(event.liveBpContext!.result)).length===1;
  });
  const jobs=completed.filter(e=>Boolean(e.liveBpContext?.before.job));
  const evaluatedJobs=jobs.filter(e=>typeof e.liveBpContext?.jobSuccess==='boolean');
  const count=(result:string)=>completed.filter(e=>e.liveBpContext!.result===result).length;
  const singles=count('Single'),doubles=count('Double'),triples=count('Triple'),homeRuns=count('Home Run');
  const hits=singles+doubles+triples+homeRuns,walks=count('Walk'),hitByPitch=count('HBP');
  const sacrificeFlies=count('Sac Fly'),sacrificeBunts=count('Sac Bunt');
  const pa=completed.length,ab=pa-walks-hitByPitch-sacrificeFlies-sacrificeBunts;
  let runs=0,runSamples=0,rbi=0,rbiSamples=0;
  const runnerPrimitives=projectPracticeRunners(runnerEvents,actions).filter(p=>!playerId||(Array.isArray(playerId)?!!p.runnerId&&playerId.includes(p.runnerId):p.runnerId===playerId));
  const stolenBases=runnerPrimitives.filter(p=>p.reason==='Stolen base'&&p.to!=='out').length;
  const caughtStealing=runnerPrimitives.filter(p=>p.reason==='Caught stealing'&&p.to==='out').length;
  for(const p of runnerPrimitives) {
    runSamples++;
    if(p.to==='score')runs++;
  }
  for(const event of completed) {
    const c=event.liveBpContext!;
    if(!c.runnerOutcomes)continue;
    rbiSamples++;
    // No RBI inferred for errors, unspecified advances, double plays or third outs.
    const outs=Object.values(c.runnerOutcomes).filter(v=>v==='out').length;
    if(!['Single','Double','Triple','Home Run','Walk','HBP','Sac Fly','Sac Bunt','Out'].includes(c.result)
      || outs>1 || (outs>0 && c.before.outs+outs>=3))continue;
    rbi+=Object.entries(c.runnerOutcomes).filter(([base,to])=>to==='score' && !['On throwing error','On fielding error','Other'].includes(c.runnerReasons?.[base]??'')).length;
  }
  return {situationalReps:jobs.length,jobsEvaluated:evaluatedJobs.length,jobsCompleted:evaluatedJobs.filter(e=>e.liveBpContext?.jobSuccess).length,
    sequencedPitches:completeSequences.reduce((sum,group)=>sum+group.length,0),sequencedPa:completeSequences.length,
    pa,ab,hits,singles,doubles,triples,homeRuns,walks,hitByPitch,strikeouts:count('Strikeout'),
    outs:count('Out')+count('Strikeout')+sacrificeFlies+sacrificeBunts,
    xbh:doubles+triples+homeRuns,totalBases:singles+2*doubles+3*triples+4*homeRuns,
    runs,rbi,sacrificeFlies,sacrificeBunts,reachedOnError:count('Reached on Error'),fieldersChoice:count('Fielders Choice'),runSamples,rbiSamples,
    stolenBases,caughtStealing,stolenBaseAttempts:stolenBases+caughtStealing,
    runnerAdvances:runnerPrimitives.filter(p=>p.from!=='batter'&&(p.to==='score'||Number(p.to)>Number(p.from))).length,
    runnerOuts:runnerPrimitives.filter(p=>p.from!=='batter'&&p.to==='out').length};
}

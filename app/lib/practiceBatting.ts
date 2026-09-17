import type {HittingEvent} from '../types.ts';

export const PRACTICE_BATTING_METRICS = ['pa','ab','hits','singles','doubles','triples','homeRuns','walks','hitByPitch','strikeouts','outs','xbh','totalBases','runs','rbi','sacrificeFlies','sacrificeBunts','reachedOnError','fieldersChoice','avg','obp','slg','ops'] as const;
const terminal = new Set(['Single','Double','Triple','Home Run','Walk','HBP','Strikeout','Out','Sac Fly','Sac Bunt','Reached on Error','Fielders Choice']);

// Read canonical Practice outcomes only. Unknown BIP is not an out or an at-bat.
export function practiceBatting(events: HittingEvent[], runnerEvents: HittingEvent[], playerId?: string) {
  const completed=events.filter(e=>e.liveBpContext && terminal.has(e.liveBpContext.result));
  const count=(result:string)=>completed.filter(e=>e.liveBpContext!.result===result).length;
  const singles=count('Single'),doubles=count('Double'),triples=count('Triple'),homeRuns=count('Home Run');
  const hits=singles+doubles+triples+homeRuns,walks=count('Walk'),hitByPitch=count('HBP');
  const sacrificeFlies=count('Sac Fly'),sacrificeBunts=count('Sac Bunt');
  const pa=completed.length,ab=pa-walks-hitByPitch-sacrificeFlies-sacrificeBunts;
  let runs=0,runSamples=0,rbi=0,rbiSamples=0;
  for(const event of runnerEvents) {
    const c=event.liveBpContext;
    if(!c?.runnerOutcomes)continue;
    for(const [base,to] of Object.entries(c.runnerOutcomes)) {
      const runner=base==='batter'?event.hitterId:c.before.runnerIds?.[Number(base)];
      if(playerId && runner!==playerId)continue;
      runSamples++;
      if(to==='score')runs++;
    }
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
  return {pa,ab,hits,singles,doubles,triples,homeRuns,walks,hitByPitch,strikeouts:count('Strikeout'),
    outs:count('Out')+count('Strikeout')+sacrificeFlies+sacrificeBunts,
    xbh:doubles+triples+homeRuns,totalBases:singles+2*doubles+3*triples+4*homeRuns,
    runs,rbi,sacrificeFlies,sacrificeBunts,reachedOnError:count('Reached on Error'),fieldersChoice:count('Fielders Choice'),runSamples,rbiSamples};
}

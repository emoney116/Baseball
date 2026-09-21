import type {AppData, ID} from '../types.ts';
import {executeAnalyticsQuery, type AnalyticsDomain, type AnalyticsFieldSource} from './analyticsQuery.ts';

export function buildPracticeReviewSummary(data:AppData, practiceId:ID) {
  const practice=data.practices.find(p=>p.id===practiceId);
  const query=(domain:AnalyticsDomain,fieldSources:AnalyticsFieldSource[]=['practice','live-bp'])=>executeAnalyticsQuery(data,{
    domain,source:fieldSources.length===1?'live-bp':'all',fieldSources,mode:'box-score',view:'overview',groupBy:'player',
    timeRange:'custom',customDateRange:{start:practice?.date,end:practice?.date},eventIds:[practiceId],
  });
  const hitting=query('hitting'),pitching=query('pitching'),defense=query('defense');
  const liveHitting=query('hitting',['live-bp']),livePitching=query('pitching',['live-bp']);
  const pitchMix=executeAnalyticsQuery(data,{...pitching.query,view:'pitch-types'});
  const participantIds=new Set([hitting,pitching,defense].flatMap(result=>result.rows.filter(r=>r.sampleCount>0).map(r=>r.player.id)));
  const sessionIds=new Set([
    ...data.hittingEvents.filter(e=>e.practiceId===practiceId&&participantIds.has(e.hitterId)),
    ...data.pitchEvents.filter(e=>e.practiceId===practiceId&&participantIds.has(e.pitcherId)),
    ...data.defenseEvents.filter(e=>e.practiceId===practiceId&&participantIds.has(e.playerId)),
  ].map(e=>e.sessionId));
  const elapsed=practice?.endedAt?Date.parse(practice.endedAt)-Date.parse(practice.startedAt):undefined;
  const recordedEvents=[...data.hittingEvents,...data.pitchEvents,...data.defenseEvents].filter(e=>e.practiceId===practiceId);
  const timestamps=recordedEvents.map(e=>Date.parse(e.createdAt)).filter(Number.isFinite);
  const recordedSpanMinutes=timestamps.length>1?Math.round((Math.max(...timestamps)-Math.min(...timestamps))/60000):undefined;
  const liveBpRounds=new Set(recordedEvents.map(e=>e.liveBpRoundId).filter(Boolean)).size;
  return {hitting,pitching,defense,liveHitting,livePitching,pitchMix,participants:participantIds.size,sessions:sessionIds.size,
    recordedSpanMinutes,liveBpRounds,
    durationMinutes:elapsed!==undefined&&Number.isFinite(elapsed)&&elapsed>=0?Math.round(elapsed/60000):undefined};
}

export function practiceReviewTakeaways(summary: ReturnType<typeof buildPracticeReviewSummary>) {
  const cells=summary.hitting.teamTotals?.cells??{};
  const observations:{id:string;title:string;text:string;evidence:{domain:string;metric:string;value:number|string;sample?:number}[]}[]=[];
  for(const [key,title,minimum,description] of [
    ['contactPct','Contact',10,'of swings produced contact'],
    ['swingMissPct','Whiffs',10,'of swings were misses'],
    ['hardPct','Contact quality',8,'of graded balls were hard contact'],
  ] as const) {
    const cell=cells[key];
    if(typeof cell?.value==='number'&&(cell.sample?.denominator??0)>=minimum)
      observations.push({id:key,title,text:`${cell.display} ${description} (${cell.sample!.denominator} measured).`,evidence:[{domain:'hitting',metric:key,value:cell.value,sample:cell.sample!.denominator}]});
  }
  const ev=cells.avgEv;
  if(typeof ev?.value==='number'&&(ev.sample?.denominator??0)>=5)
    observations.push({id:'ev',title:'Exit velocity',text:`${ev.display} average across ${ev.sample!.denominator} measured BIP.`,evidence:[{domain:'hitting',metric:'avgEv',value:ev.value,sample:ev.sample!.denominator}]});
  const runs=cells.runs,advances=cells.runnerAdvances;
  if(typeof runs?.value==='number'&&typeof advances?.value==='number')
    observations.push({id:'runners',title:'Runners',text:`${runs.display} runs and ${advances.display} runner advances recorded.`,evidence:[{domain:'hitting',metric:'runs',value:runs.value},{domain:'hitting',metric:'runnerAdvances',value:advances.value}]});
  return observations.slice(0,5);
}

export function practiceReviewStandouts(summary: ReturnType<typeof buildPracticeReviewSummary>) {
  const metrics = [
    {result:summary.hitting, key:'contactPct', label:'Contact %', minimum:10},
    {result:summary.hitting, key:'hardPct', label:'Top Hard-Hit %', minimum:8},
    {result:summary.hitting, key:'barrelPct', label:'Top Impact %', minimum:8},
    {result:summary.hitting, key:'maxEv', label:'Top EV', minimum:1},
    {result:summary.pitching, key:'strikePct', label:'Strike %', minimum:12},
    {result:summary.defense, key:'cleanPct', label:'Clean Defensive Reps', minimum:6},
  ];
  return metrics.flatMap(({result,key,label,minimum}) => {
    const best = result.rows.filter(row => !row.player.archived &&
      typeof row.cells[key]?.value === 'number' &&
      (row.cells[key].sample?.denominator ?? 0) >= minimum)
      .sort((a,b) => Number(b.cells[key].value)-Number(a.cells[key].value))[0];
    if (!best) return [];
    const cell = best.cells[key];
    return [{label,player:best.player,value:`${cell.display} / ${cell.sample?.denominator} recorded`}];
  });
}

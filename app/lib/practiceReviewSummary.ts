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
  const participantIds=new Set([hitting,pitching,defense].flatMap(result=>result.rows.filter(r=>r.sampleCount>0).map(r=>r.player.id)));
  const sessionIds=new Set([
    ...data.hittingEvents.filter(e=>e.practiceId===practiceId&&participantIds.has(e.hitterId)),
    ...data.pitchEvents.filter(e=>e.practiceId===practiceId&&participantIds.has(e.pitcherId)),
    ...data.defenseEvents.filter(e=>e.practiceId===practiceId&&participantIds.has(e.playerId)),
  ].map(e=>e.sessionId));
  const elapsed=practice?.endedAt?Date.parse(practice.endedAt)-Date.parse(practice.startedAt):undefined;
  return {hitting,pitching,defense,liveHitting,livePitching,participants:participantIds.size,sessions:sessionIds.size,
    durationMinutes:elapsed!==undefined&&Number.isFinite(elapsed)&&elapsed>=0?Math.round(elapsed/60000):undefined};
}

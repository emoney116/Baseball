import type {AppData, WeightRoomWorkoutStation, WorkoutEntry} from '../types.ts';
import {testComparisonKey} from './workoutTesting.ts';
import {workoutEntryVolume} from './weightRoom.ts';

export type ScoreDimension = 'performance' | 'work' | 'progress' | 'consistency';
export type ScoreWeights = Record<ScoreDimension, number>;
export const CLUBHOUSE_SCORE_VERSION = 'clubhouse-weight-room-v1-preview';
export const SCORE_CANDIDATES: Record<string, ScoreWeights> = {
  performance: {performance:100,work:0,progress:0,consistency:0},
  performance80: {performance:80,work:20,progress:0,consistency:0},
  performance60: {performance:60,work:40,progress:0,consistency:0},
  balanced: {performance:50,work:50,progress:0,consistency:0},
};
// Preview policy selected after the real-cohort sensitivity audit; future weights are not approved.
export const CLUBHOUSE_SCORE_POLICY = SCORE_CANDIDATES.performance80;
const mean=(values:number[])=>values.length?values.reduce((a,b)=>a+b,0)/values.length:undefined;
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const normalize=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,'');

/** Midrank percentile: ties share points; a single outlier cannot stretch everybody's scale. */
export function scorePercentile(value:number, peers:number[], lowerBetter=false) {
  if(peers.length<5)return undefined;
  const below=peers.filter(v=>lowerBetter?v>value:v<value).length;
  const equal=peers.filter(v=>v===value).length;
  return 100*(below+(equal-1)/2)/(peers.length-1);
}

export function combineScore(dimensions:Partial<Record<ScoreDimension,number>>,weights:ScoreWeights) {
  if(Object.values(weights).some(value=>!finite(value)))throw new Error('Score weights must be finite and nonnegative.');
  const keys=(Object.keys(weights) as ScoreDimension[]).filter(key=>finite(dimensions[key])&&weights[key]>0);
  const total=keys.reduce((sum,key)=>sum+weights[key],0);
  return total?{value:keys.reduce((sum,key)=>sum+dimensions[key]!*weights[key],0)/total,
    effectiveWeights:Object.fromEntries(keys.map(key=>[key,weights[key]/total]))}:undefined;
}

type Observation={entry:WorkoutEntry;station:WeightRoomWorkoutStation;key:string;baselineKey:string;value:number;volume:number;lowerBetter:boolean;date:string;workoutId:string};

function measure(entry:WorkoutEntry,station:WeightRoomWorkoutStation) {
  const conditions=station.testConditions;
  if(conditions) {
    if(!entry.testConditions||testComparisonKey(conditions,entry.testSide)!==testComparisonKey(entry.testConditions,entry.testSide))return;
    if(conditions.bilateral&&!entry.testSide)return;
    if(conditions.mode==='FIXED_LOAD_TIMED_REPS'&&entry.weight!==conditions.loadLb)return;
    const value=conditions.mode==='MAX_DURATION'?entry.value:entry.reps??entry.value;
    if(!finite(value)||(conditions.mode!=='MAX_DURATION'&&!Number.isInteger(value)))return;
    return {value,key:testComparisonKey(conditions,entry.testSide),lowerBetter:false};
  }
  // Ordinary lifts compare load only at the same prescribed rep count, never an invented 1RM.
  if(station.measurementType==='WEIGHT_REPS') {
    if(!finite(station.targetReps)||entry.reps!==station.targetReps||!finite(entry.weight))return;
    return {value:entry.weight,key:`load-at-${station.targetReps}-reps`,lowerBetter:false};
  }
  const value=['BODYWEIGHT_REPS','REPS_ONLY','COUNT'].includes(station.measurementType??'')?entry.reps:entry.value;
  if(!['BODYWEIGHT_REPS','REPS_ONLY','COUNT','TIME','HEIGHT','DISTANCE','WEIGHT_ONLY'].includes(station.measurementType??'')||!finite(value))return;
  return {value,key:JSON.stringify([station.measurementType,station.unit,station.targetWeight??null,entry.testSide??null]),lowerBetter:station.performanceDirection==='LOWER_IS_BETTER'};
}

/** Pure read model. Call only with the authorized team's canonical program and event records. */
export function buildClubhouseWeightRoomScore(data:AppData,weights:ScoreWeights,options:{start?:string;end?:string}={}) {
  const roster=new Map(data.players.filter(p=>!p.archived).map(p=>[p.id,p]));
  const team=data.teamContext?.currentTeam;
  const programs=(data.weightRoomWorkouts??[]).filter(w=>w.status==='COMPLETED'&&w.createdBy&&
    (!team||(w.teamId===team.teamId&&w.seasonId===team.seasonId)));
  const end=options.end??programs.map(w=>w.date).sort().at(-1);
  const start=options.start??(end?new Date(Date.parse(`${end}T12:00:00Z`)-29*86400000).toISOString().slice(0,10):undefined);
  const sessions=new Map(data.workoutSessions.map(s=>[s.id,s]));
  const workouts=new Map(programs.map(w=>[w.id,w]));
  const stations=new Map((data.weightRoomWorkoutStations??[]).filter(s=>!s.archivedAt).map(s=>[s.id,s]));
  const seen=new Set<string>(),slots=new Set<string>(),observations:Observation[]=[];
  const exclusions:Record<string,number>={};
  const exclude=(reason:string)=>{exclusions[reason]=(exclusions[reason]??0)+1;};
  for(const entry of [...data.workoutEntries].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id))) {
    if(seen.has(entry.id)){exclude('duplicateId');continue;} seen.add(entry.id);
    const workout=workouts.get(entry.activeWorkoutId??''),station=stations.get(entry.workoutStationId??'');
    const session=sessions.get(entry.sessionId);
    if(!workout||!station||station.workoutId!==workout.id||!session||session.playerId!==entry.playerId||session.date!==workout.date||!roster.has(entry.playerId)) {exclude('unlinkedProgram');continue;}
    // No self-entered extras. Existing server authorization controls COACH provenance.
    if(entry.entrySource!=='COACH'||!entry.createdByProfileId||entry.status==='Skipped') {exclude('notCoachRecorded');continue;}
    const membership=(data.weightRoomWorkoutGroupMembers??[]).filter(m=>m.workoutId===workout.id&&m.playerId===entry.playerId);
    if(membership.some(m=>m.participantStatus!=='ASSIGNED'&&m.participantStatus!=='MODIFIED')){exclude('notAssigned');continue;}
    const set=entry.setNumber??1,cap=station.targetSets??1;
    if(!Number.isInteger(set)||set<1||set>cap||(entry.testAttempt??1)!==1||(entry.sets??1)!==1){exclude('extraAttemptOrSet');continue;}
    const metric=measure(entry,station);
    if(!metric){exclude('incompatibleMeasurement');continue;}
    const slot=`${workout.id}:${entry.playerId}:${station.id}:${entry.testSide??''}:${set}`;
    if(slots.has(slot)){exclude('duplicateSlot');continue;} slots.add(slot);
    observations.push({entry,station,key:`${station.id}:${metric.key}`,baselineKey:`${normalize(station.exerciseName)}:${metric.key}`,
      value:metric.value,volume:workoutEntryVolume({...entry,sets:1}),lowerBetter:metric.lowerBetter,date:workout.date,workoutId:workout.id});
  }
  type Sample={workoutId:string;performance:number;work?:number;evidence:Observation[]};
  const samples=new Map<string,Sample[]>();
  const current=programs.filter(w=>start&&end&&w.date>=start&&w.date<=end);
  const programEvidence:{id:string;date:string;measures:number;qualified:number;participants:number}[]=[];
  for(const program of current) {
    const rows=observations.filter(o=>o.workoutId===program.id);
    const groups=new Map<string,Observation[]>();
    for(const o of rows)groups.set(o.key,[...(groups.get(o.key)??[]),o]);
    const supported=[...groups].filter(([,group])=>new Set(group.map(o=>o.entry.playerId)).size>=5);
    const eligible=[...roster.keys()].filter(id=>supported.length>=3&&supported.every(([,group])=>{
      const own=group.filter(o=>o.entry.playerId===id);
      // Bilateral tests use a separate side key; each side needs one programmed slot.
      return own.length===(group[0].station.testConditions?.bilateral?1:group[0].station.targetSets??1);
    }));
    programEvidence.push({id:program.id,date:program.date,measures:supported.length,qualified:eligible.length,participants:new Set(rows.map(o=>o.entry.playerId)).size});
    if(eligible.length<5)continue;
    const values=new Map(supported.map(([key,group])=>[key,new Map(eligible.map(id=>[id,mean(group.filter(o=>o.entry.playerId===id).map(o=>o.value))!]))]));
    const volumes=new Map(eligible.map(id=>[id,rows.filter(o=>o.entry.playerId===id&&values.has(o.key)).reduce((sum,o)=>sum+o.volume,0)]));
    const loadedKeys=supported.filter(([,group])=>group.some(o=>o.volume>0)).length;
    for(const id of eligible) {
      const performance=mean(supported.map(([key,group])=>scorePercentile(values.get(key)!.get(id)!,[...values.get(key)!.values()],group[0].lowerBetter)!))!;
      const work=loadedKeys>=2?scorePercentile(volumes.get(id)!,[...volumes.values()]):undefined;
      samples.set(id,[...(samples.get(id)??[]),{workoutId:program.id,performance,work,evidence:rows.filter(o=>o.entry.playerId===id&&values.has(o.key))}]);
    }
  }
  const rows=[...roster.values()].map(player=>{
    const own=samples.get(player.id)??[],evidence=own.flatMap(s=>s.evidence);
    const progressByMeasure=new Map<string,number>();
    for(const o of [...evidence].sort((a,b)=>b.date.localeCompare(a.date))) {
      const baseline=observations.filter(b=>b.entry.playerId===player.id&&b.baselineKey===o.baselineKey&&start&&b.date<start&&b.value>0).sort((a,b)=>b.date.localeCompare(a.date))[0];
      if(baseline&&!progressByMeasure.has(o.baselineKey))progressByMeasure.set(o.baselineKey,(o.value-baseline.value)/baseline.value*(o.lowerBetter?-100:100));
    }
    const progress=progressByMeasure.size>=3?50+Math.max(-20,Math.min(20,mean([...progressByMeasure.values()])!))*2.5:undefined;
    const assigned=current.filter(w=>(data.weightRoomWorkoutGroupMembers??[]).some(m=>m.workoutId===w.id&&m.playerId===player.id&&m.participantStatus==='ASSIGNED'));
    const consistency=new Set(assigned.map(w=>w.date)).size>=3?100*assigned.filter(w=>own.some(s=>s.workoutId===w.id)).length/assigned.length:undefined;
    const dimensions={performance:mean(own.map(s=>s.performance)),work:mean(own.map(s=>s.work).filter(finite)),progress,consistency};
    const combined=combineScore(dimensions,weights);
    const requiredPrograms=programEvidence.filter(program=>program.qualified>=5).length;
    return {player,qualified:own.length>0&&own.length===requiredPrograms&&Boolean(combined),score:combined?.value,dimensions,effectiveWeights:combined?.effectiveWeights,
      programs:own.length,measures:new Set(evidence.map(o=>o.baselineKey)).size,volume:evidence.reduce((s,o)=>s+o.volume,0),
      evidence: evidence.map(o=>({eventId:o.entry.id,workoutId:o.workoutId,stationId:o.station.id,exercise:o.station.exerciseName,value:o.value,unit:o.station.testConditions?.mode==='MAX_DURATION'?'sec':o.entry.unit??'reps'}))};
  });
  const leaders=rows.filter(row=>row.qualified).sort((a,b)=>b.score!-a.score!||a.player.name.localeCompare(b.player.name));
  return {version:CLUBHOUSE_SCORE_VERSION,start,end,weights,rows,leaders,programEvidence,exclusions,eligibleEntries:observations.length};
}

export type ClubhouseWeightRoomScore = ReturnType<typeof buildClubhouseWeightRoomScore>;

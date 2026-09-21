import {useState} from 'react';
import type {AppData} from '../types';
import {buildWeightRoomLeaders} from '../lib/weightRoomLeaders';
import {ChoiceSelect} from './ChoiceSelect';
import {MetricBar} from './visuals';

export function WeightRoomLeaders({data,onPlayer}:{data:AppData;onPlayer:(id:string)=>void}) {
  const [category,setCategory]=useState('volume');
  const [showAll,setShowAll]=useState(false);
  const result=buildWeightRoomLeaders(data.players,data.workoutSessions,data.workoutEntries);
  const selected=result.tests.find(t=>t.key===category);
  const rows=selected?selected.rows.map(r=>({...r,display:`${r.value} ${selected.unit}`})):category==='consistency'?result.consistencyLeaders.map(r=>({...r,value:r.days,display:`${r.days} recorded days`})):result.volumeLeaders.map(r=>({...r,value:r.volume,display:`${r.volume.toLocaleString()} lb-reps`}));
  return <section className="panel weight-leader weight-results" aria-label="Weight Room performance leaders">
    <h2>Weight Room Results</h2>
    <p>{result.athletesTrained} athletes · {result.recordedDays} recorded {result.recordedDays===1?'day':'days'} · {result.volume.toLocaleString()} lb-reps</p>
    <ChoiceSelect aria-label="Weight Room measure" value={category} onChange={setCategory} options={[{value:'volume',label:'Recorded volume'},{value:'consistency',label:'Recorded days'},...result.tests.map(t=>({value:t.key,label:t.exercise,description:t.condition}))]}/>
    <div className="weight-leader-list">{rows.slice(0,showAll?rows.length:5).map(row=><button type="button" key={row.player.id} onClick={()=>onPlayer(row.player.id)}><MetricBar label={row.player.name} value={row.value} max={rows[0]?.value||1} helper={row.display}/></button>)}</div>
    {rows.length>5&&<button type="button" className="secondary-button" onClick={()=>setShowAll(!showAll)}>{showAll?'Show less':'See all'}</button>}
    {!rows.length&&<p>Not enough comparable history.</p>}
    <details><summary>Metric definitions</summary><p>Volume is external load × repetitions × sets, not a strength ranking. At least two loaded entries qualify. Test results compare matching load, duration and side. Recorded days require at least two dates. One testing day cannot establish progress or an overall development winner.</p></details>
  </section>;
}

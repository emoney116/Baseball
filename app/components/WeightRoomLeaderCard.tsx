'use client';

import {useId,useMemo,useRef} from 'react';
import {ArrowRight,Dumbbell,Info,X} from 'lucide-react';
import type {AppData} from '../types';
import {buildClubhouseWeightRoomScore,CLUBHOUSE_SCORE_POLICY} from '../lib/clubhouseWeightRoomScore';
import styles from './WeightRoomLeaderCard.module.css';

export function WeightRoomLeaderCard({data,onPlayer,onView}:{data:AppData;onPlayer:(id:string)=>void;onView:()=>void}) {
  const result=useMemo(()=>buildClubhouseWeightRoomScore(data,CLUBHOUSE_SCORE_POLICY),[data]);
  const dialog=useRef<HTMLDialogElement>(null),titleId=useId();
  return <section className={`panel ${styles.card}`} aria-label="Weight Room Leaders">
    <header className={styles.header}><h2><Dumbbell size={18} aria-hidden="true"/>Weight Room Leaders</h2>
      <button className="icon-button" type="button" title="How Clubhouse Score works" aria-label="How Clubhouse Score works" onClick={()=>dialog.current?.showModal()}><Info size={16}/></button>
    </header>
    <ol className={styles.list}>{result.leaders.slice(0,5).map((row,index)=><li key={row.player.id}>
      <button type="button" onClick={()=>onPlayer(row.player.id)}>
        <span className={styles.rank}>{result.leaders.findIndex(other=>Math.abs(other.score!-row.score!)<1e-8)+1||index+1}</span>
        <span className={styles.identity}><strong>{row.player.name}</strong><small>{row.measures} results{row.volume>0?` · ${row.volume.toLocaleString()} lb-reps`:''}</small></span>
        <span className={styles.score}><strong>{row.score!.toFixed(1)}</strong><small>Clubhouse</small></span>
      </button>
    </li>)}</ol>
    {!result.leaders.length&&<p className={styles.empty}>Awaiting a qualified programmed workout.</p>}
    <button type="button" className={`text-button ${styles.link}`} onClick={onView}>View Weight Room <ArrowRight size={16} aria-hidden="true"/></button>
    <dialog ref={dialog} className={styles.explanation} aria-labelledby={titleId}>
      <header className={styles.header}><h2 id={titleId}>Clubhouse Score</h2><button type="button" className="icon-button" aria-label="Close score explanation" onClick={()=>dialog.current?.close()}><X size={18}/></button></header>
      <p>0–100, relative to athletes completing the same programmed work. It is not an absolute strength rating.</p>
      <p><strong>Current policy:</strong> 80% Performance, 20% Work. Matched exercise results receive equal weight within Performance. Work compares valid load × reps × prescribed sets within the same workout.</p>
      <p>Only coach-recorded results linked to a completed programmed workout qualify. Extra attempts, duplicate slots and unprogrammed logging do not increase the score.</p>
      <p>At least five comparable athletes and three measured exercises are required. Athletes must finish the shared measured battery. Unmeasured exercises are excluded for everyone, not counted as zero.</p>
      <p>Progress requires earlier comparable results. Consistency requires at least three dated assignments. They are not active in this initial policy. Missing dimensions are omitted and remaining weights renormalized.</p>
      <p className={styles.period}>{result.start??'—'} to {result.end??'—'} · {result.leaders.length} qualified · {result.version}</p>
    </dialog>
  </section>;
}

export function ClubhouseScoreDetails({data,onPlayer}:{data:AppData;onPlayer:(id:string)=>void}) {
  const result=useMemo(()=>buildClubhouseWeightRoomScore(data,CLUBHOUSE_SCORE_POLICY),[data]);
  const display=(value:number|undefined)=>value===undefined?'—':value.toFixed(1);
  return <section className="panel" aria-label="Clubhouse Score breakdown"><h2>Clubhouse Score</h2>
    <p>{result.start??'—'} to {result.end??'—'} · {result.leaders.length} qualified</p>
    <div className={styles.table}><table><thead><tr><th>Player</th><th>Score</th><th>Performance</th><th>Work</th><th>Progress</th><th>Consistency</th></tr></thead>
      <tbody>{result.leaders.map(row=><tr key={row.player.id}><th><button type="button" className="text-button" onClick={()=>onPlayer(row.player.id)}>{row.player.name}</button></th><td>{display(row.score)}</td>{(['performance','work','progress','consistency'] as const).map(key=><td key={key}>{display(row.dimensions[key])}</td>)}</tr>)}</tbody></table></div>
    <p>Current score: 80% Performance, 20% Work. Progress and Consistency are not weighted in this initial policy.</p>
  </section>;
}

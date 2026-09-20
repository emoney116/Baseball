import type {buildPracticeReviewSummary} from '../lib/practiceReviewSummary';
import type {AnalyticsResult} from '../lib/analyticsQuery';
import styles from './PracticeRecap.module.css';

export function PracticeRecap({summary}:{summary:ReturnType<typeof buildPracticeReviewSummary>}) {
  const sections:{name:string;result:AnalyticsResult;metrics:[string,string][]}[]=[
    {name:'Hitting',result:summary.hitting,metrics:[['swings','Swings'],['takes','Takes'],['contactPct','Contact %'],['swingMissPct','Whiff %'],['avgEv','Avg EV'],['maxEv','Max EV'],['hardPct','Hard %'],['bip','BIP']]},
    {name:'Pitching',result:summary.pitching,metrics:[['pitches','Pitches'],['strikePct','Strike %'],['whiffPct','Whiff %'],['cswPct','CSW %'],['avgPitchVelo','Avg velocity'],['maxPitchVelo','Max velocity']]},
    {name:'Defense',result:summary.defense,metrics:[['reps','Reps'],['cleanPct','Clean %'],['errors','Errors'],['throws','Throws'],['throwAcc','Throw accuracy'],['greatPlays','Great plays']]},
    {name:'Live BP',result:summary.liveHitting,metrics:[['opportunities','Pitches'],['ab','AB'],['hits','Hits'],['runs','Runs'],['rbi','RBI'],['walks','Walks'],['avg','AVG'],['bip','BIP']]},
  ];
  if((summary.liveHitting.teamTotals?.sampleCount??0)>0){const live=sections.pop();if(live)sections.unshift(live);}
  return <section aria-label="Recorded Practice metrics" className={styles.root}>
    <div className={styles.meta}>
      <span>Setup to end <strong>{summary.durationMinutes===undefined?'—':`${summary.durationMinutes} min`}</strong></span>
      <span>Recorded activity span <strong>{summary.recordedSpanMinutes===undefined?'—':`${summary.recordedSpanMinutes} min`}</strong></span>
      <span>Tracked players <strong>{summary.participants}</strong></span>
      <span>Tracked sessions <strong>{summary.sessions}</strong></span>
      <span>Live BP rounds <strong>{summary.liveBpRounds}</strong></span>
    </div>
    <div className={styles.grid}>{sections.map(section=><article key={section.name}>
      <h2>{section.name}</h2>
      <dl>{section.metrics.map(([key,label])=>{const cell=section.result.teamTotals?.cells[key];return <div key={key}><dt>{label}</dt><dd>{cell?.display??'—'}{['avgEv','maxEv','avgPitchVelo','maxPitchVelo'].includes(key)&&cell?.sample?.denominator!==undefined&&<small> · {cell.sample.denominator} measured</small>}</dd></div>;})}</dl>
      {section.name==='Live BP'&&<dl><div><dt>Hitters</dt><dd>{summary.liveHitting.rows.filter(r=>r.sampleCount>0).length}</dd></div><div><dt>Player pitchers</dt><dd>{summary.livePitching.rows.filter(r=>r.sampleCount>0).length}</dd></div></dl>}
    </article>)}</div>
  </section>;
}

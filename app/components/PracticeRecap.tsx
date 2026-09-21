import {practiceReviewStandouts, practiceReviewTakeaways, type buildPracticeReviewSummary} from '../lib/practiceReviewSummary';
import type {AnalyticsResult} from '../lib/analyticsQuery';
import styles from './PracticeRecap.module.css';

type Summary=ReturnType<typeof buildPracticeReviewSummary>;
type Metric=[string,string];

function Metrics({result,metrics}:{result:AnalyticsResult;metrics:Metric[]}) {
  return <dl className={styles.metrics}>{metrics.map(([key,label])=>{
    const cell=result.teamTotals?.cells[key];
    const sample=cell?.sample?.denominator;
    return <div key={key}><dt>{label}</dt><dd>{cell?.display??'—'}
      {['avgEv','maxEv','hardPct','avgPitchVelo','maxPitchVelo'].includes(key)&&typeof sample==='number'&&sample>0&&<small>{sample} measured</small>}
    </dd></div>;
  })}</dl>;
}

export function PracticeRecap({summary,view='Overview'}:{summary:Summary;view?:'Overview'|'Hitting'|'Pitching'|'Defense'|'Situational'}) {
  const live=Number(summary.liveHitting.teamTotals?.cells.opportunities?.value??0)>0;
  const pitching=Number(summary.pitching.teamTotals?.cells.pitches?.value??0)>0;
  const defense=Number(summary.defense.teamTotals?.cells.reps?.value??0)>0;
  const highlights=practiceReviewStandouts(summary).filter(item=>view==='Hitting'?['Top EV','Top Hard-Hit %','Top Impact %','Contact %'].includes(item.label):view==='Pitching'?item.label==='Strike %':view==='Defense'&&item.label==='Clean Defensive Reps');
  const takeaways=practiceReviewTakeaways(summary);
  const spray=summary.hitting.sprayChart;
  return <section aria-label="Recorded Practice metrics" className={styles.root}>
    {view==='Overview'&&<div className={styles.meta}>
      <span>Recorded activity <strong>{summary.recordedSpanMinutes===undefined?'—':`${summary.recordedSpanMinutes} min`}</strong></span>
      <span>Participants <strong>{summary.participants}</strong></span>
      <span>Live BP rounds <strong>{summary.liveBpRounds}</strong></span>
      <span>Setup to end <strong>{summary.durationMinutes===undefined?'—':`${summary.durationMinutes} min`}</strong></span>
    </div>}
    {view==='Overview'&&live&&<section className={styles.live} aria-label="Live BP summary">
      <h2>Live BP Summary</h2>
      <Metrics result={summary.liveHitting} metrics={[
        ['opportunities','Pitches'],['bip','BIP'],['runs','Runs'],['avgEv','Avg EV'],['maxEv','Max EV'],['contactPct','Contact %'],
      ]}/>
      <p className={styles.note}>{summary.liveHitting.rows.filter(r=>r.sampleCount>0).length} hitters
        {summary.livePitching.rows.some(r=>r.sampleCount>0)?` · ${summary.livePitching.rows.filter(r=>r.sampleCount>0).length} player pitchers`:''}
        {` · Spray: ${spray?.trackedLocations??0} / ${spray?.ballsInPlay??0} BIP tracked`}</p>
    </section>}
    <div className={styles.grid}>
      {view==='Hitting'&&<section aria-label="Hitting summary"><h2>Hitting</h2>
        <Metrics result={summary.hitting} metrics={[
          ['opportunities','Hitting events'],['pa','Completed PAs'],['swings','Swings'],['takes','Takes'],['contactPct','Contact %'],['swingMissPct','Whiff %'],['bip','BIP'],
          ['avgEv','Avg EV'],['maxEv','Max EV'],['hardPct','Hard %'],
        ]}/>
        <details><summary>Batted-ball mix &amp; spray</summary>
          <div className={styles.bars}>{[['groundBallPct','Ground ball'],['lineDrivePct','Line drive'],['flyBallPct','Fly ball'],['popUpPct','Pop up']].map(([key,label])=>{
            const cell=summary.hitting.teamTotals?.cells[key];
            return typeof cell?.value==='number'?<label key={key}>{label}<meter min={0} max={100} value={cell.value} />{cell.display}</label>:null;
          })}</div>
          <Metrics result={summary.hitting} metrics={[
            ['groundBallPct','Ground ball'],['lineDrivePct','Line drive'],['flyBallPct','Fly ball'],['popUpPct','Pop up'],
            ['pullPct','Pull'],['middlePct','Middle'],['oppoPct','Opposite'],
          ]}/>
        </details>
        <p className={styles.note}>Spray: {spray?.trackedLocations??0} / {spray?.ballsInPlay??0} BIP tracked</p>
      </section>}
      {view==='Pitching'&&<section aria-label="Pitching summary"><h2>Pitching</h2>
        {pitching?<><Metrics result={summary.pitching} metrics={[
          ['pitches','Pitches'],['strikePct','Strike %'],['whiffPct','Whiff %'],['cswPct','CSW %'],['avgPitchVelo','Avg velocity'],['maxPitchVelo','Max velocity'],
        ]}/><p className={styles.note}>{summary.pitchMix?.rows.filter(r=>r.rowKind==='group').map(r=>`${r.groupLabel}: ${r.cells.pitches?.display??'—'}`).join(' · ')}</p></>:<p className={styles.note}>No player pitching recorded</p>}
      </section>}
      {view==='Defense'&&<section aria-label="Defense summary"><h2>Defense</h2>
        {defense?<Metrics result={summary.defense} metrics={[
          ['reps','Reps'],['cleanPct','Clean %'],['errors','Errors'],['throwAcc','Throw accuracy'],['greatPlays','Great plays'],
        ]}/>:<p className={styles.note}>Not tracked</p>}
      </section>}
      {view==='Situational'&&<section aria-label="Situational summary"><h2>Situational</h2>
        <Metrics result={summary.hitting} metrics={[
          ['runs','Runs'],['runnerAdvances','Runner advances'],['runnerOuts','Runner outs'],['sacrificeBunts','Sac bunts'],['sacrificeFlies','Sac flies'],
          ['situationalReps','Situational reps'],['jobsCompleted','Jobs completed'],
        ]}/>
      </section>}
    </div>
    {view==='Overview'&&typeof summary.hitting.teamTotals?.cells.situationalReps?.value==='number'&&<section className={styles.highlights}><h2>Practice Focus</h2><Metrics result={summary.hitting} metrics={ [['situationalReps','Assigned jobs'],['jobsCompleted','Completed'],['jobSuccessPct','Success']]}/></section>}
    {view!=='Overview'&&view!=='Situational'&&highlights.length>0&&<section className={styles.highlights} aria-label="Player highlights"><h2>Player Highlights</h2>
      <ul>{highlights.map(item=><li key={`${item.label}-${item.player.id}`}><strong>{item.label==='Top EV'?'Max EV':item.label}</strong><span>{item.player.name} · {item.value}</span></li>)}</ul>
    </section>}
    {view==='Overview'&&takeaways.length>0&&<section className={styles.takeaways} aria-label="Practice takeaways"><h2>Key Takeaways</h2>
      <ul>{takeaways.filter(item=>item.id!=='swingMissPct').map(item=><li key={item.id} data-evidence={JSON.stringify(item.evidence)}><strong>{item.title}</strong><span>{item.text}</span></li>)}</ul>
    </section>}
  </section>;
}

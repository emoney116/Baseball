import {practiceReviewStandouts, practiceReviewTakeaways, type buildPracticeReviewSummary} from '../lib/practiceReviewSummary';
import type {AnalyticsResult} from '../lib/analyticsQuery';
import styles from './PracticeRecap.module.css';
import {useState} from 'react';
import {AnalyticsSprayChart, AnalyticsPitchLocationChart, type PracticeChartMetricMode} from './TeamWorkspaceViews';
import {DonutChart} from './visuals';

type Summary=ReturnType<typeof buildPracticeReviewSummary>;
type Metric=[string,string];
const chartColors=['var(--chart-primary)','var(--chart-success)','var(--chart-warning)','var(--chart-danger)'];
function ProfileChart({result,metrics,label}:{result:AnalyticsResult;metrics:Metric[];label:string}) {
  const items=metrics.flatMap(([key,name],index)=>{
    const value=result.teamTotals?.cells[key]?.value;
    return typeof value==='number'&&value>0?[{label:name,value,color:chartColors[index%chartColors.length]}]:[];
  });
  return items.length?<DonutChart items={items} label={label}/>:null;
}

function Metrics({result,metrics}:{result:AnalyticsResult;metrics:Metric[]}) {
  return <dl className={styles.metrics}>{metrics.map(([key,label])=>{
    const cell=result.teamTotals?.cells[key];
    return <div key={key}><dt>{label}</dt><dd>{cell?.display??'—'}
    </dd></div>;
  })}</dl>;
}

export function PracticeRecap({summary,view='Overview'}:{summary:Summary;view?:'Overview'|'Hitting'|'Pitching'|'Defense'|'Situational'}) {
  const [chartMode,setChartMode]=useState<PracticeChartMetricMode>('heat');
  const live=Number(summary.liveHitting.teamTotals?.cells.opportunities?.value??0)>0;
  const pitching=Number(summary.pitching.teamTotals?.cells.pitches?.value??0)>0;
  const defense=Number(summary.defense.teamTotals?.cells.reps?.value??0)>0;
  const highlights=practiceReviewStandouts(summary).filter(item=>view==='Hitting'?['Top EV','Top Hard-Hit %','Top Impact %','Contact %'].includes(item.label):view==='Pitching'?item.label==='Strike %':view==='Defense'&&item.label==='Clean Defensive Reps');
  const takeaways=practiceReviewTakeaways(summary);
  const spray=summary.hitting.sprayChart;
  return <section aria-label="Recorded Practice metrics" className={styles.root}>
    {view==='Overview'&&live&&<section className={styles.live} aria-label="Live BP summary">
      <h2>Live BP Summary</h2>
      <Metrics result={summary.liveHitting} metrics={[
        ['opportunities','Hitting events'],['bip','BIP'],['runs','Runs'],['contactPct','Contact %'],['avgEv','Avg EV'],['maxEv','Max EV'],['runnerAdvances','Runner advances'],['runnerOuts','Runner outs'],
      ]}/>
      <p className={styles.note}>{summary.liveHitting.rows.filter(r=>r.sampleCount>0).length} hitters
        {summary.livePitching.rows.some(r=>r.sampleCount>0)?` · ${summary.livePitching.rows.filter(r=>r.sampleCount>0).length} player pitchers`:''}
        {summary.recordedSpanMinutes!==undefined?` · ${summary.recordedSpanMinutes} min recorded`:''}</p>
    </section>}
    {view==='Overview'&&<dl className={styles.categories}>
      <div><dt>Hitting</dt><dd>{summary.hitting.teamTotals?.cells.swings?.display} swings · {summary.hitting.teamTotals?.cells.takes?.display} takes</dd></div>
      {pitching&&<div><dt>Pitching</dt><dd>{summary.pitching.teamTotals?.cells.pitches?.display} pitches · {summary.pitching.teamTotals?.cells.strikePct?.display} strikes</dd></div>}
      <div><dt>Defense</dt><dd>{defense?`${summary.defense.teamTotals?.cells.reps?.display} reps`:Number(summary.defense.teamTotals?.cells.errorPlays?.value)>0?`${summary.defense.teamTotals?.cells.errorPlays?.display} error plays`:'Not tracked'}</dd></div>
      <div><dt>Situational</dt><dd>{summary.hitting.teamTotals?.cells.runnerAdvances?.display} advances · {summary.hitting.teamTotals?.cells.runnerOuts?.display} runner outs</dd></div>
    </dl>}
    <div className={styles.grid}>
      {view==='Hitting'&&<section aria-label="Hitting summary"><h2>Hitting</h2>
        <Metrics result={summary.hitting} metrics={[
          ['opportunities','Hitting events'],['bip','BIP'],['contactPct','Contact %'],['avgEv','Avg EV'],['maxEv','Max EV'],['swingMissPct','Whiff %'],
        ]}/>
        {Boolean(spray?.trackedLocations)&&<AnalyticsSprayChart result={summary.hitting} mode={chartMode} onModeChange={setChartMode}/>}
        <details><summary>Batted-ball profile</summary>
          <ProfileChart result={summary.hitting} label="Batted-ball profile" metrics={ [['groundBalls','Ground ball'],['lineDrives','Line drive'],['flyBalls','Fly ball'],['popUps','Pop up']]}/>
          <Metrics result={summary.hitting} metrics={[
            ['groundBallPct','Ground ball'],['lineDrivePct','Line drive'],['flyBallPct','Fly ball'],['popUpPct','Pop up'],
            ['pullPct','Pull'],['middlePct','Middle'],['oppoPct','Opposite'],
          ]}/>
        </details>
        <details><summary>More hitting metrics</summary><Metrics result={summary.hitting} metrics={ [['pa','Completed PAs'],['swings','Swings'],['takes','Takes'],['hardPct','Hard %'],['medianEv','Median EV'],['ev90','90th percentile EV']]}/></details>
      </section>}
      {view==='Pitching'&&<section aria-label="Pitching summary"><h2>Pitching</h2>
        {pitching?<><Metrics result={summary.pitching} metrics={[
          ['pitches','Pitches'],['strikePct','Strike %'],['whiffPct','Whiff %'],['cswPct','CSW %'],['avgPitchVelo','Avg velocity'],['maxPitchVelo','Max velocity'],
        ]}/>{Boolean(summary.pitching.pitchLocationChart?.trackedLocations)&&<AnalyticsPitchLocationChart result={summary.pitching} mode={chartMode} onModeChange={setChartMode}/>}<details><summary>Pitch mix</summary><DonutChart items={summary.pitchMix.rows.filter(r=>r.rowKind==='group'&&Number(r.cells.pitches?.value)>0).map((r,i)=>({label:r.groupLabel??'Pitch',value:Number(r.cells.pitches.value),color:chartColors[i%chartColors.length]}))}/></details></>:<p className={styles.note}>No player pitching recorded</p>}
      </section>}
      {view==='Defense'&&<section aria-label="Defense summary"><h2>Defense</h2>
        {defense?<><Metrics result={summary.defense} metrics={[
          ['reps','Reps'],['cleanPct','Clean %'],['errors','Errors'],['throwAcc','Throw accuracy'],['greatPlays','Great plays'],
        ]}/><ProfileChart result={summary.defense} label="Defensive outcomes" metrics={ [['cleanReps','Clean'],['errors','Errors'],['missedReps','Missed']]}/></>:Number(summary.defense.teamTotals?.cells.errorPlays?.value)>0?<><Metrics result={summary.defense} metrics={[['errorPlays','Error plays']]}/><p className={styles.note}>Batter reached on error. Fielder and error type were not recorded.</p></>:<p className={styles.note}>Not tracked</p>}
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

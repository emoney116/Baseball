import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dir=process.argv[2],read=n=>JSON.parse(readFileSync(join(dir,n),'utf8'));
const raw=read('canonical-readonly.json'),data=read('private-app-data.json'),summary=read('analytics-reconciliation.json'),runner=read('runner-reconciliation.json'),ask=read('ask-run-reconciliation.json');
const cells=summary.hitting.teamTotals.cells;
const rows=[
  ['Runs','2 embedded scores + 3 non-undone standalone scoring actions',5,cells.runs.value,summary.liveHitting.teamTotals.cells.runs.value],
  ['Hitting events','Canonical hitting rows',raw.hitting.length,cells.opportunities.value,summary.liveHitting.teamTotals.cells.opportunities.value],
  ['BIP','Canonical action = Ball in play',data.hittingEvents.filter(e=>e.action==='Ball in play').length,cells.bip.value,cells.bip.value],
  ['EV samples','BIP with finite EV',data.hittingEvents.filter(e=>e.action==='Ball in play'&&Number.isFinite(e.exitVelocityMph)).length,cells.evSamples.value,cells.avgEv.sample.denominator],
  ['Spray samples','Canonical BIP location',data.hittingEvents.filter(e=>e.action==='Ball in play'&&e.fieldLocation).length,summary.hitting.sprayChart.trackedLocations,summary.hitting.sprayChart.trackedLocations],
  ['Runner advances','Deduplicated safe forward movement, excluding batter',runner.primitives.filter(p=>p.from!=='batter'&&(p.to==='score'||Number(p.to)>Number(p.from))).length,cells.runnerAdvances.value,cells.runnerAdvances.value],
  ['Runner outs','Deduplicated non-batter out outcomes',runner.primitives.filter(p=>p.from!=='batter'&&p.to==='out').length,cells.runnerOuts.value,cells.runnerOuts.value],
  ['Player pitching','No canonical player pitch events','not-tracked',summary.pitching.teamTotals.cells.pitches.kind,summary.pitching.teamTotals.cells.pitches.kind],
  ['Defense','Tracking OFF; no canonical defensive reps','not-tracked',summary.defense.teamTotals.cells.reps.kind,summary.defense.teamTotals.cells.reps.kind],
];
for(const row of rows){assert.equal(row[2],row[3],row[0]);assert.equal(row[2],row[4],row[0]);}
const askRuns=ask.results.flatMap(r=>r.totals?.metrics??[]).find(m=>m.metricId==='runs')?.value;
assert.equal(askRuns,5,'Ask must use canonical totals');
const result={status:'PASS - local exported-data recomputation, not deployed acceptance',rows:rows.map(([metric,evidence,expected,analytics,postPractice])=>({metric,evidence,expected,analytics,postPractice,result:'PASS'})),askRuns,
  standaloneActions:runner.standalone.length,situationalJobs:data.hittingEvents.filter(e=>e.liveBpContext?.before.job).length,
  limitations:['Hosted read projection requires authorized migration deployment.','Post-Practice values mean shared summary; this pass did not expand recap UI.','No independent RBI credit from standalone scores.']};
writeFileSync(join(dir,'stabilization-reconciliation.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));

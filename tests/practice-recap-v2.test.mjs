import test from 'node:test';
import assert from 'node:assert/strict';
import {practiceReviewTakeaways} from '../app/lib/practiceReviewSummary.ts';
import {practiceBatting} from '../app/lib/practiceBatting.ts';

test('Recap observations require measured canonical samples and preserve their evidence',()=>{
  const summary={hitting:{teamTotals:{cells:{contactPct:{value:80,display:'80%',sample:{denominator:10}},avgEv:{value:91,display:'91',sample:{denominator:4}},runs:{value:5,display:'5'},runnerAdvances:{value:16,display:'16'}}}}};
  const result=practiceReviewTakeaways(summary);
  assert.deepEqual(result.map(x=>x.id),['contactPct','runners']);
  assert.equal(result[0].evidence[0].sample,10);
  assert.equal(result[1].evidence[0].value,5);
  assert.equal(practiceReviewTakeaways({hitting:{teamTotals:{cells:{}}}}).length,0);
});

test('Jobs count completed opportunities, keep unevaluated separate, and honor explicit coach failure',()=>{
  const event=(id,result,jobSuccess)=>({id,action:'Ball in play',liveBpContext:{result,before:{job:'Move runner',outs:0,runners:[]},after:{runners:[]},jobSuccess}});
  const events=[event('1','Sac Bunt',true),event('2','Out',false),event('3','Single',undefined),event('4','Ball',true)];
  const totals=practiceBatting(events,[]);
  assert.equal(totals.situationalReps,3);assert.equal(totals.jobsEvaluated,2);assert.equal(totals.jobsCompleted,1);
  assert.equal(totals.sacrificeBunts,1);assert.equal(totals.pa,3);
});

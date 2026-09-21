import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {practiceReviewStandouts} from '../app/lib/practiceReviewSummary.ts';

test('Practice highlights rank qualifying recorded samples, never unknown contact quality as zero', () => {
  const player = {id:'qa',name:'QA'};
  const result = cells => ({rows:[{player,sampleCount:25,cells}]});
  const summary = {
    hitting:result({hardPct:{display:'—'},barrelPct:{display:'—'},maxEv:{value:101,display:'101.0 mph',sample:{denominator:7}}}),
    pitching:result({strikePct:{value:50,display:'50%',sample:{denominator:4}}}),
    defense:result({cleanPct:{value:80,display:'80%',sample:{denominator:5}}}),
  };
  assert.deepEqual(practiceReviewStandouts(summary), [{label:'Top EV',player,value:'101.0 mph'}]);
  summary.hitting.rows[0].cells.hardPct = {value:0,display:'0%',sample:{denominator:8}};
  assert.equal(practiceReviewStandouts(summary)[0].label, 'Top Hard-Hit %');
});

test('End Practice dialog uses the same canonical recap as completed Practice review', () => {
  const page=readFileSync(new URL('../app/ClubhouseWorkspace.tsx',import.meta.url),'utf8');
  const modal=page.slice(page.indexOf('function PracticeSummaryModal('),page.indexOf('function HomeInfoCard('));
  assert.match(modal,/buildPracticeReviewSummary\(data, practice.id\)/);
  assert.match(modal,/<PracticeRecap summary=\{reviewSummary\}/);
  assert.doesNotMatch(modal,/calculateHittingStats|practiceTotals/);
});

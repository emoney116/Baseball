import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPracticeReviewSummary} from '../app/lib/practiceReviewSummary.ts';
import {emptyData} from '../app/lib/askClubhouse/serverData.ts';
test('recorded span is separate from setup duration and excludes other practices',()=>{
 const data=emptyData({availableTeams:[]},{id:'qa'},undefined);
 data.practices=[{id:'p',date:'2026-09-17',startedAt:'2026-09-17T15:13:00Z',endedAt:'2026-09-17T20:44:00Z'}];
 data.hittingEvents=[{practiceId:'p',createdAt:'2026-09-17T20:08:00Z',liveBpRoundId:'round'},{practiceId:'p',createdAt:'2026-09-17T20:43:00Z',liveBpRoundId:'round'},{practiceId:'other',createdAt:'2026-09-17T12:00:00Z',liveBpRoundId:'other'}];
 const result=buildPracticeReviewSummary(data,'p');assert.equal(result.durationMinutes,331);assert.equal(result.recordedSpanMinutes,35);assert.equal(result.liveBpRounds,1);
});
test('one timestamp cannot establish an activity duration',()=>{
 const data=emptyData({availableTeams:[]},{id:'qa'},undefined);
 data.hittingEvents=[{practiceId:'p',createdAt:'2026-09-17T20:08:00Z'}];
 assert.equal(buildPracticeReviewSummary(data,'p').recordedSpanMinutes,undefined);
});

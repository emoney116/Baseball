import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { workoutMvp } from '../app/lib/workoutMvp.ts';

test('unassigned athlete layout does not override shared avatar spans', () => {
  const css = readFileSync('app/globals.css', 'utf8');
  assert.doesNotMatch(css, /\.weight-room-unassigned-list span\s*\{/);
  assert.match(css, /\.weight-room-unassigned-list > div:last-child > span\s*\{/);
});

test('MVP requires recorded results and ranks progress before completion, not raw load',()=>{
  const a={player:{id:'a',name:'A'},prs:0,completion:100,resultCount:10,exerciseCount:7};
  const b={...a,player:{id:'b',name:'B'},prs:1,completion:50};
  assert.equal(workoutMvp([a,b]).player.id,'b');
  assert.equal(workoutMvp([{...a,resultCount:0}]),undefined);
  assert.equal(workoutMvp([a,{...b,prs:0,completion:200}]).player.id,'a');
});

test('group mode follows authoritative station and individual mode omits group picker',()=>{
  const source=readFileSync('app/components/WorkoutTestingConsole.tsx','utf8');
  assert.match(source,/selectedGroup\.current_station_id/);
  assert.match(source,/mode === "Groups" \? <ClubhouseSelect label="Group"/);
  assert.match(source,/onBlur=\{\(\) => void save\(player.id\)\}/);
  assert.match(source,/expected_revision: draft.revision/);
  assert.doesNotMatch(source,/aria-label=\{`Save/);
});

test('drilldown places actual before target and row width accommodates all columns',()=>{
  const source=readFileSync('app/page.tsx','utf8');
  assert.match(source,/<span>Athlete<\/span><span>Actual<\/span><span>Target<\/span>/);
  const css=readFileSync('app/weight-room-polish.css','utf8');
  assert.match(css,/width: max\(100%,1000px\)/);
  assert.match(css,/text-overflow: clip/);
  assert.match(css,/\[role="columnheader"\] button/);
});

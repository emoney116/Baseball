import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('Individual workout is exercise-first with every athlete and configured set', () => {
  const page = readFileSync('app/ClubhouseWorkspace.tsx', 'utf8');
  const component = page.slice(page.indexOf('function WeightRoomIndividualWorkout('), page.indexOf('function WeightRoomActiveActivity('));
  assert.match(component, /aria-label="Workout exercise"/);
  assert.doesNotMatch(component, /Workout athlete|onPlayer|individual-strip|playerId: ID/);
  assert.match(component, /players\.map\(player => <div role="row"/);
  assert.match(component, /length: targetSets/);
  assert.match(component, /cell=\{\{ playerId: player.id, exercise: station.name, setNumber \}\}/);
  assert.match(component, /onSaveCell=\{onSaveCell\}/);
  assert.match(component, /disabled=\{disabled\}/);
});

test('Individual box score scrolls its set columns and pins athlete names', () => {
  const css = readFileSync('app/globals.css','utf8');
  assert.match(css, /\.weight-room-individual-box-score \{[^}]*overflow-x: auto/s);
  assert.match(css, /\.weight-room-individual-box-score \[role="row"\] > :first-child \{[^}]*position: sticky/s);
  assert.match(css, /repeat\(var\(--active-set-count, 1\), minmax\(160px, 1fr\)\)/);
});

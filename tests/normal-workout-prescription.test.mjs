import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('normal preset and workout round trips preserve prescribed load', () => {
  const source=readFileSync('app/ClubhouseWorkspace.tsx','utf8');
  assert.equal((source.match(/targetWeight: station.targetWeight/g) ?? []).length,4);
  assert.match(source,/entry type/);
  assert.match(source,/prescribed load/);
  assert.match(source,/Instructions<input/);
});
test('player normal workouts expose instructions and prescribed weight without test conditions',()=>{
  const load=readFileSync('app/lib/playerLiveEntry.ts','utf8');
  assert.match(load,/notes: s.notes/);
  const ui=readFileSync('app/components/PlayerLiveEntry.tsx','utf8');
  assert.match(ui,/targetWeight: session.exercise.weight/);
  assert.match(ui,/s.exercise!.notes/);
  const cell=readFileSync('app/components/TeamTrainingViews.tsx','utf8');
  assert.match(cell,/readOnly=\{station.targetWeight !== undefined\}/);
});

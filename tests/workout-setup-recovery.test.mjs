import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('setup recovers missing workout parents before dependent station writes without replaying existing parents',()=>{
  const source=readFileSync('app/data/supabaseRepository.ts','utf8');
  assert.match(source,/!existing.has\(row.id\) && !pending.has\(row.id\)/);
  assert.ok(source.indexOf('const setupParentIds') < source.indexOf('const workoutScheduleIds'));
  assert.ok(source.indexOf('const workoutScheduleIds') < source.indexOf('await syncActiveWeightRoomSetup'));
  assert.match(source,/Workout setup has no saved parent workout/);
});
test('failed setup retains roster, exposes retry and does not display endless loading',()=>{
  const source=readFileSync('app/components/WorkoutTestingConsole.tsx','utf8');
  assert.match(source,/active === null && !error/);
  assert.match(source,/roster.map\(\(player\) =>/);
  assert.match(source,/if \(!conditions\) return <div key=\{player.id\} role="row"/);
  assert.match(source,/Retry setup save/);
});

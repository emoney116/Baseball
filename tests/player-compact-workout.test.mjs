import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const live = readFileSync('app/components/PlayerLiveEntry.tsx', 'utf8');
test('individual workout renders every set without a set selector', () => {
  assert.match(live, /Array.from\(\{length: s.exercise!.sets\}/);
  assert.match(live, /fixedSetNumber=\{i \+ 1\}/);
  assert.match(live, /workout && !fixedSetNumber/);
  assert.match(live, /const nextSet = fixedSetNumber \?\?/);
  assert.match(live, /stationEntries.find\(e => Number\(e.payload.setNumber\) === fixedSetNumber\)/);
  assert.match(live, /!!editing && !editing.editable/);
});
test('workout headings avoid accidental starter title and retain shared entry controls', () => {
  assert.match(live, /session.domain === "workout" \? "Weight Room" : session.title/);
  assert.match(live, /<WeightRoomInlineSetCell/);
  const workspace = readFileSync('app/ClubhouseWorkspace.tsx', 'utf8');
  assert.doesNotMatch(workspace, /Lower Body Strength/);
});

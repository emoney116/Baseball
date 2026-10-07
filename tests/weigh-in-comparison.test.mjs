import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { weighInComparison, signedWeighInPercent } from '../app/lib/weighInComparison.ts';
const row = (date, bodyWeight, playerId = 'p', updatedAt = date) => ({ date, bodyWeight, playerId, updatedAt });
test('weigh-in comparisons use actual chronological measurements, never roster weight or future records', () => {
  const result = weighInComparison([row('2026-09-01', 100), row('2026-10-01', 110), row('2026-10-06', 121), row('2026-10-07', 150), row('2026-10-05', 500, 'other')], 'p', '2026-10-06', 121);
  assert.deepEqual(result, { previous: 110, first: 100, fromPrevious: 10, fromFirst: 21 });
});
test('missing, zero and nonfinite measurements cannot establish a baseline', () => {
  const result = weighInComparison([row('2026-09-01', undefined), row('2026-09-02', 0), row('2026-09-03', NaN), row('2026-09-04', Infinity)], 'p', '2026-10-06', 150);
  assert.deepEqual(result, { previous: undefined, first: undefined, fromPrevious: undefined, fromFirst: undefined });
  assert.equal(signedWeighInPercent(result.fromFirst), '--');
});
test('unverified roster copies are not weigh-in baselines', () => {
  const result = weighInComparison([row('2026-09-15', 113.4), { ...row('2026-09-22', 100), notes: 'Unverified roster-copy: old bug' }, row('2026-10-06', 115)], 'p', '2026-10-06', 115);
  assert.equal(result.previous, 113.4);
  assert.ok(Math.abs(result.fromPrevious - 1.4109347442680722) < 0.00001);
});
test('current day is not previous, and first actual weigh-in is its own baseline', () => {
  assert.deepEqual(weighInComparison([row('2026-10-06', 150)], 'p', '2026-10-06', 150), { previous: undefined, first: 150, fromPrevious: undefined, fromFirst: 0 });
  assert.equal(signedWeighInPercent(10), '+10.0%');
  assert.equal(signedWeighInPercent(-10), '-10.0%');
  assert.equal(signedWeighInPercent(-0.001), '0.0%');
});
test('Asher comparison skips the copied 175 lb and retains his measured 166.6 lb baseline', () => {
  const result = weighInComparison([row('2026-09-15', 166.6), { ...row('2026-09-22', 175), notes: 'Unverified roster-copy: old set save' }, row('2026-10-06', 166.1)], 'p', '2026-10-06', 166.1);
  assert.equal(result.previous, 166.6);
  assert.equal(signedWeighInPercent(result.fromPrevious), '-0.3%');
});
test('browser roster sync stores integer compatibility weight and preserves exact decimal metadata', () => {
  const source = readFileSync('app/api/roster/sync/route.ts', 'utf8');
  assert.match(source, /weight: typeof player.weight === "number" \? Math.round\(player.weight\) : null/);
  assert.match(source, /weightLb: player.weight \?\? null/);
  assert.match(source, /\.\.\.existingPlayerById.get\(player.id \?\? ""\)\?\.metadata/);
});
test('workout set entry preserves measured body weight without a roster-weight fallback', () => {
  const source = readFileSync('app/ClubhouseWorkspace.tsx', 'utf8');
  const entry = source.slice(source.indexOf('  function addWorkoutEntry('), source.indexOf('  function logWeightRoomWeighIns('));
  assert.match(entry, /bodyWeight: existingSession\?\.bodyWeight/);
  assert.doesNotMatch(entry, /bodyWeight: player\.weight/);
});

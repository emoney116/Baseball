import test from 'node:test';
import assert from 'node:assert/strict';
import { initialWorkoutResult, workoutBaselineChange } from '../app/lib/workoutBaseline.ts';
const conditions = { key: 'bench', mode: 'FIXED_LOAD_TIMED_REPS', durationSeconds: 60, loadLb: 45 };
const sessions = [{ id: 'first', date: '2026-09-15' }, { id: 'later', date: '2026-09-22' }];
const entry = (sessionId, reps, extra = {}) => ({ sessionId, reps, playerId: 'p', testConditions: conditions, ...extra });
test('initial result uses best attempt of earliest comparable measured day, not latest day or prescribed load', () => {
  const result = initialWorkoutResult([entry('first', 20, { weight: 45 }), entry('first', 22), entry('later', 30)], sessions, 'p', '2026-10-27', conditions);
  assert.deepEqual(result, { date: '2026-09-15', value: 22 });
  assert.equal(workoutBaselineChange(20, 25), 25);
  assert.equal(workoutBaselineChange(20, 15), -25);
});
test('incompatible load, duration, side, player and unmeasured sessions cannot supply baselines', () => {
  for (const extra of [{ playerId: 'other' }, { testConditions: { ...conditions, loadLb: 95 } }, { testConditions: { ...conditions, durationSeconds: 30 } }, { testSide: 'Left' }, { sessionId: 'missing' }, { status: 'Skipped' }, { reps: undefined, weight: 45 }]) {
    assert.equal(initialWorkoutResult([entry('first', 20, extra)], sessions, 'p', '2026-10-27', conditions), undefined);
  }
  assert.equal(initialWorkoutResult([entry('first', 20)], sessions, 'p', '2026-09-15', conditions), undefined);
});
test('zero baselines are preserved but do not generate infinite percentages; missing differs from zero', () => {
  assert.equal(initialWorkoutResult([entry('first', 0)], sessions, 'p', '2026-10-27', conditions).value, 0);
  assert.equal(workoutBaselineChange(0, 5), undefined);
  assert.equal(workoutBaselineChange(10, 0), -100);
  assert.equal(workoutBaselineChange(10, undefined), undefined);
});
test('hold duration growth is positive and is never read from a load', () => {
  const hold = { key: 'hold', mode: 'MAX_DURATION', loadLb: 25 };
  const result = initialWorkoutResult([entry('first', 5, { value: 40, weight: 25, testConditions: hold })], sessions, 'p', '2026-10-27', hold);
  assert.equal(result.value, 40);
  assert.equal(workoutBaselineChange(40, 50), 25);
});

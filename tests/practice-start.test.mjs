import assert from 'node:assert/strict';
import test from 'node:test';
import { localPracticeStartFields, validatePracticeStart } from '../app/lib/practiceStart.ts';

test('Start Practice defaults to the current local minute, not 6 PM', () => {
  const now = new Date(2026, 8, 6, 14, 37, 25);
  const fields = localPracticeStartFields(now);
  assert.deepEqual(fields, { date: '2026-09-06', time: '14:37' });
  assert.equal(validatePracticeStart(fields.date, fields.time, now).startedAt, new Date(2026, 8, 6, 14, 37).toISOString());
});

for (const [label, now, expected] of [
  ['local midnight', new Date(2026, 8, 6, 0, 4), { date: '2026-09-06', time: '00:04' }],
  ['local year end', new Date(2026, 11, 31, 23, 59), { date: '2026-12-31', time: '23:59' }],
  ['leap day', new Date(2028, 1, 29, 9, 5), { date: '2028-02-29', time: '09:05' }],
]) {
  test(`Practice date and time retain ${label}`, () => {
    assert.deepEqual(localPracticeStartFields(now), expected);
    assert.equal(validatePracticeStart(expected.date, expected.time, now).startedAt, now.toISOString());
  });
}

for (const [date, time] of [['2026-09-06', '18:00'], ['2026-09-07', '00:00']]) {
  test(`Practice cannot start in the future: ${date} ${time}`, () => {
    const result = validatePracticeStart(date, time, new Date(2026, 8, 6, 14));
    assert.match(result.error, /future/);
    assert.equal(result.startedAt, undefined);
  });
}

for (const [date, time] of [['', ''], ['2026-02-30', '12:00'], ['2026-02-29', '12:00'], ['2026-13-01', '12:00'], ['2026-09-06', '24:00'], ['2026-09-06', '14:60'], ['2026-9-6', '14:00'], ['2026-09-06', '']]) {
  test(`Invalid Practice date/time fails without throwing: ${date} ${time}`, () => {
    assert.match(validatePracticeStart(date, time).error, /valid/);
  });
}

test('An earlier actual Practice start remains valid', () => {
  assert.equal(validatePracticeStart('2026-09-06', '13:00', new Date(2026, 8, 6, 14)).startedAt, new Date(2026, 8, 6, 13).toISOString());
});

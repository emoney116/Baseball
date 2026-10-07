import test from 'node:test';
import assert from 'node:assert/strict';
import { timedAttemptDropoff,formatTimedAttemptDropoff } from '../app/lib/workoutTimedChange.ts';

test('time drop-off compares the second elapsed time with the first, not the best time',()=>{
  assert.equal(timedAttemptDropoff(60,66),10);
  assert.equal(formatTimedAttemptDropoff(timedAttemptDropoff(60,66)),'Drop-off 10.0%');
  assert.equal(formatTimedAttemptDropoff(timedAttemptDropoff(65,68)),'Drop-off 4.6%');
});
test('faster and equal second attempts have clear labels',()=>{
  assert.equal(timedAttemptDropoff(60,54),-10);
  assert.equal(formatTimedAttemptDropoff(-10),'10.0% faster');
  assert.equal(formatTimedAttemptDropoff(timedAttemptDropoff(60,60)),'Drop-off 0.0%');
  assert.equal(formatTimedAttemptDropoff(-0.001),'Drop-off 0.0%');
});
test('missing, zero, negative, invalid or overflowed times do not produce percentages',()=>{
  for(const first of [undefined,0,-1,NaN,Infinity])assert.equal(timedAttemptDropoff(first,60),undefined);
  for(const second of [undefined,0,-1,NaN,Infinity])assert.equal(timedAttemptDropoff(60,second),undefined);
  assert.equal(timedAttemptDropoff(Number.MIN_VALUE,Number.MAX_VALUE),undefined);
});

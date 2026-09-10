import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Practice mode switch delegates one route transition without stale station callbacks', () => {
  const page = fs.readFileSync('app/page.tsx', 'utf8');
  const callback = page.slice(page.indexOf('function changeMode(nextMode:'), page.indexOf('function selectSession(row:'));
  assert.match(callback, /onMode\(nextMode\)/);
  assert.doesNotMatch(callback, /onHittingStation|onPitchingStation|onSelectPlayer/);
});
test('Live BP enters directly and prepares its round before the first pitch', () => {
  const source = fs.readFileSync('app/components/LiveBpConsole.tsx', 'utf8');
  assert.doesNotMatch(source, /Start Live BP|Apply Settings|setConfig/);
  assert.match(source, /operation: savedRound \? "configure" : "start"/);
  assert.match(source, /version: savedRound\?\.version \?\? 0/);
  assert.match(source, /requestId: pending\.current\?\.id/);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Player Practice uses the same started-practice selection as staff', () => {
  const shell = readFileSync('app/components/PlayerShell.tsx','utf8');
  assert.match(shell, /currentStartedPractice\(data\.practices\)/);
  assert.doesNotMatch(shell, /practices\.find\(practice => !practice\.endedAt\)/);
});

test('Player caption, roster and claim labels exclude null as well as missing jerseys', () => {
  const shell = readFileSync('app/components/PlayerShell.tsx','utf8');
  const claims = readFileSync('app/components/PlayerAccountLinksPanel.tsx','utf8');
  assert.match(shell, /context\.jersey != null/);
  assert.match(shell, /showJersey=\{p\.jersey != null\}/);
  assert.match(claims, /player\.jerseyNumber != null/);
});

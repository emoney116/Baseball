import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('empty Game Center explains the empty library', () => {
  const source=readFileSync(new URL('../app/components/TeamFeatureLayouts.tsx',import.meta.url),'utf8');
  assert.match(source,/games\.length === 0 && <p>No games recorded this season\.<\/p>/);
});

test('Game Center does not put shared bottom navigation in stretching page flow', () => {
  const css=readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');
  assert.doesNotMatch(css,/\.ops-shell:has\(\.game-workstation-page\) \.bottom-nav\s*\{[^}]*position:\s*relative/);
});

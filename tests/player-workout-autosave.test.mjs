import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('player input retains focused autosave and a dirty-only safety timer', () => {
  const source = readFileSync('app/components/TeamTrainingViews.tsx', 'utf8');
  assert.match(source, /if \(!autoSaveDelay \|\| disabled \|\| !dirty\) return/);
  assert.match(source, /setInterval\(\(\) => saveRef.current\(\), 15000\)/);
  assert.match(source, /clearInterval\(timer\)/);
  assert.match(source, /removeEventListener\("visibilitychange", resume\)/);
});

test('weigh-in places spaced units after the input and saves without blur', () => {
  const source = readFileSync('app/components/PlayerLiveEntry.tsx', 'utf8');
  assert.match(source, /setTimeout\(\(\) => saveWeightRef.current\(\), 15000\)/);
  assert.match(source, /<span>lb<\/span><\/label>/);
  assert.match(readFileSync('app/globals.css','utf8'), /\.player-weigh-in-field \{[^}]*gap: 10px/);
});

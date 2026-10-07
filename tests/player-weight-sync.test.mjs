import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { syncMeasuredProfileWeight } from '../app/lib/playerWeightSync.ts';
test('authorized weigh-in profile sync uses latest measurement and preserves decimal pounds and metadata', async () => {
  const writes = [];
  let sessionReads = 0;
  const db = { from(table) {
    const query = { select() { return this; }, eq(field, value) { if (table === 'players') assert.equal(value, 'player'); return this; }, gt() { return this; }, or() { return this; }, order() { return this; }, limit() { return this; },
      async single() { return { data: table === 'players' ? { metadata: { avatarColor: 'red' } } : { player_id: 'player' }, error: null }; },
      async maybeSingle() { sessionReads++; return { data: { body_weight: '166.1' }, error: null }; },
      update(value) { writes.push(value); return { async eq() { return { error: null }; } }; } };
    return query;
  } };
  await syncMeasuredProfileWeight(db, 'authorized-session');
  assert.equal(sessionReads, 1);
  assert.deepEqual(writes, [{ weight: 166, metadata: { avatarColor: 'red', weightLb: 166.1 } }]);
});
test('missing saved session cannot write a player profile', async () => {
  const db = { from(table) { assert.equal(table, 'workout_sessions'); return { select() { return this; }, eq() { return this; }, async single() { return { data: null, error: new Error('missing') }; } }; } };
  await assert.rejects(syncMeasuredProfileWeight(db, 'invalid'), /resolve saved weigh-in/);
});
test('player profile synchronization is only after successful authorized weigh-in RPC', () => {
  const route = readFileSync('app/api/player/live-entry/route.ts', 'utf8');
  assert.ok(route.indexOf('await syncMeasuredProfileWeight(db, data)') > route.indexOf('if(error) throw new PlayerLinkError'));
  assert.match(route, /write_player_live_weigh_in/);
});

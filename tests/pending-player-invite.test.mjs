import test from 'node:test';
import assert from 'node:assert/strict';
import { pendingPlayerInvitePath } from '../app/lib/pendingPlayerInvite.ts';
test('pending invitation resumes only a valid internal player-invite path', () => {
  const token = 'a'.repeat(43);
  assert.equal(pendingPlayerInvitePath(token), `/join/player/${token}`);
  for (const bad of [undefined, '', 'https://example.com', '//example.com', '../admin', 'a'.repeat(44)]) assert.equal(pendingPlayerInvitePath(bad), undefined);
});

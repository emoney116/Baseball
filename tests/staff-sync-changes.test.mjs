import test from 'node:test';
import assert from 'node:assert/strict';
import { staffDataChanged } from '../app/lib/staffSyncChanges.ts';

test('practice and game edits do not resend unchanged multi-organization staff', () => {
  const before = { staffMembers: [{ id: 'a', organizationId: 'one' }, { id: 'b', organizationId: 'two' }], staffTeamMemberships: [{ id: 'm', teamId: 'old-team' }] };
  assert.equal(staffDataChanged(before, structuredClone(before)), false);
  assert.equal(staffDataChanged(before, { ...before, staffMembers: [...before.staffMembers].reverse() }), false);
});
test('staff membership and identity edits still require authorized sync', () => {
  const before = { staffMembers: [{ id: 'a', displayName: 'Coach' }], staffTeamMemberships: [{ id: 'm', active: true }] };
  assert.equal(staffDataChanged(before, { ...before, staffMembers: [{ id: 'a', displayName: 'Coach A' }] }), true);
  assert.equal(staffDataChanged(before, { ...before, staffTeamMemberships: [{ id: 'm', active: false }] }), true);
  assert.equal(staffDataChanged(before, { ...before, staffTeamMemberships: [] }), true);
});

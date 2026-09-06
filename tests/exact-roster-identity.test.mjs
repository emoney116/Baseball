import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { exactRosterWorkingData, labelExactRoster, playerSelectionLabel } from '../app/lib/exactRosterIdentity.ts';
import { sampleData } from '../app/data/sampleData.ts';
import { liveSyncDelta } from '../app/lib/liveSyncDelta.ts';
import { canProfileAccessPlayerSelf } from '../app/lib/playerAccountLinks.ts';

const a = { ...sampleData.players[0], id: 'exact-a', name: 'Mylo White', createdAt: '2026-08-01T00:00:00Z' };
const b = { ...a, id: 'exact-b', createdAt: '2026-08-02T00:00:00Z' };
function fixture() {
  return { ...structuredClone(sampleData), players: [a, b],
    hittingSessions: [{ id: 'station-a', hitterId: a.id }, { id: 'station-b', hitterId: b.id }],
    hittingEvents: [{ id: 'rep-a', sessionId: 'station-a', hitterId: a.id }, { id: 'rep-b', sessionId: 'station-b', hitterId: b.id }],
    playerTeamMemberships: [{ id: 'membership-a', playerId: a.id }, { id: 'membership-b', playerId: b.id }],
    attendance: [{ id: 'attendance-a', playerId: a.id }, { id: 'attendance-b', playerId: b.id }],
    weightRoomWorkoutGroupMembers: [{ id: 'group-a', playerId: a.id }, { id: 'group-b', playerId: b.id }],
    workoutEntries: [{ id: 'set-a', playerId: a.id }, { id: 'set-b', playerId: b.id }],
  };
}
test('coach working roster preserves both same-name exact identities', () => {
  const data = fixture(), result = exactRosterWorkingData(data, [a.id]);
  assert.deepEqual(result.players.map(p => p.id), [a.id, b.id]);
  assert.deepEqual(result.players.map(p => p.name), [a.name, b.name]);
  assert.match(result.players[0].identityLabel, /Account linked/);
  assert.doesNotMatch(result.players[1].identityLabel, /Account linked/);
  assert.equal(data.players[0].identityLabel, undefined);
});
for (const key of ['hittingSessions', 'hittingEvents', 'playerTeamMemberships', 'attendance', 'pitchingSessions', 'pitchEvents', 'defenseSessions', 'defenseEvents', 'weightRoomWorkoutGroupMembers', 'workoutSessions', 'workoutEntries', 'games', 'gameEvents', 'plateAppearances', 'coachNotes', 'developmentGoals']) {
  test(`exact working roster does not rewrite ${key}`, () => {
    const data = fixture();
    assert.equal(exactRosterWorkingData(data, [a.id])[key], data[key]);
  });
}
test('record labels remain stable across order, activity counts and account status', () => {
  const first = labelExactRoster([a, b], [a.id]);
  const second = labelExactRoster([b, a], [b.id]);
  assert.equal(first[0].identityLabel.split(' - ')[0], second[1].identityLabel);
  const data = fixture();
  data.hittingEvents.push(...Array.from({length: 100}, (_, i) => ({id: `extra-${i}`, hitterId: b.id})));
  assert.equal(exactRosterWorkingData(data, [a.id]).players[0].identityLabel, first[0].identityLabel);
});
test('case-only display duplicates remain independent with disambiguating labels', () => {
  const labels = labelExactRoster([a, {...b, name: ' MYLO WHITE '}]);
  assert.equal(labels.length, 2);
  assert.notEqual(labels[0].identityLabel, labels[1].identityLabel);
});
test('selection labels never expose UUIDs and unique names stay unchanged', () => {
  const rows = labelExactRoster([a, b]);
  for (const row of rows) assert.ok(!playerSelectionLabel(row).includes(row.id));
  assert.equal(playerSelectionLabel(labelExactRoster([a])[0]), a.name);
});
test('name or linked presentation never grants access to the other record', () => {
  const links = [{playerId: a.id, relationshipType: 'PLAYER', status: 'APPROVED'}];
  assert.equal(canProfileAccessPlayerSelf(links, a.id), true);
  assert.equal(canProfileAccessPlayerSelf(links, b.id), false);
});
test('label refresh does not cause baseball row upserts', () => {
  const data = fixture();
  const delta = liveSyncDelta(exactRosterWorkingData(data), exactRosterWorkingData(data, [a.id]));
  for (const key of ['hittingEvents', 'hittingSessions', 'workoutEntries', 'weightRoomWorkoutGroupMembers', 'attendance']) assert.deepEqual(delta[key], []);
});
test('coach repository does not use read-only presentation canonicalization', () => {
  const source = readFileSync(new URL('../app/data/supabaseRepository.ts', import.meta.url), 'utf8');
  assert.match(source, /return exactRosterWorkingData/);
  assert.doesNotMatch(source, /canonicalizeAppDataPlayerIdentities/);
});
test('access and invite selectors reuse exact-ID disambiguation after staff authorization', () => {
  for (const path of ['player-access', 'player-invitations']) {
    const source = readFileSync(new URL(`../app/api/${path}/route.ts`, import.meta.url), 'utf8');
    assert.match(source, /labelExactRoster/);
    assert.match(source, /playerSelectionLabel\(p\)/);
    assert.match(source, /assertPlayerLinkTeamManager/);
    assert.match(source, /playerId: p.id/);
  }
});

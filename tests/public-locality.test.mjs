import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { recentHomeScores } from '../app/lib/homeScores.ts';

test('public locality entry has no provider dependency or automatic confirmation copy', () => {
  const source = readFileSync('app/components/PublicLocalityFields.tsx', 'utf8');
  assert.match(source, /Enter from your own records/);
  assert.match(source, /aria-label="Public city"/);
  assert.match(source, /aria-label="Public state"/);
  assert.doesNotMatch(source, /ResolvedPlace|addressComponents|formattedAddress|fetch\(|providerPlaceId/);
});

test('creation and management bind locality to existing first-party fields', () => {
  const page = readFileSync('app/page.tsx', 'utf8');
  const manage = readFileSync('app/org/[id]/manage/OrgManageClient.tsx', 'utf8');
  assert.match(page, /PublicLocalityFields city=\{form.organizationCity\}/);
  assert.match(page, /PublicLocalityFields city=\{form.teamCity\}/);
  assert.match(manage, /PublicLocalityFields city=\{draft.city\}/);
  assert.match(manage, /PublicLocalityFields city=\{draft.teamCity\}/);
  assert.match(manage, /city: generalDraft.city/);
  assert.match(manage, /city: draft.teamCity/);
});

test('city/state-only saves do not resubmit an unchanged historical logo', () => {
  const manage = readFileSync('app/org/[id]/manage/OrgManageClient.tsx', 'utf8');
  assert.match(manage, /generalDraft.logoUrl !== \(data.organization.logoUrl \?\? ""\)/);
});

test('score filtering preserves optional field location without inventing one', () => {
  const game = { id: 'a', teamId: 'team', teamName: 'Team', opponent: 'Opponent', ourScore: 7, opponentScore: 4, date: '2026-09-09', result: 'W' };
  assert.equal(recentHomeScores([{ ...game, location: 'MCA Field' }], ['team'])[0].location, 'MCA Field');
  assert.equal(recentHomeScores([game], ['team'])[0].location, undefined);
});

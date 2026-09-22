import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../app/player-invites/PlayerQrInvites.tsx', import.meta.url), 'utf8');

test('QR recovery includes unlinked invitations without a current printable token', () => {
  assert.match(source, /latest\(p.membershipId\)\?\.status !== "ACCEPTED" && !visibleLinks.some/);
  assert.match(source, /links\[p.membershipId\]\?\.id === latest\(p.membershipId\)\?\.id/);
  assert.match(source, /"Regenerate Missing QR Codes"/);
  assert.match(source, /action: "resend", id: invite.id/);
  assert.match(source, /Previous codes for these players will stop working/);
});

test('printing uses available QR codes without regeneration and removes the header paragraph', () => {
  assert.match(source, /disabled=\{busy \|\| !visibleLinks.length\} onClick=\{\(\) => window.print\(\)\}/);
  assert.doesNotMatch(source, /Each QR is a private, single-use credential/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('QR printing paginates fifteen whole tickets per sheet', () => {
  const component = readFileSync('app/player-invites/PlayerQrInvites.tsx','utf8');
  assert.match(component, /Math.ceil\(visibleLinks.length \/ 15\)/);
  assert.match(component, /visibleLinks.slice\(page \* 15, \(page \+ 1\) \* 15\)/);
  const css = readFileSync('app/player-invites/invites.css','utf8');
  assert.match(css, /grid-template-rows: repeat\(5, 49mm\)/);
  assert.match(css, /page-break-inside: avoid/);
  assert.match(css, /\.qr-invite-grid \{ display: none !important; \}/);
  // US Letter printable height: 279.4mm minus two 10mm margins.
  assert.ok(5 * 49 + 4 * 2 < 279.4 - 20);
});

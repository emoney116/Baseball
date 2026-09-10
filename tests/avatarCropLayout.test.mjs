import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('avatar crop keeps actions outside its scrollable body', () => {
  const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const modal = page.slice(page.indexOf('function AvatarCropModal('), page.indexOf('async function cropAvatarImage('));
  assert.match(modal, /className="modal-body avatar-crop-body"/);
  assert.match(modal, /<\/div>\s*<div className="modal-footer-slot">\s*<div className="modal-actions">/);
  assert.match(modal, /onClick=\{onApply\}/);
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  assert.match(css, /\.modal-backdrop\.avatar-crop-backdrop\s*\{[^}]*height: 100dvh;[^}]*bottom: auto;/);
});

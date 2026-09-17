import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync('supabase/templates/confirmation.html', 'utf8');
const theme = readFileSync('app/theme.css', 'utf8');
const globals = readFileSync('app/globals.css', 'utf8');

test('confirmation email uses the app palette and existing wordmark without gradients or glow', () => {
  for (const color of ['#111111', '#171717', '#202020', '#ffffff', '#d6d6d6', '#9a9a9a']) {
    assert.ok(theme.includes(color), `${color} is an app token`);
    assert.ok(html.includes(color), `${color} is used in the email`);
  }
  assert.ok(globals.includes('--brand-primary: #760e1e'));
  assert.ok(html.includes('background-color:#760e1e;color:#ffffff'));
  assert.match(html, /https:\/\/www\.clubhouse9sports\.com\/brand\/clubhouse9-wordmark\.png/);
  assert.doesNotMatch(html, /gradient|box-shadow|#(?:f4f4f5|18181b|e4e4e7|52525b|c22f62)\b/i);
});

test('email retains a single copyable OTP, expiry, and the original confirmation destination', () => {
  assert.equal(html.match(/\{\{ \.Token \}\}/g)?.length, 1);
  assert.equal(html.match(/\{\{ \.ConfirmationURL \}\}/g)?.length, 1);
  assert.match(html, /This code expires in 10 minutes/);
  assert.match(html, /Never share your code/);
  assert.match(html, /font:600 32px/);
});

test('email keeps accessible structure and explicit dark-mode colors', () => {
  assert.match(html, /<html lang="en" dir="ltr">/);
  assert.match(html, /<body[^>]*>\s*<table lang="en" dir="ltr" role="presentation"/);
  assert.ok([...html.matchAll(/<table\b[^>]*>/g)].every(([tag]) => tag.includes('role="presentation"')));
  assert.ok([...html.matchAll(/<img\b[^>]*>/g)].every(([tag]) => /alt="[^"]+"/.test(tag)));
  assert.equal(html.match(/<h1\b/g)?.length, 1);
  assert.match(html, /<title>Confirm your Clubhouse 9 email<\/title>/);
  assert.match(html, /prefers-color-scheme: dark/);
  assert.match(html, /max-width:440px/);
});

test('email text and action have readable contrast', () => {
  const luminance = hex => {
    const channels = hex.match(/\w\w/g).map(part => parseInt(part, 16) / 255)
      .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  for (const [text, background] of [['d6d6d6', '171717'], ['9a9a9a', '171717'], ['9a9a9a', '111111'], ['ffffff', '202020'], ['ffffff', '760e1e']]) {
    assert.ok((luminance(text) + 0.05) / (luminance(background) + 0.05) >= 4.5);
  }
});

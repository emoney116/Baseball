import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import postcss from 'postcss';

const css = readFileSync('app/auth.css', 'utf8');
const form = readFileSync('app/components/AuthenticationForm.tsx', 'utf8');
const preview = readFileSync('app/auth-preview/preview.tsx', 'utf8');
const loading = readFileSync('app/components/AppLoading.tsx', 'utf8');

test('auth screens center within available height without hiding keyboard or error overflow', () => {
  const root = postcss.parse(css);
  const screen = root.nodes.find(node => node.type === 'rule' && node.selector === '.account-screen');
  const declarations = Object.fromEntries(screen.nodes.map(node => [node.prop, node.value]));
  assert.equal(declarations['min-height'], '100dvh');
  assert.equal(declarations['justify-content'], 'center');
  assert.equal(declarations.margin, '0 auto');
  assert.doesNotMatch(css, /overflow(?:-y)?:\s*(?:hidden|clip)/);
  assert.match(css, /@media \(max-height: 600px\)/);
  assert.match(css, /input \{ height: 44px; \}/);
});

test('compact signup retains every field, validation and accessible password hints', () => {
  for (const value of ['given-name', 'family-name', 'type="email"', 'current-password', 'new-password', 'Passwords do not match.', 'minLength={8}', 'data-step={step}']) {
    assert.ok(form.includes(value), value);
  }
  assert.match(form, /id=\{passwordHintId\}/);
  assert.match(form, /aria-describedby=\{passwordHintId\}/);
  assert.match(css, /\[data-step="signup"\] \.account-auth__passwords \{ grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\); \}/);
  assert.match(css, /\.account-otp__slot \{[^}]*height: 54px/);
});

test('entry modes use a stable logo frame and a distinct flat maroon selection', () => {
  assert.match(css, /button\[aria-pressed="true"\] \{ color: #fff; background: var\(--brand-primary\);/);
  assert.match(css, /calc\(\(100svh - 510px\) \/ 2\)/);
  assert.match(css, /justify-content: flex-start/);
  postcss.parse(css).walkRules(rule => {
    if (rule.selector.includes('.account-screen__brand') && rule.selector.includes('[data-step="signup"]')) {
      assert.ok(rule.selector.includes('[data-step="login"]'), 'logo sizing must be shared by both entry modes');
    }
  });
  assert.match(form, /aria-pressed=\{step === "login"\}/);
  assert.match(form, /aria-pressed=\{step === "signup"\}/);
});

test('preview toolbar participates in layout instead of adding a guessed height offset', () => {
  assert.match(preview, /className="auth-preview"/);
  assert.match(preview, /aria-label="Interface preview"/);
  assert.doesNotMatch(preview, /calc\(100svh - 100px\)/);
  assert.match(css, /\.auth-preview \{[^}]*grid-template-rows: auto 1fr/);
  assert.match(css, /\.auth-preview > :is\(\.account-screen, \.clubhouse-loading\) \{ min-height: 0; \}/);
});

test('diamond loader remains indeterminate, accessible and reduced-motion aware', () => {
  assert.match(loading, /pathLength="100"/);
  assert.match(loading, /<svg[^>]*aria-hidden="true"/);
  assert.match(loading, /<span className="sr-only" role="status">\{label\}/);
  assert.match(loading, /setSlow\(true\), 8000/);
  assert.match(loading, /onClick=\{onRetry\}/);
  assert.doesNotMatch(loading, /aria-valuenow|role="progressbar"/);
  const reducedMotion = css.split('@media (prefers-reduced-motion: reduce)')[1];
  for (const value of ['.clubhouse-loading__runner', '.clubhouse-loading__bases > path', '.clubhouse-loading__mark', 'animation: none']) {
    assert.ok(reducedMotion.includes(value), value);
  }
});

test('only the diamond controls centering, not a caption or delayed retry message', () => {
  assert.doesNotMatch(loading + css, /clubhouse-loading__(?:caption|dots|rule)/);
  assert.match(css, /\.clubhouse-loading__content \{ position: relative; display: grid; place-items: center;/);
  assert.match(css, /\.clubhouse-loading__help \{ position: absolute; top: calc\(100% \+ 24px\);/);
  assert.match(css, /\.auth-preview > \.clubhouse-loading \{ min-height: 100svh; min-height: 100dvh; \}/);
  assert.match(css, /\.auth-preview:has\(> \.clubhouse-loading\) > \.auth-preview__toolbar \{ position: absolute;/);
});

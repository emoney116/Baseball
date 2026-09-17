import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEmailAuth, authCallbackUrl, safeAuthNext, authErrorMessage } from '../app/lib/emailAuth.ts';
import { createAuthFetch } from '../app/lib/authFetch.ts';

function fixture(overrides = {}) {
  const calls = [];
  const auth = Object.fromEntries(['signUp', 'signInWithPassword', 'verifyOtp', 'resend', 'resetPasswordForEmail', 'updateUser'].map(name => [name, async (...args) => {
    calls.push({ name, args });
    return overrides[name] ?? { data: { session: { user: { id: 'test' } } }, error: null };
  }]));
  return { calls, api: createEmailAuth(auth, 'https://www.clubhouse9sports.com') };
}
test('signup waits for confirmation even when a user record is returned', async () => {
  const { api, calls } = fixture({ signUp: { data: { user: { id: 'unconfirmed' }, session: null }, error: null } });
  assert.deepEqual(await api.signUp({ email: ' player@example.com ', password: 'sample-password', firstName: ' Sample ', lastName: ' Player ' }), { status: 'verification-required' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].args[0].email, 'player@example.com');
  assert.equal(calls[0].args[0].options.data.display_name, 'Sample Player');
  assert.equal(new URL(calls[0].args[0].options.emailRedirectTo).origin, 'https://www.clubhouse9sports.com');
});
test('signup advances directly only when Supabase returns a session', async () => {
  assert.deepEqual(await fixture().api.signUp({ email: 'player@example.com', password: 'sample-password' }), { status: 'authenticated' });
});
test('email code verification uses the provider email flow and requires a session', async () => {
  const { api, calls } = fixture();
  await api.verifyEmail(' player@example.com ', '123456');
  assert.deepEqual(calls[0], { name: 'verifyOtp', args: [{ email: 'player@example.com', token: '123456', type: 'email' }] });
  await assert.rejects(fixture({ verifyOtp: { data: { session: null }, error: null } }).api.verifyEmail('player@example.com', '123456'), /did not complete/);
});
test('incomplete and nonnumeric OTPs never reach the provider', async () => {
  const { api, calls } = fixture();
  for (const code of ['', '12345', '1234567', 'abcdef']) await assert.rejects(api.verifyEmail('a@example.com', code), /six-digit/);
  assert.equal(calls.length, 0);
});
test('invalid and expired codes fail closed with an actionable error', async () => {
  const error = Object.assign(new Error('provider detail'), { code: 'otp_expired' });
  await assert.rejects(fixture({ verifyOtp: { error } }).api.verifyEmail('a@example.com', '123456'), error);
  assert.match(authErrorMessage(error), /expired/);
});
test('resend preserves signup type and invitation destination', async () => {
  const { api, calls } = fixture(); const next = `/join/${'a'.repeat(43)}`;
  await api.resendVerification('a@example.com', next);
  assert.equal(calls[0].args[0].type, 'signup');
  assert.equal(new URL(calls[0].args[0].options.emailRedirectTo).searchParams.get('next'), next);
});
test('reset links return to the dedicated password screen through PKCE callback', async () => {
  const { api, calls } = fixture(); await api.resetPassword('a@example.com');
  const url = new URL(calls[0].args[1].redirectTo);
  assert.equal(url.pathname, '/auth/callback'); assert.equal(url.searchParams.get('next'), '/auth/reset-password');
});
test('callback allows only known local destinations', () => {
  for (const path of ['https://evil.test', '//evil.test', '/\\evil.test', '/admin', '/join/short', '/auth/reset-password?next=https://evil.test']) assert.equal(safeAuthNext(path), '/');
  for (const path of ['/', '/auth/reset-password', `/join/${'a'.repeat(43)}`, `/join/player/${'b'.repeat(43)}`]) assert.equal(safeAuthNext(path), path);
  assert.equal(new URL(authCallbackUrl('http://localhost:3001')).origin, 'http://localhost:3001');
});
test('unconfirmed sign-in retains the provider error code for the verification step', async () => {
  const error = Object.assign(new Error('Email not confirmed'), { code: 'email_not_confirmed' });
  await assert.rejects(fixture({ signInWithPassword: { error } }).api.signIn('a@example.com', 'sample-password'), error);
});
test('UI contains OTP accessibility, busy guards, recovery and reduced motion', () => {
  const form = readFileSync(new URL('../app/components/AuthenticationForm.tsx', import.meta.url), 'utf8');
  for (const text of ['OTPInput', 'one-time-code', 'inputMode="numeric"', 'pasteTransformer', 'inFlight.current', 'resendAt.current', 'result.status === "authenticated"', 'email_not_confirmed']) assert.ok(form.includes(text), text);
  const css = readFileSync(new URL('../app/auth.css', import.meta.url), 'utf8');
  assert.match(css, /prefers-reduced-motion/);
  const page = readFileSync(new URL('../app/ClubhouseWorkspace.tsx', import.meta.url), 'utf8');
  assert.match(page, /loadSequenceRef/); assert.match(page, /30000/); assert.match(page, /<AppLoading/);
  const preview = readFileSync(new URL('../app/auth-preview/page.tsx', import.meta.url), 'utf8');
  assert.match(preview, /NODE_ENV !== "development"/);
});

test('a stalled auth request aborts without changing non-auth fetches', async () => {
  const timed = createAuthFetch((_input, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(init.signal.reason));
  }), 5);
  await assert.rejects(timed('https://example.test/auth/v1/token'), /timed out/);
  const init = { headers: { Accept: 'application/json' } };
  let seen;
  const normal = createAuthFetch(async (_input, options) => { seen = options; return new Response('{}'); }, 5);
  await normal('https://example.test/rest/v1/players', init);
  assert.equal(seen, init);
});

test('auth fetch preserves caller cancellation', async () => {
  const controller = new AbortController(); controller.abort();
  const timed = createAuthFetch(async (_input, init) => { assert.equal(init.signal.aborted, true); throw init.signal.reason; });
  await assert.rejects(timed('https://example.test/auth/v1/user', { signal: controller.signal }), /abort/i);
});

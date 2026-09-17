import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('pitch map distinguishes located pitches from tracked hard-contact samples', () => {
  const page = readFileSync('app/page.tsx', 'utf8');
  assert.match(page, /action === "Ball in play" && entry\.event\.contactQuality\) stats\.hardSamples \+= 1/);
  assert.match(page, /stats\.hardSamples \? formatPct\(pct\(stats\.hard, stats\.hardSamples\), 0\) : "--"/);
  assert.match(page, /\$\{stats\.count\} pitches/);
  assert.match(page, /hard contact not tracked/);
});

test('completed Live BP drafts do not carry optional pitch type into the next event', () => {
  const source = readFileSync('app/components/LiveBpConsole.tsx', 'utf8');
  assert.match(source, /setDraft\(\{\s*outcome: ""\s*\}\)/);
  assert.doesNotMatch(source, /setDraft\(\{[^}]*pitchType: savedDraft\.pitchType/);
});

test('Live BP pitch map sizes to its square stage and menus follow the theme', () => {
  const css = readFileSync('app/components/LiveBpConsole.module.css', 'utf8');
  assert.match(css, /\.console :global\(\.practice-hitting-live-charts \.practice-pitch-location-grid\)\s*\{[^}]*height: auto;[^}]*max-height: none;/);
  assert.match(css, /\.correctionMenu\s*\{[^}]*background: var\(--panel-strong\)/);
  assert.match(css, /\.console \.fieldViewToggle \.segments button\[aria-pressed="true"\]\s*\{[^}]*background: var\(--brand-primary\);[^}]*color: #fff;/);
});

test('offline staff creation grants no profile access or invitation and checks every team', () => {
  const sql = readFileSync('supabase/migrations/20260910180448_staff_without_email.sql', 'utf8');
  assert.match(sql, /auth\.uid\(\) is null/);
  assert.match(sql, /current_profile_can_admin_team\(staff_team_ids\[i\]\)/);
  assert.match(sql, /team_id = staff_team_ids\[i\]/);
  assert.doesNotMatch(sql, /insert into public\.(profiles|profile_team_memberships|team_invitations)/);
  assert.match(sql, /revoke all[^;]*from public, anon/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const claims = readFileSync(new URL("../app/components/PlayerAccountLinksPanel.tsx", import.meta.url), "utf8");
const access = readFileSync(new URL("../app/components/PlayerAccessPanel.tsx", import.meta.url), "utf8");
const invites = readFileSync(new URL("../app/components/PlayerInvitationsPanel.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("roster claims begin as a native collapsed disclosure", () => {
  for (const source of [claims]) {
    assert.match(source, /<details className="roster-management-disclosure">/);
    assert.doesNotMatch(source, /<details[^>]*className="roster-management-disclosure"[^>]*\bopen\b/);
  }
  assert.match(claims, /pending.length.*pending/);
  assert.match(claims, /Access history/);
});

test("coach claims retain explicit approve, reject and revoke operations", () => {
  for (const action of ["approve", "reject", "revoke"]) {
    assert.ok(claims.includes(`onAction(claim, "${action}")`));
  }
  assert.match(claims, /JSON.stringify\(\{ linkId: link.id, action \}\)/);
  assert.match(claims, /Requested by \{claimant\}/);
});

test("access settings move out of roster into a routable team-context page", () => {
  const roster = page.slice(page.indexOf("function RosterView("), page.indexOf("function StaffRosterView("));
  assert.doesNotMatch(roster, /<PlayerAccessPanel/);
  assert.doesNotMatch(roster, /onTeamSettings|aria-label="Team Settings"/);
  assert.match(page, /view === "teamSettings"[\s\S]*?title="Team Settings"[\s\S]*?<PlayerAccessPanel/);
  assert.match(page, /const TEAM_CONTEXT_VIEWS[^\n]*"teamSettings"/);
  assert.match(page, /view: "teamSettings", label: "Team Settings"/);
});

test("individual invitation actions replace the bulk roster panel", () => {
  assert.doesNotMatch(invites, /Select Roster|Select between|roster-management-disclosure/);
  assert.match(page, /p.playerId === player.id && !p.linked/);
  assert.match(page, /aria-label=\{`Invite \$\{playerSelectionLabel\(player\)\} by email`\}/);
  assert.match(page, /ModalFrame title="Player Invitation"/);
  assert.match(invites, /entries: \[\{ membershipId: player.membershipId, email: email.trim\(\) \}\]/);
});

test("access controls show player names, never UUIDs, while writes retain exact IDs", () => {
  assert.doesNotMatch(access, /Identity |title=\{p.playerId\}|p.playerId.slice/);
  assert.match(access, /aria-label=\{`Access for \$\{p.name\}`\}/);
  assert.match(access, /JSON.stringify\(\{ teamId, playerId, mode \}\)/);
  assert.match(access, /key=\{p.membershipId\}/);
});

test("roster icon actions override the legacy mobile one-column layout narrowly", () => {
  assert.match(css, /\.roster-page > \.section-header \.roster-title-actions \{\s*display: flex !important;[\s\S]*?flex-wrap: nowrap;/);
  assert.match(css, /\.roster-title-actions \.icon-button \{[^}]*flex: 0 0 36px/);
});

test("Team Settings has no roster back action and keeps access as a modular section", () => {
  assert.match(page, /<SectionHeader title="Team Settings" \/>/);
  assert.doesNotMatch(page, /aria-label="Back to roster"/);
  assert.match(access, /<section className="player-access-settings" aria-label="Player Access">/);
});

test("default access is a labeled dropdown and player overrides begin collapsed", () => {
  assert.match(access, /<label htmlFor=\{`\$\{controlId\}-default`\}>Default Player Access<\/label>/);
  assert.match(access, /<select id=\{`\$\{controlId\}-default`\} value=\{settings.teamDefault\} disabled=\{busy\}/);
  assert.doesNotMatch(access, /player-access-modes|aria-pressed/);
  assert.match(access, /<details className="player-access-overrides">/);
  assert.doesNotMatch(access, /<details[^>]*\bopen[\s=>]/);
});

test("access help opens a named native dialog and explains current live-entry limits", () => {
  assert.match(access, /aria-label="About player access modes"/);
  assert.match(access, /helpDialog.current\?\.showModal\(\)/);
  assert.match(access, /<dialog[^>]*aria-labelledby=/);
  assert.match(access, /helpDialog.current\?\.close\(\)/);
  assert.match(access, /playerModeCapabilityDetails\(mode\)/);
  assert.doesNotMatch(access, /permitted capabilities|What&apos;s included/);
  assert.match(access, /active coach-enabled session/);
  assert.match(access, /Players cannot create or start/);
});

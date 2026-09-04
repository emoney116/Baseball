import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  canProfileAccessPlayerSelf,
  canTransitionPlayerLink,
  resolveCanonicalClaimPlayer,
} from "../app/lib/playerAccountLinks.ts";

const teamId = "10000000-0000-4000-8000-000000000001";
const seasonId = "10000000-0000-4000-8000-000000000002";

function player(id, name, year, updatedAt = "2026-09-01T12:00:00.000Z") {
  const [first_name, last_name] = name.split(" ");
  return { id, first_name, last_name, graduation_year: year, active: true, updated_at: updatedAt };
}

function rosterPlayer(playerId, membershipId, name = "Jackson Smith") {
  return { playerId, membershipId, teamId, seasonId, name, jerseyNumber: 12, graduationYear: 2027, primaryPosition: "SS" };
}

test("claim alias resolution requires a full strong roster identity and keeps the selected membership context", () => {
  const canonical = rosterPlayer("20000000-0000-4000-8000-000000000001", "30000000-0000-4000-8000-000000000001");
  const alias = rosterPlayer("20000000-0000-4000-8000-000000000002", "30000000-0000-4000-8000-000000000002");
  const resolved = resolveCanonicalClaimPlayer(alias, [canonical, alias], [
    player(canonical.playerId, "Jackson Smith", 2027, "2026-09-02T12:00:00.000Z"),
    player(alias.playerId, "Jackson Smith", 2027, "2026-09-01T12:00:00.000Z"),
  ]);
  assert.equal(resolved.playerId, canonical.playerId);
  assert.equal(resolved.membershipId, canonical.membershipId);

  const sameNameDifferentJersey = { ...alias, jerseyNumber: 7 };
  assert.equal(
    resolveCanonicalClaimPlayer(sameNameDifferentJersey, [canonical, sameNameDifferentJersey], [
      player(canonical.playerId, "Jackson Smith", 2027),
      player(alias.playerId, "Jackson Smith", 2027),
    ]).playerId,
    alias.playerId,
  );
});

test("player-link lifecycle only permits coach review from pending and revocation from approved", () => {
  assert.equal(canTransitionPlayerLink("PENDING", "approve"), true);
  assert.equal(canTransitionPlayerLink("PENDING", "reject"), true);
  assert.equal(canTransitionPlayerLink("PENDING", "revoke"), false);
  assert.equal(canTransitionPlayerLink("APPROVED", "revoke"), true);
  assert.equal(canTransitionPlayerLink("APPROVED", "approve"), false);
  assert.equal(canTransitionPlayerLink("REJECTED", "approve"), false);
  assert.equal(canTransitionPlayerLink("REVOKED", "revoke"), false);
});

test("approved player links can be multi-player, while a revoked link immediately loses self context", () => {
  const links = [
    { playerId: "player-a", status: "APPROVED" },
    { playerId: "player-b", status: "APPROVED" },
    { playerId: "player-c", status: "REVOKED" },
  ];
  assert.equal(canProfileAccessPlayerSelf(links, "player-a"), true);
  assert.equal(canProfileAccessPlayerSelf(links, "player-b"), true);
  assert.equal(canProfileAccessPlayerSelf(links, "player-c"), false);
  assert.equal(canProfileAccessPlayerSelf(links, "other-player"), false);
});

test("association migration keeps accounts and players separate and enforces one active player self-account", () => {
  const migration = readFileSync("supabase/migrations/20260904155722_player_account_linking.sql", "utf8");
  assert.match(migration, /create table if not exists public\.profile_player_links/);
  assert.match(migration, /profile_id uuid not null references public\.profiles/);
  assert.match(migration, /player_id uuid not null references public\.players/);
  assert.match(migration, /claim_player_team_membership_id uuid not null references public\.player_team_memberships/);
  assert.match(migration, /status in \('PENDING', 'APPROVED'\)/);
  assert.match(migration, /relationship_type = 'PLAYER' and status = 'APPROVED'/);
  assert.doesNotMatch(migration, /alter table public\.players\s+add column/i);
});

test("migration RLS blocks anonymous access, constrains self claims, and scopes review to a managed team", () => {
  const migration = readFileSync("supabase/migrations/20260904155722_player_account_linking.sql", "utf8");
  assert.match(migration, /revoke all on table public\.profile_player_links from anon/);
  assert.match(migration, /profile_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /status = 'PENDING'/);
  assert.match(migration, /source = 'SELF_CLAIM'/);
  assert.match(migration, /player_link_claim_target_is_valid/);
  assert.match(migration, /current_profile_can_review_player_link_team\(claim_team_id\)/);
  assert.match(migration, /organization_membership\.role = 'ADMIN'/);
  assert.match(migration, /Player link identity and claim context are immutable/);
  assert.match(migration, /Approval actor must be the authenticated reviewer/);
  assert.match(migration, /Player link review fields can only change with a status transition/);
});

test("player-link routes derive identity from the session and reject cross-team transitions before mutation", () => {
  const route = readFileSync("app/api/player-links/route.ts", "utf8");
  const teamRoute = readFileSync("app/api/player-links/team/[teamId]/route.ts", "utf8");
  const service = readFileSync("app/lib/playerAccountLinks.ts", "utf8");
  assert.match(route, /supabase\.auth\.getUser\(\)/);
  assert.doesNotMatch(route, /profileId:\s*body\./);
  assert.match(teamRoute, /expectedTeamId: teamId/);
  assert.match(service, /claim\.claim_team_id !== input\.expectedTeamId/);
  assert.match(service, /claim\.profile_id === input\.actorProfileId/);
  assert.match(service, /getUserEntitlements\(admin, profileId\)/);
  assert.match(service, /SUPER_USER_ENTITLEMENT/);
  assert.match(service, /admin\.from\("profiles"\)\.insert/);
  assert.doesNotMatch(service, /admin\.from\("profiles"\)\.upsert/);
});

test("mobile-first player and coach surfaces keep confirmation and review context explicit", () => {
  const panel = readFileSync("app/components/PlayerAccountLinksPanel.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(panel, /Find Your Team/);
  assert.match(panel, /Find yourself/);
  assert.match(panel, /You&apos;re requesting access to/);
  assert.match(panel, /Request Access/);
  assert.match(panel, /Player Claims/);
  assert.match(panel, /Requested by/);
  assert.match(css, /\.player-link-confirmation/);
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*\.player-link-confirmation/);
});

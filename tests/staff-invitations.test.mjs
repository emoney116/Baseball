import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("staff invitation migration keeps tokens hashed and authorization server-side", () => {
  const migration = readFileSync("supabase/migrations/20260811000000_staff_invitations.sql", "utf8");
  const createRoute = readFileSync("app/api/staff/invitations/route.ts", "utf8");
  const acceptRoute = readFileSync("app/api/staff/invitations/accept/route.ts", "utf8");
  const lookupRoute = readFileSync("app/api/staff/invitations/lookup/route.ts", "utf8");
  const memberRoute = readFileSync("app/api/staff/members/[staffMemberId]/route.ts", "utf8");

  assert.match(migration, /create table if not exists public\.staff_members/);
  assert.match(migration, /create table if not exists public\.staff_team_memberships/);
  assert.match(migration, /create table if not exists public\.team_invitations/);
  assert.match(migration, /token_hash text not null unique/);
  assert.doesNotMatch(migration, /\braw_token\b|\bplain_token\b|\binvite_token text\b/i);
  assert.match(migration, /security definer[\s\S]*create_staff_invitation/);
  assert.match(migration, /security definer[\s\S]*accept_staff_invitation/);
  assert.match(migration, /alter table public\.staff_members enable row level security/);
  assert.match(migration, /alter table public\.team_invitations enable row level security/);
  assert.match(migration, /current_profile_can_admin_team/);

  assert.match(createRoute, /createInviteToken/);
  assert.match(createRoute, /hashInviteToken\(token\)/);
  assert.match(createRoute, /sendStaffInviteEmail/);
  assert.match(acceptRoute, /accept_staff_invitation/);
  assert.match(lookupRoute, /readInvitationSummaryByHash/);
  assert.match(memberRoute, /canAdminStaffTeam/);
  assert.match(memberRoute, /hasAnotherTeamAdmin/);
  assert.match(memberRoute, /profile_team_memberships/);
});

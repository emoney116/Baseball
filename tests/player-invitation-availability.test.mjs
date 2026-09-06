import test from "node:test";
import assert from "node:assert/strict";
import { assertPlayerInvitationAvailable } from "../app/lib/playerInvitationAvailability.ts";
import { playerServiceFixture, uuid } from "./helpers/playerServiceFixture.mjs";

const now = new Date("2026-09-06T12:00:00Z");
function fixture() {
  const f = playerServiceFixture();
  const input = { playerId: f.other, teamId: f.team, seasonId: f.season, email: "qa@example.invalid" };
  f.tables.player_invitations = [];
  f.tables.profiles = [{ id: uuid(1), email: "existing@example.invalid" }];
  return { ...f, input };
}
test("unlinked exact player can receive a new email invitation", async () => {
  const f = fixture();
  await assertPlayerInvitationAvailable(f.db, f.input, now);
});
test("already approved player cannot receive a new invitation", async () => {
  const f = fixture();
  await assert.rejects(assertPlayerInvitationAvailable(f.db, { ...f.input, playerId: f.own }, now), e => e.status === 409);
});
test("same email pending for another player in this team and season is rejected", async () => {
  const f = fixture();
  f.tables.player_invitations.push({ player_id: f.own, team_id: f.team, season_id: f.season, invited_email: f.input.email, status: "PENDING", expires_at: "2026-09-10" });
  await assert.rejects(assertPlayerInvitationAvailable(f.db, { ...f.input, email: " QA@EXAMPLE.INVALID " }, now), e => e.status === 409);
});
for (const change of [{ status: "REVOKED" }, { expires_at: "2026-09-01" }, { team_id: uuid(999) }, { season_id: uuid(998) }, { player_id: "same" }]) {
  test(`historical or different-context invitation does not block: ${JSON.stringify(change)}`, async () => {
    const f = fixture();
    f.tables.player_invitations.push({ player_id: f.own, team_id: f.team, season_id: f.season, invited_email: f.input.email, status: "PENDING", expires_at: "2026-09-10", ...change, ...(change.player_id ? { player_id: f.other } : {}) });
    await assertPlayerInvitationAvailable(f.db, f.input, now);
  });
}
test("email of an approved different player is rejected in the same team and season", async () => {
  const f = fixture();
  f.tables.profiles[0].email = f.input.email;
  await assert.rejects(assertPlayerInvitationAvailable(f.db, f.input, now), e => e.status === 409);
});
test("same account email remains eligible for a different team context", async () => {
  const f = fixture();
  f.tables.profiles[0].email = f.input.email;
  await assertPlayerInvitationAvailable(f.db, { ...f.input, teamId: uuid(999) }, now);
});
test("revoked account link no longer reserves email for a different player", async () => {
  const f = fixture();
  f.tables.profiles[0].email = f.input.email;
  f.tables.profile_player_links[0].status = "REVOKED";
  await assertPlayerInvitationAvailable(f.db, f.input, now);
});

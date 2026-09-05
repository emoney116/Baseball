import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import {
  playerDatabase,
  seedClaimContext,
  id,
  asAccount,
} from "./helpers/playerDatabase.mjs";
let db;
before(async () => {
  db = await playerDatabase();
  await seedClaimContext(db);
});
after(async () => {
  await db?.close();
});
let sequence = 0;
async function invite(overrides = {}) {
  const n = ++sequence,
    hash = n.toString(16).padStart(64, "0");
  const row = {
    email: `player${n}@example.test`,
    expiry: "2099-01-01",
    actor: id(2),
    status: "PENDING",
    ...overrides,
  };
  await db.query(
    `insert into player_invitations(player_id,membership_id,team_id,season_id,invited_email,token_hash,expires_at,invited_by,status)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      id(40),
      id(50),
      id(20),
      id(30),
      row.email,
      hash,
      row.expiry,
      row.actor,
      row.status,
    ],
  );
  return { ...row, hash };
}
const redeem = (v, account = id(1), email = v.email) =>
  db.query("select redeem_player_invitation($1,$2,$3) id", [
    v.hash,
    account,
    email,
  ]);
test("anonymous and browser users cannot read tokens or call redemption RPC", async () => {
  for (const role of ["anon", "authenticated"])
    await asAccount(
      db,
      id(1),
      async () => {
        await assert.rejects(
          db.query("select * from player_invitations"),
          /permission denied/,
        );
        await assert.rejects(
          db.query("select redeem_player_invitation('x',$1,'x')", [id(1)]),
          /permission denied/,
        );
      },
      role,
    );
});
test("wrong verified email cannot redeem", async () => {
  const v = await invite();
  await assert.rejects(redeem(v, id(1), "wrong@example.test"), /invited email/);
});
test("expired invitation cannot redeem", async () => {
  await assert.rejects(
    redeem(await invite({ expiry: "2000-01-01" })),
    /expired/,
  );
});
test("revoked invitation cannot redeem", async () => {
  await assert.rejects(
    redeem(await invite({ status: "REVOKED" })),
    /unavailable/,
  );
});
test("unknown token cannot redeem", async () => {
  await assert.rejects(
    redeem({ hash: "f".repeat(64), email: "n@example.test" }),
    /unavailable/,
  );
});
test("coach from another team cannot auto-approve", async () => {
  await assert.rejects(redeem(await invite({ actor: id(3) })), /authority/);
});
test("coach cannot approve self through invitation", async () => {
  await assert.rejects(redeem(await invite(), id(2)), /Self approval/);
});
test("exact-player invitation activates a durable association without creating a player", async () => {
  const v = await invite();
  await redeem(v);
  const link = (
    await db.query("select * from profile_player_links where profile_id=$1", [
      id(1),
    ])
  ).rows[0];
  assert.equal(link.player_id, id(40));
  assert.equal(link.status, "APPROVED");
  assert.equal(link.source, "COACH_INVITE");
  assert.equal(link.approved_by_profile_id, id(2));
  assert.ok(link.approved_at);
  assert.equal(
    (await db.query("select count(*)::int n from players")).rows[0].n,
    2,
  );
  assert.equal(
    (await db.query("select count(*)::int n from player_team_memberships"))
      .rows[0].n,
    2,
  );
  await assert.rejects(redeem(v), /unavailable/);
});
test("existing approved identity is reused on a fresh invitation", async () => {
  await redeem(await invite());
  assert.equal(
    (await db.query("select count(*)::int n from profile_player_links")).rows[0]
      .n,
    1,
  );
});
test("another account cannot take the already linked identity", async () => {
  await assert.rejects(redeem(await invite(), id(4)), /approved account/);
});
test("deactivated membership blocks redemption", async () => {
  await db.query(
    "update player_team_memberships set active=false where id=$1",
    [id(50)],
  );
  await assert.rejects(redeem(await invite()), /no longer active/);
});

import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import {
  playerDatabase,
  seedClaimContext,
  insertClaim,
  asAccount,
  id,
} from "./helpers/playerDatabase.mjs";

let db;
before(async () => {
  db = await playerDatabase();
  await seedClaimContext(db);
});
after(async () => {
  await db?.close();
});

test("database: claim migration applies and fresh claims are pending", async () => {
  const claimId = await insertClaim(db);
  const { rows } = await db.query(
    "select status,approved_at from profile_player_links where id=$1",
    [claimId],
  );
  assert.deepEqual(rows, [{ status: "PENDING", approved_at: null }]);
});
test("database: anonymous cannot read or create a claim", async () => {
  await asAccount(
    db,
    null,
    async () => {
      await assert.rejects(
        db.query("select * from profile_player_links"),
        /permission denied/,
      );
      await assert.rejects(insertClaim(db), /permission denied/);
    },
    "anon",
  );
});
test("database: claimant sees own request, unrelated account sees none", async () => {
  assert.equal(
    (
      await asAccount(db, id(1), () =>
        db.query("select id from profile_player_links"),
      )
    ).rows.length,
    1,
  );
  assert.equal(
    (
      await asAccount(db, id(4), () =>
        db.query("select id from profile_player_links"),
      )
    ).rows.length,
    0,
  );
});
test("database: only the exact team coach sees pending claim", async () => {
  assert.equal(
    (
      await asAccount(db, id(2), () =>
        db.query("select id from profile_player_links"),
      )
    ).rows.length,
    1,
  );
  assert.equal(
    (
      await asAccount(db, id(3), () =>
        db.query("select id from profile_player_links"),
      )
    ).rows.length,
    0,
  );
});
test("database: direct authenticated inserts and status changes are denied even to coaches", async () => {
  for (const profile of [id(1), id(2), id(3)])
    await asAccount(db, profile, async () => {
      await assert.rejects(
        db.query(
          "update profile_player_links set status='APPROVED',approved_by_profile_id=$1",
          [profile],
        ),
        /permission denied/,
      );
      await assert.rejects(insertClaim(db, profile), /permission denied/);
    });
});
test("database: forged review fields at claim creation are rejected", async () => {
  await assert.rejects(
    db.query(
      `insert into profile_player_links(profile_id,player_id,claim_player_team_membership_id,claim_team_id,claim_season_id,approved_at)
    values ($1,$2,$3,$4,$5,now())`,
      [id(4), id(40), id(50), id(20), id(30)],
    ),
    /without review fields/,
  );
});
test("database: duplicate pending requests are rejected by unique constraint", async () => {
  await assert.rejects(insertClaim(db), /duplicate key/);
});
test("database: service operations cannot self-approve", async () => {
  await assert.rejects(
    db.query(
      "update profile_player_links set status='APPROVED',approved_by_profile_id=profile_id",
    ),
    /independent approval/,
  );
});
test("database: archived roster context cannot be approved", async () => {
  await db.query(
    "update player_team_memberships set active=false where id=$1",
    [id(50)],
  );
  try {
    await assert.rejects(
      db.query(
        "update profile_player_links set status='APPROVED',approved_by_profile_id=$1",
        [id(2)],
      ),
      /no longer active/,
    );
  } finally {
    await db.query(
      "update player_team_memberships set active=true where id=$1",
      [id(50)],
    );
  }
});
test("database: approved link can be revoked without erasing approval or baseball identity", async () => {
  await db.query(
    "update profile_player_links set status='APPROVED',approved_by_profile_id=$1",
    [id(2)],
  );
  const original = (
    await db.query("select approved_at from profile_player_links")
  ).rows[0].approved_at;
  await db.query(
    "update profile_player_links set status='REVOKED',approved_at=null,revoked_by_profile_id=$1",
    [id(2)],
  );
  const row = (
    await db.query(
      "select status,approved_at,revoked_at from profile_player_links",
    )
  ).rows[0];
  assert.equal(row.status, "REVOKED");
  assert.deepEqual(row.approved_at, original);
  assert.ok(row.revoked_at);
  assert.equal((await db.query("select id from players")).rows.length, 2);
  assert.equal(
    (await db.query("select id from player_team_memberships")).rows.length,
    2,
  );
});
test("database: rejected and revoked links cannot be reactivated", async () => {
  await assert.rejects(
    db.query(
      "update profile_player_links set status='APPROVED',approved_by_profile_id=$1",
      [id(2)],
    ),
    /Invalid player link/,
  );
});
test("database: hidden and mismatched claim contexts fail the target predicate", async () => {
  const { rows } = await db.query(
    "select player_link_claim_target_is_valid($1,$2,$3,$4) as allowed",
    [id(41), id(51), id(21), id(31)],
  );
  assert.equal(rows[0].allowed, false);
  const mismatch = await db.query(
    "select player_link_claim_target_is_valid($1,$2,$3,$4) as allowed",
    [id(40), id(51), id(20), id(30)],
  );
  assert.equal(mismatch.rows[0].allowed, false);
});

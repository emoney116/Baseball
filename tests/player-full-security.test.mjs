import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { fullPlayerDatabase } from "./helpers/fullPlayerDatabase.mjs";
import { asAccount, id } from "./helpers/playerDatabase.mjs";
let db;
before(async () => {
  db = await fullPlayerDatabase();
  await db.exec(`
    insert into auth.users(id,email) values('${id(1)}','player@example.test'),('${id(2)}','coach@example.test'),('${id(3)}','other@example.test');
    insert into profiles(id,role) values('${id(1)}','PLAYER'),('${id(2)}','COACH'),('${id(3)}','ADMIN');
    insert into organizations(id,name,slug,visibility) values('${id(10)}','QA A','qa-a','PUBLIC'),('${id(11)}','QA B','qa-b','PRIVATE');
    insert into teams(id,organization_id,name,visibility) values('${id(20)}','${id(10)}','QA A','PUBLIC'),('${id(21)}','${id(11)}','QA B','PRIVATE');
    insert into seasons(id,organization_id,team_id,name) values('${id(30)}','${id(10)}','${id(20)}','Fall 2026');
    insert into players(id,organization_id,first_name,last_name,primary_position,bats,throws) values('${id(40)}','${id(10)}','Same','Name','SS','R','R'),('${id(41)}','${id(11)}','Same','Name','SS','R','R');
    insert into player_team_memberships(id,player_id,team_id,season_id) values('${id(50)}','${id(40)}','${id(20)}','${id(30)}');
    insert into profile_team_memberships(profile_id,team_id,role,title) values('${id(1)}','${id(20)}','PLAYER','Head Coach'),('${id(2)}','${id(20)}','COACH','Coach'),('${id(3)}','${id(21)}','PLAYER','Head Coach');
    insert into practices(id,organization_id,team_id,season_id,practice_date,name,practice_type) values('${id(60)}','${id(10)}','${id(20)}','${id(30)}','2026-09-04','QA Practice','Team Practice');
    insert into player_notes(organization_id,player_id,team_id,season_id,note) values('${id(10)}','${id(40)}','${id(20)}','${id(30)}','Private note');
    insert into profile_player_links(id,profile_id,player_id,claim_player_team_membership_id,claim_team_id,claim_season_id) values('${id(70)}','${id(1)}','${id(40)}','${id(50)}','${id(20)}','${id(30)}');
    update profile_player_links set status='APPROVED',approved_by_profile_id='${id(2)}' where id='${id(70)}';
  `);
});
after(async () => await db?.close());
for (const table of [
  "players",
  "practices",
  "player_notes",
  "hitting_events",
  "pitch_events",
  "defense_events",
  "game_pitch_events",
  "workout_sessions",
  "development_goals",
  "staff_members",
])
  test(`real RLS denies player raw ${table} reads`, async () => {
    assert.equal(
      (await asAccount(db, id(1), () => db.query(`select * from ${table}`)))
        .rows.length,
      0,
    );
  });
test("real RLS preserves assigned coach roster and Practice access, excludes other organization", async () => {
  const players = await asAccount(db, id(2), () =>
    db.query("select id from players"),
  );
  assert.deepEqual(
    players.rows.map((p) => p.id),
    [id(40)],
  );
  assert.equal(
    (await asAccount(db, id(2), () => db.query("select id from practices")))
      .rows.length,
    1,
  );
});
test("player cannot alter their association or manufacture membership authority", async () => {
  await asAccount(db, id(1), async () => {
    await assert.rejects(
      db.query(
        "update profile_player_links set status='APPROVED' where id=$1",
        [id(70)],
      ),
      /permission denied/,
    );
    const result = await db.query(
      "update profile_team_memberships set role='ADMIN' where profile_id=$1 returning id",
      [id(1)],
    );
    assert.equal(result.rows.length, 0);
    await assert.rejects(
      db.query(
        "insert into profile_team_memberships(profile_id,team_id,role) values($1,$2,'ADMIN')",
        [id(1), id(21)],
      ),
      /row-level security/,
    );
  });
});
test("legacy global ADMIN and Head Coach title do not grant organization authority", async () => {
  const r = await asAccount(db, id(3), () =>
    db.query("select current_profile_can_admin_org($1) allowed", [id(11)]),
  );
  assert.equal(r.rows[0].allowed, false);
});
test("player cannot invoke staff invitation creation to elevate access", async () => {
  await asAccount(db, id(1), () =>
    assert.rejects(
      db.query(
        `select create_staff_invitation('attacker@example.test',null,null,'Coach','ADMIN',$1,now()+interval '7 days',array[$2::uuid],array[$3::uuid],'ADMIN')`,
        ["a".repeat(64), id(20), id(30)],
      ),
      /admin|authorized|permission|access/i,
    ),
  );
});
test("revocation retains baseball rows and removes approved association", async () => {
  await db.query(
    "update profile_player_links set status='REVOKED',revoked_by_profile_id=$1 where id=$2",
    [id(2), id(70)],
  );
  assert.equal(
    (
      await db.query(
        "select * from profile_player_links where profile_id=$1 and status='APPROVED'",
        [id(1)],
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (await db.query("select id from players where id=$1", [id(40)])).rows
      .length,
    1,
  );
  assert.equal(
    (
      await db.query("select id from player_team_memberships where id=$1", [
        id(50),
      ])
    ).rows.length,
    1,
  );
});

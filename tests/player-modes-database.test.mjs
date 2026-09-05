import { before, beforeEach, after, test } from "node:test";
import assert from "node:assert/strict";
import { fullPlayerDatabase } from "./helpers/fullPlayerDatabase.mjs";
import { asAccount, id } from "./helpers/playerDatabase.mjs";
let db;
before(async () => {
  db = await fullPlayerDatabase();
  await db.exec(`
    insert into auth.users(id,email) values('${id(1)}','qa-player@example.test'),('${id(2)}','qa-coach@example.test'),('${id(3)}','qa-other@example.test');
    insert into profiles(id,role) values('${id(1)}','PLAYER'),('${id(2)}','COACH'),('${id(3)}','COACH');
    insert into organizations(id,name,slug,visibility) values('${id(10)}','QA','modes-qa','PUBLIC');
    insert into teams(id,organization_id,name) values('${id(20)}','${id(10)}','A'),('${id(21)}','${id(10)}','B');
    insert into seasons(id,organization_id,team_id,name) values('${id(30)}','${id(10)}','${id(20)}','Fall'),('${id(31)}','${id(10)}','${id(21)}','Fall');
    insert into players(id,organization_id,first_name,last_name,primary_position,bats,throws) values('${id(40)}','${id(10)}','Exact','Player','SS','R','R'),('${id(41)}','${id(10)}','Other','Player','SS','R','R');
    insert into player_team_memberships(id,player_id,team_id,season_id) values('${id(50)}','${id(40)}','${id(20)}','${id(30)}'),('${id(51)}','${id(40)}','${id(21)}','${id(31)}'),('${id(52)}','${id(41)}','${id(20)}','${id(30)}');
    insert into profile_team_memberships(profile_id,team_id,role) values('${id(2)}','${id(20)}','COACH'),('${id(3)}','${id(21)}','COACH');
  `);
});
beforeEach(async () => {
  await db.exec(`delete from workout_sessions where player_id in ('${id(40)}','${id(41)}'); delete from development_goals where player_id in ('${id(40)}','${id(41)}');
    delete from player_access_overrides where team_id in ('${id(20)}','${id(21)}'); delete from player_access_audit where team_id in ('${id(20)}','${id(21)}');
    update teams set player_access_default='VIEW_ONLY' where id in ('${id(20)}','${id(21)}');
    delete from profile_player_links where profile_id='${id(1)}';
    insert into profile_player_links(id,profile_id,player_id,claim_player_team_membership_id,claim_team_id,claim_season_id) values('${id(70)}','${id(1)}','${id(40)}','${id(50)}','${id(20)}','${id(30)}');
    update profile_player_links set status='APPROVED',approved_by_profile_id='${id(2)}' where id='${id(70)}';`);
});
after(async () => await db?.close());
const mode = (value, player = null, actor = id(2), team = id(20)) =>
  db.query("select set_player_access_mode($1,$2,$3,$4)", [
    actor,
    team,
    player,
    value,
  ]);
const write = (
  kind = "goal",
  operation = "create",
  entry = null,
  membership = id(50),
  actor = id(1),
  title = "Practice routine",
  weight = 180,
) =>
  db.query(
    "select write_player_self_entry($1,$2,$3,$4,$5,current_date,$6,$7,false) id",
    [actor, membership, kind, operation, entry, weight, title],
  );
test("team default writes one setting and audit, not a roster of overrides", async () => {
  await mode("TRACK_AND_VIEW");
  assert.equal(
    (await db.query("select * from player_access_overrides")).rows.length,
    0,
  );
  assert.equal(
    (
      await db.query("select * from player_access_audit where team_id=$1", [
        id(20),
      ])
    ).rows.length,
    1,
  );
});
test("coach of Team B cannot change Team A mode", async () =>
  await assert.rejects(mode("FULL_PLAYER", null, id(3)), /authority/));
test("player cannot set their own mode through service function even with a guessed team", async () =>
  await assert.rejects(mode("FULL_PLAYER", null, id(1)), /authority/));
test("View Only direct logging is denied", async () =>
  await assert.rejects(write(), /not permitted/));
test("upgrade permits writes without another login or link", async () => {
  await mode("TRACK_AND_VIEW");
  assert.ok((await write()).rows[0].id);
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from profile_player_links where profile_id=$1",
        [id(1)],
      )
    ).rows[0].n,
    1,
  );
});
test("override wins and restoring default removes the override row", async () => {
  await mode("TRACK_AND_VIEW");
  await mode("VIEW_ONLY", id(40));
  await assert.rejects(write(), /not permitted/);
  await mode(null, id(40));
  assert.ok((await write()).rows[0].id);
  assert.equal(
    (await db.query("select * from player_access_overrides")).rows.length,
    0,
  );
});
test("downgrade denies next write and preserves historical player entries", async () => {
  await mode("FULL_PLAYER");
  const entry = (await write()).rows[0].id;
  await mode("VIEW_ONLY");
  await assert.rejects(write("goal", "update", entry), /not permitted/);
  assert.equal(
    (await db.query("select title from development_goals where id=$1", [entry]))
      .rows[0].title,
    "Practice routine",
  );
});
test("Full Player team default cannot bypass revoked link", async () => {
  await mode("FULL_PLAYER");
  await db.query(
    "update profile_player_links set status='REVOKED',revoked_by_profile_id=$1 where id=$2",
    [id(2), id(70)],
  );
  await assert.rejects(write(), /Approved player link/);
});
test("same account has different modes across legitimate team memberships", async () => {
  await mode("TRACK_AND_VIEW");
  assert.ok((await write()).rows[0].id);
  await assert.rejects(write("goal", "create", null, id(51)), /not permitted/);
});
test("other-player membership is denied despite Full Player", async () => {
  await mode("FULL_PLAYER");
  await assert.rejects(
    write("goal", "create", null, id(52)),
    /Approved player link/,
  );
});
test("personal goal has durable provenance and supports owner update/delete", async () => {
  await mode("TRACK_AND_VIEW");
  const entry = (await write()).rows[0].id;
  const row = (
    await db.query("select * from development_goals where id=$1", [entry])
  ).rows[0];
  assert.equal(row.created_by_profile_id, id(1));
  assert.equal(row.entry_source, "PLAYER_SELF");
  assert.equal(row.player_visible, true);
  await write("goal", "update", entry, id(50), id(1), "Updated");
  assert.equal(
    (await db.query("select title from development_goals where id=$1", [entry]))
      .rows[0].title,
    "Updated",
  );
  await write("goal", "delete", entry);
  assert.equal(
    (await db.query("select * from development_goals where id=$1", [entry]))
      .rows.length,
    0,
  );
});
test("coach-owned goal remains immutable to player even on their player ID", async () => {
  await mode("FULL_PLAYER");
  const r = await db.query(
    "insert into development_goals(organization_id,team_id,season_id,player_id,title,player_visible) values($1,$2,$3,$4,$5,true) returning id",
    [id(10), id(20), id(30), id(40), "Coach goal"],
  );
  await assert.rejects(
    write("goal", "update", r.rows[0].id),
    /Only your personal goals/,
  );
  await assert.rejects(
    write("goal", "delete", r.rows[0].id),
    /Only your personal goals/,
  );
});
test("self body-weight sessions with attached workout sets cannot be edited or deleted", async () => {
  await mode("TRACK_AND_VIEW");
  const entry = (await write("body_weight")).rows[0].id;
  await db.query("insert into exercises(id,organization_id,name,kind) values($1,$2,'QA Squat','Strength') on conflict(id) do nothing", [id(90), id(10)]);
  await db.query("insert into workout_sets(workout_session_id,player_id,exercise_id,reps) values($1,$2,$3,5)", [entry, id(40), id(90)]);
  await assert.rejects(write("body_weight", "update", entry), /isolated/);
  await assert.rejects(write("body_weight", "delete", entry), /isolated/);
  assert.equal((await db.query("select * from workout_sets where workout_session_id=$1", [entry])).rows.length, 1);
});

test("body weight uses canonical workout storage and cannot replace coach day", async () => {
  await mode("TRACK_AND_VIEW");
  const entry = (await write("body_weight")).rows[0].id;
  const row = (
    await db.query("select * from workout_sessions where id=$1", [entry])
  ).rows[0];
  assert.equal(Number(row.body_weight), 180);
  assert.equal(row.entry_source, "PLAYER_SELF");
  await write("body_weight", "update", entry, id(50), id(1), "", 185);
  await write("body_weight", "delete", entry);
  await db.query(
    "insert into workout_sessions(organization_id,team_id,season_id,player_id,session_date,body_weight) values($1,$2,$3,$4,current_date,190)",
    [id(10), id(20), id(30), id(40)],
  );
  await assert.rejects(write("body_weight"), /unique/);
  const coach = (
    await db.query(
      "select id,body_weight from workout_sessions where player_id=$1",
      [id(40)],
    )
  ).rows[0];
  await assert.rejects(
    write("body_weight", "update", coach.id),
    /Only your personal/,
  );
  assert.equal(Number(coach.body_weight), 190);
});
for (const kind of [
  "hitting",
  "pitching",
  "defense",
  "game",
  "workout_set",
  "private_note",
])
  test(`Full Player cannot write ${kind} through self-entry RPC`, async () => {
    await mode("FULL_PLAYER");
    await assert.rejects(write(kind), /Unsupported self entry/);
  });
test("authenticated role has no mode table or RPC write grants", async () => {
  await mode("FULL_PLAYER");
  await asAccount(db, id(1), () =>
    assert.rejects(
      db
        .query(
          "update teams set player_access_default='FULL_PLAYER' where id=$1 returning id",
          [id(20)],
        )
        .then((r) => {
          if (!r.rows.length) throw new Error("denied");
        }),
      /denied|security/,
    ),
  );
  await asAccount(db, id(1), () =>
    assert.rejects(
      db.query("select * from player_access_overrides"),
      /permission denied/,
    ),
  );
  await asAccount(db, id(1), () =>
    assert.rejects(write(), /permission denied/),
  );
});
test("self-entry provenance cannot be reassigned after creation", async () => {
  await mode("TRACK_AND_VIEW");
  const entry = (await write()).rows[0].id;
  await assert.rejects(
    db.query(
      "update development_goals set created_by_profile_id=$1 where id=$2",
      [id(2), entry],
    ),
    /immutable/,
  );
});
test("schema grants preserve staff reads while denying raw Full Player private reads", async () => {
  await mode("FULL_PLAYER");
  await write();
  assert.equal(
    (
      await asAccount(db, id(1), () =>
        db.query("select * from development_goals"),
      )
    ).rows.length,
    0,
  );
  assert.ok(
    (
      await asAccount(db, id(2), () =>
        db.query("select * from development_goals"),
      )
    ).rows.length > 0,
  );
});

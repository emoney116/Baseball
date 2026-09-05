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
  await db.exec(`grant select,insert,update on profiles to authenticated;
    alter table profiles enable row level security;
    create policy own_profile on profiles for all to authenticated using(id=auth.uid()) with check(id=auth.uid());
    grant select on players to authenticated;
    create policy old_broad_player_read on players for select to authenticated using(true);`);
});
after(async () => await db?.close());
test("player cannot promote their global profile role", async () => {
  await asAccount(db, id(1), () =>
    assert.rejects(
      db.query("update profiles set role='ADMIN' where id=$1", [id(1)]),
      /managed by authorized staff/,
    ),
  );
});
test("new profile cannot request COACH on insert", async () => {
  await asAccount(db, id(5), () =>
    db.query("insert into profiles values($1,'COACH')", [id(5)]),
  );
  assert.equal(
    (await db.query("select role from profiles where id=$1", [id(5)])).rows[0]
      .role,
    "PLAYER",
  );
});
test("client upsert preserves an existing coach role without allowing role changes", async () => {
  await db.query("update profiles set role='COACH' where id=$1", [id(2)]);
  await asAccount(db, id(2), () =>
    db.query(
      "insert into profiles values($1,'ADMIN') on conflict(id) do update set role=excluded.role",
      [id(2)],
    ),
  );
  assert.equal(
    (await db.query("select role from profiles where id=$1", [id(2)])).rows[0]
      .role,
    "COACH",
  );
});
test("restrictive policy blocks players even when an old permissive policy allows read", async () => {
  const r = await asAccount(db, id(1), () => db.query("select * from players"));
  assert.equal(r.rows.length, 0);
});
test("trusted staff retains access through existing row policy", async () => {
  const r = await asAccount(db, id(2), () => db.query("select * from players"));
  assert.equal(r.rows.length, 2);
});
test("global ADMIN label with PLAYER membership is not team administration", async () => {
  await db.query("update profiles set role='ADMIN' where id=$1", [id(4)]);
  await db.query(
    "insert into profile_team_memberships values($1,$2,true,'PLAYER')",
    [id(4), id(20)],
  );
  const r = await asAccount(db, id(4), () =>
    db.query(
      "select current_profile_can_manage_team($1) manage,current_profile_can_admin_team($1) admin",
      [id(20)],
    ),
  );
  assert.deepEqual(r.rows[0], { manage: false, admin: false });
});
test("Team A coach cannot manage Team B through the shared helper", async () => {
  const r = await asAccount(db, id(2), () =>
    db.query("select current_profile_can_manage_team($1) allowed", [id(21)]),
  );
  assert.equal(r.rows[0].allowed, false);
});
test("existing goals default private", async () => {
  await db.query("insert into development_goals(id,player_id) values($1,$2)", [
    id(70),
    id(40),
  ]);
  assert.equal(
    (await db.query("select player_visible from development_goals")).rows[0]
      .player_visible,
    false,
  );
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fullPlayerDatabase } from "./helpers/fullPlayerDatabase.mjs";

const source = readFileSync("scripts/verify-player-membership-rls.sql", "utf8");
const sql = source.split(/\r?\n/).filter((line) => !line.startsWith("\\")).join("\n");

test("remote membership verification matches current staff boundary and rolls back all fixtures", async () => {
  const db = await fullPlayerDatabase();
  try {
    // Hosted Supabase supplies these table grants. RLS still controls rows.
    await db.exec("grant select,insert,update,delete on public.players,public.player_team_memberships to anon");
    const counts = async () => (await db.query(`select
      (select count(*) from auth.users) users,
      (select count(*) from profiles) profiles,
      (select count(*) from organizations) organizations,
      (select count(*) from teams) teams,
      (select count(*) from seasons) seasons,
      (select count(*) from profile_team_memberships) staff,
      (select count(*) from players) players,
      (select count(*) from player_team_memberships) memberships`)).rows[0];
    const before = await counts();
    const results = await db.exec(sql);
    assert.equal(results.at(-1).rows[0].result, "pass");
    assert.deepEqual(await counts(), before);
  } finally {
    await db.close();
  }
});

test("remote membership fixture never demotes existing staff or depends on customer names", () => {
  assert.doesNotMatch(source, /update public\.(profile_team_memberships|organization_memberships)/i);
  assert.doesNotMatch(source, /metrolina|Fall 2026/i);
  assert.match(source, /select unauthorized_profile_id,'COACH'/);
  assert.match(source, /rollback;/);
});

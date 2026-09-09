import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { customerLocationFields } from "../app/lib/locationSave.ts";

test("customer location allowlist does not retain Google fields", () => {
  const fields = customerLocationFields({ name: "Our field", formattedAddress: "provider address", latitude: 35, longitude: -80, addressComponents: [], displayName: "provider name" });
  assert.deepEqual(fields, { name: "Our field", city: null, state_region: null, country_code: null, address: null });
  assert.throws(() => customerLocationFields({ name: " " }), { status: 400 });
  assert.throws(() => customerLocationFields({ name: "x".repeat(101) }), { status: 400 });
});

test("canonical location migration preserves history and enforces attachment scope", async t => {
  const db = new PGlite();
  const org = randomUUID(), otherOrg = randomUUID(), team = randomUUID(), otherTeam = randomUUID(), owner = randomUUID();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create table organizations(id uuid primary key);
      create table teams(id uuid primary key);
      create table profiles(id uuid primary key);
      create table practices(id uuid primary key,team_id uuid,organization_id uuid,location text);
      create table games(id uuid primary key,team_id uuid,organization_id uuid,location text);`);
    await db.query("insert into organizations values($1),($2)", [org, otherOrg]);
    await db.query("insert into teams values($1),($2)", [team, otherTeam]);
    await db.query("insert into profiles values($1)", [owner]);
    const historic = randomUUID();
    await db.query("insert into practices values($1,$2,$3,'Original historical text')", [historic, team, org]);
    await db.exec(readFileSync(new URL("../supabase/migrations/20260909171415_clubhouse_locations.sql", import.meta.url), "utf8"));
    await t.test("old raw locations unchanged", async () => {
      const row = (await db.query("select location,location_id from practices where id=$1", [historic])).rows[0];
      assert.deepEqual(row, { location: "Original historical text", location_id: null });
    });
    const venue = randomUUID();
    await db.query("insert into clubhouse_locations(id,team_id,organization_id,created_by_profile_id,name,provider_place_id) values($1,$2,$3,$4,'Customer field','placeOne')", [venue, team, org, owner]);
    await t.test("same scoped Place ID cannot be duplicated", async () => {
      await assert.rejects(db.query("insert into clubhouse_locations(team_id,organization_id,created_by_profile_id,name,provider_place_id) values($1,$2,$3,'Duplicate','placeOne')", [team, org, owner]), /duplicate key/);
    });
    for (const table of ["practices", "games"]) {
      await t.test(`${table}: canonical customer label is shared snapshot`, async () => {
        const id = randomUUID();
        await db.query(`insert into ${table}(id,team_id,organization_id,location,location_id) values($1,$2,$3,'Wrong client snapshot',$4)`, [id, team, org, venue]);
        assert.equal((await db.query(`select location from ${table} where id=$1`, [id])).rows[0].location, "Customer field");
      });
      await t.test(`${table}: guessed cross-team ID denied`, async () => {
        await assert.rejects(db.query(`insert into ${table}(id,team_id,organization_id,location_id) values($1,$2,$3,$4)`, [randomUUID(), otherTeam, org, venue]), /outside this team scope/);
        await assert.rejects(db.query(`insert into ${table}(id,team_id,organization_id,location_id) values($1,null,null,$2)`, [randomUUID(), venue]), /outside this team scope/);
      });
    }
    await t.test("authenticated browser cannot write/read private venue table directly", async () => {
      await db.exec("set role authenticated");
      await assert.rejects(db.query("select * from clubhouse_locations"), /permission denied/);
      await assert.rejects(db.query("insert into clubhouse_locations(name,created_by_profile_id) values('x',$1)", [owner]), /permission denied/);
      await db.exec("reset role");
    });
  } finally { await db.close(); }
});

import { before, after, beforeEach, afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { fullPlayerDatabase } from "./helpers/fullPlayerDatabase.mjs";
import { id } from "./helpers/playerDatabase.mjs";
let db;
before(async () => {
  db = await fullPlayerDatabase();
  await db.exec(`
    insert into auth.users(id,email) values('${id(1)}','pins-player@example.test'),('${id(2)}','pins-coach@example.test');
    insert into profiles(id,role) values('${id(1)}','PLAYER'),('${id(2)}','COACH');
    insert into organizations(id,name,slug,visibility) values('${id(10)}','Pins QA','pins-qa','PUBLIC');
    insert into teams(id,organization_id,name) values('${id(20)}','${id(10)}','A'),('${id(21)}','${id(10)}','B');
    insert into seasons(id,organization_id,team_id,name) values('${id(30)}','${id(10)}','${id(20)}','Fall'),('${id(31)}','${id(10)}','${id(21)}','Fall');
    insert into players(id,organization_id,first_name,last_name,primary_position,bats,throws) values('${id(40)}','${id(10)}','Exact','Player','SS','R','R');
    insert into player_team_memberships(id,player_id,team_id,season_id) values('${id(50)}','${id(40)}','${id(20)}','${id(30)}');
    insert into profile_team_memberships(profile_id,team_id,role) values('${id(2)}','${id(20)}','COACH');
    insert into profile_player_links(id,profile_id,player_id,claim_player_team_membership_id,claim_team_id,claim_season_id) values('${id(70)}','${id(1)}','${id(40)}','${id(50)}','${id(20)}','${id(30)}');
    update profile_player_links set status='APPROVED',approved_by_profile_id='${id(2)}' where id='${id(70)}';
  `);
});
beforeEach(() => db.exec("begin"));
afterEach(() => db.exec("rollback"));
after(() => db?.close());
const pin = (profile=id(1),team=id(20),season=id(30)) => db.query("insert into profile_team_pins(profile_id,team_id,season_id) values($1,$2,$3) returning id",[profile,team,season]);
test("real trigger accepts approved player without creating staff membership", async () => {
  await pin();
  assert.equal((await db.query("select * from profile_team_memberships where profile_id=$1",[id(1)])).rows.length,0);
});
test("real pin trigger preserves staff membership behavior", async () => { await pin(id(2)); });
test("real pin trigger rejects wrong team even for server writes", async () => { await assert.rejects(pin(id(1),id(21),id(31)),/Only team members/); });
test("real pin trigger rejects wrong season", async () => { await assert.rejects(pin(id(1),id(20),id(31)),/Only team members/); });
test("real pin trigger rejects revoked link", async () => {
  await db.exec(`update profile_player_links set status='REVOKED',revoked_by_profile_id='${id(2)}' where id='${id(70)}'`);
  await assert.rejects(pin(),/Only team members/);
});
test("real pin trigger rejects inactive roster membership", async () => {
  await db.exec(`update player_team_memberships set active=false where id='${id(50)}'`);
  await assert.rejects(pin(),/Only team members/);
});
test("real pin trigger counts player pins toward the three-team limit", async () => {
  for(let n=0;n<4;n++) {
    await db.exec(`insert into seasons(id,organization_id,team_id,name) values('${id(100+n)}','${id(10)}','${id(20)}','Season ${n}'); insert into player_team_memberships(player_id,team_id,season_id) values('${id(40)}','${id(20)}','${id(100+n)}');`);
    if(n<3) await pin(id(1),id(20),id(100+n));
    else await assert.rejects(pin(id(1),id(20),id(100+n)),/up to 3/);
  }
});

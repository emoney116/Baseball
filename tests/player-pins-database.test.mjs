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

async function claimQr() {
  await db.exec(`insert into player_invitations(player_id,membership_id,team_id,season_id,delivery_mode,token_hash,expires_at,invited_by)
    values('${id(40)}','${id(50)}','${id(20)}','${id(30)}','QR','${'a'.repeat(64)}','2099-01-01','${id(2)}');`);
  return db.query('select redeem_player_invitation($1,$2,$3)', ['a'.repeat(64),id(1),'pins-player@example.test']);
}
test('QR claim pins intended team atomically without staff membership', async () => {
  await claimQr();
  const pins=(await db.query('select * from profile_team_pins')).rows;
  assert.equal(pins.length,1); assert.equal(pins[0].team_id,id(20)); assert.equal(pins[0].season_id,id(30));
  assert.equal((await db.query('select * from profile_team_memberships where profile_id=$1',[id(1)])).rows.length,0);
});
test('QR claim keeps an existing intended team pin without duplication', async () => {
  await pin(); await claimQr();
  assert.equal((await db.query('select * from profile_team_pins')).rows.length,1);
});
test('QR claim replaces oldest preference at the existing three-pin cap', async () => {
  for(let n=0;n<3;n++) {
    await db.exec(`insert into seasons(id,organization_id,team_id,name) values('${id(100+n)}','${id(10)}','${id(20)}','Season ${n}'); insert into player_team_memberships(player_id,team_id,season_id) values('${id(40)}','${id(20)}','${id(100+n)}');`);
    await pin(id(1),id(20),id(100+n));
  }
  await db.exec(`update profile_team_pins set created_at='2000-01-01',updated_at='2000-01-01' where season_id='${id(100)}'`);
  await claimQr();
  const seasons=(await db.query('select season_id from profile_team_pins')).rows.map(p=>p.season_id);
  assert.equal(seasons.length,3); assert.ok(seasons.includes(id(30))); assert.ok(!seasons.includes(id(100)));
});
test('failed pin rolls back invitation consumption and link approval', async () => {
  await db.exec(`update profile_player_links set status='REVOKED',revoked_by_profile_id='${id(2)}' where id='${id(70)}';
    create function public.qa_reject_pin() returns trigger language plpgsql as $$ begin raise exception 'QA pin failure'; end $$;
    create trigger qa_reject before insert on profile_team_pins for each row execute function public.qa_reject_pin();
    insert into player_invitations(player_id,membership_id,team_id,season_id,delivery_mode,token_hash,expires_at,invited_by)
    values('${id(40)}','${id(50)}','${id(20)}','${id(30)}','QR','${'a'.repeat(64)}','2099-01-01','${id(2)}'); savepoint claim;`);
  await assert.rejects(db.query('select redeem_player_invitation($1,$2,$3)',['a'.repeat(64),id(1),'pins-player@example.test']),/QA pin failure/);
  await db.exec('rollback to savepoint claim');
  assert.equal((await db.query('select status from player_invitations')).rows[0].status,'PENDING');
  assert.equal((await db.query("select * from profile_player_links where status='APPROVED'")).rows.length,0);
});

import { before, after, beforeEach, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { playerDatabase, seedClaimContext, id, asAccount } from './helpers/playerDatabase.mjs';
let db;
before(async () => {
  db = await playerDatabase();
  await seedClaimContext(db);
  await db.exec(readFileSync('supabase/migrations/20260922124559_player_qr_invites.sql', 'utf8'));
});
after(async () => db?.close());
beforeEach(async () => db.exec('begin'));
afterEach(async () => db.exec('rollback'));
const hash = 'a'.repeat(64), rotated = 'b'.repeat(64);
async function invite(mode = 'QR') {
  await db.query(`insert into player_invitations(player_id,membership_id,team_id,season_id,invited_email,token_hash,expires_at,invited_by,delivery_mode)
    values($1,$2,$3,$4,$5,$6,'2099-01-01',$7,$8)`, [id(40), id(50), id(20), id(30), mode === 'EMAIL' ? 'intended@example.test' : null, hash, id(2), mode]);
}
const redeem = (account = id(1), email = 'verified@example.test', token = hash) => db.query('select redeem_player_invitation($1,$2,$3)', [token, account, email]);
// Expected SQL failures abort a transaction; isolate each assertion in a savepoint.
async function denied(fn, pattern) {
  await db.exec('savepoint denial');
  await assert.rejects(fn(), pattern);
  await db.exec('rollback to savepoint denial');
}
test('QR claims existing identity once without creating players or memberships', async () => {
  await invite(); await redeem();
  assert.equal((await db.query('select count(*)::int n from players')).rows[0].n, 2);
  assert.equal((await db.query('select count(*)::int n from player_team_memberships')).rows[0].n, 2);
  const link = (await db.query('select * from profile_player_links')).rows[0];
  assert.equal(link.player_id, id(40)); assert.equal(link.profile_id, id(1)); assert.equal(link.status, 'APPROVED');
  await denied(() => redeem(id(4)), /already used/);
  await denied(() => redeem(), /already used/);
});
test('QR requires a verified email supplied by authenticated server', async () => {
  await invite(); await denied(() => redeem(id(1), null), /Verify your email/);
});
test('email invites retain exact email restriction', async () => {
  await invite('EMAIL'); await denied(() => redeem(), /invited email/);
  await redeem(id(1), 'intended@example.test');
});
test('revocation and expiration deny claims', async () => {
  await invite(); await db.exec("update player_invitations set status='REVOKED'");
  await denied(() => redeem(), /unavailable/);
  await db.exec("update player_invitations set status='PENDING',expires_at='2000-01-01'");
  await denied(() => redeem(), /expired/);
});
test('rotation invalidates old QR and accepts only new QR', async () => {
  await invite(); await db.query('update player_invitations set token_hash=$1', [rotated]);
  await denied(() => redeem(), /unavailable/); await redeem(id(1), 'verified@example.test', rotated);
});
test('only one pending QR per roster membership', async () => {
  await invite(); await denied(() => db.query(`insert into player_invitations(player_id,membership_id,team_id,season_id,token_hash,expires_at,invited_by,delivery_mode)
    values($1,$2,$3,$4,$5,'2099-01-01',$6,'QR')`, [id(40), id(50), id(20), id(30), rotated, id(2)]), /duplicate key/);
});
test('QR cannot transfer already claimed player to another account', async () => {
  await invite(); await redeem();
  await db.exec("update player_invitations set status='PENDING'");
  await denied(() => redeem(id(4)), /approved account/);
});
test('QR does not silently replace an incompatible approved identity', async () => {
  await db.query(`insert into profile_player_links(profile_id,player_id,claim_player_team_membership_id,claim_team_id,claim_season_id)
    values($1,$2,$3,$4,$5)`, [id(1), id(41), id(51), id(21), id(31)]);
  await db.query("update profile_player_links set status='APPROVED',approved_by_profile_id=$1", [id(3)]);
  await invite(); await denied(() => redeem(), /different player/);
});
test('pending claim is reused, not duplicated', async () => {
  await db.query(`insert into profile_player_links(profile_id,player_id,claim_player_team_membership_id,claim_team_id,claim_season_id)
    values($1,$2,$3,$4,$5)`, [id(1), id(40), id(50), id(20), id(30)]);
  await invite(); await redeem();
  assert.equal((await db.query('select count(*)::int n from profile_player_links')).rows[0].n, 1);
});
test('revoked coach authority and inactive membership invalidate QR', async () => {
  await invite(); await db.exec('update profile_team_memberships set active=false');
  await denied(() => redeem(), /authority/);
  await db.exec('update profile_team_memberships set active=true; update player_team_memberships set active=false');
  await denied(() => redeem(), /no longer active/);
});
test('browser roles cannot list credentials or directly redeem QR', async () => {
  await invite();
  for (const role of ['anon', 'authenticated']) await asAccount(db, id(1), async () => {
    await denied(() => db.query('select * from player_invitations'), /permission denied/);
    await denied(() => redeem(), /permission denied/);
  }, role);
});
test('QR does not authorize self approval by its inviting coach', async () => {
  await invite(); await denied(() => redeem(id(2)), /Self approval/);
});

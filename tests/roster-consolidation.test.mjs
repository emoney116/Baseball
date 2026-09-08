import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { fullPlayerDatabase } from './helpers/fullPlayerDatabase.mjs';
import { id, asAccount } from './helpers/playerDatabase.mjs';
import { readFileSync } from 'node:fs';

const oldId='14ef618e-7242-4b52-852d-e417877a1df7';
const newId='b92a21e9-73a7-4836-b473-d04e9ac0f792';
const team='113d2159-421c-424d-8fe4-af2d2e9ca1a9';
const season='8ff199c0-453e-42ac-83b9-4b735ef84b8b';
let db;
let fixtureSql;
before(async () => {
  db=await fullPlayerDatabase({beforeMigration: async (db,name) => {
    if (!name.endsWith('_roster_identity_consolidation.sql')) return;
    fixtureSql=`
      insert into auth.users(id,email) values('${id(1)}','player@example.test'),('${id(2)}','coach@example.test');
      insert into profiles(id,role) values('${id(1)}','PLAYER'),('${id(2)}','COACH');
      insert into organizations(id,name,slug) values('${id(10)}','Test','test');
      insert into teams(id,organization_id,name) values('${team}','${id(10)}','Test');
      insert into seasons(id,organization_id,team_id,name) values('${season}','${id(10)}','${team}','Fall 2026');
      insert into players(id,organization_id,first_name,last_name,graduation_year,jersey_number,primary_position,bats,throws,created_at,metadata) values
        ('${oldId}','${id(10)}','Jacob','Seamon',2027,1,'SS','R','R','2026-08-11 00:06:34.96+00','{"legacy":"retained"}'),
        ('${newId}','${id(10)}','Jacob','Seamon',2027,1,'SS','R','R','2026-08-11 13:12:32.156+00','{"new":"retained"}');
      insert into player_team_memberships(id,player_id,team_id,season_id,jersey_number) values
        ('${id(50)}','${oldId}','${team}','${season}',1),('${id(51)}','${newId}','${team}','${season}',1);
      insert into profile_player_links(id,profile_id,player_id,claim_player_team_membership_id,claim_team_id,claim_season_id)
        values('${id(70)}','${id(1)}','${newId}','${id(51)}','${team}','${season}');
      update profile_player_links set status='APPROVED',approved_by_profile_id='${id(2)}' where id='${id(70)}';
      insert into practices(id,organization_id,team_id,season_id,practice_date,name,practice_type)
        values('${id(60)}','${id(10)}','${team}','${season}','2026-09-08','Practice','Team Practice');
      insert into practice_attendance(id,practice_id,player_id,status,role) values
        ('${id(61)}','${id(60)}','${oldId}','Present','Hitter'),('${id(62)}','${id(60)}','${newId}','Present','Hitter');
      insert into player_measurements(id,organization_id,player_id,metric_type,value,unit) values
        ('${id(80)}','${id(10)}','${oldId}','weight',170,'lb'),('${id(81)}','${id(10)}','${newId}','weight',175,'lb');
      insert into player_notes(id,organization_id,player_id,note) values('${id(82)}','${id(10)}','${oldId}','Private coaching history');
      insert into games(id,organization_id,team_id,season_id,opponent,game_date,home_away,game_type,runners)
        values('${id(90)}','${id(10)}','${team}','${season}','Opponent','2026-09-08','Home','Scrimmage','{"first":"${oldId}"}');
      insert into game_lineups(game_id,player_id,batting_order) values('${id(90)}','${oldId}',1),('${id(90)}','${newId}',1);
      insert into plate_appearances(id,game_id,pitcher_id,hitter_id) values('${id(91)}','${id(90)}','${oldId}','${newId}');
      insert into hitting_events(practice_id,hitter_id,event_number,action,exit_velocity_mph) values
        ('${id(60)}','${oldId}',1,'Ball in play',80),('${id(60)}','${newId}',2,'Miss',null);
      insert into pitch_events(practice_id,pitcher_id,pitch_number,pitch_type,outcome,is_strike,velocity) values
        ('${id(60)}','${oldId}',1,'Fastball','Called Strike',true,80),('${id(60)}','${newId}',2,'Fastball','Ball',false,82);
      insert into defense_events(practice_id,player_id,station,event_number,outcome) values
        ('${id(60)}','${oldId}','Infield',1,'Clean'),('${id(60)}','${newId}','Infield',2,'Clean');
      insert into exercises(id,organization_id,name,kind) values('${id(110)}','${id(10)}','Bench Press','Strength');
      insert into workout_sessions(id,organization_id,team_id,season_id,player_id,session_date) values
        ('${id(111)}','${id(10)}','${team}','${season}','${oldId}','2026-09-07'),
        ('${id(112)}','${id(10)}','${team}','${season}','${newId}','2026-09-08');
      insert into workout_sets(workout_session_id,player_id,exercise_id,set_number,weight,reps,entry_source) values
        ('${id(111)}','${oldId}','${id(110)}',1,100,5,'COACH'),('${id(112)}','${newId}','${id(110)}',1,110,5,'COACH');
    `;
    await db.exec(fixtureSql);
  }});
});
after(async()=>await db?.close());
test('reviewed migration keeps newest player, one membership and one attendance row',async()=>{
  assert.deepEqual((await db.query('select id,metadata from players where organization_id=$1',[id(10)])).rows,[{id:newId,metadata:{legacy:'retained',new:'retained'}}]);
  assert.deepEqual((await db.query('select id,player_id from player_team_memberships where team_id=$1',[team])).rows,[{id:id(51),player_id:newId}]);
  assert.deepEqual((await db.query('select id,player_id from practice_attendance where practice_id=$1',[id(60)])).rows,[{id:id(62),player_id:newId}]);
});
test('both measurement histories and private notes survive with canonical identity',async()=>{
  const rows=(await db.query('select player_id,value from player_measurements order by value')).rows;
  assert.deepEqual(rows.map(r=>r.player_id),[newId,newId]);
  assert.deepEqual(rows.map(r=>Number(r.value)),[170,175]);
  assert.equal((await db.query('select player_id from player_notes')).rows[0].player_id,newId);
});
test('game associations, lineup, and embedded runner identity are consolidated',async()=>{
  assert.deepEqual((await db.query('select runners from games where id=$1',[id(90)])).rows[0].runners,{first:newId});
  assert.equal((await db.query('select count(*)::int n from game_lineups where game_id=$1',[id(90)])).rows[0].n,1);
  assert.equal((await db.query('select pitcher_id from plate_appearances where id=$1',[id(91)])).rows[0].pitcher_id,newId);
});
test('approved account association remains exactly the same',async()=>{
  const row=(await db.query('select player_id,claim_player_team_membership_id,status from profile_player_links')).rows[0];
  assert.deepEqual(row,{player_id:newId,claim_player_team_membership_id:id(51),status:'APPROVED'});
});
test('repair audit retains retired identity and collapsed attendance rows privately',async()=>{
  assert.equal((await db.query('select count(*)::int n from clubhouse_private.player_identity_merges')).rows[0].n,1);
  assert.equal((await db.query("select count(*)::int n from clubhouse_private.player_identity_merge_rows where table_name='practice_attendance'")).rows[0].n,2);
});
test('retired ID cannot be recreated by a stale roster upsert',async()=>{
  await assert.rejects(db.query('insert into players select (jsonb_populate_record(null::players,retired_player)).* from clubhouse_private.player_identity_merges'),/merged/);
});
test('routine sync cannot change creation time and change canonical winner',async()=>{
  await db.query("update players set created_at='2030-01-01' where id=$1",[newId]);
  assert.equal(new Date((await db.query('select created_at from players where id=$1',[newId])).rows[0].created_at).toISOString(),'2026-08-11T13:12:32.156Z');
});
function player(playerId,jersey=1) {return {id:playerId,organization_id:id(10),first_name:'Jacob',last_name:'Seamon',graduation_year:2027,jersey_number:jersey,primary_position:'SS',bats:'R',throws:'R',is_pitcher:false,is_hitter:true,active:true,metadata:{}};}
function membership(playerId,jersey=1) {return {player_id:playerId,team_id:team,season_id:season,jersey_number:jersey,roster_status:'Undecided',active:true,metadata:{}};}
test('atomic sync rejects duplicate identity and leaves no orphan player',async()=>{
  await assert.rejects(db.query('select sync_roster_rows($1,$2)',[JSON.stringify([player(id(100))]),JSON.stringify([membership(id(100))])]),/unique/);
  assert.equal((await db.query('select count(*)::int n from players where id=$1',[id(100)])).rows[0].n,0);
});
test('same-batch duplicate roster rows roll back the whole import',async()=>{
  await assert.rejects(db.query('select sync_roster_rows($1,$2)',[JSON.stringify([player(id(101),22),player(id(102),22)]),JSON.stringify([membership(id(101),22),membership(id(102),22)])]),/unique/);
  assert.equal((await db.query('select count(*)::int n from players where id in ($1,$2)',[id(101),id(102)])).rows[0].n,0);
});
test('same-name different jersey is not automatically merged',async()=>{
  await db.query('select sync_roster_rows($1,$2)',[JSON.stringify([player(id(103),30)]),JSON.stringify([membership(id(103),30)])]);
  assert.equal((await db.query('select count(*)::int n from players where organization_id=$1',[id(10)])).rows[0].n,2);
});
test('changing an existing identity into a duplicate is denied by the database',async()=>{
  await assert.rejects(db.query('update player_team_memberships set jersey_number=1 where player_id=$1',[id(103)]),/unique/);
});
test('repair is idempotent and refuses reversed winner',async()=>{
  await db.query('select clubhouse_private.merge_reviewed_roster_player($1,$2,$3,$4)',[oldId,newId,team,season]);
  await assert.rejects(db.query('select clubhouse_private.merge_reviewed_roster_player($1,$2,$3,$4)',[newId,oldId,team,season]),/missing/);
});
test('JSON remapping preserves prose and repeated metric values',async()=>{
  const input={ids:[oldId,newId],values:[5,5],note:`Historical ${oldId}`};
  const row=(await db.query('select clubhouse_private.remap_player_json($1,$2,$3) value',[JSON.stringify(input),oldId,newId])).rows[0];
  assert.deepEqual(row.value,{ids:[newId],values:[5,5],note:input.note});
});
test('ordinary player cannot call privileged sync or identity merge',async()=>{
  await assert.rejects(asAccount(db,id(1),()=>db.query("select sync_roster_rows('[]','[]')")),/permission denied/);
  await assert.rejects(asAccount(db,id(1),()=>db.query('select clubhouse_private.merge_reviewed_roster_player($1,$2,$3,$4)',[oldId,newId,team,season])),/permission denied/);
  await assert.rejects(asAccount(db,id(1),()=>db.query('select * from clubhouse_private.player_identity_merge_rows')),/permission denied/);
});
test('roster API uses shared authority, atomic sync, and no title-based grants',()=>{
  const source=readFileSync('app/api/roster/sync/route.ts','utf8');
  assert.match(source,/await assertPlayerLinkTeamManager/);
  assert.match(source,/rpc\("sync_roster_rows"/);
  assert.doesNotMatch(source,/STAFF_TITLES|\.upsert\(/);
});

test('Practice events preserve exact totals and metrics across both identities',async()=>{
  const hitting=(await db.query('select count(*)::int n,avg(exit_velocity_mph)::float ev from hitting_events where hitter_id=$1',[newId])).rows[0];
  assert.deepEqual(hitting,{n:2,ev:80});
  const pitching=(await db.query('select count(*)::int n,sum(is_strike::int)::int strikes,avg(velocity)::float velocity from pitch_events where pitcher_id=$1',[newId])).rows[0];
  assert.deepEqual(pitching,{n:2,strikes:1,velocity:81});
  assert.equal((await db.query('select count(*)::int n from defense_events where player_id=$1',[newId])).rows[0].n,2);
});
test('workout history and coach provenance survive the identity consolidation',async()=>{
  const result=(await db.query('select count(*)::int n,sum(weight*reps)::float volume from workout_sets where player_id=$1 and entry_source=$2',[newId,'COACH'])).rows[0];
  assert.deepEqual(result,{n:2,volume:1050});
  assert.equal((await db.query('select count(*)::int n from workout_sessions where player_id=$1',[newId])).rows[0].n,2);
});
test('new account history on retired identity stops repair rather than moving approval',async()=>{
  await assert.rejects(fullPlayerDatabase({beforeMigration:async(db,name)=>{
    if (!name.endsWith('_roster_identity_consolidation.sql')) return;
    await db.exec(fixtureSql);
    await db.query('insert into profile_player_links(profile_id,player_id,claim_player_team_membership_id,claim_team_id,claim_season_id) values($1,$2,$3,$4,$5)',[id(1),oldId,id(50),team,season]);
  }}),/account\/access history requiring review/);
});
test('unexpected competing workout sessions stop the transaction without deleting sets',async()=>{
  await assert.rejects(fullPlayerDatabase({beforeMigration:async(db,name)=>{
    if (!name.endsWith('_roster_identity_consolidation.sql')) return;
    await db.exec(fixtureSql);
    await db.query('update workout_sessions set session_date=$1 where id=$2',['2026-09-08',id(111)]);
  }}),/unique constraint/);
});
test('a player may reuse the canonical identity in another legitimate season',async()=>{
  await db.query('insert into seasons(id,organization_id,team_id,name) values($1,$2,$3,$4)',[id(120),id(10),team,'Spring 2027']);
  await db.query('insert into player_team_memberships(player_id,team_id,season_id,jersey_number) values($1,$2,$3,1)',[newId,team,id(120)]);
  assert.equal((await db.query('select count(*)::int n from player_team_memberships where player_id=$1',[newId])).rows[0].n,2);
});

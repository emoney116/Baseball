import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fullPlayerDatabase } from "./helpers/fullPlayerDatabase.mjs";
import { id } from "./helpers/playerDatabase.mjs";
import { BASELINE_TESTING_CIRCUIT } from "../app/lib/workoutTesting.ts";
let db;
before(async () => {
  db = await fullPlayerDatabase();
  await db.exec(`
    insert into auth.users(id,email) values('${id(1)}','coach-a@example.test'),('${id(2)}','coach-b@example.test'),('${id(3)}','coach-c@example.test');
    insert into profiles(id,role) values('${id(1)}','COACH'),('${id(2)}','COACH'),('${id(3)}','COACH');
    insert into organizations(id,name,slug) values('${id(10)}','Circuit QA','circuit-qa');
    insert into teams(id,organization_id,name) values('${id(20)}','${id(10)}','QA');
    insert into seasons(id,organization_id,team_id,name) values('${id(30)}','${id(10)}','${id(20)}','Fall');
    insert into profile_team_memberships(profile_id,team_id,role) values('${id(1)}','${id(20)}','COACH'),('${id(2)}','${id(20)}','COACH'),('${id(3)}','${id(20)}','COACH');
    insert into weight_room_workouts(id,organization_id,team_id,season_id,title,workout_date,status,started_at,created_by) values('${id(90)}','${id(10)}','${id(20)}','${id(30)}','Circuit',current_date,'ACTIVE',now(),'${id(1)}');
  `);
  for (let n=0;n<3;n++) await db.exec(`insert into players(id,organization_id,first_name,last_name,primary_position,bats,throws) values('${id(40+n)}','${id(10)}','QA','${n}','SS','R','R'); insert into player_team_memberships(player_id,team_id,season_id) values('${id(40+n)}','${id(20)}','${id(30)}');`);
  for (const [n, station] of BASELINE_TESTING_CIRCUIT.entries()) {
    await db.query("insert into exercises(id,organization_id,name,kind) values($1,$2,$3,'Custom')",[id(100+n),id(10),station.name]);
    await db.query("insert into weight_room_workout_stations(id,workout_id,exercise_id,exercise_name,display_order,test_conditions) values($1,$2,$3,$4,$5,$6)",[id(200+n),id(90),id(100+n),station.name,n,station.conditions]);
  }
});
after(async () => db?.close());
async function save({ coach=1, player=40, station=200, result=24, attempt=1, side=null, request=randomUUID() }={}) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${id(coach)}',false);`);
  return (await db.query("select record_workout_test($1,$2,$3,$4,$5,$6,$7) id",[id(90),id(station),id(player),request,result,attempt,side])).rows[0].id;
}
test("three coach identities persist independent canonical results", async () => {
  // PGlite serializes requests; hosted separate connections remain an acceptance gate.
  await save({coach:1,player:40,station:200,result:24});
  await save({coach:2,player:41,station:202,result:32});
  await save({coach:3,player:42,station:203,result:78});
  await db.exec("reset role");
  const rows=(await db.query("select reps,value,weight,created_by,test_conditions from workout_sets order by player_id")).rows;
  assert.equal(rows.length,3);
  assert.equal(rows[0].reps,24);
  assert.equal(Number(rows[1].weight),45);
  assert.equal(Number(rows[2].value),78);
  assert.equal(rows[1].test_conditions.durationSeconds,60);
  assert.equal(rows[2].created_by,id(3));
});
test("same attempt conflicts, uncertain retries return the same result", async () => {
  await assert.rejects(save({coach:2}),/already saved/);
  const request=randomUUID();
  const first=await save({attempt:2,request,result:0});
  assert.equal(await save({attempt:2,request,result:0}),first);
  await assert.rejects(save({attempt:2,request,result:1}),/different result/);
});
test("bilateral attempts remain separate and saved results cannot be overwritten",async()=>{
  const left=await save({station:204,side:"Left",result:78});
  const right=await save({station:204,side:"Right",result:62});
  assert.notEqual(left,right);
  await assert.rejects(db.query("update workout_sets set value=99 where id=$1",[left]),/cannot be overwritten/);
});
test("ended workout retains results and rejects future attempts",async()=>{
  await db.exec("reset role");
  const before=(await db.query("select count(*) n from workout_sets")).rows[0].n;
  await db.query("update weight_room_workouts set status='COMPLETED',ended_at=now() where id=$1",[id(90)]);
  await assert.rejects(save({attempt:3}),/no longer active/);
  assert.equal((await db.query("select count(*) n from workout_sets")).rows[0].n,before);
});
test("rotation is revision checked and never changes results", async () => {
  await db.exec("reset role");
  await db.query("update weight_room_workouts set status='ACTIVE',ended_at=null where id=$1",[id(90)]);
  await db.query("insert into weight_room_workout_groups(id,workout_id,name,display_order,current_station_id) values($1,$2,'Group 1',0,$3),($4,$2,'Group 2',1,$5)",[id(300),id(90),id(200),id(301),id(206)]);
  const before=(await db.query("select id,reps,value from workout_sets order by id")).rows;
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${id(1)}',false);`);
  assert.equal((await db.query("select rotate_workout_circuit($1,0) revision",[id(90)])).rows[0].revision,1);
  assert.deepEqual((await db.query("select current_station_id from weight_room_workout_groups order by display_order")).rows.map(row=>row.current_station_id),[id(201),id(200)]);
  await assert.rejects(db.query("select rotate_workout_circuit($1,0)",[id(90)]),/Rotation changed/);
  await assert.rejects(db.query("select rotate_workout_circuit($1,null)",[id(90)]),/Rotation changed/);
  assert.deepEqual((await db.query("select id,reps,value from workout_sets order by id")).rows,before);
});
test("unaffiliated account and off-roster athlete are denied", async () => {
  await assert.rejects(save({player:99}),/active roster/);
  await assert.rejects(save({coach:99,attempt:3}),/unavailable/);
});

test("corrections retain attempt identity, revision and auditable previous value", async () => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${id(1)}',false);`);
  const row=(await db.query("select id from workout_sets where player_id=$1 and workout_station_id=$2 and test_attempt=1",[id(40),id(200)])).rows[0];
  const request=randomUUID();
  await db.query("select correct_workout_test($1,0,$2,25)",[row.id,request]);
  const edited=(await db.query("select reps,test_revision,test_corrections from workout_sets where id=$1",[row.id])).rows[0];
  assert.equal(edited.reps,25); assert.equal(edited.test_revision,1);
  assert.equal(edited.test_corrections[0].before,24);
  assert.equal(edited.test_corrections[0].actor,id(1));
  await db.query("select correct_workout_test($1,0,$2,25)",[row.id,request]);
  await assert.rejects(db.query("select correct_workout_test($1,0,$2,26)",[row.id,randomUUID()]),/Another coach/);
  await assert.rejects(db.query("select correct_workout_test($1,1,$2,27)",[row.id,request]),/different correction/);
  assert.equal((await db.query("select test_revision from workout_sets where id=$1",[row.id])).rows[0].test_revision,1);
});

test("ended workout requires explicit completed edit and retains zero distinctly", async () => {
  await db.exec("reset role");
  await db.query("update weight_room_workouts set status='COMPLETED',ended_at=now() where id=$1",[id(90)]);
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${id(2)}',false);`);
  const row=(await db.query("select id from workout_sets where player_id=$1 and workout_station_id=$2",[id(41),id(202)])).rows[0];
  await assert.rejects(db.query("select correct_workout_test($1,0,$2,0)",[row.id,randomUUID()]),/ended or paused/);
  await db.query("select correct_workout_test($1,0,$2,0,true)",[row.id,randomUUID()]);
  assert.equal((await db.query("select reps from workout_sets where id=$1",[row.id])).rows[0].reps,0);
  await assert.rejects(db.query("select correct_workout_test($1,1,$2,1.5,true)",[row.id,randomUUID()]),/valid test result/);
  await db.exec(`select set_config('request.jwt.claim.sub','${id(99)}',false)`);
  await assert.rejects(db.query("select correct_workout_test($1,1,$2,2,true)",[row.id,randomUUID()]),/unavailable/);
});

import { before, beforeEach, afterEach, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fullPlayerDatabase } from "./helpers/fullPlayerDatabase.mjs";
import { id, asAccount } from "./helpers/playerDatabase.mjs";
import { playerServiceFixture } from "./helpers/playerServiceFixture.mjs";
import { loadPlayerSession } from "../app/lib/playerAccess.ts";
import { executeAnalyticsQuery } from "../app/lib/analyticsQuery.ts";
import { generateAskClubhouseReply } from "../app/lib/askClubhouse/engine.ts";
import { getAskClubhouseConfig } from "../app/lib/askClubhouse/config.ts";
import { playerAskContext } from "../app/lib/playerAskScope.ts";
import { calculateWeightRoomScore } from "../app/lib/weightRoom.ts";
import { LIVE_FIELDS, LIVE_RESULTS } from "../app/lib/playerLiveModels.ts";
let db;
before(async () => {
  db = await fullPlayerDatabase();
  await db.exec(`
    insert into auth.users(id,email) values('${id(1)}','live-player@example.test'),('${id(2)}','live-coach@example.test'),('${id(3)}','live-other@example.test');
    insert into profiles(id,role) values('${id(1)}','PLAYER'),('${id(2)}','COACH'),('${id(3)}','PLAYER');
    insert into organizations(id,name,slug,visibility) values('${id(10)}','Live QA','live-qa','PUBLIC');
    insert into teams(id,organization_id,name,player_access_default) values('${id(20)}','${id(10)}','A','TRACK_AND_VIEW'),('${id(21)}','${id(10)}','B','VIEW_ONLY');
    insert into seasons(id,organization_id,team_id,name) values('${id(30)}','${id(10)}','${id(20)}','Fall'),('${id(31)}','${id(10)}','${id(21)}','Fall');
    insert into players(id,organization_id,first_name,last_name,primary_position,bats,throws) values('${id(40)}','${id(10)}','Exact','Player','SS','R','R'),('${id(41)}','${id(10)}','Other','Player','P','R','R');
    insert into player_team_memberships(id,player_id,team_id,season_id) values('${id(50)}','${id(40)}','${id(20)}','${id(30)}'),('${id(51)}','${id(40)}','${id(21)}','${id(31)}'),('${id(52)}','${id(41)}','${id(20)}','${id(30)}');
    insert into profile_team_memberships(profile_id,team_id,role) values('${id(2)}','${id(20)}','COACH');
    insert into profile_player_links(id,profile_id,player_id,claim_player_team_membership_id,claim_team_id,claim_season_id) values('${id(70)}','${id(1)}','${id(40)}','${id(50)}','${id(20)}','${id(30)}'),('${id(71)}','${id(3)}','${id(41)}','${id(52)}','${id(20)}','${id(30)}');
    update profile_player_links set status='APPROVED',approved_by_profile_id='${id(2)}' where id in ('${id(70)}','${id(71)}');
    insert into practices(id,organization_id,team_id,season_id,practice_date,starts_at,name,practice_type,status) values('${id(80)}','${id(10)}','${id(20)}','${id(30)}',current_date,now()-interval '1 hour','QA Practice','Full Practice','active');
    insert into practice_attendance(practice_id,player_id,role,status) values('${id(80)}','${id(40)}','Two-way','Present'),('${id(80)}','${id(41)}','Two-way','Present');
    insert into practice_sessions(id,practice_id,player_id,category,session_type,created_by_profile_id,entry_policy,metadata) values
    ('${id(81)}','${id(80)}','${id(40)}','hitting','Machine','${id(2)}','COACH_AND_ASSIGNED_PLAYERS','{"playerEntryFields":["pitch_type","exit_velocity_mph","contact_quality","contact_result","direction"]}'),
    ('${id(82)}','${id(80)}','${id(40)}','pitching','Bullpen','${id(2)}','COACH_AND_ASSIGNED_PLAYERS','{"playerEntryFields":["pitch_type","velocity","location"]}'),
    ('${id(83)}','${id(80)}','${id(40)}','defense','Infield','${id(2)}','COACH_AND_ASSIGNED_PLAYERS','{"playerEntryFields":["throw_result","error_type","rep_type"]}'),
    ('${id(84)}','${id(80)}','${id(41)}','hitting','Machine','${id(2)}','COACH_AND_ASSIGNED_PLAYERS','{}');
    insert into exercises(id,organization_id,name,kind,unit) values('${id(90)}','${id(10)}','Bench Press','Strength','lb');
    insert into weight_room_workouts(id,organization_id,team_id,season_id,title,workout_date,status,started_at,created_by,player_entry_enabled) values('${id(91)}','${id(10)}','${id(20)}','${id(30)}','Upper Body',current_date,'ACTIVE',now()-interval '1 hour','${id(2)}',true);
    insert into weight_room_workout_stations(id,workout_id,exercise_id,exercise_name,display_order,target_sets,target_reps,measurement_type,unit) values('${id(92)}','${id(91)}','${id(90)}','Bench Press',0,3,5,'WEIGHT_REPS','lb');
    insert into weight_room_workout_groups(id,workout_id,name,display_order,current_station_id) values('${id(93)}','${id(91)}','Group 1',0,'${id(92)}');
    insert into weight_room_workout_group_members(workout_id,group_id,player_id) values('${id(91)}','${id(93)}','${id(40)}'),('${id(91)}','${id(93)}','${id(41)}');
  `);
});
beforeEach(async () => db.exec("begin"));
afterEach(async () => db.exec("rollback"));
after(async () => db?.close());
const defaultPayload = {
  hitting: {
    action: "Ball in play",
    contact_result: "Line drive",
    contact_quality: "Hard",
    exit_velocity_mph: 90,
  },
  pitching: {
    outcome: "Whiff",
    pitch_type: "Slider",
    velocity: 81,
    location: { x: 0.5, y: 0.5 },
  },
  defense: {
    outcome: "Clean",
    throw_result: "Accurate",
    rep_type: "Ground Ball",
  },
  workout: {
    stationId: id(92),
    setNumber: 1,
    weight: 185,
    reps: 5,
    status: "Completed",
  },
};
const sessions = {
  hitting: id(81),
  pitching: id(82),
  defense: id(83),
  workout: id(91),
};
const tables = {
  hitting: "hitting_events",
  pitching: "pitch_events",
  defense: "defense_events",
  workout: "workout_sets",
};
async function write(domain = "hitting", options = {}) {
  const r = await db.query(
    "select write_player_live_entry($1,$2,$3,$4,$5,$6,$7,$8) id",
    [
      options.actor ?? id(1),
      options.membership ?? id(50),
      domain,
      options.session ?? sessions[domain],
      options.operation ?? "create",
      options.request ?? randomUUID(),
      options.entry ?? null,
      options.payload ?? defaultPayload[domain],
    ],
  );
  return r.rows[0].id;
}
async function denied(fn, pattern) {
  await db.exec("savepoint attack");
  await assert.rejects(fn, pattern);
  await db.exec("rollback to savepoint attack");
}
for (const domain of Object.keys(sessions)) {
  test(`${domain}: Track & View creates own canonical row with durable provenance`, async () => {
    const entry = await write(domain);
    const row = (
      await db.query(`select * from ${tables[domain]} where id=$1`, [entry])
    ).rows[0];
    assert.equal(row.entry_source, "PLAYER");
    assert.equal(row.created_by_profile_id ?? row.created_by, id(1));
    assert.equal(row.hitter_id ?? row.pitcher_id ?? row.player_id, id(40));
    assert.ok(row.created_at);
    assert.ok(row.idempotency_key);
    if (domain === "workout") {
      assert.equal(row.active_workout_id, id(91));
      assert.equal(row.workout_station_id, id(92));
      assert.equal(row.reps, 5);
      assert.equal(Number(row.weight), 185);
    }
  });
  test(`${domain}: Full Player has the same live-entry permission`, async () => {
    await db.exec(
      `update teams set player_access_default='FULL_PLAYER' where id='${id(20)}'`,
    );
    assert.ok(await write(domain));
  });
  test(`${domain}: View Only direct service write denied`, async () => {
    await db.exec(
      `update teams set player_access_default='VIEW_ONLY' where id='${id(20)}'`,
    );
    await denied(() => write(domain), /read-only/);
  });
  test(`${domain}: revoked link denies stale write`, async () => {
    await db.exec(
      `update profile_player_links set status='REVOKED',revoked_by_profile_id='${id(2)}' where id='${id(70)}'`,
    );
    await denied(() => write(domain), /Approved player link/);
  });
  test(`${domain}: downgrade denies next write while preserving prior row`, async () => {
    const entry = await write(domain);
    await db.query("select set_player_access_mode($1,$2,$3,$4)", [
      id(2),
      id(20),
      id(40),
      "VIEW_ONLY",
    ]);
    await denied(() => write(domain), /read-only/);
    assert.equal(
      (
        await db.query(
          `select count(*)::int n from ${tables[domain]} where id=$1`,
          [entry],
        )
      ).rows[0].n,
      1,
    );
  });
  test(`${domain}: other player membership denied`, async () => {
    await denied(
      () => write(domain, { membership: id(52) }),
      /Approved player link/,
    );
  });
  test(`${domain}: own different team cannot borrow this session`, async () => {
    await db.exec(
      `update teams set player_access_default='FULL_PLAYER' where id='${id(21)}'`,
    );
    await denied(() => write(domain, { membership: id(51) }), /Session ended/);
  });
  test(`${domain}: retry creates exactly one event`, async () => {
    const request = randomUUID();
    const a = await write(domain, { request });
    const b = await write(domain, { request });
    assert.equal(a, b);
    assert.equal(
      (
        await db.query(
          `select count(*)::int n from ${tables[domain]} where id=$1`,
          [a],
        )
      ).rows[0].n,
      1,
    );
  });
  test(`${domain}: own correction allowed, undo receipt prevents resurrection`, async () => {
    const request = randomUUID(),
      entry = await write(domain, { request });
    await write(domain, { operation: "update", entry });
    await write(domain, {
      operation: "delete",
      entry,
      payload: domain === "workout" ? { stationId: id(92), setNumber: 1 } : {},
    });
    assert.equal(await write(domain, { request }), entry);
    assert.equal(
      (
        await db.query(
          `select count(*)::int n from ${tables[domain]} where id=$1`,
          [entry],
        )
      ).rows[0].n,
      0,
    );
  });
  test(`${domain}: session end denies next write`, async () => {
    if (domain === "workout")
      await db.exec(
        `update weight_room_workouts set status='COMPLETED',ended_at=now() where id='${id(91)}'`,
      );
    else
      await db.exec(
        `update practices set ended_at=now(),status='completed' where id='${id(80)}'`,
      );
    await denied(() => write(domain), /Session ended/);
  });
  test(`${domain}: ownership cannot be rewritten even by direct staff update`, async () => {
    const entry = await write(domain);
    const creator =
      domain === "workout" ? "created_by" : "created_by_profile_id";
    await denied(
      () =>
        db.query(`update ${tables[domain]} set ${creator}=$1 where id=$2`, [
          id(2),
          entry,
        ]),
      /immutable/,
    );
  });
  test(`${domain}: coach-corrected entry becomes player-locked`, async () => {
    const entry = await write(domain);
    const updater =
      domain === "workout" ? "updated_by" : "updated_by_profile_id";
    await db.query(`update ${tables[domain]} set ${updater}=$1 where id=$2`, [
      id(2),
      entry,
    ]);
    await denied(
      () =>
        write(domain, {
          operation: "delete",
          entry,
          payload:
            domain === "workout" ? { stationId: id(92), setNumber: 1 } : {},
        }),
      /Only your/,
    );
  });
}
test("Practice session assignment cannot be replaced by a supplied player ID", async () => {
  await denied(
    () => write("hitting", { session: id(84) }),
    /Assigned Practice/,
  );
});
test("Practice cannot accept unconfigured fields or forged identities", async () => {
  for (const extra of [
    { player_id: id(41) },
    { hitter_id: id(41) },
    { created_by_profile_id: id(2) },
    { is_live_bp: true },
    { game_id: id(99) },
    { pitch_location: { x: 0.5, y: 0.5 } },
  ])
    await denied(
      () =>
        write("hitting", { payload: { ...defaultPayload.hitting, ...extra } }),
      /not enabled/,
    );
});
test("Live BP is explicitly excluded", async () => {
  await db.exec(
    `update practice_sessions set session_type='Live BP' where id='${id(81)}'`,
  );
  await denied(() => write(), /Live BP/);
});
test("Practice absent attendance denies write", async () => {
  await db.exec(
    `update practice_attendance set status='Absent' where player_id='${id(40)}'`,
  );
  await denied(() => write(), /attendance/);
});
test("Practice coach-only station denies write", async () => {
  await db.exec(
    `update practice_sessions set entry_policy='COACH_ONLY' where id='${id(81)}'`,
  );
  await denied(() => write(), /read-only/);
});
test("Practice future start denies write", async () => {
  await db.exec(
    `update practices set starts_at=now()+interval '1 hour' where id='${id(80)}'`,
  );
  await denied(() => write(), /not running/);
});
test("workout pause denies live entry", async () => {
  await db.exec(
    `update weight_room_workouts set status='PAUSED' where id='${id(91)}'`,
  );
  await denied(() => write("workout"), /Session ended/);
});
test("workout disabled entry denies writes", async () => {
  await db.exec(
    `update weight_room_workouts set player_entry_enabled=false where id='${id(91)}'`,
  );
  await denied(() => write("workout"), /Session ended/);
});
test("workout unassigned participant denied", async () => {
  await db.exec(
    `update weight_room_workout_group_members set participant_status='NOT_PARTICIPATING' where player_id='${id(40)}'`,
  );
  await denied(() => write("workout"), /assignment/);
});
test("workout set beyond target denied", async () => {
  await denied(
    () =>
      write("workout", {
        payload: { ...defaultPayload.workout, setNumber: 4 },
      }),
    /prescribed/,
  );
});
test("workout duplicate slot with different request never overwrites", async () => {
  await write("workout");
  await denied(
    () =>
      write("workout", { payload: { ...defaultPayload.workout, weight: 225 } }),
    /already recorded/,
  );
});
test("request key cannot be reused with changed payload", async () => {
  const request = randomUUID();
  await write("hitting", { request });
  await denied(
    () => write("hitting", { request, payload: { action: "Miss" } }),
    /already used/,
  );
});
test("legacy coach rep with null provenance cannot be edited by its hitter", async () => {
  await db.exec(
    `insert into hitting_events(id,practice_id,session_id,hitter_id,event_number,action,entry_source) values('${id(100)}','${id(80)}','${id(81)}','${id(40)}',1,'Miss','COACH')`,
  );
  await denied(
    () =>
      write("hitting", { operation: "delete", entry: id(100), payload: {} }),
    /Only your/,
  );
});
test("authenticated players cannot call privileged RPC or mutate session programming", async () => {
  await asAccount(db, id(1), () => denied(() => write(), /permission denied/));
  await asAccount(db, id(1), async () => {
    for (const table of [
      "practices",
      "practice_sessions",
      "weight_room_workouts",
      "weight_room_workout_stations",
    ]) {
      const r = await db.query(`delete from ${table} returning id`);
      assert.equal(r.rows.length, 0, table);
    }
  });
});

for (const domain of Object.keys(sessions))
  test(`${domain}: missing session and other player's entry are denied`, async () => {
    await denied(() => write(domain, { session: id(999) }), /Session ended/);
    const entry = await write(domain);
    await denied(
      () =>
        write(domain, {
          actor: id(3),
          membership: id(52),
          operation: "update",
          entry,
        }),
      /Assigned Practice|Only your/,
    );
  });
for (const domain of Object.keys(sessions))
  test(`${domain}: coach can configure but player and wrong-team coach cannot`, async () => {
    const configure = (actor, team, enabled) =>
      db.query("select configure_player_live_entry($1,$2,$3,$4,$5,$6)", [
        actor,
        team,
        domain,
        sessions[domain],
        enabled,
        [],
      ]);
    await denied(() => configure(id(1), id(20), true), /authority/);
    await denied(() => configure(id(2), id(21), true), /authority/);
    await configure(id(2), id(20), false);
    await denied(() => write(domain), /read-only|unavailable/);
    await configure(id(2), id(20), true);
    if (domain !== "workout")
      await db.query("select configure_player_live_entry($1,$2,$3,$4,$5,$6)", [
        id(2),
        id(20),
        domain,
        sessions[domain],
        true,
        Object.keys(defaultPayload[domain]).filter(
          (k) => !["action", "outcome"].includes(k),
        ),
      ]);
    assert.ok(await write(domain));
  });
test("staff configuration cannot start an ended session or enable injected fields", async () => {
  await denied(
    () =>
      db.query("select configure_player_live_entry($1,$2,$3,$4,$5,$6)", [
        id(2),
        id(20),
        "hitting",
        id(81),
        true,
        ["hitter_id"],
      ]),
    /Unsupported/,
  );
  await db.exec(
    `update practices set status='completed',ended_at=now() where id='${id(80)}'`,
  );
  await denied(
    () =>
      db.query("select configure_player_live_entry($1,$2,$3,$4,$5,$6)", [
        id(2),
        id(20),
        "hitting",
        id(81),
        true,
        [],
      ]),
    /Start Practice/,
  );
});
test("coach upsert preserves player provenance, corrects outcome, and locks player undo", async () => {
  const entry = await write("hitting");
  await asAccount(db, id(2), () =>
    db.query(
      `insert into hitting_events(id,practice_id,session_id,hitter_id,event_number,action,created_by_profile_id,updated_by_profile_id,entry_source,idempotency_key,created_at)
    select id,practice_id,session_id,hitter_id,event_number,'Miss',created_by_profile_id,$2,entry_source,idempotency_key,created_at from hitting_events where id=$1
    on conflict(id) do update set action=excluded.action,updated_by_profile_id=excluded.updated_by_profile_id`,
      [entry, id(2)],
    ),
  );
  assert.equal(
    (await db.query("select action from hitting_events where id=$1", [entry]))
      .rows[0].action,
    "Miss",
  );
  await denied(
    () => write("hitting", { entry, operation: "delete", payload: {} }),
    /Only your/,
  );
});
test("coach and players in separate stations append without lost or reassigned events", async () => {
  const first = await write("hitting");
  await db.exec(
    `insert into hitting_events(practice_id,session_id,hitter_id,event_number,action,created_by_profile_id,entry_source) values('${id(80)}','${id(81)}','${id(40)}',2,'Foul','${id(2)}','COACH')`,
  );
  await write("hitting", {
    actor: id(3),
    membership: id(52),
    session: id(84),
    payload: { action: "Miss" },
  });
  await write("pitching");
  await write("workout");
  assert.equal(
    (await db.query("select count(*)::int n from hitting_events")).rows[0].n,
    3,
  );
  assert.equal(
    (
      await db.query("select hitter_id from hitting_events where id=$1", [
        first,
      ])
    ).rows[0].hitter_id,
    id(40),
  );
  assert.deepEqual(
    (
      await db.query(
        "select session_sequence from hitting_events where session_id=$1 order by session_sequence",
        [id(81)],
      )
    ).rows.map((r) => r.session_sequence),
    [1, 2],
  );
});
test("workout cannot change current assignment or overwrite coach-owned set", async () => {
  const entry = await write("workout");
  await db.exec(
    `update workout_sets set updated_by='${id(2)}' where id='${entry}'`,
  );
  await denied(
    () => write("workout", { entry, operation: "update" }),
    /Only your/,
  );
  await db.exec(
    `update weight_room_workout_groups set current_station_id=null where id='${id(93)}'`,
  );
  await denied(
    () =>
      write("workout", {
        payload: { ...defaultPayload.workout, setNumber: 2 },
      }),
    /Current assigned/,
  );
});
test("same player day in another team is never overwritten or attached", async () => {
  await db.exec(
    `insert into workout_sessions(player_id,organization_id,team_id,season_id,session_date,week_of) values('${id(40)}','${id(10)}','${id(21)}','${id(31)}',current_date,current_date)`,
  );
  await denied(() => write("workout"), /another team context/);
  assert.equal(
    (await db.query("select count(*)::int n from workout_sets")).rows[0].n,
    0,
  );
});
test("numeric bounds hold in the database as well as the HTTP validator", async () => {
  await denied(
    () =>
      write("workout", { payload: { ...defaultPayload.workout, weight: -1 } }),
    /Invalid numeric/,
  );
  await denied(
    () =>
      write("hitting", {
        payload: { ...defaultPayload.hitting, exit_velocity_mph: 900 },
      }),
    /Invalid numeric/,
  );
});
async function canonicalSession() {
  const f = playerServiceFixture();
  for (const table of Object.keys(f.tables)) {
    const result = await db.query(
      `select to_jsonb(t) row from public.${table} t`,
    );
    f.tables[table] = result.rows.map((r) => r.row);
  }
  return loadPlayerSession(f.db, id(1));
}
test("actual live Practice rows feed canonical own Analytics and Ask spray visualization", async () => {
  await db.query("select configure_player_live_entry($1,$2,$3,$4,$5,$6)", [
    id(2),
    id(20),
    "hitting",
    id(81),
    true,
    [
      "pitch_type",
      "exit_velocity_mph",
      "contact_quality",
      "contact_result",
      "field_location",
    ],
  ]);
  await write("hitting", {
    payload: {
      ...defaultPayload.hitting,
      pitch_type: "Slider",
      field_location: { x: 0.4, y: 0.3 },
    },
  });
  await write("hitting", { payload: { action: "Foul", pitch_type: "Slider" } });
  await write("hitting", { payload: { action: "Miss", pitch_type: "Slider" } });
  const s = await canonicalSession();
  assert.equal(s.data.hittingEvents.length, 3);
  assert.equal(s.data.hittingEvents[0].entrySource, "PLAYER");
  const result = executeAnalyticsQuery(s.data, {
    domain: "hitting",
    source: "practice",
    mode: "box-score",
    timeRange: "season",
    groupBy: "player",
    playerIds: [id(40)],
  });
  assert.equal(result.rows[0].cells.contactPct.display, "67%");
  const answer = await generateAskClubhouseReply({
    data: s.data,
    message: "Show me my spray chart.",
    uiContext: playerAskContext(s.context, {
      analytics: { domain: "hitting", source: "practice" },
    }),
    config: getAskClubhouseConfig({}),
    now: new Date(),
  });
  assert.notEqual(answer.status, "refused");
  assert.ok(answer.visuals?.some((v) => v.type === "spray_chart"));
  assert.equal(answer.visuals[0].playerId, id(40));
});
test("actual player pitches and Defense reps feed the existing canonical reader", async () => {
  await write("pitching");
  await write("pitching", {
    payload: {
      outcome: "Ball",
      pitch_type: "Slider",
      velocity: 80,
      location: { x: 0.1, y: 0.1 },
    },
  });
  await write("defense");
  await write("defense", {
    payload: {
      outcome: "Error",
      throw_result: "Inaccurate",
      rep_type: "Ground Ball",
    },
  });
  const s = await canonicalSession();
  const pitch = executeAnalyticsQuery(s.data, {
    domain: "pitching",
    source: "practice",
    mode: "box-score",
    timeRange: "season",
    groupBy: "player",
    playerIds: [id(40)],
  });
  assert.equal(pitch.rows[0].cells.strikePct.display, "50%");
  assert.equal(s.data.defenseEvents.length, 2);
  assert.equal(s.data.defenseEvents[0].entrySource, "PLAYER");
});
test("live sets feed existing volume and same-context progress without changing coach history", async () => {
  await db.exec(`insert into workout_sessions(id,organization_id,team_id,season_id,player_id,session_date,week_of,completed) values('${id(150)}','${id(10)}','${id(20)}','${id(30)}','${id(40)}',current_date-7,current_date-7,true);
    insert into workout_sets(workout_session_id,player_id,exercise_id,set_number,sets,weight,reps,unit,status,entry_source) values('${id(150)}','${id(40)}','${id(90)}',1,1,175,5,'lb','Completed','COACH');`);
  await write("workout");
  await write("workout", {
    payload: { ...defaultPayload.workout, setNumber: 2 },
  });
  const s = await canonicalSession(),
    live = s.data.workoutEntries.filter((e) => e.entrySource === "PLAYER");
  assert.equal(live.length, 2);
  assert.equal(live[0].priorValue, 175);
  assert.equal(live[0].activeWorkoutId, id(91));
  const score = calculateWeightRoomScore(
    s.data.players[0],
    s.data.workoutSessions,
    live,
  );
  assert.equal(score.volume, 1850);
  assert.equal(score.sets, 2);
  assert.ok(Math.abs(score.progressPct - (100 * 10) / 175) < 0.0001);
  assert.equal(
    (
      await db.query(
        "select weight from workout_sets where workout_session_id=$1",
        [id(150)],
      )
    ).rows[0].weight,
    "175",
  );
});

test("daily workout storage requires an exact team context", async () => {
  await denied(
    () =>
      db.exec(
        `insert into workout_sessions(player_id,organization_id,session_date,week_of) values('${id(40)}','${id(10)}',current_date,current_date)`,
      ),
    /not-null constraint/,
  );
  assert.equal(
    (await db.query("select count(*)::int n from workout_sets")).rows[0].n,
    0,
  );
});
test("completed sets require performed values while a skipped set does not invent them", async () => {
  await denied(
    () =>
      write("workout", {
        payload: { stationId: id(92), setNumber: 1, status: "Completed" },
      }),
    /performed values/,
  );
  const entry = await write("workout", {
    payload: { stationId: id(92), setNumber: 1, status: "Skipped" },
  });
  const row = (
    await db.query("select weight,reps,status from workout_sets where id=$1", [
      entry,
    ])
  ).rows[0];
  assert.equal(row.weight, null);
  assert.equal(row.reps, null);
  assert.equal(row.status, "Skipped");
});
for (const domain of ["hitting", "pitching", "defense"])
  test(`${domain}: all selectable structured fields satisfy database constraints`, async () => {
    await db.query("select configure_player_live_entry($1,$2,$3,$4,$5,$6)", [
      id(2),
      id(20),
      domain,
      sessions[domain],
      true,
      LIVE_FIELDS[domain].map((f) => f.key),
    ]);
    const resultKey = domain === "hitting" ? "action" : "outcome";
    for (const field of LIVE_FIELDS[domain])
      for (const value of field.options ?? []) {
        assert.ok(
          await write(domain, {
            payload: { ...defaultPayload[domain], [field.key]: value },
          }),
        );
      }
    for (const result of LIVE_RESULTS[domain])
      assert.ok(await write(domain, { payload: { [resultKey]: result } }));
  });

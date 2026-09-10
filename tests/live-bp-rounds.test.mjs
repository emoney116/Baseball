import { before, after, beforeEach, afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fullPlayerDatabase } from "./helpers/fullPlayerDatabase.mjs";
import { id, asAccount } from "./helpers/playerDatabase.mjs";
import {
  buildBpPitch,
  initialBpSettings,
  initialBpState,
  validateBpSettings,
  bpTracksCount,
} from "../app/lib/liveBp.ts";

const settings = (patch = {}) => ({ ...initialBpSettings(id(40)), ...patch });
for (const mode of ["FREE", "AB", "GAME"])
  test(`${mode}: count tracking override omits untracked count without losing situation`, () => {
    assert.equal(bpTracksCount(settings({ mode })), mode !== "FREE");
    const p = buildBpPitch(
      settings({
        mode,
        countTracking: false,
        source: "PLAYER",
        pitcherId: id(41),
      }),
      { ...initialBpState(), balls: 3, strikes: 2 },
      { outcome: "Ball" },
    );
    assert.equal(p.context.countTracked, false);
    assert.equal("balls" in p.context.before, false);
    assert.equal("strikes" in p.context.after, false);
    assert.equal(p.context.before.pa, 1);
    assert.equal(p.context.after.pa, 1);
    assert.equal(p.pitching.count_before, undefined);
    assert.equal(p.pitching.count_after, undefined);
    assert.equal(p.stateBefore.balls, 3);
    assert.equal(p.stateAfter.balls, 0);
    const tracked = buildBpPitch(
      settings({ mode, countTracking: true }),
      initialBpState(),
      { outcome: "Ball" },
    );
    assert.equal(tracked.context.after.balls, 1);
  });

test("atomic count-off save retains round concurrency state but no fake event count", async () => {
  const r = await start(
    settings({
      mode: "AB",
      countTracking: false,
      source: "PLAYER",
      pitcherId: id(41),
    }),
  );
  const next = await pitch(r, { outcome: "Ball" });
  assert.equal(next.state.balls, 0);
  assert.equal(next.version, r.version + 1);
  const hit = (await db.query("select live_bp_context from hitting_events"))
    .rows[0];
  assert.equal(hit.live_bp_context.countTracked, false);
  assert.equal("balls" in hit.live_bp_context.before, false);
  const pe = (
    await db.query("select count_before,count_after from pitch_events")
  ).rows[0];
  assert.equal(pe.count_before, null);
  assert.equal(pe.count_after, null);
});
test("named coach is durable thrower context, never roster pitcher evidence", () => {
  const saved = JSON.parse(
    JSON.stringify(settings({ source: "COACH", coachName: "QA Coach" })),
  );
  const pitch = buildBpPitch(saved, initialBpState(), { outcome: "Whiff" });
  assert.equal(pitch.context.coachName, "QA Coach");
  assert.equal(pitch.pitching, undefined);
  assert.equal(
    buildBpPitch(
      settings({ source: "MACHINE", coachName: "QA Coach" }),
      initialBpState(),
      { outcome: "Whiff" },
    ).context.coachName,
    undefined,
  );
  assert.throws(() =>
    validateBpSettings(settings({ coachName: "x".repeat(81) })),
  );
});
for (const source of ["MACHINE", "COACH", "PLAYER"])
  test(`${source}: exact hitter / pitcher evidence`, () => {
    const p = buildBpPitch(
      settings({ source, pitcherId: id(41) }),
      initialBpState(),
      { outcome: "Whiff" },
    );
    assert.equal(p.hitting.action, "Miss");
    assert.equal(Boolean(p.pitching), source === "PLAYER");
    assert.equal(p.context.thrower, source);
  });
for (const pitchMode of ["OFF", "ONE", "MULTI"])
  test(`${pitchMode}: pitch taxonomy and sticky choice`, () => {
    const p = buildBpPitch(
      settings({ pitchMode, pitchType: "4-Seam" }),
      initialBpState(),
      { outcome: "Foul", pitchType: "Slider" },
    );
    assert.equal(
      p.hitting.pitch_type,
      pitchMode === "OFF"
        ? undefined
        : pitchMode === "ONE"
          ? "4-Seam"
          : "Slider",
    );
  });
test("BIP optional tracking preserves exact canonical coordinates and EV", () => {
  const p = buildBpPitch(
    settings({ velocity: true, location: true, ev: true, spray: true }),
    initialBpState(),
    {
      outcome: "Ball in play",
      velocity: 83,
      ev: 91,
      location: { x: 0.3, y: 0.4 },
      spray: { x: 0.7, y: 0.2 },
      battedBall: "Line drive",
    },
  );
  assert.equal(p.hitting.exit_velocity_mph, 91);
  assert.equal(p.hitting.velocity, 83);
  assert.deepEqual(p.hitting.field_location, { x: 0.7, y: 0.2 });
  assert.deepEqual(p.hitting.pitch_location, { x: 0.3, y: 0.4 });
});
test("disabled tracking drops stale fields; non-BIP never creates defense or EV", () => {
  const p = buildBpPitch(settings(), initialBpState(), {
    outcome: "Foul",
    ev: 90,
    spray: { x: 0.2, y: 0.3 },
    position: "SS",
    defenseResult: "Clean",
  });
  assert.equal(p.defense, undefined);
  assert.equal(p.hitting.exit_velocity_mph, undefined);
  assert.equal(p.hitting.field_location, undefined);
});
for (const defense of ["OFF", "ALL", "SELECTED"])
  test(`${defense}: enabled aligned defense only`, () => {
    const p = buildBpPitch(
      settings({ defense, positions: ["SS"], alignment: { SS: id(42) } }),
      initialBpState(),
      {
        outcome: "Ball in play",
        position: "SS",
        defenseResult: "Great Play",
        throwResult: "Accurate",
      },
    );
    assert.equal(Boolean(p.defense), defense !== "OFF");
    if (p.defense) assert.equal(p.defense.player_id, id(42));
  });
test("unselected and unassigned fielders are rejected", () => {
  assert.throws(() =>
    buildBpPitch(
      settings({
        defense: "SELECTED",
        positions: ["SS"],
        alignment: { CF: id(42) },
      }),
      initialBpState(),
      { outcome: "Ball in play", position: "CF", defenseResult: "Clean" },
    ),
  );
  assert.throws(() =>
    buildBpPitch(settings({ defense: "ALL" }), initialBpState(), {
      outcome: "Ball in play",
      position: "SS",
      defenseResult: "Clean",
    }),
  );
});
test("Live AB two-strike foul stays alive, strikeout resets count", () => {
  let state = { ...initialBpState(), balls: 1, strikes: 2 };
  const s = settings({ mode: "AB" });
  state = buildBpPitch(s, state, { outcome: "Foul" }).context.after;
  assert.equal(state.strikes, 2);
  state = buildBpPitch(s, state, { outcome: "Whiff" }).context.after;
  assert.equal(state.strikes, 0);
  assert.equal(state.balls, 0);
  assert.equal(state.pa, 2);
});
test("Game-Like Move Runner persists before/after and explicit job result", () => {
  const p = buildBpPitch(
    settings({ mode: "GAME" }),
    { ...initialBpState(), outs: 1, runners: [2], job: "Move Runner" },
    {
      outcome: "Ball in play",
      result: "Out",
      runnerOutcomes: { 2: "3" },
      jobSuccess: true,
    },
  );
  assert.deepEqual(p.context.before.runners, [2]);
  assert.deepEqual(p.context.after.runners, [3]);
  assert.equal(p.context.after.outs, 2);
  assert.equal(p.context.jobSuccess, true);
});
test("walk forces only required runners; third out clears bases", () => {
  const s = settings({ mode: "GAME" });
  const walk = buildBpPitch(
    s,
    { ...initialBpState(), balls: 3, runners: [1, 2, 3] },
    { outcome: "Ball" },
  ).context;
  assert.deepEqual(walk.after.runners.sort(), [1, 2, 3]);
  assert.equal(walk.runnerOutcomes["3"], "score");
  const out = buildBpPitch(
    s,
    { ...initialBpState(), strikes: 2, outs: 2, runners: [2] },
    { outcome: "Whiff" },
  ).context.after;
  assert.deepEqual(out.runners, []);
  assert.equal(out.outs, 0);
});
test("invalid coordinates, duplicate runners, same hitter/pitcher are rejected", () => {
  assert.throws(() =>
    buildBpPitch(settings({ location: true }), initialBpState(), {
      outcome: "Ball",
      location: { x: 3, y: 0 },
    }),
  );
  assert.throws(() =>
    buildBpPitch(
      settings({ mode: "GAME" }),
      { ...initialBpState(), runners: [1, 1] },
      { outcome: "Ball" },
    ),
  );
  assert.throws(() =>
    validateBpSettings(settings({ source: "PLAYER", pitcherId: id(40) })),
  );
});

let db;
before(async () => {
  db = await fullPlayerDatabase();
  await db.exec(`insert into auth.users(id,email) values('${id(1)}','bp-coach@example.test'),('${id(2)}','bp-player@example.test');
 insert into profiles(id,role) values('${id(1)}','COACH'),('${id(2)}','PLAYER');
 insert into organizations(id,name,slug) values('${id(10)}','Live BP QA','live-bp-qa');
 insert into teams(id,organization_id,name) values('${id(20)}','${id(10)}','QA');
 insert into seasons(id,organization_id,team_id,name) values('${id(30)}','${id(10)}','${id(20)}','QA');
 insert into profile_team_memberships(profile_id,team_id,role) values('${id(1)}','${id(20)}','COACH');
 insert into players(id,organization_id,first_name,last_name,primary_position,bats,throws) values
 ('${id(40)}','${id(10)}','A','Hitter','SS','R','R'),('${id(41)}','${id(10)}','B','Pitcher','P','R','R'),('${id(42)}','${id(10)}','C','Fielder','SS','R','R');
 insert into player_team_memberships(player_id,team_id,season_id) values('${id(40)}','${id(20)}','${id(30)}'),('${id(41)}','${id(20)}','${id(30)}'),('${id(42)}','${id(20)}','${id(30)}');
 insert into practices(id,organization_id,team_id,season_id,name,practice_type,practice_date,status,starts_at) values('${id(60)}','${id(10)}','${id(20)}','${id(30)}','QA Live BP','Team Practice',current_date,'active',now()-interval '1 minute');`);
});
beforeEach(() => db.exec("begin"));
afterEach(() => db.exec("rollback"));
after(() => db?.close());
async function call(
  operation,
  round,
  payload = {},
  request = null,
  actor = id(1),
) {
  return (
    await db.query("select to_jsonb(write_live_bp($1,$2,$3,$4,$5,$6,$7)) r", [
      actor,
      id(60),
      round.id,
      operation,
      round.version ?? 0,
      request,
      JSON.stringify(payload),
    ])
  ).rows[0].r;
}
async function start(s = settings(), state = initialBpState()) {
  return call("start", { id: randomUUID() }, { settings: s, state });
}
async function pitch(r, draft = { outcome: "Whiff" }, request = randomUUID()) {
  return call("pitch", r, buildBpPitch(r.settings, r.state, draft), request);
}
async function denied(
  fn,
  re = /denied|required|ended|running|roster|changed|enabled|permission/i,
) {
  await db.exec("savepoint attack");
  await assert.rejects(fn, re);
  await db.exec("rollback to savepoint attack");
}
for (const source of ["MACHINE", "COACH", "PLAYER"])
  test(`database ${source}: atomic canonical evidence and reload`, async () => {
    const r = await start(settings({ source, pitcherId: id(41) }));
    await pitch(r);
    const hit = (await db.query("select * from hitting_events")).rows;
    const pe = (await db.query("select * from pitch_events")).rows;
    assert.equal(hit.length, 1);
    assert.equal(hit[0].hitter_id, id(40));
    assert.equal(pe.length, source === "PLAYER" ? 1 : 0);
    assert.equal(hit[0].live_bp_round_id, r.id);
    if (pe.length) assert.equal(pe[0].id, hit[0].id);
    assert.equal(
      (
        await db.query("select count(*)::int n from games where team_id=$1", [
          id(20),
        ])
      ).rows[0].n,
      0,
    );
  });
test("atomic BIP defense and game-like state persist together", async () => {
  const r = await start(
    settings({
      mode: "GAME",
      source: "PLAYER",
      pitcherId: id(41),
      defense: "SELECTED",
      positions: ["SS"],
      alignment: { SS: id(42) },
      ev: true,
      spray: true,
    }),
    { ...initialBpState(), outs: 1, runners: [2], job: "Move Runner" },
  );
  const next = await pitch(r, {
    outcome: "Ball in play",
    result: "Out",
    position: "SS",
    defenseResult: "Clean",
    throwResult: "Accurate",
    ev: 88,
    spray: { x: 0.4, y: 0.3 },
    runnerOutcomes: { 2: "3" },
    jobSuccess: true,
  });
  assert.equal(next.state.outs, 2);
  assert.deepEqual(next.state.runners, [3]);
  const de = (await db.query("select * from defense_events")).rows[0];
  assert.equal(de.player_id, id(42));
  assert.equal(de.live_bp_context.jobSuccess, true);
});
test("double submit and uncertain retry create one linked event", async () => {
  const r = await start(settings({ source: "PLAYER", pitcherId: id(41) }));
  const request = randomUUID();
  await pitch(r, undefined, request);
  await pitch(r, undefined, request);
  for (const table of ["hitting_events", "pitch_events"])
    assert.equal(
      (await db.query(`select count(*)::int n from ${table}`)).rows[0].n,
      1,
    );
});
test("stale concurrent writer is rejected without overwriting state", async () => {
  const r = await start();
  await pitch(r);
  await denied(
    () => pitch(r),
    (error) => error.code === "PT409",
  );
  assert.equal(
    (await db.query("select count(*)::int n from hitting_events")).rows[0].n,
    1,
  );
});
test("defense failure rolls back hitting, pitching, sessions and state", async () => {
  const r = await start(settings({ source: "PLAYER", pitcherId: id(41) }));
  const payload = buildBpPitch(r.settings, r.state, {
    outcome: "Ball in play",
  });
  payload.defense = {
    player_id: id(42),
    position_worked: "SS",
    outcome: "Clean",
  };
  await denied(() => call("pitch", r, payload, randomUUID()));
  assert.equal(
    (await db.query("select count(*)::int n from hitting_events")).rows[0].n,
    0,
  );
  assert.equal(
    (await db.query("select count(*)::int n from practice_sessions")).rows[0].n,
    0,
  );
});
for (const [name, sql] of [
  ["Practice ended", `update practices set ended_at=now(),status='completed'`],
  [
    "pitcher removed",
    `update player_team_memberships set active=false where player_id='${id(41)}'`,
  ],
  ["coach revoked", `update profile_team_memberships set active=false`],
])
  test(`${name} denies next write`, async () => {
    const r = await start(settings({ source: "PLAYER", pitcherId: id(41) }));
    await db.exec(sql);
    await denied(() => pitch(r));
  });
test("round end denies writes and preserves prior evidence", async () => {
  let r = await start();
  r = await pitch(r);
  r = await call("end", r);
  await denied(() => pitch(r));
  assert.equal(
    (await db.query("select count(*)::int n from hitting_events")).rows[0].n,
    1,
  );
});
test("coach-assessed contact quality survives linked hitter and pitcher readback", async () => {
  const r = await start(settings({ source: "PLAYER", pitcherId: id(41) }));
  await pitch(r, {
    outcome: "Ball in play",
    battedBall: "Line drive",
    contactQuality: "Hard",
  });
  assert.equal(
    (await db.query("select contact_quality from hitting_events")).rows[0]
      .contact_quality,
    "Hard",
  );
  assert.equal(
    (await db.query("select contact_quality from pitch_events")).rows[0]
      .contact_quality,
    "Hard contact",
  );
});
test("player endpoint and direct mutation cannot bypass linked-save boundary", async () => {
  const r = await start();
  await denied(() => call("pitch", r, {}, randomUUID(), id(2)));
  await pitch(r);
  await asAccount(db, id(1), async () => {
    await denied(
      () => db.exec("delete from hitting_events"),
      /endpoint|permission|denied/i,
    );
    await denied(() => call("pitch", r, {}, randomUUID()), /permission/i);
  });
});

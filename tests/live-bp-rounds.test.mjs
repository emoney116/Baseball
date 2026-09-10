import { before, after, beforeEach, afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fullPlayerDatabase } from "./helpers/fullPlayerDatabase.mjs";
import { id, asAccount } from "./helpers/playerDatabase.mjs";
import { buildBpRunnerMove } from "../app/lib/liveBpRunnerMove.ts";
import {
  buildBpPitch,
  initialBpSettings,
  initialBpState,
  validateBpSettings,
  bpTracksCount,
  withBpPitcherAlignment,
  bpPositionTracked,
  toggleBpPosition,
  validateBpState,
  withBpRunners,
} from "../app/lib/liveBp.ts";

const settings = (patch = {}) => ({ ...initialBpSettings(id(40)), ...patch });
test("position tracking toggles preserve assignments and exclude non-player P", () => {
  const all = settings({
    source: "COACH",
    defense: "ALL",
    alignment: { CF: id(42) },
  });
  assert.equal(bpPositionTracked(all, "P"), false);
  assert.equal(bpPositionTracked(all, "CF"), true);
  const off = toggleBpPosition(all, "CF");
  assert.equal(bpPositionTracked(off, "CF"), false);
  assert.equal(bpPositionTracked(off, "SS"), true);
  assert.deepEqual(off.alignment, all.alignment);
  assert.equal(bpPositionTracked(toggleBpPosition(off, "CF"), "CF"), true);
  assert.equal(
    bpPositionTracked(toggleBpPosition(settings(), "CF"), "CF"),
    true,
  );
  assert.equal(bpPositionTracked(toggleBpPosition(all, "P"), "P"), false);
});

test("named runners follow walks, advances, home runs and third outs", () => {
  const s = settings({ mode: "GAME" });
  const state = {
    ...initialBpState(),
    balls: 3,
    runners: [1],
    runnerIds: { 1: id(42) },
  };
  const after = buildBpPitch(s, state, { outcome: "Ball" }).stateAfter;
  assert.deepEqual(after.runnerIds, { 1: id(40), 2: id(42) });
  const move = buildBpRunnerMove(s, after, {
    from: 2,
    to: 3,
    reason: "Stolen base",
  });
  assert.deepEqual(move.stateAfter.runnerIds, { 1: id(40), 3: id(42) });
  assert.equal(move.movement.runnerId, id(42));
  assert.deepEqual(
    buildBpPitch(s, state, { outcome: "Ball in play", result: "Home Run" })
      .stateAfter.runnerIds,
    {},
  );
  assert.deepEqual(
    buildBpPitch(s, { ...state, strikes: 2, outs: 2 }, { outcome: "Whiff" })
      .stateAfter.runnerIds,
    {},
  );
  assert.deepEqual(withBpRunners(state, []).runnerIds, {});
  assert.throws(() => validateBpState({ ...state, runnerIds: { 2: id(42) } }));
  assert.throws(() =>
    validateBpState({
      ...state,
      runners: [1, 2],
      runnerIds: { 1: id(42), 2: id(42) },
    }),
  );
  assert.throws(() =>
    buildBpRunnerMove(s, after, { from: 1, to: 2, reason: "Wild pitch" }),
  );
  assert.throws(() =>
    buildBpRunnerMove(s, after, { from: 2, to: 1, reason: "Wild pitch" }),
  );
});

for (const source of ["MACHINE", "COACH", "PLAYER"])
  test(`undo ${source} removes all linked stats and restores exact situation`, async () => {
    const state = {
      ...initialBpState(),
      balls: 2,
      strikes: 1,
      outs: 1,
      runners: [2],
      runnerIds: { 2: id(42) },
    };
    const r = await start(
      settings({
        mode: "GAME",
        source,
        pitcherId: id(41),
        defense: "ALL",
        alignment: { SS: id(42) },
      }),
      state,
    );
    const pitched = await pitch(r, {
      outcome: "Ball in play",
      result: "Out",
      position: "SS",
      defenseResult: "Clean",
      runnerOutcomes: { 2: "3" },
      ev: 90,
    });
    const undone = await call("undo", pitched, {}, randomUUID());
    assert.deepEqual(undone.state, state);
    assert.equal(undone.version, pitched.version + 1);
    for (const table of ["hitting_events", "pitch_events", "defense_events"])
      assert.equal(
        (await db.query(`select count(*)::int n from ${table}`)).rows[0].n,
        0,
      );
  });

test("undo retries never remove another pitch, and pitch retries cannot resurrect deleted stats", async () => {
  const r = await start();
  const pitchId = randomUUID(),
    undoId = randomUUID();
  const p = await pitch(r, { outcome: "Ball" }, pitchId);
  const undone = await call("undo", p, {}, undoId);
  const second = await pitch(undone);
  assert.deepEqual(await call("undo", p, {}, undoId), second);
  assert.deepEqual(await call("pitch", r, {}, pitchId), second);
  assert.equal(
    (await db.query("select count(*)::int n from hitting_events")).rows[0].n,
    1,
  );
  await denied(() => call("undo", p, {}, randomUUID()), /changed/i);
  await call("undo", second, {}, randomUUID());
  const latest = (await db.query("select to_jsonb(r) r from live_bp_rounds r"))
    .rows[0].r;
  await denied(() => call("undo", latest, {}, randomUUID()), /No pitch/i);
});

test("runner movement is idempotent and undo rolls back subsequent movements", async () => {
  const r = await start(settings({ mode: "GAME" }), {
    ...initialBpState(),
    runners: [1],
    runnerIds: { 1: id(42) },
  });
  const p = await pitch(r, { outcome: "Ball" });
  const moveId = randomUUID();
  const payload = buildBpRunnerMove(p.settings, p.state, {
    from: 1,
    to: 2,
    reason: "Wild pitch",
  });
  const moved = await call("runner", p, payload, moveId);
  assert.deepEqual(moved.state.runnerIds, { 2: id(42) });
  assert.deepEqual(await call("runner", p, {}, moveId), moved);
  assert.equal(
    (await db.query("select count(*)::int n from hitting_events")).rows[0].n,
    1,
  );
  const undone = await call("undo", moved, {}, randomUUID());
  assert.deepEqual(undone.state, r.state);
  assert.equal(
    (
      await db.query(
        "select undone from clubhouse_private.live_bp_actions where id=$1",
        [moveId],
      )
    ).rows[0].undone,
    true,
  );
  assert.deepEqual(await call("runner", p, {}, moveId), undone);
});

test("failed linked deletion rolls the entire undo back", async () => {
  const r = await start(
    settings({
      source: "PLAYER",
      pitcherId: id(41),
      defense: "ALL",
      alignment: { SS: id(42) },
    }),
  );
  const p = await pitch(r, {
    outcome: "Ball in play",
    result: "Out",
    position: "SS",
    defenseResult: "Clean",
  });
  await db.exec(`create function public.fail_bp_delete() returns trigger language plpgsql as $$ begin raise exception 'forced failure'; end; $$;
    create trigger fail_bp_delete before delete on public.hitting_events for each row execute function public.fail_bp_delete();`);
  await denied(() => call("undo", p, {}, randomUUID()), /forced failure/i);
  for (const table of ["hitting_events", "pitch_events", "defense_events"])
    assert.equal(
      (await db.query(`select count(*)::int n from ${table}`)).rows[0].n,
      1,
    );
  assert.equal(
    (await db.query("select version from live_bp_rounds")).rows[0].version,
    p.version,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from clubhouse_private.live_bp_actions where undone",
      )
    ).rows[0].n,
    0,
  );
});

test("undo rechecks coach authority and ended practice", async () => {
  const p = await pitch(await start());
  await denied(() => call("undo", p, {}, randomUUID(), id(2)), /authority/i);
  await db.exec("update practices set ended_at=now()");
  await denied(() => call("undo", p, {}, randomUUID()), /running/i);
});

test("same-base safe, pickoff outs, and third-out reset preserve runner identity", () => {
  const s = settings({ mode: "GAME" });
  const state = {
    ...initialBpState(),
    balls: 2,
    strikes: 1,
    outs: 1,
    runners: [1, 2],
    runnerIds: { 1: id(40), 2: id(42) },
  };
  const safe = buildBpRunnerMove(s, state, {
    from: 2,
    to: 2,
    outcome: "safe",
    reason: "Pickoff attempt",
  });
  assert.deepEqual(safe.stateAfter, state);
  const out = buildBpRunnerMove(s, state, {
    from: 2,
    to: 2,
    outcome: "out",
    reason: "Picked off",
  });
  assert.equal(out.stateAfter.outs, 2);
  assert.deepEqual(out.stateAfter.runnerIds, { 1: id(40) });
  assert.equal(out.stateAfter.balls, 2);
  const third = buildBpRunnerMove(s, out.stateAfter, {
    from: 1,
    to: 2,
    outcome: "out",
    reason: "Caught stealing",
  });
  assert.deepEqual(third.stateAfter, {
    ...initialBpState(),
    runnerIds: {},
    pa: 2,
  });
  assert.throws(() =>
    buildBpRunnerMove(s, state, {
      from: 2,
      to: 2,
      outcome: "safe",
      reason: "Picked off",
    }),
  );
});

test("pinch runners are roster scoped, idempotent, and reverted with their pitch", async () => {
  const state = { ...initialBpState(), runners: [2], runnerIds: { 2: id(42) } };
  let r = await pitch(await start(settings({ mode: "GAME" }), state), {
    outcome: "Ball",
  });
  const move = {
    from: 2,
    to: 2,
    reason: "Pinch runner",
    replacementRunnerId: id(41),
    outcome: "safe",
  };
  const request = randomUUID();
  const payload = buildBpRunnerMove(r.settings, r.state, move);
  const next = await call("runner", r, payload, request);
  assert.deepEqual(next.state.runnerIds, { 2: id(41) });
  assert.equal((await call("runner", r, {}, request)).version, next.version);
  assert.equal(
    (await db.query("select count(*)::int n from hitting_events")).rows[0].n,
    1,
  );
  await denied(() =>
    call(
      "runner",
      next,
      buildBpRunnerMove(next.settings, next.state, {
        ...move,
        replacementRunnerId: id(99),
      }),
      randomUUID(),
    ),
  );
  const restored = await call("undo", next, {}, randomUUID());
  assert.deepEqual(restored.state, state);
  assert.equal(
    (await db.query("select count(*)::int n from hitting_events")).rows[0].n,
    0,
  );
});

test("field sequence and runner reasons persist as provenance without invented defensive credits", async () => {
  const r = await start(
    settings({
      mode: "GAME",
      source: "PLAYER",
      pitcherId: id(41),
      defense: "ALL",
      alignment: { SS: id(42), P: id(41) },
    }),
    { ...initialBpState(), runners: [2], runnerIds: { 2: id(42) } },
  );
  const draft = {
    outcome: "Ball in play",
    result: "Out",
    battedBall: "Bunt",
    position: "SS",
    defenseResult: "Clean",
    fieldingSequence: ["SS", "P"],
    runnerOutcomes: { 2: "3" },
    runnerReasons: { 2: "On throwing error" },
  };
  const next = await pitch(r, draft);
  const context = (await db.query("select live_bp_context from hitting_events"))
    .rows[0].live_bp_context;
  assert.deepEqual(context.fieldingSequence, [
    { position: "SS", playerId: id(42) },
    { position: "P", playerId: id(41) },
  ]);
  assert.equal(context.runnerReasons[2], "On throwing error");
  assert.deepEqual(next.state.runnerIds, { 3: id(42) });
  assert.equal(next.state.outs, 1);
  assert.equal(context.jobSuccess, undefined);
  assert.equal(
    (await db.query("select count(*)::int n from defense_events")).rows[0].n,
    1,
  );
  assert.throws(() =>
    buildBpPitch(r.settings, r.state, { ...draft, fieldingSequence: ["CF"] }),
  );
  assert.throws(() =>
    buildBpPitch(r.settings, r.state, {
      ...draft,
      runnerReasons: { 1: "On last play" },
    }),
  );
  assert.throws(() =>
    buildBpPitch(r.settings, r.state, {
      ...draft,
      runnerReasons: { 2: "not valid" },
    }),
  );
  await call("undo", next, {}, randomUUID());
  for (const table of ["hitting_events", "pitch_events", "defense_events"])
    assert.equal(
      (await db.query(`select count(*)::int n from ${table}`)).rows[0].n,
      0,
    );
});
test("pitcher alignment follows source without overwriting other defenders", () => {
  const s = withBpPitcherAlignment(
    settings({
      source: "PLAYER",
      pitcherId: id(41),
      alignment: { P: id(43), SS: id(41), CF: id(42) },
    }),
  );
  assert.deepEqual(s.alignment, { P: id(41), CF: id(42) });
  const changed = withBpPitcherAlignment({ ...s, pitcherId: id(43) });
  assert.deepEqual(changed.alignment, { P: id(43), CF: id(42) });
  for (const source of ["COACH", "MACHINE"]) {
    const nonPlayer = withBpPitcherAlignment({ ...changed, source });
    assert.deepEqual(nonPlayer.alignment, { CF: id(42) });
    assert.equal(
      buildBpPitch(nonPlayer, initialBpState(), { outcome: "Ball" }).pitching,
      undefined,
    );
  }
});
test("derived player pitcher can receive atomic P defense evidence", async () => {
  const s = withBpPitcherAlignment(
    settings({ source: "PLAYER", pitcherId: id(41), defense: "ALL" }),
  );
  const r = await start(s);
  await pitch(r, {
    outcome: "Ball in play",
    position: "P",
    defenseResult: "Clean",
  });
  const defense = (
    await db.query("select player_id,position_worked from defense_events")
  ).rows;
  assert.equal(defense.length, 1);
  assert.equal(defense[0].player_id, id(41));
  assert.equal(defense[0].position_worked, "P");
});
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

test("defensive presets persist atomically with settings without logging an event", async () => {
  const preset = {
    id: "team1",
    name: "Team 1",
    alignment: { SS: id(42) },
    defense: "SELECTED",
    positions: ["SS"],
  };
  let r = await start();
  r = await call("configure", r, {
    settings: { ...r.settings, defensePresets: [preset] },
    state: r.state,
  });
  assert.deepEqual(r.settings.defensePresets, [preset]);
  assert.equal(
    (await db.query("select count(*)::int n from hitting_events")).rows[0].n,
    0,
  );
  r = await pitch(r);
  assert.deepEqual(r.settings.defensePresets, [preset]);
});
test("situation corrections persist without adding or changing linked pitches", async () => {
  let r = await start(
    settings({ mode: "GAME", source: "PLAYER", pitcherId: id(41) }),
  );
  r = await pitch(r);
  const before = (await db.query("select * from hitting_events")).rows;
  for (const change of [
    { balls: 2, strikes: 1, outs: 2, runners: [1, 3] },
    { balls: 0, strikes: 0 },
    { outs: 0 },
    { runners: [] },
  ]) {
    const next = { ...r.state, ...change };
    r = await call("configure", r, { settings: r.settings, state: next });
    assert.deepEqual(r.state, next);
  }
  assert.deepEqual(
    (await db.query("select * from hitting_events")).rows,
    before,
  );
  assert.equal(
    (await db.query("select count(*)::int n from pitch_events")).rows[0].n,
    1,
  );
  assert.equal(
    (await db.query("select count(*)::int n from defense_events")).rows[0].n,
    0,
  );
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

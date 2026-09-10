import { before, beforeEach, afterEach, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fullPlayerDatabase } from "./helpers/fullPlayerDatabase.mjs";
import { id, asAccount } from "./helpers/playerDatabase.mjs";
import { resolvePlayerCapabilities } from "../app/lib/playerCapabilities.ts";
import { executeAnalyticsQuery } from "../app/lib/analyticsQuery.ts";
import { loadPlayerSession } from "../app/lib/playerAccess.ts";
import { playerServiceFixture } from "./helpers/playerServiceFixture.mjs";
import { composeAskClubhouseQueryPlan } from "../app/lib/askClubhouse/queryPlan.ts";
import { generateAskClubhouseReply } from "../app/lib/askClubhouse/engine.ts";
import { getAskClubhouseConfig } from "../app/lib/askClubhouse/config.ts";
import { playerAskContext } from "../app/lib/playerAskScope.ts";
import { writePlayerPersonal, loadPlayerPersonal } from "../app/lib/playerPersonal.ts";
let db;
before(async () => {
  db = await fullPlayerDatabase();
  await db.exec(`
    insert into auth.users(id,email) values('${id(1)}','personal-player@example.test'),('${id(2)}','personal-coach@example.test');
    insert into profiles(id,role) values('${id(1)}','PLAYER'),('${id(2)}','COACH');
    insert into organizations(id,name,slug) values('${id(10)}','Personal QA','personal-qa');
    insert into teams(id,organization_id,name,player_access_default,player_tracking_policy) values('${id(20)}','${id(10)}','A','TRACK_AND_VIEW','PERSONAL_AND_LIVE'),('${id(21)}','${id(10)}','B','TRACK_AND_VIEW','LIVE_ONLY');
    insert into seasons(id,organization_id,team_id,name) values('${id(30)}','${id(10)}','${id(20)}','Fall'),('${id(31)}','${id(10)}','${id(21)}','Fall');
    insert into players(id,organization_id,first_name,last_name,primary_position,bats,throws) values('${id(40)}','${id(10)}','Personal','Player','SS','R','R');
    insert into player_team_memberships(id,player_id,team_id,season_id) values('${id(50)}','${id(40)}','${id(20)}','${id(30)}'),('${id(51)}','${id(40)}','${id(21)}','${id(31)}');
    insert into profile_team_memberships(profile_id,team_id,role) values('${id(2)}','${id(20)}','COACH');
    insert into profile_player_links(id,profile_id,player_id,claim_player_team_membership_id,claim_team_id,claim_season_id) values('${id(70)}','${id(1)}','${id(40)}','${id(50)}','${id(20)}','${id(30)}');
    update profile_player_links set status='APPROVED',approved_by_profile_id='${id(2)}' where id='${id(70)}';
  `);
});
beforeEach(async () => db.exec("begin"));
afterEach(async () => db.exec("rollback"));
after(async () => db?.close());
async function denied(fn, pattern = /permitted|read-only|ownership|required|denied|ended|unavailable/i) {
  await db.exec("savepoint attack"); await assert.rejects(fn, pattern); await db.exec("rollback to savepoint attack");
}
async function start(domain, options = {}) {
  const sid = options.session ?? randomUUID();
  const result = await db.query("select manage_player_personal_session($1,$2,$3,$4,$5) id", [options.actor ?? id(1), options.membership ?? id(50), sid, domain, options.operation ?? "start"]);
  return result.rows[0].id;
}
const payloads = { hitting: { action: "Ball in play", contact_result: "Line drive", exit_velocity_mph: 84 }, pitching: { outcome: "Called Strike", pitch_type: "Slider", velocity: 77 }, defense: { outcome: "Clean", rep_type: "Ground Ball", throw_result: "Accurate" } };
const tables = { hitting: "hitting_events", pitching: "pitch_events", defense: "defense_events" };
async function write(domain, session, options = {}) {
  const result = await db.query("select write_player_personal_entry($1,$2,$3,$4,$5,$6,$7,$8) id", [options.actor ?? id(1), options.membership ?? id(50), domain, session, options.operation ?? "create", options.request ?? randomUUID(), options.entry ?? null, options.payload ?? payloads[domain]]);
  return result.rows[0].id;
}
for (const domain of Object.keys(tables)) {
  test(`${domain}: personal records reuse canonical fields without fake Practice parent`, async () => {
    const session = await start(domain); const entry = await write(domain, session);
    const row = (await db.query(`select * from ${tables[domain]} where id=$1`, [entry])).rows[0];
    assert.equal(row.personal_session_id, session); assert.equal(row.practice_id, null); assert.equal(row.session_id, null);
    assert.equal(row.created_by_profile_id, id(1)); assert.equal(row.entry_source, "PLAYER");
  });
  for (const [label, sql] of [
    ["View Only", `update teams set player_access_default='VIEW_ONLY' where id='${id(20)}'`],
    ["policy downgrade", `update teams set player_tracking_policy='LIVE_ONLY' where id='${id(20)}'`],
    ["revoke", `update profile_player_links set status='REVOKED',revoked_by_profile_id='${id(2)}' where id='${id(70)}'`],
    ["inactive membership", `update player_team_memberships set active=false where id='${id(50)}'`],
  ]) test(`${domain}: ${label} denies next personal write and preserves history`, async () => {
    const session = await start(domain); await write(domain, session); await db.exec(sql);
    await denied(() => write(domain, session));
    assert.equal((await db.query(`select count(*)::int n from ${tables[domain]} where personal_session_id=$1`, [session])).rows[0].n, 1);
  });
  test(`${domain}: Full Player still obeys Live Only on Team B`, async () => {
    await db.exec(`update teams set player_access_default='FULL_PLAYER' where id='${id(21)}'`);
    await denied(() => start(domain, { membership: id(51) }));
  });
  test(`${domain}: retry and double submit retain one session and one event`, async () => {
    const session = await start(domain); assert.equal(await start(domain, { session }), session);
    const request = randomUUID(); const entry = await write(domain, session, { request }); assert.equal(await write(domain, session, { request }), entry);
    assert.equal((await db.query(`select count(*)::int n from ${tables[domain]} where personal_session_id=$1`, [session])).rows[0].n, 1);
  });
  test(`${domain}: end, cross-profile, cross-team and domain forgery deny writes`, async () => {
    const session = await start(domain);
    await denied(() => write(domain, session, { actor: id(2) }));
    await denied(() => write(domain, session, { membership: id(51) }));
    await start(domain, { session, operation: "end" }); await denied(() => write(domain, session));
  });
  test(`${domain}: client database role cannot bypass server endpoint`, async () => {
    const session = await start(domain); await write(domain, session);
    await asAccount(db, id(1), async () => {
      assert.equal((await db.query(`select * from ${tables[domain]} where personal_session_id=$1`, [session])).rows.length, 0);
      await denied(() => write(domain, session), /permission denied/i);
    });
  });
}
test("tracking settings require exact team coach authority", async () => {
  await denied(() => db.query("select set_player_tracking_policy($1,$2,'LIVE_ONLY')", [id(1),id(20)]));
  await db.query("select set_player_tracking_policy($1,$2,'LIVE_ONLY')", [id(2),id(20)]);
  assert.equal((await db.query("select count(*)::int n from player_tracking_policy_audit")).rows[0].n, 1);
});
test("Live Only cannot log standalone body weight through the legacy endpoint", async () => {
  await db.exec(`update teams set player_tracking_policy='LIVE_ONLY' where id='${id(20)}'`);
  await denied(() => db.query("select write_player_self_entry($1,$2,'body_weight','create',null,current_date,180,null,false)", [id(1),id(50)]));
});
for (const mode of ["VIEW_ONLY","TRACK_AND_VIEW","FULL_PLAYER"]) for (const trackingPolicy of ["LIVE_ONLY","PERSONAL_AND_LIVE"]) test(`${mode} / ${trackingPolicy} resolves independent permissions`, () => {
  const { capabilities } = resolvePlayerCapabilities({ approved: true, teamDefault: mode, trackingPolicy });
  assert.equal(capabilities.canEnterLivePractice, mode !== "VIEW_ONLY");
  assert.equal(capabilities.canStartPersonalHittingSession, mode !== "VIEW_ONLY" && trackingPolicy === "PERSONAL_AND_LIVE");
  assert.equal(capabilities.canStartPersonalWorkout, false); assert.equal(capabilities.canEditOfficialGames, false);
});
test("own canonical Analytics separates Personal from Practice and default All", async () => {
  const f = playerServiceFixture();
  f.tables.player_personal_sessions = [{ id: id(99), team_id: id(20), season_id: id(30), player_id: id(40), membership_id: id(50), created_by_profile_id: id(1), domain: "hitting", started_at: "2026-09-04T12:00:00Z" }];
  f.tables.hitting_events.push({ id: id(98), personal_session_id: id(99), hitter_id: id(40), created_by_profile_id: id(1), action: "Ball in play", contact_result: "Line drive", exit_velocity_mph: 84, created_at: "2026-09-04T12:00:00Z" });
  const session = await loadPlayerSession(f.db, id(1));
  const query = { domain: "hitting", timeRange: "season", metrics: ["swings"], mode: "box-score", groupBy: "player", playerIds: [id(40)] };
  const value = source => executeAnalyticsQuery(session.data, { ...query, source }).rows[0].cells.swings.value;
  assert.equal(value("personal"), 1); assert.equal(value("practice"), 3); assert.equal(value("all"), 3);
  const reply = await generateAskClubhouseReply({ data: session.data, message: "How did I hit in my personal session?", config: getAskClubhouseConfig({}), uiContext: playerAskContext(session.context, {}) });
  assert.ok(reply.toolResults.some(r => JSON.stringify(r).includes('"personal"')));
  assert.ok(reply.toolResults.some(r => JSON.stringify(r).includes('84')));
  const generic = await generateAskClubhouseReply({ data: session.data, message: "How did I hit today?", now: new Date("2026-09-04T16:00:00Z"), config: getAskClubhouseConfig({}), uiContext: playerAskContext(session.context, { timeZone: "America/New_York" }) });
  assert.ok(generic.toolResults.some(r => r.query?.source === "personal" && JSON.stringify(r).includes('84')), JSON.stringify(generic));
  const team = await generateAskClubhouseReply({ data: session.data, message: "How did I hit in team Practice today?", now: new Date("2026-09-04T16:00:00Z"), config: getAskClubhouseConfig({}), uiContext: playerAskContext(session.context, {}) });
  assert.ok(team.toolResults.every(r => r.query?.source !== "personal"));
});
test("Ask bullpen self-summary includes Personal evidence without contaminating explicit team requests", async () => {
  const f = playerServiceFixture();
  f.tables.player_personal_sessions = [{ id: id(99), team_id: id(20), season_id: id(30), player_id: id(40), membership_id: id(50), created_by_profile_id: id(1), domain: "pitching", started_at: "2026-09-04T12:00:00Z" }];
  f.tables.pitch_events.push({ id: id(98), personal_session_id: id(99), pitcher_id: id(40), created_by_profile_id: id(1), outcome: "Called Strike", pitch_type: "4-Seam", velocity: 80, created_at: "2026-09-04T12:00:00Z" });
  const session = await loadPlayerSession(f.db, id(1));
  for (const [message, includePersonal] of [["How did my bullpen go?", true], ["How did my team Practice bullpen go?", false], ["How did my bullpen go in Practice?", false]]) {
    const reply = await generateAskClubhouseReply({ data: session.data, message, config: getAskClubhouseConfig({}), uiContext: playerAskContext(session.context, {}) });
    assert.equal(reply.toolResults.some(r => r.query?.source === "personal"), includePersonal, message);
    if (includePersonal) assert.ok(reply.toolResults.some(r => r.query?.source === "personal" && JSON.stringify(r).includes('80')));
  }
});
test("Ask explicitly distinguishes Personal and team Practice source", () => {
  assert.equal(composeAskClubhouseQueryPlan("How did I hit in my personal session today?").scope.source, "personal");
  assert.equal(composeAskClubhouseQueryPlan("How did I hit in team Practice today?", { analytics: { source: "personal" } }).scope.source, "practice");
});

test("personal server service ignores forged actor and validates current policy before RPC", async () => {
  const f = playerServiceFixture();
  const rpc = [];
  f.db.rpc = async (name, args) => { rpc.push({ name, args }); return { data: id(90), error: null }; };
  const input = { membershipId: id(50), sessionId: id(90), domain: "hitting", operation: "start", actor: id(2), trackingPolicy: "PERSONAL_AND_LIVE" };
  await assert.rejects(() => writePlayerPersonal(f.db, id(1), input), /not permitted/);
  assert.equal(rpc.length, 0);
  f.tables.teams[0].player_access_default = "TRACK_AND_VIEW";
  f.tables.teams[0].player_tracking_policy = "PERSONAL_AND_LIVE";
  await writePlayerPersonal(f.db, id(1), input);
  assert.equal(rpc[0].args.actor, id(1));
  assert.equal(rpc[0].args.target_membership, id(50));
});

test("personal read projection excludes another player's event and revalidates revoked access", async () => {
  const f = playerServiceFixture();
  f.tables.player_personal_sessions = [{ id: id(90), membership_id: id(50), team_id: f.team, season_id: f.season, player_id: f.own, created_by_profile_id: id(1), domain: "hitting", started_at: "2026-09-04T12:00:00Z" }];
  f.tables.hitting_events.push({ id: id(91), personal_session_id: id(90), hitter_id: f.other, created_by_profile_id: id(1), action: "Swing" });
  const result = await loadPlayerPersonal(f.db, id(1), id(50));
  assert.equal(result.sessions.length, 1);
  assert.equal(result.entries.length, 0);
  f.hooks.beforeRead = table => { if (table === "hitting_events") f.tables.profile_player_links[0].status = "REVOKED"; };
  await assert.rejects(() => loadPlayerPersonal(f.db, id(1), id(50)));
});

import test from "node:test";
import assert from "node:assert/strict";
import { playerServiceFixture, uuid } from "./helpers/playerServiceFixture.mjs";
import { loadPlayerSession, listPlayerContexts } from "../app/lib/playerAccess.ts";
import { approvedPlayerPinTarget, loadOwnTeamPins, saveOwnTeamPin } from "../app/lib/teamPins.ts";
import { homeDateRange, playerHomeDomains, playerHomeMetric, playerHomePerformance } from "../app/lib/playerHome.ts";

test("Home metrics retain exact player scope even with altered query player IDs", async () => {
  const f = playerServiceFixture(); const s = await loadPlayerSession(f.db, uuid(1));
  const metric = playerHomeMetric(s.data, f.own, "hitting", { id: "avgEv", source: "practice" }, { playerIds: [f.other] });
  assert.deepEqual(metric.query.playerIds, [f.own]);
  assert.notEqual(metric.cell?.value, 110);
});
test("Home performance comes from the canonical metric query", async () => {
  const f = playerServiceFixture(); const s = await loadPlayerSession(f.db, uuid(1));
  const metrics = playerHomePerformance(s.data, f.own, "hitting");
  assert.equal(metrics.length, 5);
  for (const metric of metrics) assert.deepEqual(metric.cell, playerHomeMetric(s.data, f.own, "hitting", metric).cell);
});
test("Home receives visibility markers without receiving historical private notes or goals", async () => {
  const f = playerServiceFixture(); const s = await loadPlayerSession(f.db, uuid(1));
  assert.ok(s.data.developmentGoals.length > 0);
  assert.ok(s.data.developmentGoals.every(g => g.playerVisible === true));
  assert.ok(s.data.coachNotes.length > 0);
  assert.ok(s.data.coachNotes.every(n => n.visibility === "player_visible"));
  assert.doesNotMatch(JSON.stringify(s.data), /PRIVATE COACH NOTE|PRIVATE GOAL/);
});
test("Home discipline follows player role and tracked usage", async () => {
  const f = playerServiceFixture(); const s = await loadPlayerSession(f.db, uuid(1));
  assert.ok(playerHomeDomains(s.data, s.data.players[0]).includes("hitting"));
  assert.ok(playerHomeDomains(s.data, { ...s.data.players[0], isPitcher: true }).includes("pitching"));
});
test("Home comparison periods do not overlap across year boundaries", () => {
  assert.deepEqual(homeDateRange(new Date(2026, 0, 7), 14), { start: "2025-12-25", end: "2026-01-07" });
  assert.deepEqual(homeDateRange(new Date(2026, 0, 7), 14, 14), { start: "2025-12-11", end: "2025-12-24" });
});
test("Player pins require the exact approved team and season", async () => {
  const f = playerServiceFixture(); const contexts = await listPlayerContexts(f.db, uuid(1));
  assert.equal(approvedPlayerPinTarget(contexts, f.team, f.season), true);
  assert.equal(approvedPlayerPinTarget(contexts, f.team), false);
  assert.equal(approvedPlayerPinTarget(contexts, f.team, uuid(999)), false);
  assert.equal(approvedPlayerPinTarget(contexts, uuid(998), f.season), false);
  assert.equal(approvedPlayerPinTarget([], f.team, f.season), false);
});
function pinFixture(initial = []) {
  let rows = [...initial];
  const db = { from() {
    const filters = []; let operation = "read", input;
    const q = { select() {return q;}, eq(k,v) {filters.push(r => r[k] === v); return q;}, is(k,v) {filters.push(r => (r[k] ?? null) === v); return q;}, delete() {operation="delete";return q;}, insert(row) {operation="insert";input=row;return q;}, single() {return q;}, then(resolve) {
      if(operation === "insert") {const row = { ...input, id: String(rows.length+1) }; rows.push(row);return Promise.resolve({data:row,error:null}).then(resolve);}
      const selected = rows.filter(r => filters.every(f => f(r)));
      if(operation === "delete") rows = rows.filter(r => !selected.includes(r));
      return Promise.resolve({data:selected,error:null}).then(resolve);
    }}; return q;
  }};
  return {db, rows: () => rows};
}
test("Pins persist and repeat pinning is idempotent", async () => {
  const f = pinFixture();
  await saveOwnTeamPin(f.db,"me","team","season",true);
  await saveOwnTeamPin(f.db,"me","team","season",true);
  assert.equal((await loadOwnTeamPins(f.db,"me")).length,1);
  assert.equal(f.rows().length,1);
});
test("Unpin preserves another account and another season", async () => {
  const f = pinFixture([{profile_id:"me",team_id:"team",season_id:"season"},{profile_id:"other",team_id:"team",season_id:"season"},{profile_id:"me",team_id:"team",season_id:"other-season"}]);
  await saveOwnTeamPin(f.db,"me","team","season",false);
  assert.equal(f.rows().length,2);
  assert.ok(f.rows().some(r => r.profile_id === "other"));
});
test("Pins retain the shared three-team limit", async () => {
  const f = pinFixture();
  for (const team of ["one","two","three"]) await saveOwnTeamPin(f.db,"me",team,"season",true);
  await assert.rejects(saveOwnTeamPin(f.db,"me","four","season",true), /up to 3/);
  assert.equal(f.rows().length,3);
});

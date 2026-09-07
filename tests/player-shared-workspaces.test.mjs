import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { loadPlayerSession } from "../app/lib/playerAccess.ts";
import { playerAskContext } from "../app/lib/playerAskScope.ts";
import { loadOtherPlayerAskTeams, generatePlayerTeamsReply, requirePlayerAskSession } from "../app/lib/playerAskTeams.ts";
import { resolveAskClubhousePlayer } from "../app/lib/askClubhouse/entityResolution.ts";
import { composeAskClubhouseQueryPlan } from "../app/lib/askClubhouse/queryPlan.ts";
import { getAskClubhouseConfig } from "../app/lib/askClubhouse/config.ts";
import { generateAskClubhouseReply } from "../app/lib/askClubhouse/engine.ts";
import { playerServiceFixture, uuid } from "./helpers/playerServiceFixture.mjs";

const views = readFileSync("app/components/TeamWorkspaceViews.tsx", "utf8");
const player = readFileSync("app/components/PlayerShell.tsx", "utf8");
const live = readFileSync("app/components/PlayerLiveEntry.tsx", "utf8");
const config = getAskClubhouseConfig({});

test("player uses actual team pages with forced approved self identity and no staff callbacks", () => {
  assert.match(player, /<AnalyticsView/);
  assert.match(player, /<ScheduleView/);
  assert.match(views, /playerIds: playerScope \? \[playerScope.playerId\]/);
  assert.match(views, /showTeamTotals=\{!playerScope\}/);
  assert.match(views, /url.searchParams.set\("workspace", "player"\)/);
  assert.match(views, /action=\{onAddEvent &&/);
  assert.match(views, /genericEvent && onUpdateScheduleEvent &&/);
  assert.doesNotMatch(player, /onAddEvent=|onUpdateScheduleEvent=|<AnalyticsTable/);
});
test("live logging shares coach result, velocity, and set controls without trusting their cell identity", () => {
  for (const component of ["PracticeResultChoices", "VelocityPickerField", "WeightRoomInlineSetCell", "ChoiceSelect"]) assert.match(live, new RegExp("<" + component));
  assert.match(live, /membershipId,\s*sessionId: session.id/);
  assert.match(live, /onSaveCell=\{\(_cell, draft\)/);
  assert.match(live, /requestId: crypto.randomUUID\(\)/);
  assert.match(live, /await save\(pending.current\)/);
});
test("I and my resolve exact account link even with same-name records", async () => {
  const f = playerServiceFixture(), session = await loadPlayerSession(f.db, uuid(1));
  const data = { ...session.data, players: [...session.data.players, { ...session.data.players[0], id: uuid(999) }] };
  for (const message of ["How am I hitting?", "Show my spray chart", "What should I work on?"]) {
    const result = resolveAskClubhousePlayer({ data, message, route: "clubhouse_data", uiContext: playerAskContext(session.context) });
    assert.equal(result.status, "single"); assert.equal(result.player.id, session.context.playerId);
  }
});
test("unapproved or revoked sessions cannot enter all-team Ask", () => {
  assert.throws(() => requirePlayerAskSession({ mode: "player", contexts: [] }), /approved/);
});
test("All My Teams is built from approved memberships, not client team IDs", async () => {
  const f = playerServiceFixture();
  f.tables.teams.push({ ...f.tables.teams[0], id: uuid(21), name: "Travel Team" });
  f.tables.seasons.push({ id: uuid(31), team_id: uuid(21), name: "Summer 2026", active: true });
  f.tables.player_team_memberships.push({ ...f.tables.player_team_memberships[0], id: uuid(52), team_id: uuid(21), season_id: uuid(31) });
  const current = await loadPlayerSession(f.db, uuid(1), { teamId: uuid(20) });
  const sessions = await loadOtherPlayerAskTeams(f.db, uuid(1), current);
  assert.equal(sessions.length, 2);
  assert.deepEqual(sessions.map(s => s.context.team.teamId), [uuid(20), uuid(21)]);
  assert.ok(sessions.every(s => s.data.players.every(p => p.id === uuid(40))));
  const reply = await generatePlayerTeamsReply(sessions, { data: current.data, message: "How am I hitting in practice?", config, now: new Date("2026-09-05"), uiContext: playerAskContext(current.context) });
  assert.match(reply.answer, /Metrolina Varsity/); assert.match(reply.answer, /Travel Team/);
  assert.doesNotMatch(reply.answer, /Other Seamon|PRIVATE/);
  assert.deepEqual(reply.actions, []);
  assert.equal(reply.toolNames.length, reply.toolResults.length);
});
test("explicit dates scope self metrics to that day instead of silent season totals", async () => {
  const f = playerServiceFixture(), session = await loadPlayerSession(f.db, uuid(1));
  for (const message of ["How did I hit in Practice on September 4, 2026?", "How did I hit in Practice on 2026-09-04?"]) {
    const context = playerAskContext(session.context);
    const plan = composeAskClubhouseQueryPlan(message, context, session.data.players[0]);
    assert.deepEqual(plan.scope.customDateRange, { start: "2026-09-04", end: "2026-09-04" });
    const reply = await generateAskClubhouseReply({ data: session.data, message, uiContext: context, config });
    assert.ok(reply.toolResults.some(r => r.rows?.some(row => row.playerId === session.context.playerId)));
    assert.ok(reply.toolParams.some(p => JSON.stringify(p).includes("2026-09-04")));
  }
});

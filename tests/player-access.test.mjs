import test from "node:test";
import assert from "node:assert/strict";
import {
  loadPlayerSession,
  listPlayerContexts,
  selectPlayerContext,
  hasStaffAccess,
  safePlayerRow,
} from "../app/lib/playerAccess.ts";
import {
  playerAskContext,
  isPrivateTeamQuestion,
} from "../app/lib/playerAskScope.ts";
import { executeAnalyticsQuery } from "../app/lib/analyticsQuery.ts";
import { generateAskClubhouseReply } from "../app/lib/askClubhouse/engine.ts";
import {
  getAskClubhouseConfig,
  resolveAiUsageRole,
} from "../app/lib/askClubhouse/config.ts";
import { resolveAskClubhouseAllowance } from "../app/lib/askClubhouse/entitlements.ts";
import { playerServiceFixture, uuid } from "./helpers/playerServiceFixture.mjs";
import { playerInvitationMessage } from "../app/lib/email/playerInvite.ts";

test("player history pagination retains more than 1,000 own events", async () => {
  const f = playerServiceFixture();
  f.tables.hitting_events = Array.from({ length: 2001 }, (_, i) => ({
    ...f.tables.hitting_events[0],
    id: uuid(1000 + i),
  }));
  const s = await loadPlayerSession(f.db, uuid(1));
  assert.equal(s.data.hittingEvents.length, 2001);
  assert.equal(new Set(s.data.hittingEvents.map((e) => e.id)).size, 2001);
});
test("invitation message identifies the exact player and email requirement without sending mail", () => {
  const message = playerInvitationMessage({
    url: "https://example.test/join/player/qa-token",
    playerName: "QA Exact Player",
  });
  assert.match(message, /QA Exact Player/);
  assert.match(message, /email address receiving/);
  assert.match(message, /seven days/);
  assert.match(message, /https:\/\/example.test\/join\/player\/qa-token/);
});

test("approved service response contains only self events and explicitly visible content", async () => {
  const f = playerServiceFixture(),
    s = await loadPlayerSession(f.db, uuid(1));
  assert.equal(s.context.playerId, f.own);
  assert.equal(s.data.players.length, 1);
  assert.equal(s.data.hittingEvents.length, 3);
  assert.equal(s.data.developmentGoals.length, 1);
  assert.equal(s.data.coachNotes.length, 1);
  assert.doesNotMatch(JSON.stringify(s), /PRIVATE|OTHER VISIBLE|110/);
  assert.equal(s.data.scheduleEvents.length, 1);
});
for (const field of ["playerId", "teamId", "seasonId"])
  test(`guessed ${field} fails before loading private event tables`, async () => {
    const f = playerServiceFixture();
    await assert.rejects(
      loadPlayerSession(f.db, uuid(1), { [field]: uuid(999) }),
      (e) => e.status === 403,
    );
    assert.ok(!f.calls.includes("hitting_events"));
  });
test("malformed context cannot be interpolated into PostgREST filters", async () => {
  const f = playerServiceFixture();
  await assert.rejects(
    loadPlayerSession(f.db, uuid(1), { playerId: "x),hitter_id.neq.null" }),
    (e) => e.status === 400,
  );
});
for (const status of ["PENDING", "REJECTED", "REVOKED"])
  test(`${status} link supplies no private data`, async () => {
    const f = playerServiceFixture();
    f.tables.profile_player_links[0].status = status;
    assert.equal((await loadPlayerSession(f.db, uuid(1))).data, undefined);
  });
test("future guardian association grants no PLAYER rights", async () => {
  const f = playerServiceFixture();
  f.tables.profile_player_links[0].relationship_type = "GUARDIAN";
  assert.equal((await loadPlayerSession(f.db, uuid(1))).contexts.length, 0);
});
test("deactivated membership removes active context", async () => {
  const f = playerServiceFixture();
  f.tables.player_team_memberships[0].active = false;
  assert.equal((await listPlayerContexts(f.db, uuid(1))).length, 0);
});
test("multi-team memberships keep exact player/team/season selection", async () => {
  const f = playerServiceFixture();
  f.tables.teams.push({
    ...f.tables.teams[0],
    id: uuid(21),
    name: "Metrolina JV",
  });
  f.tables.seasons.push({
    ...f.tables.seasons[0],
    id: uuid(31),
    team_id: uuid(21),
  });
  f.tables.player_team_memberships.push({
    ...f.tables.player_team_memberships[0],
    id: uuid(52),
    team_id: uuid(21),
    season_id: uuid(31),
  });
  const contexts = await listPlayerContexts(f.db, uuid(1));
  assert.equal(contexts.length, 2);
  assert.throws(
    () => selectPlayerContext(contexts, { playerId: f.own }),
    (e) => e.status === 403,
  );
  assert.equal(
    selectPlayerContext(contexts, {
      playerId: f.own,
      teamId: uuid(21),
      seasonId: uuid(31),
    }).membershipId,
    uuid(52),
  );
});
test("normal account receives no staff or unlimited AI entitlement", async () => {
  const f = playerServiceFixture();
  assert.equal(await hasStaffAccess(f.db, uuid(1)), false);
  const role = resolveAiUsageRole("PLAYER", "PLAYER");
  assert.equal(role, "player");
  assert.equal(
    resolveAskClubhouseAllowance({ role, entitlements: [] }).unlimitedRequests,
    false,
  );
});
test("safe session metadata excludes free-form private notes", () => {
  assert.deepEqual(
    safePlayerRow("session", {
      metadata: {
        defaultPitchType: "Slider",
        summary_note: "secret",
        coachNote: "secret",
      },
    }),
    { metadata: { defaultPitchType: "Slider" } },
  );
});
test("canonical Analytics calculates self Contact% from raw own events", async () => {
  const f = playerServiceFixture(),
    s = await loadPlayerSession(f.db, uuid(1));
  const r = executeAnalyticsQuery(s.data, {
    domain: "hitting",
    source: "practice",
    mode: "box-score",
    timeRange: "season",
    groupBy: "player",
    playerIds: [f.own],
  });
  assert.equal(r.rows.length, 1);
  assert.ok(Object.values(r.rows[0].cells).some((c) => c.display === "67%"));
});
test("Ask context rejects hidden nested player and team selectors", async () => {
  const f = playerServiceFixture(),
    s = await loadPlayerSession(f.db, uuid(1));
  for (const request of [
    { analytics: { playerIds: [f.other] } },
    { analytics: { context: { teamId: uuid(999) } } },
    { visualContext: { playerId: f.other, query: {} } },
    { teamScopes: [{ teamId: uuid(999) }] },
  ])
    assert.throws(
      () => playerAskContext(s.context, request),
      (e) => e.status === 403,
    );
});
for (const question of [
  "Who has the highest contact percentage?",
  "Show other players stats",
  "Show our team hitting stats",
  "Read private notes",
])
  test(`player team-data request refused: ${question}`, () =>
    assert.equal(isPrivateTeamQuestion(question), true));
test("baseball knowledge is not treated as a private team request", () => {
  for (const question of [
    "What is OPS?",
    "Who is Babe Ruth?",
    "How do I improve my swing?",
  ])
    assert.equal(isPrivateTeamQuestion(question), false);
});
test("revocation during a data read prevents returning the private payload", async () => {
  const f = playerServiceFixture();
  f.hooks.beforeRead = (table) => {
    if (table === "hitting_events")
      f.tables.profile_player_links[0].status = "REVOKED";
  };
  await assert.rejects(
    loadPlayerSession(f.db, uuid(1)),
    (e) => e.status === 403,
  );
});
test("own Game events preserve count and RISP occupancy without exposing other identities", async () => {
  const f = playerServiceFixture(),
    game = uuid(120),
    date = "2026-09-04T12:00:00Z";
  f.tables.games = [
    {
      id: game,
      team_id: f.team,
      season_id: f.season,
      game_date: "2026-09-04",
      opponent: "QA",
      created_at: date,
    },
  ];
  f.tables.game_pitch_events = [
    {
      id: uuid(121),
      game_id: game,
      batter_id: f.own,
      pitcher_id: f.other,
      inning: 1,
      half: "Bottom",
      pitch_type: "Slider",
      pitch_outcome: "Ball in play",
      ball_in_play_outcome: "Single",
      count_before: { balls: 0, strikes: 2 },
      runners_before: { second: f.other },
      created_at: date,
    },
    {
      id: uuid(122),
      game_id: game,
      batter_id: f.other,
      inning: 1,
      half: "Bottom",
      created_at: date,
    },
    { id: uuid(123), game_id: uuid(999), batter_id: f.own, created_at: date },
  ];
  const s = await loadPlayerSession(f.db, uuid(1));
  assert.equal(s.data.gameEvents.length, 1);
  const e = s.data.gameEvents[0];
  assert.equal(e.batterId, f.own);
  assert.equal(e.pitcherId, undefined);
  assert.deepEqual(e.countBefore, { balls: 0, strikes: 2 });
  assert.deepEqual(e.runnersBefore, { second: "occupied-second" });
  assert.doesNotMatch(JSON.stringify(s.data.gameEvents), new RegExp(f.other));
});
test("Weight Room returns only own sessions and sets within the approved team/season", async () => {
  const f = playerServiceFixture(),
    date = "2026-09-04";
  f.tables.workout_sessions = [
    {
      id: uuid(130),
      player_id: f.own,
      team_id: f.team,
      season_id: f.season,
      session_date: date,
      body_weight: 170,
    },
    {
      id: uuid(131),
      player_id: f.other,
      team_id: f.team,
      season_id: f.season,
      session_date: date,
      body_weight: 200,
    },
    {
      id: uuid(132),
      player_id: f.own,
      team_id: uuid(999),
      season_id: f.season,
      session_date: date,
      body_weight: 300,
    },
  ];
  f.tables.workout_sets = [
    {
      id: uuid(133),
      workout_session_id: uuid(130),
      player_id: f.own,
      exercise_id: uuid(134),
      weight: 135,
      reps: 5,
      notes: "PRIVATE SET NOTE",
    },
    {
      id: uuid(135),
      workout_session_id: uuid(130),
      player_id: f.other,
      weight: 500,
    },
  ];
  f.tables.exercises = [
    { id: uuid(134), name: "Squat", kind: "Strength", unit: "lb" },
  ];
  const s = await loadPlayerSession(f.db, uuid(1));
  assert.equal(s.data.workoutSessions.length, 1);
  assert.equal(s.data.workoutSessions[0].bodyWeight, 170);
  assert.equal(s.data.workoutEntries.length, 1);
  assert.equal(s.data.workoutEntries[0].exercise, "Squat");
  assert.equal(s.data.workoutEntries[0].weight, 135);
  assert.doesNotMatch(JSON.stringify(s.data.workoutEntries), /PRIVATE|500/);
});
for (const question of [
  "How have I been hitting lately?",
  "How am I hitting sliders?",
  "Show me my spray chart.",
  "What should I work on?",
  "How has my velocity changed?",
])
  test(`Ask works on self-scoped data: ${question}`, async () => {
    const f = playerServiceFixture(),
      s = await loadPlayerSession(f.db, uuid(1));
    const answer = await generateAskClubhouseReply({
      data: s.data,
      message: question,
      uiContext: playerAskContext(s.context, {
        analytics: { domain: "hitting", source: "practice" },
      }),
      config: getAskClubhouseConfig({}),
      now: new Date("2026-09-05"),
    });
    assert.notEqual(answer.status, "failed");
    assert.notEqual(answer.status, "refused");
    assert.doesNotMatch(JSON.stringify(answer), /PRIVATE|Other Seamon|110/);
    for (const tool of answer.toolResults)
      for (const row of tool.rows ?? []) assert.equal(row.playerId, f.own);
    if (question.includes("spray")) {
      assert.ok(answer.visuals?.some((v) => v.type === "spray_chart"));
      assert.equal(answer.visuals[0].playerId, f.own);
    }
  });

import assert from "node:assert/strict";
import test from "node:test";
import { getAskClubhouseConfig } from "../app/lib/askClubhouse/config.ts";
import { generateAskClubhouseReply } from "../app/lib/askClubhouse/engine.ts";
import { OpenAIProvider } from "../app/lib/askClubhouse/provider.ts";
import { buildAskClubhouseToolPlan, classifyAskClubhouseIntent, runAskClubhouseTools } from "../app/lib/askClubhouse/tools.ts";
import { createAiRequestHash, enforceAiUsageLimits } from "../app/lib/askClubhouse/usage.ts";

const now = "2026-08-20T12:00:00.000Z";
const players = [
  player("p-jacob", "Jacob Seamon", 1, "CF"),
  player("p-jake", "Jake Seamon", 11, "SS"),
  player("p-mylo", "Mylo White", 2, "LHP", { throws: "L", isPitcher: true }),
  player("p-jackson", "Jackson Pierce", 4, "OF"),
];

const data = {
  teamContext: {
    currentTeam: {
      organizationId: "org-1",
      organizationName: "Metrolina Christian Academy",
      teamId: "team-1",
      teamName: "Metrolina Varsity",
      seasonId: "season-1",
      seasonName: "Fall 2026",
      role: "ADMIN",
      active: true,
    },
    availableTeams: [],
  },
  players,
  playerTeamMemberships: players.map((item) => ({
    id: `membership-${item.id}`,
    playerId: item.id,
    teamId: "team-1",
    seasonId: "season-1",
    rosterStatus: "Varsity",
    active: true,
  })),
  practices: [practice("practice-1", "2026-08-19")],
  attendance: [],
  practiceSessionContributors: [],
  pitchingSessions: [pitchingSession("pitching-1", "practice-1", "p-mylo", "Bullpen")],
  pitchEvents: [
    pitchEvent("pe-1", "practice-1", "pitching-1", "p-mylo", "Called Strike", { velocity: 82, isZone: true }),
    pitchEvent("pe-2", "practice-1", "pitching-1", "p-mylo", "Whiff", { velocity: 84, isZone: true }),
    pitchEvent("pe-3", "practice-1", "pitching-1", "p-mylo", "Ball", { isStrike: false, isZone: false, velocity: 81 }),
  ],
  hittingSessions: [hittingSession("hit-1", "practice-1", "p-jacob", "Machine")],
  hittingEvents: [
    hittingEvent("he-1", "practice-1", "hit-1", "p-jacob", "Miss"),
    hittingEvent("he-2", "practice-1", "hit-1", "p-jacob", "Foul"),
    hittingEvent("he-3", "practice-1", "hit-1", "p-jacob", "Ball in play", { contactResult: "Line drive", contactQuality: "Hard", exitVelocityMph: 90 }),
    hittingEvent("he-4", "practice-1", "hit-1", "p-jacob", "Ball in play", { contactResult: "Ground ball", contactQuality: "Solid", exitVelocityMph: 86 }),
    hittingEvent("he-5", "practice-1", "hit-1", "p-mylo", "Ball in play", { contactResult: "Line drive", contactQuality: "Hard", exitVelocityMph: 88 }),
  ],
  defenseSessions: [defenseSession("def-1", "practice-1", "p-jackson", "Infield")],
  defenseEvents: [
    defenseEvent("de-1", "practice-1", "def-1", "p-jackson", "Clean"),
    defenseEvent("de-2", "practice-1", "def-1", "p-jackson", "Error"),
  ],
  workoutSessions: [
    {
      id: "workout-session-1",
      playerId: "p-jacob",
      date: "2026-08-19",
      weekOf: "2026-08-17",
      day: "Wed",
      completed: true,
      effortScore: 8,
      createdAt: now,
      updatedAt: now,
    },
  ],
  workoutEntries: [
    {
      id: "workout-entry-1",
      sessionId: "workout-session-1",
      playerId: "p-jacob",
      exercise: "Back Squat",
      kind: "Lift",
      setNumber: 1,
      weight: 225,
      reps: 5,
      status: "Completed",
      createdAt: now,
    },
  ],
  scheduleEvents: [],
  games: [
    {
      id: "game-1",
      date: "2026-08-18",
      opponent: "Charlotte Christian",
      homeAway: "Home",
      location: "Indian Trail, NC",
      type: "Scrimmage",
      metrolinaScore: 3,
      opponentScore: 1,
      inning: 7,
      half: "Bottom",
      outs: 0,
      balls: 0,
      strikes: 0,
      runners: {},
      lineup: ["p-jacob"],
      positions: {},
      createdAt: now,
      updatedAt: now,
    },
  ],
  gameEvents: [
    gameEvent("ge-1", "game-1", "p-jacob", "p-mylo", "In Play", "Single"),
    gameEvent("ge-2", "game-1", "p-jacob", "p-mylo", "In Play", "Double"),
  ],
  plateAppearances: [],
  coachNotes: [],
  developmentGoals: [],
  settings: {
    theme: "dark",
    rosterSeason: "Fall 2026",
    recentPlayerIds: [],
    selectedTeamId: "team-1",
    selectedSeasonId: "season-1",
  },
};

test("Ask Clubhouse config applies beta cost defaults", () => {
  const config = getAskClubhouseConfig({});

  assert.equal(config.dailyUserRequestLimit, 50);
  assert.equal(config.dailyTeamRequestLimit, 300);
  assert.equal(config.maxToolCallsPerRequest, 6);
  assert.equal(config.maxWebSearchesPerRequest, 1);
  assert.equal(config.maxInputCharacters, 4000);
  assert.equal(config.maxOutputTokens, 700);
  assert.equal(config.hasProviderKey, false);
});

test("Ask Clubhouse refuses unrelated questions before tools", () => {
  const config = getAskClubhouseConfig({});
  const plan = buildAskClubhouseToolPlan(data, "Write my English essay about politics", undefined, config);

  assert.equal(plan.status, "refused");
  assert.equal(plan.toolRequests.length, 0);
  assert.match(plan.answer, /Clubhouse 9 team data/);
});

test("Ask Clubhouse answers baseball definitions without model tools", () => {
  const config = getAskClubhouseConfig({});
  const plan = buildAskClubhouseToolPlan(data, "What is OPS?", undefined, config);

  assert.equal(plan.status, "completed");
  assert.equal(plan.toolRequests.length, 0);
  assert.match(plan.answer, /on-base percentage plus slugging/);
});

test("Ask Clubhouse routes each question by intent and bounds web use", () => {
  const internal = classifyAskClubhouseIntent("Who has the highest Practice Contact %?", players);
  const currentRule = classifyAskClubhouseIntent("What is the NFHS balk rule?", players);
  const mixed = classifyAskClubhouseIntent("Mylo topped out at 84 mph. Is that good for his age?", players);
  const general = classifyAskClubhouseIntent("When should a team bunt?", players);
  const refusal = classifyAskClubhouseIntent("Write me a history essay", players);

  assert.deepEqual([internal.route, internal.requiresWebSearch], ["clubhouse_data", false]);
  assert.deepEqual([currentRule.route, currentRule.requiresWebSearch], ["baseball_knowledge", true]);
  assert.deepEqual([mixed.route, mixed.requiresWebSearch], ["mixed", true]);
  assert.deepEqual([general.route, general.requiresWebSearch], ["baseball_knowledge", false]);
  assert.deepEqual([refusal.route, refusal.requiresWebSearch], ["refuse", false]);
});

test("Ask Clubhouse distinguishes team strategy from team analytics", () => {
  const strategy = classifyAskClubhouseIntent("When should my team bunt?", players);
  const analytics = classifyAskClubhouseIntent("How is my team?", players);

  assert.deepEqual([strategy.route, strategy.requiresWebSearch], ["baseball_knowledge", false]);
  assert.deepEqual([analytics.route, analytics.requiresWebSearch], ["clubhouse_data", false]);
});

test("Ask Clubhouse keeps general baseball questions out of private team routing", () => {
  const classification = classifyAskClubhouseIntent("Who won the World Series this year?", players);

  assert.equal(classification.route, "baseball_knowledge");
  assert.equal(classification.requiresWebSearch, true);
});

test("Ask Clubhouse builds bounded hitting leaderboard tools", () => {
  const config = { ...getAskClubhouseConfig({}), toolResultLimit: 3 };
  const plan = buildAskClubhouseToolPlan(data, "Who has the highest practice contact rate?", undefined, config);
  const results = runAskClubhouseTools(data, plan.toolRequests, config);

  assert.equal(plan.status, "data");
  assert.equal(plan.toolRequests[0].name, "getHittingLeaderboard");
  assert.equal(results[0].rows[0].playerName, "Mylo White");
  assert.equal(results[0].rows.length <= 3, true);
  assert.equal(results[0].rows[0].metrics.some((metric) => metric.metricId === "contactPct"), true);
});

test("Ask Clubhouse adds data coverage for pitch-type questions", () => {
  const config = getAskClubhouseConfig({});
  const plan = buildAskClubhouseToolPlan(data, "Who has the best contact rate against sliders?", undefined, config);
  const results = runAskClubhouseTools(data, plan.toolRequests, config);

  assert.equal(plan.route, "clubhouse_data");
  assert.equal(plan.toolRequests.some((request) => request.name === "getDataCoverage"), true);
  assert.equal(results.some((result) => result.name === "getDataCoverage"), true);
});

test("Ask Clubhouse compares practice and games with separate bounded tools", () => {
  const config = getAskClubhouseConfig({});
  const plan = buildAskClubhouseToolPlan(data, "Compare practice and games for hitting", undefined, config);

  assert.equal(plan.status, "data");
  assert.deepEqual(plan.toolRequests.map((request) => request.query.source), ["practice", "games"]);
  assert.equal(plan.toolRequests.length <= config.maxToolCallsPerRequest, true);
});

test("Ask Clubhouse spots ambiguous player names", () => {
  const config = getAskClubhouseConfig({});
  const plan = buildAskClubhouseToolPlan(data, "Show Seamon analytics", undefined, config);

  assert.equal(plan.status, "needs_clarification");
  assert.match(plan.answer, /Jacob Seamon/);
  assert.match(plan.answer, /Jake Seamon/);
});

test("Ask Clubhouse engine uses mocked provider and tracks usage shape", async () => {
  const config = getAskClubhouseConfig({ OPENAI_API_KEY: "test-key" });
  const provider = {
    model: config.model,
    async generate(input) {
      assert.match(input.prompt, /boundedToolResults/);
      return {
        text: "Jacob Seamon is the best answer from the current sample.",
        usage: {
          inputTokens: 120,
          outputTokens: 24,
          totalTokens: 144,
          model: config.model,
        },
      };
    },
  };

  const response = await generateAskClubhouseReply({
    data,
    message: "Who has the highest practice Contact %?",
    config,
    provider,
  });

  assert.equal(response.status, "low_sample");
  assert.equal(response.usage.totalTokens, 144);
  assert.equal(response.usage.toolCallCount, 1);
  assert.equal(response.webSearchCount, 0);
});

test("OpenAI provider bounds web search and extracts compact sources", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody;
  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({
      model: "gpt-test",
      output_text: "NFHS balk guidance.",
      usage: { input_tokens: 30, output_tokens: 8, total_tokens: 38 },
      output: [{
        type: "web_search_call",
        action: { sources: [{ title: "NFHS Baseball", url: "https://www.nfhs.org/activities-sports/baseball" }] },
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const provider = new OpenAIProvider({ apiKey: "test-key", model: "gpt-test" });
    const result = await provider.generate({
      system: "Baseball only.",
      prompt: "What is the current NFHS balk rule?",
      maxOutputTokens: 300,
      webSearch: { enabled: true, maxSearches: 1 },
    });

    assert.deepEqual(requestBody.tools, [{ type: "web_search" }]);
    assert.equal(requestBody.tool_choice, "required");
    assert.equal(requestBody.max_tool_calls, 1);
    assert.deepEqual(requestBody.include, ["web_search_call.action.sources"]);
    assert.equal(result.webSearchCount, 1);
    assert.deepEqual(result.sources, [{
      title: "NFHS Baseball",
      summary: "External baseball context",
      url: "https://www.nfhs.org/activities-sports/baseball",
    }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Ask Clubhouse does not invent current guidance when web verification fails", async () => {
  const config = getAskClubhouseConfig({ OPENAI_API_KEY: "test-key" });
  const provider = {
    model: config.model,
    async generate() {
      throw new Error("network unavailable");
    },
  };

  const response = await generateAskClubhouseReply({
    data,
    message: "What is the current NFHS balk rule?",
    config,
    provider,
  });

  assert.equal(response.status, "failed");
  assert.match(response.answer, /couldn't verify the current baseball guidance/i);
  assert.equal(response.webSearchCount, 0);
});

test("Ask Clubhouse returns unavailable when model is missing for data questions", async () => {
  const config = getAskClubhouseConfig({});
  const response = await generateAskClubhouseReply({
    data,
    message: "Who has the highest Avg EV?",
    config,
  });

  assert.equal(response.status, "unavailable");
  assert.match(response.answer, /not configured/);
  assert.equal(response.usage.toolCallCount, 1);
});

test("AI request hash normalizes duplicate whitespace and case", () => {
  const first = createAiRequestHash({ profileId: "profile-1", teamId: "team-1", message: " Who leads Contact %? " });
  const second = createAiRequestHash({ profileId: "profile-1", teamId: "team-1", message: "who   leads contact %?" });

  assert.equal(first, second);
});

test("AI usage limits stop duplicates and daily overages before provider work", async () => {
  const config = getAskClubhouseConfig({ AI_DAILY_USER_REQUEST_LIMIT: "2", AI_DAILY_TEAM_REQUEST_LIMIT: "8" });

  const duplicate = await enforceAiUsageLimits(mockUsageSupabase({ duplicate: true }), {
    profileId: "profile-1",
    teamId: "team-1",
    requestHash: "same-question",
    config,
    now: new Date(now),
  });
  assert.equal(duplicate.allowed, false);
  assert.equal(duplicate.code, "AI_DUPLICATE_COOLDOWN");

  const overDailyLimit = await enforceAiUsageLimits(mockUsageSupabase({ userCount: 2 }), {
    profileId: "profile-1",
    teamId: "team-1",
    requestHash: "new-question",
    config,
    now: new Date(now),
  });
  assert.equal(overDailyLimit.allowed, false);
  assert.equal(overDailyLimit.code, "AI_DAILY_USER_LIMIT");
});

function player(id, name, jerseyNumber, primaryPosition, overrides = {}) {
  return {
    id,
    name,
    jerseyNumber,
    primaryPosition,
    bats: "R",
    throws: "R",
    graduationYear: 2027,
    rosterStatus: "Varsity",
    avatarColor: "neutral",
    isPitcher: false,
    isHitter: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function practice(id, date) {
  return {
    id,
    date,
    name: `${date} Varsity Practice`,
    type: "Team Practice",
    location: "Indian Trail, NC",
    playerIds: players.map((item) => item.id),
    pitcherIds: ["p-mylo"],
    hitterIds: players.map((item) => item.id),
    startedAt: `${date}T22:00:00.000Z`,
    createdAt: now,
    updatedAt: now,
  };
}

function hittingSession(id, practiceId, hitterId, type) {
  return {
    id,
    practiceId,
    hitterId,
    type,
    roundGoals: [],
    startedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

function pitchingSession(id, practiceId, pitcherId, type) {
  return {
    id,
    practiceId,
    pitcherId,
    type,
    focusTags: [],
    startedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

function defenseSession(id, practiceId, playerId, station) {
  return {
    id,
    practiceId,
    playerId,
    station,
    mode: "Quick Practice",
    startedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

function pitchEvent(id, practiceId, sessionId, pitcherId, outcome, overrides = {}) {
  const isStrike = overrides.isStrike ?? outcome !== "Ball";
  return {
    id,
    practiceId,
    sessionId,
    pitcherId,
    pitchNumber: Number(id.replace(/\D/g, "")) || 1,
    pitchType: "4-Seam",
    outcome,
    isStrike,
    isSwing: outcome === "Whiff" || outcome === "Swing" || outcome === "Foul" || outcome === "Ball in play",
    isZone: overrides.isZone ?? isStrike,
    isWhiff: outcome === "Whiff",
    isCalledStrike: outcome === "Called Strike",
    velocity: overrides.velocity,
    createdAt: now,
    ...overrides,
  };
}

function hittingEvent(id, practiceId, sessionId, hitterId, action, overrides = {}) {
  return {
    id,
    practiceId,
    sessionId,
    hitterId,
    eventNumber: Number(id.replace(/\D/g, "")) || 1,
    action,
    createdAt: now,
    ...overrides,
  };
}

function defenseEvent(id, practiceId, sessionId, playerId, outcome) {
  return {
    id,
    practiceId,
    sessionId,
    playerId,
    station: "Infield",
    eventNumber: Number(id.replace(/\D/g, "")) || 1,
    outcome,
    result: outcome,
    createdAt: now,
  };
}

function gameEvent(id, gameId, batterId, pitcherId, pitchOutcome, ballInPlayOutcome) {
  return {
    id,
    gameId,
    inning: 1,
    half: "Top",
    pitcherId,
    batterId,
    pitchType: "4-Seam",
    pitchOutcome,
    ballInPlayOutcome,
    outsBefore: 0,
    outsAfter: 0,
    metrolinaRunsBefore: 0,
    metrolinaRunsAfter: 0,
    opponentRunsBefore: 0,
    opponentRunsAfter: 0,
    situations: [],
    createdAt: now,
  };
}

function mockUsageSupabase({ duplicate = false, userCount = 0, teamCount = 0 } = {}) {
  return {
    from(table) {
      assert.equal(table, "ai_usage_events");
      const state = { filters: {} };
      const builder = {
        select() {
          return this;
        },
        eq(column, value) {
          state.filters[column] = value;
          return this;
        },
        gte(column, value) {
          state.filters[column] = value;
          return this;
        },
        limit() {
          return this;
        },
        maybeSingle() {
          return Promise.resolve({
            data: duplicate ? { id: "usage-1", status: "started", created_at: now } : null,
            error: null,
          });
        },
        then(resolve, reject) {
          const count = state.filters.profile_id ? userCount : teamCount;
          return Promise.resolve({ count, error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
}

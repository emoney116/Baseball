import assert from "node:assert/strict";
import test from "node:test";
import { getAskClubhouseConfig, resolveAiUsageRole } from "../app/lib/askClubhouse/config.ts";
import { canUseExternalResearch, hasEntitlement, resolveAskClubhouseAllowance, SUPER_USER_ENTITLEMENT } from "../app/lib/askClubhouse/entitlements.ts";
import { generateAskClubhouseReply } from "../app/lib/askClubhouse/engine.ts";
import { executeAnalyticsQuery } from "../app/lib/analyticsQuery.ts";
import { calculateAIRequestCost } from "../app/lib/askClubhouse/pricing.ts";
import { OpenAIProvider } from "../app/lib/askClubhouse/provider.ts";
import { buildAskClubhouseToolPlan, classifyAskClubhouseIntent, runAskClubhouseTools } from "../app/lib/askClubhouse/tools.ts";
import { buildAskClubhouseVisuals, isAskClubhouseVisual } from "../app/lib/askClubhouse/visuals.ts";
import { countsTowardRequestQuota, createAiRequestHash, enforceAiUsageLimits, evaluateAiUsageLimits, finishAiUsageEvent, summarizeAiUsageWindows } from "../app/lib/askClubhouse/usage.ts";
import { findTrustedKnowledge, InMemoryBaseballKnowledgeProvider } from "../app/lib/askClubhouse/knowledge.ts";
import { composeAskClubhouseQueryPlan, sampleState } from "../app/lib/askClubhouse/queryPlan.ts";
import { diagnosePlayerDevelopment } from "../app/lib/askClubhouse/diagnosis.ts";
import { CLUBHOUSE_DIMENSION_SUPPORT } from "../app/lib/askClubhouse/support.ts";
import { BASEBALL_KNOWLEDGE_QA } from "./fixtures/baseball-knowledge-qa.mjs";
import { ASK_CLUBHOUSE_INTELLIGENCE_QA } from "./fixtures/ask-clubhouse-intelligence-qa.mjs";
import { canonicalizeAppDataPlayerIdentities } from "../app/lib/playerIdentity.ts";

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
  assert.equal(config.dailyRoleRequestLimits.coach, 30);
  assert.equal(config.dailyRoleRequestLimits.player, 10);
  assert.equal(config.dailyTeamRequestLimit, 150);
  assert.equal(config.monthlyTeamRequestLimit, 3000);
  assert.equal(config.monthlyTeamCostLimitUsd, 25);
  assert.equal(config.monthlyGlobalCostLimitUsd, 100);
  assert.equal(config.dailyRoleWebSearchLimits.coach, 10);
  assert.equal(config.dailyTeamWebSearchLimit, 30);
  assert.equal(config.webSearchEnabled, false);
  assert.equal(config.defaultTimezone, "America/New_York");
  assert.equal(config.internalTestingEnabled, false);
  assert.equal(config.adminTestingRequestLimit, 100);
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

test("standard Ask Clubhouse prompts map to bounded data plans", () => {
  const config = getAskClubhouseConfig({});
  const prompts = [
    ["Who has the highest Practice Contact %?", "getHittingLeaderboard"],
    ["What changed in our hitting this month?", "compareAnalyticsPeriods"],
    ["Who leads Weight Room Development?", "getWeightRoomLeaderboard"],
    ["Show our latest Practice summary", "getPracticeSummary"],
    ["Which pitchers have the best Practice Strike %?", "getPitchingLeaderboard"],
    ["Who has the most extra-base hits in Games?", "getHittingLeaderboard"],
  ];

  for (const [question, toolName] of prompts) {
    const plan = buildAskClubhouseToolPlan(data, question, undefined, config);
    assert.equal(plan.status, "data", question);
    assert.ok(plan.toolRequests.length, question);
    assert.equal(plan.toolRequests[0].name, toolName, question);
  }
});

test("intelligence QA fixture contains 100+ categorized deterministic cases", () => {
  assert.ok(ASK_CLUBHOUSE_INTELLIGENCE_QA.length >= 100);
  const categories = new Set(ASK_CLUBHOUSE_INTELLIGENCE_QA.map((item) => item.category));
  for (const category of ["basic", "filtered", "situational", "comparison", "ranking", "trend", "low_sample", "unsupported", "ambiguous", "follow_up", "development", "knowledge", "mixed", "security"]) {
    assert.ok(categories.has(category), `missing QA category: ${category}`);
  }
  assert.equal(new Set(ASK_CLUBHOUSE_INTELLIGENCE_QA.map((item) => item.id)).size, ASK_CLUBHOUSE_INTELLIGENCE_QA.length);
});

test("composed query plans preserve metric, source, and filters", () => {
  const plan = composeAskClubhouseQueryPlan("What is my batting average pulling fastballs over 85 mph in Games?");
  assert.deepEqual({ domain: plan.domain, metric: plan.metric, source: plan.scope.source }, { domain: "hitting", metric: "avg", source: "games" });
  assert.deepEqual(plan.filters.pitchTypes, ["4-Seam"]);
  assert.equal(plan.filters.pitchVelocityMin, 85);
  assert.deepEqual(plan.filters.directions, ["Pull", "Pull-center"]);
  assert.ok(plan.unsupportedFilters.includes("game spray direction"));

  const locationPlan = composeAskClubhouseQueryPlan("What is my Contact % on sliders down and away during Practice?");
  assert.deepEqual(locationPlan.filters, { pitchTypes: ["Slider"], pitchLocationRegions: ["down_and_away"] });
  assert.equal(locationPlan.minimumSample, 12);
});

test("dimension support matrix identifies partial and unavailable fields", () => {
  const byDimension = new Map(CLUBHOUSE_DIMENSION_SUPPORT.map((item) => [item.dimension, item]));
  assert.equal(byDimension.get("pitch type").status, "partial");
  assert.equal(byDimension.get("pitch velocity").status, "partial");
  assert.equal(byDimension.get("count").status, "partial");
  assert.equal(byDimension.get("medical diagnosis").status, "not_tracked");
  assert.equal(byDimension.get("defensive rep type").status, "supported");
});

test("minimum sample states keep tiny results from becoming strong rankings", () => {
  assert.equal(sampleState(0, 12), "insufficient");
  assert.equal(sampleState(5, 12), "insufficient");
  assert.equal(sampleState(15, 12), "limited");
  assert.equal(sampleState(24, 12), "qualified");
});

test("analytics execution composes velocity, location, and spray filters", () => {
  const events = [
    hittingEvent("composed-1", "practice-1", "hit-1", "p-jacob", "Ball in play", { pitchType: "Slider", velocity: 82, pitchLocation: { x: 0.8, y: 0.8 }, direction: "Pull", contactResult: "Ground ball", contactQuality: "Hard" }),
    hittingEvent("composed-2", "practice-1", "hit-1", "p-jacob", "Ball in play", { pitchType: "Slider", velocity: 78, pitchLocation: { x: 0.5, y: 0.5 }, direction: "Opposite", contactResult: "Line drive", contactQuality: "Hard" }),
  ];
  const result = executeAnalyticsQuery({ ...data, hittingEvents: events }, {
    domain: "hitting",
    source: "practice",
    mode: "situational",
    timeRange: "season",
    groupBy: "player",
    filters: { pitchTypes: ["Slider"], pitchVelocityMin: 80, pitchLocationRegions: ["down_and_away"], directions: ["Pull"] },
    metrics: ["contactPct"],
    sort: { metricId: "contactPct", direction: "desc" },
    limit: 8,
  });
  const jacob = result.rows.find((row) => row.player.id === "p-jacob");
  assert.equal(jacob.sampleCount, 1);
  assert.equal(jacob.cells.contactPct.value, 100);
});

test("trend plans create two bounded Clubhouse periods", () => {
  const plan = buildAskClubhouseToolPlan(data, "What changed in Jacob's hitting this month?", undefined, getAskClubhouseConfig({}));
  assert.equal(plan.status, "data");
  assert.equal(plan.queryPlan.comparison.dimension, "period");
  assert.equal(plan.toolRequests.length, 2);
  assert.deepEqual(plan.toolRequests.map((request) => request.name), ["compareAnalyticsPeriods", "compareAnalyticsPeriods"]);
  assert.ok(plan.toolRequests.every((request) => request.query.timeRange === "custom"));
});

test("development diagnosis distinguishes slider chase from weak contact", () => {
  const knowledgeProvider = new InMemoryBaseballKnowledgeProvider([{
    id: "slider-recognition",
    title: "Breaking-ball recognition",
    content: "Recognize spin early and take breaking balls below the zone.",
    category: "Hitting",
    status: "reviewed",
  }]);
  const chaseEvents = Array.from({ length: 24 }, (_, index) => hittingEvent(`slider-chase-${index}`, "practice-1", "hit-1", "p-jacob", index < 16 ? "Ball in play" : "Miss", {
    pitchType: "Slider",
    pitchLocation: index < 16 ? { x: 0.5, y: 0.5 } : { x: 0.5, y: 0.9 },
    contactResult: index < 16 ? "Line drive" : undefined,
    contactQuality: index < 16 ? "Hard" : undefined,
  }));
  const chaseDiagnosis = diagnosePlayerDevelopment({ ...data, hittingEvents: chaseEvents }, { domain: "hitting", playerId: "p-jacob", source: "practice", pitchType: "Slider" }, knowledgeProvider);
  assert.equal(chaseDiagnosis.signal, "recognition_decision");
  assert.equal(chaseDiagnosis.confidence, "high");
  assert.match(chaseDiagnosis.focus, /Recognition/);
  assert.equal(chaseDiagnosis.knowledgeItems[0].id, "slider-recognition");

  const weakEvents = Array.from({ length: 16 }, (_, index) => hittingEvent(`slider-weak-${index}`, "practice-1", "hit-1", "p-jacob", "Ball in play", {
    pitchType: "Slider",
    pitchLocation: { x: 0.5, y: 0.5 },
    contactResult: "Ground ball",
    contactQuality: "Weak",
    direction: "Pull",
  }));
  const weakDiagnosis = diagnosePlayerDevelopment({ ...data, hittingEvents: weakEvents }, { domain: "hitting", playerId: "p-jacob", source: "practice", pitchType: "Slider" }, knowledgeProvider);
  assert.equal(weakDiagnosis.signal, "contact_quality");
  assert.match(weakDiagnosis.focus, /Contact quality/);
});

test("development diagnosis refuses strong conclusions on small samples", () => {
  const events = Array.from({ length: 5 }, (_, index) => hittingEvent(`slider-small-${index}`, "practice-1", "hit-1", "p-jacob", "Miss", { pitchType: "Slider" }));
  const result = diagnosePlayerDevelopment({ ...data, hittingEvents: events }, { domain: "hitting", playerId: "p-jacob", source: "practice", pitchType: "Slider" });
  assert.equal(result.status, "insufficient");
  assert.equal(result.confidence, "low");
  assert.match(result.whatISee, /would not call this a real weakness/);
});

test("development diagnosis supports pitching command signals", () => {
  const events = Array.from({ length: 18 }, (_, index) => pitchEvent(`slider-command-${index}`, "practice-1", "pitching-1", "p-mylo", index < 10 ? "Ball" : "Called Strike", {
    pitchType: "Slider",
    isStrike: index >= 10,
    isZone: index >= 10,
    velocity: 75 + (index % 3),
  }));
  const result = diagnosePlayerDevelopment({ ...data, pitchEvents: events }, { domain: "pitching", playerId: "p-mylo", source: "practice", pitchType: "Slider" });
  assert.equal(result.signal, "strike_command");
  assert.equal(result.status, "limited");
  assert.match(result.whatISee, /strike command/);
});

test("Ask Clubhouse returns a structured data-first development diagnosis", () => {
  const events = Array.from({ length: 12 }, (_, index) => hittingEvent(`slider-plan-${index}`, "practice-1", "hit-1", "p-jacob", index % 3 === 0 ? "Miss" : "Ball in play", {
    pitchType: "Slider",
    pitchLocation: { x: 0.5, y: index % 3 === 0 ? 0.9 : 0.5 },
    contactResult: index % 3 === 0 ? undefined : "Line drive",
    contactQuality: index % 3 === 0 ? undefined : "Hard",
  }));
  const plan = buildAskClubhouseToolPlan({ ...data, hittingEvents: events }, "How can Jacob hit sliders better?", undefined, getAskClubhouseConfig({}));
  assert.equal(plan.status, "completed");
  assert.equal(plan.diagnosis.signal, "recognition_decision");
  assert.match(plan.answer, /WHAT I SEE/);
  assert.match(plan.answer, /WATCH NEXT/);
  assert.equal(plan.toolRequests.length, 0);

  const conversationalPlan = buildAskClubhouseToolPlan({ ...data, hittingEvents: events }, "What can Jacob do to hit sliders better?", undefined, getAskClubhouseConfig({}));
  assert.equal(conversationalPlan.status, "completed");
  assert.equal(conversationalPlan.diagnosis?.playerId, "p-jacob");
});

test("Ask Clubhouse routes each question by intent and bounds web use", () => {
  const internal = classifyAskClubhouseIntent("Who has the highest Practice Contact %?", players);
  const currentRule = classifyAskClubhouseIntent("What is the NFHS balk rule?", players);
  const mixed = classifyAskClubhouseIntent("Mylo topped out at 84 mph. Is that good for his age?", players);
  const general = classifyAskClubhouseIntent("When should a team bunt?", players);
  const development = classifyAskClubhouseIntent("How can I hit sliders better?", players);
  const refusal = classifyAskClubhouseIntent("Write me a history essay", players);

  assert.deepEqual([internal.route, internal.requiresWebSearch], ["clubhouse_data", false]);
  assert.deepEqual([currentRule.route, currentRule.requiresWebSearch], ["external_research_required", false]);
  assert.deepEqual([mixed.route, mixed.requiresWebSearch], ["mixed", false]);
  assert.deepEqual([general.route, general.requiresWebSearch], ["baseball_knowledge", false]);
  assert.deepEqual([development.route, development.requiresWebSearch], ["clubhouse_data", false]);
  assert.deepEqual([refusal.route, refusal.requiresWebSearch], ["out_of_scope", false]);
});

test("generic development questions ask for tracked-player context before advice", () => {
  const plan = buildAskClubhouseToolPlan(data, "How can I hit sliders better?", undefined, getAskClubhouseConfig({}));

  assert.equal(plan.route, "clubhouse_data");
  assert.equal(plan.status, "needs_clarification");
  assert.match(plan.answer, /specific player's tracked data/i);
});

test("Ask Clubhouse distinguishes team strategy from team analytics", () => {
  const strategy = classifyAskClubhouseIntent("When should my team bunt?", players);
  const analytics = classifyAskClubhouseIntent("How is my team?", players);

  assert.deepEqual([strategy.route, strategy.requiresWebSearch], ["baseball_knowledge", false]);
  assert.deepEqual([analytics.route, analytics.requiresWebSearch], ["clubhouse_data", false]);
});

test("Ask Clubhouse keeps general baseball questions out of private team routing", () => {
  const classification = classifyAskClubhouseIntent("Who won the World Series this year?", players);

  assert.equal(classification.route, "external_research_required");
  assert.equal(classification.route, "external_research_required");
  assert.equal(classification.requiresWebSearch, false);
  assert.equal(classification.knowledgeStatus, "knowledge_miss");
});

test("Ask Clubhouse beta keeps external research disabled while retaining entitlement architecture", () => {
  const disabled = getAskClubhouseConfig({});
  const enabled = getAskClubhouseConfig({ AI_WEB_SEARCH_ENABLED: "true" });

  assert.equal(canUseExternalResearch({ role: "coach", teamId: "team-1" }, disabled), false);
  assert.equal(canUseExternalResearch({ role: "coach", teamId: "team-1" }, enabled), true);
  assert.equal(classifyAskClubhouseIntent("What is the 2026 NFHS balk rule?", players, [], { webSearchEnabled: false }).route, "external_research_required");
  assert.equal(classifyAskClubhouseIntent("What is the 2026 NFHS balk rule?", players, [], { webSearchEnabled: true }).requiresWebSearch, true);
});

test("Ask Clubhouse uses trusted knowledge before external research", () => {
  const item = {
    id: "nfhs-balk-2026",
    title: "2026 NFHS Balk Rule",
    content: "Verified NFHS balk guidance for the 2026 season.",
    category: "rules",
    level: "high_school",
    governingBody: "NFHS",
    version: "2026",
    source: "NFHS rulebook",
    verifiedAt: "2026-08-01",
    status: "verified",
  };
  const knowledgeProvider = {
    searchKnowledge(query) {
      assert.equal(query.governingBody, "NFHS");
      assert.equal(query.version, "2026");
      return [item];
    },
    getKnowledgeItem(id) {
      return id === item.id ? item : undefined;
    },
  };
  const classification = classifyAskClubhouseIntent("What is the 2026 NFHS balk rule?", players, [], {
    webSearchEnabled: false,
    knowledgeProvider,
  });
  const plan = buildAskClubhouseToolPlan(data, "What is the 2026 NFHS balk rule?", undefined, getAskClubhouseConfig({}), [], knowledgeProvider);

  assert.equal(classification.route, "baseball_knowledge");
  assert.equal(classification.knowledgeStatus, "trusted_match");
  assert.equal(plan.status, "completed");
  assert.match(plan.answer, /Verified NFHS/);
});

test("Baseball Knowledge Bank retrieval respects trusted status and scope filters", () => {
  const provider = new InMemoryBaseballKnowledgeProvider([
    {
      id: "general-balk",
      documentId: "doc-general-balk",
      title: "Balk",
      content: "A balk is an illegal pitching action with runners on base.",
      category: "Rules",
      level: "General",
      status: "reviewed",
    },
    {
      id: "nfhs-balk-2026",
      documentId: "doc-nfhs-balk",
      title: "NFHS 2026 Balk Basics",
      content: "NFHS 2026 balk context is governed by the high school rules code.",
      category: "Rules",
      level: "High School",
      governingBody: "NFHS",
      version: "2026",
      status: "verified",
    },
    {
      id: "mlb-balk-2026",
      documentId: "doc-mlb-balk",
      title: "MLB Balk Basics",
      content: "MLB balk context is governed by the professional rules code.",
      category: "Rules",
      level: "Professional",
      governingBody: "MLB",
      version: "2026",
      status: "verified",
    },
    {
      id: "draft-balk",
      title: "Draft Balk Note",
      content: "This draft must not be trusted.",
      category: "Rules",
      status: "draft",
    },
  ]);

  const general = findTrustedKnowledge(provider, { query: "What is a balk?", category: "Rules", limit: 3 });
  const nfhs = findTrustedKnowledge(provider, {
    query: "What is the 2026 NFHS balk rule?",
    category: "Rules",
    level: "High School",
    governingBody: "NFHS",
    version: "2026",
    limit: 3,
  });

  assert.equal(general[0].title, "Balk");
  assert.equal(nfhs.length, 1);
  assert.equal(nfhs[0].title, "NFHS 2026 Balk Basics");
  assert.equal(nfhs[0].id, "nfhs-balk-2026");
  assert.equal(findTrustedKnowledge(provider, { query: "draft balk", category: "Rules", limit: 3 }).some((item) => item.status === "draft"), false);
});

test("Baseball Knowledge Bank preserves source evidence in a stable answer", async () => {
  const knowledgeProvider = new InMemoryBaseballKnowledgeProvider([{
    id: "ops-chunk",
    documentId: "ops-document",
    chunkId: "ops-chunk",
    title: "OPS",
    content: "OPS is on-base percentage plus slugging percentage.",
    category: "Statistics",
    level: "General",
    source: "Clubhouse Baseball Knowledge Bank",
    sourceReference: "Curated V1 summary",
    version: "V1",
    status: "reviewed",
  }]);
  const response = await generateAskClubhouseReply({
    data,
    message: "What is OPS?",
    config: getAskClubhouseConfig({}),
    knowledgeProvider,
  });

  assert.equal(response.route, "baseball_knowledge");
  assert.match(response.answer, /on-base percentage plus slugging/);
  assert.equal(response.evidence[0].documentId, "ops-document");
  assert.equal(response.evidence[0].chunkId, "ops-chunk");
  assert.equal(response.evidence[0].status, "reviewed");
});

test("Baseball Knowledge QA fixture covers the V1 route contract", () => {
  assert.ok(BASEBALL_KNOWLEDGE_QA.length >= 50);
  for (const item of BASEBALL_KNOWLEDGE_QA) {
    assert.equal(typeof item.question, "string");
    assert.ok(["clubhouse_data", "baseball_knowledge", "mixed", "external_research_required", "out_of_scope"].includes(item.route));
  }
});

test("Ask Clubhouse independently reroutes a current question after a Clubhouse question", () => {
  const history = [{ role: "user", content: "Who hits curveballs best?" }];
  const currentRule = classifyAskClubhouseIntent("What is the NFHS balk rule?", players, history, { webSearchEnabled: false });

  assert.equal(classifyAskClubhouseIntent("Who hits curveballs best?", players).route, "clubhouse_data");
  assert.equal(currentRule.route, "external_research_required");
  assert.equal(currentRule.requiresWebSearch, false);
});

test("Ask Clubhouse never calls the provider for a current question while web is disabled", async () => {
  const config = getAskClubhouseConfig({ OPENAI_API_KEY: "test-key" });
  let providerCalled = false;
  const response = await generateAskClubhouseReply({
    data,
    message: "What is the 2026 NFHS balk rule?",
    config,
    provider: {
      model: config.model,
      async generate() {
        providerCalled = true;
        throw new Error("should not be called");
      },
    },
  });

  assert.equal(response.route, "external_research_required");
  assert.equal(response.webSearchCount, 0);
  assert.equal(providerCalled, false);
  assert.match(response.answer, /research isn't enabled/i);
});

test("Ask Clubhouse preserves mixed routing when current baseball context is unavailable", () => {
  const classification = classifyAskClubhouseIntent("Jackson topped out at 84 mph. Is that good for his age?", players, [], { webSearchEnabled: false });
  const plan = buildAskClubhouseToolPlan(data, "Jackson topped out at 84 mph. Is that good for his age?", undefined, getAskClubhouseConfig({}), []);

  assert.equal(classification.route, "mixed");
  assert.equal(classification.externalResearchRequired, true);
  assert.equal(classification.requiresWebSearch, false);
  assert.equal(plan.route, "mixed");
  assert.equal(plan.status, "data");
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

test("Ask Clubhouse does not treat short name substrings as player matches", () => {
  const config = getAskClubhouseConfig({});
  const malformedRosterData = {
    ...data,
    players: [...data.players, player("p-ab", "a b", 4, "P")],
  };
  const plan = buildAskClubhouseToolPlan(malformedRosterData, "What is a balk?", undefined, config);

  assert.equal(plan.route, "baseball_knowledge");
  assert.equal(plan.status, "provider");
});

test("Ask Clubhouse classifies chase rate before resolving roster player Chase", () => {
  const config = getAskClubhouseConfig({});
  const chase = player("p-chase", "Chase Kiker", 5, "OF");
  const knowledgeProvider = new InMemoryBaseballKnowledgeProvider([{
    id: "chase-rate",
    title: "Chase Rate",
    content: "Chase rate is the share of swings at pitches outside the strike zone.",
    category: "Statistics",
    subcategory: "Plate discipline",
    status: "verified",
  }]);
  const chaseData = { ...data, players: [...data.players, chase] };

  const knowledgePlan = buildAskClubhouseToolPlan(chaseData, "What is chase rate?", undefined, config, [], knowledgeProvider);
  const playerPlan = buildAskClubhouseToolPlan(chaseData, "How is Chase hitting?", undefined, config, [], knowledgeProvider);

  assert.equal(knowledgePlan.route, "baseball_knowledge");
  assert.match(knowledgePlan.answer, /share of swings/i);
  assert.equal(playerPlan.route, "clubhouse_data");
  assert.equal(playerPlan.queryPlan.playerId, "p-chase");
});

test("Ask Clubhouse resolves self-development questions from player context", () => {
  const plan = buildAskClubhouseToolPlan(
    data,
    "How can I hit sliders better?",
    { playerId: "p-jacob" },
    getAskClubhouseConfig({}),
  );

  assert.equal(plan.route, "clubhouse_data");
  assert.equal(plan.status, "completed");
  assert.equal(plan.queryPlan.playerId, "p-jacob");
  assert.equal(plan.diagnosis.playerId, "p-jacob");
});

test("Ask Clubhouse resolves duplicate exact names to the player with tracked activity", () => {
  const config = getAskClubhouseConfig({});
  const duplicateData = {
    ...data,
    players: [
      ...data.players,
      player("p-jacob-duplicate", "Jacob Seamon", 99, "1B"),
    ],
  };
  const plan = buildAskClubhouseToolPlan(duplicateData, "Show Jacob Seamon analytics", undefined, config);

  assert.equal(plan.status, "data");
  assert.equal(plan.queryPlan.playerId, "p-jacob");
});

test("Ask Clubhouse clarifies two same-name players when both have tracked activity", () => {
  const duplicate = player("p-jacob-duplicate", "Jacob Seamon", 99, "1B");
  const duplicateData = {
    ...data,
    players: [...data.players, duplicate],
    hittingEvents: [
      ...data.hittingEvents,
      hittingEvent("he-jacob-duplicate", "practice-1", "hit-1", duplicate.id, "Ball in play"),
    ],
  };
  const plan = buildAskClubhouseToolPlan(duplicateData, "Show Jacob Seamon analytics", undefined, getAskClubhouseConfig({}));

  assert.equal(plan.status, "needs_clarification");
  assert.match(plan.answer, /#1/);
  assert.match(plan.answer, /#99/);
});

test("player identity view preserves events while collapsing strong duplicate roster rows", () => {
  const duplicate = player("p-jacob-import", "Jacob Seamon", 1, "CF");
  const duplicateEvents = Array.from({ length: 20 }, (_, index) => (
    hittingEvent(`he-import-${index}`, "practice-1", "hit-1", duplicate.id, "Ball in play")
  ));
  const duplicateData = {
    ...data,
    players: [...data.players, duplicate],
    playerTeamMemberships: [
      ...data.playerTeamMemberships,
      { ...data.playerTeamMemberships[0], id: "membership-import", playerId: duplicate.id },
    ],
    hittingEvents: [...data.hittingEvents, ...duplicateEvents],
  };

  const view = canonicalizeAppDataPlayerIdentities(duplicateData);
  const canonicalId = view.canonicalIdByPlayerId.get("p-jacob");

  assert.equal(canonicalId, "p-jacob-import");
  assert.equal(view.data.players.filter((item) => item.name === "Jacob Seamon").length, 1);
  assert.equal(view.data.hittingEvents.filter((event) => event.hitterId === canonicalId).length, 24);
  assert.equal(view.data.playerTeamMemberships.filter((membership) => membership.playerId === canonicalId).length, 1);
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

test("Ask Clubhouse visual answers use a player-scoped Analytics query and bounded canonical points", () => {
  const visualData = {
    ...data,
    hittingEvents: data.hittingEvents.map((event, index) => ({
      ...event,
      pitchLocation: { x: 0.35 + (index * 0.08), y: 0.45 },
      fieldLocation: event.action === "Ball in play" ? { x: 0.3 + (index * 0.05), y: 0.42 } : undefined,
    })),
  };
  const config = getAskClubhouseConfig({});
  const plan = buildAskClubhouseToolPlan(visualData, "Show Jacob Seamon's practice spray chart", undefined, config);
  const visuals = buildAskClubhouseVisuals({ data: visualData, message: "Show Jacob Seamon's practice spray chart", plan });
  const chart = visuals.find((visual) => visual.type === "spray_chart");

  assert.equal(chart?.playerId, "p-jacob");
  assert.deepEqual(chart?.query.playerIds, ["p-jacob"]);
  assert.deepEqual(plan.toolRequests[0]?.query.playerIds, ["p-jacob"]);
  assert.deepEqual(chart?.points?.map((point) => point.id).sort(), ["he-3", "he-4"]);
  assert.equal(chart?.coverage.qualifyingEvents, 2);
});

test("Ask Clubhouse recognizes conversational player requests for a spray chart", () => {
  const visualData = {
    ...data,
    hittingEvents: data.hittingEvents.map((event, index) => ({
      ...event,
      fieldLocation: event.action === "Ball in play" ? { x: 0.3 + (index * 0.05), y: 0.42 } : undefined,
    })),
  };
  const config = getAskClubhouseConfig({});
  const plan = buildAskClubhouseToolPlan(visualData, "Show me Jacob Seamons spray chart", undefined, config);
  const visuals = buildAskClubhouseVisuals({ data: visualData, message: "Show me Jacob Seamons spray chart", plan });

  assert.equal(plan.status, "data");
  assert.equal(plan.queryPlan.playerId, "p-jacob");
  assert.equal(visuals.find((visual) => visual.type === "spray_chart")?.playerId, "p-jacob");
});

test("Ask Clubhouse gives the provider compact, authoritative visual coverage", async () => {
  const visualData = {
    ...data,
    hittingEvents: data.hittingEvents.map((event, index) => ({
      ...event,
      fieldLocation: event.action === "Ball in play" ? { x: 0.3 + (index * 0.05), y: 0.42 } : undefined,
    })),
  };
  const config = getAskClubhouseConfig({ OPENAI_API_KEY: "test-key" });
  const provider = {
    model: config.model,
    async generate(input) {
      const prompt = JSON.parse(input.prompt);
      const spray = prompt.visualEvidence.find((visual) => visual.type === "spray_chart");
      assert.equal(spray.pointCount, 2);
      assert.equal(spray.coverage.trackedEvents, 2);
      return { text: "Jacob has two tracked balls in play.", usage: { model: config.model } };
    },
  };

  const response = await generateAskClubhouseReply({
    data: visualData,
    message: "Show Jacob Seamon's practice spray chart",
    config,
    provider,
  });

  assert.equal(response.visuals?.find((visual) => visual.type === "spray_chart")?.points?.length, 2);
});

test("Ask Clubhouse visual follow-ups retain the prior filtered visual context", () => {
  const config = getAskClubhouseConfig({});
  const visualData = {
    ...data,
    hittingEvents: data.hittingEvents.map((event, index) => ({ ...event, pitchType: "Slider", pitchLocation: { x: 0.35 + (index * 0.08), y: 0.45 } })),
  };
  const context = {
    visualContext: {
      type: "pitch_location",
      mode: "dots",
      playerId: "p-jacob",
      query: {
        domain: "hitting",
        source: "practice",
        mode: "situational",
        timeRange: "season",
        filters: { pitchTypes: ["Slider"] },
      },
    },
  };
  const plan = buildAskClubhouseToolPlan(visualData, "How did he do?", context, config);
  const visuals = buildAskClubhouseVisuals({ data: visualData, message: "How did he do?", plan, uiContext: context });

  assert.equal(plan.status, "data");
  assert.equal(visuals[0]?.type, "metric_summary");
  assert.equal(visuals[1]?.mode, "dots");
  assert.deepEqual(visuals[1]?.query.filters.pitchTypes, ["Slider"]);
});

test("Ask Clubhouse renders a player heat request as an authorized pitch-location descriptor", () => {
  const visualData = {
    ...data,
    hittingEvents: data.hittingEvents.map((event, index) => ({ ...event, pitchType: "Slider", pitchLocation: { x: 0.25 + (index * 0.1), y: 0.45 } })),
  };
  const config = getAskClubhouseConfig({});
  const plan = buildAskClubhouseToolPlan(visualData, "Show Jacob Seamon's slider heat map", undefined, config);
  const visuals = buildAskClubhouseVisuals({ data: visualData, message: "Show Jacob Seamon's slider heat map", plan });
  const chart = visuals.find((visual) => visual.type === "pitch_location");

  assert.equal(plan.status, "data");
  assert.equal(chart?.mode, "dots");
  assert.equal(chart?.coverage.qualifyingEvents, 4);
  assert.equal(chart?.coverage.trackedEvents, 4);
});

test("Ask Clubhouse performance visuals add both location and spray evidence when each is tracked", () => {
  const visualData = {
    ...data,
    hittingEvents: data.hittingEvents.map((event, index) => ({
      ...event,
      pitchType: "Slider",
      pitchLocation: { x: 0.25 + (index * 0.1), y: 0.45 },
      fieldLocation: event.action === "Ball in play" ? { x: 0.3 + (index * 0.05), y: 0.42 } : undefined,
    })),
  };
  const config = getAskClubhouseConfig({});
  const plan = buildAskClubhouseToolPlan(visualData, "How is Jacob Seamon hitting sliders in Practice?", undefined, config);
  const visuals = buildAskClubhouseVisuals({ data: visualData, message: "How is Jacob Seamon hitting sliders in Practice?", plan });

  assert.ok(visuals.some((visual) => visual.type === "metric_summary"));
  assert.ok(visuals.some((visual) => visual.type === "pitch_location"));
  assert.ok(visuals.some((visual) => visual.type === "spray_chart"));
});

test("Ask Clubhouse rejects visual descriptors with unsupported filters", () => {
  assert.equal(isAskClubhouseVisual({
    type: "pitch_location",
    mode: "dots",
    title: "Unsafe",
    domain: "hitting",
    query: { domain: "hitting", source: "practice", filters: { arbitrarySql: ["select *"] } },
  }), false);
});

test("OpenAI provider bounds web search and extracts compact sources", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody;
  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({
      model: "gpt-test",
      output_text: "NFHS balk guidance.",
      usage: {
        input_tokens: 30,
        input_tokens_details: { cached_tokens: 10, cache_write_tokens: 5 },
        output_tokens: 8,
        output_tokens_details: { reasoning_tokens: 3 },
        total_tokens: 38,
      },
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
    assert.equal(result.usage.cachedInputTokens, 10);
    assert.equal(result.usage.cacheWriteTokens, 5);
    assert.equal(result.usage.reasoningTokens, 3);
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
  const config = getAskClubhouseConfig({ OPENAI_API_KEY: "test-key", AI_WEB_SEARCH_ENABLED: "true" });
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

test("AI cost calculator separates cached, output, and web-search costs", () => {
  const cost = calculateAIRequestCost({
    model: "gpt-5-mini-2025-08-07",
    inputTokens: 1_000_000,
    cachedInputTokens: 200_000,
    cacheWriteTokens: 100_000,
    outputTokens: 100_000,
    webSearchCount: 1,
  });

  assert.equal(cost.pricingFound, true);
  assert.equal(cost.inputCost, 0.175);
  assert.equal(cost.cachedInputCost, 0.005);
  assert.equal(cost.cacheWriteCost, 0.025);
  assert.equal(cost.outputCost, 0.2);
  assert.equal(cost.modelTokenCost, 0.405);
  assert.equal(cost.webSearchCost, 0.01);
  assert.equal(cost.estimatedTotalCost, 0.415);
});

test("AI cost calculator matches an observed Luna request without double-counting reasoning", () => {
  const cost = calculateAIRequestCost({
    model: "gpt-5.6-luna",
    inputTokens: 1625,
    outputTokens: 148,
  });

  assert.equal(cost.modelTokenCost, 0.0005026);
  assert.equal(cost.estimatedTotalCost, 0.0005026);
});

test("Ask Clubhouse resolves role-aware defaults and legacy overrides", () => {
  const defaults = getAskClubhouseConfig({});
  assert.deepEqual(defaults.dailyRoleRequestLimits, {
    coach: 30,
    player: 10,
    parent: 5,
    fan: 5,
    unknown: 5,
  });
  assert.equal(defaults.dailyTeamRequestLimit, 150);
  assert.equal(defaults.monthlyTeamRequestLimit, 3000);
  assert.equal(defaults.monthlyTeamCostLimitUsd, 25);
  assert.equal(defaults.monthlyGlobalCostLimitUsd, 100);
  assert.equal(resolveAiUsageRole("HEAD_COACH"), "coach");
  assert.equal(resolveAiUsageRole("PLAYER"), "player");
  assert.equal(resolveAiUsageRole(undefined, "ADMIN"), "coach");
  assert.equal(resolveAiUsageRole("LEGACY"), "unknown");

  const legacy = getAskClubhouseConfig({ AI_DAILY_USER_REQUEST_LIMIT: "12" });
  assert.equal(legacy.dailyRoleRequestLimits.coach, 12);
  assert.equal(legacy.dailyRoleRequestLimits.player, 12);
});

test("AI usage limits stop duplicate submissions before provider work", async () => {
  const config = getAskClubhouseConfig({});

  const duplicate = await enforceAiUsageLimits(duplicateOnlyUsageSupabase(), {
    profileId: "profile-1",
    teamId: "team-1",
    role: "coach",
    requiresWebSearch: false,
    requestHash: "same-question",
    config,
    now: new Date(now),
  });
  assert.equal(duplicate.allowed, false);
  assert.equal(duplicate.code, "AI_DUPLICATE_COOLDOWN");
});

test("AI quota classification counts useful answers but excludes non-answer audit events", () => {
  for (const status of ["completed", "no_data", "low_sample"]) {
    assert.equal(countsTowardRequestQuota({ status }), true, `${status} should count`);
  }
  for (const status of ["refused", "duplicate", "rate_limited", "failed", "unavailable", "needs_clarification", "knowledge_miss", "out_of_scope", "started"]) {
    assert.equal(countsTowardRequestQuota({ status }), false, `${status} should not count`);
  }
  assert.equal(countsTowardRequestQuota({ status: "completed", metadata: { usageAccounting: { countsTowardRequestQuota: false } } }), false);
  assert.equal(countsTowardRequestQuota({ status: "failed", quotaOutcome: "useful_answer" }), true);
});

test("AI quota windows use the configured local timezone across DST boundaries", () => {
  const rows = [
    usageRow("2026-03-08T04:59:00.000Z"),
    usageRow("2026-03-08T05:01:00.000Z"),
  ];
  const springStats = summarizeAiUsageWindows(rows, { profileId: "profile-1", teamId: "team-1" }, new Date("2026-03-08T06:00:00.000Z"), "America/New_York");
  assert.equal(springStats.userDailyRequests, 1);
  assert.equal(springStats.teamDailyRequests, 1);
  assert.equal(springStats.teamMonthlyRequests, 2);

  const fallStats = summarizeAiUsageWindows([
    usageRow("2026-11-02T04:59:00.000Z"),
    usageRow("2026-11-02T05:01:00.000Z"),
  ], { profileId: "profile-1", teamId: "team-1" }, new Date("2026-11-02T06:00:00.000Z"), "America/New_York");
  assert.equal(fallStats.userDailyRequests, 1);
  assert.equal(fallStats.teamDailyRequests, 1);
});

test("internal admin testing allowance is explicit and still respects team ceilings", () => {
  const normalConfig = getAskClubhouseConfig({});
  const testConfig = getAskClubhouseConfig({ AI_INTERNAL_TESTING_ENABLED: "true", AI_DAILY_ADMIN_REQUEST_LIMIT: "100" });
  const baseInput = { teamId: "team-1", role: "coach", requiresWebSearch: false };
  assert.equal(evaluateAiUsageLimits({ ...baseInput, config: normalConfig, isAdmin: true }, usageStats({ userDailyRequests: 30 })).code, "AI_DAILY_USER_LIMIT");
  assert.equal(evaluateAiUsageLimits({ ...baseInput, config: testConfig, isAdmin: true }, usageStats({ userDailyRequests: 99 })).allowed, true);
  assert.equal(evaluateAiUsageLimits({ ...baseInput, config: testConfig, isAdmin: true }, usageStats({ userDailyRequests: 100 })).code, "AI_DAILY_USER_LIMIT");
  assert.equal(evaluateAiUsageLimits({ ...baseInput, config: testConfig, isAdmin: true }, usageStats({ userDailyRequests: 99, teamDailyRequests: 150 })).code, "AI_DAILY_TEAM_LIMIT");
});

test("AI usage limits enforce coach, player, team, and monthly ceilings", () => {
  const config = getAskClubhouseConfig({});
  const baseInput = { teamId: "team-1", role: "coach", requiresWebSearch: false, config };

  assert.equal(evaluateAiUsageLimits(baseInput, usageStats({ userDailyRequests: 30 })).code, "AI_DAILY_USER_LIMIT");
  assert.equal(evaluateAiUsageLimits({ ...baseInput, role: "player" }, usageStats({ userDailyRequests: 10 })).code, "AI_DAILY_USER_LIMIT");
  assert.equal(evaluateAiUsageLimits(baseInput, usageStats({ teamDailyRequests: 150 })).code, "AI_DAILY_TEAM_LIMIT");
  assert.equal(evaluateAiUsageLimits(baseInput, usageStats({ teamMonthlyRequests: 3000 })).code, "AI_MONTHLY_TEAM_REQUEST_LIMIT");
  assert.equal(evaluateAiUsageLimits(baseInput, usageStats({ teamMonthlyCostUsd: 25 })).code, "AI_MONTHLY_TEAM_COST_LIMIT");
  assert.equal(evaluateAiUsageLimits(baseInput, usageStats({ globalMonthlyCostUsd: 100 })).code, "AI_MONTHLY_GLOBAL_COST_LIMIT");
});

test("AI usage limits enforce separate user and team web-search ceilings", () => {
  const config = getAskClubhouseConfig({});
  const input = { teamId: "team-1", role: "player", requiresWebSearch: true, config };

  assert.equal(evaluateAiUsageLimits(input, usageStats({ userDailyWebSearches: 3 })).code, "AI_DAILY_USER_WEB_SEARCH_LIMIT");
  assert.equal(evaluateAiUsageLimits(input, usageStats({ teamDailyWebSearches: 30 })).code, "AI_DAILY_TEAM_WEB_SEARCH_LIMIT");
  assert.equal(evaluateAiUsageLimits({ ...input, requiresWebSearch: false }, usageStats({ userDailyWebSearches: 99 })).allowed, true);
});

test("Super User is an entitlement that bypasses request counts but not cost safety", () => {
  const config = getAskClubhouseConfig({});
  const allowance = resolveAskClubhouseAllowance({
    role: "coach",
    entitlements: [superUserEntitlement()],
  });
  const input = {
    teamId: "team-1",
    role: "coach",
    requiresWebSearch: false,
    config,
    allowance,
  };

  assert.equal(allowance.unlimitedRequests, true);
  assert.equal(allowance.bypassTeamRequestCount, true);
  assert.equal(allowance.webResearch, false);
  assert.equal(evaluateAiUsageLimits(input, usageStats({
    userDailyRequests: 1000,
    teamDailyRequests: 150,
    teamMonthlyRequests: 3000,
  })).allowed, true);
  assert.equal(evaluateAiUsageLimits({ ...input, isAdmin: true }, usageStats({
    userDailyRequests: 1000,
    teamDailyRequests: 150,
    teamMonthlyRequests: 3000,
  })).allowed, true);
  assert.equal(evaluateAiUsageLimits(input, usageStats({
    userDailyRequests: 1000,
    teamDailyRequests: 150,
    teamMonthlyRequests: 3000,
    teamMonthlyCostUsd: 25,
  })).code, "AI_MONTHLY_TEAM_COST_LIMIT");
  assert.equal(evaluateAiUsageLimits(input, usageStats({
    userDailyRequests: 1000,
    teamMonthlyCostUsd: 0,
    globalMonthlyCostUsd: 100,
  })).code, "AI_MONTHLY_GLOBAL_COST_LIMIT");
});

test("role limits stay separate from Super User entitlement and expiry is immediate", () => {
  const config = getAskClubhouseConfig({});
  const normalCoach = resolveAskClubhouseAllowance({ role: "coach", entitlements: [] });
  const adminWithoutEntitlement = resolveAskClubhouseAllowance({ role: "coach", entitlements: [] });
  const expired = superUserEntitlement({ expiresAt: "2026-08-19T11:00:00.000Z" });
  const revoked = superUserEntitlement({ enabled: false });

  assert.equal(normalCoach.unlimitedRequests, false);
  assert.equal(adminWithoutEntitlement.unlimitedRequests, false);
  assert.equal(hasEntitlement([superUserEntitlement()], SUPER_USER_ENTITLEMENT, new Date("2026-08-20T12:00:00.000Z")), true);
  assert.equal(hasEntitlement([expired], SUPER_USER_ENTITLEMENT, new Date("2026-08-20T12:00:00.000Z")), false);
  assert.equal(hasEntitlement([revoked], SUPER_USER_ENTITLEMENT, new Date("2026-08-20T12:00:00.000Z")), false);
  assert.equal(evaluateAiUsageLimits({ teamId: "team-1", role: "coach", requiresWebSearch: false, config, allowance: resolveAskClubhouseAllowance({ role: "coach", entitlements: [expired], now: new Date("2026-08-20T12:00:00.000Z") }) }, usageStats({ userDailyRequests: 30 })).code, "AI_DAILY_USER_LIMIT");
});

test("Super User usage remains auditable and cost-accounted", async () => {
  let update;
  const supabase = {
    from(table) {
      assert.equal(table, "ai_usage_events");
      return {
        update(values) {
          update = values;
          return {
            eq() {
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };

  await finishAiUsageEvent(supabase, {
    usageEventId: "usage-super-user",
    status: "completed",
    latencyMs: 120,
    providerUsage: {
      inputTokens: 1000,
      outputTokens: 100,
      totalTokens: 1100,
      model: "gpt-5-mini",
    },
    toolCallCount: 1,
    webSearchCount: 0,
    quotaOutcome: "useful_answer",
    metadata: { superUserAllowance: true },
  });

  assert.equal(update.status, "completed");
  assert.equal(update.metadata.superUserAllowance, true);
  assert.equal(update.metadata.usageAccounting.countsTowardRequestQuota, true);
  assert.equal(update.metadata.usageAccounting.estimatedTotalCostUsd > 0, true);
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

function duplicateOnlyUsageSupabase() {
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
            data: { id: "usage-1", status: "started", created_at: now },
            error: null,
          });
        },
      };
      return builder;
    },
  };
}

function usageStats(overrides = {}) {
  return {
    userDailyRequests: 0,
    teamDailyRequests: 0,
    teamMonthlyRequests: 0,
    userDailyWebSearches: 0,
    teamDailyWebSearches: 0,
    teamMonthlyCostUsd: 0,
    globalMonthlyCostUsd: 0,
    ...overrides,
  };
}

function usageRow(createdAt, overrides = {}) {
  return {
    profile_id: "profile-1",
    organization_id: "org-1",
    team_id: "team-1",
    model: "gpt-5.6-luna",
    status: "completed",
    input_tokens: 100,
    output_tokens: 50,
    web_search_count: 0,
    metadata: { usageAccounting: { estimatedTotalCostUsd: 0.001 } },
    created_at: createdAt,
    ...overrides,
  };
}

function superUserEntitlement(overrides = {}) {
  return {
    id: "entitlement-super-user",
    profileId: "profile-1",
    entitlementKey: SUPER_USER_ENTITLEMENT,
    enabled: true,
    grantedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

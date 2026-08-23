import assert from "node:assert/strict";
import test from "node:test";
import {
  executeAnalyticsQuery,
  runAskClubhouseQuestion,
} from "../app/lib/analyticsQuery.ts";

const now = "2026-08-20T12:00:00.000Z";

const players = [
  player("p-jacob", "Jacob Seamon", 1, "CF"),
  player("p-mylo", "Mylo White", 2, "LHP", { throws: "L", isPitcher: true }),
  player("p-jackson", "Jackson Pierce", 4, "OF"),
];

const baseData = {
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
  practices: [
    practice("practice-aug-17", "2026-08-17"),
    practice("practice-aug-19", "2026-08-19"),
  ],
  attendance: [],
  practiceSessionContributors: [],
  pitchingSessions: [
    pitchingSession("pitching-1", "practice-aug-17", "p-mylo", "Bullpen"),
    pitchingSession("live-pitching-1", "practice-aug-19", "p-mylo", "Live BP"),
  ],
  pitchEvents: [
    pitchEvent("pe-1", "practice-aug-17", "pitching-1", "p-mylo", "Called Strike", { velocity: 82 }),
    pitchEvent("pe-2", "practice-aug-17", "pitching-1", "p-mylo", "Whiff", { velocity: 84 }),
    pitchEvent("pe-3", "practice-aug-17", "pitching-1", "p-mylo", "Ball", { isStrike: false, isZone: false, velocity: 81 }),
    pitchEvent("pe-live-1", "practice-aug-19", "live-pitching-1", "p-mylo", "Called Strike", { velocity: 85 }),
  ],
  hittingSessions: [
    hittingSession("hit-1", "practice-aug-17", "p-jacob", "Machine"),
    hittingSession("hit-2", "practice-aug-19", "p-jacob", "Machine"),
    hittingSession("live-hit-1", "practice-aug-19", "p-jacob", "Live BP"),
  ],
  hittingEvents: [
    hittingEvent("he-1", "practice-aug-17", "hit-1", "p-jacob", "Miss"),
    hittingEvent("he-2", "practice-aug-17", "hit-1", "p-jacob", "Foul"),
    hittingEvent("he-3", "practice-aug-17", "hit-1", "p-jacob", "Ball in play", { contactResult: "Line drive", contactQuality: "Hard", exitVelocityMph: 90 }),
    hittingEvent("he-4", "practice-aug-17", "hit-1", "p-jacob", "Ball in play", { contactResult: "Ground ball", contactQuality: "Solid", exitVelocityMph: 86 }),
    hittingEvent("he-5", "practice-aug-19", "hit-2", "p-jacob", "Ball in play", { contactResult: "Fly ball", contactQuality: "Barrel", exitVelocityMph: 95 }),
    hittingEvent("he-live-1", "practice-aug-19", "live-hit-1", "p-jacob", "Ball in play", { contactResult: "Line drive", contactQuality: "Hard", exitVelocityMph: 92, isLiveBp: true }),
    hittingEvent("he-mylo-1", "practice-aug-19", "hit-2", "p-mylo", "Ball in play", { contactResult: "Line drive", contactQuality: "Hard", exitVelocityMph: 88 }),
  ],
  defenseSessions: [],
  defenseEvents: [],
  workoutSessions: [],
  workoutEntries: [],
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
    gameEvent("ge-3", "game-1", "p-jackson", "p-mylo", "Ball"),
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

test("hitting practice query calculates contact, hard rate, and EV from real events", () => {
  const result = executeAnalyticsQuery(baseData, query("hitting", "practice"));
  const jacob = row(result, "p-jacob");

  assert.equal(jacob.cells.swings.display, "5");
  assert.equal(jacob.cells.contacts.display, "4");
  assert.equal(jacob.cells.bip.display, "3");
  assert.equal(jacob.cells.misses.display, "1");
  assert.equal(jacob.cells.contactPct.display, "80%");
  assert.equal(jacob.cells.contactPct.sample, "4/5");
  assert.equal(jacob.cells.swingMissPct.display, "20%");
  assert.equal(jacob.cells.hardPct.display, "67%");
  assert.equal(jacob.cells.barrelPct.display, "33%");
  assert.equal(jacob.cells.avgEv.display, "90.3");
  assert.equal(jacob.cells.maxEv.display, "95.0");
});

test("team totals use weighted aggregate rates instead of averaging player percentages", () => {
  const result = executeAnalyticsQuery(baseData, query("hitting", "practice"));
  const team = {
    ...result.teamTotals,
    cells: Object.fromEntries(Object.entries(result.teamTotals.cells).map(([key, cell]) => [key, { ...cell, sample: sampleText(cell) }])),
  };

  assert.equal(team.cells.swings.display, "6");
  assert.equal(team.cells.contactPct.display, "83%");
  assert.equal(team.cells.contactPct.sample, "5/6");
});

test("event filtering changes denominators and excludes unselected practices", () => {
  const result = executeAnalyticsQuery(baseData, {
    ...query("hitting", "practice"),
    eventIds: ["practice-aug-17"],
  });
  const jacob = row(result, "p-jacob");

  assert.equal(jacob.cells.swings.display, "4");
  assert.equal(jacob.cells.contactPct.display, "75%");
  assert.equal(jacob.cells.maxEv.display, "90.0");
});

test("date range filtering uses the current date window", () => {
  const data = {
    ...baseData,
    practices: [
      ...baseData.practices,
      practice("practice-aug-01", "2026-08-01"),
    ],
    hittingSessions: [
      ...baseData.hittingSessions,
      hittingSession("hit-old", "practice-aug-01", "p-jacob", "Machine"),
    ],
    hittingEvents: [
      ...baseData.hittingEvents,
      hittingEvent("he-old", "practice-aug-01", "hit-old", "p-jacob", "Ball in play", { contactResult: "Line drive", contactQuality: "Hard", exitVelocityMph: 99 }),
    ],
  };

  const season = executeAnalyticsQuery(data, query("hitting", "practice"), { today: "2026-08-20" });
  const last7 = executeAnalyticsQuery(data, { ...query("hitting", "practice"), timeRange: "7d" }, { today: "2026-08-20" });

  assert.equal(row(season, "p-jacob").cells.opportunities.display, "6");
  assert.equal(row(last7, "p-jacob").cells.opportunities.display, "5");
  assert.equal(row(last7, "p-jacob").cells.maxEv.display, "95.0");
});

test("source classification keeps Live BP out of Practice while All includes compatible sources once", () => {
  const practice = executeAnalyticsQuery(baseData, query("hitting", "practice"));
  const liveBp = executeAnalyticsQuery(baseData, query("hitting", "live-bp"));
  const all = executeAnalyticsQuery(baseData, query("hitting", "all"));

  assert.equal(row(practice, "p-jacob").cells.opportunities.display, "5");
  assert.equal(row(liveBp, "p-jacob").cells.opportunities.display, "1");
  assert.equal(row(all, "p-jacob").cells.opportunities.display, "6");
});

test("Live BP thrower source filters are structured and deterministic", () => {
  const data = {
    ...baseData,
    hittingSessions: [
      ...baseData.hittingSessions,
      hittingSession("live-hit-coach", "practice-aug-19", "p-jackson", "Live BP", { liveBpThrowerSource: "COACH" }),
    ],
    hittingEvents: [
      ...baseData.hittingEvents,
      hittingEvent("he-live-coach", "practice-aug-19", "live-hit-coach", "p-jackson", "Ball in play", {
        contactResult: "Line drive",
        contactQuality: "Hard",
        isLiveBp: true,
      }),
    ],
  };

  const playerThrown = executeAnalyticsQuery(data, {
    ...query("hitting", "live-bp"),
    mode: "situational",
    filters: { liveBpThrowerSources: ["PLAYER"] },
  });
  const coachThrown = executeAnalyticsQuery(data, {
    ...query("hitting", "live-bp"),
    mode: "situational",
    filters: { liveBpThrowerSources: ["COACH"] },
  });

  assert.equal(playerThrown.filterDefinitions.some((definition) => definition.id === "liveBpThrowerSources"), true);
  assert.equal(row(playerThrown, "p-jacob").cells.opportunities.display, "1");
  assert.equal(row(playerThrown, "p-jackson").cells.opportunities.display, "—");
  assert.equal(row(coachThrown, "p-jacob").cells.opportunities.display, "—");
  assert.equal(row(coachThrown, "p-jackson").cells.opportunities.display, "1");
});

test("situational filters narrow supported hitting dimensions", () => {
  const result = executeAnalyticsQuery(baseData, {
    ...query("hitting", "practice"),
    mode: "situational",
    filters: { battedBallTypes: ["Line drive"] },
  });
  const jacob = row(result, "p-jacob");

  assert.equal(result.filterDefinitions.some((definition) => definition.id === "battedBallTypes"), true);
  assert.equal(jacob.cells.opportunities.display, "1");
  assert.equal(jacob.cells.hardPct.sample, "1/1");
});

test("column registry can produce a narrowed box score without changing calculations", () => {
  const result = executeAnalyticsQuery(baseData, {
    ...query("hitting", "practice"),
    metrics: ["swings", "contactPct"],
  });

  assert.deepEqual(result.columns.map((column) => column.metricId), ["swings", "contactPct"]);
  assert.equal(result.availableColumns.some((column) => column.metricId === "avgEv"), true);
  assert.equal(row(result, "p-jacob").cells.avgEv.display, "90.3");
});

test("pitching query calculates strike and CSW rates with game source support", () => {
  const result = executeAnalyticsQuery(baseData, query("pitching", "all"));
  const mylo = row(result, "p-mylo");

  assert.equal(mylo.cells.pitches.display, "7");
  assert.equal(mylo.cells.strikePct.display, "71%");
  assert.equal(mylo.cells.cswPct.display, "43%");
  assert.equal(mylo.cells.avgPitchVelo.display, "83.0");
});

test("game hitting source only exposes supported ball-in-play metrics", () => {
  const result = executeAnalyticsQuery(baseData, query("hitting", "games"));
  const labels = result.columns.map((column) => column.label);
  const jacob = row(result, "p-jacob");

  assert.deepEqual(labels, ["BIP", "AB", "H", "1B", "2B", "3B", "HR", "Outs", "XBH", "TB", "AVG", "SLG", "ISO", "BABIP"]);
  assert.equal(jacob.cells.hits.display, "2");
  assert.equal(jacob.cells.singles.display, "1");
  assert.equal(jacob.cells.totalBases.display, "3");
  assert.equal(jacob.cells.avg.display, "1.000");
  assert.match(result.warnings.join(" "), /logged game balls in play only/);
});

test("analytics context warnings protect team and season scope", () => {
  const result = executeAnalyticsQuery(baseData, {
    ...query("hitting", "practice"),
    context: { teamId: "other-team", seasonId: "other-season" },
  });

  assert.equal(result.warnings.some((warning) => warning.includes("selected team")), true);
  assert.equal(result.warnings.some((warning) => warning.includes("selected season")), true);
});

test("Ask Clubhouse suggested questions are backed by query-layer output", () => {
  const response = runAskClubhouseQuestion(baseData, "highest-avg-ev", {
    teamId: "team-1",
    seasonId: "season-1",
  });

  assert.ok(response);
  assert.equal(response.question.rankingMetricId, "avgEv");
  assert.equal(response.lines[0].label, "1. Jacob Seamon");
  assert.equal(response.lines[0].value, "90.8");
  assert.equal(response.result.query.source, "all");
});

function query(domain, source) {
  return {
    domain,
    source,
    mode: "box-score",
    timeRange: "season",
    groupBy: "player",
    context: { teamId: "team-1", seasonId: "season-1" },
  };
}

function row(result, playerId) {
  const found = result.rows.find((item) => item.player.id === playerId);
  assert.ok(found, `Expected row for ${playerId}`);
  return {
    ...found,
    cells: Object.fromEntries(Object.entries(found.cells).map(([key, cell]) => [key, { ...cell, sample: sampleText(cell) }])),
  };
}

function sampleText(cell) {
  if (!cell.sample) return undefined;
  if (typeof cell.sample.numerator === "number" && typeof cell.sample.denominator === "number") {
    return `${cell.sample.numerator}/${cell.sample.denominator}`;
  }
  return undefined;
}

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

function hittingSession(id, practiceId, hitterId, type, overrides = {}) {
  return {
    id,
    practiceId,
    hitterId,
    type,
    roundGoals: [],
    startedAt: now,
    ...overrides,
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
    direction: "Middle",
    pitchType: "4-Seam",
    createdAt: now,
    ...overrides,
  };
}

function pitchEvent(id, practiceId, sessionId, pitcherId, outcome, overrides = {}) {
  const isSwing = ["Swing", "Whiff", "Foul", "Ball in play"].includes(outcome);
  return {
    id,
    practiceId,
    sessionId,
    pitcherId,
    pitchNumber: Number(id.replace(/\D/g, "")) || 1,
    pitchType: "4-Seam",
    outcome,
    isStrike: outcome !== "Ball" && outcome !== "HBP",
    isSwing,
    isZone: outcome !== "Ball",
    isWhiff: outcome === "Whiff",
    isCalledStrike: outcome === "Called Strike",
    isBallInPlay: outcome === "Ball in play",
    createdAt: now,
    ...overrides,
  };
}

function gameEvent(id, gameId, batterId, pitcherId, pitchOutcome, ballInPlayOutcome) {
  return {
    id,
    gameId,
    inning: 1,
    half: "Top",
    batterId,
    pitcherId,
    pitchType: "4-Seam",
    pitchOutcome,
    ballInPlayOutcome,
    velocity: 83,
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

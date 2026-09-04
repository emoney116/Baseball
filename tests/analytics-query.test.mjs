import assert from "node:assert/strict";
import test from "node:test";
import {
  executeAnalyticsQuery,
  runAskClubhouseQuestion,
} from "../app/lib/analyticsQuery.ts";
import {
  analyticsSourcesForDomain,
  analyticsViewsFor,
  ANALYTICS_METRICS,
  defaultAnalyticsMetricIds,
  serializeAnalyticsContext,
} from "../app/lib/analyticsCatalog.ts";
import { buildAnalyticsInsights } from "../app/lib/analyticsInsights.ts";

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
    hittingEvent("he-5", "practice-aug-19", "hit-2", "p-jacob", "Ball in play", { contactResult: "Fly ball", contactQuality: "Barrel", exitVelocityMph: 95, pitchType: "Slider" }),
    hittingEvent("he-live-1", "practice-aug-19", "live-hit-1", "p-jacob", "Ball in play", { contactResult: "Line drive", contactQuality: "Hard", exitVelocityMph: 92, isLiveBp: true }),
    hittingEvent("he-mylo-1", "practice-aug-19", "hit-2", "p-mylo", "Ball in play", { contactResult: "Line drive", contactQuality: "Hard", exitVelocityMph: 88, pitchType: "Slider" }),
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

test("hitting session and pitch-type filters scope practice analytics", () => {
  const sessionFiltered = executeAnalyticsQuery(baseData, {
    ...query("hitting", "practice"),
    eventIds: ["hit-2"],
  });
  const pitchFiltered = executeAnalyticsQuery(baseData, {
    ...query("hitting", "practice"),
    mode: "situational",
    filters: { pitchTypes: ["Slider"] },
  });

  assert.equal(row(sessionFiltered, "p-jacob").cells.opportunities.display, "1");
  assert.equal(row(sessionFiltered, "p-mylo").cells.opportunities.display, "1");
  assert.equal(sessionFiltered.teamTotals.cells.swings.display, "2");
  assert.equal(pitchFiltered.filterDefinitions.some((definition) => definition.id === "pitchTypes"), true);
  assert.equal(row(pitchFiltered, "p-jacob").cells.opportunities.display, "1");
  assert.equal(row(pitchFiltered, "p-mylo").cells.opportunities.display, "1");
  assert.equal(pitchFiltered.teamTotals.cells.swings.display, "2");
});

test("hitting spray visuals use the same already-filtered events as the box score", () => {
  const data = {
    ...baseData,
    hittingEvents: baseData.hittingEvents.map((event, index) => event.action === "Ball in play"
      ? { ...event, fieldLocation: { x: 0.3 + index * 0.06, y: 0.45 } }
      : event),
  };
  const result = executeAnalyticsQuery(data, {
    ...query("hitting", "practice"),
    mode: "situational",
    filters: { pitchTypes: ["Slider"] },
  });

  assert.equal(result.sprayChart?.ballsInPlay, 2);
  assert.equal(result.sprayChart?.trackedLocations, 2);
  assert.deepEqual(result.sprayChart?.points.map((point) => point.id).sort(), ["he-5", "he-mylo-1"]);
});

test("player-scoped visual queries retain only that player's filtered spray and pitch-location events", () => {
  const data = {
    ...baseData,
    hittingEvents: baseData.hittingEvents.map((event, index) => ({
      ...event,
      fieldLocation: event.action === "Ball in play" ? { x: 0.25 + (index * 0.07), y: 0.44 } : undefined,
      pitchLocation: { x: 0.3 + (index * 0.05), y: 0.5 },
    })),
  };
  const result = executeAnalyticsQuery(data, {
    ...query("hitting", "practice"),
    playerIds: ["p-jacob"],
  });

  assert.deepEqual(result.sprayChart?.points.map((point) => point.id).sort(), ["he-3", "he-4", "he-5"]);
  assert.deepEqual(result.pitchLocationChart?.points.map((point) => point.id).sort(), ["he-1", "he-2", "he-3", "he-4", "he-5"]);
  assert.equal(result.pitchLocationChart?.qualifyingEvents, 5);
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

test("pitching query calculates strike and zone rates with game source support", () => {
  const result = executeAnalyticsQuery(baseData, query("pitching", "all"));
  const mylo = row(result, "p-mylo");

  assert.equal(mylo.cells.pitches.display, "7");
  assert.equal(mylo.cells.strikePct.display, "71%");
  assert.equal(mylo.cells.zonePct.display, "75%");
  assert.equal(result.columns.some((column) => column.metricId === "inningsPitched"), true);
  assert.equal(result.columns.some((column) => column.metricId === "pitches"), true);
  assert.equal(mylo.cells.avgPitchVelo.display, "83.0");
  assert.equal(mylo.cells.ballPct.display, "29%");
  assert.equal(mylo.cells.calledStrikePct.display, "29%");
  assert.equal(mylo.cells.medianPitchVelo.display, "83.0");
});

test("defense query uses worked position, structured filters, and weighted team rates", () => {
  const data = {
    ...baseData,
    defenseSessions: [
      defenseSession("def-ss", "practice-aug-17", "p-jacob", "Infield", { drillContext: "Backhands", positionWorked: "SS" }),
      defenseSession("def-cf", "practice-aug-17", "p-mylo", "Outfield", { drillContext: "Outfield Routes", positionWorked: "CF" }),
    ],
    defenseEvents: [
      ...Array.from({ length: 8 }, (_, index) => defenseEvent(`de-j-${index + 1}`, "practice-aug-17", "def-ss", "p-jacob", {
        outcome: index === 0 ? "Error" : "Clean",
        result: index === 0 ? "Error" : "Clean",
        throwResult: index === 1 ? "No Throw" : "Accurate",
      })),
      defenseEvent("de-j-forehand", "practice-aug-17", "def-ss", "p-jacob", { repSubtype: "Forehand" }),
      defenseEvent("de-mylo-1", "practice-aug-17", "def-cf", "p-mylo", {
        station: "Outfield",
        positionWorked: "CF",
        drillContext: "Outfield Routes",
        repType: "Fly Ball",
        repSubtype: "Going Back",
      }),
    ],
  };

  const result = executeAnalyticsQuery(data, {
    ...query("defense", "practice"),
    mode: "situational",
    filters: {
      defensePositions: ["SS"],
      defenseDrills: ["Backhands"],
      defenseRepSubtypes: ["Backhand"],
    },
    sort: { metricId: "cleanPct", direction: "desc" },
  });
  const jacob = row(result, "p-jacob");

  assert.equal(result.filterDefinitions.some((definition) => definition.id === "defensePositions"), true);
  assert.deepEqual(result.columns.map((column) => column.metricId), ["positionWorked", "reps", "cleanReps", "errors", "fieldingErrors", "throwingErrors", "decisionErrors", "missedReps", "errorPct", "cleanPct", "throwAcc", "throws", "accurateThrows", "inaccurateThrows", "greatPlays"]);
  assert.equal(jacob.cells.positionWorked.display, "SS");
  assert.equal(jacob.cells.reps.display, "8");
  assert.equal(jacob.cells.cleanReps.display, "7");
  assert.equal(jacob.cells.errors.display, "1");
  assert.equal(jacob.cells.cleanPct.display, "88%");
  assert.equal(jacob.cells.cleanPct.sample, "7/8");
  assert.equal(jacob.cells.throwAcc.display, "100%");
  assert.equal(jacob.cells.throwAcc.sample, "7/7");
  assert.equal(row(result, "p-mylo").cells.reps.display, "—");
  assert.equal(result.teamTotals.cells.reps.display, "8");
  assert.equal(result.teamTotals.cells.cleanPct.display, "88%");
});

test("game defense source does not reuse practice defensive reps", () => {
  const data = {
    ...baseData,
    defenseSessions: [defenseSession("def-ss", "practice-aug-17", "p-jacob", "Infield")],
    defenseEvents: [defenseEvent("de-j-1", "practice-aug-17", "def-ss", "p-jacob")],
  };
  const result = executeAnalyticsQuery(data, query("defense", "games"));

  assert.equal(row(result, "p-jacob").cells.reps.display, "—");
  assert.equal(result.teamTotals.cells.reps.display, "—");
  assert.equal(result.warnings.some((warning) => warning.includes("future tracking gaps")), true);
});

test("game hitting source exposes the expanded completed-plate-appearance catalog", () => {
  const result = executeAnalyticsQuery(baseData, query("hitting", "games"));
  const labels = result.columns.map((column) => column.label);
  const jacob = row(result, "p-jacob");

  assert.equal(labels.includes("GP"), true);
  assert.equal(labels.includes("RBI"), true);
  assert.equal(labels.includes("SB%"), true);
  assert.equal(labels.includes("K%"), true);
  assert.equal(labels.includes("TB/PA"), true);
  assert.equal(jacob.cells.pa.display, "—");
  assert.equal(jacob.cells.hits.display, "2");
  assert.equal(jacob.cells.singles.display, "1");
  assert.equal(jacob.cells.totalBases.display, "3");
  assert.equal(jacob.cells.avg.display, "1.000");
  assert.equal(jacob.cells.xbhPct.display, "50%");
  assert.equal(jacob.cells.tbPerAb.display, "1.500");
  assert.match(result.warnings.join(" "), /completed logged plate appearances/);
});

test("every exposed metric has canonical key, short label, full name, formula, and source availability", () => {
  assert.equal(ANALYTICS_METRICS.length > 150, true);
  for (const metric of ANALYTICS_METRICS) {
    assert.match(metric.key, /^[a-z][a-z0-9_]*$/);
    assert.equal(Boolean(metric.label), true);
    assert.equal(Boolean(metric.fullName), true);
    assert.notEqual(metric.fullName, metric.label);
    assert.equal(Boolean(metric.definition), true);
    assert.equal(metric.supportedSources.length > 0, true);
    assert.equal(metric.presetGroups.length > 0, true, `${metric.id} is not assigned to a preset`);
  }
  assert.deepEqual(
    ["three_pitch_out_rate", "pitches_per_batter_faced", "exit_velocity_90th_percentile"].map((key) => ANALYTICS_METRICS.find((metric) => metric.key === key)?.fullName),
    ["Three-Pitch Out Rate", "Pitches per Batter Faced", "90th Percentile Exit Velocity"],
  );
});

test("game hitting adds completed plate-appearance metrics without inventing missing outcomes", () => {
  const data = {
    ...baseData,
    gameEvents: [
      { ...baseData.gameEvents[0], plateAppearanceId: "pa-1" },
      { ...baseData.gameEvents[1], plateAppearanceId: "pa-2" },
      { ...baseData.gameEvents[2], id: "ge-4", batterId: "p-jacob", plateAppearanceId: "pa-3" },
    ],
    plateAppearances: [
      plateAppearance("pa-1", "p-jacob", "Single"),
      plateAppearance("pa-2", "p-jacob", "Double"),
      plateAppearance("pa-3", "p-jacob", "Walk"),
    ],
  };
  const jacob = row(executeAnalyticsQuery(data, query("hitting", "games")), "p-jacob");

  assert.equal(jacob.cells.pa.display, "3");
  assert.equal(jacob.cells.ab.display, "2");
  assert.equal(jacob.cells.walks.display, "1");
  assert.equal(jacob.cells.obp.display, "1.000");
  assert.equal(jacob.cells.ops.display, "2.500");
});

test("Insights situational rows reuse the canonical Game query and preserve their deep-link filters", () => {
  const gameEvents = gamePa("risp", 1, 1, 1, ["In Play"], [{ balls: 0, strikes: 0 }], "Single")
    .map((event) => ({ ...event, runnersBefore: { second: "p-jackson" }, pitcherId: "p-mylo" }));
  const data = { ...baseData, gameEvents, plateAppearances: [] };
  const model = buildAnalyticsInsights(data, query("hitting", "games"), "hitting", { today: "2026-08-20" });
  const risp = model.sections.find((section) => section.id === "situational-hitting")?.rows.find((item) => item.id === "risp");

  assert.ok(risp);
  assert.equal(risp.primary.display, "1.000");
  assert.deepEqual(risp.drillQuery?.filters?.runnerStates, ["risp"]);
  const direct = executeAnalyticsQuery(data, { ...query("hitting", "games"), metrics: ["avg", "ops", "pa"], filters: { runnerStates: ["risp"] } });
  assert.equal(risp.primary.display, direct.teamTotals.cells.avg.display);
});

test("Insights changes meaningfully for Practice and never renders Game situations there", () => {
  const model = buildAnalyticsInsights(baseData, query("hitting", "practice"), "hitting", { today: "2026-08-20" });
  assert.equal(model.sections.some((section) => section.id === "situational-hitting"), false);
  assert.equal(model.sections.some((section) => section.id === "practice-contact"), true);
});

test("Insights 30-day trends compare the immediately preceding equal Game window", () => {
  const currentGame = { ...baseData.games[0], id: "game-current", date: "2026-08-15" };
  const previousGame = { ...baseData.games[0], id: "game-previous", date: "2026-07-10" };
  const currentEvents = gamePa("current", 1, 0, 0, ["In Play"], [{ balls: 0, strikes: 0 }], "Single")
    .map((event) => ({ ...event, gameId: currentGame.id }));
  const previousEvents = gamePa("previous", 1, 0, 1, ["In Play"], [{ balls: 0, strikes: 0 }], "Ground Out")
    .map((event) => ({ ...event, gameId: previousGame.id }));
  const data = { ...baseData, games: [currentGame, previousGame], gameEvents: [...currentEvents, ...previousEvents], plateAppearances: [] };
  const model = buildAnalyticsInsights(data, { ...query("hitting", "games"), timeRange: "30d" }, "hitting", { today: "2026-08-20" });
  const ops = model.sections.find((section) => section.id === "offense-overview")?.rows.find((row) => row.primaryMetricId === "ops");

  assert.ok(ops?.trend);
  assert.equal(ops.trend.direction, "up");
  assert.equal(ops.trend.favorable, true);
  assert.equal(ops.trend.display, "+2.000");
});

test("Insights pitch-efficiency rows match the canonical pitching totals", () => {
  const gameEvents = [
    ...gamePa("a", 1, 0, 1, ["Called Strike", "Foul", "Swinging Strike"], [{ balls: 0, strikes: 0 }, { balls: 0, strikes: 1 }, { balls: 0, strikes: 2 }]),
    ...gamePa("b", 1, 1, 2, ["Ball", "Called Strike", "Foul", "Ground Out"], [{ balls: 0, strikes: 0 }, { balls: 1, strikes: 0 }, { balls: 1, strikes: 1 }, { balls: 1, strikes: 2 }], "Ground Out"),
    ...gamePa("c", 1, 2, 3, ["Ball", "Ground Out"], [{ balls: 0, strikes: 0 }, { balls: 1, strikes: 0 }], "Ground Out"),
  ];
  const data = { ...baseData, gameEvents, plateAppearances: [] };
  const model = buildAnalyticsInsights(data, query("pitching", "games"), "pitching", { today: "2026-08-20" });
  const threePitch = model.sections.find((section) => section.id === "inning-efficiency")?.rows.find((item) => item.primaryMetricId === "threePitchOutRate");
  const direct = executeAnalyticsQuery(data, { ...query("pitching", "games"), metrics: ["threePitchOutRate"] });

  assert.ok(threePitch);
  assert.equal(threePitch.primary.display, direct.teamTotals.cells.threePitchOutRate.display);
});

test("game hitting fixture calculates a complete traditional line from confirmed PAs", () => {
  const outcomes = ["Single", "Double", "Triple", "Home run", "Walk", "HBP", "Strikeout swinging", "Sac Fly", "Ground Out", "Line Out"];
  const gameEvents = outcomes.map((outcome, index) => gamePaEvent(`hit-${index + 1}`, "game-1", "p-jacob", "p-mylo", index + 1, outcome, index === 7 ? "Sac Fly" : outcome === "Ground Out" ? "Ground Out" : outcome === "Line Out" ? "Line Out" : outcome === "Single" || outcome === "Double" || outcome === "Triple" ? outcome : outcome === "Home run" ? "Home Run" : undefined));
  const data = {
    ...baseData,
    gameEvents,
    plateAppearances: outcomes.map((outcome, index) => plateAppearance(`hit-${index + 1}`, "p-jacob", outcome === "Sac Fly" ? "Flyout" : outcome)),
  };
  const jacob = row(executeAnalyticsQuery(data, query("hitting", "games")), "p-jacob");

  assert.equal(jacob.cells.pa.display, "10");
  assert.equal(jacob.cells.ab.display, "7");
  assert.equal(jacob.cells.hits.display, "4");
  assert.equal(jacob.cells.avg.display, ".571");
  assert.equal(jacob.cells.obp.display, ".600");
  assert.equal(jacob.cells.slg.display, "1.429");
  assert.equal(jacob.cells.ops.display, "2.029");
  assert.equal(jacob.cells.iso.display, ".857");
  assert.equal(jacob.cells.babip.display, ".500");
  assert.equal(jacob.cells.strikeoutPct.display, "10%");
  assert.equal(jacob.cells.walkPct.display, "10%");
});

test("game hitting derives a completed batting line and pitches per PA from confirmed pitch sequences", () => {
  const gameEvents = [
    ...gamePa("a", 1, 0, 0, ["In Play"], [{ balls: 0, strikes: 0 }], "Single"),
    ...gamePa("b", 1, 0, 0, ["Ball", "Ball", "Ball", "Ball"], [{ balls: 0, strikes: 0 }, { balls: 1, strikes: 0 }, { balls: 2, strikes: 0 }, { balls: 3, strikes: 0 }]),
    ...gamePa("c", 1, 0, 1, ["Called Strike", "Foul", "Swinging Strike"], [{ balls: 0, strikes: 0 }, { balls: 0, strikes: 1 }, { balls: 0, strikes: 2 }]),
    ...gamePa("d", 1, 1, 2, ["Ball", "In Play"], [{ balls: 0, strikes: 0 }, { balls: 1, strikes: 0 }], "Ground Out"),
  ];
  const data = { ...baseData, gameEvents, plateAppearances: [] };
  const jacob = row(executeAnalyticsQuery(data, { ...query("hitting", "games"), metrics: ["pa", "ab", "hits", "avg", "obp", "pitchesPerPlateAppearance"] }), "p-jacob");

  assert.equal(jacob.cells.pa.display, "4");
  assert.equal(jacob.cells.ab.display, "3");
  assert.equal(jacob.cells.hits.display, "1");
  assert.equal(jacob.cells.avg.display, ".333");
  assert.equal(jacob.cells.obp.display, ".500");
  assert.equal(jacob.cells.pitchesPerPlateAppearance.display, "2.50");
});

test("baserunning exposes attempts separately from successful steals", () => {
  const data = {
    ...baseData,
    gameEvents: [
      { ...baseData.gameEvents[0], runnerId: "p-jacob", runnerAction: "Stolen Base" },
      { ...baseData.gameEvents[1], runnerId: "p-jacob", runnerAction: "Caught Stealing" },
    ],
  };
  const jacob = row(executeAnalyticsQuery(data, { ...query("hitting", "games"), metrics: ["stolenBases", "caughtStealing", "stolenBaseAttempts", "stolenBasePct"] }), "p-jacob");

  assert.equal(jacob.cells.stolenBases.display, "1");
  assert.equal(jacob.cells.caughtStealing.display, "1");
  assert.equal(jacob.cells.stolenBaseAttempts.display, "2");
  assert.equal(jacob.cells.stolenBasePct.display, "50%");
});

test("pitching contact allowed uses direct classified pitch-event primitives", () => {
  const data = {
    ...baseData,
    pitchEvents: [
      ...baseData.pitchEvents.filter((event) => event.sessionId === "pitching-1"),
      pitchEvent("pe-bip-1", "practice-aug-17", "pitching-1", "p-mylo", "Ball in play", { battedBall: "Ground ball", contactQuality: "Hard contact" }),
      pitchEvent("pe-bip-2", "practice-aug-17", "pitching-1", "p-mylo", "Ball in play", { battedBall: "Line drive", contactQuality: "Medium contact" }),
      pitchEvent("pe-bip-3", "practice-aug-17", "pitching-1", "p-mylo", "Ball in play", { battedBall: "Fly ball", contactQuality: "Weak contact" }),
      pitchEvent("pe-bip-4", "practice-aug-17", "pitching-1", "p-mylo", "Ball in play", { battedBall: "Pop up", contactQuality: "Medium contact" }),
    ],
  };
  const mylo = row(executeAnalyticsQuery(data, { ...query("pitching", "practice"), metrics: ["ballsInPlayAllowed", "groundBallsAllowed", "lineDrivesAllowed", "flyBallsAllowed", "popUpsAllowed", "groundBallPctAllowed", "airPctAllowed", "hardContactAllowed", "hardContactAllowedPct", "softContactAllowedPct"] }), "p-mylo");

  assert.equal(mylo.cells.ballsInPlayAllowed.display, "4");
  assert.equal(mylo.cells.groundBallsAllowed.display, "1");
  assert.equal(mylo.cells.lineDrivesAllowed.display, "1");
  assert.equal(mylo.cells.flyBallsAllowed.display, "1");
  assert.equal(mylo.cells.popUpsAllowed.display, "1");
  assert.equal(mylo.cells.groundBallPctAllowed.display, "25%");
  assert.equal(mylo.cells.airPctAllowed.display, "75%");
  assert.equal(mylo.cells.hardContactAllowed.display, "1");
  assert.equal(mylo.cells.hardContactAllowedPct.display, "25%");
  assert.equal(mylo.cells.softContactAllowedPct.display, "25%");
});

test("pitching efficiency fixture uses documented PA and inning denominators", () => {
  const gameEvents = [
    ...gamePa("a", 1, 0, 1, ["Called Strike", "Foul", "Swinging Strike"], [{ balls: 0, strikes: 0 }, { balls: 0, strikes: 1 }, { balls: 0, strikes: 2 }]),
    ...gamePa("b", 1, 1, 2, ["Called Strike", "Ball", "Foul", "In Play"], [{ balls: 0, strikes: 0 }, { balls: 0, strikes: 1 }, { balls: 1, strikes: 1 }, { balls: 1, strikes: 1 }], "Ground Out"),
    ...gamePa("c", 1, 2, 3, ["Ball", "Ball", "Called Strike", "Foul", "Ball", "In Play"], [{ balls: 0, strikes: 0 }, { balls: 1, strikes: 0 }, { balls: 2, strikes: 0 }, { balls: 2, strikes: 1 }, { balls: 2, strikes: 2 }, { balls: 3, strikes: 2 }], "Fly Out"),
    ...gamePa("d", 2, 0, 0, ["Ball", "Ball", "Ball", "Ball"], [{ balls: 0, strikes: 0 }, { balls: 1, strikes: 0 }, { balls: 2, strikes: 0 }, { balls: 3, strikes: 0 }]),
    ...gamePa("e", 2, 0, 1, ["Ball", "Called Strike", "Ball", "In Play"], [{ balls: 0, strikes: 0 }, { balls: 1, strikes: 0 }, { balls: 1, strikes: 1 }, { balls: 2, strikes: 1 }], "Ground Out"),
    ...gamePa("f", 2, 1, 2, ["Called Strike", "Ball", "Foul", "In Play"], [{ balls: 0, strikes: 0 }, { balls: 0, strikes: 1 }, { balls: 1, strikes: 1 }, { balls: 1, strikes: 1 }], "Fly Out"),
    ...gamePa("g", 2, 2, 3, ["Called Strike", "Ball", "In Play"], [{ balls: 0, strikes: 0 }, { balls: 0, strikes: 1 }, { balls: 1, strikes: 1 }], "Pop Out"),
  ];
  const data = {
    ...baseData,
    games: [{ ...baseData.games[0], startingPitcherId: "p-mylo" }],
    gameEvents,
    plateAppearances: [],
  };
  const mylo = row(executeAnalyticsQuery(data, { ...query("pitching", "games"), metrics: ["inningsPitched", "battersFaced", "pitches", "pitchesPerInning", "threePitchOuts", "threePitchOutRate", "fourPitchOuts", "fourPitchOutRate", "thirteenPitchInnings", "thirteenPitchInningRate", "fifteenPitchInnings", "fifteenPitchInningRate", "oneTwoThreeInnings", "oneTwoThreeInningRate", "leadoffOuts", "leadoffOutRate", "scorelessInningRate", "twoStrikeFinishRate", "putawayRate"] }), "p-mylo");

  assert.equal(mylo.cells.inningsPitched.display, "2.0");
  assert.equal(mylo.cells.battersFaced.display, "7");
  assert.equal(mylo.cells.pitches.display, "28");
  assert.equal(mylo.cells.pitchesPerInning.display, "14.00");
  assert.equal(mylo.cells.threePitchOuts.display, "2");
  assert.equal(mylo.cells.threePitchOutRate.display, "33%");
  assert.equal(mylo.cells.fourPitchOuts.display, "3");
  assert.equal(mylo.cells.fourPitchOutRate.display, "50%");
  assert.equal(mylo.cells.thirteenPitchInnings.display, "1");
  assert.equal(mylo.cells.thirteenPitchInningRate.display, "50%");
  assert.equal(mylo.cells.fifteenPitchInnings.display, "2");
  assert.equal(mylo.cells.oneTwoThreeInnings.display, "1");
  assert.equal(mylo.cells.oneTwoThreeInningRate.display, "50%");
  assert.equal(mylo.cells.leadoffOutRate.display, "50%");
  assert.equal(mylo.cells.scorelessInningRate.display, "100%");
  assert.equal(mylo.cells.twoStrikeFinishRate.display, "100%");
  assert.equal(mylo.cells.putawayRate.display, "50%");
});

test("pitching innings display outs in baseball notation instead of decimal innings", () => {
  const gameEvents = Array.from({ length: 16 }, (_, index) => gamePa(
    String.fromCharCode(97 + index),
    Math.floor(index / 3) + 1,
    index % 3,
    index % 3 === 2 ? 0 : (index % 3) + 1,
    ["In Play"],
    [{ balls: 0, strikes: 0 }],
    "Ground Out",
  )[0]);
  const data = { ...baseData, gameEvents, plateAppearances: [] };
  const mylo = row(executeAnalyticsQuery(data, { ...query("pitching", "games"), metrics: ["inningsPitched"] }), "p-mylo");

  assert.equal(mylo.cells.inningsPitched.display, "5.1");
});

test("game batted-ball metrics use confirmed scored contact types", () => {
  const data = {
    ...baseData,
    gameEvents: [
      { ...baseData.gameEvents[0], contactType: "Ground Ball" },
      { ...baseData.gameEvents[1], contactType: "Line Drive" },
      { ...baseData.gameEvents[2], batterId: "p-jacob", pitchOutcome: "In Play", ballInPlayOutcome: "Fly Out", contactType: "Fly Ball" },
      { ...baseData.gameEvents[2], id: "ge-4", batterId: "p-jacob", pitchOutcome: "In Play", ballInPlayOutcome: "Pop Out", contactType: "Pop Up" },
    ],
  };
  const jacob = row(executeAnalyticsQuery(data, { ...query("hitting", "games"), metrics: ["groundBalls", "lineDrives", "flyBalls", "popUps", "groundBallPct", "lineDrivePct", "flyBallPct", "popUpPct", "airPct"] }), "p-jacob");

  assert.equal(jacob.cells.groundBalls.display, "1");
  assert.equal(jacob.cells.lineDrives.display, "1");
  assert.equal(jacob.cells.flyBalls.display, "1");
  assert.equal(jacob.cells.popUps.display, "1");
  assert.equal(jacob.cells.groundBallPct.display, "25%");
  assert.equal(jacob.cells.airPct.display, "75%");
});

test("game batted-ball rates stay unavailable when contact types are not scored", () => {
  const data = {
    ...baseData,
    gameEvents: [
      { ...baseData.gameEvents[0], ballInPlayOutcome: "Single", contactType: undefined },
      { ...baseData.gameEvents[1], ballInPlayOutcome: "Ground Out", contactType: undefined },
    ],
  };
  const jacob = row(executeAnalyticsQuery(data, { ...query("hitting", "games"), metrics: ["groundBalls", "groundBallPct", "airPct"] }), "p-jacob");

  assert.equal(jacob.cells.groundBalls.display, "—");
  assert.equal(jacob.cells.groundBallPct.display, "—");
  assert.equal(jacob.cells.airPct.display, "—");
});

test("defense fixture calculates clean, error, and throw accuracy rates from raw reps", () => {
  const data = {
    ...baseData,
    defenseSessions: [defenseSession("def-fixture", "practice-aug-17", "p-jacob", "Infield")],
    defenseEvents: [
      defenseEvent("def-1", "practice-aug-17", "def-fixture", "p-jacob", { outcome: "Clean", result: "Clean", throwResult: "Accurate" }),
      defenseEvent("def-2", "practice-aug-17", "def-fixture", "p-jacob", { outcome: "Clean", result: "Clean", throwResult: "Inaccurate" }),
      defenseEvent("def-3", "practice-aug-17", "def-fixture", "p-jacob", { outcome: "Error", result: "Error", errorType: "Fielding", throwResult: "No Throw" }),
      defenseEvent("def-4", "practice-aug-17", "def-fixture", "p-jacob", { outcome: "Clean", result: "Clean", throwResult: "No Throw" }),
    ],
  };
  const jacob = row(executeAnalyticsQuery(data, { ...query("defense", "practice"), metrics: ["reps", "cleanPct", "errors", "errorPct", "throws", "accurateThrows", "throwAcc"] }), "p-jacob");

  assert.equal(jacob.cells.reps.display, "4");
  assert.equal(jacob.cells.cleanPct.display, "75%");
  assert.equal(jacob.cells.errorPct.display, "25%");
  assert.equal(jacob.cells.throws.display, "2");
  assert.equal(jacob.cells.accurateThrows.display, "1");
  assert.equal(jacob.cells.throwAcc.display, "50%");
});

test("field-source selections combine compatible hitting data without blending metrics", () => {
  const result = executeAnalyticsQuery(baseData, {
    ...query("hitting", "all"),
    fieldSources: ["practice", "games"],
    metrics: ["opportunities", "hits"],
  });
  const jacob = row(result, "p-jacob");

  assert.deepEqual(result.query.fieldSources, ["games", "practice"]);
  assert.deepEqual(result.columns.map((column) => column.metricId), ["opportunities", "hits"]);
  assert.equal(jacob.cells.opportunities.display, "7");
  assert.equal(jacob.cells.hits.display, "2");
  assert.equal(result.availableEvents.some((event) => event.source === "games"), true);
  assert.equal(result.availableEvents.some((event) => event.source === "practice"), true);
});

test("expanded tracked metrics preserve source boundaries and qualification evidence", () => {
  const metricIds = defaultAnalyticsMetricIds("hitting", "practice");
  const result = executeAnalyticsQuery(baseData, { ...query("hitting", "practice"), metrics: metricIds });
  const jacob = row(result, "p-jacob");

  assert.deepEqual(result.columns.map((column) => column.metricId), metricIds);
  assert.equal(jacob.cells.bipPct.display, "60%");
  assert.equal(jacob.cells.foulPct.display, "20%");
  assert.equal(jacob.cells.groundBalls.display, "1");
  assert.equal(jacob.cells.lineDrives.display, "1");
  assert.equal(jacob.cells.gbFbRatio.display, "1.000");
  assert.equal(jacob.cells.medianEv.display, "90.0");
  assert.equal(jacob.cells.ev90.kind, "insufficient-sample");
  assert.equal(result.availableColumns.some((column) => column.metricId === "avg"), false);
});

test("game spray visuals adapt historical game field coordinates without changing query scope", () => {
  const data = {
    ...baseData,
    gameEvents: baseData.gameEvents.map((event, index) => event.ballInPlayOutcome
      ? { ...event, fieldLocation: { x: index ? 0.72 : 0.28, y: 0.61 } }
      : event),
  };
  const result = executeAnalyticsQuery(data, query("hitting", "games"));

  assert.equal(result.sprayChart?.ballsInPlay, 2);
  assert.equal(result.sprayChart?.trackedLocations, 2);
  assert.ok(result.sprayChart?.points.every((point) => point.y > 0 && point.y < 1));
});

test("game pitch-location charts retain hit and out outcomes for batting average", () => {
  const data = {
    ...baseData,
    gameEvents: baseData.gameEvents.map((event, index) => ({
      ...event,
      ballInPlayOutcome: index === 1 ? "Ground Out" : event.ballInPlayOutcome,
      location: { x: index === 1 ? 0.65 : 0.35, y: 0.5 },
    })),
  };

  const hitting = executeAnalyticsQuery(data, query("hitting", "games"));
  const pitching = executeAnalyticsQuery(data, query("pitching", "games"));

  assert.deepEqual(hitting.pitchLocationChart?.points.slice(0, 2).map((point) => point.chartOutcome), ["hit", "out"]);
  assert.deepEqual(pitching.pitchLocationChart?.points.slice(0, 2).map((point) => point.chartOutcome), ["hit", "out"]);
  assert.equal(pitching.pitchLocationChart?.points.at(-1)?.chartOutcome, undefined);
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

test("unified Analytics applies composed filters without a situational mode", () => {
  const result = executeAnalyticsQuery(baseData, {
    ...query("hitting", "practice"),
    mode: "box-score",
    filters: { pitchTypes: ["Slider"], pitchVelocityMin: 80 },
  });

  assert.equal(result.filterDefinitions.some((definition) => definition.id === "pitchTypes"), true);
  assert.equal(result.teamTotals.cells.opportunities.display, "—");
});

test("game filters compose count, velocity, location, score, outs, runners, and opponent", () => {
  const qualifying = {
    ...baseData.gameEvents[0],
    velocity: 88,
    countBefore: { balls: 1, strikes: 2 },
    location: { x: 0.5, y: 0.5 },
    outsBefore: 2,
    metrolinaRunsBefore: 1,
    opponentRunsBefore: 3,
    runnersBefore: { second: "p-jackson" },
  };
  const data = { ...baseData, gameEvents: [qualifying, baseData.gameEvents[1]] };
  const result = executeAnalyticsQuery(data, {
    ...query("hitting", "games"),
    filters: {
      pitchTypes: ["4-Seam"],
      pitchVelocityMin: 85,
      pitchLocationRegions: ["middle"],
      exactCounts: ["1-2"],
      gameStates: ["losing"],
      outs: ["2"],
      runnerStates: ["risp"],
      opponents: ["Charlotte Christian"],
      homeAway: ["Home"],
    },
  });

  assert.equal(result.teamTotals.cells.trackedBip.display, "1");
  assert.equal(row(result, "p-jacob").cells.hits.display, "1");
});

test("pitching location filters use pitcher-relative arm and glove side", () => {
  const pitches = [
    pitchEvent("arm-side", "practice-aug-17", "pitching-1", "p-mylo", "Called Strike", { location: { x: 0.8, y: 0.5 } }),
    pitchEvent("glove-side", "practice-aug-17", "pitching-1", "p-mylo", "Called Strike", { location: { x: 0.2, y: 0.5 } }),
  ];
  const data = { ...baseData, pitchEvents: pitches };
  const result = executeAnalyticsQuery(data, {
    ...query("pitching", "practice"),
    filters: { pitchLocationRegions: ["arm_side"] },
  });

  assert.equal(result.teamTotals.cells.pitches.display, "1");
  const locationFilter = result.filterDefinitions.find((definition) => definition.id === "pitchLocationRegions");
  assert.equal(locationFilter.options.some((option) => option.value === "arm_side"), true);
  assert.equal(locationFilter.options.some((option) => option.value === "away"), false);
});

test("hitting location filters preserve an individually selected canonical tile", () => {
  const data = {
    ...baseData,
    hittingEvents: [
      { ...baseData.hittingEvents[0], pitchLocation: { x: 0.7, y: 0.3, zoneId: "pitch_r2c4" } },
      { ...baseData.hittingEvents[1], pitchLocation: { x: 0.7, y: 0.5, zoneId: "pitch_r3c4" } },
    ],
  };
  const result = executeAnalyticsQuery(data, {
    ...query("hitting", "practice"),
    filters: { pitchLocationRegions: ["pitch_r2c4"] },
  });

  assert.equal(result.teamTotals.cells.opportunities.display, "1");
});

test("count and pitch-type views group the same bounded query output", () => {
  const gameEvents = [
    { ...baseData.gameEvents[0], countBefore: { balls: 0, strikes: 0 }, pitchType: "4-Seam" },
    { ...baseData.gameEvents[1], countBefore: { balls: 1, strikes: 2 }, pitchType: "Slider" },
    { ...baseData.gameEvents[2], countBefore: undefined, pitchType: undefined },
  ];
  const counts = executeAnalyticsQuery({ ...baseData, gameEvents }, { ...query("pitching", "games"), view: "counts" });
  const pitchTypes = executeAnalyticsQuery({ ...baseData, gameEvents }, { ...query("pitching", "games"), view: "pitch-types" });

  assert.deepEqual(counts.rows.map((item) => item.groupLabel), ["0-0", "1-2"]);
  assert.equal(counts.rows.every((item) => item.rowKind === "group"), true);
  assert.match(counts.warnings.join(" "), /2 of 3 qualifying events/);
  assert.deepEqual(pitchTypes.rows.map((item) => item.groupLabel).sort(), ["4-Seam", "Slider"]);
});

test("catalog hides irrelevant sources and views and serializes the active context", () => {
  assert.deepEqual(analyticsSourcesForDomain("defense"), ["practice", "all"]);
  assert.equal(analyticsViewsFor("hitting", "practice").some((view) => view.id === "game-state"), false);
  assert.equal(analyticsViewsFor("hitting", "games").some((view) => view.id === "game-state"), true);
  assert.deepEqual(defaultAnalyticsMetricIds("hitting", "games").slice(0, 4), ["pa", "ab", "hits", "avg"]);
  assert.deepEqual(defaultAnalyticsMetricIds("development", "all"), ["weightScore", "workouts", "workoutCompletionPct", "attendancePct", "practiceReps"]);

  const analyticsQuery = { ...query("hitting", "practice"), view: "pitch-types", filters: { pitchTypes: ["Slider"] } };
  const serialized = serializeAnalyticsContext(analyticsQuery, ["swings", "contactPct"]);
  assert.equal(serialized.view, "pitch-types");
  assert.deepEqual(serialized.filters.pitchTypes, ["Slider"]);
  assert.deepEqual(serialized.metrics, ["swings", "contactPct"]);

  const mixedContext = serializeAnalyticsContext({ ...analyticsQuery, source: "all", fieldSources: ["games", "practice"] }, ["opportunities", "hits"]);
  assert.deepEqual(mixedContext.fieldSources, ["games", "practice"]);
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

function defenseSession(id, practiceId, playerId, station, overrides = {}) {
  return {
    id,
    practiceId,
    playerId,
    station,
    drillContext: "Backhands",
    positionWorked: "SS",
    mode: "Drill",
    startedAt: now,
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
    direction: "Middle",
    pitchType: "4-Seam",
    createdAt: now,
    ...overrides,
  };
}

function defenseEvent(id, practiceId, sessionId, playerId, overrides = {}) {
  return {
    id,
    practiceId,
    sessionId,
    playerId,
    station: "Infield",
    eventNumber: Number(id.replace(/\D/g, "")) || 1,
    outcome: "Clean",
    positionWorked: "SS",
    drillContext: "Backhands",
    repType: "Ground Ball",
    repSubtype: "Backhand",
    result: "Clean",
    throwResult: "Accurate",
    createdAt: now,
    ...overrides,
  };
}

function pitchEvent(id, practiceId, sessionId, pitcherId, outcome, overrides = {}) {
  const isSwing = ["Swing", "Whiff", "Foul", "Ball in play"].includes(outcome);
  const location = outcome === "Ball"
    ? { x: 0.5, y: 0.1, zoneId: "pitch_r1c3", zoneLabel: "Up", isZone: false }
    : { x: 0.5, y: 0.5, zoneId: "pitch_r3c3", zoneLabel: "Middle", isZone: true };
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
    isZone: location.isZone,
    isWhiff: outcome === "Whiff",
    isCalledStrike: outcome === "Called Strike",
    isBallInPlay: outcome === "Ball in play",
    location,
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

function gamePaEvent(id, gameId, batterId, pitcherId, sequenceNumber, outcome, ballInPlayOutcome) {
  return {
    ...gameEvent(id, gameId, batterId, pitcherId, outcome === "Walk" ? "Ball" : outcome === "HBP" ? "HBP" : outcome.startsWith("Strikeout") ? "Swinging Strike" : "In Play", ballInPlayOutcome),
    plateAppearanceId: id,
    sequenceNumber,
    countBefore: outcome === "Walk" ? { balls: 3, strikes: 0 } : outcome.startsWith("Strikeout") ? { balls: 0, strikes: 2 } : { balls: 0, strikes: 0 },
  };
}

function gamePa(id, inning, outsBefore, outsAfter, outcomes, counts, ballInPlayOutcome) {
  const sequenceStart = Number(id.charCodeAt(0)) * 10;
  return outcomes.map((pitchOutcome, index) => ({
    ...gameEvent(`${id}-${index + 1}`, "game-1", "p-jacob", "p-mylo", pitchOutcome, index === outcomes.length - 1 ? ballInPlayOutcome : undefined),
    plateAppearanceId: id,
    sequenceNumber: sequenceStart + index,
    inning,
    countBefore: counts[index],
    outsBefore,
    outsAfter: index === outcomes.length - 1 ? outsAfter : outsBefore,
  }));
}

function plateAppearance(id, hitterId, outcome) {
  return {
    id,
    gameId: "game-1",
    pitcherId: "p-mylo",
    hitterId,
    startedAt: now,
    endedAt: now,
    outcome,
    balls: outcome === "Walk" ? 4 : 0,
    strikes: 0,
  };
}

import assert from "node:assert/strict";
import test from "node:test";
import { executeAnalyticsQuery } from "../app/lib/analyticsQuery.ts";
import { getAskClubhouseConfig } from "../app/lib/askClubhouse/config.ts";
import { buildAskClubhouseToolPlan } from "../app/lib/askClubhouse/tools.ts";
import { buildAskClubhouseVisuals } from "../app/lib/askClubhouse/visuals.ts";
import {
  buildDemoSeedFixture,
  demoCleanupTables,
  isAllowedDemoTarget,
  isDemoSeedActorAuthorized,
} from "../app/lib/demoDataSeed.ts";

const target = { organizationId: "org-1", teamId: "team-1", seasonId: "season-1" };
const roster = [
  player("p-jacob", "Jacob", "Seamon", "R", "R"),
  player("p-mylo", "Mylo", "White", "L", "L"),
  player("p-jackson", "Jackson", "Pierce", "R", "R"),
  player("p-andrew", "Andrew", "Peters", "L", "R"),
  player("p-ethan", "Ethan", "Brooks", "R", "R"),
];

test("demo seed access is limited to Super Users or active Metrolina admins", () => {
  assert.equal(isDemoSeedActorAuthorized({ superUser: true, profileRole: "PLAYER", organizationAdmin: false }), true);
  assert.equal(isDemoSeedActorAuthorized({ superUser: false, profileRole: "ADMIN", organizationAdmin: true }), true);
  assert.equal(isDemoSeedActorAuthorized({ superUser: false, profileRole: "ADMIN", organizationAdmin: false }), false);
  assert.equal(isDemoSeedActorAuthorized({ superUser: false, profileRole: "COACH", organizationAdmin: true }), false);
  assert.equal(isAllowedDemoTarget({ organizationSlug: "metrolina-christian-academy", teamName: "Metrolina Varsity", seasonName: "Fall 2026" }), true);
  assert.equal(isAllowedDemoTarget({ organizationSlug: "customer-org", teamName: "Customer Varsity", seasonName: "Fall 2026" }), false);
});

test("the v1 fixture is deterministic, fully marked, and cleanup is marker-scoped", () => {
  const first = buildFixture("run-v1-a");
  const second = buildFixture("run-v1-b");
  const counts = (fixture) => Object.fromEntries(Object.entries(fixture).map(([key, rows]) => [key, rows.length]));
  assert.deepEqual(counts(first), counts(second));
  const seededRows = Object.values(first).flat();
  assert.ok(seededRows.length > 100);
  assert.ok(seededRows.every((row) => row.demo_seed_run_id === "run-v1-a" && row.demo_metadata?.is_demo === true));
  const realRow = { id: "real-practice", demo_seed_run_id: null };
  const cleanupCandidates = [...seededRows, realRow].filter((row) => row.demo_seed_run_id === "run-v1-a");
  assert.equal(cleanupCandidates.includes(realRow), false);
  assert.deepEqual(demoCleanupTables().slice(0, 4), ["game_pitch_events", "plate_appearances", "game_lineups", "games"]);
  assert.equal(demoCleanupTables().includes("players"), false);
  assert.equal(demoCleanupTables().includes("player_team_memberships"), false);
});

test("domain-specific seeds retain their own source primitives", () => {
  let pitchIndex = 0;
  const pitchingOnly = buildDemoSeedFixture({ target, roster, dataset: "pitching", volume: "small", runId: "run-pitching", id: () => `pitch-${++pitchIndex}` });
  assert.ok(pitchingOnly.pitchEvents.length >= 18);
  assert.equal(pitchingOnly.hittingEvents.length, 0);
  assert.ok(pitchingOnly.pitchEvents.some((row) => row.pitch_type === "Slider" && row.context === "live_bp"));

  let weightIndex = 0;
  const weightOnly = buildDemoSeedFixture({ target, roster, dataset: "weight-room", volume: "small", runId: "run-weight", id: () => `weight-${++weightIndex}` });
  assert.equal(weightOnly.exercises.length, 1);
  assert.equal(weightOnly.workoutSets.length, weightOnly.workoutSessions.length);
  const jacobSets = weightOnly.workoutSets.filter((row) => row.player_id === "p-jacob");
  assert.ok(Number(jacobSets.at(-1)?.weight) > Number(jacobSets[0]?.weight));
});

test("seeded QA data answers canonical analytics and Ask Clubhouse questions without web search", () => {
  const data = appDataFromFixture(buildFixture("run-v1"));
  const hitting = executeAnalyticsQuery(data, query("hitting", "practice", { pitchTypes: ["Slider"] }));
  const jacob = hitting.rows.find((row) => row.player.id === "p-jacob");
  assert.equal(jacob?.cells.contactPct.display, "82%");
  assert.ok((jacob?.cells.avgEv.value ?? 0) > 80);
  assert.ok(hitting.rows.some((row) => row.sampleCount > 0));
  assert.ok(executeAnalyticsQuery(data, query("hitting", "live-bp", { pitchTypes: ["Slider"] })).rows.some((row) => row.sampleCount > 0));

  const pitching = executeAnalyticsQuery(data, query("pitching", "games"));
  const mylo = pitching.rows.find((row) => row.player.id === "p-mylo");
  assert.notEqual(mylo?.cells.threePitchOutRate.display, "—");
  assert.notEqual(mylo?.cells.thirteenPitchInningRate.display, "—");

  const config = getAskClubhouseConfig({});
  const visualPlan = buildAskClubhouseToolPlan(data, "Show Jacob's slider spray chart", undefined, config);
  const visuals = buildAskClubhouseVisuals({ data, message: "Show Jacob's slider spray chart", plan: visualPlan });
  assert.equal(visualPlan.queryPlan?.filters.pitchTypes?.[0], "Slider");
  assert.ok(visuals.some((visual) => visual.type === "spray_chart"));

  const diagnosisPlan = buildAskClubhouseToolPlan(data, "What can Jacob do to hit sliders better?", undefined, config);
  assert.equal(diagnosisPlan.status, "completed");
  assert.equal(diagnosisPlan.diagnosis?.playerId, "p-jacob");
  assert.ok((diagnosisPlan.diagnosis?.trackedEvents ?? 0) >= 12);
});

function buildFixture(runId) {
  let index = 0;
  return buildDemoSeedFixture({ target, roster, dataset: "full", volume: "small", runId, id: () => `demo-${++index}` });
}

function appDataFromFixture(fixture) {
  const sessions = fixture.practiceSessions;
  return {
    teamContext: { currentTeam: { organizationId: target.organizationId, organizationName: "Metrolina Christian Academy", teamId: target.teamId, teamName: "Metrolina Varsity", seasonId: target.seasonId, seasonName: "Fall 2026", role: "ADMIN", active: true }, availableTeams: [] },
    players: roster.map((item, index) => ({ id: item.id, name: `${item.firstName} ${item.lastName}`, jerseyNumber: index + 1, positions: index === 1 ? ["LHP"] : ["CF"], bats: item.bats, throws: item.throws, isPitcher: item.id === "p-mylo", isHitter: true, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" })),
    playerTeamMemberships: roster.map((item) => ({ id: `membership-${item.id}`, playerId: item.id, teamId: target.teamId, seasonId: target.seasonId, rosterStatus: "Varsity", active: true })),
    practices: fixture.practices.map((row) => ({ id: row.id, date: row.practice_date, name: row.name, type: "Practice", location: row.location, playerIds: roster.map((item) => item.id), pitcherIds: ["p-mylo"], hitterIds: roster.map((item) => item.id), startedAt: "2026-09-01T15:00:00.000Z", createdAt: "2026-09-01T15:00:00.000Z", updatedAt: "2026-09-01T15:00:00.000Z" })),
    attendance: [], practiceSessionContributors: [],
    hittingSessions: sessions.filter((row) => row.category === "hitting").map((row) => ({ id: row.id, practiceId: row.practice_id, hitterId: row.player_id, type: row.session_type, roundGoals: [], startedAt: row.started_at, endedAt: row.ended_at })),
    pitchingSessions: sessions.filter((row) => row.category === "pitching").map((row) => ({ id: row.id, practiceId: row.practice_id, pitcherId: row.player_id, hitterId: row.secondary_player_id, type: row.session_type, focusTags: [], startedAt: row.started_at, endedAt: row.ended_at })),
    defenseSessions: sessions.filter((row) => row.category === "defense").map((row) => ({ id: row.id, practiceId: row.practice_id, playerId: row.player_id, station: "Infield", mode: "Drill", startedAt: row.started_at, endedAt: row.ended_at })),
    hittingEvents: fixture.hittingEvents.map((row) => ({ id: row.id, practiceId: row.practice_id, sessionId: row.session_id, hitterId: row.hitter_id, pitcherId: row.pitcher_id, plateAppearanceId: row.plate_appearance_id, eventNumber: row.event_number, action: row.action, contactResult: row.contact_result ?? undefined, contactQuality: row.contact_quality ?? undefined, direction: row.direction ?? undefined, fieldLocation: row.field_location ?? undefined, pitchLocation: row.pitch_location ?? undefined, pitchType: row.pitch_type ?? undefined, velocity: row.velocity ?? undefined, exitVelocityMph: row.exit_velocity_mph ?? undefined, isLiveBp: Boolean(row.is_live_bp), createdAt: row.created_at })),
    pitchEvents: fixture.pitchEvents.map((row) => ({ id: row.id, practiceId: row.practice_id, sessionId: row.session_id, pitcherId: row.pitcher_id, hitterId: row.hitter_id, plateAppearanceId: row.plate_appearance_id, pitchNumber: row.pitch_number, pitchType: row.pitch_type, outcome: row.outcome, velocity: row.velocity, isStrike: row.is_strike, isSwing: row.is_swing, isZone: row.is_zone, isChase: row.is_chase, isWhiff: row.is_whiff, isCalledStrike: row.is_called_strike, isBallInPlay: row.is_ball_in_play, battedBall: row.batted_ball ?? undefined, contactQuality: row.contact_quality ?? undefined, location: row.location ?? undefined, countBefore: row.count_before ?? undefined, countAfter: row.count_after ?? undefined, createdAt: row.created_at })),
    defenseEvents: fixture.defenseEvents.map((row) => ({ id: row.id, practiceId: row.practice_id, sessionId: row.session_id, playerId: row.player_id, station: row.station, eventNumber: row.event_number, outcome: row.outcome, throwResult: row.throw_result ?? undefined, createdAt: row.created_at })),
    workoutSessions: fixture.workoutSessions.map((row) => ({ id: row.id, playerId: row.player_id, date: row.session_date, weekOf: row.week_of, day: row.day_name, completed: row.completed, effortScore: row.effort_score, bodyWeight: row.body_weight, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" })),
    workoutEntries: fixture.workoutSets.map((row) => ({ id: row.id, sessionId: row.workout_session_id, playerId: row.player_id, exercise: "Back Squat", kind: "Lift", weight: row.weight, reps: row.reps, createdAt: "2026-09-01T00:00:00.000Z" })),
    games: fixture.games.map((row) => ({ id: row.id, date: row.game_date, opponent: row.opponent, homeAway: row.home_away, location: row.location, type: row.game_type, metrolinaScore: row.our_score, opponentScore: row.opponent_score, inning: row.inning, half: row.half, outs: row.outs, balls: row.balls, strikes: row.strikes, runners: {}, lineup: roster.map((item) => item.id), positions: {}, startingPitcherId: "p-mylo", createdAt: "2026-09-02T00:00:00.000Z", updatedAt: "2026-09-02T00:00:00.000Z" })),
    gameEvents: fixture.gamePitchEvents.map((row) => ({ id: row.id, gameId: row.game_id, inning: row.inning, half: row.half, pitcherId: row.pitcher_id, batterId: row.batter_id, pitchType: row.pitch_type, pitchOutcome: row.pitch_outcome, ballInPlayOutcome: row.ball_in_play_outcome ?? undefined, eventKind: "pitch", sequenceNumber: row.sequence_number, plateAppearanceId: row.plate_appearance_id, plateAppearanceNumber: row.plate_appearance_number, pitchNumber: row.pitch_number, pitchNumberInPlateAppearance: row.pitch_number_in_plate_appearance, contactType: row.contact_type ?? undefined, runnerMovements: row.runner_movements, rbi: row.rbi ?? undefined, recordStatus: "confirmed", countBefore: row.count_before, countAfter: row.count_after, runnersBefore: row.runners_before, runnersAfter: row.runners_after, fieldLocation: row.field_location ?? undefined, velocity: row.velocity, location: row.location, outsBefore: row.outs_before, outsAfter: row.outs_after, metrolinaRunsBefore: row.our_runs_before, metrolinaRunsAfter: row.our_runs_after, opponentRunsBefore: row.opponent_runs_before, opponentRunsAfter: row.opponent_runs_after, situations: row.situations, createdAt: row.created_at })),
    plateAppearances: fixture.plateAppearances.map((row) => ({ id: row.id, gameId: row.game_id ?? undefined, practiceId: row.practice_id ?? undefined, pitcherId: row.pitcher_id, hitterId: row.hitter_id, startedAt: row.started_at, endedAt: row.ended_at ?? undefined, outcome: row.outcome ?? undefined, balls: row.balls, strikes: row.strikes })),
    scheduleEvents: [], coachNotes: [], developmentGoals: [],
    settings: { theme: "dark", rosterSeason: "Fall 2026", recentPlayerIds: [], selectedTeamId: target.teamId, selectedSeasonId: target.seasonId },
  };
}

function query(domain, source, filters = {}) { return { domain, source, timeRange: "season", sort: "player", direction: "asc", filters }; }
function player(id, firstName, lastName, bats, throws) { return { id, firstName, lastName, bats, throws }; }

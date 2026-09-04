import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserEntitlements, hasEntitlement, SUPER_USER_ENTITLEMENT } from "./askClubhouse/entitlements.ts";

export const DEMO_SEED_VERSION = "v1" as const;
export const DEMO_TARGET = {
  organizationSlug: "metrolina-christian-academy",
  teamName: "Metrolina Varsity",
  seasonName: "Fall 2026",
} as const;

export type DemoDataset = "hitting" | "pitching" | "defense" | "games" | "weight-room" | "full";
export type DemoVolume = "small" | "medium" | "large";
export type DemoAction = "seed" | "delete";
export type DemoCounts = Record<string, number>;

export type DemoRosterPlayer = {
  id: string;
  firstName: string;
  lastName: string;
  bats?: "R" | "L" | "S";
  throws?: "R" | "L";
};

export type DemoSeedFixture = {
  practices: Record<string, unknown>[];
  practiceSessions: Record<string, unknown>[];
  plateAppearances: Record<string, unknown>[];
  pitchEvents: Record<string, unknown>[];
  hittingEvents: Record<string, unknown>[];
  defenseEvents: Record<string, unknown>[];
  games: Record<string, unknown>[];
  gameLineups: Record<string, unknown>[];
  gamePitchEvents: Record<string, unknown>[];
  workouts: Record<string, unknown>[];
  workoutSessions: Record<string, unknown>[];
  workoutSets: Record<string, unknown>[];
  playerMeasurements: Record<string, unknown>[];
  exercises: Record<string, unknown>[];
};

type Target = { organizationId: string; teamId: string; seasonId: string };
type AdminClient = SupabaseClient;

export class DemoSeedError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "DemoSeedError";
    this.status = status;
  }
}

export function isAllowedDemoTarget(target: { organizationSlug?: string | null; teamName?: string | null; seasonName?: string | null }) {
  return target.organizationSlug === DEMO_TARGET.organizationSlug
    && target.teamName === DEMO_TARGET.teamName
    && target.seasonName === DEMO_TARGET.seasonName;
}

export function isDemoSeedActorAuthorized(input: { superUser: boolean; profileRole?: string | null; organizationAdmin: boolean }) {
  return input.superUser || (String(input.profileRole ?? "").toUpperCase() === "ADMIN" && input.organizationAdmin);
}

export function demoCleanupTables(): readonly string[] {
  return [
    "game_pitch_events", "plate_appearances", "game_lineups", "games",
    "hitting_events", "pitch_events", "defense_events", "practice_sessions", "practices",
    "workout_sets", "workout_sessions", "player_measurements", "workouts", "exercises",
  ];
}

export async function readDemoSeedAccess(admin: AdminClient, profileId: string) {
  const target = await resolveDemoTarget(admin);
  const [{ data: profile, error: profileError }, entitlements, { count, error: membershipError }] = await Promise.all([
    admin.from("profiles").select("role").eq("id", profileId).maybeSingle(),
    getUserEntitlements(admin, profileId),
    admin.from("organization_memberships").select("id", { count: "exact", head: true })
      .eq("organization_id", target.organizationId).eq("profile_id", profileId).eq("role", "ADMIN").eq("active", true),
  ]);
  if (profileError) throw new DemoSeedError(profileError.message, 500);
  if (membershipError) throw new DemoSeedError(membershipError.message, 500);
  const authorized = isDemoSeedActorAuthorized({
    superUser: hasEntitlement(entitlements, SUPER_USER_ENTITLEMENT),
    profileRole: profile?.role,
    organizationAdmin: (count ?? 0) > 0,
  });
  return { authorized, target, profileRole: profile?.role ?? undefined };
}

export async function readDemoSeedStatus(admin: AdminClient, target: Target) {
  const { data, error } = await admin
    .from("demo_seed_runs")
    .select("id,seed_version,action,status,created_counts,deleted_counts,started_at,finished_at,metadata")
    .eq("team_id", target.teamId)
    .eq("season_id", target.seasonId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new DemoSeedError(error.message, 500);
  return data ?? null;
}

export async function seedDemoData(admin: AdminClient, input: {
  profileId: string;
  dataset: DemoDataset;
  volume: DemoVolume;
  replaceExisting: boolean;
}) {
  const access = await readDemoSeedAccess(admin, input.profileId);
  if (!access.authorized) throw new DemoSeedError("Only internal Super Users or Metrolina organization admins can seed demo data.", 403);
  if (!input.replaceExisting) throw new DemoSeedError("V1 demo seeding requires replacing the existing marked demo data so repeated runs remain idempotent.", 409);
  await deleteDemoData(admin, { profileId: input.profileId, dataset: input.dataset, volume: input.volume, skipAccessCheck: true });

  const run = await createRun(admin, access.target, input.profileId, "seed", input.dataset, input.volume);
  try {
    const roster = await readDemoRoster(admin, access.target);
    const fixture = buildDemoSeedFixture({ target: access.target, runId: run.id, roster, dataset: input.dataset, volume: input.volume });
    const counts: DemoCounts = {};
    await insert(admin, "practices", fixture.practices, counts, "practices");
    await insert(admin, "practice_sessions", fixture.practiceSessions, counts, "practiceSessions");
    await insert(admin, "plate_appearances", fixture.plateAppearances, counts, "plateAppearances");
    await insert(admin, "pitch_events", fixture.pitchEvents, counts, "pitchEvents");
    await insert(admin, "hitting_events", fixture.hittingEvents, counts, "hittingEvents");
    await insert(admin, "defense_events", fixture.defenseEvents, counts, "defenseEvents");
    await insert(admin, "exercises", fixture.exercises, counts, "exercises");
    await insert(admin, "workouts", fixture.workouts, counts, "workouts");
    await insert(admin, "workout_sessions", fixture.workoutSessions, counts, "workoutSessions");
    await insert(admin, "workout_sets", fixture.workoutSets, counts, "workoutSets");
    await insert(admin, "player_measurements", fixture.playerMeasurements, counts, "playerMeasurements");
    await insert(admin, "games", fixture.games, counts, "games");
    await insert(admin, "game_lineups", fixture.gameLineups, counts, "gameLineups");
    await insert(admin, "game_pitch_events", fixture.gamePitchEvents, counts, "gamePitchEvents");
    await finishRun(admin, run.id, "completed", counts, {});
    return { runId: run.id as string, counts };
  } catch (error) {
    await finishRun(admin, run.id, "failed", {}, {}, error instanceof Error ? error.message : "Unable to create demo data.");
    throw error;
  }
}

export async function deleteDemoData(admin: AdminClient, input: {
  profileId: string;
  dataset: DemoDataset;
  volume: DemoVolume;
  skipAccessCheck?: boolean;
}) {
  const access = await readDemoSeedAccess(admin, input.profileId);
  if (!input.skipAccessCheck && !access.authorized) throw new DemoSeedError("Only internal Super Users or Metrolina organization admins can delete demo data.", 403);
  const run = await createRun(admin, access.target, input.profileId, "delete", input.dataset, input.volume);
  try {
    const { data: seedRuns, error: runError } = await admin.from("demo_seed_runs")
      .select("id").eq("team_id", access.target.teamId).eq("season_id", access.target.seasonId)
      .eq("seed_version", DEMO_SEED_VERSION).eq("action", "seed");
    if (runError) throw new DemoSeedError(runError.message, 500);
    const runIds = (seedRuns ?? []).map((row) => row.id).filter((id): id is string => typeof id === "string");
    const counts: DemoCounts = {};
    if (runIds.length) {
      for (const table of demoCleanupTables()) {
        const { count, error } = await admin.from(table).delete({ count: "exact" }).in("demo_seed_run_id", runIds);
        if (error) throw new DemoSeedError(`Unable to delete ${table}: ${error.message}`, 500);
        counts[table] = count ?? 0;
      }
    }
    await finishRun(admin, run.id, "completed", {}, counts);
    return { runId: run.id as string, counts };
  } catch (error) {
    await finishRun(admin, run.id, "failed", {}, {}, error instanceof Error ? error.message : "Unable to delete demo data.");
    throw error;
  }
}

export function buildDemoSeedFixture(input: {
  target: Target;
  runId: string;
  roster: DemoRosterPlayer[];
  dataset: DemoDataset;
  volume: DemoVolume;
  id?: () => string;
}): DemoSeedFixture {
  const id = input.id ?? (() => crypto.randomUUID());
  const empty: DemoSeedFixture = {
    practices: [], practiceSessions: [], plateAppearances: [], pitchEvents: [], hittingEvents: [], defenseEvents: [],
    games: [], gameLineups: [], gamePitchEvents: [], workouts: [], workoutSessions: [], workoutSets: [], playerMeasurements: [],
    exercises: [],
  };
  const roster = selectDemoRoster(input.roster);
  const marker = (scenario: string) => ({
    demo_seed_run_id: input.runId,
    demo_metadata: { is_demo: true, demo_seed_source: "clubhouse_internal", demo_seed_version: DEMO_SEED_VERSION, demo_seed_run_id: input.runId, demo_scenario: scenario },
  });
  const include = (domain: DemoDataset) => input.dataset === "full" || input.dataset === domain;
  const multiplier = input.volume === "small" ? 1 : input.volume === "medium" ? 2 : 3;
  const now = "2026-09-01T15:00:00.000Z";
  const jacob = roster.jacob;
  const mylo = roster.mylo;

  if (include("hitting") || include("pitching") || include("defense")) {
    const practiceId = id();
    empty.practices.push({ id: practiceId, organization_id: input.target.organizationId, team_id: input.target.teamId, season_id: input.target.seasonId, practice_date: "2026-09-01", name: "Clubhouse QA v1 - Tracked Baseball", practice_type: "Practice", location: "Metrolina Field", notes: "Internal deterministic QA demo data.", status: "completed", ...marker("tracked_baseball") });
    const hittingSessions = new Map<string, string>();
    const pitchingPracticeSessionId = id();
    const pitchingLiveSessionId = id();
    const defenseSessionId = id();
    let liveHittingSessionId: string | undefined;
    if (include("hitting")) {
      for (const player of roster.hitters) {
        const sessionId = id();
        hittingSessions.set(player.id, sessionId);
        empty.practiceSessions.push({ id: sessionId, practice_id: practiceId, player_id: player.id, category: "hitting", session_type: "Machine", started_at: now, ended_at: now, summary_note: "Clubhouse QA v1 tracked hitting", metadata: { type: "Machine", pitchTrackingMode: "MULTI" }, ...marker("hitting") });
      }
      liveHittingSessionId = id();
      empty.practiceSessions.push({ id: liveHittingSessionId, practice_id: practiceId, player_id: jacob.id, category: "hitting", session_type: "Live BP", secondary_player_id: mylo.id, started_at: now, ended_at: now, summary_note: "Clubhouse QA v1 live hitting", metadata: { type: "Live BP" }, ...marker("hitting_live_bp") });
    }
    if (include("hitting") || include("pitching")) {
      empty.practiceSessions.push({ id: pitchingPracticeSessionId, practice_id: practiceId, player_id: mylo.id, category: "pitching", session_type: "Bullpen", started_at: now, ended_at: now, summary_note: "Clubhouse QA v1 pitch command", metadata: { type: "Bullpen" }, ...marker("pitching_practice") });
      empty.practiceSessions.push({ id: pitchingLiveSessionId, practice_id: practiceId, player_id: mylo.id, category: "pitching", session_type: "Live BP", secondary_player_id: jacob.id, started_at: now, ended_at: now, summary_note: "Clubhouse QA v1 live slider command", metadata: { type: "Live BP" }, ...marker("pitching_live_bp") });
    }
    if (include("hitting")) {
      const slider = ["Ball in play", "Ball in play", "Foul", "Ball in play", "Miss", "Ball in play", "Foul", "Ball in play", "Took pitch", "Ball in play", "Miss", "Ball in play"] as const;
      const fastball = ["Ball in play", "Ball in play", "Foul", "Ball in play", "Miss", "Ball in play", "Ball in play", "Foul", "Ball in play", "Took pitch", "Ball in play", "Ball in play"] as const;
      const curveball = ["Ball in play", "Foul", "Miss", "Ball in play", "Took pitch", "Ball in play", "Foul", "Ball in play"] as const;
      const points = [{ x: 0.72, y: 0.76 }, { x: 0.66, y: 0.71 }, { x: 0.5, y: 0.5 }, { x: 0.28, y: 0.35 }, { x: 0.82, y: 0.88 }, { x: 0.54, y: 0.44 }];
      const field = [{ x: 0.2, y: 0.35 }, { x: 0.64, y: 0.28 }, { x: 0.8, y: 0.44 }, { x: 0.45, y: 0.2 }];
      const addRep = (hitter: DemoRosterPlayer, index: number, pitchType: "Slider" | "4-Seam" | "Curveball", action: typeof slider[number], qualityOffset = 0, live = false) => {
        const paId = id();
        const location = points[index % points.length];
        const inPlay = action === "Ball in play";
        const swing = action !== "Took pitch";
        const pitchOutcome = action === "Took pitch" ? (location.x > 0.78 ? "Ball" : "Called Strike") : action === "Miss" ? "Whiff" : action === "Foul" ? "Foul" : "Ball in play";
        const count = index % 4 === 0 ? { balls: 0, strikes: 2 } : index % 5 === 0 ? { balls: 1, strikes: 0 } : { balls: 0, strikes: 1 };
        empty.plateAppearances.push({ id: paId, practice_id: practiceId, pitcher_id: mylo.id, hitter_id: hitter.id, started_at: now, ended_at: now, outcome: inPlay ? "Single" : action === "Miss" ? "Strikeout swinging" : undefined, balls: count.balls, strikes: count.strikes, context: "practice", appearance_number: index + 1, ...marker("hitting_pa") });
        const velocity = pitchType === "Slider" ? 78 + (index % 3) : pitchType === "Curveball" ? 72 + (index % 3) : 84 + (index % 4);
        empty.hittingEvents.push({ id: id(), practice_id: practiceId, session_id: live ? liveHittingSessionId : hittingSessions.get(hitter.id), hitter_id: hitter.id, pitcher_id: mylo.id, plate_appearance_id: paId, event_number: index + 1, action, contact_result: inPlay ? (index % 3 === 0 ? "Line drive" : index % 3 === 1 ? "Ground ball" : "Fly ball") : null, contact_quality: inPlay ? (index % 4 === 0 ? "Barrel" : index % 2 ? "Hard" : "Solid") : null, direction: inPlay ? (index % 3 === 0 ? "Pull" : index % 3 === 1 ? "Middle" : "Opposite") : null, field_location: inPlay ? field[index % field.length] : null, pitch_location: location, pitch_type: pitchType, velocity, exit_velocity_mph: inPlay ? 88 + qualityOffset + (index % 6) : null, is_live_bp: live, context: live ? "live_bp" : "practice", created_at: now, entry_source: "COACH", verification_status: "COACH_VERIFIED", idempotency_key: `${input.runId}:hitting:${hitter.id}:${pitchType}:${index}`, ...marker(`hitting_${live ? "live_bp" : "practice"}_${pitchType.toLowerCase()}`) });
        empty.pitchEvents.push({ id: id(), practice_id: practiceId, session_id: live ? pitchingLiveSessionId : pitchingPracticeSessionId, pitcher_id: mylo.id, hitter_id: hitter.id, plate_appearance_id: paId, pitch_number: index + 1, pitch_type: pitchType, outcome: pitchOutcome, velocity, is_strike: pitchOutcome !== "Ball", is_swing: swing, is_zone: location.x >= 0.22 && location.x <= 0.78 && location.y >= 0.18 && location.y <= 0.82, is_chase: swing && !(location.x >= 0.22 && location.x <= 0.78 && location.y >= 0.18 && location.y <= 0.82), is_whiff: action === "Miss", is_called_strike: action === "Took pitch" && pitchOutcome === "Called Strike", is_ball_in_play: inPlay, batted_ball: inPlay ? (index % 3 === 0 ? "Line drive" : index % 3 === 1 ? "Ground ball" : "Fly ball") : null, contact_quality: inPlay ? "Hard contact" : null, location, count_before: count, count_after: { balls: count.balls, strikes: Math.min(2, count.strikes + (pitchOutcome === "Called Strike" || pitchOutcome === "Whiff" ? 1 : 0)) }, context: live ? "live_bp" : "practice", created_at: now, entry_source: "COACH", verification_status: "COACH_VERIFIED", idempotency_key: `${input.runId}:pitch:${hitter.id}:${pitchType}:${index}`, ...marker(`pitching_${live ? "live_bp" : "practice"}_${pitchType.toLowerCase()}`) });
      };
      for (let cycle = 0; cycle < multiplier; cycle += 1) {
        slider.forEach((action, index) => addRep(jacob, cycle * slider.length + index, "Slider", action, 2));
        fastball.forEach((action, index) => addRep(jacob, 100 + cycle * fastball.length + index, "4-Seam", action, 4));
        curveball.forEach((action, index) => addRep(jacob, 300 + cycle * curveball.length + index, "Curveball", action));
        slider.slice(0, 8).forEach((action, index) => addRep(jacob, 400 + cycle * 8 + index, "Slider", action, 1, true));
        roster.hitters.filter((player) => player.id !== jacob.id).forEach((hitter, hitterIndex) => {
          slider.slice(0, 8).forEach((action, index) => addRep(hitter, 200 + hitterIndex * 20 + cycle * 8 + index, "Slider", index % 4 === 0 ? "Miss" : action, -3));
        });
      }
    }
    if (include("pitching") && !include("hitting")) {
      for (let index = 0; index < 18 * multiplier; index += 1) {
        const location = index % 3 === 0 ? { x: 0.82, y: 0.76 } : { x: 0.5, y: 0.5 };
        const outcome = index % 6 === 0 ? "Ball" : index % 5 === 0 ? "Swinging Strike" : index % 4 === 0 ? "Foul" : "Called Strike";
        empty.pitchEvents.push({ id: id(), practice_id: practiceId, session_id: index % 3 === 0 ? pitchingLiveSessionId : pitchingPracticeSessionId, pitcher_id: mylo.id, hitter_id: jacob.id, pitch_number: index + 1, pitch_type: index % 3 === 0 ? "Slider" : "4-Seam", outcome, velocity: index % 3 === 0 ? 79 + (index % 2) : 85 + (index % 3), is_strike: outcome !== "Ball", is_swing: outcome === "Swinging Strike" || outcome === "Foul", is_zone: location.x < 0.78, is_chase: location.x >= 0.78 && (outcome === "Swinging Strike" || outcome === "Foul"), is_whiff: outcome === "Swinging Strike", is_called_strike: outcome === "Called Strike", is_ball_in_play: false, location, count_before: { balls: index % 3, strikes: index % 2 }, count_after: { balls: outcome === "Ball" ? (index % 3) + 1 : index % 3, strikes: outcome === "Ball" ? index % 2 : Math.min(2, (index % 2) + 1) }, context: index % 3 === 0 ? "live_bp" : "practice", created_at: now, entry_source: "COACH", verification_status: "COACH_VERIFIED", idempotency_key: `${input.runId}:pitching-only:${index}`, ...marker("pitching_only") });
      }
    }
    if (include("defense")) {
      empty.practiceSessions.push({ id: defenseSessionId, practice_id: practiceId, player_id: roster.others[0].id, category: "defense", session_type: "Infield", started_at: now, ended_at: now, summary_note: "Clubhouse QA v1 defense reps", metadata: { station: "Infield" }, ...marker("defense") });
      for (let index = 0; index < 12 * multiplier; index += 1) {
        const player = roster.others[index % roster.others.length];
        empty.defenseEvents.push({ id: id(), practice_id: practiceId, session_id: defenseSessionId, player_id: player.id, station: index % 2 ? "Infield" : "Outfield", event_number: index + 1, outcome: index % 6 === 0 ? "Error" : "Clean", position_worked: index % 2 ? "SS" : "CF", rep_type: index % 2 ? "Ground Ball" : "Fly Ball", result: index % 6 === 0 ? "Error" : "Clean", throw_result: index % 5 === 0 ? "Off target" : "Accurate", error_type: index % 6 === 0 ? "Fielding" : null, created_at: now, entry_source: "COACH", verification_status: "COACH_VERIFIED", idempotency_key: `${input.runId}:defense:${index}`, ...marker("defense") });
      }
    }
  }

  if (include("weight-room")) {
    const workoutId = id();
    const exerciseId = id();
    empty.exercises.push({ id: exerciseId, organization_id: input.target.organizationId, name: "Clubhouse QA v1 Back Squat", kind: "strength", unit: "lb", built_in: false, active: true, ...marker("weight_room_exercise") });
    empty.workouts.push({ id: workoutId, organization_id: input.target.organizationId, team_id: input.target.teamId, season_id: input.target.seasonId, name: "Clubhouse QA v1 Strength", description: "Internal deterministic QA workout.", active: true, ...marker("weight_room") });
    roster.hitters.forEach((player, playerIndex) => {
      for (let week = 0; week < 3 * multiplier; week += 1) {
        const sessionId = id();
        const date = new Date(Date.UTC(2026, 7, 3 + week * 7)).toISOString().slice(0, 10);
        const bodyWeight = 155 + playerIndex * 4 + week * (player.id === jacob.id ? 1.5 : 0.5);
        empty.workoutSessions.push({ id: sessionId, organization_id: input.target.organizationId, team_id: input.target.teamId, season_id: input.target.seasonId, workout_id: workoutId, player_id: player.id, session_date: date, week_of: date, day_name: "Mon", completed: true, effort_score: 8 + (week % 2), body_weight: bodyWeight, notes: "Clubhouse QA v1 demo", ...marker("weight_room") });
        empty.workoutSets.push({ id: id(), workout_session_id: sessionId, player_id: player.id, exercise_id: exerciseId, set_number: 1, weight: 135 + playerIndex * 10 + week * (player.id === jacob.id ? 10 : 5), reps: 5, sets: 1, value: 135 + playerIndex * 10 + week * (player.id === jacob.id ? 10 : 5), unit: "lb", rpe: 7 + (week % 2), prior_value: week ? 135 + playerIndex * 10 + (week - 1) * (player.id === jacob.id ? 10 : 5) : null, notes: "Clubhouse QA v1 progression", ...marker("weight_room_set") });
        empty.playerMeasurements.push({ id: id(), organization_id: input.target.organizationId, player_id: player.id, measured_at: `${date}T14:00:00.000Z`, metric_type: "Body Weight", value: bodyWeight, unit: "lb", notes: "Clubhouse QA v1 demo", ...marker("weight_room_weigh_in") });
      }
    });
  }

  if (include("games")) {
    const gameId = id();
    empty.games.push({ id: gameId, organization_id: input.target.organizationId, team_id: input.target.teamId, season_id: input.target.seasonId, opponent: "Clubhouse QA Opponents", starts_at: "2026-09-02T18:00:00.000Z", game_date: "2026-09-02", home_away: "Home", location: "Metrolina Field", game_type: "Scrimmage", status: "final", our_score: 4, opponent_score: 2, inning: 3, half: "Top", outs: 3, balls: 0, strikes: 0, runners: {}, current_pitcher_id: mylo.id, plate_appearance_number: 10, pitch_number_in_plate_appearance: 0, ...marker("game") });
    roster.hitters.forEach((player, index) => empty.gameLineups.push({ game_id: gameId, player_id: player.id, batting_order: index + 1, position: index === 0 ? "CF" : index === 1 ? "P" : "SS", is_starting_pitcher: player.id === mylo.id, ...marker("game_lineup") }));
    let sequence = 1;
    const addGamePa = (inning: number, batter: DemoRosterPlayer, pitches: number, terminal: "Ground Out" | "Fly Out" | "Single" | "Double" | "Home Run" | "Strikeout", runnersBefore: Record<string, unknown>, outsBefore: number, outsAfter: number, rbi = 0) => {
      const paId = id();
      const scoreStart = inning === 1 ? { metrolina: 0, opponent: 1 } : inning === 2 ? { metrolina: 1, opponent: 1 } : { metrolina: 2, opponent: 1 };
      empty.plateAppearances.push({ id: paId, game_id: gameId, pitcher_id: mylo.id, hitter_id: batter.id, started_at: now, ended_at: now, outcome: terminal === "Strikeout" ? "Strikeout swinging" : terminal === "Ground Out" ? "Groundout" : terminal === "Fly Out" ? "Flyout" : terminal === "Home Run" ? "Home run" : terminal, balls: 0, strikes: 2, context: "game", appearance_number: sequence, inning, half: "Top", outs_start: outsBefore, runners_start: runnersBefore, score_start: scoreStart, ...marker("game_pa") });
      for (let pitch = 1; pitch <= pitches; pitch += 1) {
        const terminalPitch = pitch === pitches;
        const inPlay = terminalPitch && terminal !== "Strikeout";
        empty.gamePitchEvents.push({ id: id(), game_id: gameId, inning, half: "Top", pitcher_id: mylo.id, batter_id: batter.id, pitch_type: pitch % 2 ? "Slider" : "4-Seam", pitch_outcome: terminalPitch ? (terminal === "Strikeout" ? "Swinging Strike" : "In Play") : pitch === 1 ? "Called Strike" : "Foul", ball_in_play_outcome: inPlay ? terminal : null, event_kind: "pitch", sequence_number: sequence++, plate_appearance_id: paId, plate_appearance_number: sequence, pitch_number: pitch, pitch_number_in_plate_appearance: pitch, contact_type: inPlay ? (terminal === "Ground Out" ? "Ground Ball" : terminal === "Fly Out" ? "Fly Ball" : "Line Drive") : null, runner_movements: inPlay && rbi ? [{ runnerId: jacob.id, from: "second", to: "home", result: "safe", reason: "On hit", rbi: true }] : [], rbi: rbi || null, record_status: "confirmed", count_before: pitch === 1 ? { balls: 0, strikes: 0 } : { balls: 0, strikes: Math.min(2, pitch - 1) }, count_after: { balls: 0, strikes: terminal === "Strikeout" ? 3 : Math.min(2, pitch) }, runners_before: runnersBefore, runners_after: {}, field_location: inPlay ? { x: 0.35 + (pitch * 0.08), y: 0.35 } : null, velocity: 80 + pitch, location: pitch === 1 ? { x: 0.5, y: 0.5 } : { x: 0.72, y: 0.76 }, outs_before: outsBefore, outs_after: terminalPitch ? outsAfter : outsBefore, our_runs_before: scoreStart.metrolina, our_runs_after: scoreStart.metrolina + (terminalPitch ? rbi : 0), opponent_runs_before: scoreStart.opponent, opponent_runs_after: scoreStart.opponent, situations: [runnersBefore.first || runnersBefore.second || runnersBefore.third ? (runnersBefore.first && runnersBefore.second && runnersBefore.third ? "Bases loaded" : runnersBefore.second || runnersBefore.third ? "RISP" : "Runner on first") : "Bases empty", outsBefore === 2 ? "2 outs" : ""].filter(Boolean), created_at: now, ...marker("game_pitch") });
      }
    };
    addGamePa(1, roster.others[0], 3, "Ground Out", {}, 0, 1);
    addGamePa(1, roster.others[1], 3, "Fly Out", {}, 1, 2);
    addGamePa(1, roster.others[2], 3, "Strikeout", {}, 2, 3);
    addGamePa(2, jacob, 2, "Single", {}, 0, 0);
    addGamePa(2, roster.others[0], 4, "Double", { second: jacob.id }, 0, 0, 1);
    addGamePa(2, roster.others[1], 4, "Strikeout", {}, 0, 1);
    addGamePa(2, roster.others[2], 3, "Ground Out", {}, 1, 2);
    addGamePa(2, jacob, 3, "Fly Out", { first: roster.others[0].id, second: roster.others[1].id, third: roster.others[2].id }, 2, 3);
    addGamePa(3, roster.others[0], 3, "Ground Out", {}, 0, 1);
    addGamePa(3, roster.others[1], 3, "Strikeout", {}, 1, 2);
    addGamePa(3, roster.others[2], 3, "Fly Out", {}, 2, 3);
  }
  return empty;
}

function selectDemoRoster(players: DemoRosterPlayer[]) {
  const jacob = players.find((player) => player.firstName.toLowerCase() === "jacob");
  const mylo = players.find((player) => player.firstName.toLowerCase() === "mylo");
  const others = players.filter((player) => player.id !== jacob?.id && player.id !== mylo?.id).slice(0, 4);
  if (!jacob || !mylo || others.length < 3) throw new DemoSeedError("Metrolina Varsity needs existing Jacob, Mylo, and at least three additional active roster players before QA demo data can be seeded.", 409);
  return { jacob, mylo, others, hitters: [jacob, mylo, ...others] };
}

async function resolveDemoTarget(admin: AdminClient): Promise<Target> {
  const { data: organization, error: orgError } = await admin.from("organizations").select("id,slug").eq("slug", DEMO_TARGET.organizationSlug).maybeSingle();
  if (orgError) throw new DemoSeedError(orgError.message, 500);
  const { data: team, error: teamError } = await admin.from("teams").select("id,organization_id,name").eq("organization_id", organization?.id ?? "").eq("name", DEMO_TARGET.teamName).maybeSingle();
  if (teamError) throw new DemoSeedError(teamError.message, 500);
  const { data: season, error: seasonError } = await admin.from("seasons").select("id,team_id,name").eq("team_id", team?.id ?? "").eq("name", DEMO_TARGET.seasonName).maybeSingle();
  if (seasonError) throw new DemoSeedError(seasonError.message, 500);
  if (!organization || !team || !season || !isAllowedDemoTarget({ organizationSlug: organization.slug, teamName: team.name, seasonName: season.name })) throw new DemoSeedError("The internal QA demo target is unavailable.", 404);
  return { organizationId: organization.id, teamId: team.id, seasonId: season.id };
}

async function readDemoRoster(admin: AdminClient, target: Target): Promise<DemoRosterPlayer[]> {
  const { data: memberships, error: membershipError } = await admin.from("player_team_memberships").select("player_id").eq("team_id", target.teamId).eq("season_id", target.seasonId).eq("active", true);
  if (membershipError) throw new DemoSeedError(membershipError.message, 500);
  const playerIds = (memberships ?? []).map((row) => row.player_id).filter(Boolean);
  const { data: players, error: playerError } = playerIds.length ? await admin.from("players").select("id,first_name,last_name,bats,throws").in("id", playerIds) : { data: [], error: null };
  if (playerError) throw new DemoSeedError(playerError.message, 500);
  return (players ?? []).map((player) => ({ id: player.id, firstName: player.first_name, lastName: player.last_name, bats: player.bats ?? undefined, throws: player.throws ?? undefined }));
}

async function createRun(admin: AdminClient, target: Target, profileId: string, action: DemoAction, dataset: DemoDataset, volume: DemoVolume) {
  const { data, error } = await admin.from("demo_seed_runs").insert({ organization_id: target.organizationId, team_id: target.teamId, season_id: target.seasonId, requested_by_profile_id: profileId, seed_version: DEMO_SEED_VERSION, action, dataset, volume, metadata: { is_demo: true, demo_seed_source: "clubhouse_internal", demo_seed_version: DEMO_SEED_VERSION } }).select("id").single();
  if (error || !data) throw new DemoSeedError(error?.message ?? "Unable to begin demo seed run.", 500);
  return data as { id: string };
}

async function finishRun(admin: AdminClient, runId: string, status: "completed" | "failed", created: DemoCounts, deleted: DemoCounts, errorMessage?: string) {
  const { error } = await admin.from("demo_seed_runs").update({ status, created_counts: created, deleted_counts: deleted, error_message: errorMessage ?? null, finished_at: new Date().toISOString() }).eq("id", runId);
  if (error) throw new DemoSeedError(error.message, 500);
}

async function insert(admin: AdminClient, table: string, rows: Record<string, unknown>[], counts: DemoCounts, key: string) {
  if (!rows.length) return;
  const { data, error } = await admin.from(table).insert(rows).select();
  if (error) throw new DemoSeedError(`Unable to seed ${key}: ${error.message}`, 500);
  counts[key] = data?.length ?? rows.length;
}

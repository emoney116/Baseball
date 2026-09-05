import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppData, TeamOption } from "../types.ts";
import { PlayerLinkError } from "./playerAccountLinks.ts";
import {
  getUserEntitlements,
  hasEntitlement,
  SUPER_USER_ENTITLEMENT,
} from "./askClubhouse/entitlements.ts";
import {
  emptyData,
  mapPlayer,
  mapPlayerTeamMembership,
  mapPractice,
  mapAttendance,
  mapPitchEvent,
  mapHittingEvent,
  mapDefenseEvent,
  mapHittingSession,
  mapPitchingSession,
  mapDefenseSession,
  mapWorkoutSession,
  mapWorkoutEntry,
  mapGame,
  mapGameEvent,
} from "./askClubhouse/serverData.ts";

// Database rows are projected to an explicit allowlist before shared adapters.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
export type PlayerContext = {
  linkId: string;
  membershipId: string;
  playerId: string;
  name: string;
  jersey?: number;
  team: TeamOption;
};
export type PlayerSession = {
  mode: "player";
  profileId?: string;
  contexts: PlayerContext[];
  context?: PlayerContext;
  data?: AppData;
};
const staffRoles = [
  "OWNER",
  "ADMIN",
  "HEAD_COACH",
  "ASSISTANT_COACH",
  "STAFF",
  "COACH",
];
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function hasStaffAccess(db: SupabaseClient, profileId: string) {
  const [teams, orgs, entitlements] = await Promise.all([
    rows(
      db
        .from("profile_team_memberships")
        .select("team_id")
        .eq("profile_id", profileId)
        .eq("active", true)
        .in("role", staffRoles)
        .limit(1),
    ),
    rows(
      db
        .from("organization_memberships")
        .select("organization_id")
        .eq("profile_id", profileId)
        .eq("active", true)
        .in("role", ["ADMIN", "COACH"])
        .limit(1),
    ),
    getUserEntitlements(db, profileId),
  ]);
  return Boolean(
    teams.length ||
    orgs.length ||
    hasEntitlement(entitlements, SUPER_USER_ENTITLEMENT),
  );
}

export async function listPlayerContexts(
  db: SupabaseClient,
  profileId: string,
): Promise<PlayerContext[]> {
  const links = await rows(
    db
      .from("profile_player_links")
      .select("id,player_id")
      .eq("profile_id", profileId)
      .eq("status", "APPROVED")
      .eq("relationship_type", "PLAYER"),
  );
  if (!links.length) return [];
  const ids = [...new Set(links.map((r) => r.player_id))];
  const [memberships, players] = await Promise.all([
    rows(
      db
        .from("player_team_memberships")
        .select("id,player_id,team_id,season_id,jersey_number")
        .in("player_id", ids)
        .eq("active", true),
    ),
    rows(
      db
        .from("players")
        .select("id,first_name,last_name")
        .in("id", ids)
        .eq("active", true),
    ),
  ]);
  if (!memberships.length) return [];
  const [teams, seasons] = await Promise.all([
    rows(
      db
        .from("teams")
        .select("id,name,organization_id,logo_url")
        .in("id", [...new Set(memberships.map((r) => r.team_id))])
        .eq("active", true),
    ),
    rows(
      db
        .from("seasons")
        .select("id,name,team_id")
        .in("id", [
          ...new Set(memberships.map((r) => r.season_id).filter(Boolean)),
        ])
        .eq("active", true),
    ),
  ]);
  return memberships.flatMap((m) => {
    const p = players.find((p) => p.id === m.player_id),
      t = teams.find((t) => t.id === m.team_id),
      s = seasons.find((s) => s.id === m.season_id && s.team_id === m.team_id);
    const link = links.find((l) => l.player_id === m.player_id);
    if (!p || !t || !s || !link) return [];
    return [
      {
        linkId: link.id,
        membershipId: m.id,
        playerId: p.id,
        name: `${p.first_name} ${p.last_name}`,
        jersey: m.jersey_number,
        team: {
          teamId: t.id,
          teamName: t.name,
          organizationId: t.organization_id,
          organizationName: "",
          logoUrl: t.logo_url,
          seasonId: s.id,
          seasonName: s.name,
          role: "PLAYER" as const,
          active: true,
        },
      },
    ];
  });
}

export function selectPlayerContext(
  contexts: PlayerContext[],
  requested: { playerId?: string; teamId?: string; seasonId?: string },
): PlayerContext | undefined {
  for (const value of Object.values(requested))
    if (value && !UUID.test(value))
      throw new PlayerLinkError("Invalid player context.", 400);
  const explicit = Boolean(
    requested.playerId || requested.teamId || requested.seasonId,
  );
  if (!explicit) return contexts[0];
  const matches = contexts.filter(
    (c) =>
      (!requested.playerId || c.playerId === requested.playerId) &&
      (!requested.teamId || c.team.teamId === requested.teamId) &&
      (!requested.seasonId || c.team.seasonId === requested.seasonId),
  );
  if (matches.length !== 1)
    throw new PlayerLinkError(
      "Choose one of your approved player, team and season contexts.",
      403,
    );
  return matches[0];
}

export async function loadPlayerSession(
  db: SupabaseClient,
  profileId: string,
  requested: { playerId?: string; teamId?: string; seasonId?: string } = {},
): Promise<PlayerSession> {
  const contexts = await listPlayerContexts(db, profileId);
  const context = selectPlayerContext(contexts, requested);
  if (!context) return { mode: "player", profileId, contexts };
  const data = await loadPlayerData(db, profileId, context);
  // Close the read/revoke race before returning any private payload.
  const current = await listPlayerContexts(db, profileId);
  if (
    !current.some(
      (c) =>
        c.linkId === context.linkId && c.membershipId === context.membershipId,
    )
  )
    throw new PlayerLinkError(
      "Player access has changed. Refresh to continue.",
      403,
    );
  return { mode: "player", profileId, contexts: current, context, data };
}

const pick = (r: Row, keys: string) =>
  Object.fromEntries(
    keys
      .split(",")
      .filter((k) => Object.hasOwn(r, k))
      .map((k) => [k, r[k]]),
  );
const eventAudit = "id,created_at,practice_id,session_id";
export function safePlayerRow(kind: string, r: Row): Row {
  const fields: Record<string, string> = {
    player:
      "id,first_name,last_name,jersey_number,primary_position,secondary_position,bats,throws,graduation_year,height,weight,photo_url,is_pitcher,is_hitter,active,created_at,updated_at",
    membership:
      "id,player_id,team_id,season_id,jersey_number,roster_status,active",
    practice:
      "id,practice_date,name,practice_type,location,starts_at,ended_at,created_at,updated_at",
    attendance: "id,practice_id,player_id,role,status,checked_in_at",
    session:
      "id,practice_id,player_id,category,session_type,started_at,ended_at,status",
    pitch: `${eventAudit},pitcher_id,plate_appearance_id,pitch_number,pitch_type,outcome,is_strike,is_swing,is_zone,is_chase,is_whiff,is_called_strike,is_ball_in_play,batted_ball,contact_quality,velocity,location,count_before,count_after`,
    hitting: `${eventAudit},hitter_id,plate_appearance_id,event_number,action,contact_result,contact_quality,direction,field_location,pitch_location,pitch_type,velocity,exit_velocity_mph,is_live_bp`,
    defense: `${eventAudit},player_id,station,event_number,outcome,position_worked,drill_context,rep_type,rep_subtype,result,throw_result,difficulty,location,timing_seconds,error_type`,
    workout:
      "id,player_id,session_date,week_of,day_name,completed,effort_score,body_weight,created_at,updated_at",
    set: "id,workout_session_id,player_id,exercise_id,set_number,weight,reps,sets,value,unit,rpe,status,created_at",
    game: "id,game_date,starts_at,opponent,home_away,location,game_type,result,our_score,opponent_score,inning,half,outs,balls,strikes,created_at,updated_at",
    gameEvent:
      "id,game_id,inning,half,pitcher_id,batter_id,pitch_type,pitch_outcome,ball_in_play_outcome,event_kind,sequence_number,plate_appearance_id,plate_appearance_number,pitch_number,pitch_number_in_plate_appearance,contact_type,rbi,record_status,runner_action,runner_id,runner_base,count_before,count_after,field_location,velocity,location,outs_before,outs_after,our_runs_before,our_runs_after,opponent_runs_before,opponent_runs_after,created_at",
  };
  const safe = pick(r, fields[kind] ?? "");
  if (kind === "session")
    safe.metadata = pick(
      r.metadata ?? {},
      "liveBpThrowerSource,machineVelocity,machinePitchType,pitchTrackingMode,defaultPitchType,drillContext,positionWorked",
    );
  return safe;
}

async function loadPlayerData(
  db: SupabaseClient,
  profileId: string,
  context: PlayerContext,
): Promise<AppData> {
  const { playerId, team } = context;
  const scoped = (table: string) =>
    db
      .from(table)
      .select("*")
      .eq("team_id", team.teamId)
      .eq("season_id", team.seasonId!);
  const [
    player,
    membership,
    practiceRows,
    gameRows,
    workouts,
    goals,
    notes,
    schedule,
  ] = await Promise.all([
    rows(db.from("players").select("*").eq("id", playerId).eq("active", true)),
    rows(
      db
        .from("player_team_memberships")
        .select("*")
        .eq("id", context.membershipId)
        .eq("active", true),
    ),
    rows(scoped("practices")),
    rows(scoped("games")),
    rows(scoped("workout_sessions").eq("player_id", playerId)),
    rows(
      scoped("development_goals")
        .eq("player_id", playerId)
        .eq("player_visible", true),
    ),
    rows(
      db
        .from("player_notes")
        .select("id,player_id,note,created_at,updated_at")
        .eq("player_id", playerId)
        .eq("team_id", team.teamId)
        .eq("season_id", team.seasonId!)
        .eq("visibility", "player_visible"),
    ),
    rows(scoped("schedule_events").in("visibility", ["PUBLIC", "TEAM_ONLY"])),
  ]);
  const pids = practiceRows.map((r) => r.id),
    gids = gameRows.map((r) => r.id),
    wids = workouts.map((r) => r.id);
  const ownPractice = (table: string, key: string) =>
    pids.length
      ? rows(
          db.from(table).select("*").in("practice_id", pids).eq(key, playerId),
        )
      : Promise.resolve([]);
  const [attendance, sessions, pitches, hitting, defense, events, sets] =
    await Promise.all([
      ownPractice("practice_attendance", "player_id"),
      ownPractice("practice_sessions", "player_id"),
      ownPractice("pitch_events", "pitcher_id"),
      ownPractice("hitting_events", "hitter_id"),
      ownPractice("defense_events", "player_id"),
      gids.length
        ? rows(
            db
              .from("game_pitch_events")
              .select("*")
              .in("game_id", gids)
              .or(
                `batter_id.eq.${playerId},pitcher_id.eq.${playerId},runner_id.eq.${playerId}`,
              ),
          )
        : Promise.resolve([]),
      wids.length
        ? rows(
            db
              .from("workout_sets")
              .select("*")
              .in("workout_session_id", wids)
              .eq("player_id", playerId),
          )
        : Promise.resolve([]),
    ]);
  const exerciseIds = [
    ...new Set(sets.map((r) => r.exercise_id).filter(Boolean)),
  ];
  const exercises = exerciseIds.length
    ? await rows(
        db.from("exercises").select("id,name,kind,unit").in("id", exerciseIds),
      )
    : [];
  const teamContext = {
    profile: { id: profileId, role: "PLAYER" as const },
    availableTeams: [team],
    currentTeam: team,
  };
  const result = emptyData(teamContext, teamContext.profile, team);
  return {
    ...result,
    players: player.map((r) =>
      mapPlayer(
        safePlayerRow("player", r),
        safePlayerRow("membership", membership[0] ?? {}),
      ),
    ),
    playerTeamMemberships: membership.map((r) =>
      mapPlayerTeamMembership(safePlayerRow("membership", r)),
    ),
    practices: practiceRows.map((r) =>
      mapPractice(safePlayerRow("practice", r), attendance),
    ),
    attendance: attendance.map((r) =>
      mapAttendance(safePlayerRow("attendance", r)),
    ),
    hittingSessions: sessions
      .filter((r) => r.category === "hitting")
      .map((r) => mapHittingSession(safePlayerRow("session", r))),
    pitchingSessions: sessions
      .filter((r) => r.category === "pitching")
      .map((r) => mapPitchingSession(safePlayerRow("session", r))),
    defenseSessions: sessions
      .filter((r) => r.category === "defense")
      .map((r) => mapDefenseSession(safePlayerRow("session", r))),
    pitchEvents: pitches.map((r) => mapPitchEvent(safePlayerRow("pitch", r))),
    hittingEvents: hitting.map((r) =>
      mapHittingEvent(safePlayerRow("hitting", r)),
    ),
    defenseEvents: defense.map((r) =>
      mapDefenseEvent(safePlayerRow("defense", r)),
    ),
    games: gameRows.map((r) => mapGame(safePlayerRow("game", r), [])),
    gameEvents: events.map((r) => {
      const safe = safePlayerRow("gameEvent", r);
      for (const field of ["batter_id", "pitcher_id", "runner_id"])
        if (safe[field] !== playerId) delete safe[field];
      for (const field of ["runners_before", "runners_after"])
        if (r[field])
          safe[field] = Object.fromEntries(
            Object.entries(r[field])
              .filter(([, v]) => Boolean(v))
              .map(([base, v]) => [
                base,
                v === playerId ? playerId : `occupied-${base}`,
              ]),
          );
      return mapGameEvent(safe);
    }),
    workoutSessions: workouts.map((r) =>
      mapWorkoutSession(safePlayerRow("workout", r)),
    ),
    workoutEntries: sets.map((r) =>
      mapWorkoutEntry(
        safePlayerRow("set", r),
        exercises.find((e) => e.id === r.exercise_id),
      ),
    ),
    developmentGoals: goals.map((r) => ({
      id: r.id,
      playerId,
      title: r.title,
      tags: [],
      completed: r.completed,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
    coachNotes: notes.map((r) => ({
      id: r.id,
      scope: { type: "Player", playerId },
      text: r.note,
      tags: [],
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
    scheduleEvents: schedule.map((r) => ({
      id: r.id,
      teamId: team.teamId,
      seasonId: team.seasonId,
      eventType: r.event_type,
      title: r.title,
      startAt: r.start_at,
      endAt: r.end_at,
      location: r.location,
      visibility: r.visibility,
      status: r.status,
      practiceId: r.practice_id,
      gameId: r.game_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  };
}

type RowResult = { data: Row[] | null; error: { message: string } | null };
type RowQuery = PromiseLike<RowResult> & {
  range?: (from: number, to: number) => PromiseLike<RowResult>;
  order?: (column: string) => unknown;
};
async function rows(query: RowQuery): Promise<Row[]> {
  const result: Row[] = [];
  // Stable paging avoids the Data API's default 1,000-row truncation.
  query.order?.("id");
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await (query.range
      ? query.range(offset, offset + 999)
      : query);
    if (error)
      throw new PlayerLinkError("Player data is temporarily unavailable.", 503);
    result.push(...(data ?? []));
    if (!query.range || (data?.length ?? 0) < 1000) return result;
  }
}

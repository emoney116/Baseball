import type { SupabaseClient } from "@supabase/supabase-js";
import { listPlayerContexts, loadContextPlayerAccess } from "./playerAccess.ts";
import { PlayerLinkError } from "./playerAccountLinks.ts";
import {
  LIVE_DOMAINS,
  LIVE_FIELDS,
  liveCapability,
  normalizeLivePayload,
  type LiveDomain,
  type PlayerLiveEntry,
} from "./playerLiveModels.ts";

// PostgREST projections vary by table; only explicit fields are returned to the player.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
async function rows(
  query: PromiseLike<{ data: unknown; error: unknown }>,
): Promise<Row[]> {
  const { data, error } = await query;
  if (error)
    throw new PlayerLinkError("Unable to load live sessions. Try again.", 503);
  return (data ?? []) as Row[];
}
export async function playerLiveContext(
  db: SupabaseClient,
  profileId: string,
  membershipId: unknown,
) {
  if (typeof membershipId !== "string")
    throw new PlayerLinkError("Choose your approved player context.", 403);
  const context = (await listPlayerContexts(db, profileId)).find(
    (c) => c.membershipId === membershipId,
  );
  if (!context)
    throw new PlayerLinkError("Choose your approved player context.", 403);
  return { context, access: await loadContextPlayerAccess(db, context) };
}

export async function loadPlayerLiveSessions(
  db: SupabaseClient,
  profileId: string,
  membershipId: unknown,
) {
  const { context } = await playerLiveContext(db, profileId, membershipId);
  const { playerId, team } = context;
  const now = new Date().toISOString();
  const [practices, workouts] = await Promise.all([
    rows(
      db
        .from("practices")
        .select("id,name,starts_at,ended_at,status")
        .eq("team_id", team.teamId)
        .eq("season_id", team.seasonId!)
        .eq("status", "active")
        .is("ended_at", null)
        .lte("starts_at", now),
    ),
    rows(
      db
        .from("weight_room_workouts")
        .select(
          "id,title,status,started_at,ended_at,player_entry_enabled,created_by",
        )
        .eq("team_id", team.teamId)
        .eq("season_id", team.seasonId!)
        .eq("status", "ACTIVE")
        .is("ended_at", null)
        .lte("started_at", now)
        .eq("player_entry_enabled", true),
    ),
  ]);
  const practiceIds = practices.map((p) => p.id),
    workoutIds = workouts.filter((w) => w.created_by).map((w) => w.id);
  const [sessions, attendance, members] = await Promise.all([
    practiceIds.length
      ? rows(
          db
            .from("practice_sessions")
            .select(
              "id,practice_id,player_id,category,session_type,station,title,status,started_at,ended_at,entry_policy,metadata,created_by_profile_id,secondary_player_id",
            )
            .in("practice_id", practiceIds)
            .eq("player_id", playerId)
            .eq("status", "ACTIVE")
            .is("ended_at", null)
            .lte("started_at", now),
        )
      : [],
    practiceIds.length
      ? rows(
          db
            .from("practice_attendance")
            .select("practice_id,status")
            .in("practice_id", practiceIds)
            .eq("player_id", playerId)
            .in("status", ["Present", "Late"]),
        )
      : [],
    workoutIds.length
      ? rows(
          db
            .from("weight_room_workout_group_members")
            .select("workout_id,group_id,participant_status")
            .in("workout_id", workoutIds)
            .eq("player_id", playerId)
            .in("participant_status", ["ASSIGNED", "MODIFIED"]),
        )
      : [],
  ]);
  const groups = members.length
    ? await rows(
        db
          .from("weight_room_workout_groups")
          .select("id,workout_id,current_station_id")
          .in(
            "id",
            members.map((m) => m.group_id),
          ),
      )
    : [];
  const stationIds = groups.map((g) => g.current_station_id).filter(Boolean);
  const stations = stationIds.length
    ? await rows(
        db
          .from("weight_room_workout_stations")
          .select(
            "id,workout_id,exercise_id,exercise_name,target_sets,target_reps,target_weight,target_value,measurement_type,unit,archived_at",
          )
          .in("id", stationIds)
          .is("archived_at", null),
      )
    : [];
  const live = sessions
    .filter(
      (s) =>
        s.created_by_profile_id &&
        !s.secondary_player_id &&
        !["Live", "Live BP"].includes(s.session_type) &&
        ["COACH_AND_ASSIGNED_PLAYERS", "PLAYER_SELF_ENTRY"].includes(
          s.entry_policy,
        ) &&
        attendance.some((a) => a.practice_id === s.practice_id),
    )
    .map((s) => ({
      id: s.id,
      domain: s.category as LiveDomain,
      title: practices.find((p) => p.id === s.practice_id)!.name,
      station: s.station ?? s.session_type,
      startedAt: s.started_at,
      fields: (Array.isArray(s.metadata?.playerEntryFields)
        ? s.metadata.playerEntryFields
        : []
      ).filter((f: string) =>
        LIVE_FIELDS[s.category as LiveDomain]?.some((field) => field.key === f),
      ),
      practiceId: s.practice_id,
    }));
  const workoutLive = stations
    .filter(
      (s) =>
        s.exercise_id &&
        groups.some(
          (g) => g.current_station_id === s.id && g.workout_id === s.workout_id,
        ),
    )
    .map((s) => ({
      id: s.workout_id,
      domain: "workout" as const,
      title: workouts.find((w) => w.id === s.workout_id)!.title,
      station: s.exercise_name,
      startedAt: workouts.find((w) => w.id === s.workout_id)!.started_at,
      fields: [],
      exercise: {
        id: s.id,
        name: s.exercise_name,
        sets: s.target_sets ?? 1,
        reps: s.target_reps,
        weight: s.target_weight,
        value: s.target_value,
        measurement: s.measurement_type ?? "WEIGHT_REPS",
        unit: s.unit,
      },
    }));
  const entries: PlayerLiveEntry[] = [];
  for (const domain of LIVE_DOMAINS) {
    const ids =
      domain === "workout"
        ? workoutLive.map((s) => s.id)
        : live.filter((s) => s.domain === domain).map((s) => s.id);
    if (!ids.length) continue;
    const table = {
      hitting: "hitting_events",
      pitching: "pitch_events",
      defense: "defense_events",
      workout: "workout_sets",
    }[domain];
    const own = {
      hitting: "hitter_id",
      pitching: "pitcher_id",
      defense: "player_id",
      workout: "player_id",
    }[domain];
    const resultKey =
      domain === "workout"
        ? "status"
        : domain === "hitting"
          ? "action"
          : "outcome";
    const sourceRows = await rows(
      db
        .from(table)
        .select("*")
        .in(domain === "workout" ? "active_workout_id" : "session_id", ids)
        .eq(own, playerId)
        .order("created_at", { ascending: false })
        .limit(500),
    );
    for (const r of sourceRows) {
      const payload: Record<string, unknown> = {};
      for (const key of [resultKey, ...LIVE_FIELDS[domain].map((f) => f.key)])
        if (r[key] != null) payload[key] = r[key];
      if (domain === "workout") {
        payload.stationId = r.workout_station_id;
        payload.setNumber = r.set_number;
      }
      entries.push({
        id: r.id,
        sessionId: domain === "workout" ? r.active_workout_id : r.session_id,
        domain,
        payload,
        createdAt: r.created_at,
        editable:
          r.entry_source === "PLAYER" &&
          (domain === "workout" ? r.created_by : r.created_by_profile_id) ===
            profileId &&
          [null, undefined, profileId].includes(
            domain === "workout" ? r.updated_by : r.updated_by_profile_id,
          ),
      });
    }
  }
  // Fail closed if an association was revoked while the projections were loading.
  const verified = await playerLiveContext(db, profileId, membershipId);
  return {
    sessions: [...live, ...workoutLive],
    entries,
    capabilities: verified.access.capabilities,
    context: {
      playerId,
      name: context.name,
      teamName: team.teamName,
      seasonName: team.seasonName,
    },
  };
}

export async function writePlayerLiveEntry(
  db: SupabaseClient,
  profileId: string,
  input: Record<string, unknown>,
) {
  const { context, access } = await playerLiveContext(
    db,
    profileId,
    input.membershipId,
  );
  if (!LIVE_DOMAINS.includes(input.domain as LiveDomain))
    throw new PlayerLinkError("Unsupported live entry.");
  const domain = input.domain as LiveDomain;
  if (!access.capabilities[liveCapability(domain)])
    throw new PlayerLinkError("Your access is read-only.", 403);
  for (const key of ["sessionId", "requestId"])
    if (
      typeof input[key] !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(input[key] as string)
    )
      throw new PlayerLinkError("A valid session and request are required.");
  if (!["create", "update", "delete"].includes(String(input.operation)))
    throw new PlayerLinkError("Unsupported live operation.");
  if (
    input.operation !== "create" &&
    (typeof input.entryId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(input.entryId))
  )
    throw new PlayerLinkError("An existing entry is required.");
  const payload = normalizeLivePayload(
    domain,
    input.payload,
    input.operation === "delete",
  );
  const { data, error } = await db.rpc("write_player_live_entry", {
    actor: profileId,
    target_membership: context.membershipId,
    domain,
    target_session: input.sessionId,
    operation: input.operation,
    request_id: input.requestId,
    entry_id: input.operation === "create" ? null : input.entryId,
    payload,
  });
  if (error)
    throw new PlayerLinkError(
      error.code === "55000"
        ? "Session ended or entry was disabled. Your history is still available."
        : error.code === "23505"
          ? "This entry is already recorded. Refresh before correcting it."
          : error.code === "22023"
            ? "Enter valid performed values for this exercise."
            : "Entry denied. Refresh to check your session, assignment and access.",
      error.code === "55000"
        ? 409
        : error.code === "23505"
          ? 409
          : error.code === "22023"
            ? 400
            : 403,
    );
  return { id: data };
}

export const uuid = (n) =>
  `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export function playerServiceFixture() {
  const date = "2026-09-04T12:00:00.000Z",
    own = uuid(40),
    other = uuid(41),
    team = uuid(20),
    season = uuid(30),
    practice = uuid(60);
  const tables = {
    profile_player_links: [
      {
        id: uuid(70),
        profile_id: uuid(1),
        player_id: own,
        status: "APPROVED",
        relationship_type: "PLAYER",
      },
    ],
    players: [own, other].map((id, i) => ({
      id,
      first_name: i ? "Other" : "Jacob",
      last_name: "Seamon",
      active: true,
      is_hitter: true,
      is_pitcher: true,
      created_at: date,
      metadata: { notes: "PRIVATE PLAYER NOTE" },
    })),
    player_team_memberships: [own, other].map((player_id, i) => ({
      id: uuid(50 + i),
      player_id,
      team_id: team,
      season_id: season,
      active: true,
      jersey_number: i + 1,
    })),
    teams: [
      {
        id: team,
        name: "Metrolina Varsity",
        organization_id: uuid(10),
        active: true,
      },
    ],
    seasons: [{ id: season, team_id: team, name: "Fall 2026", active: true }],
    practices: [
      {
        id: practice,
        team_id: team,
        season_id: season,
        practice_date: "2026-09-04",
        name: "Practice",
        notes: "PRIVATE PRACTICE NOTE",
        created_at: date,
      },
    ],
    practice_sessions: [
      {
        id: uuid(61),
        practice_id: practice,
        player_id: own,
        category: "hitting",
        session_type: "Machine",
        started_at: date,
        summary_note: "PRIVATE SESSION NOTE",
        metadata: {
          defaultPitchType: "Slider",
          privateStaffComment: "PRIVATE METADATA",
        },
      },
    ],
    hitting_events: ["Ball in play", "Foul", "Miss"].map((action, i) => ({
      id: uuid(80 + i),
      practice_id: practice,
      session_id: uuid(61),
      hitter_id: own,
      action,
      pitch_type: "Slider",
      field_location: action === "Ball in play" ? { x: 0.4, y: 0.3 } : null,
      contact_result: action === "Ball in play" ? "Line drive" : null,
      exit_velocity_mph: action === "Ball in play" ? 90 : null,
      created_at: date,
    })),
    pitch_events: [],
    defense_events: [],
    practice_attendance: [],
    games: [],
    game_pitch_events: [],
    workout_sessions: [],
    workout_sets: [],
    exercises: [],
    development_goals: [
      {
        id: uuid(90),
        team_id: team,
        season_id: season,
        player_id: own,
        title: "Visible goal",
        player_visible: true,
        created_at: date,
      },
      {
        id: uuid(91),
        team_id: team,
        season_id: season,
        player_id: own,
        title: "PRIVATE GOAL",
        player_visible: false,
      },
    ],
    player_notes: [
      {
        id: uuid(92),
        team_id: team,
        season_id: season,
        player_id: own,
        note: "Visible feedback",
        visibility: "player_visible",
        created_at: date,
      },
      {
        id: uuid(93),
        team_id: team,
        season_id: season,
        player_id: own,
        note: "PRIVATE COACH NOTE",
        visibility: "coach_only",
      },
      {
        id: uuid(94),
        team_id: team,
        season_id: season,
        player_id: other,
        note: "OTHER VISIBLE FEEDBACK",
        visibility: "player_visible",
      },
    ],
    schedule_events: [
      {
        id: uuid(95),
        team_id: team,
        season_id: season,
        title: "Team Practice",
        visibility: "TEAM_ONLY",
        start_at: date,
      },
      {
        id: uuid(96),
        team_id: team,
        season_id: season,
        title: "PRIVATE STAFF MEETING",
        visibility: "PRIVATE",
      },
    ],
    account_entitlements: [],
    organization_memberships: [],
    profile_team_memberships: [],
  };
  tables.hitting_events.push({
    ...tables.hitting_events[0],
    id: uuid(84),
    hitter_id: other,
    exit_velocity_mph: 110,
  });
  const calls = [];
  const hooks = { beforeRead: undefined };
  const db = {
    from(table) {
      const predicates = [];
      let limit = 1000,
        offset = 0;
      const query = {
        select() {
          return query;
        },
        eq(k, v) {
          predicates.push((r) => r[k] === v);
          return query;
        },
        in(k, vs) {
          predicates.push((r) => vs.includes(r[k]));
          return query;
        },
        order() {
          return query;
        },
        limit(n) {
          limit = n;
          return query;
        },
        range(from, to) {
          offset = from;
          limit = to - from + 1;
          return query;
        },
        or(value) {
          const alternatives = value.split(",").map((s) => s.split(".eq."));
          predicates.push((r) => alternatives.some(([k, v]) => r[k] === v));
          return query;
        },
        then(resolve, reject) {
          calls.push(table);
          hooks.beforeRead?.(table);
          return Promise.resolve({
            data: (tables[table] ?? [])
              .filter((r) => predicates.every((p) => p(r)))
              .slice(offset, offset + limit),
            error: null,
          }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  return { db, tables, calls, own, other, team, season, hooks };
}

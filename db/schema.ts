import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const membershipRole = pgEnum("membership_role", ["ADMIN", "COACH", "PLAYER"]);
export const rosterStatus = pgEnum("roster_status", ["Varsity", "JV", "Undecided", "Cut"]);
export const practiceStatus = pgEnum("practice_status", ["scheduled", "active", "completed", "cancelled"]);
export const practiceSessionCategory = pgEnum("practice_session_category", ["hitting", "pitching", "defense"]);
export const gameStatus = pgEnum("game_status", ["scheduled", "active", "final", "cancelled"]);
export const homeAway = pgEnum("home_away", ["Home", "Away"]);
export const noteVisibility = pgEnum("note_visibility", ["coach_only", "player_visible"]);
export const awardType = pgEnum("award_type", ["PLAYER_OF_WEEK", "WEIGHT_ROOM_LEADER"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  ...timestamps,
}, (table) => ({
  slugUnique: uniqueIndex("organizations_slug_key").on(table.slug),
}));

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  level: text("level"),
  active: boolean("active").default(true).notNull(),
  ...timestamps,
}, (table) => ({
  organizationIdx: index("teams_organization_id_idx").on(table.organizationId),
  uniqueTeam: uniqueIndex("teams_org_name_key").on(table.organizationId, table.name),
}));

export const seasons = pgTable("seasons", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  startsOn: date("starts_on"),
  endsOn: date("ends_on"),
  active: boolean("active").default(true).notNull(),
  ...timestamps,
}, (table) => ({
  teamIdx: index("seasons_team_id_idx").on(table.teamId),
  uniqueSeason: uniqueIndex("seasons_team_name_key").on(table.teamId, table.name),
}));

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email"),
  displayName: text("display_name"),
  role: membershipRole("role").default("COACH").notNull(),
  ...timestamps,
});

export const organizationMemberships = pgTable("organization_memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  role: membershipRole("role").notNull(),
  active: boolean("active").default(true).notNull(),
  ...timestamps,
}, (table) => ({
  uniqueMember: uniqueIndex("organization_memberships_org_profile_key").on(table.organizationId, table.profileId),
  profileIdx: index("organization_memberships_profile_id_idx").on(table.profileId),
}));

export const players = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  jerseyNumber: integer("jersey_number"),
  graduationYear: integer("graduation_year"),
  primaryPosition: text("primary_position").notNull(),
  secondaryPosition: text("secondary_position"),
  bats: text("bats").notNull(),
  throws: text("throws").notNull(),
  height: text("height"),
  weight: integer("weight"),
  isPitcher: boolean("is_pitcher").default(false).notNull(),
  isHitter: boolean("is_hitter").default(true).notNull(),
  photoUrl: text("photo_url"),
  active: boolean("active").default(true).notNull(),
  metadata: jsonb("metadata").default({}).notNull(),
  ...timestamps,
}, (table) => ({
  organizationIdx: index("players_organization_id_idx").on(table.organizationId),
}));

export const playerTeamMemberships = pgTable("player_team_memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  playerId: uuid("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  seasonId: uuid("season_id").notNull().references(() => seasons.id, { onDelete: "cascade" }),
  rosterStatus: rosterStatus("roster_status").default("Undecided").notNull(),
  active: boolean("active").default(true).notNull(),
  ...timestamps,
}, (table) => ({
  uniqueMembership: uniqueIndex("player_team_memberships_player_team_season_key").on(table.playerId, table.teamId, table.seasonId),
  teamIdx: index("player_team_memberships_team_id_idx").on(table.teamId),
  seasonIdx: index("player_team_memberships_season_id_idx").on(table.seasonId),
}));

export const practices = pgTable("practices", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  seasonId: uuid("season_id").notNull().references(() => seasons.id, { onDelete: "cascade" }),
  practiceDate: date("practice_date").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  name: text("name").notNull(),
  practiceType: text("practice_type").notNull(),
  location: text("location"),
  notes: text("notes"),
  status: practiceStatus("status").default("active").notNull(),
  ...timestamps,
}, (table) => ({
  seasonIdx: index("practices_season_id_idx").on(table.seasonId),
}));

export const practiceAttendance = pgTable("practice_attendance", {
  id: uuid("id").primaryKey().defaultRandom(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id, { onDelete: "cascade" }),
  playerId: uuid("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  checkedInAt: timestamp("checked_in_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueAttendance: uniqueIndex("practice_attendance_practice_player_key").on(table.practiceId, table.playerId),
  playerIdx: index("practice_attendance_player_id_idx").on(table.playerId),
}));

export const practiceSessions = pgTable("practice_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id, { onDelete: "cascade" }),
  playerId: uuid("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  category: practiceSessionCategory("category").notNull(),
  sessionType: text("session_type").notNull(),
  secondaryPlayerId: uuid("secondary_player_id").references(() => players.id, { onDelete: "set null" }),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  summaryNote: text("summary_note"),
  sessionGrade: text("session_grade"),
  metadata: jsonb("metadata").default({}).notNull(),
}, (table) => ({
  practiceIdx: index("practice_sessions_practice_id_idx").on(table.practiceId),
  playerIdx: index("practice_sessions_player_id_idx").on(table.playerId),
}));

export const pitchEvents = pgTable("pitch_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  practiceId: uuid("practice_id").references(() => practices.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id").references(() => practiceSessions.id, { onDelete: "cascade" }),
  pitcherId: uuid("pitcher_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  hitterId: uuid("hitter_id").references(() => players.id, { onDelete: "set null" }),
  plateAppearanceId: uuid("plate_appearance_id"),
  pitchNumber: integer("pitch_number").notNull(),
  pitchType: text("pitch_type").notNull(),
  outcome: text("outcome").notNull(),
  velocity: numeric("velocity"),
  isStrike: boolean("is_strike").default(false).notNull(),
  isSwing: boolean("is_swing").default(false).notNull(),
  isZone: boolean("is_zone").default(false).notNull(),
  isChase: boolean("is_chase"),
  isWhiff: boolean("is_whiff"),
  isCalledStrike: boolean("is_called_strike"),
  isBallInPlay: boolean("is_ball_in_play"),
  battedBall: text("batted_ball"),
  contactQuality: text("contact_quality"),
  qualityRating: integer("quality_rating"),
  missedIntendedLocation: boolean("missed_intended_location"),
  intendedTarget: jsonb("intended_target"),
  location: jsonb("location"),
  countBefore: jsonb("count_before"),
  countAfter: jsonb("count_after"),
  mechanicalNote: text("mechanical_note"),
  coachNote: text("coach_note"),
  context: text("context").default("practice").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  sessionIdx: index("pitch_events_session_id_idx").on(table.sessionId),
  pitcherIdx: index("pitch_events_pitcher_id_idx").on(table.pitcherId),
}));

export const hittingEvents = pgTable("hitting_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  practiceId: uuid("practice_id").references(() => practices.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id").references(() => practiceSessions.id, { onDelete: "cascade" }),
  hitterId: uuid("hitter_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  pitcherId: uuid("pitcher_id").references(() => players.id, { onDelete: "set null" }),
  plateAppearanceId: uuid("plate_appearance_id"),
  eventNumber: integer("event_number").notNull(),
  action: text("action").notNull(),
  contactResult: text("contact_result"),
  contactQuality: text("contact_quality"),
  direction: text("direction"),
  fieldLocation: jsonb("field_location"),
  pitchType: text("pitch_type"),
  velocity: numeric("velocity"),
  isLiveBp: boolean("is_live_bp").default(false).notNull(),
  context: text("context").default("practice").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  sessionIdx: index("hitting_events_session_id_idx").on(table.sessionId),
  hitterIdx: index("hitting_events_hitter_id_idx").on(table.hitterId),
}));

export const defenseEvents = pgTable("defense_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  practiceId: uuid("practice_id").references(() => practices.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id").references(() => practiceSessions.id, { onDelete: "cascade" }),
  playerId: uuid("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  station: text("station").notNull(),
  eventNumber: integer("event_number").notNull(),
  outcome: text("outcome").notNull(),
  throwQuality: text("throw_quality"),
  footwork: text("footwork"),
  decision: text("decision"),
  range: text("range"),
  errorType: text("error_type"),
  coachNote: text("coach_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  sessionIdx: index("defense_events_session_id_idx").on(table.sessionId),
  playerIdx: index("defense_events_player_id_idx").on(table.playerId),
}));

export const exercises = pgTable("exercises", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  unit: text("unit"),
  builtIn: boolean("built_in").default(false).notNull(),
  active: boolean("active").default(true).notNull(),
  ...timestamps,
}, (table) => ({
  uniqueExercise: uniqueIndex("exercises_org_name_key").on(table.organizationId, table.name),
}));

export const workouts = pgTable("workouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }),
  seasonId: uuid("season_id").references(() => seasons.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  active: boolean("active").default(true).notNull(),
  ...timestamps,
}, (table) => ({
  organizationIdx: index("workouts_organization_id_idx").on(table.organizationId),
}));

export const workoutSessions = pgTable("workout_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  seasonId: uuid("season_id").notNull().references(() => seasons.id, { onDelete: "cascade" }),
  workoutId: uuid("workout_id").references(() => workouts.id, { onDelete: "set null" }),
  playerId: uuid("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  sessionDate: date("session_date").notNull(),
  weekOf: date("week_of"),
  dayName: text("day_name"),
  completed: boolean("completed").default(false).notNull(),
  effortScore: integer("effort_score"),
  bodyWeight: numeric("body_weight"),
  notes: text("notes"),
  ...timestamps,
}, (table) => ({
  playerDateKey: uniqueIndex("workout_sessions_player_date_key").on(table.playerId, table.sessionDate),
  playerIdx: index("workout_sessions_player_id_idx").on(table.playerId),
}));

export const playerMeasurements = pgTable("player_measurements", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  playerId: uuid("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  measuredAt: timestamp("measured_at", { withTimezone: true }).defaultNow().notNull(),
  metricType: text("metric_type").notNull(),
  value: numeric("value").notNull(),
  unit: text("unit").notNull(),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  playerIdx: index("player_measurements_player_id_idx").on(table.playerId),
}));

export const workoutSets = pgTable("workout_sets", {
  id: uuid("id").primaryKey().defaultRandom(),
  workoutSessionId: uuid("workout_session_id").notNull().references(() => workoutSessions.id, { onDelete: "cascade" }),
  playerId: uuid("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  exerciseId: uuid("exercise_id").notNull().references(() => exercises.id, { onDelete: "restrict" }),
  setNumber: integer("set_number"),
  weight: numeric("weight"),
  reps: integer("reps"),
  sets: integer("sets"),
  value: numeric("value"),
  unit: text("unit"),
  rpe: numeric("rpe"),
  priorValue: numeric("prior_value"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  sessionIdx: index("workout_sets_session_id_idx").on(table.workoutSessionId),
  playerIdx: index("workout_sets_player_id_idx").on(table.playerId),
}));

export const games = pgTable("games", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  seasonId: uuid("season_id").notNull().references(() => seasons.id, { onDelete: "cascade" }),
  opponent: text("opponent").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  gameDate: date("game_date").notNull(),
  homeAway: homeAway("home_away").notNull(),
  location: text("location"),
  gameType: text("game_type").notNull(),
  status: gameStatus("status").default("scheduled").notNull(),
  ourScore: integer("our_score").default(0).notNull(),
  opponentScore: integer("opponent_score").default(0).notNull(),
  inning: integer("inning").default(1).notNull(),
  half: text("half").default("Top").notNull(),
  outs: integer("outs").default(0).notNull(),
  balls: integer("balls").default(0).notNull(),
  strikes: integer("strikes").default(0).notNull(),
  runners: jsonb("runners").default({}).notNull(),
  result: text("result"),
  currentPitcherId: uuid("current_pitcher_id").references(() => players.id, { onDelete: "set null" }),
  currentBatterId: uuid("current_batter_id").references(() => players.id, { onDelete: "set null" }),
  ...timestamps,
}, (table) => ({
  seasonIdx: index("games_season_id_idx").on(table.seasonId),
}));

export const gameLineups = pgTable("game_lineups", {
  gameId: uuid("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  playerId: uuid("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  battingOrder: integer("batting_order"),
  position: text("position"),
  isStartingPitcher: boolean("is_starting_pitcher").default(false).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.gameId, table.playerId] }),
}));

export const plateAppearances = pgTable("plate_appearances", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id").references(() => games.id, { onDelete: "cascade" }),
  practiceId: uuid("practice_id").references(() => practices.id, { onDelete: "cascade" }),
  pitcherId: uuid("pitcher_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  hitterId: uuid("hitter_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  outcome: text("outcome"),
  balls: integer("balls").default(0).notNull(),
  strikes: integer("strikes").default(0).notNull(),
  context: text("context").default("live_bp").notNull(),
});

export const gamePitchEvents = pgTable("game_pitch_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  inning: integer("inning").notNull(),
  half: text("half").notNull(),
  pitcherId: uuid("pitcher_id").references(() => players.id, { onDelete: "set null" }),
  batterId: uuid("batter_id").references(() => players.id, { onDelete: "set null" }),
  pitchType: text("pitch_type"),
  pitchOutcome: text("pitch_outcome"),
  ballInPlayOutcome: text("ball_in_play_outcome"),
  velocity: numeric("velocity"),
  location: jsonb("location"),
  outsBefore: integer("outs_before").notNull(),
  outsAfter: integer("outs_after").notNull(),
  ourRunsBefore: integer("our_runs_before").notNull(),
  ourRunsAfter: integer("our_runs_after").notNull(),
  opponentRunsBefore: integer("opponent_runs_before").notNull(),
  opponentRunsAfter: integer("opponent_runs_after").notNull(),
  situations: jsonb("situations").default([]).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  gameIdx: index("game_pitch_events_game_id_idx").on(table.gameId),
}));

export const playerNotes = pgTable("player_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  playerId: uuid("player_id").references(() => players.id, { onDelete: "cascade" }),
  practiceId: uuid("practice_id").references(() => practices.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id").references(() => practiceSessions.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").references(() => profiles.id, { onDelete: "set null" }),
  visibility: noteVisibility("visibility").default("coach_only").notNull(),
  tags: jsonb("tags").default([]).notNull(),
  note: text("note").notNull(),
  ...timestamps,
});

export const developmentGoals = pgTable("development_goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  playerId: uuid("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  tags: jsonb("tags").default([]).notNull(),
  completed: boolean("completed").default(false).notNull(),
  ...timestamps,
});

export const weeklyAwards = pgTable("weekly_awards", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  seasonId: uuid("season_id").notNull().references(() => seasons.id, { onDelete: "cascade" }),
  playerId: uuid("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  awardType: awardType("award_type").notNull(),
  weekStart: date("week_start").notNull(),
  weekEnd: date("week_end").notNull(),
  score: numeric("score"),
  summary: text("summary"),
  manualOverride: boolean("manual_override").default(false).notNull(),
  createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  awardKey: uniqueIndex("weekly_awards_unique_key").on(table.seasonId, table.playerId, table.awardType, table.weekStart),
}));

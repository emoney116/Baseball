import type {
  AppData,
  CoachNote,
  DefenseEvent,
  DefenseSession,
  DevelopmentGoal,
  Direction,
  Game,
  GameEvent,
  HittingContactQuality,
  HittingEvent,
  HittingSession,
  PitchEvent,
  PitchFocusTag,
  PitchOutcome,
  PitchType,
  PitchingSession,
  Player,
  Practice,
  PracticeAttendance,
  PracticeSessionContributor,
  RoundGoal,
  WorkoutEntry,
  WorkoutSession,
  ZonePoint,
} from "../types";

const createdAt = "2026-08-08T12:00:00.000Z";

export const players: Player[] = [
  {
    id: "p-jackson-smith",
    name: "Jackson Smith",
    jerseyNumber: 12,
    primaryPosition: "P",
    secondaryPosition: "SS",
    bats: "R",
    throws: "R",
    graduationYear: 2027,
    avatarColor: "#6f2543",
    isPitcher: true,
    isHitter: true,
    notes: "Two-way leader. Best when tempo stays aggressive.",
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: "p-ethan-brooks",
    name: "Ethan Brooks",
    jerseyNumber: 4,
    primaryPosition: "C",
    secondaryPosition: "3B",
    bats: "R",
    throws: "R",
    graduationYear: 2026,
    avatarColor: "#30343b",
    isPitcher: false,
    isHitter: true,
    notes: "Middle-order bat. Strong catcher receiving work.",
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: "p-mason-lee",
    name: "Mason Lee",
    jerseyNumber: 8,
    primaryPosition: "P",
    secondaryPosition: "1B",
    bats: "L",
    throws: "L",
    graduationYear: 2027,
    avatarColor: "#283847",
    isPitcher: true,
    isHitter: true,
    notes: "Lefty with natural arm-side run. Developing changeup.",
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: "p-noah-carter",
    name: "Noah Carter",
    jerseyNumber: 22,
    primaryPosition: "CF",
    secondaryPosition: "P",
    bats: "R",
    throws: "R",
    graduationYear: 2028,
    avatarColor: "#294137",
    isPitcher: true,
    isHitter: true,
    notes: "Athletic mover. Biggest jump in bat speed this fall.",
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: "p-luke-johnson",
    name: "Luke Johnson",
    jerseyNumber: 31,
    primaryPosition: "P",
    secondaryPosition: "RF",
    bats: "R",
    throws: "R",
    graduationYear: 2026,
    avatarColor: "#3a304f",
    isPitcher: true,
    isHitter: true,
    notes: "Power arm. Needs repeatable slider release window.",
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: "p-caleb-martin",
    name: "Caleb Martin",
    jerseyNumber: 16,
    primaryPosition: "SS",
    secondaryPosition: "2B",
    bats: "S",
    throws: "R",
    graduationYear: 2027,
    avatarColor: "#23344a",
    isPitcher: false,
    isHitter: true,
    notes: "Switch hitter. Plus barrel control from left side.",
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: "p-isaac-wilson",
    name: "Isaac Wilson",
    jerseyNumber: 27,
    primaryPosition: "P",
    secondaryPosition: "3B",
    bats: "R",
    throws: "R",
    graduationYear: 2028,
    avatarColor: "#30343b",
    isPitcher: true,
    isHitter: true,
    notes: "Sinker/slider profile. Competes in the zone.",
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: "p-tyler-adams",
    name: "Tyler Adams",
    jerseyNumber: 2,
    primaryPosition: "2B",
    secondaryPosition: "SS",
    bats: "R",
    throws: "R",
    graduationYear: 2027,
    avatarColor: "#6f2543",
    isPitcher: false,
    isHitter: true,
    notes: "High-contact profile. Strong situational approach.",
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: "p-ben-parker",
    name: "Ben Parker",
    jerseyNumber: 11,
    primaryPosition: "LF",
    secondaryPosition: "CF",
    bats: "L",
    throws: "R",
    graduationYear: 2026,
    avatarColor: "#283847",
    isPitcher: false,
    isHitter: true,
    notes: "Pull-side juice. Working on staying through middle.",
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: "p-owen-clark",
    name: "Owen Clark",
    jerseyNumber: 19,
    primaryPosition: "P",
    secondaryPosition: "C",
    bats: "R",
    throws: "R",
    graduationYear: 2028,
    avatarColor: "#294137",
    isPitcher: true,
    isHitter: true,
    notes: "Fresh arm. Good extension when front side stays firm.",
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: "p-will-davis",
    name: "Will Davis",
    jerseyNumber: 6,
    primaryPosition: "3B",
    secondaryPosition: "1B",
    bats: "R",
    throws: "R",
    graduationYear: 2026,
    avatarColor: "#3a304f",
    isPitcher: false,
    isHitter: true,
    notes: "Middle-field bat path has improved across fall work.",
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: "p-grayson-hall",
    name: "Grayson Hall",
    jerseyNumber: 24,
    primaryPosition: "P",
    secondaryPosition: "UTL",
    bats: "R",
    throws: "R",
    graduationYear: 2027,
    avatarColor: "#23344a",
    isPitcher: true,
    isHitter: true,
    notes: "High-spin breaking ball. Needs fastball strike baseline.",
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: "p-samuel-reed",
    name: "Samuel Reed",
    jerseyNumber: 3,
    primaryPosition: "RF",
    secondaryPosition: "LF",
    bats: "L",
    throws: "L",
    graduationYear: 2028,
    avatarColor: "#30343b",
    isPitcher: false,
    isHitter: true,
    notes: "Left-handed outfielder. Good opposite-field intent.",
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: "p-levi-turner",
    name: "Levi Turner",
    jerseyNumber: 9,
    primaryPosition: "1B",
    secondaryPosition: "P",
    bats: "R",
    throws: "R",
    graduationYear: 2027,
    avatarColor: "#6f2543",
    isPitcher: true,
    isHitter: true,
    notes: "Physical bat. Pitching focus is tempo and strike one.",
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: "p-daniel-moore",
    name: "Daniel Moore",
    jerseyNumber: 14,
    primaryPosition: "CF",
    secondaryPosition: "LF",
    bats: "R",
    throws: "R",
    graduationYear: 2026,
    avatarColor: "#283847",
    isPitcher: false,
    isHitter: true,
    notes: "Gap runner. Strong machine-round contact quality.",
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: "p-joshua-king",
    name: "Joshua King",
    jerseyNumber: 33,
    primaryPosition: "C",
    secondaryPosition: "1B",
    bats: "R",
    throws: "R",
    graduationYear: 2028,
    avatarColor: "#294137",
    isPitcher: false,
    isHitter: true,
    notes: "Young catcher. Working on catching barrel out front.",
    createdAt,
    updatedAt: createdAt,
  },
];

const allPlayerIds = players.map((player) => player.id);
const hitterIds = players.filter((player) => player.isHitter).map((player) => player.id);

export const practices: Practice[] = [
  {
    id: "practice-aug8",
    date: "2026-08-08",
    name: "Aug 8 Fall Practice",
    type: "Full Practice",
    location: "Metrolina Varsity Field",
    notes: "Bullpens first, then machine rounds and live BP.",
    playerIds: allPlayerIds,
    pitcherIds: ["p-jackson-smith", "p-mason-lee", "p-noah-carter", "p-luke-johnson", "p-isaac-wilson"],
    hitterIds,
    startedAt: "2026-08-08T13:00:00.000Z",
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: "practice-aug6",
    date: "2026-08-06",
    name: "Aug 6 Live BP",
    type: "Live BP",
    location: "Metrolina Varsity Field",
    notes: "Focused on compete counts and two-strike execution.",
    playerIds: allPlayerIds.slice(0, 14),
    pitcherIds: ["p-luke-johnson", "p-grayson-hall", "p-owen-clark", "p-levi-turner"],
    hitterIds: hitterIds.slice(0, 13),
    startedAt: "2026-08-06T22:00:00.000Z",
    endedAt: "2026-08-06T23:48:00.000Z",
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: "practice-aug4",
    date: "2026-08-04",
    name: "Aug 4 Hitting Day",
    type: "Hitting Day",
    location: "Indoor Facility",
    notes: "Machine velocity block plus approach rounds.",
    playerIds: allPlayerIds.slice(1),
    pitcherIds: ["p-mason-lee", "p-isaac-wilson"],
    hitterIds: hitterIds.slice(1),
    startedAt: "2026-08-04T21:30:00.000Z",
    endedAt: "2026-08-04T23:15:00.000Z",
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: "practice-aug1",
    date: "2026-08-01",
    name: "Aug 1 Bullpen Day",
    type: "Bullpen Day",
    location: "Metrolina Bullpen Lanes",
    notes: "Fastball command baseline and offspeed feel.",
    playerIds: allPlayerIds.slice(0, 12),
    pitcherIds: ["p-jackson-smith", "p-mason-lee", "p-noah-carter", "p-grayson-hall", "p-levi-turner"],
    hitterIds: hitterIds.slice(0, 8),
    startedAt: "2026-08-01T14:00:00.000Z",
    endedAt: "2026-08-01T15:35:00.000Z",
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: "practice-jul29",
    date: "2026-07-29",
    name: "July 29 Development",
    type: "Pitcher Development",
    location: "Metrolina Varsity Field",
    notes: "Short mound work and front-toss approach stations.",
    playerIds: allPlayerIds.slice(0, 15),
    pitcherIds: ["p-luke-johnson", "p-isaac-wilson", "p-owen-clark"],
    hitterIds: hitterIds.slice(0, 14),
    startedAt: "2026-07-29T22:00:00.000Z",
    endedAt: "2026-07-29T23:30:00.000Z",
    createdAt,
    updatedAt: createdAt,
  },
];

export const attendance: PracticeAttendance[] = practices.flatMap((practice) =>
  practice.playerIds.map((playerId) => {
    const player = players.find((item) => item.id === playerId);
    const role =
      player?.isPitcher && player?.isHitter
        ? "Two-way"
        : player?.isPitcher
          ? "Pitcher"
          : player?.isHitter
            ? "Hitter"
            : "Observer";

    return {
      id: `att-${practice.id}-${playerId}`,
      practiceId: practice.id,
      playerId,
      role,
      status: "Present",
      checkedInAt: practice.startedAt,
      updatedAt: practice.startedAt,
    };
  }),
);

export const pitchingSessions: PitchingSession[] = [
  makePitchingSession("ps-aug8-jackson", "practice-aug8", "p-jackson-smith", "Bullpen", ["Fastball command", "Slider", "Strike throwing"]),
  makePitchingSession("ps-aug8-mason", "practice-aug8", "p-mason-lee", "Live BP", ["Changeup development", "Sequencing", "Strike throwing"], "p-ethan-brooks"),
  makePitchingSession("ps-aug6-luke", "practice-aug6", "p-luke-johnson", "Live BP", ["Velocity", "Two-strike pitches", "Breaking ball development"], "p-caleb-martin", true),
  makePitchingSession("ps-aug6-grayson", "practice-aug6", "p-grayson-hall", "Live BP", ["Fastball command", "Breaking ball development"], "p-ben-parker", true),
  makePitchingSession("ps-aug1-jackson", "practice-aug1", "p-jackson-smith", "Bullpen", ["Fastball command", "Mechanics", "Velocity"]),
  makePitchingSession("ps-aug1-levi", "practice-aug1", "p-levi-turner", "Bullpen", ["Strike throwing", "Mechanics"]),
  makePitchingSession("ps-jul29-isaac", "practice-jul29", "p-isaac-wilson", "Bullpen", ["Secondary command", "Strike throwing"]),
];

export const hittingSessions: HittingSession[] = [
  makeHittingSession("hs-aug8-ethan", "practice-aug8", "p-ethan-brooks", "Machine", ["Line drives", "Fastball timing", "Middle"], 18, 82),
  makeHittingSession("hs-aug8-caleb", "practice-aug8", "p-caleb-martin", "Coach BP", ["Oppo", "Approach"], 22),
  makeHittingSession("hs-aug6-ben", "practice-aug6", "p-ben-parker", "Live BP", ["Two-strike", "Situational"], 12),
  makeHittingSession("hs-aug4-daniel", "practice-aug4", "p-daniel-moore", "Machine", ["Velocity", "Line drives"], 25, 86),
  makeHittingSession("hs-aug4-tyler", "practice-aug4", "p-tyler-adams", "Front Toss", ["Middle", "Line drives"], 24),
  makeHittingSession("hs-aug1-samuel", "practice-aug1", "p-samuel-reed", "Tee", ["Oppo", "Approach"], 20),
  makeHittingSession("hs-jul29-will", "practice-jul29", "p-will-davis", "Coach BP", ["Pull", "Situational"], 21),
];

export const pitchEvents: PitchEvent[] = pitchingSessions.flatMap((session, sessionIndex) =>
  generatePitchEvents(session, sessionIndex),
);

export const hittingEvents: HittingEvent[] = hittingSessions.flatMap((session, sessionIndex) =>
  generateHittingEvents(session, sessionIndex),
);

export const defenseSessions: DefenseSession[] = [
  {
    id: "ds-aug8-caleb",
    practiceId: "practice-aug8",
    playerId: "p-caleb-martin",
    station: "Infield",
    title: "Defense - Infield",
    status: "ACTIVE",
    createdByProfileId: "demo-coach-martin",
    contributorProfileIds: ["demo-coach-martin"],
    location: "Infield",
    entryPolicy: "COACH_ONLY",
    mode: "Drill",
    plannedReps: 20,
    startedAt: "2026-08-08T14:42:00.000Z",
    summaryNote: "Clean rhythm through routine balls. Best exchange was on slow rollers.",
  },
  {
    id: "ds-aug8-noah",
    practiceId: "practice-aug8",
    playerId: "p-noah-carter",
    station: "Outfield",
    title: "Defense - Outfield",
    status: "ACTIVE",
    createdByProfileId: "demo-coach-martin",
    contributorProfileIds: ["demo-coach-martin"],
    location: "Outfield",
    entryPolicy: "COACH_ONLY",
    mode: "Quick Practice",
    plannedReps: 16,
    startedAt: "2026-08-08T14:48:00.000Z",
    summaryNote: "Routes were direct and throws stayed online.",
  },
  {
    id: "ds-aug6-ethan",
    practiceId: "practice-aug6",
    playerId: "p-ethan-brooks",
    station: "Catching",
    title: "Catching",
    status: "COMPLETED",
    createdByProfileId: "demo-coach-martin",
    contributorProfileIds: ["demo-coach-martin"],
    location: "Bullpen",
    entryPolicy: "COACH_ONLY",
    mode: "Drill",
    plannedReps: 18,
    startedAt: "2026-08-06T22:36:00.000Z",
    endedAt: "2026-08-06T23:02:00.000Z",
    summaryNote: "Receiving presentation improved late in the block.",
  },
];

export const defenseEvents: DefenseEvent[] = defenseSessions.flatMap((session, sessionIndex) =>
  generateDefenseEvents(session, sessionIndex),
);

export const practiceSessionContributors: PracticeSessionContributor[] = [
  ...pitchingSessions.slice(0, 2).map((session, index) => ({
    id: `psc-${session.id}`,
    sessionId: session.id,
    profileId: index === 0 ? "demo-coach-eric" : "demo-coach-darren",
    role: "COACH" as const,
    joinedAt: session.startedAt,
    lastActiveAt: addMinutes(session.startedAt, 18 + index * 8),
  })),
  ...hittingSessions.slice(0, 2).map((session, index) => ({
    id: `psc-${session.id}`,
    sessionId: session.id,
    profileId: index === 0 ? "demo-coach-ashlock" : "demo-coach-eric",
    role: "COACH" as const,
    joinedAt: session.startedAt,
    lastActiveAt: addMinutes(session.startedAt, 24 + index * 5),
  })),
  {
    id: "psc-ds-aug8-caleb",
    sessionId: "ds-aug8-caleb",
    profileId: "demo-coach-martin",
    role: "COACH",
    joinedAt: "2026-08-08T14:42:00.000Z",
    lastActiveAt: "2026-08-08T15:05:00.000Z",
  },
];

const workoutDays: Array<{ day: WorkoutSession["day"]; date: string }> = [
  { day: "Mon", date: "2026-08-03" },
  { day: "Tue", date: "2026-08-04" },
  { day: "Thu", date: "2026-08-06" },
  { day: "Fri", date: "2026-08-07" },
];

export const workoutSessions: WorkoutSession[] = allPlayerIds.slice(0, 14).flatMap((playerId, playerIndex) =>
  workoutDays.map((day, dayIndex) => {
    const completed = (playerIndex + dayIndex) % 9 !== 0;
    return {
      id: `ws-${playerId}-${day.day.toLowerCase()}`,
      playerId,
      date: day.date,
      weekOf: "2026-08-03",
      day: day.day,
      completed,
      effortScore: completed ? 7 + ((playerIndex + dayIndex) % 4) : 0,
      bodyWeight: 156 + playerIndex * 5 + (playerIndex % 3) * 3,
      createdAt: `${day.date}T13:00:00.000Z`,
      updatedAt: `${day.date}T13:00:00.000Z`,
    };
  }),
);

export const workoutEntries: WorkoutEntry[] = workoutSessions.flatMap((session, sessionIndex) => {
  if (!session.completed) return [];
  const playerIndex = allPlayerIds.indexOf(session.playerId);
  const squat = 185 + playerIndex * 8 + (sessionIndex % 4) * 5;
  const bench = 135 + playerIndex * 5 + (sessionIndex % 3) * 5;
  const trap = 255 + playerIndex * 10 + (sessionIndex % 4) * 10;
  const vertical = 25 + (playerIndex % 7) * 0.8 + (sessionIndex % 3) * 0.4;

  return [
    {
      id: `we-${session.id}-squat`,
      sessionId: session.id,
      playerId: session.playerId,
      exercise: "Back Squat",
      kind: "Lift",
      weight: squat,
      reps: 5,
      sets: 3,
      priorValue: squat - 15 - (playerIndex % 4) * 5,
      createdAt: `${session.date}T13:15:00.000Z`,
    },
    {
      id: `we-${session.id}-bench`,
      sessionId: session.id,
      playerId: session.playerId,
      exercise: "Bench Press",
      kind: "Lift",
      weight: bench,
      reps: 5,
      sets: 3,
      priorValue: bench - 10 - (playerIndex % 3) * 5,
      createdAt: `${session.date}T13:38:00.000Z`,
    },
    {
      id: `we-${session.id}-trap`,
      sessionId: session.id,
      playerId: session.playerId,
      exercise: "Trap Bar Deadlift",
      kind: "Lift",
      weight: trap,
      reps: 3,
      sets: 3,
      priorValue: trap - 20 - (playerIndex % 5) * 5,
      createdAt: `${session.date}T14:02:00.000Z`,
    },
    ...(session.day === "Thu"
      ? [
          {
            id: `we-${session.id}-vertical`,
            sessionId: session.id,
            playerId: session.playerId,
            exercise: "Vertical Jump",
            kind: "Jump" as const,
            value: Number(vertical.toFixed(1)),
            unit: "in" as const,
            priorValue: Number((vertical - 1.2 - (playerIndex % 3) * 0.4).toFixed(1)),
            createdAt: `${session.date}T14:18:00.000Z`,
          },
        ]
      : []),
  ];
});

export const games: Game[] = [
  {
    id: "game-aug7-charlotte",
    date: "2026-08-07",
    opponent: "Charlotte Christian",
    homeAway: "Home",
    location: "Metrolina Varsity Field",
    type: "Fall Game",
    result: "W",
    metrolinaScore: 7,
    opponentScore: 3,
    inning: 7,
    half: "Bottom",
    outs: 3,
    balls: 0,
    strikes: 0,
    runners: {},
    lineup: allPlayerIds.slice(0, 9),
    positions: {
      P: "p-jackson-smith",
      C: "p-ethan-brooks",
      "1B": "p-mason-lee",
      "2B": "p-tyler-adams",
      "3B": "p-will-davis",
      SS: "p-caleb-martin",
      LF: "p-ben-parker",
      CF: "p-noah-carter",
      RF: "p-daniel-moore",
    },
    startingPitcherId: "p-jackson-smith",
    currentPitcherId: "p-jackson-smith",
    currentBatterId: "p-ethan-brooks",
    createdAt: "2026-08-07T22:00:00.000Z",
    updatedAt: "2026-08-07T23:58:00.000Z",
  },
  {
    id: "game-aug14-covenant",
    date: "2026-08-14",
    opponent: "Covenant Day",
    homeAway: "Away",
    location: "Covenant Day",
    type: "Scrimmage",
    metrolinaScore: 0,
    opponentScore: 0,
    inning: 1,
    half: "Top",
    outs: 0,
    balls: 0,
    strikes: 0,
    runners: {},
    lineup: allPlayerIds.slice(0, 9),
    positions: {
      P: "p-luke-johnson",
      C: "p-ethan-brooks",
      "1B": "p-levi-turner",
      "2B": "p-tyler-adams",
      "3B": "p-will-davis",
      SS: "p-caleb-martin",
      LF: "p-ben-parker",
      CF: "p-noah-carter",
      RF: "p-daniel-moore",
    },
    startingPitcherId: "p-luke-johnson",
    currentPitcherId: "p-luke-johnson",
    currentBatterId: "p-caleb-martin",
    createdAt: "2026-08-08T12:30:00.000Z",
    updatedAt: "2026-08-08T12:30:00.000Z",
  },
];

export const gameEvents: GameEvent[] = [
  {
    id: "ge-aug7-1",
    gameId: "game-aug7-charlotte",
    inning: 1,
    half: "Bottom",
    pitcherId: "p-jackson-smith",
    batterId: "p-caleb-martin",
    pitchOutcome: "Called Strike",
    outsBefore: 0,
    outsAfter: 0,
    metrolinaRunsBefore: 0,
    metrolinaRunsAfter: 0,
    opponentRunsBefore: 0,
    opponentRunsAfter: 0,
    situations: ["Leadoff", "First-pitch strike"],
    createdAt: "2026-08-07T22:08:00.000Z",
  },
  {
    id: "ge-aug7-2",
    gameId: "game-aug7-charlotte",
    inning: 3,
    half: "Bottom",
    pitcherId: "p-jackson-smith",
    batterId: "p-ethan-brooks",
    pitchOutcome: "In Play",
    ballInPlayOutcome: "Double",
    outsBefore: 1,
    outsAfter: 1,
    metrolinaRunsBefore: 2,
    metrolinaRunsAfter: 4,
    opponentRunsBefore: 1,
    opponentRunsAfter: 1,
    situations: ["RISP", "Quality AB", "2-out hitting"],
    createdAt: "2026-08-07T22:54:00.000Z",
  },
  {
    id: "ge-aug7-3",
    gameId: "game-aug7-charlotte",
    inning: 6,
    half: "Top",
    pitcherId: "p-luke-johnson",
    batterId: "p-ben-parker",
    pitchOutcome: "Swinging Strike",
    outsBefore: 2,
    outsAfter: 3,
    metrolinaRunsBefore: 7,
    metrolinaRunsAfter: 7,
    opponentRunsBefore: 3,
    opponentRunsAfter: 3,
    situations: ["Shutdown inning", "Two-out pitching"],
    createdAt: "2026-08-07T23:37:00.000Z",
  },
];

export const coachNotes: CoachNote[] = [
  {
    id: "note-jackson-command",
    scope: { type: "Player", playerId: "p-jackson-smith" },
    tags: ["Command", "Velocity"],
    text: "Best glove-side fastball command of the fall. Keep the tempo, especially from the stretch.",
    createdAt: "2026-08-08T16:10:00.000Z",
    updatedAt: "2026-08-08T16:10:00.000Z",
  },
  {
    id: "note-ben-oppo",
    scope: { type: "Player", playerId: "p-ben-parker" },
    tags: ["Approach", "Timing"],
    text: "Stayed through middle/oppo in round two and drove three line drives to left-center.",
    createdAt: "2026-08-06T23:20:00.000Z",
    updatedAt: "2026-08-06T23:20:00.000Z",
  },
  {
    id: "note-luke-slider",
    scope: { type: "PitchingSession", sessionId: "ps-aug6-luke", playerId: "p-luke-johnson" },
    tags: ["Mechanics", "Development Goal"],
    text: "Slider is plus when arm speed matches fastball. Finish out front and avoid cutting it.",
    createdAt: "2026-08-06T23:35:00.000Z",
    updatedAt: "2026-08-06T23:35:00.000Z",
  },
  {
    id: "note-aug8-practice",
    scope: { type: "Practice", practiceId: "practice-aug8" },
    tags: ["Development Goal"],
    text: "Prioritize fast player rotations. Coaches should keep active station summaries updated before ending sessions.",
    createdAt: "2026-08-08T13:30:00.000Z",
    updatedAt: "2026-08-08T13:30:00.000Z",
  },
];

export const developmentGoals: DevelopmentGoal[] = [
  makeGoal("goal-jackson-1", "p-jackson-smith", "Fastball glove-side command", ["Command"]),
  makeGoal("goal-jackson-2", "p-jackson-smith", "Land slider for strikes before using chase shape", ["Mechanics"]),
  makeGoal("goal-ben-1", "p-ben-parker", "Stay through middle/oppo during velocity rounds", ["Approach", "Timing"]),
  makeGoal("goal-mason-1", "p-mason-lee", "Throw changeup in fastball counts with conviction", ["Command"]),
  makeGoal("goal-caleb-1", "p-caleb-martin", "Improve two-strike approach and shorten with two strikes", ["Approach"]),
  makeGoal("goal-luke-1", "p-luke-johnson", "Maintain velocity late in bullpen", ["Velocity", "Mechanics"]),
  makeGoal("goal-ethan-1", "p-ethan-brooks", "Catch more barrels out front against machine velo", ["Timing"]),
];

export const sampleData: AppData = {
  players,
  playerTeamMemberships: [],
  rosterImports: [],
  practices,
  attendance,
  practiceSessionContributors,
  pitchingSessions,
  pitchEvents,
  hittingSessions,
  hittingEvents,
  defenseSessions,
  defenseEvents,
  weightRoomExercises: [],
  weightRoomWorkouts: [],
  weightRoomWorkoutStations: [],
  weightRoomWorkoutGroups: [],
  weightRoomWorkoutGroupMembers: [],
  weightRoomExercisePresets: [],
  weightRoomExercisePresetItems: [],
  weightRoomGroupPresets: [],
  weightRoomGroupPresetGroups: [],
  weightRoomGroupPresetMembers: [],
  workoutSessions,
  workoutEntries,
  scheduleEvents: [],
  games,
  gameEvents,
  plateAppearances: [],
  coachNotes,
  developmentGoals,
  settings: {
    activePracticeId: "practice-aug8",
    theme: "dark",
    rosterSeason: "Fall 2026",
    recentPlayerIds: ["p-jackson-smith", "p-ethan-brooks", "p-mason-lee", "p-caleb-martin", "p-luke-johnson"],
  },
};

function makePitchingSession(
  id: string,
  practiceId: string,
  pitcherId: string,
  type: PitchingSession["type"],
  focusTags: Array<PitchFocusTag | "Slider">,
  hitterId?: string,
  ended = false,
): PitchingSession {
  return {
    id,
    practiceId,
    pitcherId,
    type,
    title: type,
    status: ended ? "COMPLETED" : "ACTIVE",
    createdByProfileId: hitterId ? "demo-coach-darren" : "demo-coach-eric",
    contributorProfileIds: hitterId ? ["demo-coach-darren"] : ["demo-coach-eric"],
    location: type === "Live BP" ? "Main Field" : "Bullpen - Field 1",
    station: type === "Live BP" ? "Main Field" : "Bullpen - Field 1",
    entryPolicy: "COACH_ONLY",
    catcherId: "p-ethan-brooks",
    hitterId,
    focusTags: focusTags.map((tag) => (tag === "Slider" ? "Breaking ball development" : tag)),
    intendedFocus:
      type === "Live BP"
        ? "Win strike one, expand with two-strike secondary."
        : "Stay over the rubber and finish glove-side fastballs.",
    startedAt: practices.find((practice) => practice.id === practiceId)?.startedAt ?? createdAt,
    endedAt: ended ? practices.find((practice) => practice.id === practiceId)?.endedAt : undefined,
    summaryNote: ended ? "Strong compete level. Fastball played best when extension stayed direct." : undefined,
    sessionGrade: ended ? "A-" : undefined,
  };
}

function makeHittingSession(
  id: string,
  practiceId: string,
  hitterId: string,
  type: HittingSession["type"],
  roundGoals: RoundGoal[],
  plannedReps: number,
  machineVelocity?: number,
): HittingSession {
  return {
    id,
    practiceId,
    hitterId,
    type,
    title: type === "Machine" ? "Machine BP" : type,
    status: practiceId === "practice-aug8" ? "ACTIVE" : "COMPLETED",
    createdByProfileId: "demo-coach-ashlock",
    contributorProfileIds: ["demo-coach-ashlock"],
    location: type === "Machine" ? "Cage 1" : "Main Field",
    station: type === "Machine" ? "Cage 1" : type,
    entryPolicy: "COACH_AND_ASSIGNED_PLAYERS",
    roundGoals,
    plannedReps,
    machineVelocity,
    machinePitchType: machineVelocity ? "4-Seam" : undefined,
    pitchTrackingMode: machineVelocity ? "ONE" : type === "Coach BP" ? "ONE" : "OFF",
    defaultPitchType: machineVelocity || type === "Coach BP" ? "4-Seam" : undefined,
    machineLocation: machineVelocity ? "Middle-away" : undefined,
    distance: type === "Machine" ? "55 ft" : undefined,
    coachBpStyle: type === "Coach BP" ? "Overhand" : type === "Front Toss" ? "Front toss" : undefined,
    startedAt: practices.find((practice) => practice.id === practiceId)?.startedAt ?? createdAt,
    endedAt: practiceId === "practice-aug8" ? undefined : practices.find((practice) => practice.id === practiceId)?.endedAt,
    summaryNote: practiceId === "practice-aug8" ? undefined : "Round finished with better direction and fewer rollovers.",
    sessionGrade: practiceId === "practice-aug8" ? undefined : "B+",
  };
}

function makeGoal(id: string, playerId: string, title: string, tags: DevelopmentGoal["tags"]): DevelopmentGoal {
  return {
    id,
    playerId,
    title,
    tags,
    createdAt,
    updatedAt: createdAt,
  };
}

function generateDefenseEvents(session: DefenseSession, sessionIndex: number): DefenseEvent[] {
  const outcomes: DefenseEvent["outcome"][] = ["Clean", "Good Play", "Clean", "Great Play", "Clean", "Error"];
  const count = session.plannedReps ?? 14;

  return Array.from({ length: count }, (_, index) => {
    const outcome = outcomes[(index + sessionIndex) % outcomes.length];
    const isError = outcome === "Error";

    return {
      id: `${session.id}-def-${index + 1}`,
      practiceId: session.practiceId,
      sessionId: session.id,
      playerId: session.playerId,
      station: session.station,
      eventNumber: index + 1,
      outcome,
      throwQuality: index % 5 === 0 ? "Plus" : index % 4 === 0 ? "Average" : "Good",
      footwork: index % 6 === 0 ? "Plus" : index % 5 === 0 ? "Needs work" : "Solid",
      decision: index % 7 === 0 ? "Advanced" : "Correct",
      range: outcome === "Great Play" ? "Plus" : outcome === "Good Play" ? "Difficult" : "Routine",
      errorType: isError ? (index % 2 === 0 ? "Fielding" : "Throwing") : undefined,
      createdByProfileId: session.createdByProfileId,
      entrySource: "COACH",
      verificationStatus: "COACH_RECORDED",
      idempotencyKey: `${session.id}-def-${index + 1}`,
      sessionSequence: index + 1,
      createdAt: addMinutes(session.startedAt, index + sessionIndex * 2),
    };
  });
}

function generatePitchEvents(session: PitchingSession, sessionIndex: number): PitchEvent[] {
  const pitchTypes: PitchType[] = ["4-Seam", "4-Seam", "Slider", "Changeup", "2-Seam", "Curveball"];
  const outcomes: PitchOutcome[] = [
    "Called Strike",
    "Ball",
    "Whiff",
    "Foul",
    "Ball in play",
    "Called Strike",
    "Ball",
    "Whiff",
  ];
  const count = session.type === "Live BP" ? 26 + sessionIndex * 2 : 22 + sessionIndex * 3;
  const events: PitchEvent[] = [];
  let balls = 0;
  let strikes = 0;

  for (let index = 0; index < count; index += 1) {
    const outcome = outcomes[(index + sessionIndex) % outcomes.length];
    const isStrike = outcome !== "Ball" && outcome !== "HBP";
    const isSwing = outcome === "Whiff" || outcome === "Foul" || outcome === "Swing" || outcome === "Ball in play";
    const isBallInPlay = outcome === "Ball in play";
    const location = makeZonePoint(index, sessionIndex);
    const countBefore = { balls, strikes };

    if (outcome === "Ball" && balls < 3) balls += 1;
    if (isStrike && outcome !== "Ball in play" && strikes < 2) strikes += 1;
    if (isBallInPlay || balls === 3 || strikes === 2) {
      balls = 0;
      strikes = 0;
    }

    events.push({
      id: `${session.id}-pitch-${index + 1}`,
      practiceId: session.practiceId,
      sessionId: session.id,
      pitcherId: session.pitcherId,
      hitterId: session.hitterId,
      pitchNumber: index + 1,
      pitchType: pitchTypes[(index + sessionIndex) % pitchTypes.length],
      outcome,
      isStrike,
      isSwing,
      isZone: location.x >= 0.22 && location.x <= 0.78 && location.y >= 0.18 && location.y <= 0.82,
      isChase: isSwing && (location.x < 0.22 || location.x > 0.78 || location.y < 0.18 || location.y > 0.82),
      isWhiff: outcome === "Whiff",
      isCalledStrike: outcome === "Called Strike",
      isBallInPlay,
      battedBall: isBallInPlay ? (index % 3 === 0 ? "Line drive" : index % 3 === 1 ? "Ground ball" : "Fly ball") : undefined,
      contactQuality: isBallInPlay ? (index % 4 === 0 ? "Hard contact" : index % 4 === 1 ? "Medium contact" : "Weak contact") : undefined,
      velocity:
        pitchTypes[(index + sessionIndex) % pitchTypes.length] === "4-Seam" || pitchTypes[(index + sessionIndex) % pitchTypes.length] === "2-Seam"
          ? 79 + ((index + sessionIndex) % 9)
          : 71 + ((index + sessionIndex) % 7),
      qualityRating: 3 + ((index + sessionIndex) % 3),
      missedIntendedLocation: index % 5 === 0,
      intendedTarget: { x: 0.32, y: 0.44 },
      location,
      countBefore,
      countAfter: { balls, strikes },
      createdByProfileId: session.createdByProfileId,
      entrySource: "COACH",
      verificationStatus: "COACH_RECORDED",
      idempotencyKey: `${session.id}-pitch-${index + 1}`,
      sessionSequence: index + 1,
      createdAt: addMinutes(session.startedAt, index * 2 + sessionIndex),
    });
  }

  return events;
}

function generateHittingEvents(session: HittingSession, sessionIndex: number): HittingEvent[] {
  const actions: HittingEvent["action"][] = ["Ball in play", "Swing", "Foul", "Ball in play", "Miss", "Ball in play", "Took pitch"];
  const qualities: HittingContactQuality[] = ["Barrel", "Hard", "Solid", "Weak", "Poor"];
  const directions: Direction[] = ["LF", "LCF", "CF", "RCF", "RF", "Middle", "Pull", "Opposite"];
  const count = session.plannedReps ?? 18;

  return Array.from({ length: count }, (_, index) => {
    const action = actions[(index + sessionIndex) % actions.length];
    const inPlay = action === "Ball in play";
    const fieldLocation = makeFieldPoint(index, sessionIndex);

    return {
      id: `${session.id}-hit-${index + 1}`,
      practiceId: session.practiceId,
      sessionId: session.id,
      hitterId: session.hitterId,
      eventNumber: index + 1,
      action,
      contactResult: inPlay ? (index % 4 === 0 ? "Line drive" : index % 4 === 1 ? "Ground ball" : index % 4 === 2 ? "Fly ball" : "Pop up") : undefined,
      contactQuality: inPlay ? qualities[(index + sessionIndex) % qualities.length] : undefined,
      direction: inPlay ? directions[(index + sessionIndex) % directions.length] : undefined,
      fieldLocation: inPlay ? fieldLocation : undefined,
      pitchType: session.machinePitchType ?? (session.type === "Live BP" ? "4-Seam" : undefined),
      velocity: session.machineVelocity,
      isLiveBp: session.type === "Live BP",
      createdByProfileId: session.createdByProfileId,
      entrySource: "COACH",
      verificationStatus: "COACH_RECORDED",
      idempotencyKey: `${session.id}-hit-${index + 1}`,
      sessionSequence: index + 1,
      createdAt: addMinutes(session.startedAt, index + sessionIndex * 2),
    };
  });
}

function makeZonePoint(index: number, offset: number): ZonePoint {
  const x = 0.08 + (((index * 37 + offset * 11) % 86) / 100);
  const y = 0.06 + (((index * 29 + offset * 17) % 88) / 100);
  return { x: Math.min(0.96, x), y: Math.min(0.96, y) };
}

function makeFieldPoint(index: number, offset: number): ZonePoint {
  const angle = 215 + ((index * 31 + offset * 17) % 110);
  const distance = 0.34 + (((index * 13 + offset * 5) % 48) / 100);
  const radians = (angle * Math.PI) / 180;
  return {
    x: 0.5 + Math.cos(radians) * distance,
    y: 0.88 + Math.sin(radians) * distance,
  };
}

function addMinutes(base: string, minutes: number): string {
  const date = new Date(base);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

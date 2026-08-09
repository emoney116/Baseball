"use client";

import {
  Archive,
  BarChart3,
  Check,
  ChevronRight,
  ClipboardList,
  Dumbbell,
  Edit3,
  Gauge,
  Home,
  MapPin,
  Moon,
  Play,
  Plus,
  Save,
  Search,
  Shield,
  Sun,
  Trophy,
  Undo2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { BaseballField, DonutChart, Heatmap, MetricBar, MiniLineChart, PlayerAvatar, StatTile, StrikeZone } from "./components/visuals";
import { createId, gameRepository, playerRepository, touchRecentPlayers, workoutRepository } from "./data/repository";
import { authRepository, PersistenceError, supabaseAppRepository, type AuthState } from "./data/supabaseRepository";
import {
  activePractice,
  buildHittingLeaders,
  buildPitchingLeaders,
  calculateHittingStats,
  calculatePitchingStats,
  formatDecimal,
  formatNumber,
  formatPct,
  fullDate,
  pct,
  playerHittingEvents,
  playerPitchEvents,
  practiceHittingEvents,
  practicePitchEvents,
  shortDate,
  trendByPractice,
} from "./lib/stats";
import type {
  AppData,
  BattedBallType,
  DefenseEvent,
  DefenseOutcome,
  DefenseStation,
  Direction,
  Game,
  GameBallInPlayOutcome,
  GamePitchOutcome,
  GameType,
  HittingContactQuality,
  HittingEvent,
  HittingSession,
  ID,
  PitchOutcome,
  PitchEvent,
  PitchType,
  PitchingSession,
  Player,
  Position,
  Practice,
  PracticeType,
  RosterStatus,
  WorkoutSession,
  ZonePoint,
} from "./types";

type ViewKey = "home" | "roster" | "practice" | "weights" | "games" | "analytics" | "profile";
type PracticeMode = "Hitting" | "Pitching" | "Defense";
type RosterFilter = "All" | RosterStatus;
type ProfileTab = "overview" | "practice" | "games" | "pitching" | "hitting" | "defense" | "weights" | "notes";
type AnalyticsContext = "All" | "Practice" | "Game" | "Live BP" | "Weight Room";
type DateFilter = "Last Week" | "Last 30 Days" | "Fall";

const NAV_ITEMS: Array<{ key: ViewKey; label: string; shortLabel: string; icon: LucideIcon }> = [
  { key: "home", label: "Home", shortLabel: "Home", icon: Home },
  { key: "roster", label: "Roster", shortLabel: "Roster", icon: Users },
  { key: "practice", label: "Practice", shortLabel: "Practice", icon: ClipboardList },
  { key: "weights", label: "Weight Room", shortLabel: "Weights", icon: Dumbbell },
  { key: "games", label: "Games", shortLabel: "Games", icon: Gauge },
  { key: "analytics", label: "Analytics", shortLabel: "Analytics", icon: BarChart3 },
];

const ROSTER_STATUSES: RosterStatus[] = ["Varsity", "JV", "Undecided", "Cut"];
const ROSTER_FILTERS: RosterFilter[] = ["All", ...ROSTER_STATUSES];
const POSITIONS: Position[] = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "UTL", "DH"];
const PRACTICE_TYPES: PracticeType[] = ["Full Practice", "Bullpen Day", "Live BP", "Hitting Day", "Scrimmage", "Pitcher Development", "Hitter Development", "Custom"];
const PITCH_TYPES: PitchType[] = ["4-Seam", "2-Seam", "Sinker", "Cutter", "Slider", "Curveball", "Changeup", "Splitter", "Other"];
const HITTING_STATIONS: HittingSession["type"][] = ["Tee", "Front Toss", "Machine", "Coach BP", "Live BP"];
const PITCHING_STATIONS: PitchingSession["type"][] = ["Bullpen", "Live BP"];
const DEFENSE_STATIONS: DefenseStation[] = ["Infield", "Outfield", "Catching", "PFP", "Situational defense", "Team defense"];
const GAME_TYPES: GameType[] = ["Fall Game", "Scrimmage", "Showcase", "Regular Season", "Tournament", "Other"];
const GAME_PITCH_BUTTONS: GamePitchOutcome[] = ["Ball", "Called Strike", "Swinging Strike", "Foul", "In Play"];
const BIP_OUTCOMES: GameBallInPlayOutcome[] = ["Single", "Double", "Triple", "Home Run", "Ground Out", "Fly Out", "Line Out", "Pop Out", "Error", "Fielder's Choice", "Sac Fly", "Sac Bunt"];
const EXERCISES = ["Back Squat", "Front Squat", "Bench Press", "Incline Bench", "Deadlift", "Trap Bar Deadlift", "Power Clean", "Hang Clean", "Push Press", "Pull Ups", "DB Bench", "Bulgarian Split Squat", "Sprint", "Broad Jump", "Vertical Jump"];
const PITCH_MIX_COLORS = ["#f4c16f", "#9f244c", "#8b96a5", "#43c6ac", "#f97316", "#a78bfa", "#e2e8f0", "#38bdf8"];

export default function MetrolinaBaseballApp() {
  const [data, setData] = useState<AppData | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [authState, setAuthState] = useState<AuthState>({ status: "anonymous" });
  const [loadError, setLoadError] = useState<PersistenceError | Error | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [view, setView] = useState<ViewKey>("home");
  const [globalQuery, setGlobalQuery] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<ID>("p-jackson-smith");
  const [rosterFilter, setRosterFilter] = useState<RosterFilter>("All");
  const [rosterQuery, setRosterQuery] = useState("");
  const [profileTab, setProfileTab] = useState<ProfileTab>("overview");
  const [practiceMode, setPracticeMode] = useState<PracticeMode>("Hitting");
  const [practicePlayerId, setPracticePlayerId] = useState<ID>("p-jackson-smith");
  const [hittingStation, setHittingStation] = useState<HittingSession["type"]>("Machine");
  const [pitchingStation, setPitchingStation] = useState<PitchingSession["type"]>("Bullpen");
  const [defenseStation, setDefenseStation] = useState<DefenseStation>("Infield");
  const [selectedPitchType, setSelectedPitchType] = useState<PitchType>("4-Seam");
  const [velocity, setVelocity] = useState<string>("84");
  const [pitchLocation, setPitchLocation] = useState<ZonePoint>({ x: 0.5, y: 0.5 });
  const [targetLocation, setTargetLocation] = useState<ZonePoint>({ x: 0.42, y: 0.45 });
  const [fieldLocation, setFieldLocation] = useState<ZonePoint>({ x: 0.5, y: 0.55 });
  const [hitDirection, setHitDirection] = useState<Direction>("Middle");
  const [selectedGameId, setSelectedGameId] = useState<ID>("game-aug14-covenant");
  const [selectedWeightPlayerId, setSelectedWeightPlayerId] = useState<ID>("p-jackson-smith");
  const [weightForm, setWeightForm] = useState({ exercise: "Back Squat", weight: "225", reps: "5", sets: "3", effort: "8" });
  const [startPracticeOpen, setStartPracticeOpen] = useState(false);
  const [startGameOpen, setStartGameOpen] = useState(false);
  const [playerEditorOpen, setPlayerEditorOpen] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<ID | undefined>();
  const [sessionSummary, setSessionSummary] = useState<{ type: "Hitting" | "Pitching" | "Defense"; sessionId: ID } | null>(null);
  const [summaryNote, setSummaryNote] = useState("");
  const [analyticsContext, setAnalyticsContext] = useState<AnalyticsContext>("All");
  const [dateFilter, setDateFilter] = useState<DateFilter>("Fall");

  useEffect(() => {
    let cancelled = false;
    void loadApplicationData(() => cancelled);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || !data) return;
    document.documentElement.dataset.theme = data.settings.theme;
  }, [data, hydrated]);

  const practice = data ? activePractice(data) ?? data.practices[0] : undefined;
  const selectedPlayer = data?.players.find((player) => player.id === selectedPlayerId) ?? data?.players[0];
  const practicePlayer = data?.players.find((player) => player.id === practicePlayerId) ?? selectedPlayer;
  const currentGame = data?.games.find((game) => game.id === selectedGameId) ?? data?.games[0];
  const rosterPlayers = data?.players.filter((player) => !player.archived) ?? [];

  const globalResults = useMemo(() => {
    if (!data || !globalQuery.trim()) return [];
    const needle = globalQuery.trim().toLowerCase();
    return data.players
      .filter((player) => !player.archived)
      .filter((player) => `${player.name} ${player.jerseyNumber} ${player.primaryPosition}`.toLowerCase().includes(needle))
      .slice(0, 6);
  }, [data, globalQuery]);

  const activeTotals = useMemo(() => {
    if (!data || !practice) return { pitches: 0, swings: 0, defenders: 0, players: 0, pitchers: 0, hitters: 0 };
    const pitching = data.pitchingSessions.filter((session) => session.practiceId === practice.id);
    const hitting = data.hittingSessions.filter((session) => session.practiceId === practice.id);
    const defense = data.defenseSessions.filter((session) => session.practiceId === practice.id);
    return {
      pitches: practicePitchEvents(data, practice.id).length,
      swings: practiceHittingEvents(data, practice.id).filter((event) => event.action !== "Took pitch").length,
      defenders: new Set(defense.map((session) => session.playerId)).size,
      players: practice.playerIds.length,
      pitchers: new Set(pitching.map((session) => session.pitcherId)).size || practice.pitcherIds.length,
      hitters: new Set(hitting.map((session) => session.hitterId)).size || practice.hitterIds.length,
    };
  }, [data, practice]);

  const weeklyMvp = useMemo(() => (data ? buildWeeklyMvp(data) : undefined), [data]);
  const weightLeader = useMemo(() => (data ? buildWeightLeader(data) : undefined), [data]);

  async function loadApplicationData(isCancelled: () => boolean = () => false) {
    setHydrated(false);
    setLoadError(null);
    setSaveError(null);

    const auth = await authRepository.getState();
    if (isCancelled()) return;
    setAuthState(auth);

    if (auth.status !== "authenticated") {
      setData(null);
      setHydrated(true);
      return;
    }

    try {
      const loaded = await supabaseAppRepository.load();
      if (isCancelled()) return;
      const params = new URLSearchParams(window.location.search);
      const requestedView = params.get("view") as ViewKey | null;
      const requestedPlayer = params.get("player");

      setData(loaded);
      setHydrated(true);
      document.documentElement.dataset.theme = loaded.settings.theme;

      const active = activePractice(loaded);
      const firstPlayer = loaded.settings.recentPlayerIds[0] ?? active?.playerIds[0] ?? loaded.players[0]?.id ?? "";
      const firstGame = loaded.games.find((game) => !game.result)?.id ?? loaded.games[0]?.id ?? "";

      setSelectedPlayerId(requestedPlayer && loaded.players.some((player) => player.id === requestedPlayer) ? requestedPlayer : firstPlayer);
      setPracticePlayerId(firstPlayer);
      setSelectedWeightPlayerId(firstPlayer);
      setSelectedGameId(firstGame);

      if (requestedView && [...NAV_ITEMS.map((item) => item.key), "profile"].includes(requestedView)) {
        setView(requestedView);
      }
    } catch (error) {
      if (isCancelled()) return;
      setLoadError(error instanceof Error ? error : new Error("Unable to load Metrolina Baseball data."));
      setData(null);
      setHydrated(true);
    }
  }

  function commit(updater: (current: AppData) => AppData) {
    setData((current) => {
      if (!current) return current;
      const next = updater(current);
      void persistChange(current, next);
      return next;
    });
  }

  async function persistChange(previous: AppData, next: AppData) {
    setSaveStatus("saving");
    setSaveError(null);
    try {
      await supabaseAppRepository.sync(previous, next);
      setSaveStatus("saved");
    } catch (error) {
      setSaveStatus("error");
      setSaveError(error instanceof Error ? error.message : "Unable to save to Supabase.");
    }
  }

  function openPlayer(playerId: ID) {
    commit((current) => touchRecentPlayers(current, playerId));
    setSelectedPlayerId(playerId);
    setPracticePlayerId(playerId);
    setSelectedWeightPlayerId(playerId);
    setProfileTab("overview");
    setGlobalQuery("");
    setView("profile");
  }

  function selectPracticePlayer(playerId: ID) {
    setPracticePlayerId(playerId);
    setSelectedPlayerId(playerId);
    setSelectedWeightPlayerId(playerId);
    commit((current) => touchRecentPlayers(current, playerId));
  }

  function updateRosterStatus(playerId: ID, status: RosterStatus) {
    commit((current) => playerRepository.updateRosterStatus(current, playerId, status));
  }

  function toggleTheme() {
    commit((current) => ({
      ...current,
      settings: {
        ...current.settings,
        theme: current.settings.theme === "dark" ? "light" : "dark",
      },
    }));
  }

  function logHitting(action: HittingEvent["action"], contactResult?: BattedBallType, contactQuality?: HittingContactQuality, direction: Direction = hitDirection) {
    if (!practice || !practicePlayer) return;
    commit((current) => {
      const next = ensureHittingSession(current, practice, practicePlayer.id, hittingStation);
      const session = next.session;
      const eventNumber = next.data.hittingEvents.filter((event) => event.sessionId === session.id).length + 1;
      const isBip = action === "Ball in play";
      const event: HittingEvent = {
        id: createId("he"),
        practiceId: practice.id,
        sessionId: session.id,
        hitterId: practicePlayer.id,
        eventNumber,
        action,
        contactResult: isBip ? contactResult : undefined,
        contactQuality: isBip ? contactQuality : undefined,
        direction: isBip ? direction : undefined,
        fieldLocation: isBip ? fieldLocation : undefined,
        pitchType: hittingStation === "Machine" || hittingStation === "Live BP" ? selectedPitchType : undefined,
        velocity: hittingStation === "Machine" && velocity ? Number(velocity) : undefined,
        isLiveBp: hittingStation === "Live BP",
        createdAt: new Date().toISOString(),
      };
      return touchRecentPlayers({ ...next.data, hittingEvents: [event, ...next.data.hittingEvents] }, practicePlayer.id);
    });
  }

  function logPitch(outcome: PitchOutcome, battedBall?: BattedBallType) {
    if (!practice || !practicePlayer) return;
    commit((current) => {
      const next = ensurePitchingSession(current, practice, practicePlayer.id, pitchingStation);
      const session = next.session;
      const sessionEvents = next.data.pitchEvents.filter((event) => event.sessionId === session.id);
      const last = sessionEvents[0];
      const isBip = outcome === "Ball in play";
      const isSwing = ["Swing", "Whiff", "Foul", "Ball in play"].includes(outcome);
      const isStrike = outcome !== "Ball" && outcome !== "HBP";
      const countBefore = last?.countAfter ?? { balls: 0, strikes: 0 };
      const countAfter = nextCount(countBefore, outcome);
      const event: PitchEvent = {
        id: createId("pe"),
        practiceId: practice.id,
        sessionId: session.id,
        pitcherId: practicePlayer.id,
        pitchNumber: sessionEvents.length + 1,
        pitchType: selectedPitchType,
        outcome,
        isStrike,
        isSwing,
        isZone: pitchLocation.x >= 0.22 && pitchLocation.x <= 0.78 && pitchLocation.y >= 0.18 && pitchLocation.y <= 0.82,
        isChase: isSwing && !(pitchLocation.x >= 0.22 && pitchLocation.x <= 0.78 && pitchLocation.y >= 0.18 && pitchLocation.y <= 0.82),
        isWhiff: outcome === "Whiff",
        isCalledStrike: outcome === "Called Strike",
        isBallInPlay: isBip,
        battedBall: isBip ? battedBall : undefined,
        contactQuality: isBip ? (battedBall === "Line drive" ? "Hard contact" : "Medium contact") : undefined,
        velocity: velocity ? Number(velocity) : undefined,
        qualityRating: outcome === "Ball" ? 2 : outcome === "Whiff" || outcome === "Called Strike" ? 5 : 4,
        missedIntendedLocation: distanceBetween(pitchLocation, targetLocation) > 0.18,
        intendedTarget: targetLocation,
        location: pitchLocation,
        countBefore,
        countAfter,
        createdAt: new Date().toISOString(),
      };
      return touchRecentPlayers({ ...next.data, pitchEvents: [event, ...next.data.pitchEvents] }, practicePlayer.id);
    });
  }

  function logDefense(outcome: DefenseOutcome) {
    if (!practice || !practicePlayer) return;
    commit((current) => {
      const next = ensureDefenseSession(current, practice, practicePlayer.id, defenseStation);
      const session = next.session;
      const eventNumber = next.data.defenseEvents.filter((event) => event.sessionId === session.id).length + 1;
      const event: DefenseEvent = {
        id: createId("de"),
        practiceId: practice.id,
        sessionId: session.id,
        playerId: practicePlayer.id,
        station: defenseStation,
        eventNumber,
        outcome,
        throwQuality: outcome === "Great Play" ? "Plus" : outcome === "Error" ? "Average" : "Good",
        footwork: outcome === "Error" ? "Needs work" : outcome === "Great Play" ? "Plus" : "Solid",
        decision: outcome === "Great Play" ? "Advanced" : "Correct",
        range: outcome === "Great Play" ? "Plus" : outcome === "Good Play" ? "Difficult" : "Routine",
        errorType: outcome === "Error" ? "Fielding" : undefined,
        createdAt: new Date().toISOString(),
      };
      return touchRecentPlayers({ ...next.data, defenseEvents: [event, ...next.data.defenseEvents] }, practicePlayer.id);
    });
  }

  function undoPracticeEvent() {
    if (!practice || !practicePlayer) return;
    commit((current) => {
      if (practiceMode === "Hitting") {
        const index = current.hittingEvents.findIndex((event) => event.practiceId === practice.id && event.hitterId === practicePlayer.id);
        if (index < 0) return current;
        return { ...current, hittingEvents: current.hittingEvents.filter((_, eventIndex) => eventIndex !== index) };
      }
      if (practiceMode === "Pitching") {
        const index = current.pitchEvents.findIndex((event) => event.practiceId === practice.id && event.pitcherId === practicePlayer.id);
        if (index < 0) return current;
        return { ...current, pitchEvents: current.pitchEvents.filter((_, eventIndex) => eventIndex !== index) };
      }
      const index = current.defenseEvents.findIndex((event) => event.practiceId === practice.id && event.playerId === practicePlayer.id);
      if (index < 0) return current;
      return { ...current, defenseEvents: current.defenseEvents.filter((_, eventIndex) => eventIndex !== index) };
    });
  }

  function openSessionSummary() {
    if (!data || !practice || !practicePlayer) return;
    const session =
      practiceMode === "Hitting"
        ? data.hittingSessions.find((item) => item.practiceId === practice.id && item.hitterId === practicePlayer.id && item.type === hittingStation)
        : practiceMode === "Pitching"
          ? data.pitchingSessions.find((item) => item.practiceId === practice.id && item.pitcherId === practicePlayer.id && item.type === pitchingStation)
          : data.defenseSessions.find((item) => item.practiceId === practice.id && item.playerId === practicePlayer.id && item.station === defenseStation);
    if (!session) return;
    setSummaryNote(session.summaryNote ?? "");
    setSessionSummary({ type: practiceMode, sessionId: session.id });
  }

  function saveSessionSummary() {
    if (!sessionSummary) return;
    commit((current) => {
      const endedAt = new Date().toISOString();
      if (sessionSummary.type === "Hitting") {
        return {
          ...current,
          hittingSessions: current.hittingSessions.map((session) =>
            session.id === sessionSummary.sessionId ? { ...session, endedAt, summaryNote, sessionGrade: gradeSession(summaryNote) } : session,
          ),
        };
      }
      if (sessionSummary.type === "Pitching") {
        return {
          ...current,
          pitchingSessions: current.pitchingSessions.map((session) =>
            session.id === sessionSummary.sessionId ? { ...session, endedAt, summaryNote, sessionGrade: gradeSession(summaryNote) } : session,
          ),
        };
      }
      return {
        ...current,
        defenseSessions: current.defenseSessions.map((session) =>
          session.id === sessionSummary.sessionId ? { ...session, endedAt, summaryNote } : session,
        ),
      };
    });
    setSessionSummary(null);
  }

  function addWorkoutEntry() {
    if (!data) return;
    const player = data.players.find((item) => item.id === selectedWeightPlayerId);
    if (!player) return;
    const date = new Date().toISOString().slice(0, 10);
    const weekOf = weekStart(date);
    const existingSession = data.workoutSessions.find((item) => item.playerId === player.id && item.date === date);
    const session: WorkoutSession = {
      id: existingSession?.id ?? createId("ws"),
      playerId: player.id,
      date,
      weekOf,
      day: weekdayName(date),
      completed: true,
      effortScore: Number(weightForm.effort) || 8,
      bodyWeight: player.weight,
      createdAt: existingSession?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const entry = {
      id: createId("we"),
      sessionId: session.id,
      playerId: player.id,
      exercise: weightForm.exercise,
      kind: ["Vertical Jump", "Broad Jump"].includes(weightForm.exercise) ? ("Jump" as const) : weightForm.exercise.includes("Sprint") ? ("Speed" as const) : ("Lift" as const),
      weight: Number(weightForm.weight) || undefined,
      reps: Number(weightForm.reps) || undefined,
      sets: Number(weightForm.sets) || undefined,
      priorValue: latestExerciseValue(data, player.id, weightForm.exercise),
      createdAt: new Date().toISOString(),
    };
    commit((current) => workoutRepository.logEntry(current, session, entry));
  }

  function logGamePitch(outcome: GamePitchOutcome, ballInPlayOutcome?: GameBallInPlayOutcome) {
    if (!currentGame) return;
    commit((current) => {
      const game = current.games.find((item) => item.id === currentGame.id);
      if (!game) return current;
      const nextGame = applyGameOutcome(game, outcome, ballInPlayOutcome);
      const event = {
        id: createId("ge"),
        gameId: game.id,
        inning: game.inning,
        half: game.half,
        pitcherId: game.currentPitcherId,
        batterId: game.currentBatterId,
        pitchType: selectedPitchType,
        pitchOutcome: outcome,
        ballInPlayOutcome,
        velocity: velocity ? Number(velocity) : undefined,
        location: pitchLocation,
        outsBefore: game.outs,
        outsAfter: nextGame.outs,
        metrolinaRunsBefore: game.metrolinaScore,
        metrolinaRunsAfter: nextGame.metrolinaScore,
        opponentRunsBefore: game.opponentScore,
        opponentRunsAfter: nextGame.opponentScore,
        situations: gameSituations(game, outcome, ballInPlayOutcome),
        createdAt: new Date().toISOString(),
      };
      return gameRepository.logEvent(current, event, nextGame);
    });
  }

  function adjustGame(field: "metrolinaScore" | "opponentScore" | "outs", delta: number) {
    if (!currentGame) return;
    commit((current) =>
      gameRepository.upsert(current, {
        ...currentGame,
        [field]: Math.max(0, Number(currentGame[field]) + delta),
        updatedAt: new Date().toISOString(),
      }),
    );
  }

  if (!hydrated) {
    return (
      <main className="loading-screen">
        <img src="/brand/metrolina-baseball-cutout.png" alt="" />
        <img className="asset-preload" src="/brand/metrolina-warriors-alpha.png" alt="" aria-hidden="true" />
        <strong>Metrolina Baseball</strong>
        <span>Loading Metrolina Fall Ball development console...</span>
      </main>
    );
  }

  if (authState.status !== "authenticated" || loadError) {
    return (
      <AuthGate
        authState={authState}
        error={loadError}
        onSignedIn={() => loadApplicationData()}
        onClaimed={() => loadApplicationData()}
      />
    );
  }

  if (!data) {
    return (
      <main className="loading-screen">
        <img src="/brand/metrolina-baseball-cutout.png" alt="" />
        <strong>Metrolina Baseball</strong>
        <span>Database is connected, but no app data was returned.</span>
      </main>
    );
  }

  return (
    <main className="ops-shell">
      <aside className="ops-sidebar" aria-label="Primary navigation">
        <button className="brand-lockup" type="button" onClick={() => setView("home")}>
        <img src="/brand/metrolina-baseball-cutout.png" alt="" />
          <span>
            <strong>Metrolina</strong>
            <small>Baseball Ops</small>
          </span>
        </button>

        <nav className="rail-nav">
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
            <button key={key} type="button" className={view === key ? "active" : ""} onClick={() => setView(key)}>
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="rail-card">
          <span>Active Practice</span>
          <strong>{practice?.name ?? "No active practice"}</strong>
          <small>{practice ? `${activeTotals.players} players active` : "Start a practice to begin"}</small>
        </div>
      </aside>

      <section className="ops-main">
        <TopCommand
          data={data}
          practice={practice}
          globalQuery={globalQuery}
          globalResults={globalResults}
          onQuery={setGlobalQuery}
          onOpenPlayer={openPlayer}
          onStartPractice={() => setStartPracticeOpen(true)}
          onStartGame={() => setStartGameOpen(true)}
          onToggleTheme={toggleTheme}
          onView={setView}
        />

        <SyncStatusBanner status={saveStatus} error={saveError} />

        {view === "home" && (
          <HomeDashboard
            data={data}
            practice={practice}
            activeTotals={activeTotals}
            weeklyMvp={weeklyMvp}
            weightLeader={weightLeader}
            onView={setView}
            onOpenPlayer={openPlayer}
            onStartPractice={() => setStartPracticeOpen(true)}
            onStartGame={() => setStartGameOpen(true)}
            onAddPlayer={() => {
              setEditingPlayerId(undefined);
              setPlayerEditorOpen(true);
            }}
          />
        )}

        {view === "roster" && (
          <RosterView
            players={rosterPlayers}
            filter={rosterFilter}
            query={rosterQuery}
            onFilter={setRosterFilter}
            onQuery={setRosterQuery}
            onOpenPlayer={openPlayer}
            onEditPlayer={(playerId) => {
              setEditingPlayerId(playerId);
              setPlayerEditorOpen(true);
            }}
            onAddPlayer={() => {
              setEditingPlayerId(undefined);
              setPlayerEditorOpen(true);
            }}
            onStatus={updateRosterStatus}
          />
        )}

        {view === "practice" && practicePlayer && (
          <PracticeConsole
            data={data}
            practice={practice}
            mode={practiceMode}
            player={practicePlayer}
            activeTotals={activeTotals}
            hittingStation={hittingStation}
            pitchingStation={pitchingStation}
            defenseStation={defenseStation}
            selectedPitchType={selectedPitchType}
            velocity={velocity}
            pitchLocation={pitchLocation}
            targetLocation={targetLocation}
            fieldLocation={fieldLocation}
            hitDirection={hitDirection}
            onMode={setPracticeMode}
            onSelectPlayer={selectPracticePlayer}
            onOpenPlayer={openPlayer}
            onHittingStation={setHittingStation}
            onPitchingStation={setPitchingStation}
            onDefenseStation={setDefenseStation}
            onPitchType={setSelectedPitchType}
            onVelocity={setVelocity}
            onPitchLocation={setPitchLocation}
            onTargetLocation={setTargetLocation}
            onFieldLocation={setFieldLocation}
            onHitDirection={setHitDirection}
            onLogHitting={logHitting}
            onLogPitch={logPitch}
            onLogDefense={logDefense}
            onUndo={undoPracticeEvent}
            onEndSession={openSessionSummary}
            onStartPractice={() => setStartPracticeOpen(true)}
          />
        )}

        {view === "practice" && !practicePlayer && (
          <EmptyActionPanel
            eyebrow="Practice"
            title="Add a player before tracking reps"
            body="Supabase is connected and ready. Create the first roster player, then practice tracking will unlock."
            action="Add Player"
            onAction={() => {
              setEditingPlayerId(undefined);
              setPlayerEditorOpen(true);
            }}
          />
        )}

        {view === "weights" && (
          <WeightRoomView
            data={data}
            selectedPlayerId={selectedWeightPlayerId}
            form={weightForm}
            leader={weightLeader}
            onPlayer={setSelectedWeightPlayerId}
            onOpenPlayer={openPlayer}
            onForm={setWeightForm}
            onAddEntry={addWorkoutEntry}
          />
        )}

        {view === "games" && (
          <GamesView
            data={data}
            selectedGameId={selectedGameId}
            selectedPitchType={selectedPitchType}
            velocity={velocity}
            pitchLocation={pitchLocation}
            onGame={setSelectedGameId}
            onPitchType={setSelectedPitchType}
            onVelocity={setVelocity}
            onPitchLocation={setPitchLocation}
            onLogPitch={logGamePitch}
            onAdjust={adjustGame}
            onOpenPlayer={openPlayer}
            onStartGame={() => setStartGameOpen(true)}
          />
        )}

        {view === "analytics" && (
          <AnalyticsView
            data={data}
            context={analyticsContext}
            dateFilter={dateFilter}
            onContext={setAnalyticsContext}
            onDateFilter={setDateFilter}
            onOpenPlayer={openPlayer}
          />
        )}

        {view === "profile" && selectedPlayer && (
          <PlayerProfile
            data={data}
            player={selectedPlayer}
            tab={profileTab}
            onTab={setProfileTab}
            onEdit={() => {
              setEditingPlayerId(selectedPlayer.id);
              setPlayerEditorOpen(true);
            }}
            onStatus={updateRosterStatus}
          />
        )}
      </section>

      <nav className="bottom-nav" aria-label="Mobile navigation">
        {NAV_ITEMS.map(({ key, shortLabel, icon: Icon }) => (
          <button key={key} type="button" className={view === key ? "active" : ""} onClick={() => setView(key)}>
            <Icon size={19} aria-hidden="true" />
            <span>{shortLabel}</span>
          </button>
        ))}
      </nav>

      {startPracticeOpen && (
        <StartPracticeModal
          data={data}
          onClose={() => setStartPracticeOpen(false)}
          onCreate={(practiceDraft) => {
            commit((current) => ({
              ...current,
              practices: [practiceDraft, ...current.practices],
              attendance: [
                ...practiceDraft.playerIds.map((playerId) => ({
                  id: createId("att"),
                  practiceId: practiceDraft.id,
                  playerId,
                  role: practiceDraft.pitcherIds.includes(playerId) && practiceDraft.hitterIds.includes(playerId) ? ("Two-way" as const) : practiceDraft.pitcherIds.includes(playerId) ? ("Pitcher" as const) : practiceDraft.hitterIds.includes(playerId) ? ("Hitter" as const) : ("Observer" as const),
                  checkedInAt: practiceDraft.startedAt,
                })),
                ...current.attendance,
              ],
              settings: { ...current.settings, activePracticeId: practiceDraft.id },
            }));
            setStartPracticeOpen(false);
            setView("practice");
          }}
        />
      )}

      {startGameOpen && (
        <StartGameModal
          data={data}
          onClose={() => setStartGameOpen(false)}
          onCreate={(game) => {
            commit((current) => gameRepository.upsert(current, game));
            setSelectedGameId(game.id);
            setStartGameOpen(false);
            setView("games");
          }}
        />
      )}

      {playerEditorOpen && (
        <PlayerEditorModal
          player={data.players.find((item) => item.id === editingPlayerId)}
          onClose={() => setPlayerEditorOpen(false)}
          onSave={(player) => {
            commit((current) => playerRepository.upsert(current, player));
            setSelectedPlayerId(player.id);
            setPlayerEditorOpen(false);
            setView("profile");
          }}
          onArchive={(playerId) => {
            commit((current) => playerRepository.archive(current, playerId));
            setPlayerEditorOpen(false);
          }}
        />
      )}

      {sessionSummary && (
        <SessionSummaryModal
          data={data}
          summary={sessionSummary}
          note={summaryNote}
          onNote={setSummaryNote}
          onSave={saveSessionSummary}
          onClose={() => setSessionSummary(null)}
        />
      )}
    </main>
  );
}

function AuthGate({
  authState,
  error,
  onSignedIn,
  onClaimed,
}: {
  authState: AuthState;
  error: Error | null;
  onSignedIn: () => void;
  onClaimed: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const needsMembership = error instanceof PersistenceError && error.code === "membership-required";

  async function signIn() {
    setBusy(true);
    setMessage(null);
    try {
      await authRepository.signIn(email, password);
      onSignedIn();
    } catch (signInError) {
      setMessage(signInError instanceof Error ? signInError.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  async function claimAdmin() {
    setBusy(true);
    setMessage(null);
    try {
      await authRepository.claimInitialAdmin();
      onClaimed();
    } catch (claimError) {
      setMessage(claimError instanceof Error ? claimError.message : "Unable to claim initial admin access.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="loading-screen auth-screen">
      <img src="/brand/metrolina-baseball-cutout.png" alt="" />
      <strong>Metrolina Baseball</strong>
      <span>Coach sign-in is required for Supabase-backed program data.</span>

      {authState.status === "not-configured" && <p className="auth-message">{authState.message}</p>}
      {error && <p className="auth-message">{error.message}</p>}
      {message && <p className="auth-message">{message}</p>}

      {authState.status === "anonymous" && (
        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            void signIn();
          }}
        >
          <label>
            <span>Email</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
          </label>
          <label>
            <span>Password</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
          </label>
          <button className="primary-button stretch-button" type="submit" disabled={busy || !email || !password}>
            {busy ? "Signing in..." : "Sign In"}
          </button>
        </form>
      )}

      {authState.status === "authenticated" && needsMembership && (
        <button className="primary-button" type="button" onClick={() => void claimAdmin()} disabled={busy}>
          {busy ? "Claiming..." : "Claim Initial Admin Access"}
        </button>
      )}
    </main>
  );
}

function SyncStatusBanner({ status, error }: { status: "idle" | "saving" | "saved" | "error"; error: string | null }) {
  if (status === "idle") return null;
  return (
    <div className={`sync-banner sync-banner--${status}`} role={status === "error" ? "alert" : "status"}>
      {status === "saving" && "Saving to Supabase..."}
      {status === "saved" && "Saved to Supabase"}
      {status === "error" && `Save failed: ${error ?? "Check your connection and permissions."}`}
    </div>
  );
}

function EmptyActionPanel({
  eyebrow,
  title,
  body,
  action,
  onAction,
}: {
  eyebrow: string;
  title: string;
  body: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <article className="panel empty-action-panel">
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      <p>{body}</p>
      <button className="primary-button" type="button" onClick={onAction}>
        <Plus size={16} aria-hidden="true" />
        {action}
      </button>
    </article>
  );
}

function TopCommand({
  data,
  practice,
  globalQuery,
  globalResults,
  onQuery,
  onOpenPlayer,
  onStartPractice,
  onStartGame,
  onToggleTheme,
  onView,
}: {
  data: AppData;
  practice?: Practice;
  globalQuery: string;
  globalResults: Player[];
  onQuery: (value: string) => void;
  onOpenPlayer: (playerId: ID) => void;
  onStartPractice: () => void;
  onStartGame: () => void;
  onToggleTheme: () => void;
  onView: (view: ViewKey) => void;
}) {
  return (
    <header className="top-command">
      <div className="top-command__identity">
        <button type="button" className="mobile-brand" onClick={() => onView("home")}>
          <img src="/brand/metrolina-baseball-cutout.png" alt="" />
        </button>
        <div>
          <span>{data.settings.rosterSeason}</span>
          <h1>Metrolina Baseball</h1>
          <small>{practice ? `${weekdayLong(practice.date)}, ${fullDate(practice.date)} - ${practice.location}` : "Player Development + Practice + Game Operations"}</small>
        </div>
      </div>

      <div className="global-search">
        <Search size={16} aria-hidden="true" />
        <input value={globalQuery} onChange={(event) => onQuery(event.target.value)} placeholder="Search player" aria-label="Search players" />
        {globalResults.length > 0 && (
          <div className="global-search__results">
            {globalResults.map((player) => (
              <button key={player.id} type="button" onClick={() => onOpenPlayer(player.id)}>
                <PlayerAvatar player={player} size="sm" compact />
                <span>{player.name}</span>
                <small>#{player.jerseyNumber}</small>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="top-command__actions">
        <button type="button" className="ghost-button" onClick={onToggleTheme} aria-label="Toggle light or dark theme">
          {data.settings.theme === "dark" ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
        </button>
        <button type="button" className="secondary-button" onClick={onStartGame}>
          <Play size={16} aria-hidden="true" />
          Start Game
        </button>
        <button type="button" className="primary-button" onClick={onStartPractice}>
          <Plus size={16} aria-hidden="true" />
          Start Practice
        </button>
      </div>
    </header>
  );
}

function HomeDashboard({
  data,
  practice,
  activeTotals,
  weeklyMvp,
  weightLeader,
  onView,
  onOpenPlayer,
  onStartPractice,
  onStartGame,
  onAddPlayer,
}: {
  data: AppData;
  practice?: Practice;
  activeTotals: { pitches: number; swings: number; defenders: number; players: number; pitchers: number; hitters: number };
  weeklyMvp?: AwardResult;
  weightLeader?: WeightLeaderResult;
  onView: (view: ViewKey) => void;
  onOpenPlayer: (playerId: ID) => void;
  onStartPractice: () => void;
  onStartGame: () => void;
  onAddPlayer: () => void;
}) {
  const hittingLeaders = buildHittingLeaders(data, "hardHitPct", 10).slice(0, 3);
  const pitchingLeaders = buildPitchingLeaders(data, "strikePct", 16).slice(0, 3);
  const latestGame = data.games.find((game) => game.result);
  const upcomingPractice = data.practices.find((item) => item.id !== practice?.id);
  const upcomingGame = data.games.find((game) => !game.result);
  const rosterCounts = rosterSnapshot(data.players);

  return (
    <div className="page-stack home-dashboard">
      <section className="quick-actions">
        <ActionCard icon={ClipboardList} label="Start Practice" detail="Hitting, pitching, defense" onClick={onStartPractice} />
        <ActionCard icon={Gauge} label="Start Game" detail="Lineup and pitch scoring" onClick={onStartGame} />
        <ActionCard icon={UserPlus} label="Add Player" detail="Roster status and profile" onClick={onAddPlayer} />
        <ActionCard icon={Dumbbell} label="Enter Weight Room" detail="Weekly lifting grid" onClick={() => onView("weights")} />
      </section>

      <section className="dashboard-grid">
        <article className="panel today-panel">
          <div className="section-kicker">Today</div>
          <div className="today-panel__title">
            <div>
              <h2>{practice ? "Today's Practice" : "No Practice Scheduled"}</h2>
              <strong>{practice?.name ?? "Start a session when coaches arrive"}</strong>
            </div>
            <span className="time-chip">6:00 PM</span>
          </div>
          <div className="venue-row">
            <MapPin size={15} aria-hidden="true" />
            {practice?.location ?? "Varsity Field"}
          </div>
          <div className="mini-stat-grid">
            <StatTile label="Players" value={activeTotals.players} sub="active today" />
            <StatTile label="Pitchers" value={activeTotals.pitchers} sub="throwing" />
            <StatTile label="Hitters" value={activeTotals.hitters} sub="taking reps" />
            <StatTile label="Reps" value={activeTotals.pitches + activeTotals.swings} sub={`${activeTotals.pitches} pitches / ${activeTotals.swings} swings`} accent />
          </div>
          <button className="primary-button stretch-button" type="button" onClick={() => onView("practice")}>
            Open Practice
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </article>

        <AwardCard title="Player of the Week" award={weeklyMvp} onOpenPlayer={onOpenPlayer} icon={Trophy} />
        <WeightLeaderCard leader={weightLeader} onOpenPlayer={onOpenPlayer} />

        <article className="panel recent-performance">
          <div className="panel-heading">
            <div>
              <span>Recent Performance</span>
              <h2>Practice Leaders</h2>
            </div>
            <button type="button" className="text-button" onClick={() => onView("analytics")}>
              Analytics
            </button>
          </div>
          <div className="leader-columns">
            <LeaderList title="Top Hitters" leaders={hittingLeaders} metricKey="hardHitPct" fallback="No hitters past the minimum sample yet." onOpenPlayer={onOpenPlayer} />
            <LeaderList title="Top Pitchers" leaders={pitchingLeaders} metricKey="strikePct" fallback="No pitchers past the minimum sample yet." onOpenPlayer={onOpenPlayer} />
          </div>
        </article>

        <article className="panel game-card">
          <div className="section-kicker">Recent Game</div>
          {latestGame ? (
            <>
              <div className="score-line">
                <div>
                  <span>Metrolina</span>
                  <strong>{latestGame.metrolinaScore}</strong>
                </div>
                <div>
                  <span>{latestGame.opponent}</span>
                  <strong>{latestGame.opponentScore}</strong>
                </div>
                <b>{latestGame.result}</b>
              </div>
              <p>Key performers: {gamePerformerLine(data, latestGame)}</p>
              <button className="secondary-button stretch-button" type="button" onClick={() => onView("games")}>
                Open Games
              </button>
            </>
          ) : (
            <CompactEmpty title="No games scored yet" action={<button className="secondary-button" type="button" onClick={onStartGame}>Start Game</button>} />
          )}
        </article>

        <article className="panel upcoming-card">
          <div className="section-kicker">Upcoming</div>
          <ScheduleRow title="Next practice" primary={upcomingPractice?.name ?? "Team practice"} meta={upcomingPractice ? `${shortDate(upcomingPractice.date)} - ${upcomingPractice.location}` : "Not scheduled"} />
          <ScheduleRow title="Next game" primary={upcomingGame ? `${upcomingGame.homeAway === "Home" ? "vs" : "at"} ${upcomingGame.opponent}` : "No game scheduled"} meta={upcomingGame ? `${shortDate(upcomingGame.date)} - ${upcomingGame.location}` : "Create the next game when ready"} />
        </article>

        <article className="panel roster-snapshot">
          <div className="section-kicker">Roster Snapshot</div>
          <div className="snapshot-grid">
            {ROSTER_STATUSES.map((status) => (
              <button key={status} type="button" onClick={() => onView("roster")} className={`status-mini status-${status.toLowerCase()}`}>
                <strong>{rosterCounts[status] ?? 0}</strong>
                <span>{status}</span>
              </button>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

function RosterView({
  players,
  filter,
  query,
  onFilter,
  onQuery,
  onOpenPlayer,
  onEditPlayer,
  onAddPlayer,
  onStatus,
}: {
  players: Player[];
  filter: RosterFilter;
  query: string;
  onFilter: (filter: RosterFilter) => void;
  onQuery: (value: string) => void;
  onOpenPlayer: (playerId: ID) => void;
  onEditPlayer: (playerId: ID) => void;
  onAddPlayer: () => void;
  onStatus: (playerId: ID, status: RosterStatus) => void;
}) {
  const filtered = players
    .filter((player) => filter === "All" || player.rosterStatus === filter)
    .filter((player) => `${player.name} ${player.jerseyNumber} ${player.primaryPosition} ${player.secondaryPosition ?? ""}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a.jerseyNumber - b.jerseyNumber);

  return (
    <div className="page-stack">
      <SectionHeader
        eyebrow="Roster Management"
        title="Program Roster"
        body="Update player status, role, and profile details in one compact view."
        action={
          <button className="primary-button" type="button" onClick={onAddPlayer}>
            <UserPlus size={16} aria-hidden="true" />
            Add Player
          </button>
        }
      />

      <section className="toolbar-panel">
        <SegmentedControl values={ROSTER_FILTERS} active={filter} onChange={onFilter} />
        <label className="search-pill">
          <Search size={15} aria-hidden="true" />
          <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search roster" />
        </label>
      </section>

      <section className="roster-list">
        {filtered.map((player) => (
          <article className="roster-row" key={player.id}>
            <button type="button" className="roster-row__identity" onClick={() => onOpenPlayer(player.id)}>
              <span className="jersey-number">{player.jerseyNumber}</span>
              <PlayerAvatar player={player} size="sm" compact />
              <span>
                <strong>{player.name}</strong>
                <small>{positionLine(player)} - {player.graduationYear} - {player.bats}/{player.throws}</small>
              </span>
            </button>
            <div className="status-toggle" aria-label={`Roster status for ${player.name}`}>
              {ROSTER_STATUSES.map((status) => (
                <button key={status} type="button" className={player.rosterStatus === status ? "active" : ""} onClick={() => onStatus(player.id, status)}>
                  {status}
                </button>
              ))}
            </div>
            <button className="ghost-button" type="button" onClick={() => onEditPlayer(player.id)} aria-label={`Edit ${player.name}`}>
              <Edit3 size={16} aria-hidden="true" />
            </button>
          </article>
        ))}
      </section>
    </div>
  );
}

function PracticeConsole({
  data,
  practice,
  mode,
  player,
  activeTotals,
  hittingStation,
  pitchingStation,
  defenseStation,
  selectedPitchType,
  velocity,
  pitchLocation,
  targetLocation,
  fieldLocation,
  hitDirection,
  onMode,
  onSelectPlayer,
  onOpenPlayer,
  onHittingStation,
  onPitchingStation,
  onDefenseStation,
  onPitchType,
  onVelocity,
  onPitchLocation,
  onTargetLocation,
  onFieldLocation,
  onHitDirection,
  onLogHitting,
  onLogPitch,
  onLogDefense,
  onUndo,
  onEndSession,
  onStartPractice,
}: {
  data: AppData;
  practice?: Practice;
  mode: PracticeMode;
  player: Player;
  activeTotals: { pitches: number; swings: number; defenders: number; players: number; pitchers: number; hitters: number };
  hittingStation: HittingSession["type"];
  pitchingStation: PitchingSession["type"];
  defenseStation: DefenseStation;
  selectedPitchType: PitchType;
  velocity: string;
  pitchLocation: ZonePoint;
  targetLocation: ZonePoint;
  fieldLocation: ZonePoint;
  hitDirection: Direction;
  onMode: (mode: PracticeMode) => void;
  onSelectPlayer: (playerId: ID) => void;
  onOpenPlayer: (playerId: ID) => void;
  onHittingStation: (station: HittingSession["type"]) => void;
  onPitchingStation: (station: PitchingSession["type"]) => void;
  onDefenseStation: (station: DefenseStation) => void;
  onPitchType: (pitchType: PitchType) => void;
  onVelocity: (value: string) => void;
  onPitchLocation: (point: ZonePoint) => void;
  onTargetLocation: (point: ZonePoint) => void;
  onFieldLocation: (point: ZonePoint) => void;
  onHitDirection: (direction: Direction) => void;
  onLogHitting: (action: HittingEvent["action"], contactResult?: BattedBallType, quality?: HittingContactQuality, direction?: Direction) => void;
  onLogPitch: (outcome: PitchOutcome, battedBall?: BattedBallType) => void;
  onLogDefense: (outcome: DefenseOutcome) => void;
  onUndo: () => void;
  onEndSession: () => void;
  onStartPractice: () => void;
}) {
  const players = sortPlayersByRecent(
    data.players.filter((item) => !item.archived),
    data.settings.recentPlayerIds,
  );
  const pitchEvents = playerPitchEvents(data, player.id).filter((event) => !practice || event.practiceId === practice.id);
  const hittingEvents = playerHittingEvents(data, player.id).filter((event) => !practice || event.practiceId === practice.id);
  const defenseEvents = data.defenseEvents.filter((event) => event.playerId === player.id && (!practice || event.practiceId === practice.id));
  const pitchStats = calculatePitchingStats(pitchEvents);
  const hitStats = calculateHittingStats(hittingEvents);
  const defenseCleanPct = pct(defenseEvents.filter((event) => event.outcome !== "Error").length, defenseEvents.length);

  return (
    <div className="page-stack practice-console">
      <section className="practice-header panel">
        <div>
          <span>Metrolina Fall Ball</span>
          <h2>{practice?.name ?? "No Active Practice"}</h2>
          <small>{practice ? `${fullDate(practice.date)} - ${practice.location}` : "Start a practice to unlock tracking"}</small>
        </div>
        <div className="practice-header__metrics">
          <StatTile label="Pitches" value={activeTotals.pitches} />
          <StatTile label="Swings" value={activeTotals.swings} />
          <StatTile label="Players" value={activeTotals.players} />
        </div>
        {!practice && (
          <button className="primary-button" type="button" onClick={onStartPractice}>
            <Plus size={16} aria-hidden="true" />
            Start Practice
          </button>
        )}
      </section>

      <section className="tracker-shell">
        <aside className="player-switcher panel">
          <div className="panel-heading tight">
            <div>
              <span>Current Player</span>
              <h2>Fast Switch</h2>
            </div>
            <button className="ghost-button" type="button" onClick={() => onOpenPlayer(player.id)} aria-label={`Open ${player.name} profile`}>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
          <button className="current-player-card" type="button" onClick={() => onOpenPlayer(player.id)}>
            <PlayerAvatar player={player} size="lg" />
            <span>
              <strong>#{player.jerseyNumber} {player.name}</strong>
              <small>{positionLine(player)} - {player.rosterStatus}</small>
            </span>
          </button>
          <div className="switcher-list">
            {players.slice(0, 12).map((item) => (
              <button key={item.id} type="button" className={item.id === player.id ? "active" : ""} onClick={() => onSelectPlayer(item.id)}>
                <PlayerAvatar player={item} size="sm" compact />
                <span>{item.name.split(" ").slice(-1)[0]}</span>
                <small>#{item.jerseyNumber}</small>
              </button>
            ))}
          </div>
        </aside>

        <section className="tracker-console panel">
          <div className="mode-row">
            <SegmentedControl values={["Hitting", "Pitching", "Defense"] as PracticeMode[]} active={mode} onChange={onMode} />
            <div className="tracker-actions">
              <button className="ghost-button" type="button" onClick={onUndo}>
                <Undo2 size={16} aria-hidden="true" />
                Undo
              </button>
              <button className="secondary-button" type="button" onClick={onEndSession}>
                <Save size={16} aria-hidden="true" />
                End Session
              </button>
            </div>
          </div>

          {mode === "Hitting" && (
            <div className="tracking-layout">
              <div className="tracking-main">
                <SegmentedControl values={HITTING_STATIONS} active={hittingStation} onChange={onHittingStation} />
                <LiveMetrics
                  items={[
                    { label: "Swings", value: hitStats.totalSwings },
                    { label: "Contact", value: formatPct(hitStats.contactPct) },
                    { label: "Hard Hit", value: formatPct(hitStats.hardHitPct) },
                    { label: "Barrel", value: formatPct(hitStats.barrelPct) },
                  ]}
                />
                <div className="quick-pad quick-pad--hitting">
                  <button type="button" onClick={() => onLogHitting("Miss")}>Miss</button>
                  <button type="button" onClick={() => onLogHitting("Foul")}>Foul</button>
                  <button type="button" onClick={() => onLogHitting("Ball in play", "Ground ball", "Solid")}>GB</button>
                  <button type="button" onClick={() => onLogHitting("Ball in play", "Line drive", "Hard")}>LD</button>
                  <button type="button" onClick={() => onLogHitting("Ball in play", "Fly ball", "Solid")}>FB</button>
                  <button type="button" className="gold" onClick={() => onLogHitting("Ball in play", "Line drive", "Barrel")}>Barrel</button>
                </div>
                <div className="direction-row">
                  {(["Pull", "Middle", "Opposite"] as Direction[]).map((direction) => (
                    <button key={direction} type="button" className={hitDirection === direction ? "active" : ""} onClick={() => onHitDirection(direction)}>
                      {direction === "Opposite" ? "Oppo" : direction}
                    </button>
                  ))}
                </div>
                <RoundStrip events={hittingEvents} />
              </div>
              <div className="tracking-visual">
                <BaseballField points={hittingEvents.map((event) => event.fieldLocation).filter(isZonePoint)} activePoint={fieldLocation} onSelect={onFieldLocation} />
              </div>
            </div>
          )}

          {mode === "Pitching" && (
            <div className="tracking-layout">
              <div className="tracking-main">
                <SegmentedControl values={PITCHING_STATIONS} active={pitchingStation} onChange={onPitchingStation} />
                <LiveMetrics
                  items={[
                    { label: "Pitches", value: pitchStats.totalPitches },
                    { label: "Strikes", value: pitchStats.strikes },
                    { label: "Strike %", value: formatPct(pitchStats.strikePct) },
                    { label: "Avg Velo", value: formatNumber(pitchStats.avgVelocity, 1) },
                  ]}
                />
                <div className="pitch-type-row">
                  {PITCH_TYPES.slice(0, 7).map((pitchType) => (
                    <button key={pitchType} type="button" className={selectedPitchType === pitchType ? "active" : ""} onClick={() => onPitchType(pitchType)}>
                      {pitchType}
                    </button>
                  ))}
                </div>
                <label className="velo-input">
                  <span>Velocity</span>
                  <input inputMode="numeric" value={velocity} onChange={(event) => onVelocity(event.target.value.replace(/[^0-9.]/g, ""))} />
                </label>
                <div className="quick-pad quick-pad--pitching">
                  <button type="button" onClick={() => onLogPitch("Ball")}>Ball</button>
                  <button type="button" onClick={() => onLogPitch("Called Strike")}>Called Strike</button>
                  <button type="button" className="gold" onClick={() => onLogPitch("Whiff")}>Whiff</button>
                  <button type="button" onClick={() => onLogPitch("Foul")}>Foul</button>
                  <button type="button" onClick={() => onLogPitch("Ball in play", "Ground ball")}>GB</button>
                  <button type="button" onClick={() => onLogPitch("Ball in play", "Line drive")}>LD</button>
                  <button type="button" onClick={() => onLogPitch("Ball in play", "Fly ball")}>FB</button>
                </div>
              </div>
              <div className="tracking-visual zone-stack">
                <span>Actual location</span>
                <StrikeZone points={pitchEvents.map((event) => event.location).filter(isZonePoint)} activePoint={pitchLocation} onSelect={onPitchLocation} />
                <span>Target location</span>
                <StrikeZone compact activePoint={targetLocation} onSelect={onTargetLocation} />
              </div>
            </div>
          )}

          {mode === "Defense" && (
            <div className="tracking-layout">
              <div className="tracking-main">
                <SegmentedControl values={DEFENSE_STATIONS} active={defenseStation} onChange={onDefenseStation} />
                <LiveMetrics
                  items={[
                    { label: "Attempts", value: defenseEvents.length },
                    { label: "Clean", value: defenseEvents.filter((event) => event.outcome === "Clean" || event.outcome === "Good Play" || event.outcome === "Great Play").length },
                    { label: "Clean %", value: formatPct(defenseCleanPct) },
                    { label: "Plus Plays", value: defenseEvents.filter((event) => event.outcome === "Great Play").length },
                  ]}
                />
                <div className="quick-pad quick-pad--defense">
                  <button type="button" onClick={() => onLogDefense("Clean")}>Clean</button>
                  <button type="button" onClick={() => onLogDefense("Error")}>Error</button>
                  <button type="button" onClick={() => onLogDefense("Good Play")}>Good Play</button>
                  <button type="button" className="gold" onClick={() => onLogDefense("Great Play")}>Great Play</button>
                </div>
              </div>
              <div className="tracking-visual defense-visual">
                <Shield size={42} aria-hidden="true" />
                <h3>{defenseStation}</h3>
                <MetricBar label="Clean rep rate" value={defenseCleanPct} />
                <MetricBar label="Difficult plays made" value={pct(defenseEvents.filter((event) => event.outcome === "Great Play").length, defenseEvents.length)} />
              </div>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}

function WeightRoomView({
  data,
  selectedPlayerId,
  form,
  leader,
  onPlayer,
  onOpenPlayer,
  onForm,
  onAddEntry,
}: {
  data: AppData;
  selectedPlayerId: ID;
  form: { exercise: string; weight: string; reps: string; sets: string; effort: string };
  leader?: WeightLeaderResult;
  onPlayer: (playerId: ID) => void;
  onOpenPlayer: (playerId: ID) => void;
  onForm: (form: { exercise: string; weight: string; reps: string; sets: string; effort: string }) => void;
  onAddEntry: () => void;
}) {
  const players = data.players.filter((player) => !player.archived);
  const selected = players.find((player) => player.id === selectedPlayerId) ?? players[0];
  const weeklyRows = players.slice(0, 14).map((player) => buildWeeklyWorkoutRow(data, player));
  const entries = data.workoutEntries.filter((entry) => entry.playerId === selected?.id).slice(0, 8);
  const metrics = selected ? buildWeightMetrics(data, selected.id) : undefined;

  return (
    <div className="page-stack weights-page">
      <SectionHeader eyebrow="Weight Room" title="Development Scoreboard" body="Weekly completion, improvement, consistency, and effort without overvaluing absolute size." />
      <section className="weights-grid">
        <WeightLeaderCard leader={leader} onOpenPlayer={onOpenPlayer} />
        <article className="panel workout-entry">
          <div className="panel-heading tight">
            <div>
              <span>Quick Entry</span>
              <h2>{selected?.name ?? "Select Player"}</h2>
            </div>
            {selected && <button className="ghost-button" type="button" onClick={() => onOpenPlayer(selected.id)}><ChevronRight size={16} aria-hidden="true" /></button>}
          </div>
          <div className="compact-player-grid">
            {players.slice(0, 10).map((player) => (
              <button key={player.id} type="button" className={player.id === selectedPlayerId ? "active" : ""} onClick={() => onPlayer(player.id)}>
                <PlayerAvatar player={player} size="sm" compact />
                <span>{player.name.split(" ").slice(-1)[0]}</span>
              </button>
            ))}
          </div>
          <div className="form-grid">
            <label>
              <span>Exercise</span>
              <select value={form.exercise} onChange={(event) => onForm({ ...form, exercise: event.target.value })}>
                {EXERCISES.map((exercise) => <option key={exercise}>{exercise}</option>)}
              </select>
            </label>
            <label>
              <span>Weight</span>
              <input inputMode="numeric" value={form.weight} onChange={(event) => onForm({ ...form, weight: event.target.value.replace(/[^0-9.]/g, "") })} />
            </label>
            <label>
              <span>Reps</span>
              <input inputMode="numeric" value={form.reps} onChange={(event) => onForm({ ...form, reps: event.target.value.replace(/[^0-9]/g, "") })} />
            </label>
            <label>
              <span>Sets</span>
              <input inputMode="numeric" value={form.sets} onChange={(event) => onForm({ ...form, sets: event.target.value.replace(/[^0-9]/g, "") })} />
            </label>
            <label>
              <span>Effort</span>
              <input inputMode="numeric" value={form.effort} onChange={(event) => onForm({ ...form, effort: event.target.value.replace(/[^0-9]/g, "") })} />
            </label>
          </div>
          <button className="primary-button stretch-button" type="button" onClick={onAddEntry}>
            <Save size={16} aria-hidden="true" />
            Save Workout Entry
          </button>
        </article>

        <article className="panel weekly-grid">
          <div className="panel-heading">
            <div>
              <span>Weekly View</span>
              <h2>Completion Grid</h2>
            </div>
            <small>Week of Aug 3</small>
          </div>
          <div className="workout-table" role="table" aria-label="Weekly workout completion">
            <div className="workout-table__header" role="row">
              <span>Player</span><span>Mon</span><span>Tue</span><span>Thu</span><span>Fri</span><span>Complete</span>
            </div>
            {weeklyRows.map((row) => (
              <button key={row.player.id} className="workout-row" type="button" onClick={() => onPlayer(row.player.id)} role="row">
                <span>{row.player.name}</span>
                {row.days.map((day) => <span key={day.day} className={day.completed ? "check-cell" : "miss-cell"}>{day.completed ? "✓" : "-"}</span>)}
                <strong>{Math.round(row.completion)}%</strong>
              </button>
            ))}
          </div>
        </article>

        <article className="panel weight-trends">
          <div className="panel-heading tight">
            <div>
              <span>Player Trends</span>
              <h2>{selected?.name ?? "Select Player"}</h2>
            </div>
          </div>
          {metrics && (
            <>
              <div className="mini-stat-grid">
                <StatTile label="Body Weight" value={`${metrics.bodyWeight} lb`} sub={metrics.bodyDelta} />
                <StatTile label="Squat" value={metrics.squat} sub={metrics.squatDelta} />
                <StatTile label="Bench" value={metrics.bench} sub={metrics.benchDelta} />
                <StatTile label="Development" value={metrics.score} sub="score" accent />
              </div>
              <MiniLineChart values={metrics.trend} labels={["Start", "Now"]} />
            </>
          )}
          <div className="entry-list">
            {entries.map((entry) => (
              <div key={entry.id}>
                <span>{entry.exercise}</span>
                <strong>{entry.weight ? `${entry.weight} lb` : `${entry.value ?? "--"} ${entry.unit ?? ""}`}</strong>
                <small>{entry.sets ?? 1} x {entry.reps ?? "-"}</small>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

function GamesView({
  data,
  selectedGameId,
  selectedPitchType,
  velocity,
  pitchLocation,
  onGame,
  onPitchType,
  onVelocity,
  onPitchLocation,
  onLogPitch,
  onAdjust,
  onOpenPlayer,
  onStartGame,
}: {
  data: AppData;
  selectedGameId: ID;
  selectedPitchType: PitchType;
  velocity: string;
  pitchLocation: ZonePoint;
  onGame: (gameId: ID) => void;
  onPitchType: (pitchType: PitchType) => void;
  onVelocity: (value: string) => void;
  onPitchLocation: (point: ZonePoint) => void;
  onLogPitch: (outcome: GamePitchOutcome, ballInPlayOutcome?: GameBallInPlayOutcome) => void;
  onAdjust: (field: "metrolinaScore" | "opponentScore" | "outs", delta: number) => void;
  onOpenPlayer: (playerId: ID) => void;
  onStartGame: () => void;
}) {
  const game = data.games.find((item) => item.id === selectedGameId) ?? data.games[0];
  const pitcher = data.players.find((player) => player.id === game?.currentPitcherId);
  const batter = data.players.find((player) => player.id === game?.currentBatterId);
  const events = game ? data.gameEvents.filter((event) => event.gameId === game.id) : [];

  return (
    <div className="page-stack games-page">
      <SectionHeader
        eyebrow="Game Time"
        title="Official Game Operations"
        body="Separate game stats from practice and Live BP while preserving pitch-by-pitch context."
        action={<button className="primary-button" type="button" onClick={onStartGame}><Plus size={16} aria-hidden="true" />Start Game</button>}
      />

      <section className="games-layout">
        <aside className="panel games-list">
          {data.games.map((item) => (
            <button key={item.id} type="button" className={item.id === game?.id ? "active" : ""} onClick={() => onGame(item.id)}>
              <span>{shortDate(item.date)}</span>
              <strong>{item.homeAway === "Home" ? "vs" : "at"} {item.opponent}</strong>
              <small>{item.result ? `${item.result} ${item.metrolinaScore}-${item.opponentScore}` : `${item.type} - ${item.location}`}</small>
            </button>
          ))}
        </aside>

        {game && (
          <section className="panel game-console">
            <div className="scoreboard">
              <div>
                <span>Metrolina</span>
                <strong>{game.metrolinaScore}</strong>
              </div>
              <div>
                <span>{game.opponent}</span>
                <strong>{game.opponentScore}</strong>
              </div>
              <div>
                <span>{game.half} {game.inning}</span>
                <strong>{game.outs} Out{game.outs === 1 ? "" : "s"}</strong>
              </div>
            </div>

            <div className="game-state-grid">
              <PlayerGameChip label="Pitcher" player={pitcher} onOpen={onOpenPlayer} />
              <PlayerGameChip label="Batter" player={batter} onOpen={onOpenPlayer} />
              <div className="count-card">
                <span>Count</span>
                <strong>{game.balls}-{game.strikes}</strong>
                <small>{baseLine(game)}</small>
              </div>
            </div>

            <div className="game-input-layout">
              <div>
                <div className="pitch-type-row">
                  {PITCH_TYPES.slice(0, 7).map((pitchType) => (
                    <button key={pitchType} type="button" className={selectedPitchType === pitchType ? "active" : ""} onClick={() => onPitchType(pitchType)}>{pitchType}</button>
                  ))}
                </div>
                <label className="velo-input">
                  <span>Velocity</span>
                  <input inputMode="numeric" value={velocity} onChange={(event) => onVelocity(event.target.value.replace(/[^0-9.]/g, ""))} />
                </label>
                <div className="quick-pad quick-pad--game">
                  {GAME_PITCH_BUTTONS.map((outcome) => (
                    <button key={outcome} type="button" className={outcome === "In Play" ? "gold" : ""} onClick={() => outcome === "In Play" ? undefined : onLogPitch(outcome)}>
                      {outcome}
                    </button>
                  ))}
                </div>
                <div className="bip-grid">
                  {BIP_OUTCOMES.map((outcome) => (
                    <button key={outcome} type="button" onClick={() => onLogPitch("In Play", outcome)}>
                      {outcome}
                    </button>
                  ))}
                </div>
              </div>
              <div className="zone-stack">
                <StrikeZone activePoint={pitchLocation} points={events.map((event) => event.location).filter(isZonePoint)} onSelect={onPitchLocation} />
                <div className="manual-row">
                  <button type="button" onClick={() => onAdjust("metrolinaScore", 1)}>+ Metro</button>
                  <button type="button" onClick={() => onAdjust("opponentScore", 1)}>+ Opp</button>
                  <button type="button" onClick={() => onAdjust("outs", 1)}>+ Out</button>
                </div>
              </div>
            </div>
          </section>
        )}
      </section>
    </div>
  );
}

function AnalyticsView({
  data,
  context,
  dateFilter,
  onContext,
  onDateFilter,
  onOpenPlayer,
}: {
  data: AppData;
  context: AnalyticsContext;
  dateFilter: DateFilter;
  onContext: (context: AnalyticsContext) => void;
  onDateFilter: (filter: DateFilter) => void;
  onOpenPlayer: (playerId: ID) => void;
}) {
  const hitterLeaders = buildHittingLeaders(data, "contactPct", 12).slice(0, 5);
  const barrelLeaders = buildHittingLeaders(data, "barrelPct", 12).slice(0, 5);
  const pitcherLeaders = buildPitchingLeaders(data, "cswPct", 18).slice(0, 5);
  const veloLeaders = buildPitchingLeaders(data, "avgVelocity", 18).slice(0, 5);
  const weightLeader = buildWeightLeader(data);

  return (
    <div className="page-stack">
      <SectionHeader eyebrow="Analytics" title="Whole Player Trends" body="Practice, game, Live BP, and weight-room context stay separate but comparable." />
      <section className="toolbar-panel">
        <SegmentedControl values={["All", "Practice", "Game", "Live BP", "Weight Room"] as AnalyticsContext[]} active={context} onChange={onContext} />
        <SegmentedControl values={["Last Week", "Last 30 Days", "Fall"] as DateFilter[]} active={dateFilter} onChange={onDateFilter} />
      </section>
      <section className="analytics-grid">
        <article className="panel">
          <div className="panel-heading"><div><span>Hitting Leaders</span><h2>Contact %</h2></div><small>Min 12 swings</small></div>
          <LeaderRows leaders={hitterLeaders} format={(value) => formatPct(value)} onOpenPlayer={onOpenPlayer} />
        </article>
        <article className="panel">
          <div className="panel-heading"><div><span>Hitting Leaders</span><h2>Barrel %</h2></div><small>Min 12 swings</small></div>
          <LeaderRows leaders={barrelLeaders} format={(value) => formatPct(value)} onOpenPlayer={onOpenPlayer} />
        </article>
        <article className="panel">
          <div className="panel-heading"><div><span>Pitching Leaders</span><h2>CSW %</h2></div><small>Min 18 pitches</small></div>
          <LeaderRows leaders={pitcherLeaders} format={(value) => formatPct(value)} onOpenPlayer={onOpenPlayer} />
        </article>
        <article className="panel">
          <div className="panel-heading"><div><span>Pitching Leaders</span><h2>Velocity</h2></div><small>Min 18 pitches</small></div>
          <LeaderRows leaders={veloLeaders} format={(value) => `${formatNumber(value, 1)} mph`} onOpenPlayer={onOpenPlayer} />
        </article>
        <article className="panel development-card">
          <span>Most Improved Hitter</span>
          <h2>{buildWeeklyMvp(data)?.player.name ?? "No sample"}</h2>
          <p>Composite score uses contact, barrel rate, pitching/defense contribution, attendance, and recent game impact.</p>
        </article>
        <article className="panel development-card">
          <span>Weight Room Development</span>
          <h2>{weightLeader?.player.name ?? "No sample"}</h2>
          <p>{weightLeader ? `Development score ${weightLeader.score}: ${weightLeader.reasons.join(", ")}` : "Add weekly workouts to unlock rankings."}</p>
        </article>
      </section>
    </div>
  );
}

function PlayerProfile({
  data,
  player,
  tab,
  onTab,
  onEdit,
  onStatus,
}: {
  data: AppData;
  player: Player;
  tab: ProfileTab;
  onTab: (tab: ProfileTab) => void;
  onEdit: () => void;
  onStatus: (playerId: ID, status: RosterStatus) => void;
}) {
  const pitchEvents = playerPitchEvents(data, player.id);
  const hittingEvents = playerHittingEvents(data, player.id);
  const defenseEvents = data.defenseEvents.filter((event) => event.playerId === player.id);
  const pitchStats = calculatePitchingStats(pitchEvents);
  const hitStats = calculateHittingStats(hittingEvents);
  const workoutMetrics = buildWeightMetrics(data, player.id);
  const notes = data.coachNotes.filter((note) => note.scope.type === "Player" && note.scope.playerId === player.id);
  const goals = data.developmentGoals.filter((goal) => goal.playerId === player.id);
  const attendance = new Set(data.attendance.filter((item) => item.playerId === player.id).map((item) => item.practiceId)).size;

  return (
    <div className="page-stack profile-page">
      <section className="profile-header panel">
        <PlayerAvatar player={player} size="xl" />
        <div>
          <span>{player.rosterStatus}</span>
          <h2>#{player.jerseyNumber} {player.name}</h2>
          <small>{positionLine(player)} - {player.graduationYear} - {player.bats}/{player.throws} - {player.height} - {player.weight} lb</small>
        </div>
        <div className="status-toggle">
          {ROSTER_STATUSES.map((status) => (
            <button key={status} type="button" className={player.rosterStatus === status ? "active" : ""} onClick={() => onStatus(player.id, status)}>{status}</button>
          ))}
        </div>
        <button className="secondary-button" type="button" onClick={onEdit}>
          <Edit3 size={16} aria-hidden="true" />
          Edit
        </button>
      </section>

      <SegmentedControl values={["overview", "practice", "games", "pitching", "hitting", "defense", "weights", "notes"] as ProfileTab[]} active={tab} onChange={onTab} />

      {tab === "overview" && (
        <section className="profile-grid">
          <article className="panel">
            <div className="panel-heading tight"><div><span>Overview</span><h2>Fall Record</h2></div></div>
            <div className="mini-stat-grid">
              <StatTile label="Attendance" value={attendance} sub="practices" />
              <StatTile label="Swings" value={hitStats.totalSwings} sub={formatPct(hitStats.hardHitPct) + " hard hit"} />
              <StatTile label="Pitches" value={pitchStats.totalPitches} sub={formatPct(pitchStats.strikePct) + " strikes"} />
              <StatTile label="Development" value={workoutMetrics?.score ?? "--"} sub="weight score" accent />
            </div>
            <MiniLineChart values={trendByPractice(data.practices, hittingEvents, (events) => calculateHittingStats(events).hardHitPct).map((item) => item.value)} />
          </article>
          <article className="panel">
            <div className="panel-heading tight"><div><span>Development Focus</span><h2>Current Goals</h2></div></div>
            <div className="goal-list">
              {goals.map((goal, index) => <div key={goal.id}><strong>{index + 1}. {goal.title}</strong><small>{goal.tags.join(", ")}</small></div>)}
            </div>
          </article>
        </section>
      )}

      {tab === "practice" && (
        <section className="profile-grid">
          <article className="panel"><div className="panel-heading"><div><span>Practice</span><h2>Recent Sessions</h2></div></div><SessionList data={data} player={player} /></article>
          <article className="panel"><Heatmap points={pitchEvents.map((event) => event.location).filter(isZonePoint)} /></article>
        </section>
      )}

      {tab === "games" && (
        <section className="profile-grid">
          <article className="panel">
            <div className="panel-heading"><div><span>Game Stats</span><h2>Official Context</h2></div></div>
            <GamePlayerSummary data={data} player={player} />
          </article>
        </section>
      )}

      {tab === "pitching" && (
        <section className="profile-grid">
          <article className="panel">
            <div className="mini-stat-grid">
              <StatTile label="Pitches" value={pitchStats.totalPitches} />
              <StatTile label="Strike %" value={formatPct(pitchStats.strikePct)} />
              <StatTile label="CSW %" value={formatPct(pitchStats.cswPct)} />
              <StatTile label="Avg Velo" value={formatNumber(pitchStats.avgVelocity, 1)} accent />
            </div>
            <DonutChart items={Object.values(pitchStats.byPitchType).slice(0, 6).map((item, index) => ({ label: item.pitchType, value: item.pitches, color: PITCH_MIX_COLORS[index % PITCH_MIX_COLORS.length] }))} />
          </article>
          <article className="panel"><Heatmap points={pitchEvents.map((event) => event.location).filter(isZonePoint)} /></article>
        </section>
      )}

      {tab === "hitting" && (
        <section className="profile-grid">
          <article className="panel">
            <div className="mini-stat-grid">
              <StatTile label="Swings" value={hitStats.totalSwings} />
              <StatTile label="Contact %" value={formatPct(hitStats.contactPct)} />
              <StatTile label="Hard Hit" value={formatPct(hitStats.hardHitPct)} />
              <StatTile label="Barrel" value={formatPct(hitStats.barrelPct)} accent />
            </div>
            <MiniLineChart values={trendByPractice(data.practices, hittingEvents, (events) => calculateHittingStats(events).contactPct).map((item) => item.value)} />
          </article>
          <article className="panel"><BaseballField points={hittingEvents.map((event) => event.fieldLocation).filter(isZonePoint)} /></article>
        </section>
      )}

      {tab === "defense" && (
        <section className="profile-grid">
          <article className="panel">
            <div className="mini-stat-grid">
              <StatTile label="Attempts" value={defenseEvents.length} />
              <StatTile label="Clean %" value={formatPct(pct(defenseEvents.filter((event) => event.outcome !== "Error").length, defenseEvents.length))} />
              <StatTile label="Great Plays" value={defenseEvents.filter((event) => event.outcome === "Great Play").length} accent />
            </div>
          </article>
        </section>
      )}

      {tab === "weights" && (
        <section className="profile-grid">
          <article className="panel">
            {workoutMetrics && (
              <>
                <div className="mini-stat-grid">
                  <StatTile label="Body Weight" value={`${workoutMetrics.bodyWeight} lb`} sub={workoutMetrics.bodyDelta} />
                  <StatTile label="Squat" value={workoutMetrics.squat} sub={workoutMetrics.squatDelta} />
                  <StatTile label="Bench" value={workoutMetrics.bench} sub={workoutMetrics.benchDelta} />
                  <StatTile label="Score" value={workoutMetrics.score} accent />
                </div>
                <MiniLineChart values={workoutMetrics.trend} />
              </>
            )}
          </article>
        </section>
      )}

      {tab === "notes" && (
        <section className="profile-grid">
          <article className="panel note-list">
            {notes.map((note) => <div key={note.id}><strong>{note.tags.join(", ")}</strong><p>{note.text}</p><small>{fullDate(note.createdAt.slice(0, 10))}</small></div>)}
          </article>
        </section>
      )}
    </div>
  );
}

function StartPracticeModal({ data, onClose, onCreate }: { data: AppData; onClose: () => void; onCreate: (practice: Practice) => void }) {
  const [form, setForm] = useState({
    date: "2026-08-08",
    name: "Saturday Development Practice",
    type: "Full Practice" as PracticeType,
    location: "Metrolina Varsity Field",
    notes: "",
  });
  const [attending, setAttending] = useState<ID[]>(data.players.filter((player) => !player.archived).map((player) => player.id));
  const [pitchers, setPitchers] = useState<ID[]>(data.players.filter((player) => player.isPitcher && !player.archived).map((player) => player.id));
  const [hitters, setHitters] = useState<ID[]>(data.players.filter((player) => player.isHitter && !player.archived).map((player) => player.id));

  function toggle(list: ID[], id: ID, setter: (ids: ID[]) => void) {
    setter(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  }

  return (
    <ModalFrame title="Start Practice" onClose={onClose}>
      <div className="form-grid">
        <label><span>Date</span><input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
        <label><span>Practice name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label><span>Type</span><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as PracticeType })}>{PRACTICE_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
        <label><span>Location</span><input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label>
        <label className="wide"><span>Notes</span><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
      </div>
      <RosterPicker title="Attending" players={data.players} selected={attending} onToggle={(id) => toggle(attending, id, setAttending)} />
      <RosterPicker title="Pitchers Throwing" players={data.players.filter((player) => player.isPitcher)} selected={pitchers} onToggle={(id) => toggle(pitchers, id, setPitchers)} />
      <RosterPicker title="Hitters Participating" players={data.players.filter((player) => player.isHitter)} selected={hitters} onToggle={(id) => toggle(hitters, id, setHitters)} />
      <button className="primary-button stretch-button" type="button" onClick={() => onCreate({
        id: createId("practice"),
        date: form.date,
        name: form.name,
        type: form.type,
        location: form.location,
        notes: form.notes,
        playerIds: attending,
        pitcherIds: pitchers,
        hitterIds: hitters,
        startedAt: new Date(`${form.date}T18:00:00`).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })}>
        Enter Active Practice
      </button>
    </ModalFrame>
  );
}

function StartGameModal({ data, onClose, onCreate }: { data: AppData; onClose: () => void; onCreate: (game: Game) => void }) {
  const starters = data.players.filter((player) => !player.archived && player.rosterStatus !== "Cut").slice(0, 9).map((player) => player.id);
  const [form, setForm] = useState({
    opponent: "Charlotte Latin",
    homeAway: "Home" as Game["homeAway"],
    date: "2026-08-15",
    location: "Metrolina Varsity Field",
    type: "Fall Game" as GameType,
    startingPitcherId: data.players.find((player) => player.isPitcher)?.id ?? starters[0],
  });
  const [lineup, setLineup] = useState<ID[]>(starters);

  return (
    <ModalFrame title="Start Game" onClose={onClose}>
      <div className="form-grid">
        <label><span>Opponent</span><input value={form.opponent} onChange={(event) => setForm({ ...form, opponent: event.target.value })} /></label>
        <label><span>Home/Away</span><select value={form.homeAway} onChange={(event) => setForm({ ...form, homeAway: event.target.value as Game["homeAway"] })}><option>Home</option><option>Away</option></select></label>
        <label><span>Date</span><input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
        <label><span>Location</span><input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label>
        <label><span>Game type</span><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as GameType })}>{GAME_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
        <label><span>Starting pitcher</span><select value={form.startingPitcherId} onChange={(event) => setForm({ ...form, startingPitcherId: event.target.value })}>{data.players.filter((player) => player.isPitcher).map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></label>
      </div>
      <RosterPicker title="Lineup" players={data.players.filter((player) => player.rosterStatus !== "Cut")} selected={lineup} onToggle={(id) => setLineup(lineup.includes(id) ? lineup.filter((item) => item !== id) : [...lineup, id])} />
      <button className="primary-button stretch-button" type="button" onClick={() => onCreate({
        id: createId("game"),
        date: form.date,
        opponent: form.opponent,
        homeAway: form.homeAway,
        location: form.location,
        type: form.type,
        metrolinaScore: 0,
        opponentScore: 0,
        inning: 1,
        half: form.homeAway === "Home" ? "Top" : "Bottom",
        outs: 0,
        balls: 0,
        strikes: 0,
        runners: {},
        lineup,
        positions: {},
        startingPitcherId: form.startingPitcherId,
        currentPitcherId: form.startingPitcherId,
        currentBatterId: lineup[0],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })}>
        Open Scoring Console
      </button>
    </ModalFrame>
  );
}

function PlayerEditorModal({ player, onClose, onSave, onArchive }: { player?: Player; onClose: () => void; onSave: (player: Player) => void; onArchive: (playerId: ID) => void }) {
  const [form, setForm] = useState<Player>(
    player ?? {
      id: createId("p"),
      name: "",
      jerseyNumber: 0,
      primaryPosition: "P",
      secondaryPosition: "SS",
      bats: "R",
      throws: "R",
      graduationYear: 2027,
      rosterStatus: "Undecided",
      programLevel: "Development",
      height: "6-0",
      weight: 175,
      avatarColor: "#9f244c",
      isPitcher: true,
      isHitter: true,
      notes: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  );

  return (
    <ModalFrame title={player ? "Edit Player" : "Add Player"} onClose={onClose}>
      <div className="form-grid">
        <label><span>Name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label><span>Number</span><input inputMode="numeric" value={form.jerseyNumber} onChange={(event) => setForm({ ...form, jerseyNumber: Number(event.target.value) || 0 })} /></label>
        <label><span>Graduation</span><input inputMode="numeric" value={form.graduationYear} onChange={(event) => setForm({ ...form, graduationYear: Number(event.target.value) || 2027 })} /></label>
        <label><span>Primary</span><select value={form.primaryPosition} onChange={(event) => setForm({ ...form, primaryPosition: event.target.value as Position })}>{POSITIONS.map((position) => <option key={position}>{position}</option>)}</select></label>
        <label><span>Secondary</span><select value={form.secondaryPosition} onChange={(event) => setForm({ ...form, secondaryPosition: event.target.value as Position })}>{POSITIONS.map((position) => <option key={position}>{position}</option>)}</select></label>
        <label><span>Bats</span><select value={form.bats} onChange={(event) => setForm({ ...form, bats: event.target.value as Player["bats"] })}><option>R</option><option>L</option><option>S</option></select></label>
        <label><span>Throws</span><select value={form.throws} onChange={(event) => setForm({ ...form, throws: event.target.value as Player["throws"] })}><option>R</option><option>L</option></select></label>
        <label><span>Status</span><select value={form.rosterStatus} onChange={(event) => setForm({ ...form, rosterStatus: event.target.value as RosterStatus })}>{ROSTER_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
        <label><span>Height</span><input value={form.height ?? ""} onChange={(event) => setForm({ ...form, height: event.target.value })} /></label>
        <label><span>Weight</span><input inputMode="numeric" value={form.weight ?? ""} onChange={(event) => setForm({ ...form, weight: Number(event.target.value) || undefined })} /></label>
        <label className="checkbox-row"><input type="checkbox" checked={form.isPitcher} onChange={(event) => setForm({ ...form, isPitcher: event.target.checked })} />Pitcher</label>
        <label className="checkbox-row"><input type="checkbox" checked={form.isHitter} onChange={(event) => setForm({ ...form, isHitter: event.target.checked })} />Hitter</label>
        <label className="wide"><span>Notes</span><textarea value={form.notes ?? ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
      </div>
      <div className="modal-actions">
        {player && <button className="secondary-button" type="button" onClick={() => onArchive(player.id)}><Archive size={16} aria-hidden="true" />Archive</button>}
        <button className="primary-button" type="button" onClick={() => onSave({ ...form, updatedAt: new Date().toISOString() })}><Save size={16} aria-hidden="true" />Save Player</button>
      </div>
    </ModalFrame>
  );
}

function SessionSummaryModal({ data, summary, note, onNote, onSave, onClose }: { data: AppData; summary: { type: "Hitting" | "Pitching" | "Defense"; sessionId: ID }; note: string; onNote: (note: string) => void; onSave: () => void; onClose: () => void }) {
  const details = buildSessionSummary(data, summary);
  return (
    <ModalFrame title="Session Summary" onClose={onClose}>
      <div className="summary-hero">
        <span>{summary.type}</span>
        <h2>{details.title}</h2>
        <div className="mini-stat-grid">
          {details.stats.map((item) => (
            <StatTile key={item.label} label={item.label} value={item.value} sub={"sub" in item ? String(item.sub) : undefined} />
          ))}
        </div>
      </div>
      <label className="wide note-field">
        <span>Coach notes</span>
        <textarea value={note} onChange={(event) => onNote(event.target.value)} placeholder="Add what should carry into the next session..." />
      </label>
      <button className="primary-button stretch-button" type="button" onClick={onSave}>Save Summary</button>
    </ModalFrame>
  );
}

function SectionHeader({ eyebrow, title, body, action }: { eyebrow: string; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <section className="section-header">
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
        {body && <p>{body}</p>}
      </div>
      {action}
    </section>
  );
}

function ActionCard({ icon: Icon, label, detail, onClick }: { icon: LucideIcon; label: string; detail: string; onClick: () => void }) {
  return (
    <button className="action-card" type="button" onClick={onClick}>
      <Icon size={18} aria-hidden="true" />
      <span><strong>{label}</strong><small>{detail}</small></span>
      <ChevronRight size={16} aria-hidden="true" />
    </button>
  );
}

function SegmentedControl<T extends string>({ values, active, onChange }: { values: T[]; active: T; onChange: (value: T) => void }) {
  return (
    <div className="segmented-control">
      {values.map((value) => (
        <button key={value} type="button" className={value === active ? "active" : ""} onClick={() => onChange(value)}>
          {formatSegment(value)}
        </button>
      ))}
    </div>
  );
}

function AwardCard({ title, award, onOpenPlayer, icon: Icon }: { title: string; award?: AwardResult; onOpenPlayer: (playerId: ID) => void; icon: LucideIcon }) {
  return (
    <article className="panel award-card">
      <div className="award-card__top">
        <span>{title}</span>
        <Icon size={18} aria-hidden="true" />
      </div>
      {award ? (
        <>
          <button type="button" className="award-player" onClick={() => onOpenPlayer(award.player.id)}>
            <PlayerAvatar player={award.player} size="lg" />
            <span><small>#{award.player.jerseyNumber}</small><strong>{award.player.name}</strong><em>{positionLine(award.player)}</em></span>
          </button>
          <div className="reason-list">{award.reasons.map((reason) => <span key={reason}>{reason}</span>)}</div>
        </>
      ) : (
        <CompactEmpty title="No weekly sample" />
      )}
    </article>
  );
}

function WeightLeaderCard({ leader, onOpenPlayer }: { leader?: WeightLeaderResult; onOpenPlayer: (playerId: ID) => void }) {
  return (
    <article className="panel award-card weight-leader">
      <div className="award-card__top">
        <span>Weight Room Leader</span>
        <Dumbbell size={18} aria-hidden="true" />
      </div>
      {leader ? (
        <>
          <button type="button" className="award-player" onClick={() => onOpenPlayer(leader.player.id)}>
            <PlayerAvatar player={leader.player} size="lg" />
            <span><small>#{leader.player.jerseyNumber}</small><strong>{leader.player.name}</strong><em>Development Score {leader.score}</em></span>
          </button>
          <div className="reason-list">{leader.reasons.map((reason) => <span key={reason}>{reason}</span>)}</div>
        </>
      ) : (
        <CompactEmpty title="No workouts yet" />
      )}
    </article>
  );
}

function LeaderList({ title, leaders, metricKey, fallback, onOpenPlayer }: { title: string; leaders: Array<{ playerId: ID; name: string; value: number; sample: number; meta?: unknown }>; metricKey: string; fallback: string; onOpenPlayer: (playerId: ID) => void }) {
  return (
    <div className="compact-leader-list">
      <h3>{title}</h3>
      {leaders.length ? leaders.map((leader) => (
        <button key={leader.playerId} type="button" onClick={() => onOpenPlayer(leader.playerId)}>
          <span>{leader.name}</span>
          <strong>{metricKey === "avgVelocity" ? `${formatNumber(leader.value, 1)} mph` : formatPct(leader.value)}</strong>
          <small>{leader.sample} reps</small>
        </button>
      )) : <p>{fallback}</p>}
    </div>
  );
}

function LeaderRows({ leaders, format, onOpenPlayer }: { leaders: Array<{ playerId: ID; name: string; value: number; sample: number }>; format: (value: number) => string; onOpenPlayer: (playerId: ID) => void }) {
  return (
    <div className="leader-rows">
      {leaders.map((leader, index) => (
        <button key={leader.playerId} type="button" onClick={() => onOpenPlayer(leader.playerId)}>
          <span>{index + 1}</span>
          <strong>{leader.name}</strong>
          <em>{format(leader.value)}</em>
          <small>{leader.sample} reps</small>
        </button>
      ))}
    </div>
  );
}

function LiveMetrics({ items }: { items: Array<{ label: string; value: string | number }> }) {
  return (
    <div className="live-metrics">
      {items.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}
    </div>
  );
}

function RoundStrip({ events }: { events: HittingEvent[] }) {
  return (
    <div className="round-strip" aria-label="Recent round results">
      {events.slice(0, 12).reverse().map((event) => (
        <span key={event.id} className={event.contactQuality === "Barrel" ? "barrel" : ""}>
          {event.action === "Miss" ? "MISS" : event.action === "Foul" ? "FOUL" : event.contactResult?.split(" ").map((part) => part[0]).join("") ?? "TAKE"}
        </span>
      ))}
    </div>
  );
}

function PlayerGameChip({ label, player, onOpen }: { label: string; player?: Player; onOpen: (playerId: ID) => void }) {
  return (
    <button type="button" className="player-game-chip" onClick={() => player && onOpen(player.id)} disabled={!player}>
      <span>{label}</span>
      <strong>{player ? `#${player.jerseyNumber} ${player.name}` : "Not set"}</strong>
      {player && <small>{positionLine(player)}</small>}
    </button>
  );
}

function ScheduleRow({ title, primary, meta }: { title: string; primary: string; meta: string }) {
  return <div className="schedule-row"><span>{title}</span><strong>{primary}</strong><small>{meta}</small></div>;
}

function CompactEmpty({ title, action }: { title: string; action?: React.ReactNode }) {
  return <div className="compact-empty"><span>{title}</span>{action}</div>;
}

function ModalFrame({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-panel">
        <div className="modal-title">
          <h2>{title}</h2>
          <button className="ghost-button" type="button" onClick={onClose} aria-label="Close dialog"><X size={18} aria-hidden="true" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function RosterPicker({ title, players, selected, onToggle }: { title: string; players: Player[]; selected: ID[]; onToggle: (playerId: ID) => void }) {
  return (
    <section className="roster-picker">
      <div><strong>{title}</strong><small>{selected.length} selected</small></div>
      <div>
        {players.filter((player) => !player.archived).map((player) => (
          <button key={player.id} type="button" className={selected.includes(player.id) ? "active" : ""} onClick={() => onToggle(player.id)}>
            <Check size={14} aria-hidden="true" />
            #{player.jerseyNumber} {player.name}
          </button>
        ))}
      </div>
    </section>
  );
}

function SessionList({ data, player }: { data: AppData; player: Player }) {
  const sessions = [
    ...data.hittingSessions.filter((session) => session.hitterId === player.id).map((session) => ({ id: session.id, label: session.type, type: "Hitting", date: data.practices.find((practice) => practice.id === session.practiceId)?.date })),
    ...data.pitchingSessions.filter((session) => session.pitcherId === player.id).map((session) => ({ id: session.id, label: session.type, type: "Pitching", date: data.practices.find((practice) => practice.id === session.practiceId)?.date })),
    ...data.defenseSessions.filter((session) => session.playerId === player.id).map((session) => ({ id: session.id, label: session.station, type: "Defense", date: data.practices.find((practice) => practice.id === session.practiceId)?.date })),
  ].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  return (
    <div className="entry-list">
      {sessions.slice(0, 8).map((session) => (
        <div key={session.id}><span>{session.type}</span><strong>{session.label}</strong><small>{session.date ? fullDate(session.date) : "Practice"}</small></div>
      ))}
    </div>
  );
}

function GamePlayerSummary({ data, player }: { data: AppData; player: Player }) {
  const battingEvents = data.gameEvents.filter((event) => event.batterId === player.id);
  const pitchingEvents = data.gameEvents.filter((event) => event.pitcherId === player.id);
  const hits = battingEvents.filter((event) => event.ballInPlayOutcome && ["Single", "Double", "Triple", "Home Run"].includes(event.ballInPlayOutcome)).length;
  const pa = Math.max(1, battingEvents.filter((event) => event.pitchOutcome === "In Play" || event.pitchOutcome === "Ball" || event.pitchOutcome === "Swinging Strike").length);
  return (
    <div className="mini-stat-grid">
      <StatTile label="PA" value={pa} />
      <StatTile label="Hits" value={hits} />
      <StatTile label="AVG" value={formatDecimal(hits / pa)} />
      <StatTile label="Pitches" value={pitchingEvents.length} accent />
    </div>
  );
}

interface AwardResult {
  player: Player;
  score: number;
  reasons: string[];
}

interface WeightLeaderResult {
  player: Player;
  score: number;
  reasons: string[];
}

function buildWeeklyMvp(data: AppData): AwardResult | undefined {
  const latestDate = data.practices.slice().sort((a, b) => b.date.localeCompare(a.date))[0]?.date ?? "2026-08-08";
  const start = new Date(`${latestDate}T12:00:00`);
  start.setDate(start.getDate() - 7);
  const recentPracticeIds = new Set(data.practices.filter((practice) => new Date(`${practice.date}T12:00:00`) >= start).map((practice) => practice.id));

  const awards = data.players.filter((player) => !player.archived).map((player) => {
    const hittingStats = calculateHittingStats(data.hittingEvents.filter((event) => event.hitterId === player.id && recentPracticeIds.has(event.practiceId)));
    const pitchingStats = calculatePitchingStats(data.pitchEvents.filter((event) => event.pitcherId === player.id && recentPracticeIds.has(event.practiceId)));
    const defenseEvents = data.defenseEvents.filter((event) => event.playerId === player.id && recentPracticeIds.has(event.practiceId));
    const gameEvents = data.gameEvents.filter((event) => event.batterId === player.id || event.pitcherId === player.id);
    const attendance = data.attendance.filter((item) => item.playerId === player.id && recentPracticeIds.has(item.practiceId)).length;
    const defenseScore = pct(defenseEvents.filter((event) => event.outcome !== "Error").length, defenseEvents.length);
    const score =
      hittingStats.hardHitPct * 0.22 +
      hittingStats.contactPct * 0.18 +
      hittingStats.barrelPct * 0.12 +
      pitchingStats.strikePct * 0.16 +
      pitchingStats.cswPct * 0.12 +
      defenseScore * 0.08 +
      Math.min(100, attendance * 22) * 0.07 +
      Math.min(100, gameEvents.length * 18) * 0.05;

    return {
      player,
      score,
      reasons: [
        `${formatPct(hittingStats.liveBpAvg * 100, 0)} Live BP AVG`,
        `${Math.round(hittingStats.barrelPct)}% barrel rate`,
        `${Math.round(hittingStats.hardHitPct)}% hard contact`,
        pitchingStats.totalPitches ? `${Math.round(pitchingStats.strikePct)}% strike rate` : `${attendance} practices attended`,
      ].filter((reason) => !reason.startsWith("0% Live BP AVG") || hittingStats.totalSwings > 0),
    };
  });

  return awards.sort((a, b) => b.score - a.score)[0];
}

function buildWeightLeader(data: AppData): WeightLeaderResult | undefined {
  const players = data.players.filter((player) => !player.archived);
  const results = players.map((player) => {
    const sessions = data.workoutSessions.filter((session) => session.playerId === player.id && session.weekOf === "2026-08-03");
    const entries = data.workoutEntries.filter((entry) => entry.playerId === player.id);
    const completed = sessions.filter((session) => session.completed).length;
    const completion = pct(completed, Math.max(4, sessions.length));
    const consistency = completed >= 4 ? 100 : completion;
    const effort = pct(sessions.reduce((sum, session) => sum + session.effortScore, 0) / Math.max(1, sessions.length), 10);
    const improvements = entries
      .map((entry) => {
        const current = entry.weight ?? entry.value;
        if (!current || !entry.priorValue) return 0;
        return ((current - entry.priorValue) / Math.max(1, entry.priorValue)) * 100;
      })
      .filter((value) => Number.isFinite(value));
    const improvement = Math.min(100, averageNumber(improvements) * 8);
    const relativeStrength = Math.min(100, averageNumber(entries.filter((entry) => entry.weight).map((entry) => ((entry.weight ?? 0) / Math.max(1, player.weight ?? 180)) * 45)));
    const score = Math.round(improvement * 0.3 + completion * 0.25 + consistency * 0.2 + relativeStrength * 0.15 + effort * 0.1);
    const squatProgress = entries.find((entry) => entry.exercise === "Back Squat" && entry.weight && entry.priorValue);

    return {
      player,
      score,
      reasons: [
        `+${formatNumber(averageNumber(improvements), 1)}% weekly performance`,
        `${Math.round(completion)}% workouts completed`,
        squatProgress ? `+${(squatProgress.weight ?? 0) - (squatProgress.priorValue ?? 0)} lb squat progression` : "Strength baseline updated",
        `${completed}-workout attendance streak`,
      ],
    };
  });

  return results.sort((a, b) => b.score - a.score)[0];
}

function buildWeightMetrics(data: AppData, playerId: ID) {
  const player = data.players.find((item) => item.id === playerId);
  const entries = data.workoutEntries.filter((entry) => entry.playerId === playerId);
  const squat = latestExercise(entries, "Back Squat");
  const bench = latestExercise(entries, "Bench Press");
  const bodyWeight = data.workoutSessions.find((session) => session.playerId === playerId && session.bodyWeight)?.bodyWeight ?? player?.weight ?? 0;
  const trend = entries.slice(0, 8).reverse().map((entry) => entry.weight ?? entry.value ?? 0).filter(Boolean);
  const score = buildWeightLeader({ ...data, players: player ? [player] : [] })?.score ?? 0;

  return {
    bodyWeight,
    bodyDelta: "+4 lb this fall",
    squat: squat?.weight ? `${squat.weight}` : "--",
    squatDelta: squat?.priorValue && squat.weight ? `+${squat.weight - squat.priorValue} lb` : "baseline",
    bench: bench?.weight ? `${bench.weight}` : "--",
    benchDelta: bench?.priorValue && bench.weight ? `+${bench.weight - bench.priorValue} lb` : "baseline",
    score,
    trend: trend.length ? trend : [65, 72, 78, 84, 91],
  };
}

function latestExercise(entries: Array<{ exercise: string; weight?: number; priorValue?: number }>, exercise: string) {
  return entries.find((entry) => entry.exercise === exercise);
}

function latestExerciseValue(data: AppData, playerId: ID, exercise: string): number | undefined {
  const entry = data.workoutEntries.find((item) => item.playerId === playerId && item.exercise === exercise);
  return entry?.weight ?? entry?.value;
}

function buildWeeklyWorkoutRow(data: AppData, player: Player) {
  const days = ["Mon", "Tue", "Thu", "Fri"].map((day) => {
    const session = data.workoutSessions.find((item) => item.playerId === player.id && item.weekOf === "2026-08-03" && item.day === day);
    return { day, completed: Boolean(session?.completed) };
  });
  return { player, days, completion: pct(days.filter((day) => day.completed).length, days.length) };
}

function buildSessionSummary(data: AppData, summary: { type: "Hitting" | "Pitching" | "Defense"; sessionId: ID }) {
  if (summary.type === "Hitting") {
    const session = data.hittingSessions.find((item) => item.id === summary.sessionId);
    const player = data.players.find((item) => item.id === session?.hitterId);
    const stats = calculateHittingStats(data.hittingEvents.filter((event) => event.sessionId === summary.sessionId));
    return {
      title: `${player?.name ?? "Hitter"} - ${session?.type ?? "Hitting"}`,
      stats: [
        { label: "Swings", value: stats.totalSwings },
        { label: "Contact", value: formatPct(stats.contactPct) },
        { label: "Hard Hit", value: formatPct(stats.hardHitPct) },
        { label: "Barrel", value: formatPct(stats.barrelPct) },
      ],
    };
  }
  if (summary.type === "Pitching") {
    const session = data.pitchingSessions.find((item) => item.id === summary.sessionId);
    const player = data.players.find((item) => item.id === session?.pitcherId);
    const stats = calculatePitchingStats(data.pitchEvents.filter((event) => event.sessionId === summary.sessionId));
    return {
      title: `${player?.name ?? "Pitcher"} - ${session?.type ?? "Pitching"}`,
      stats: [
        { label: "Pitches", value: stats.totalPitches },
        { label: "Strikes", value: stats.strikes },
        { label: "Strike %", value: formatPct(stats.strikePct) },
        { label: "Avg Velo", value: formatNumber(stats.avgVelocity, 1) },
      ],
    };
  }
  const session = data.defenseSessions.find((item) => item.id === summary.sessionId);
  const player = data.players.find((item) => item.id === session?.playerId);
  const events = data.defenseEvents.filter((event) => event.sessionId === summary.sessionId);
  return {
    title: `${player?.name ?? "Defender"} - ${session?.station ?? "Defense"}`,
    stats: [
      { label: "Attempts", value: events.length },
      { label: "Clean", value: events.filter((event) => event.outcome !== "Error").length },
      { label: "Clean %", value: formatPct(pct(events.filter((event) => event.outcome !== "Error").length, events.length)) },
      { label: "Great Plays", value: events.filter((event) => event.outcome === "Great Play").length },
    ],
  };
}

function ensureHittingSession(data: AppData, practice: Practice, playerId: ID, type: HittingSession["type"]) {
  const existing = data.hittingSessions.find((session) => session.practiceId === practice.id && session.hitterId === playerId && session.type === type && !session.endedAt);
  if (existing) return { data, session: existing };
  const session: HittingSession = {
    id: createId("hs"),
    practiceId: practice.id,
    hitterId: playerId,
    type,
    roundGoals: ["Line drives"],
    plannedReps: 20,
    machineVelocity: type === "Machine" ? 85 : undefined,
    machinePitchType: type === "Machine" ? "4-Seam" : undefined,
    startedAt: new Date().toISOString(),
  };
  return { data: { ...data, hittingSessions: [session, ...data.hittingSessions] }, session };
}

function ensurePitchingSession(data: AppData, practice: Practice, playerId: ID, type: PitchingSession["type"]) {
  const existing = data.pitchingSessions.find((session) => session.practiceId === practice.id && session.pitcherId === playerId && session.type === type && !session.endedAt);
  if (existing) return { data, session: existing };
  const session: PitchingSession = {
    id: createId("ps"),
    practiceId: practice.id,
    pitcherId: playerId,
    type,
    focusTags: ["Strike throwing"],
    intendedFocus: "Win the zone early and finish every pitch.",
    startedAt: new Date().toISOString(),
  };
  return { data: { ...data, pitchingSessions: [session, ...data.pitchingSessions] }, session };
}

function ensureDefenseSession(data: AppData, practice: Practice, playerId: ID, station: DefenseStation) {
  const existing = data.defenseSessions.find((session) => session.practiceId === practice.id && session.playerId === playerId && session.station === station && !session.endedAt);
  if (existing) return { data, session: existing };
  const session = {
    id: createId("ds"),
    practiceId: practice.id,
    playerId,
    station,
    mode: "Quick Practice" as const,
    startedAt: new Date().toISOString(),
  };
  return { data: { ...data, defenseSessions: [session, ...data.defenseSessions] }, session };
}

function applyGameOutcome(game: Game, outcome: GamePitchOutcome, ballInPlayOutcome?: GameBallInPlayOutcome): Game {
  let balls = game.balls;
  let strikes = game.strikes;
  let outs = game.outs;
  let metrolinaScore = game.metrolinaScore;
  let opponentScore = game.opponentScore;
  let runners = { ...game.runners };

  if (outcome === "Ball") balls += 1;
  if (outcome === "Called Strike" || outcome === "Swinging Strike") strikes += 1;
  if (outcome === "Foul" && strikes < 2) strikes += 1;

  const isStrikeout = strikes >= 3;
  const isWalk = balls >= 4;
  const isOut = ballInPlayOutcome && ["Ground Out", "Fly Out", "Line Out", "Pop Out", "Sac Fly", "Sac Bunt"].includes(ballInPlayOutcome);
  const isHit = ballInPlayOutcome && ["Single", "Double", "Triple", "Home Run", "Error"].includes(ballInPlayOutcome);

  if (isStrikeout || isOut) outs += 1;
  if (isWalk) runners.first = game.currentBatterId;
  if (isHit) {
    const runnerCount = Object.values(runners).filter(Boolean).length;
    const runs = ballInPlayOutcome === "Home Run" ? runnerCount + 1 : ballInPlayOutcome === "Triple" ? Math.min(3, runnerCount + 1) : ballInPlayOutcome === "Double" ? Math.min(2, runnerCount + 1) : runnerCount >= 2 ? 1 : 0;
    if (game.half === "Bottom") metrolinaScore += runs;
    else opponentScore += runs;
    runners = ballInPlayOutcome === "Home Run" ? {} : { first: game.currentBatterId };
  }

  if (outs >= 3) {
    const nextHalf = game.half === "Top" ? "Bottom" : "Top";
    return {
      ...game,
      half: nextHalf,
      inning: game.half === "Bottom" ? game.inning + 1 : game.inning,
      outs: 0,
      balls: 0,
      strikes: 0,
      runners: {},
      metrolinaScore,
      opponentScore,
      currentBatterId: nextBatter(game),
    };
  }

  return {
    ...game,
    outs,
    balls: isStrikeout || isWalk || ballInPlayOutcome ? 0 : balls,
    strikes: isStrikeout || isWalk || ballInPlayOutcome ? 0 : strikes,
    runners,
    metrolinaScore,
    opponentScore,
    currentBatterId: isStrikeout || isWalk || ballInPlayOutcome ? nextBatter(game) : game.currentBatterId,
  };
}

function nextBatter(game: Game): ID | undefined {
  if (!game.lineup.length) return game.currentBatterId;
  const index = game.lineup.findIndex((playerId) => playerId === game.currentBatterId);
  return game.lineup[(index + 1) % game.lineup.length] ?? game.lineup[0];
}

function gameSituations(game: Game, outcome: GamePitchOutcome, bip?: GameBallInPlayOutcome): string[] {
  const situations: string[] = [];
  if (game.balls === 0 && game.strikes === 0) situations.push("First-pitch");
  if (game.strikes === 2) situations.push("Two-strike");
  if (game.outs === 2) situations.push("Two-out");
  if (game.runners.second || game.runners.third) situations.push("RISP");
  if (game.runners.third && game.outs < 2) situations.push("Runner on 3rd <2 outs");
  if (outcome === "In Play" && bip && ["Sac Fly", "Sac Bunt", "Ground Out"].includes(bip)) situations.push("Productive out check");
  if (outcome === "Swinging Strike") situations.push("Whiff");
  return situations;
}

function nextCount(count: { balls: number; strikes: number }, outcome: PitchOutcome) {
  let balls = count.balls;
  let strikes = count.strikes;
  if (outcome === "Ball") balls += 1;
  if (outcome === "Called Strike" || outcome === "Whiff") strikes += 1;
  if (outcome === "Foul" && strikes < 2) strikes += 1;
  if (outcome === "Ball in play" || balls >= 4 || strikes >= 3) return { balls: 0, strikes: 0 };
  return { balls, strikes };
}

function baseLine(game: Game) {
  const bases = [game.runners.first ? "1B" : null, game.runners.second ? "2B" : null, game.runners.third ? "3B" : null].filter(Boolean);
  return bases.length ? bases.join(" / ") : "Bases empty";
}

function positionLine(player: Player) {
  return player.secondaryPosition ? `${player.primaryPosition} / ${player.secondaryPosition}` : player.primaryPosition;
}

function rosterSnapshot(players: Player[]) {
  return players.reduce<Record<RosterStatus, number>>(
    (counts, player) => {
      if (!player.archived && player.rosterStatus) counts[player.rosterStatus] += 1;
      return counts;
    },
    { Varsity: 0, JV: 0, Undecided: 0, Cut: 0 },
  );
}

function sortPlayersByRecent(players: Player[], recentIds: ID[]) {
  return players.slice().sort((a, b) => {
    const recentA = recentIds.indexOf(a.id);
    const recentB = recentIds.indexOf(b.id);
    if (recentA !== recentB) return (recentA === -1 ? 999 : recentA) - (recentB === -1 ? 999 : recentB);
    return a.jerseyNumber - b.jerseyNumber;
  });
}

function gamePerformerLine(data: AppData, game: Game) {
  const events = data.gameEvents.filter((event) => event.gameId === game.id);
  const names = events
    .flatMap((event) => [event.batterId, event.pitcherId])
    .filter(Boolean)
    .map((playerId) => data.players.find((player) => player.id === playerId)?.name)
    .filter(Boolean);
  return Array.from(new Set(names)).slice(0, 3).join(", ") || "Scorebook summary pending";
}

function weekdayLong(date: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date(`${date}T12:00:00`));
}

function formatSegment(value: string) {
  if (value === "overview") return "Overview";
  if (value === "practice") return "Practice";
  if (value === "games") return "Games";
  if (value === "pitching") return "Pitching";
  if (value === "hitting") return "Hitting";
  if (value === "defense") return "Defense";
  if (value === "weights") return "Weight Room";
  if (value === "notes") return "Notes";
  return value;
}

function weekStart(dateString: string) {
  const date = new Date(`${dateString}T12:00:00`);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date.toISOString().slice(0, 10);
}

function weekdayName(dateString: string): WorkoutSession["day"] {
  const names: WorkoutSession["day"][] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return names[new Date(`${dateString}T12:00:00`).getDay()] ?? "Mon";
}

function gradeSession(note: string) {
  return note.length > 80 ? "A-" : note.length > 20 ? "B+" : "B";
}

function distanceBetween(a: ZonePoint, b: ZonePoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function averageNumber(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isZonePoint(point: ZonePoint | undefined): point is ZonePoint {
  return Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.y));
}

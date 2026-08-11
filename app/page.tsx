"use client";

import {
  BarChart3,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Download,
  Dumbbell,
  Edit3,
  Gauge,
  Home,
  LogOut,
  Moon,
  MoreHorizontal,
  Plus,
  Save,
  Search,
  Shield,
  Sun,
  Target,
  Trophy,
  Trash2,
  Undo2,
  Upload,
  User,
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
  applyRosterImportPlan,
  buildRosterImportPlan,
  importModeLabel,
  parseMaxPrepsPdfText,
  parseRosterCsv,
  rosterStatusForTeam,
  type ParsedRosterFile,
  type ParsedRosterRow,
  type ParsedRosterStaff,
  type RosterImportDecision,
  type RosterImportMode,
  type RosterImportPlan,
} from "./lib/rosterImport";
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
  CountState,
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
  PlateAppearance,
  Player,
  Position,
  Practice,
  PracticeType,
  RosterStatus,
  TeamContext,
  TeamOption,
  WorkoutSession,
  ZonePoint,
} from "./types";

type ViewKey = "home" | "roster" | "practice" | "weights" | "games" | "analytics" | "profile" | "account" | "teams";
type PracticeMode = "Hitting" | "Pitching" | "Defense" | "Live BP";
type RosterFilter = "All" | RosterStatus;
type RosterPositionFilter = "All" | Position;
type RosterYearFilter = "All" | string;
type RosterSortKey = "number" | "player" | "pos" | "bt" | "class" | "height" | "weight" | "status";
type SortDirection = "asc" | "desc";
type ProfileTab = "overview" | "practice" | "games" | "pitching" | "hitting" | "defense" | "weights" | "notes";
type AnalyticsContext = "All" | "Practice" | "Game" | "Live BP" | "Weight Room";
type DateFilter = "Last Week" | "Last 30 Days" | "Fall";
type PracticeRosterPreset = "All" | "Varsity" | "JV" | "Custom";
type LiveBpOutcomeLabel = "K" | "BB" | "HBP" | "1B" | "2B" | "3B" | "HR" | "Out" | "Error" | "FC";

const NAV_ITEMS: Array<{ key: ViewKey; label: string; shortLabel: string; icon: LucideIcon }> = [
  { key: "home", label: "Home", shortLabel: "Home", icon: Home },
  { key: "roster", label: "Roster", shortLabel: "Roster", icon: Users },
  { key: "practice", label: "Practice", shortLabel: "Practice", icon: ClipboardList },
  { key: "weights", label: "Weight Room", shortLabel: "Weights", icon: Dumbbell },
  { key: "games", label: "Games", shortLabel: "Games", icon: Gauge },
  { key: "analytics", label: "Analytics", shortLabel: "Analytics", icon: BarChart3 },
];
const MOBILE_NAV_ITEMS: Array<{ key: ViewKey | "more"; label: string; shortLabel: string; icon: LucideIcon }> = [
  { key: "home", label: "Home", shortLabel: "Home", icon: Home },
  { key: "roster", label: "Roster", shortLabel: "Roster", icon: Users },
  { key: "practice", label: "Practice", shortLabel: "Practice", icon: ClipboardList },
  { key: "games", label: "Games", shortLabel: "Games", icon: Gauge },
  { key: "more", label: "More", shortLabel: "More", icon: MoreHorizontal },
];
const MORE_VIEWS: ViewKey[] = ["weights", "analytics", "account", "teams"];
const CREATE_TEAM_VALUE = "__create_team__";

const ROSTER_STATUSES: RosterStatus[] = ["Varsity", "JV", "Undecided", "Cut"];
const ROSTER_FILTERS: RosterFilter[] = ["All", ...ROSTER_STATUSES];
const POSITIONS: Position[] = ["P", "RHP", "LHP", "C", "1B", "2B", "3B", "SS", "INF", "LF", "CF", "RF", "OF", "UTIL", "DH"];
const SECONDARY_POSITIONS: Array<Position | ""> = ["", ...POSITIONS];
const PRACTICE_TYPES: PracticeType[] = ["Full Practice", "Bullpen Day", "Live BP", "Hitting Day", "Scrimmage", "Pitcher Development", "Hitter Development", "Custom"];
const PITCH_TYPES: PitchType[] = ["4-Seam", "2-Seam", "Sinker", "Cutter", "Slider", "Curveball", "Changeup", "Splitter", "Other"];
const PITCH_TYPE_LABELS: Record<PitchType, string> = {
  "4-Seam": "4S",
  "2-Seam": "2S",
  Sinker: "SI",
  Cutter: "CT",
  Slider: "SL",
  Curveball: "CB",
  Changeup: "CH",
  Splitter: "SP",
  Other: "OT",
};
const HITTING_STATIONS: HittingSession["type"][] = ["Tee", "Front Toss", "Machine", "Coach BP", "Live BP"];
const PITCHING_STATIONS: PitchingSession["type"][] = ["Bullpen", "Live BP"];
const DEFENSE_STATIONS: DefenseStation[] = ["Infield", "Outfield", "Catching", "PFP", "Situational defense", "Team defense"];
const GAME_TYPES: GameType[] = ["Fall Game", "Scrimmage", "Showcase", "Regular Season", "Tournament", "Other"];
const GAME_PITCH_BUTTONS: GamePitchOutcome[] = ["Ball", "Called Strike", "Swinging Strike", "Foul", "In Play"];
const BIP_OUTCOMES: GameBallInPlayOutcome[] = ["Single", "Double", "Triple", "Home Run", "Ground Out", "Fly Out", "Line Out", "Pop Out", "Error", "Fielder's Choice", "Sac Fly", "Sac Bunt"];
const LIVE_BP_OUTCOMES: LiveBpOutcomeLabel[] = ["K", "BB", "HBP", "1B", "2B", "3B", "HR", "Out", "Error", "FC"];
const EXERCISES = ["Back Squat", "Front Squat", "Bench Press", "Incline Bench", "Deadlift", "Trap Bar Deadlift", "Power Clean", "Hang Clean", "Push Press", "Pull Ups", "DB Bench", "Bulgarian Split Squat", "Sprint", "Broad Jump", "Vertical Jump"];
const PITCH_MIX_COLORS = ["#9f244c", "#43c6ac", "#8b96a5", "#38bdf8", "#f97316", "#a78bfa", "#e2e8f0", "#22c55e"];
const ROSTER_CSV_TEMPLATE = [
  "First Name,Last Name,Jersey Number,Graduation Year,Primary Position,Secondary Position,Bats,Throws,Team,Roster Status",
  "Jackson,Smith,12,2027,SS,P,R,R,Metrolina Varsity,Varsity",
  "Mason,Lee,17,2026,P,1B,R,R,Metrolina Varsity,Varsity",
].join("\n");

function slugifyFilePart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "current-season";
}

function currentRosterYear() {
  return new Date().getFullYear();
}

function rosterFileSignature(file: File) {
  return `${file.name.toLowerCase()}::${file.size}::${file.lastModified}`;
}

function teamFaviconHref(team?: TeamOption) {
  const teamWithLogo = team as (TeamOption & { logoUrl?: string; logo_url?: string }) | undefined;
  const explicitLogo = teamWithLogo?.logoUrl ?? teamWithLogo?.logo_url;
  if (explicitLogo) return explicitLogo;
  if (team?.teamName.toLowerCase().includes("metrolina")) return "/brand/metrolina-baseball-alpha.png";
  return "/favicon.svg";
}

function useTeamBrowserBrand(team?: TeamOption) {
  const href = teamFaviconHref(team);
  useEffect(() => {
    const selectors = ["link[rel='icon']", "link[rel='shortcut icon']"];
    const existing = selectors.flatMap((selector) => Array.from(document.querySelectorAll<HTMLLinkElement>(selector)));
    const links = existing.length ? existing : [document.createElement("link")];
    links.forEach((link) => {
      link.rel = link.rel || "icon";
      link.href = href;
      if (!link.parentNode) document.head.appendChild(link);
    });
  }, [href]);
}

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
  const [rosterPositionFilter, setRosterPositionFilter] = useState<RosterPositionFilter>("All");
  const [rosterYearFilter, setRosterYearFilter] = useState<RosterYearFilter>("All");
  const [rosterQuery, setRosterQuery] = useState("");
  const [profileTab, setProfileTab] = useState<ProfileTab>("overview");
  const [practiceTrackingOpen, setPracticeTrackingOpen] = useState(false);
  const [practiceMode, setPracticeMode] = useState<PracticeMode>("Hitting");
  const [practicePlayerId, setPracticePlayerId] = useState<ID>("p-jackson-smith");
  const [hittingStation, setHittingStation] = useState<HittingSession["type"]>("Machine");
  const [pitchingStation, setPitchingStation] = useState<PitchingSession["type"]>("Bullpen");
  const [defenseStation, setDefenseStation] = useState<DefenseStation>("Infield");
  const [selectedPitchType, setSelectedPitchType] = useState<PitchType>("4-Seam");
  const [velocity, setVelocity] = useState<string>("84");
  const [pitchLocation, setPitchLocation] = useState<ZonePoint | undefined>();
  const [targetLocation, setTargetLocation] = useState<ZonePoint | undefined>();
  const [fieldLocation, setFieldLocation] = useState<ZonePoint>({ x: 0.5, y: 0.55 });
  const [hitDirection, setHitDirection] = useState<Direction>("Middle");
  const [liveBpPitcherId, setLiveBpPitcherId] = useState<ID>("p-jackson-smith");
  const [liveBpHitterId, setLiveBpHitterId] = useState<ID>("p-ethan-brooks");
  const [liveBpCount, setLiveBpCount] = useState<CountState>({ balls: 0, strikes: 0 });
  const [liveBpPaNumber, setLiveBpPaNumber] = useState(1);
  const [selectedGameId, setSelectedGameId] = useState<ID>("game-aug14-covenant");
  const [selectedWeightPlayerId, setSelectedWeightPlayerId] = useState<ID>("p-jackson-smith");
  const [weightForm, setWeightForm] = useState({ exercise: "Back Squat", weight: "225", reps: "5", sets: "3", effort: "8" });
  const [startPracticeOpen, setStartPracticeOpen] = useState(false);
  const [startGameOpen, setStartGameOpen] = useState(false);
  const [playerEditorOpen, setPlayerEditorOpen] = useState(false);
  const [rosterImportOpen, setRosterImportOpen] = useState(false);
  const [topAccountMenuOpen, setTopAccountMenuOpen] = useState(false);
  const [sidebarAccountMenuOpen, setSidebarAccountMenuOpen] = useState(false);

  useTeamBrowserBrand(data?.teamContext?.currentTeam);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<ID | undefined>();
  const [sessionSummary, setSessionSummary] = useState<{ type: "Hitting" | "Pitching" | "Defense"; sessionId: ID } | null>(null);
  const [practiceSummaryOpen, setPracticeSummaryOpen] = useState(false);
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

  const practice = data ? activePractice(data) : undefined;
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
    if (!data || !practice) return { pitches: 0, swings: 0, defenseReps: 0, defenders: 0, players: 0, pitchers: 0, hitters: 0 };
    const pitching = data.pitchingSessions.filter((session) => session.practiceId === practice.id);
    const hitting = data.hittingSessions.filter((session) => session.practiceId === practice.id);
    const defense = data.defenseSessions.filter((session) => session.practiceId === practice.id);
    const defenseReps = data.defenseEvents.filter((event) => event.practiceId === practice.id).length;
    return {
      pitches: practicePitchEvents(data, practice.id).length,
      swings: practiceHittingEvents(data, practice.id).filter((event) => event.action !== "Took pitch").length,
      defenseReps,
      defenders: new Set(defense.map((session) => session.playerId)).size,
      players: practice.playerIds.length,
      pitchers: new Set(pitching.map((session) => session.pitcherId)).size || practice.pitcherIds.length,
      hitters: new Set(hitting.map((session) => session.hitterId)).size || practice.hitterIds.length,
    };
  }, [data, practice]);

  const weeklyMvp = useMemo(() => (data ? buildWeeklyMvp(data) : undefined), [data]);
  const weightLeader = useMemo(() => (data ? buildWeightLeader(data) : undefined), [data]);

  async function loadApplicationData(
    isCancelled: () => boolean = () => false,
    selectedTeamId?: ID,
    selectedSeasonId?: ID,
  ) {
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
      const loaded = await supabaseAppRepository.load(selectedTeamId, selectedSeasonId);
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
      setLiveBpPitcherId(loaded.players.find((player) => player.isPitcher && !player.archived)?.id ?? firstPlayer);
      setLiveBpHitterId(loaded.players.find((player) => player.isHitter && !player.archived && player.id !== firstPlayer)?.id ?? firstPlayer);

      if (requestedView && [...NAV_ITEMS.map((item) => item.key), "profile", "account", "teams"].includes(requestedView)) {
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

  function openPracticeStation(mode: PracticeMode) {
    setPracticeMode(mode);
    if (mode === "Live BP") {
      setPitchingStation("Live BP");
      setHittingStation("Live BP");
      const pitcher = data?.players.find((player) => player.id === liveBpPitcherId) ?? data?.players.find((player) => player.isPitcher && !player.archived);
      const hitter = data?.players.find((player) => player.id === liveBpHitterId) ?? data?.players.find((player) => player.isHitter && !player.archived && player.id !== pitcher?.id);
      if (pitcher) setPracticePlayerId(pitcher.id);
      if (pitcher) setLiveBpPitcherId(pitcher.id);
      if (hitter) setLiveBpHitterId(hitter.id);
    }
    setPracticeTrackingOpen(true);
  }

  function importRosterPlan(plan: RosterImportPlan) {
    commit((current) => applyRosterImportPlan(current, plan).data);
  }

  async function createTeamForImport(input: { teamName: string; teamLevel?: string; seasonName: string }) {
    const team = await supabaseAppRepository.createTeam(input);
    setData((current) => {
      if (!current) return current;
      const context = current.teamContext;
      const availableTeams = context?.availableTeams ?? [];
      return {
        ...current,
        teamContext: {
          profile: context?.profile,
          currentTeam: context?.currentTeam ?? team,
          availableTeams: [
            team,
            ...availableTeams.filter((item) => item.teamId !== team.teamId || item.seasonId !== team.seasonId),
          ],
        },
      };
    });
    return team;
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

  async function switchTeam(team: TeamOption) {
    setTopAccountMenuOpen(false);
    setSidebarAccountMenuOpen(false);
    await loadApplicationData(() => false, team.teamId, team.seasonId);
    setView("home");
  }

  async function signOut() {
    setTopAccountMenuOpen(false);
    setSidebarAccountMenuOpen(false);
    await authRepository.signOut();
    setData(null);
    setAuthState({ status: "anonymous" });
    setView("home");
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
      const isZone = pitchLocation ? pitchLocation.x >= 0.22 && pitchLocation.x <= 0.78 && pitchLocation.y >= 0.18 && pitchLocation.y <= 0.82 : false;
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
        isZone,
        isChase: pitchLocation ? isSwing && !isZone : undefined,
        isWhiff: outcome === "Whiff",
        isCalledStrike: outcome === "Called Strike",
        isBallInPlay: isBip,
        battedBall: isBip ? battedBall : undefined,
        contactQuality: isBip ? (battedBall === "Line drive" ? "Hard contact" : "Medium contact") : undefined,
        velocity: velocity ? Number(velocity) : undefined,
        qualityRating: outcome === "Ball" ? 2 : outcome === "Whiff" || outcome === "Called Strike" ? 5 : 4,
        missedIntendedLocation: pitchLocation && targetLocation ? distanceBetween(pitchLocation, targetLocation) > 0.18 : undefined,
        intendedTarget: targetLocation,
        location: pitchLocation,
        countBefore,
        countAfter,
        createdAt: new Date().toISOString(),
      };
      return touchRecentPlayers({ ...next.data, pitchEvents: [event, ...next.data.pitchEvents] }, practicePlayer.id);
    });
  }

  function logLiveBpPitch(outcome: PitchOutcome, battedBall?: BattedBallType) {
    if (!practice || !data) return;
    const pitcher = data.players.find((player) => player.id === liveBpPitcherId);
    const hitter = data.players.find((player) => player.id === liveBpHitterId);
    if (!pitcher || !hitter) return;

    const countBefore = liveBpCount;
    const countAfter = nextCount(countBefore, outcome);
    const liveDisplayCountAfter = nextLiveBpDisplayCount(countBefore, outcome);
    const isBip = outcome === "Ball in play";
    const isSwing = ["Swing", "Whiff", "Foul", "Ball in play"].includes(outcome);
    const isStrike = outcome !== "Ball" && outcome !== "HBP";
    const isZone = pitchLocation ? pitchLocation.x >= 0.22 && pitchLocation.x <= 0.78 && pitchLocation.y >= 0.18 && pitchLocation.y <= 0.82 : false;

    commit((current) => {
      const pitchingNext = ensurePitchingSession(current, practice, pitcher.id, "Live BP");
      const pitchingSession = pitchingNext.session;
      const hittingNext = ensureHittingSession(pitchingNext.data, practice, hitter.id, "Live BP");
      const hittingSession = hittingNext.session;
      const pitchNumber = hittingNext.data.pitchEvents.filter((event) => event.sessionId === pitchingSession.id).length + 1;
      const eventNumber = hittingNext.data.hittingEvents.filter((event) => event.sessionId === hittingSession.id).length + 1;
      const pitchEvent: PitchEvent = {
        id: createId("pe"),
        practiceId: practice.id,
        sessionId: pitchingSession.id,
        pitcherId: pitcher.id,
        hitterId: hitter.id,
        pitchNumber,
        pitchType: selectedPitchType,
        outcome,
        isStrike,
        isSwing,
        isZone,
        isChase: pitchLocation ? isSwing && !isZone : undefined,
        isWhiff: outcome === "Whiff",
        isCalledStrike: outcome === "Called Strike",
        isBallInPlay: isBip,
        battedBall: isBip ? battedBall : undefined,
        contactQuality: isBip ? (battedBall === "Line drive" ? "Hard contact" : "Medium contact") : undefined,
        velocity: velocity ? Number(velocity) : undefined,
        intendedTarget: targetLocation,
        location: pitchLocation,
        countBefore,
        countAfter,
        createdAt: new Date().toISOString(),
      };
      const hittingEvent: HittingEvent = {
        id: createId("he"),
        practiceId: practice.id,
        sessionId: hittingSession.id,
        hitterId: hitter.id,
        pitcherId: pitcher.id,
        eventNumber,
        action: outcome === "Ball" || outcome === "Called Strike" ? "Took pitch" : outcome === "Whiff" ? "Miss" : outcome === "Foul" ? "Foul" : "Ball in play",
        contactResult: isBip ? battedBall : undefined,
        contactQuality: isBip ? (battedBall === "Line drive" ? "Hard" : "Solid") : undefined,
        direction: isBip ? hitDirection : undefined,
        fieldLocation: isBip ? fieldLocation : undefined,
        pitchType: selectedPitchType,
        velocity: velocity ? Number(velocity) : undefined,
        isLiveBp: true,
        createdAt: new Date().toISOString(),
      };
      return touchRecentPlayers(
        touchRecentPlayers(
          { ...hittingNext.data, pitchEvents: [pitchEvent, ...hittingNext.data.pitchEvents], hittingEvents: [hittingEvent, ...hittingNext.data.hittingEvents] },
          pitcher.id,
        ),
        hitter.id,
      );
    });

    setLiveBpCount(liveDisplayCountAfter);
  }

  function completeLiveBpPa(label: LiveBpOutcomeLabel) {
    if (!practice || !data) return;
    const pitcher = data.players.find((player) => player.id === liveBpPitcherId);
    const hitter = data.players.find((player) => player.id === liveBpHitterId);
    if (!pitcher || !hitter) return;

    commit((current) => {
      const pitchingNext = ensurePitchingSession(current, practice, pitcher.id, "Live BP");
      const hittingNext = ensureHittingSession(pitchingNext.data, practice, hitter.id, "Live BP");
      const plateAppearance: PlateAppearance = {
        id: createId("pa"),
        practiceId: practice.id,
        pitchingSessionId: pitchingNext.session.id,
        hittingSessionId: hittingNext.session.id,
        pitcherId: pitcher.id,
        hitterId: hitter.id,
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        outcome: mapLiveBpOutcome(label),
        balls: liveBpCount.balls,
        strikes: liveBpCount.strikes,
      };
      return touchRecentPlayers(
        touchRecentPlayers({ ...hittingNext.data, plateAppearances: [plateAppearance, ...hittingNext.data.plateAppearances] }, pitcher.id),
        hitter.id,
      );
    });
    setLiveBpCount({ balls: 0, strikes: 0 });
    setLiveBpPaNumber((value) => value + 1);
    advanceLiveBpHitter();
  }

  function advanceLiveBpHitter() {
    if (!data) return;
    const hitters = data.players.filter((player) => !player.archived && player.isHitter && player.id !== liveBpPitcherId);
    if (!hitters.length) return;
    const currentIndex = hitters.findIndex((player) => player.id === liveBpHitterId);
    const next = hitters[(currentIndex + 1) % hitters.length] ?? hitters[0];
    setLiveBpHitterId(next.id);
  }

  function logDefense(outcome: DefenseOutcome, errorType?: DefenseEvent["errorType"]) {
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
        errorType: outcome === "Error" ? errorType ?? "Fielding" : undefined,
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
      if (practiceMode === "Live BP") {
        const pitchIndex = current.pitchEvents.findIndex((event) => event.practiceId === practice.id && event.pitcherId === liveBpPitcherId && event.hitterId === liveBpHitterId);
        const hitIndex = current.hittingEvents.findIndex((event) => event.practiceId === practice.id && event.hitterId === liveBpHitterId && event.pitcherId === liveBpPitcherId);
        return {
          ...current,
          pitchEvents: pitchIndex >= 0 ? current.pitchEvents.filter((_, eventIndex) => eventIndex !== pitchIndex) : current.pitchEvents,
          hittingEvents: hitIndex >= 0 ? current.hittingEvents.filter((_, eventIndex) => eventIndex !== hitIndex) : current.hittingEvents,
        };
      }
      const index = current.defenseEvents.findIndex((event) => event.practiceId === practice.id && event.playerId === practicePlayer.id);
      if (index < 0) return current;
      return { ...current, defenseEvents: current.defenseEvents.filter((_, eventIndex) => eventIndex !== index) };
    });
  }

  function openSessionSummary() {
    if (!data || !practice || !practicePlayer) return;
    let summaryType: "Hitting" | "Pitching" | "Defense" = "Hitting";
    const session =
      practiceMode === "Hitting"
        ? data.hittingSessions.find((item) => item.practiceId === practice.id && item.hitterId === practicePlayer.id && item.type === hittingStation)
        : practiceMode === "Pitching"
          ? data.pitchingSessions.find((item) => item.practiceId === practice.id && item.pitcherId === practicePlayer.id && item.type === pitchingStation)
          : practiceMode === "Live BP"
            ? data.pitchingSessions.find((item) => item.practiceId === practice.id && item.pitcherId === liveBpPitcherId && item.type === "Live BP")
            : data.defenseSessions.find((item) => item.practiceId === practice.id && item.playerId === practicePlayer.id && item.station === defenseStation);
    if (!session) return;
    if (practiceMode === "Pitching" || practiceMode === "Live BP") summaryType = "Pitching";
    if (practiceMode === "Defense") summaryType = "Defense";
    setSummaryNote(session.summaryNote ?? "");
    setSessionSummary({ type: summaryType, sessionId: session.id });
  }

  function openExistingSessionSummary(type: "Hitting" | "Pitching" | "Defense", sessionId: ID) {
    if (!data) return;
    const session =
      type === "Hitting"
        ? data.hittingSessions.find((item) => item.id === sessionId)
        : type === "Pitching"
          ? data.pitchingSessions.find((item) => item.id === sessionId)
          : data.defenseSessions.find((item) => item.id === sessionId);
    setSummaryNote(session?.summaryNote ?? "");
    setSessionSummary({ type, sessionId });
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

  function endPractice() {
    if (!practice) return;
    setPracticeSummaryOpen(true);
  }

  function savePracticeSummary() {
    if (!practice) return;
    commit((current) => ({
      ...current,
      practices: current.practices.map((item) =>
        item.id === practice.id ? { ...item, endedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : item,
      ),
      settings: { ...current.settings, activePracticeId: undefined },
    }));
    setPracticeTrackingOpen(false);
    setPracticeSummaryOpen(false);
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
        <div className="sidebar-brand">
          <button className="brand-lockup" type="button" onClick={() => setView("home")}>
            <img src="/brand/metrolina-baseball-cutout.png" alt="" />
            <span>
              <strong>Metrolina</strong>
              <small>Baseball</small>
            </span>
          </button>
          <TeamSwitcher context={data.teamContext} onSwitch={switchTeam} compact />
        </div>

        <nav className="rail-nav">
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
            <button key={key} type="button" className={view === key ? "active" : ""} onClick={() => setView(key)}>
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={data.settings.theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}>
            {data.settings.theme === "dark" ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
          </button>
          <ProfileMenu
            context={data.teamContext}
            open={sidebarAccountMenuOpen}
            onOpen={(open) => {
              setSidebarAccountMenuOpen(open);
              if (open) setTopAccountMenuOpen(false);
            }}
            onView={setView}
            onSignOut={signOut}
            variant="icon"
          />
        </div>
      </aside>

      <section className="ops-main">
        <TopCommand
          globalQuery={globalQuery}
          globalResults={globalResults}
          onQuery={setGlobalQuery}
          onOpenPlayer={openPlayer}
          onStartPractice={() => setStartPracticeOpen(true)}
          onStartGame={() => setStartGameOpen(true)}
          onView={setView}
          context={data.teamContext}
          accountMenuOpen={topAccountMenuOpen}
          onAccountMenu={(open) => {
            setTopAccountMenuOpen(open);
            if (open) setSidebarAccountMenuOpen(false);
          }}
          onSignOut={signOut}
        />

        <SyncStatusBanner status={saveStatus} error={saveError} />

        {view === "home" && (
          <HomeDashboard
            data={data}
            practice={practice}
            weeklyMvp={weeklyMvp}
            weightLeader={weightLeader}
            onView={setView}
            onOpenPlayer={openPlayer}
            onStartPractice={() => setStartPracticeOpen(true)}
            onStartGame={() => setStartGameOpen(true)}
          />
        )}

        {view === "roster" && (
          <RosterView
            players={rosterPlayers}
            team={data.teamContext?.currentTeam}
            filter={rosterFilter}
            positionFilter={rosterPositionFilter}
            yearFilter={rosterYearFilter}
            query={rosterQuery}
            onFilter={setRosterFilter}
            onPositionFilter={setRosterPositionFilter}
            onYearFilter={setRosterYearFilter}
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
            onImport={() => setRosterImportOpen(true)}
            onStatus={updateRosterStatus}
            onDeletePlayer={(playerId) => {
              commit((current) => playerRepository.archive(current, playerId));
            }}
          />
        )}

        {view === "practice" && practicePlayer && !practiceTrackingOpen && (
          <PracticeHome
            data={data}
            practice={practice}
            activeTotals={activeTotals}
            onStartPractice={() => setStartPracticeOpen(true)}
            onOpenStation={openPracticeStation}
            onEndPractice={endPractice}
            onOpenPlayer={openPlayer}
          />
        )}

        {view === "practice" && practicePlayer && practiceTrackingOpen && (
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
            liveBpPitcher={data.players.find((item) => item.id === liveBpPitcherId)}
            liveBpHitter={data.players.find((item) => item.id === liveBpHitterId)}
            liveBpCount={liveBpCount}
            liveBpPaNumber={liveBpPaNumber}
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
            onLiveBpPitcher={setLiveBpPitcherId}
            onLiveBpHitter={setLiveBpHitterId}
            onLogLiveBpPitch={logLiveBpPitch}
            onCompleteLiveBpPa={completeLiveBpPa}
            onNextLiveBpHitter={advanceLiveBpHitter}
            onLogDefense={logDefense}
            onUndo={undoPracticeEvent}
            onEndSession={openSessionSummary}
            onExitTracking={() => setPracticeTrackingOpen(false)}
            onEndPractice={endPractice}
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

        {view === "account" && (
          <AccountProfileView context={data.teamContext} onView={setView} onSignOut={signOut} />
        )}

        {view === "teams" && (
          <TeamsView context={data.teamContext} onSwitch={switchTeam} />
        )}

        {view === "profile" && selectedPlayer && (
          <PlayerProfile
            data={data}
            player={selectedPlayer}
            tab={profileTab}
            onTab={setProfileTab}
            onTeamSwitch={switchTeam}
            onEdit={() => {
              setEditingPlayerId(selectedPlayer.id);
              setPlayerEditorOpen(true);
            }}
            onStatus={updateRosterStatus}
            onOpenSessionSummary={openExistingSessionSummary}
          />
        )}
      </section>

      <nav className="bottom-nav" aria-label="Mobile navigation">
        {MOBILE_NAV_ITEMS.map(({ key, shortLabel, icon: Icon }) => (
          <button
            key={key}
            type="button"
            className={(key === "more" ? MORE_VIEWS.includes(view) : view === key) ? "active" : ""}
            onClick={() => {
              if (key === "more") {
                setMobileMoreOpen((open) => !open);
                return;
              }
              setMobileMoreOpen(false);
              setView(key);
            }}
          >
            <Icon size={19} aria-hidden="true" />
            <span>{shortLabel}</span>
          </button>
        ))}
      </nav>

      {mobileMoreOpen && (
        <section className="mobile-more-sheet" aria-label="More navigation">
          <button type="button" onClick={() => { setView("weights"); setMobileMoreOpen(false); }}>
            <Dumbbell size={17} aria-hidden="true" />
            Weight Room
          </button>
          <button type="button" onClick={() => { setView("analytics"); setMobileMoreOpen(false); }}>
            <BarChart3 size={17} aria-hidden="true" />
            Analytics
          </button>
          <button type="button" onClick={() => { setView("account"); setMobileMoreOpen(false); }}>
            <User size={17} aria-hidden="true" />
            My Profile
          </button>
          <button type="button" onClick={() => { setView("teams"); setMobileMoreOpen(false); }}>
            <Building2 size={17} aria-hidden="true" />
            Teams
          </button>
          <button type="button" onClick={() => { toggleTheme(); setMobileMoreOpen(false); }}>
            {data.settings.theme === "dark" ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
            {data.settings.theme === "dark" ? "Light" : "Dark"}
          </button>
        </section>
      )}

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
            setPracticeTrackingOpen(false);
            if (practiceDraft.playerIds[0]) {
              setPracticePlayerId(practiceDraft.playerIds[0]);
              setSelectedPlayerId(practiceDraft.playerIds[0]);
            }
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
        />
      )}

      {rosterImportOpen && (
        <RosterImportModal
          data={data}
          onClose={() => setRosterImportOpen(false)}
          onCreateTeam={createTeamForImport}
          onImport={(plan) => {
            importRosterPlan(plan);
            setRosterImportOpen(false);
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

      {practiceSummaryOpen && practice && (
        <PracticeSummaryModal
          data={data}
          practice={practice}
          onClose={() => setPracticeSummaryOpen(false)}
          onSave={savePracticeSummary}
          onOpenPlayer={openPlayer}
        />
      )}
    </main>
  );
}

function AuthGate({
  authState,
  error,
  onSignedIn,
}: {
  authState: AuthState;
  error: Error | null;
  onSignedIn: () => void;
}) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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

  async function createAccount() {
    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await authRepository.signUp({ email, password, firstName, lastName });
      setMessage("Account created. Sign in to continue if you are not signed in automatically.");
      await onSignedIn();
    } catch (signUpError) {
      setMessage(signUpError instanceof Error ? signUpError.message : "Unable to create account.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    await authRepository.signOut();
    window.location.reload();
  }

  return (
    <main className="loading-screen auth-screen">
      <img src="/brand/metrolina-baseball-cutout.png" alt="" />
      <strong>Metrolina Baseball</strong>
      <span>Baseball operations</span>

      {authState.status === "not-configured" && <p className="auth-message">{authState.message}</p>}
      {error && !needsMembership && <p className="auth-message">{error.message}</p>}
      {message && <p className="auth-message">{message}</p>}

      {authState.status === "anonymous" && (
        <>
          <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
            <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Log In</button>
            <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>Create Account</button>
          </div>
          <form
            className="auth-form"
            onSubmit={(event) => {
              event.preventDefault();
              void (mode === "login" ? signIn() : createAccount());
            }}
          >
            {mode === "signup" && (
              <div className="auth-name-grid">
                <label>
                  <span>First name</span>
                  <input value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" />
                </label>
                <label>
                  <span>Last name</span>
                  <input value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" />
                </label>
              </div>
            )}
            <label>
              <span>Email</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
            </label>
            <label>
              <span>Password</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} />
            </label>
            {mode === "signup" && (
              <label>
                <span>Confirm password</span>
                <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
              </label>
            )}
            <button className="primary-button stretch-button" type="submit" disabled={busy || !email || !password || (mode === "signup" && (!firstName || !lastName || !confirmPassword))}>
              {busy ? "Working..." : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>
        </>
      )}

      {authState.status === "authenticated" && needsMembership && (
        <section className="auth-form no-team-card">
          <span>Welcome to Metrolina Baseball</span>
          <h1>Your account is ready.</h1>
          <p>You are not connected to a team yet. Team invitations will appear here once a coach/admin grants access.</p>
          <button className="secondary-button stretch-button" type="button" onClick={() => void signOut()} disabled={busy}>
            <LogOut size={16} aria-hidden="true" />
            Sign Out
          </button>
        </section>
      )}
    </main>
  );
}

function SyncStatusBanner({ status, error }: { status: "idle" | "saving" | "saved" | "error"; error: string | null }) {
  if (status === "idle") return null;
  return (
    <div className={`sync-banner sync-banner--${status}`} role={status === "error" ? "alert" : "status"}>
      {status === "saving" && "Saving..."}
      {status === "saved" && "Saved"}
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
  globalQuery,
  globalResults,
  onQuery,
  onOpenPlayer,
  onStartPractice,
  onStartGame,
  onView,
  context,
  accountMenuOpen,
  onAccountMenu,
  onSignOut,
}: {
  globalQuery: string;
  globalResults: Player[];
  onQuery: (value: string) => void;
  onOpenPlayer: (playerId: ID) => void;
  onStartPractice: () => void;
  onStartGame: () => void;
  onView: (view: ViewKey) => void;
  context?: TeamContext;
  accountMenuOpen: boolean;
  onAccountMenu: (open: boolean) => void;
  onSignOut: () => void | Promise<void>;
}) {
  return (
    <header className="top-command">
      <div className="top-command__identity">
        <button type="button" className="mobile-brand" onClick={() => onView("home")}>
          <img src="/brand/metrolina-baseball-cutout.png" alt="" />
        </button>
        <strong>Metrolina</strong>
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
        <button type="button" className="primary-button" onClick={onStartPractice}>
          <Plus size={16} aria-hidden="true" />
          Practice
        </button>
        <button type="button" className="secondary-button" onClick={onStartGame}>
          <Plus size={16} aria-hidden="true" />
          Game
        </button>
        <ProfileMenu
          context={context}
          open={accountMenuOpen}
          onOpen={onAccountMenu}
          onView={onView}
          onSignOut={onSignOut}
        />
      </div>
    </header>
  );
}

type ChoiceOption = {
  value: string;
  label: string;
};

function ChoiceSelect({
  label,
  value,
  options,
  onChange,
  className = "",
  disabled = false,
  "aria-label": ariaLabel,
}: {
  label?: string;
  value: string;
  options: ChoiceOption[];
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <div
      className={["choice-select", open ? "open" : "", className].filter(Boolean).join(" ")}
      onBlur={(event) => {
        const nextFocus = event.relatedTarget instanceof Node ? event.relatedTarget : null;
        if (!nextFocus || !event.currentTarget.contains(nextFocus)) setOpen(false);
      }}
    >
      {label && <span className="choice-select__label">{label}</span>}
      <button
        type="button"
        className="choice-select__button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel ?? label}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <strong>{selected?.label ?? "Select"}</strong>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && !disabled && (
        <div className="choice-select__menu" role="listbox" aria-label={ariaLabel ?? label}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={option.value === value ? "active" : ""}
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TeamSwitcher({
  context,
  onSwitch,
  compact = false,
}: {
  context?: TeamContext;
  onSwitch: (team: TeamOption) => void | Promise<void>;
  compact?: boolean;
}) {
  const teams = context?.availableTeams ?? [];
  const current = context?.currentTeam;
  if (!current) return null;

  const selectedValue = teamValue(current);

  return (
    <div className={`team-switcher ${compact ? "team-switcher--compact" : ""}`}>
      <Building2 size={16} aria-hidden="true" />
      <span>
        <small>{current.seasonName ?? "Current season"}</small>
        {teams.length > 1 ? (
          <ChoiceSelect
            value={selectedValue}
            aria-label="Current team"
            className="team-switch-choice"
            options={teams.map((team) => ({ value: teamValue(team), label: team.teamName }))}
            onChange={(value) => {
              const next = teams.find((team) => teamValue(team) === value);
              if (next) void onSwitch(next);
            }}
          />
        ) : (
          <strong>{current.teamName}</strong>
        )}
      </span>
    </div>
  );
}

function ProfileMenu({
  context,
  open,
  onOpen,
  onView,
  onSignOut,
  variant = "icon",
}: {
  context?: TeamContext;
  open: boolean;
  onOpen: (open: boolean) => void;
  onView: (view: ViewKey) => void;
  onSignOut: () => void | Promise<void>;
  variant?: "icon" | "card";
}) {
  const profile = context?.profile;
  const initials = profileInitials(context);
  const profileName = profileDisplayName(context);
  const role = context?.currentTeam?.title ?? roleLabel(context?.currentTeam?.role) ?? profile?.role ?? "Coach";
  return (
    <div className={`profile-menu profile-menu--${variant}`}>
      <button className="profile-menu__button" type="button" onClick={() => onOpen(!open)} aria-label="Open profile menu" aria-expanded={open}>
        <span className="profile-menu__avatar">{profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <span>{initials}</span>}</span>
        {variant === "card" && (
          <span className="profile-menu__identity">
            <strong>{profileName}</strong>
            <small>{role}</small>
          </span>
        )}
      </button>
      {open && (
        <div className="profile-menu__panel">
          <div>
            <strong>{profileName}</strong>
            <small>{profile?.email ?? "Coach account"}</small>
          </div>
          <button type="button" onClick={() => { onOpen(false); onView("account"); }}>
            <User size={15} aria-hidden="true" />
            My Profile
          </button>
          <button type="button" onClick={() => { onOpen(false); onView("teams"); }}>
            <Users size={15} aria-hidden="true" />
            Teams
          </button>
          <button type="button" onClick={() => { onOpen(false); onView("account"); }}>
            <Shield size={15} aria-hidden="true" />
            Settings
          </button>
          <button type="button" onClick={() => void onSignOut()}>
            <LogOut size={15} aria-hidden="true" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

function AccountProfileView({
  context,
  onView,
  onSignOut,
}: {
  context?: TeamContext;
  onView: (view: ViewKey) => void;
  onSignOut: () => void | Promise<void>;
}) {
  const profile = context?.profile;
  return (
    <div className="page-stack">
      <SectionHeader
        title="My Profile"
        context={context?.currentTeam ? `${context.currentTeam.teamName} - ${context.currentTeam.seasonName ?? "Current season"}` : undefined}
        action={
          <button className="secondary-button" type="button" onClick={() => void onSignOut()}>
            <LogOut size={16} aria-hidden="true" />
            Sign Out
          </button>
        }
      />
      <section className="account-grid">
        <article className="panel account-card">
          <div className="account-avatar">{profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <span>{profileInitials(context)}</span>}</div>
          <div>
            <span>Coach Profile</span>
            <h2>{profileDisplayName(context)}</h2>
            <p>{profile?.email ?? "No email available"}</p>
          </div>
          <div className="profile-fields">
            <FieldLine label="First name" value={profile?.firstName ?? "--"} />
            <FieldLine label="Last name" value={profile?.lastName ?? "--"} />
            <FieldLine label="Program role" value={profile?.role ?? "COACH"} />
          </div>
        </article>
        <article className="panel">
          <div className="panel-heading tight">
            <div><span>Teams</span><h2>Access</h2></div>
            <button type="button" className="text-button" onClick={() => onView("teams")}>Manage</button>
          </div>
          <TeamAccessList context={context} />
        </article>
      </section>
    </div>
  );
}

function TeamsView({
  context,
  onSwitch,
}: {
  context?: TeamContext;
  onSwitch: (team: TeamOption) => void | Promise<void>;
}) {
  return (
    <div className="page-stack">
      <SectionHeader
        title="Teams"
      />
      <section className="team-list">
        {(context?.availableTeams ?? []).map((team) => (
          <article className={`panel team-row ${teamValue(team) === teamValue(context?.currentTeam) ? "active" : ""}`} key={teamValue(team)}>
            <div>
              <span>{team.organizationName}</span>
              <h2>{team.teamName}</h2>
              <small>{team.seasonName ?? "All seasons"} - {roleLabel(team.role)}{team.title ? ` - ${team.title}` : ""}</small>
            </div>
            <button className={teamValue(team) === teamValue(context?.currentTeam) ? "secondary-button" : "primary-button"} type="button" onClick={() => void onSwitch(team)}>
              {teamValue(team) === teamValue(context?.currentTeam) ? "Current" : "Switch"}
            </button>
          </article>
        ))}
      </section>
    </div>
  );
}

function TeamAccessList({ context }: { context?: TeamContext }) {
  const teams = context?.availableTeams ?? [];
  if (teams.length === 0) return <CompactEmpty title="No team memberships yet" />;
  return (
    <div className="team-access-list">
      {teams.map((team) => (
        <div key={teamValue(team)}>
          <strong>{team.teamName}</strong>
          <span>{roleLabel(team.role)}</span>
          <small>{team.seasonName ?? "All seasons"}</small>
        </div>
      ))}
    </div>
  );
}

function FieldLine({ label, value }: { label: string; value: string }) {
  return <div className="field-line"><span>{label}</span><strong>{value}</strong></div>;
}

function FormSnapshot({ title, primary, secondary }: { title: string; primary: string; secondary: string }) {
  return (
    <div className="form-snapshot">
      <span>{title}</span>
      <strong>{primary}</strong>
      <small>{secondary}</small>
    </div>
  );
}

function HomeDashboard({
  data,
  practice,
  weeklyMvp,
  weightLeader,
  onView,
  onOpenPlayer,
  onStartPractice,
  onStartGame,
}: {
  data: AppData;
  practice?: Practice;
  weeklyMvp?: AwardResult;
  weightLeader?: WeightLeaderResult;
  onView: (view: ViewKey) => void;
  onOpenPlayer: (playerId: ID) => void;
  onStartPractice: () => void;
  onStartGame: () => void;
}) {
  const upcomingGame = data.games.find((game) => !game.result);
  const activeRoster = data.players.filter((player) => !player.archived && player.rosterStatus !== "Cut");
  const rosterPitchers = activeRoster.filter((player) => player.isPitcher).length;
  const rosterHitters = activeRoster.filter((player) => player.isHitter).length;
  const attendancePct = teamPracticeAttendancePct(data, activeRoster.length);
  const repsThisWeek = weeklyRepCount(data);
  const currentTeam = data.teamContext?.currentTeam;

  return (
    <div className="page-stack home-dashboard">
      <section className="home-ops-grid">
        <HomeInfoCard
          icon={ClipboardList}
          title="Today's Practice"
          primary={practice ? formatTime(practice.startedAt) : "No practice scheduled"}
          meta={practice ? practice.location : "Start practice when coaches arrive"}
          onClick={practice ? () => onView("practice") : onStartPractice}
          cta={practice ? "Open" : "Start"}
        />
        <HomeInfoCard
          icon={Gauge}
          title="Next Game"
          primary={upcomingGame ? `${upcomingGame.homeAway === "Home" ? "vs" : "at"} ${upcomingGame.opponent}` : "No game scheduled"}
          meta={upcomingGame ? `${shortDate(upcomingGame.date)} - ${upcomingGame.location}` : "Create the next game when ready"}
          onClick={upcomingGame ? () => onView("games") : onStartGame}
        />
        <HomeInfoCard
          icon={Users}
          title="Roster"
          primary={`${activeRoster.length} Players`}
          meta={`${rosterPitchers} Pitchers - ${rosterHitters} Hitters`}
          onClick={() => onView("roster")}
        />
      </section>

      <section className="home-secondary-grid">
        <AwardCard title="Player of the Week" award={weeklyMvp} onOpenPlayer={onOpenPlayer} icon={Trophy} />
        <WeightLeaderCard leader={weightLeader} onOpenPlayer={onOpenPlayer} />
        <RecentActivityCard activities={buildTeamRecentActivity(data).slice(0, 5)} onOpenPlayer={onOpenPlayer} />
      </section>

      <TeamSnapshotBar
        team={currentTeam?.teamName ?? "Team Snapshot"}
        stats={[
          { label: "Players", value: activeRoster.length },
          { label: "Pitchers", value: rosterPitchers },
          { label: "Hitters", value: rosterHitters },
          { label: "Practice Attendance", value: data.practices.length ? formatPct(attendancePct) : "--", progress: attendancePct },
          { label: "Total Reps This Week", value: formatCompactNumber(repsThisWeek) },
        ]}
      />
    </div>
  );
}

function RosterView({
  players,
  team,
  filter,
  positionFilter,
  yearFilter,
  query,
  onFilter,
  onPositionFilter,
  onYearFilter,
  onQuery,
  onOpenPlayer,
  onEditPlayer,
  onAddPlayer,
  onImport,
  onStatus,
  onDeletePlayer,
}: {
  players: Player[];
  team?: TeamOption;
  filter: RosterFilter;
  positionFilter: RosterPositionFilter;
  yearFilter: RosterYearFilter;
  query: string;
  onFilter: (filter: RosterFilter) => void;
  onPositionFilter: (filter: RosterPositionFilter) => void;
  onYearFilter: (filter: RosterYearFilter) => void;
  onQuery: (value: string) => void;
  onOpenPlayer: (playerId: ID) => void;
  onEditPlayer: (playerId: ID) => void;
  onAddPlayer: () => void;
  onImport: () => void;
  onStatus: (playerId: ID, status: RosterStatus) => void;
  onDeletePlayer: (playerId: ID) => void;
}) {
  const [sortConfig, setSortConfig] = useState<{ key: RosterSortKey; direction: SortDirection }>({ key: "number", direction: "asc" });
  const gradYears = Array.from(new Set(players.map((player) => String(player.graduationYear)))).sort();
  function changeSort(key: RosterSortKey) {
    setSortConfig((current) => (
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    ));
  }
  const filtered = players
    .filter((player) => filter === "All" || player.rosterStatus === filter)
    .filter((player) => positionFilter === "All" || player.primaryPosition === positionFilter || player.secondaryPosition === positionFilter)
    .filter((player) => yearFilter === "All" || String(player.graduationYear) === yearFilter)
    .filter((player) => `${player.name} ${player.jerseyNumber} ${player.primaryPosition} ${player.secondaryPosition ?? ""} ${player.graduationYear}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => compareRosterPlayers(a, b, sortConfig.key, sortConfig.direction));

  return (
    <div className="page-stack roster-page">
      <SectionHeader
        title="Roster"
        context={team ? `${team.teamName} - ${team.seasonName ?? "Current season"}` : undefined}
        action={
          <div className="section-actions">
            <button className="secondary-button" type="button" onClick={onImport}>
              <Upload size={16} aria-hidden="true" />
              Import Roster
            </button>
            <button className="primary-button" type="button" onClick={onAddPlayer}>
              <UserPlus size={16} aria-hidden="true" />
              Add Player
            </button>
          </div>
        }
      />

      <section className="roster-status-row">
        <SegmentedControl values={ROSTER_FILTERS} active={filter} onChange={onFilter} />
      </section>

      <section className="toolbar-panel roster-toolbar">
        <label className="search-pill">
          <Search size={15} aria-hidden="true" />
          <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search by name or number..." />
        </label>
        <ChoiceSelect
          label="Position"
          value={positionFilter}
          className="filter-select"
          options={[{ value: "All", label: "All" }, ...POSITIONS.map((position) => ({ value: position, label: position }))]}
          onChange={(value) => onPositionFilter(value as RosterPositionFilter)}
          aria-label="Filter roster by position"
        />
        <ChoiceSelect
          label="Class"
          value={yearFilter}
          className="filter-select"
          options={[{ value: "All", label: "All" }, ...gradYears.map((year) => ({ value: year, label: year }))]}
          onChange={onYearFilter}
          aria-label="Filter roster by class"
        />
      </section>

      <section className="roster-table-shell">
        <div className="roster-table__head">
          <RosterSortButton label="#" sortKey="number" active={sortConfig.key} direction={sortConfig.direction} onSort={changeSort} />
          <RosterSortButton label="Player" sortKey="player" active={sortConfig.key} direction={sortConfig.direction} onSort={changeSort} />
          <RosterSortButton label="Pos" sortKey="pos" active={sortConfig.key} direction={sortConfig.direction} onSort={changeSort} />
          <RosterSortButton label="B/T" sortKey="bt" active={sortConfig.key} direction={sortConfig.direction} onSort={changeSort} />
          <RosterSortButton label="Class" sortKey="class" active={sortConfig.key} direction={sortConfig.direction} onSort={changeSort} />
          <RosterSortButton label="Height" sortKey="height" active={sortConfig.key} direction={sortConfig.direction} onSort={changeSort} />
          <RosterSortButton label="Weight" sortKey="weight" active={sortConfig.key} direction={sortConfig.direction} onSort={changeSort} />
          <RosterSortButton label="Status" sortKey="status" active={sortConfig.key} direction={sortConfig.direction} onSort={changeSort} />
          <span />
        </div>
        {filtered.length ? filtered.map((player) => (
          <article className="roster-table-row" key={player.id}>
            <button type="button" className="roster-number-cell" onClick={() => onOpenPlayer(player.id)}>
              {player.jerseyNumber}
            </button>
            <button type="button" className="roster-player-cell" onClick={() => onOpenPlayer(player.id)}>
              <PlayerAvatar player={player} size="sm" compact />
              <span>
                <strong>{player.name}</strong>
                <small>{positionLine(player)}</small>
              </span>
            </button>
            <span className="roster-mobile-label">Pos</span>
            <span className="roster-pos-cell">{positionLine(player)}</span>
            <span className="roster-mobile-label">B/T</span>
            <span className="roster-bt-cell">{player.bats}/{player.throws}</span>
            <span className="roster-mobile-label">Class</span>
            <span className="roster-class-cell">{player.graduationYear}</span>
            <span className="roster-mobile-label">Height</span>
            <span className="roster-height-cell">{player.height ?? "--"}</span>
            <span className="roster-mobile-label">Weight</span>
            <span className="roster-weight-cell">{player.weight ? `${player.weight}` : "--"}</span>
            <ChoiceSelect
              value={player.rosterStatus ?? "Undecided"}
              className={`status-select-wrap status-select-wrap--${(player.rosterStatus ?? "Undecided").toLowerCase()}`}
              options={ROSTER_STATUSES.map((status) => ({ value: status, label: status }))}
              onChange={(value) => onStatus(player.id, value as RosterStatus)}
              aria-label={`Roster status for ${player.name}`}
            />
            <span className="row-action-group">
              <button className="row-action-button" type="button" onClick={() => onEditPlayer(player.id)} aria-label={`Edit ${player.name}`}>
                <Edit3 size={15} aria-hidden="true" />
              </button>
              <button
                className="row-action-button row-action-button--danger"
                type="button"
                onClick={() => {
                  if (window.confirm(`Delete ${player.name} from the active roster? Historical data will be preserved.`)) {
                    onDeletePlayer(player.id);
                  }
                }}
                aria-label={`Delete ${player.name}`}
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </span>
          </article>
        )) : (
          <CompactEmpty title="No players match these filters" action={<button className="secondary-button" type="button" onClick={() => { onFilter("All"); onPositionFilter("All"); onYearFilter("All"); onQuery(""); }}>Clear Filters</button>} />
        )}
      </section>
    </div>
  );
}

function RosterSortButton({
  label,
  sortKey,
  active,
  direction,
  onSort,
}: {
  label: string;
  sortKey: RosterSortKey;
  active: RosterSortKey;
  direction: SortDirection;
  onSort: (key: RosterSortKey) => void;
}) {
  const isActive = active === sortKey;
  return (
    <button type="button" className={`roster-sort-button ${isActive ? "active" : ""}`} onClick={() => onSort(sortKey)} aria-label={`Sort roster by ${label}${isActive ? `, currently ${direction}` : ""}`}>
      {label}
      {isActive && (direction === "asc" ? <ChevronUp size={12} aria-hidden="true" /> : <ChevronDown size={12} aria-hidden="true" />)}
    </button>
  );
}

function compareRosterPlayers(a: Player, b: Player, key: RosterSortKey, direction: SortDirection) {
  const multiplier = direction === "asc" ? 1 : -1;
  const statusOrder = (status?: RosterStatus) => ROSTER_STATUSES.indexOf(status ?? "Undecided");
  const compareText = (left: string, right: string) => left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
  const compareNumber = (left: number, right: number) => left - right;
  let result = 0;

  if (key === "number") result = compareNumber(a.jerseyNumber ?? 0, b.jerseyNumber ?? 0);
  if (key === "player") result = compareText(a.name, b.name);
  if (key === "pos") result = compareText(positionLine(a), positionLine(b));
  if (key === "bt") result = compareText(`${a.bats}/${a.throws}`, `${b.bats}/${b.throws}`);
  if (key === "class") result = compareNumber(a.graduationYear ?? 0, b.graduationYear ?? 0);
  if (key === "height") result = compareNumber(heightToInches(a.height), heightToInches(b.height));
  if (key === "weight") result = compareNumber(a.weight ?? 0, b.weight ?? 0);
  if (key === "status") result = compareNumber(statusOrder(a.rosterStatus), statusOrder(b.rosterStatus));

  return (result || compareNumber(a.jerseyNumber ?? 0, b.jerseyNumber ?? 0) || compareText(a.name, b.name)) * multiplier;
}

function PracticeHome({
  data,
  practice,
  activeTotals,
  onStartPractice,
  onOpenStation,
  onEndPractice,
  onOpenPlayer,
}: {
  data: AppData;
  practice?: Practice;
  activeTotals: { pitches: number; swings: number; defenseReps: number; defenders: number; players: number; pitchers: number; hitters: number };
  onStartPractice: () => void;
  onOpenStation: (mode: PracticeMode) => void;
  onEndPractice: () => void;
  onOpenPlayer: (playerId: ID) => void;
}) {
  const recentPractices = data.practices.slice(0, 5);
  const recentPlayers = sortPlayersByRecent(
    data.players.filter((player) => !player.archived),
    data.settings.recentPlayerIds,
  ).slice(0, 8);

  return (
    <div className="page-stack practice-home">
      <SectionHeader title="Practice" context={data.teamContext?.currentTeam ? `${data.teamContext.currentTeam.teamName} - ${data.teamContext.currentTeam.seasonName ?? data.settings.rosterSeason}` : data.settings.rosterSeason} />
      <section className="practice-command panel">
        <div className="practice-command__main">
          <h2>{practice?.name ?? "Ready when practice starts"}</h2>
          <small>{practice ? `${fullDate(practice.date)} - ${practice.location} - ${practiceElapsed(practice)}` : "Start a practice, choose the roster preset, and log reps from one screen."}</small>
        </div>
        <div className="practice-command__actions">
          <button className="primary-button" type="button" onClick={onStartPractice}>
            <Plus size={16} aria-hidden="true" />
            Start Practice
          </button>
          {practice && (
            <button className="secondary-button" type="button" onClick={onEndPractice}>
              <Save size={16} aria-hidden="true" />
              End Practice
            </button>
          )}
        </div>
      </section>

      {practice ? (
        <>
          <section className="practice-live-grid">
            <article className="panel practice-live-card">
              <div className="panel-heading tight">
                <div>
                  <h2>{practice.type}</h2>
                </div>
                <small>{activeTotals.players} players</small>
              </div>
              <div className="mini-stat-grid">
                <StatTile label="Players" value={activeTotals.players} />
                <StatTile label="Pitches" value={activeTotals.pitches} />
                <StatTile label="Swings" value={activeTotals.swings} />
                <StatTile label="Defense" value={activeTotals.defenseReps} accent />
              </div>
              <div className="recent-player-row" aria-label="Recently used players">
                {recentPlayers.map((player) => (
                  <button key={player.id} type="button" onClick={() => onOpenPlayer(player.id)}>
                    <PlayerAvatar player={player} size="sm" compact />
                    <span>{player.name.split(" ").slice(-1)[0]}</span>
                  </button>
                ))}
              </div>
            </article>

            <article className="panel station-console-card">
              <div className="panel-heading tight">
                <div>
                  <h2>One Tap Entry</h2>
                </div>
              </div>
              <div className="station-grid">
                <button type="button" onClick={() => onOpenStation("Hitting")}>
                  <ClipboardList size={20} aria-hidden="true" />
                  <strong>Hitting</strong>
                  <small>Machine, coach BP, tee, toss</small>
                </button>
                <button type="button" onClick={() => onOpenStation("Pitching")}>
                  <Target size={20} aria-hidden="true" />
                  <strong>Pitching</strong>
                  <small>Bullpens and pitch design</small>
                </button>
                <button type="button" onClick={() => onOpenStation("Defense")}>
                  <Shield size={20} aria-hidden="true" />
                  <strong>Defense</strong>
                  <small>Clean reps, errors, great plays</small>
                </button>
                <button type="button" onClick={() => onOpenStation("Live BP")}>
                  <Gauge size={20} aria-hidden="true" />
                  <strong>Live BP</strong>
                  <small>Pitcher vs hitter, count, PA</small>
                </button>
              </div>
            </article>
          </section>

          <section className="panel recent-practices-card">
            <div className="panel-heading tight">
              <div>
                <h2>Practice Timeline</h2>
              </div>
            </div>
            <div className="recent-practice-list">
              {recentPractices.map((item) => {
                const totals = practiceTotals(data, item.id);
                return (
                  <article key={item.id}>
                    <div>
                      <strong>{item.name}</strong>
                      <small>{shortDate(item.date)} - {item.location}</small>
                    </div>
                    <span>{totals.pitches} pitches</span>
                    <span>{totals.swings} swings</span>
                    <span>{totals.defense} defense</span>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      ) : (
        <EmptyActionPanel
          eyebrow="Practice"
          title="No active practice yet"
          body="Start practice, choose All, Varsity, JV, or Custom, then jump straight into hitting, pitching, defense, or Live BP."
          action="Start Practice"
          onAction={onStartPractice}
        />
      )}
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
  liveBpPitcher,
  liveBpHitter,
  liveBpCount,
  liveBpPaNumber,
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
  onLiveBpPitcher,
  onLiveBpHitter,
  onLogLiveBpPitch,
  onCompleteLiveBpPa,
  onNextLiveBpHitter,
  onLogDefense,
  onUndo,
  onEndSession,
  onExitTracking,
  onEndPractice,
  onStartPractice,
}: {
  data: AppData;
  practice?: Practice;
  mode: PracticeMode;
  player: Player;
  activeTotals: { pitches: number; swings: number; defenseReps: number; defenders: number; players: number; pitchers: number; hitters: number };
  hittingStation: HittingSession["type"];
  pitchingStation: PitchingSession["type"];
  defenseStation: DefenseStation;
  selectedPitchType: PitchType;
  velocity: string;
  pitchLocation?: ZonePoint;
  targetLocation?: ZonePoint;
  fieldLocation: ZonePoint;
  hitDirection: Direction;
  liveBpPitcher?: Player;
  liveBpHitter?: Player;
  liveBpCount: CountState;
  liveBpPaNumber: number;
  onMode: (mode: PracticeMode) => void;
  onSelectPlayer: (playerId: ID) => void;
  onOpenPlayer: (playerId: ID) => void;
  onHittingStation: (station: HittingSession["type"]) => void;
  onPitchingStation: (station: PitchingSession["type"]) => void;
  onDefenseStation: (station: DefenseStation) => void;
  onPitchType: (pitchType: PitchType) => void;
  onVelocity: (value: string) => void;
  onPitchLocation: (point: ZonePoint | undefined) => void;
  onTargetLocation: (point: ZonePoint | undefined) => void;
  onFieldLocation: (point: ZonePoint) => void;
  onHitDirection: (direction: Direction) => void;
  onLogHitting: (action: HittingEvent["action"], contactResult?: BattedBallType, quality?: HittingContactQuality, direction?: Direction) => void;
  onLogPitch: (outcome: PitchOutcome, battedBall?: BattedBallType) => void;
  onLiveBpPitcher: (playerId: ID) => void;
  onLiveBpHitter: (playerId: ID) => void;
  onLogLiveBpPitch: (outcome: PitchOutcome, battedBall?: BattedBallType) => void;
  onCompleteLiveBpPa: (outcome: LiveBpOutcomeLabel) => void;
  onNextLiveBpHitter: () => void;
  onLogDefense: (outcome: DefenseOutcome, errorType?: DefenseEvent["errorType"]) => void;
  onUndo: () => void;
  onEndSession: () => void;
  onExitTracking: () => void;
  onEndPractice: () => void;
  onStartPractice: () => void;
}) {
  const [switcherQuery, setSwitcherQuery] = useState("");
  const [switcherFilter, setSwitcherFilter] = useState<RosterFilter>("All");
  const players = sortPlayersByRecent(
    data.players.filter((item) => !item.archived),
    data.settings.recentPlayerIds,
  );
  const playerPool = players
    .filter((item) => mode !== "Pitching" || item.isPitcher)
    .filter((item) => mode !== "Hitting" || item.isHitter)
    .filter((item) => switcherFilter === "All" || item.rosterStatus === switcherFilter)
    .filter((item) => `${item.name} ${item.jerseyNumber} ${item.primaryPosition} ${item.secondaryPosition ?? ""}`.toLowerCase().includes(switcherQuery.toLowerCase()));
  const hittingSession = practice
    ? data.hittingSessions.find((session) => session.practiceId === practice.id && session.hitterId === player.id && session.type === hittingStation && !session.endedAt)
      ?? data.hittingSessions.find((session) => session.practiceId === practice.id && session.hitterId === player.id && session.type === hittingStation)
    : undefined;
  const pitchingSession = practice
    ? data.pitchingSessions.find((session) => session.practiceId === practice.id && session.pitcherId === player.id && session.type === pitchingStation && !session.endedAt)
      ?? data.pitchingSessions.find((session) => session.practiceId === practice.id && session.pitcherId === player.id && session.type === pitchingStation)
    : undefined;
  const defenseSession = practice
    ? data.defenseSessions.find((session) => session.practiceId === practice.id && session.playerId === player.id && session.station === defenseStation && !session.endedAt)
      ?? data.defenseSessions.find((session) => session.practiceId === practice.id && session.playerId === player.id && session.station === defenseStation)
    : undefined;
  const pitchEvents = data.pitchEvents.filter((event) => pitchingSession ? event.sessionId === pitchingSession.id : event.pitcherId === player.id && (!practice || event.practiceId === practice.id));
  const hittingEvents = data.hittingEvents.filter((event) => hittingSession ? event.sessionId === hittingSession.id : event.hitterId === player.id && (!practice || event.practiceId === practice.id));
  const defenseEvents = data.defenseEvents.filter((event) => defenseSession ? event.sessionId === defenseSession.id : event.playerId === player.id && (!practice || event.practiceId === practice.id));
  const liveBpPitchEvents = data.pitchEvents.filter((event) => event.practiceId === practice?.id && event.pitcherId === liveBpPitcher?.id && event.hitterId === liveBpHitter?.id);
  const liveBpHitEvents = data.hittingEvents.filter((event) => event.practiceId === practice?.id && event.hitterId === liveBpHitter?.id && event.pitcherId === liveBpPitcher?.id);
  const liveBpPitchStats = calculatePitchingStats(liveBpPitchEvents);
  const pitchStats = calculatePitchingStats(pitchEvents);
  const hitStats = calculateHittingStats(hittingEvents);
  const defenseCleanPct = pct(defenseEvents.filter((event) => event.outcome !== "Error").length, defenseEvents.length);
  const roundNumber = practice
    ? Math.max(1, data.hittingSessions.filter((session) => session.practiceId === practice.id && session.hitterId === player.id && session.type === hittingStation).length || 1)
    : 1;
  const pitchers = players.filter((item) => item.isPitcher);
  const hitters = players.filter((item) => item.isHitter && item.id !== liveBpPitcher?.id);

  function changeMode(nextMode: PracticeMode) {
    onMode(nextMode);
    if (nextMode === "Live BP") {
      onPitchingStation("Live BP");
      onHittingStation("Live BP");
      if (liveBpPitcher) onSelectPlayer(liveBpPitcher.id);
    }
  }

  return (
    <div className="page-stack practice-console">
      <section className="practice-header panel">
        <div>
          <span>Metrolina Fall Ball</span>
          <h2>{practice?.name ?? "No Active Practice"}</h2>
          <small>{practice ? `${fullDate(practice.date)} - ${practice.location} - ${practiceElapsed(practice)}` : "Start a practice to unlock tracking"}</small>
        </div>
        <div className="practice-header__metrics">
          <StatTile label="Pitches" value={activeTotals.pitches} />
          <StatTile label="Swings" value={activeTotals.swings} />
          <StatTile label="Defense" value={activeTotals.defenseReps} />
          <StatTile label="Players" value={activeTotals.players} accent />
        </div>
        {practice ? (
          <div className="practice-header__buttons">
            <button className="ghost-button" type="button" onClick={onExitTracking}>Practice Home</button>
            <button className="secondary-button" type="button" onClick={onEndPractice}>End Practice</button>
          </div>
        ) : (
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
          <label className="switcher-search">
            <Search size={14} aria-hidden="true" />
            <input value={switcherQuery} onChange={(event) => setSwitcherQuery(event.target.value)} placeholder="Switch player..." />
          </label>
          <SegmentedControl values={["All", "Varsity", "JV"] as RosterFilter[]} active={switcherFilter} onChange={setSwitcherFilter} />
          <div className="switcher-list">
            {playerPool.slice(0, 14).map((item) => (
              <button key={item.id} type="button" className={item.id === player.id ? "active" : ""} onClick={() => onSelectPlayer(item.id)}>
                <PlayerAvatar player={item} size="sm" compact />
                <span>{item.name.split(" ").slice(-1)[0]}</span>
                <small>#{item.jerseyNumber}</small>
              </button>
            ))}
            {!playerPool.length && <CompactEmpty title="No players found" />}
          </div>
        </aside>

        <section className="tracker-console panel">
          <div className="mode-row">
            <SegmentedControl values={["Hitting", "Pitching", "Defense", "Live BP"] as PracticeMode[]} active={mode} onChange={changeMode} />
            <div className="tracker-actions">
              <button className="ghost-button" type="button" onClick={onUndo}>
                <Undo2 size={16} aria-hidden="true" />
                Undo
              </button>
              <button className="secondary-button" type="button" onClick={onEndSession}>
                <Save size={16} aria-hidden="true" />
                {mode === "Hitting" ? "End Round" : mode === "Defense" ? "End Drill" : "End Session"}
              </button>
            </div>
          </div>

          {mode === "Hitting" && (
            <div className="tracking-layout">
              <div className="tracking-main">
                <div className="session-context">
                  <div>
                    <span>{hittingStation}</span>
                    <strong>Round {roundNumber}</strong>
                    <small>{hittingEvents.length} reps logged</small>
                  </div>
                  <SegmentedControl values={HITTING_STATIONS} active={hittingStation} onChange={onHittingStation} />
                </div>
                <LiveMetrics
                  items={[
                    { label: "Swings", value: hitStats.totalSwings },
                    { label: "Contact", value: formatPct(hitStats.contactPct) },
                    { label: "Hard Hit", value: formatPct(hitStats.hardHitPct) },
                    { label: "Barrel", value: formatPct(hitStats.barrelPct) },
                    { label: "LD %", value: formatPct(hitStats.lineDrivePct) },
                  ]}
                />
                <div className="quick-pad quick-pad--hitting">
                  <button type="button" onClick={() => onLogHitting("Miss")}>Miss</button>
                  <button type="button" onClick={() => onLogHitting("Foul")}>Foul</button>
                  <button type="button" onClick={() => onLogHitting("Ball in play", "Ground ball", "Solid")}>GB</button>
                  <button type="button" onClick={() => onLogHitting("Ball in play", "Line drive", "Hard")}>LD</button>
                  <button type="button" onClick={() => onLogHitting("Ball in play", "Fly ball", "Solid")}>FB</button>
                  <button type="button" className="impact" onClick={() => onLogHitting("Ball in play", "Line drive", "Barrel")}>Barrel</button>
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
                    { label: "Strike %", value: formatPct(pitchStats.strikePct) },
                    { label: "CSW %", value: formatPct(pitchStats.cswPct) },
                    { label: "Avg Velo", value: formatNumber(pitchStats.avgVelocity, 1) },
                  ]}
                />
                <div className="pitch-type-row">
                  {PITCH_TYPES.slice(0, 8).map((pitchType) => (
                    <button key={pitchType} type="button" className={selectedPitchType === pitchType ? "active" : ""} onClick={() => onPitchType(pitchType)}>
                      {PITCH_TYPE_LABELS[pitchType]}
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
                  <button type="button" className="impact" onClick={() => onLogPitch("Whiff")}>Whiff</button>
                  <button type="button" onClick={() => onLogPitch("Foul")}>Foul</button>
                  <button type="button" onClick={() => onLogPitch("Ball in play", "Ground ball")}>GB</button>
                  <button type="button" onClick={() => onLogPitch("Ball in play", "Line drive")}>LD</button>
                  <button type="button" onClick={() => onLogPitch("Ball in play", "Fly ball")}>FB</button>
                </div>
              </div>
              <div className="tracking-visual zone-stack">
                <span>Actual location</span>
                <StrikeZone points={pitchEvents.map((event) => event.location).filter(isZonePoint)} activePoint={pitchLocation} onSelect={onPitchLocation} />
                <button className="text-button" type="button" onClick={() => onPitchLocation(undefined)}>Skip actual location</button>
                <span>Target location</span>
                <StrikeZone compact activePoint={targetLocation} onSelect={onTargetLocation} />
                <button className="text-button" type="button" onClick={() => onTargetLocation(undefined)}>Clear target</button>
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
                  <button type="button" className="impact" onClick={() => onLogDefense("Great Play")}>Great Play</button>
                </div>
                <div className="direction-row">
                  <button type="button" onClick={() => onLogDefense("Error", "Fielding")}>Fielding Error</button>
                  <button type="button" onClick={() => onLogDefense("Error", "Throwing")}>Throwing Error</button>
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

          {mode === "Live BP" && (
            <div className="tracking-layout live-bp-layout">
              <div className="tracking-main">
                <section className="live-bp-matchup">
                  <div className="matchup-player">
                    <span>Pitcher</span>
                    <strong>{liveBpPitcher ? `#${liveBpPitcher.jerseyNumber} ${liveBpPitcher.name}` : "Select pitcher"}</strong>
                    <small>{liveBpPitcher ? positionLine(liveBpPitcher) : "Live BP"}</small>
                  </div>
                  <div className="count-badge">
                    <span>Count</span>
                    <strong>{liveBpCount.balls}-{liveBpCount.strikes}</strong>
                    <small>PA {liveBpPaNumber}</small>
                  </div>
                  <div className="matchup-player">
                    <span>Hitter</span>
                    <strong>{liveBpHitter ? `#${liveBpHitter.jerseyNumber} ${liveBpHitter.name}` : "Select hitter"}</strong>
                    <small>{liveBpHitter ? positionLine(liveBpHitter) : "Live BP"}</small>
                  </div>
                </section>

                <div className="matchup-switch-grid">
                  <div>
                    <span>Pitcher</span>
                    <div className="mini-player-pills">
                      {pitchers.slice(0, 8).map((item) => (
                        <button key={item.id} type="button" className={item.id === liveBpPitcher?.id ? "active" : ""} onClick={() => { onLiveBpPitcher(item.id); onSelectPlayer(item.id); }}>
                          #{item.jerseyNumber} {item.name.split(" ").slice(-1)[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span>Hitter</span>
                    <div className="mini-player-pills">
                      {hitters.slice(0, 8).map((item) => (
                        <button key={item.id} type="button" className={item.id === liveBpHitter?.id ? "active" : ""} onClick={() => onLiveBpHitter(item.id)}>
                          #{item.jerseyNumber} {item.name.split(" ").slice(-1)[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <LiveMetrics
                  items={[
                    { label: "Pitches", value: liveBpPitchStats.totalPitches },
                    { label: "Strike %", value: formatPct(liveBpPitchStats.strikePct) },
                    { label: "CSW %", value: formatPct(liveBpPitchStats.cswPct) },
                    { label: "Avg Velo", value: formatNumber(liveBpPitchStats.avgVelocity, 1) },
                  ]}
                />
                <div className="pitch-type-row">
                  {PITCH_TYPES.slice(0, 8).map((pitchType) => (
                    <button key={pitchType} type="button" className={selectedPitchType === pitchType ? "active" : ""} onClick={() => onPitchType(pitchType)}>
                      {PITCH_TYPE_LABELS[pitchType]}
                    </button>
                  ))}
                </div>
                <label className="velo-input">
                  <span>Velocity</span>
                  <input inputMode="numeric" value={velocity} onChange={(event) => onVelocity(event.target.value.replace(/[^0-9.]/g, ""))} />
                </label>
                <div className="quick-pad quick-pad--pitching">
                  <button type="button" onClick={() => onLogLiveBpPitch("Ball")}>Ball</button>
                  <button type="button" onClick={() => onLogLiveBpPitch("Called Strike")}>Called Strike</button>
                  <button type="button" className="impact" onClick={() => onLogLiveBpPitch("Whiff")}>Whiff</button>
                  <button type="button" onClick={() => onLogLiveBpPitch("Foul")}>Foul</button>
                  <button type="button" onClick={() => onLogLiveBpPitch("Ball in play", "Ground ball")}>GB</button>
                  <button type="button" onClick={() => onLogLiveBpPitch("Ball in play", "Line drive")}>LD</button>
                  <button type="button" onClick={() => onLogLiveBpPitch("Ball in play", "Fly ball")}>FB</button>
                </div>
                <div className="pa-outcome-grid">
                  {LIVE_BP_OUTCOMES.map((outcome) => (
                    <button key={outcome} type="button" onClick={() => onCompleteLiveBpPa(outcome)}>{outcome}</button>
                  ))}
                  <button type="button" className="secondary-button" onClick={onNextLiveBpHitter}>Next Hitter</button>
                </div>
                <RoundStrip events={liveBpHitEvents} />
              </div>
              <div className="tracking-visual zone-stack">
                <span>Actual location</span>
                <StrikeZone points={liveBpPitchEvents.map((event) => event.location).filter(isZonePoint)} activePoint={pitchLocation} onSelect={onPitchLocation} />
                <button className="text-button" type="button" onClick={() => onPitchLocation(undefined)}>Skip actual location</button>
                <span>Target location</span>
                <StrikeZone compact activePoint={targetLocation} onSelect={onTargetLocation} />
                <button className="text-button" type="button" onClick={() => onTargetLocation(undefined)}>Clear target</button>
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
      <SectionHeader title="Weight Room" context={data.teamContext?.currentTeam ? `${data.teamContext.currentTeam.teamName} - ${data.teamContext.currentTeam.seasonName ?? "Current season"}` : undefined} />
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
            <div className="form-field">
              <span>Exercise</span>
              <ChoiceSelect
                value={form.exercise}
                className="form-choice"
                options={EXERCISES.map((exercise) => ({ value: exercise, label: exercise }))}
                onChange={(value) => onForm({ ...form, exercise: value })}
                aria-label="Exercise"
              />
            </div>
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
  pitchLocation?: ZonePoint;
  onGame: (gameId: ID) => void;
  onPitchType: (pitchType: PitchType) => void;
  onVelocity: (value: string) => void;
  onPitchLocation: (point: ZonePoint | undefined) => void;
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
        title="Games"
        context={data.teamContext?.currentTeam ? `${data.teamContext.currentTeam.teamName} - ${data.teamContext.currentTeam.seasonName ?? "Current season"}` : undefined}
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
                    <button key={outcome} type="button" className={outcome === "In Play" ? "impact" : ""} onClick={() => outcome === "In Play" ? undefined : onLogPitch(outcome)}>
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
      <SectionHeader title="Analytics" context={data.teamContext?.currentTeam ? `${data.teamContext.currentTeam.teamName} - ${data.teamContext.currentTeam.seasonName ?? "Current season"}` : undefined} />
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
  onTeamSwitch,
  onEdit,
  onStatus,
  onOpenSessionSummary,
}: {
  data: AppData;
  player: Player;
  tab: ProfileTab;
  onTab: (tab: ProfileTab) => void;
  onTeamSwitch: (team: TeamOption) => void | Promise<void>;
  onEdit: () => void;
  onStatus: (playerId: ID, status: RosterStatus) => void;
  onOpenSessionSummary: (type: "Hitting" | "Pitching" | "Defense", sessionId: ID) => void;
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
  const recentActivity = buildPlayerRecentActivity(data, player).slice(0, 6);
  const memberships = buildPlayerMembershipCards(data, player);
  const gameStats = buildPlayerGameSnapshot(data, player);

  return (
    <div className="page-stack profile-page">
      <section className="profile-header panel">
        <PlayerAvatar player={player} size="xl" />
        <div>
          <span>{player.rosterStatus}</span>
          <h2>#{player.jerseyNumber} {player.name}</h2>
          <small>{positionLine(player)} - {player.graduationYear} - {player.bats}/{player.throws} - {player.height} - {player.weight} lb</small>
          <div className="profile-context-row">
            <TeamSwitcher context={data.teamContext} onSwitch={onTeamSwitch} compact />
          </div>
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
        <section className="profile-overview-grid">
          <article className="panel profile-overview-main">
            <div className="panel-heading tight"><div><span>Overview</span><h2>Development Record</h2></div></div>
            <div className="mini-stat-grid">
              <StatTile label="Games" value={gameStats.games} sub={gameStats.games ? `${formatDecimal(gameStats.avg)} AVG` : "no official games"} />
              <StatTile label="Practice" value={attendance} sub="sessions attended" />
              <StatTile label="Attendance" value={data.practices.length ? formatPct(pct(attendance, data.practices.length)) : "--"} sub={`${attendance}/${data.practices.length} practices`} />
              <StatTile label="Development" value={workoutMetrics?.score || "--"} sub={workoutMetrics?.score ? "weight score" : "no weight data"} accent />
            </div>
            <div className="recent-form-grid">
              <FormSnapshot title="Hitting" primary={hitStats.totalSwings ? formatPct(hitStats.hardHitPct) : "--"} secondary={hitStats.totalSwings ? `${formatPct(hitStats.contactPct)} contact` : "No tracked swings"} />
              <FormSnapshot title="Pitching" primary={pitchStats.totalPitches ? formatPct(pitchStats.strikePct) : "--"} secondary={pitchStats.totalPitches ? `${formatPct(pitchStats.cswPct)} CSW` : "No tracked pitches"} />
              <FormSnapshot title="Weight Room" primary={workoutMetrics?.score ? String(workoutMetrics.score) : "--"} secondary={workoutMetrics?.score ? `${workoutMetrics.trend.length} logged entries` : "No workouts yet"} />
            </div>
            {hitStats.totalSwings > 0 && (
              <MiniLineChart values={trendByPractice(data.practices, hittingEvents, (events) => calculateHittingStats(events).hardHitPct).map((item) => item.value)} />
            )}
          </article>

          <article className="panel">
            <div className="panel-heading tight"><div><span>Memberships</span><h2>Teams</h2></div></div>
            <div className="membership-list">
              {memberships.length ? memberships.map((membership) => (
                <div key={membership.key}>
                  <strong>{membership.team}</strong>
                  <span>#{membership.number ?? "--"} - {membership.status}</span>
                  <small>{membership.season}</small>
                </div>
              )) : <CompactEmpty title="No team memberships visible" />}
            </div>
          </article>

          <article className="panel">
            <div className="panel-heading tight"><div><span>Recent Activity</span><h2>Last Touches</h2></div></div>
            <div className="entry-list">
              {recentActivity.length ? recentActivity.map((activity) => (
                activity.summaryType && activity.sessionId ? (
                  <button key={activity.key} type="button" onClick={() => onOpenSessionSummary(activity.summaryType, activity.sessionId)}>
                    <span>{activity.type}</span>
                    <strong>{activity.title}</strong>
                    <small>{activity.meta}</small>
                  </button>
                ) : (
                  <div key={activity.key}><span>{activity.type}</span><strong>{activity.title}</strong><small>{activity.meta}</small></div>
                )
              )) : <CompactEmpty title="No activity for this context yet" />}
            </div>
          </article>

          <article className="panel">
            <div className="panel-heading tight"><div><span>Development Focus</span><h2>Current Goals</h2></div></div>
            <div className="goal-list">
              {goals.length ? goals.map((goal, index) => <div key={goal.id}><strong>{index + 1}. {goal.title}</strong><small>{goal.tags.join(", ")}</small></div>) : <CompactEmpty title="No development goals yet" />}
            </div>
          </article>

          <article className="panel">
            <div className="panel-heading tight"><div><span>Coach Notes</span><h2>Recent Notes</h2></div></div>
            <div className="note-list compact">
              {notes.length ? notes.slice(0, 3).map((note) => <div key={note.id}><strong>{note.tags.join(", ") || "Note"}</strong><p>{note.text}</p><small>{fullDate(note.createdAt.slice(0, 10))}</small></div>) : <CompactEmpty title="No coach notes yet" />}
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
  const today = new Date().toISOString().slice(0, 10);
  const availablePlayers = data.players.filter((player) => !player.archived);
  const [form, setForm] = useState({
    date: today,
    time: "18:00",
    name: `${data.teamContext?.currentTeam?.teamName ?? "Metrolina"} Practice`,
    type: "Full Practice" as PracticeType,
    location: "Metrolina Varsity Field",
    notes: "",
  });
  const [preset, setPreset] = useState<PracticeRosterPreset>("All");
  const [attending, setAttending] = useState<ID[]>(availablePlayers.map((player) => player.id));

  function applyPreset(nextPreset: PracticeRosterPreset) {
    setPreset(nextPreset);
    if (nextPreset === "Custom") return;
    const selected = availablePlayers
      .filter((player) => nextPreset === "All" || player.rosterStatus === nextPreset)
      .map((player) => player.id);
    setAttending(selected);
  }

  function toggle(id: ID) {
    setPreset("Custom");
    setAttending((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function createPractice() {
    const selectedPlayers = availablePlayers.filter((player) => attending.includes(player.id));
    const pitchers = selectedPlayers.filter((player) => player.isPitcher).map((player) => player.id);
    const hitters = selectedPlayers.filter((player) => player.isHitter).map((player) => player.id);
    onCreate({
      id: createId("practice"),
      date: form.date,
      name: form.name,
      type: form.type,
      location: form.location,
      notes: form.notes,
      playerIds: attending,
      pitcherIds: pitchers,
      hitterIds: hitters,
      startedAt: new Date(`${form.date}T${form.time || "18:00"}:00`).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <ModalFrame title="Start Practice" onClose={onClose}>
      <div className="form-grid">
        <label><span>Date</span><input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
        <label><span>Time</span><input type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} /></label>
        <label><span>Practice name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <div className="form-field"><span>Type</span><ChoiceSelect value={form.type} className="form-choice" options={PRACTICE_TYPES.map((type) => ({ value: type, label: type }))} onChange={(value) => setForm({ ...form, type: value as PracticeType })} aria-label="Practice type" /></div>
        <label><span>Location</span><input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label>
        <label className="wide"><span>Notes</span><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
      </div>
      <section className="practice-preset-panel">
        <div>
          <span>Players Attending</span>
          <strong>{attending.length} selected</strong>
        </div>
        <SegmentedControl values={["All", "Varsity", "JV", "Custom"] as PracticeRosterPreset[]} active={preset} onChange={applyPreset} />
      </section>
      <RosterPicker title="Quick Check / Uncheck" players={availablePlayers} selected={attending} onToggle={toggle} />
      <button className="primary-button stretch-button" type="button" onClick={createPractice} disabled={attending.length === 0}>
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
        <div className="form-field"><span>Home/Away</span><ChoiceSelect value={form.homeAway} className="form-choice" options={["Home", "Away"].map((value) => ({ value, label: value }))} onChange={(value) => setForm({ ...form, homeAway: value as Game["homeAway"] })} aria-label="Home or away" /></div>
        <label><span>Date</span><input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
        <label><span>Location</span><input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label>
        <div className="form-field"><span>Game type</span><ChoiceSelect value={form.type} className="form-choice" options={GAME_TYPES.map((type) => ({ value: type, label: type }))} onChange={(value) => setForm({ ...form, type: value as GameType })} aria-label="Game type" /></div>
        <div className="form-field"><span>Starting pitcher</span><ChoiceSelect value={form.startingPitcherId ?? ""} className="form-choice" options={data.players.filter((player) => player.isPitcher).map((player) => ({ value: player.id, label: player.name }))} onChange={(value) => setForm({ ...form, startingPitcherId: value })} aria-label="Starting pitcher" /></div>
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

function PlayerEditorModal({ player, onClose, onSave }: { player?: Player; onClose: () => void; onSave: (player: Player) => void }) {
  const [form, setForm] = useState<Player>(
    player ?? {
      id: createId("p"),
      name: "",
      jerseyNumber: 0,
      primaryPosition: "SS",
      secondaryPosition: undefined,
      bats: "R",
      throws: "R",
      graduationYear: currentRosterYear(),
      rosterStatus: "Undecided",
      programLevel: "Development",
      height: "6-0",
      weight: 175,
      avatarColor: "#9f244c",
      isPitcher: false,
      isHitter: true,
      notes: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  );
  const roleFlags = derivePlayerRoleFlags(form.primaryPosition, form.secondaryPosition);

  return (
    <ModalFrame title={player ? "Edit Player" : "Add Player"} onClose={onClose} panelClassName="modal-panel--player">
      <section className="single-player-builder">
        <div className="single-player-table">
          <div className="single-player-head" aria-hidden="true">
            <span>Name</span>
            <span>#</span>
            <span>Class</span>
            <span>Primary</span>
            <span>Secondary</span>
            <span>Bats</span>
            <span>Throws</span>
            <span>Height</span>
            <span>Weight</span>
            <span>Status</span>
          </div>
          <div className="single-player-row">
            <input aria-label="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <ManualNumberCell label="Number" value={form.jerseyNumber ? String(form.jerseyNumber) : ""} min={0} max={99} onChange={(value) => setForm({ ...form, jerseyNumber: Number(value) || 0 })} />
            <ManualNumberCell label="Graduation" value={String(form.graduationYear || currentRosterYear())} min={2020} max={2045} onChange={(value) => setForm({ ...form, graduationYear: Number(value) || currentRosterYear() })} />
            <ChoiceSelect aria-label="Primary" value={form.primaryPosition} className="manual-choice-cell" options={POSITIONS.map((position) => ({ value: position, label: position }))} onChange={(value) => setForm({ ...form, primaryPosition: value as Position })} />
            <ChoiceSelect aria-label="Secondary" value={form.secondaryPosition ?? ""} className="manual-choice-cell" options={SECONDARY_POSITIONS.map((position) => ({ value: position, label: position || "None" }))} onChange={(value) => setForm({ ...form, secondaryPosition: value ? value as Position : undefined })} />
            <ChoiceSelect aria-label="Bats" value={form.bats} className="manual-choice-cell" options={["R", "L", "S"].map((value) => ({ value, label: value }))} onChange={(value) => setForm({ ...form, bats: value as Player["bats"] })} />
            <ChoiceSelect aria-label="Throws" value={form.throws} className="manual-choice-cell" options={["R", "L"].map((value) => ({ value, label: value }))} onChange={(value) => setForm({ ...form, throws: value as Player["throws"] })} />
            <ManualHeightCell value={String(heightToInches(form.height))} onChange={(heightInches) => setForm({ ...form, height: heightInches ? formatHeightFromInches(Number(heightInches)) : undefined })} />
            <ManualNumberCell label="Weight" value={form.weight ? String(form.weight) : ""} min={80} max={320} onChange={(value) => setForm({ ...form, weight: Number(value) || undefined })} />
            <ChoiceSelect aria-label="Status" value={form.rosterStatus ?? "Undecided"} className="manual-choice-cell" options={ROSTER_STATUSES.map((status) => ({ value: status, label: status }))} onChange={(value) => setForm({ ...form, rosterStatus: value as RosterStatus })} />
          </div>
        </div>
      </section>
      <div className="modal-actions">
        <button className="primary-button" type="button" onClick={() => onSave({ ...form, ...roleFlags, updatedAt: new Date().toISOString() })}><Save size={16} aria-hidden="true" />Save Player</button>
      </div>
    </ModalFrame>
  );
}

type PdfRosterParseResponse = {
  ok?: boolean;
  fileName?: string;
  fileType?: "pdf";
  fileSize?: number;
  players?: ParsedRosterRow[];
  staff?: ParsedRosterStaff[];
  detectedSchool?: string;
  detectedTeam?: string;
  detectedSeason?: string;
  warnings?: string[];
  stage?: string;
  code?: string;
  message?: string;
  text?: string;
};

type RosterBuilderMode = "upload" | "manual";
type ManualRosterRow = {
  id: ID;
  jerseyNumber: string;
  firstName: string;
  lastName: string;
  graduationYear: string;
  primaryPosition: Position | "";
  secondaryPosition: Position | "";
  bats: Player["bats"];
  throws: Player["throws"];
  heightInches: string;
  weight: string;
  rosterStatus: RosterStatus;
};

function RosterImportModal({
  data,
  onClose,
  onCreateTeam,
  onImport,
}: {
  data: AppData;
  onClose: () => void;
  onCreateTeam: (input: { teamName: string; teamLevel?: string; seasonName: string }) => Promise<TeamOption>;
  onImport: (plan: RosterImportPlan) => void;
}) {
  const [step, setStep] = useState<"upload" | "assign" | "preview">("upload");
  const [builderMode, setBuilderMode] = useState<RosterBuilderMode>("upload");
  const [files, setFiles] = useState<ParsedRosterFile[]>([]);
  const [sourceFiles, setSourceFiles] = useState<Record<ID, File>>({});
  const [manualRows, setManualRows] = useState<ManualRosterRow[]>(() => createManualRosterRows(9, "Undecided"));
  const [manualError, setManualError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [assignments, setAssignments] = useState<Record<ID, { teamId: ID; mode: RosterImportMode; defaultRosterStatus: RosterStatus; replaceConfirmed: boolean }>>({});
  const [teamDrafts, setTeamDrafts] = useState<Record<ID, { teamName: string; teamLevel: string; seasonName: string; busy?: boolean; error?: string }>>({});
  const [resolutions, setResolutions] = useState<Record<string, { decision: RosterImportDecision; matchedPlayerId?: ID }>>({});
  const [openImportChoice, setOpenImportChoice] = useState<string | null>(null);
  const availableTeams = data.teamContext?.availableTeams ?? [];
  const fallbackTeam = data.teamContext?.currentTeam ?? availableTeams[0];
  const manualDefaultStatus = rosterStatusForTeam(fallbackTeam);
  useEffect(() => {
    setManualRows((current) => current.map((row) => (manualRowHasContent(row) ? row : { ...row, rosterStatus: manualDefaultStatus })));
  }, [manualDefaultStatus]);
  const validFiles = files.filter((file) => file.parseStatus !== "error" && file.parseStatus !== "parsing" && file.rows.length > 0);
  const hasUnresolvedFiles = files.some((file) => file.parseStatus === "error" || file.parseStatus === "parsing" || file.rows.length === 0);
  const configuredAssignments = validFiles
    .map((file) => {
      const config = assignments[file.id];
      if (config?.teamId === CREATE_TEAM_VALUE) return undefined;
      const team = availableTeams.find((item) => item.teamId === config?.teamId) ?? fallbackTeam;
      if (!team) return undefined;
      return {
        source: file,
        teamId: team.teamId,
        teamName: team.teamName,
        seasonId: team.seasonId,
        seasonName: team.seasonName,
        mode: config?.mode ?? "add",
        defaultRosterStatus: config?.defaultRosterStatus ?? rosterStatusForTeam(team),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const basePlan = configuredAssignments.length ? buildRosterImportPlan(data, configuredAssignments) : undefined;
  const plan = basePlan
    ? {
        ...basePlan,
        files: basePlan.files.map((file) => ({
          ...file,
          rows: file.rows.map((row) => {
            const resolution = resolutions[`${file.sourceId}:${row.id}`];
            return resolution ? { ...row, decision: resolution.decision, matchedPlayerId: resolution.matchedPlayerId ?? row.matchedPlayerId } : row;
          }),
        })),
      }
    : undefined;
  const totalRows = plan?.files.reduce((sum, file) => sum + file.rows.length, 0) ?? 0;
  const readyRows = plan?.files.reduce((sum, file) => sum + file.rows.filter((row) => row.status !== "error" && row.decision !== "skip").length, 0) ?? 0;
  const errorRows = plan?.files.reduce((sum, file) => sum + file.rows.filter((row) => row.status === "error").length, 0) ?? 0;
  const allFilesAssigned = validFiles.length > 0 && configuredAssignments.length === validFiles.length && !hasUnresolvedFiles;
  const needsReplaceConfirmation = plan?.files.some((file) => file.mode === "replace" && !assignments[file.sourceId]?.replaceConfirmed) ?? false;
  const manualHasContent = manualRows.some(manualRowHasContent);
  const hasImportProgress = files.length > 0 || manualHasContent || busy;

  function requestClose() {
    if (hasImportProgress && !window.confirm("Discard this roster import? Uploaded files and manual rows will be lost.")) return;
    onClose();
  }

  function downloadRosterTemplate() {
    const blob = new Blob([ROSTER_CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `metrolina-roster-template-${slugifyFilePart(fallbackTeam?.seasonName ?? data.settings.rosterSeason)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function handleFiles(fileList: FileList | File[]) {
    const selected = Array.from(fileList);
    if (!selected.length) return;
    setUploadError("");
    const existingSignatures = new Set(Object.values(sourceFiles).map(rosterFileSignature));
    const seenSignatures = new Set(existingSignatures);
    const duplicateNames: string[] = [];
    const uniqueFiles = selected.filter((file) => {
      const signature = rosterFileSignature(file);
      if (seenSignatures.has(signature)) {
        duplicateNames.push(file.name);
        return false;
      }
      seenSignatures.add(signature);
      return true;
    });

    if (duplicateNames.length) {
      setUploadError(`Skipped duplicate upload: ${Array.from(new Set(duplicateNames)).join(", ")}.`);
    }
    if (!uniqueFiles.length) return;

    setBusy(true);
    const queued = uniqueFiles.map((file) => ({
      sourceId: crypto.randomUUID(),
      file,
    }));
    setSourceFiles((current) => {
      const next = { ...current };
      queued.forEach((item) => {
        next[item.sourceId] = item.file;
      });
      return next;
    });
    setFiles((current) => [
      ...current,
      ...queued.map(({ sourceId, file }) => parsingRosterFile(sourceId, file)),
    ]);
    setStep("assign");
    try {
      const parsed = await Promise.all(
        queued.map(async ({ sourceId, file }) => {
          try {
            return await parseImportFile(file, sourceId);
          } catch (error) {
            return failedRosterFile(sourceId, file, error);
          }
        }),
      );
      setFiles((current) => current.map((file) => parsed.find((item) => item.id === file.id) ?? file));
      setAssignments((current) => {
        const next = { ...current };
        parsed.filter((file) => file.parseStatus !== "error" && file.rows.length > 0).forEach((file) => {
          const suggested = suggestTeamForFile(file, availableTeams, fallbackTeam);
          if (suggested) {
            next[file.id] = {
              teamId: suggested.teamId,
              mode: "add",
              defaultRosterStatus: rosterStatusForTeam(suggested),
              replaceConfirmed: false,
            };
          }
        });
        return next;
      });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Unable to parse roster file.");
    } finally {
      setBusy(false);
    }
  }

  async function retryFile(sourceId: ID) {
    const file = sourceFiles[sourceId];
    if (!file) return;
    setUploadError("");
    setFiles((current) => current.map((item) => (item.id === sourceId ? parsingRosterFile(sourceId, file) : item)));
    try {
      const parsed = await parseImportFile(file, sourceId);
      setFiles((current) => current.map((item) => (item.id === sourceId ? parsed : item)));
      if (parsed.parseStatus !== "error" && parsed.rows.length > 0) {
        setAssignments((current) => {
          const suggested = suggestTeamForFile(parsed, availableTeams, fallbackTeam);
          if (!suggested) return current;
          return {
            ...current,
            [sourceId]: current[sourceId] ?? {
              teamId: suggested.teamId,
              mode: "add",
              defaultRosterStatus: rosterStatusForTeam(suggested),
              replaceConfirmed: false,
            },
          };
        });
      }
    } catch (error) {
      setFiles((current) => current.map((item) => (item.id === sourceId ? failedRosterFile(sourceId, file, error) : item)));
    }
  }

  function removeFile(sourceId: ID) {
    setFiles((current) => current.filter((file) => file.id !== sourceId));
    setSourceFiles((current) => {
      const next = { ...current };
      delete next[sourceId];
      return next;
    });
    setAssignments((current) => {
      const next = { ...current };
      delete next[sourceId];
      return next;
    });
    setTeamDrafts((current) => {
      const next = { ...current };
      delete next[sourceId];
      return next;
    });
    setResolutions((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${sourceId}:`))));
  }

  function updateManualRow(rowId: ID, patch: Partial<ManualRosterRow>) {
    setManualRows((current) => current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
    setManualError("");
  }

  function applyManualStatus(status: RosterStatus) {
    setManualRows((current) => current.map((row) => ({ ...row, rosterStatus: status })));
    setManualError("");
  }

  function addManualRows(count: number) {
    setManualRows((current) => [...current, ...createManualRosterRows(count, manualDefaultStatus)]);
  }

  function removeManualRow(rowId: ID) {
    setManualRows((current) => current.length > 1 ? current.filter((row) => row.id !== rowId) : current);
  }

  function reviewManualRows() {
    const filledRows = manualRows.filter(manualRowHasContent);
    const problemRows = filledRows.filter((row) => manualRowProblems(row).length > 0);
    if (!filledRows.length) {
      setManualError("Enter at least one player before previewing.");
      return;
    }
    if (problemRows.length) {
      setManualError("Resolve the highlighted rows before continuing.");
      return;
    }

    const sourceId = `manual-${createId("manual")}`;
    const parsed = parseRosterCsv(manualRowsToCsv(filledRows), {
      sourceId,
      fileName: "Manual Roster Entry",
      seasonName: fallbackTeam?.seasonName ?? data.settings.rosterSeason,
      defaultRosterStatus: manualDefaultStatus,
    });
    const readyFile: ParsedRosterFile = {
      ...parsed,
      fileName: `Manual Roster Entry (${filledRows.length})`,
      parseWarnings: ["Entered manually in Roster Builder."],
      parseStatus: parsed.rows.length > 0 && parsed.rows.every((row) => row.errors.length === 0) ? "ready" : "error",
      parseError: parsed.rows.some((row) => row.errors.length > 0) ? "Some manual rows need review." : parsed.parseError,
    };
    setFiles((current) => [...current.filter((file) => !file.id.startsWith("manual-")), readyFile]);
    setAssignments((current) => {
      if (!fallbackTeam) return current;
      return {
        ...current,
        [sourceId]: {
          teamId: fallbackTeam.teamId,
          mode: "add",
          defaultRosterStatus: manualDefaultStatus,
          replaceConfirmed: false,
        },
      };
    });
    setManualError("");
    setStep("preview");
  }

  function previewImport() {
    if (builderMode === "manual") {
      reviewManualRows();
      return;
    }
    setStep(validFiles.length ? "preview" : "upload");
  }

  async function parseImportFile(file: File, sourceId: ID): Promise<ParsedRosterFile> {
    const lowerName = file.name.toLowerCase();
    const seasonName = fallbackTeam?.seasonName ?? data.settings.rosterSeason;
    if (lowerName.endsWith(".pdf") || file.type === "application/pdf") {
      const body = new FormData();
      body.append("file", file);
      body.append("sourceId", sourceId);
      if (seasonName) body.append("fallbackSeasonName", seasonName);
      const response = await fetch("/api/roster/parse-pdf", { method: "POST", body });
      const payload = (await response.json().catch(() => ({}))) as PdfRosterParseResponse;
      if (response.ok && payload.ok && Array.isArray(payload.players)) {
        return {
          id: sourceId,
          fileName: payload.fileName ?? file.name,
          fileType: "pdf",
          rows: payload.players,
          staff: payload.staff ?? [],
          detectedSchoolName: payload.detectedSchool,
          detectedTeamName: payload.detectedTeam,
          detectedSeasonName: payload.detectedSeason,
          parseWarnings: payload.warnings ?? [],
          parseStatus: payload.players.length > 0 ? "ready" : "error",
          parseError: payload.players.length > 0 ? undefined : "No roster players were detected in this PDF.",
          parseStage: payload.stage,
          fileSize: payload.fileSize ?? file.size,
        };
      }
      if (response.ok && payload.text) {
        const parsed = parseMaxPrepsPdfText(payload.text, { sourceId, fileName: file.name, fallbackSeasonName: seasonName });
        return { ...parsed, fileSize: file.size, parseWarnings: [...parsed.parseWarnings, ...(payload.warnings ?? [])] };
      }
      const details = [payload.stage, payload.code].filter(Boolean).join(" / ");
      throw new Error(`${payload.message ?? "Unable to read PDF text."}${details ? ` (${details})` : ""}`);
    }
    if (!lowerName.endsWith(".csv") && file.type && !file.type.includes("csv")) {
      throw new Error(`${file.name} is not a supported CSV or PDF file.`);
    }
    const text = await file.text();
    const parsed = parseRosterCsv(text, { sourceId, fileName: file.name, seasonName });
    return { ...parsed, fileSize: file.size };
  }

  return (
    <ModalFrame title="Import Roster" onClose={requestClose} panelClassName="modal-panel--import">
      <section className="import-wizard-top">
        <div className="import-wizard-steps" aria-label="Import progress">
          {["Upload", "Assign Team", "Preview"].map((label, index) => (
            <span key={label} className={index <= ["upload", "assign", "preview"].indexOf(step) ? "active" : ""}>{index + 1}. {label}</span>
          ))}
        </div>
        <button className="secondary-button import-template-button" type="button" onClick={downloadRosterTemplate}>
          <Download size={15} aria-hidden="true" />
          Download Template
        </button>
      </section>

      <section className="builder-mode-row" aria-label="Roster import method">
        <button type="button" className={builderMode === "upload" ? "active" : ""} onClick={() => setBuilderMode("upload")}>
          <Upload size={16} aria-hidden="true" />
          Upload File
        </button>
        <button type="button" className={builderMode === "manual" ? "active" : ""} onClick={() => setBuilderMode("manual")}>
          <Users size={16} aria-hidden="true" />
          Enter Manually
        </button>
      </section>

      {builderMode === "upload" ? (
        <>
          <label
            className="file-drop import-drop"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              void handleFiles(event.dataTransfer.files);
            }}
          >
            <Upload size={20} aria-hidden="true" />
            <span>{busy ? "Parsing roster files..." : "Drop CSV/PDF files here or choose files"}</span>
            <small>Supports MaxPreps CSV, generic CSV, and text-based MaxPreps PDF rosters. Multiple files are okay.</small>
            <input
              type="file"
              accept=".csv,text/csv,.pdf,application/pdf"
              multiple
              onChange={(event) => {
                if (event.target.files) void handleFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
          {uploadError && <p className="form-error">{uploadError}</p>}
        </>
      ) : (
        <ManualRosterBuilder
          rows={manualRows}
          error={manualError}
          onChangeRow={updateManualRow}
          onApplyStatus={applyManualStatus}
          onAddRows={addManualRows}
          onRemoveRow={removeManualRow}
        />
      )}

      {files.length > 0 && (
        <section className="import-file-list">
          {files.map((file) => {
            const config = assignments[file.id];
            const isCreatingTeam = config?.teamId === CREATE_TEAM_VALUE;
            const selectedTeam = isCreatingTeam ? undefined : availableTeams.find((team) => team.teamId === config?.teamId) ?? fallbackTeam;
            const effectiveTeam = selectedTeam ?? fallbackTeam;
            const isParsing = file.parseStatus === "parsing";
            const isError = file.parseStatus === "error" || (!isParsing && file.rows.length === 0);
            const isReady = !isParsing && !isError;
            const draft = teamDrafts[file.id] ?? {
              teamName: file.detectedTeamName ?? "",
              teamLevel: teamLevelFromName(file.detectedTeamName ?? ""),
              seasonName: file.detectedSeasonName ?? fallbackTeam?.seasonName ?? data.settings.rosterSeason,
            };
            return (
              <article key={file.id} className={`import-file-card panel is-${file.parseStatus ?? "ready"}`}>
                <div className="import-file-meta">
                  <div>
                    <strong title={file.fileName}>{file.fileName}</strong>
                    <small>
                      {isParsing
                        ? `${file.fileType.toUpperCase()} - Parsing...`
                        : isError
                          ? `${file.fileType.toUpperCase()} - Could not read roster`
                          : `${file.fileType.toUpperCase()} - ${file.rows.length} players${file.staff.length ? ` - ${file.staff.length} staff` : ""}`}
                    </small>
                    {(file.detectedSchoolName || file.detectedTeamName || file.detectedSeasonName) && (
                      <em>
                        {[file.detectedSchoolName, file.detectedTeamName, file.detectedSeasonName].filter(Boolean).join(" - ")}
                      </em>
                    )}
                    {file.parseError && <em className="danger">{file.parseError}</em>}
                    {file.parseWarnings.map((warning) => <em key={warning} className="warn">{warning}</em>)}
                    {isError && (
                      <div className="import-file-actions">
                        <button className="secondary-button" type="button" onClick={() => void retryFile(file.id)} disabled={!sourceFiles[file.id]}>
                          Retry
                        </button>
                        <button className="ghost-button" type="button" onClick={() => removeFile(file.id)}>
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                  {isReady && (
                    <button className="ghost-button import-remove-button" type="button" onClick={() => removeFile(file.id)}>
                      Remove
                    </button>
                  )}
                </div>
                {isReady && (
                  <div className="import-assignment-grid">
                    <ImportChoiceField
                      label="Team"
                      value={config?.teamId ?? selectedTeam?.teamId ?? ""}
                      options={[
                        ...availableTeams.map((team) => ({ value: team.teamId, label: `${team.teamName} - ${team.seasonName ?? "Current season"}` })),
                        { value: CREATE_TEAM_VALUE, label: "Create New Team..." },
                      ]}
                      open={openImportChoice === `${file.id}:team`}
                      onOpen={(open) => setOpenImportChoice(open ? `${file.id}:team` : null)}
                      onChange={(value) => {
                        if (value === CREATE_TEAM_VALUE) {
                          setAssignments((current) => ({
                            ...current,
                            [file.id]: {
                              teamId: CREATE_TEAM_VALUE,
                              mode: current[file.id]?.mode ?? "add",
                              defaultRosterStatus: current[file.id]?.defaultRosterStatus ?? rosterStatusForTeam(undefined),
                              replaceConfirmed: false,
                            },
                          }));
                          setTeamDrafts((current) => ({
                            ...current,
                            [file.id]: current[file.id] ?? draft,
                          }));
                          return;
                        }
                        const team = availableTeams.find((item) => item.teamId === value);
                        setAssignments((current) => ({
                          ...current,
                          [file.id]: {
                            teamId: value,
                            mode: current[file.id]?.mode ?? "add",
                            defaultRosterStatus: current[file.id]?.defaultRosterStatus ?? rosterStatusForTeam(team),
                            replaceConfirmed: false,
                          },
                        }));
                      }}
                    />
                    <ImportChoiceField
                      label="Import Mode"
                      value={config?.mode ?? "add"}
                      options={[
                        { value: "add", label: "Keep + Add" },
                        { value: "replace", label: "Replace Team" },
                        { value: "update", label: "Update Existing" },
                      ]}
                      open={openImportChoice === `${file.id}:mode`}
                      onOpen={(open) => setOpenImportChoice(open ? `${file.id}:mode` : null)}
                      onChange={(value) => setAssignments((current) => ({
                        ...current,
                        [file.id]: {
                          teamId: current[file.id]?.teamId ?? selectedTeam?.teamId ?? "",
                          mode: value as RosterImportMode,
                          defaultRosterStatus: current[file.id]?.defaultRosterStatus ?? rosterStatusForTeam(effectiveTeam),
                          replaceConfirmed: false,
                        },
                      }))}
                    />
                    <ImportChoiceField
                      label="Default Status"
                      value={config?.defaultRosterStatus ?? rosterStatusForTeam(effectiveTeam)}
                      options={ROSTER_STATUSES.map((status) => ({ value: status, label: status }))}
                      open={openImportChoice === `${file.id}:status`}
                      onOpen={(open) => setOpenImportChoice(open ? `${file.id}:status` : null)}
                      onChange={(value) => setAssignments((current) => ({
                        ...current,
                        [file.id]: {
                          teamId: current[file.id]?.teamId ?? selectedTeam?.teamId ?? "",
                          mode: current[file.id]?.mode ?? "add",
                          defaultRosterStatus: value as RosterStatus,
                          replaceConfirmed: current[file.id]?.replaceConfirmed ?? false,
                        },
                      }))}
                    />
                  </div>
                )}
                {isReady && isCreatingTeam && (
                  <div className="import-create-team-form">
                    <label>
                      <span>Team Name</span>
                      <input
                        value={draft.teamName}
                        onChange={(event) => setTeamDrafts((current) => ({
                          ...current,
                          [file.id]: { ...draft, teamName: event.target.value, error: undefined },
                        }))}
                        placeholder="Metrolina Varsity"
                      />
                    </label>
                    <label>
                      <span>Level</span>
                      <input
                        value={draft.teamLevel}
                        onChange={(event) => setTeamDrafts((current) => ({
                          ...current,
                          [file.id]: { ...draft, teamLevel: event.target.value, error: undefined },
                        }))}
                        placeholder="Varsity, JV, 17U..."
                      />
                    </label>
                    <label>
                      <span>Season</span>
                      <input
                        value={draft.seasonName}
                        onChange={(event) => setTeamDrafts((current) => ({
                          ...current,
                          [file.id]: { ...draft, seasonName: event.target.value, error: undefined },
                        }))}
                        placeholder="Fall 2026"
                      />
                    </label>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={Boolean(draft.busy) || !draft.teamName.trim() || !draft.seasonName.trim()}
                      onClick={async () => {
                        setTeamDrafts((current) => ({ ...current, [file.id]: { ...draft, busy: true, error: undefined } }));
                        try {
                          const team = await onCreateTeam({
                            teamName: draft.teamName,
                            teamLevel: draft.teamLevel || undefined,
                            seasonName: draft.seasonName,
                          });
                          setAssignments((current) => ({
                            ...current,
                            [file.id]: {
                              teamId: team.teamId,
                              mode: current[file.id]?.mode ?? "add",
                              defaultRosterStatus: current[file.id]?.defaultRosterStatus ?? rosterStatusForTeam(team),
                              replaceConfirmed: false,
                            },
                          }));
                        } catch (error) {
                          setTeamDrafts((current) => ({
                            ...current,
                            [file.id]: {
                              ...draft,
                              busy: false,
                              error: error instanceof Error ? error.message : "Unable to create team.",
                            },
                          }));
                        }
                      }}
                    >
                      {draft.busy ? "Creating..." : "Create Team"}
                    </button>
                    {draft.error && <em className="warn">{draft.error}</em>}
                  </div>
                )}
                {isReady && config?.mode === "replace" && (
                  <label className="import-warning-check">
                    <input
                      type="checkbox"
                      checked={Boolean(config.replaceConfirmed)}
                      onChange={(event) => {
                        const team = effectiveTeam;
                        setAssignments((current) => ({
                          ...current,
                          [file.id]: {
                            teamId: current[file.id]?.teamId ?? team?.teamId ?? "",
                            mode: current[file.id]?.mode ?? "replace",
                            defaultRosterStatus: current[file.id]?.defaultRosterStatus ?? rosterStatusForTeam(team),
                            replaceConfirmed: event.target.checked,
                          },
                        }));
                      }}
                    />
                    <span>This replaces the current roster for {selectedTeam?.teamName ?? (draft.teamName || "this team")}. Player profiles and historical data will not be deleted.</span>
                  </label>
                )}
              </article>
            );
          })}
        </section>
      )}

      {plan && step === "preview" && (
        <>
          <div className="import-summary">
            <StatTile label="Rows" value={totalRows} />
            <StatTile label="Ready" value={readyRows} accent />
            <StatTile label="Problems" value={errorRows} />
            <StatTile label="Files" value={plan.files.length} />
          </div>
          <section className="import-preview" aria-label="Roster import preview">
            {plan.files.map((file) => (
              <div key={file.sourceId} className="import-preview-file">
                <div className="import-preview-title">
                  <div>
                    <strong>{file.teamName}</strong>
                    <small>{importModeLabel(file.mode)} - {file.fileName}</small>
                  </div>
                  <div className="import-preview-counts">
                    <span>Add {file.addCount}</span>
                    <span>Update {file.updateCount}</span>
                    <span>Keep {file.keepCount}</span>
                    <span>Remove {file.removeCount}</span>
                  </div>
                </div>
                {file.staff.length > 0 && (
                  <div className="staff-detected">
                    <strong>Staff detected</strong>
                    <span>{file.staff.map((staff) => `${staff.name} - ${staff.role}`).join("; ")}</span>
                  </div>
                )}
                <div className="import-preview__head import-preview__head--wide">
                  <span>#</span>
                  <span>Player</span>
                  <span>Pos / Grade</span>
                  <span>Ht / Wt</span>
                  <span>Match</span>
                  <span>Decision</span>
                </div>
                {file.rows.map((row) => (
                  <article className={`import-row import-row--wide has-${row.status}`} key={`${file.sourceId}-${row.id}`}>
                    <span>{row.jerseyNumber ?? "--"}</span>
                    <div>
                      <strong>{row.firstName || "First"} {row.lastName || "Last"}</strong>
                      <small>{row.sourceType.toUpperCase()} row {row.rowNumber}</small>
                      {row.errors.map((error) => <em key={error}>{error}</em>)}
                      {row.warnings.map((warning) => <em key={warning} className="soft">{warning}</em>)}
                    </div>
                    <div>
                      <strong>{row.rawPositions.join(" / ") || row.primaryPosition}</strong>
                      <small>{row.rawGrade ?? "Grade"} - {row.graduationYear ?? "Grad year"} - {row.rosterStatus}</small>
                    </div>
                    <div>
                      <strong>{row.height ?? "--"}</strong>
                      <small>{row.weight ? `${row.weight} lb` : "Weight --"}{row.isCaptain ? " - Captain" : ""}</small>
                    </div>
                    <div>
                      <strong>{row.matchedPlayerName ?? (row.duplicateSourcePlayerId ? "Same upload" : row.status === "possible-match" ? "Review" : "New")}</strong>
                      <small>{row.candidatePlayerIds.length ? `${row.candidatePlayerIds.length} candidate${row.candidatePlayerIds.length === 1 ? "" : "s"}` : "No existing match"}</small>
                    </div>
                    <ChoiceSelect
                      value={row.decision}
                      disabled={row.status === "error"}
                      className="import-row-choice"
                      options={[
                        { value: "use-existing", label: "Use Existing Player" },
                        { value: "create-new", label: "Create New Player" },
                        { value: "skip", label: "Skip" },
                      ].filter((option) => option.value !== "use-existing" || row.matchedPlayerId || row.candidatePlayerIds.length)}
                      onChange={(value) => {
                        const decision = value as RosterImportDecision;
                        setResolutions((current) => ({
                          ...current,
                          [`${file.sourceId}:${row.id}`]: {
                            decision,
                            matchedPlayerId: decision === "use-existing" ? row.matchedPlayerId ?? row.candidatePlayerIds[0] : undefined,
                          },
                        }));
                      }}
                      aria-label={`Duplicate resolution for ${row.firstName} ${row.lastName}`}
                    />
                  </article>
                ))}
              </div>
            ))}
          </section>
        </>
      )}

      <div className="modal-actions">
        <button className="secondary-button" type="button" onClick={requestClose}>Cancel</button>
        {step !== "upload" && <button className="secondary-button" type="button" onClick={() => setStep(step === "preview" ? "assign" : "upload")}>Back</button>}
        {step !== "preview" ? (
          <button className="primary-button" type="button" onClick={previewImport} disabled={builderMode === "manual" ? !manualHasContent || busy : !allFilesAssigned || busy}>
            Preview Import
          </button>
        ) : (
          <button className="primary-button" type="button" onClick={() => plan && onImport(plan)} disabled={!plan || readyRows === 0 || errorRows > 0 || needsReplaceConfirmation}>
            Import {readyRows} Player{readyRows === 1 ? "" : "s"}
          </button>
        )}
      </div>
    </ModalFrame>
  );
}

function ImportChoiceField({
  label,
  value,
  options,
  open,
  onOpen,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  open: boolean;
  onOpen: (open: boolean) => void;
  onChange: (value: string) => void;
}) {
  const selected = options.find((option) => option.value === value) ?? options[0];
  return (
    <div className={`import-choice ${open ? "open" : ""}`}>
      <span>{label}</span>
      <button type="button" className="import-choice__button" aria-expanded={open} onClick={() => onOpen(!open)}>
        <strong>{selected?.label ?? "Select"}</strong>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && (
        <div className="import-choice__menu" role="listbox" aria-label={label}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={option.value === value ? "active" : ""}
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                onOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function parsingRosterFile(sourceId: ID, file: File): ParsedRosterFile {
  return {
    id: sourceId,
    fileName: file.name,
    fileType: file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf" ? "pdf" : "csv",
    rows: [],
    staff: [],
    parseWarnings: [],
    parseStatus: "parsing",
    fileSize: file.size,
  };
}

function failedRosterFile(sourceId: ID, file: File, error: unknown): ParsedRosterFile {
  const message = error instanceof Error ? error.message : "Unable to parse roster file.";
  return {
    id: sourceId,
    fileName: file.name,
    fileType: file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf" ? "pdf" : "csv",
    rows: [],
    staff: [],
    parseWarnings: [],
    parseStatus: "error",
    parseError: message,
    fileSize: file.size,
  };
}

function ManualRosterBuilder({
  rows,
  error,
  onChangeRow,
  onApplyStatus,
  onAddRows,
  onRemoveRow,
}: {
  rows: ManualRosterRow[];
  error?: string;
  onChangeRow: (rowId: ID, patch: Partial<ManualRosterRow>) => void;
  onApplyStatus: (status: RosterStatus) => void;
  onAddRows: (count: number) => void;
  onRemoveRow: (rowId: ID) => void;
}) {
  const sharedStatus = rows.every((row) => row.rosterStatus === rows[0]?.rosterStatus) ? rows[0]?.rosterStatus ?? "Undecided" : "";
  return (
    <section className="manual-roster-builder">
      <div className="manual-builder-toolbar">
        <div>
          <strong>Manual Roster Entry</strong>
        </div>
        <div className="manual-status-apply">
          <span>All new players</span>
          <div className="manual-status-chips" role="group" aria-label="Apply roster status to all manual rows">
            {ROSTER_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                className={sharedStatus === status ? "active" : ""}
                onClick={() => onApplyStatus(status)}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="manual-roster-scroll">
        <div className="manual-roster-table">
          <div className="manual-roster-head" aria-hidden="true">
            <span>#</span>
            <span>First</span>
            <span>Last</span>
            <span>Class</span>
            <span>Primary</span>
            <span>Secondary</span>
            <span>Bats</span>
            <span>Throws</span>
            <span>Height</span>
            <span>Weight</span>
            <span>Status</span>
            <span />
          </div>
          {rows.map((row) => {
            const problems = manualRowProblems(row);
            return (
              <div key={row.id} className={`manual-roster-row ${problems.length ? "has-error" : ""}`}>
                <ManualNumberCell label="Jersey number" value={row.jerseyNumber} min={0} max={99} onChange={(jerseyNumber) => onChangeRow(row.id, { jerseyNumber })} />
                <input
                  aria-label="First name"
                  value={row.firstName}
                  onChange={(event) => onChangeRow(row.id, { firstName: event.target.value })}
                />
                <input
                  aria-label="Last name"
                  value={row.lastName}
                  onChange={(event) => onChangeRow(row.id, { lastName: event.target.value })}
                />
                <ManualNumberCell label="Graduation year" value={row.graduationYear} min={2020} max={2045} onChange={(graduationYear) => onChangeRow(row.id, { graduationYear })} />
                <ChoiceSelect
                  aria-label="Primary position"
                  value={row.primaryPosition}
                  className="manual-choice-cell"
                  options={[{ value: "", label: "-" }, ...POSITIONS.map((position) => ({ value: position, label: position }))]}
                  onChange={(value) => onChangeRow(row.id, { primaryPosition: value as Position | "" })}
                />
                <ChoiceSelect
                  aria-label="Secondary position"
                  value={row.secondaryPosition}
                  className="manual-choice-cell"
                  options={[{ value: "", label: "-" }, ...POSITIONS.map((position) => ({ value: position, label: position }))]}
                  onChange={(value) => onChangeRow(row.id, { secondaryPosition: value as Position | "" })}
                />
                <ChoiceSelect
                  aria-label="Bats"
                  value={row.bats}
                  className="manual-choice-cell"
                  options={["R", "L", "S"].map((value) => ({ value, label: value }))}
                  onChange={(value) => onChangeRow(row.id, { bats: value as Player["bats"] })}
                />
                <ChoiceSelect
                  aria-label="Throws"
                  value={row.throws}
                  className="manual-choice-cell"
                  options={["R", "L"].map((value) => ({ value, label: value }))}
                  onChange={(value) => onChangeRow(row.id, { throws: value as Player["throws"] })}
                />
                <ManualHeightCell value={row.heightInches} onChange={(heightInches) => onChangeRow(row.id, { heightInches })} />
                <ManualNumberCell label="Weight" value={row.weight} min={80} max={320} onChange={(weight) => onChangeRow(row.id, { weight })} />
                <ChoiceSelect
                  aria-label="Roster status"
                  value={row.rosterStatus}
                  className="manual-choice-cell"
                  options={ROSTER_STATUSES.map((status) => ({ value: status, label: status }))}
                  onChange={(value) => onChangeRow(row.id, { rosterStatus: value as RosterStatus })}
                />
                <button className="row-menu-button" type="button" onClick={() => onRemoveRow(row.id)} aria-label="Remove row">
                  <X size={15} aria-hidden="true" />
                </button>
                {problems.length > 0 && <small className="manual-row-error">{problems.join(" ")}</small>}
              </div>
            );
          })}
          <button className="manual-add-row-button" type="button" onClick={() => onAddRows(1)}>
            <Plus size={15} aria-hidden="true" />
            Add player row
          </button>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}
    </section>
  );
}

function ManualNumberCell({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min: number;
  max: number;
  step?: number;
}) {
  function clean(nextValue: string) {
    return nextValue.replace(/\D/g, "").slice(0, String(max).length);
  }

  function adjust(delta: number) {
    const current = Number(value);
    const base = Number.isFinite(current) && value !== "" ? current : min;
    const next = Math.max(min, Math.min(max, base + delta));
    onChange(String(next));
  }

  return (
    <div className="manual-number-cell">
      <input
        aria-label={label}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(event) => onChange(clean(event.target.value))}
      />
      <div className="manual-number-buttons" aria-label={`Adjust ${label}`}>
        <button type="button" onClick={() => adjust(step)} aria-label={`Increase ${label}`}><Plus size={11} aria-hidden="true" /></button>
        <button type="button" onClick={() => adjust(-step)} aria-label={`Decrease ${label}`}><span aria-hidden="true">-</span></button>
      </div>
    </div>
  );
}

function ManualHeightCell({ value, onChange }: { value: string; onChange: (heightInches: string) => void }) {
  const formattedHeight = formatManualHeight(value);
  const [draft, setDraft] = useState(formattedHeight);
  const [isFocused, setIsFocused] = useState(false);

  function setHeightFromEntry(nextEntry: string) {
    const digits = nextEntry.replace(/\D/g, "").slice(0, 3);
    const nextDraft = formatHeightDigits(digits);
    setDraft(nextDraft);

    if (!digits) {
      onChange("");
      return;
    }

    const parsedFeet = Number(digits[0]);
    const parsedInches = Math.max(0, Math.min(11, Number(digits.slice(1) || 0)));
    if (!Number.isFinite(parsedFeet)) return;
    onChange(String((parsedFeet * 12) + parsedInches));
  }

  function step(delta: number) {
    const current = Number(value) || 72;
    const next = Math.max(48, Math.min(90, current + delta));
    const nextValue = String(next);
    onChange(nextValue);
    setDraft(formatManualHeight(nextValue));
  }

  return (
    <div className="height-ft-in-cell">
      <input
        aria-label="Height"
        type="text"
        inputMode="numeric"
        maxLength={4}
        pattern="[0-9]*"
        value={isFocused ? draft : formattedHeight}
        placeholder="6'1"
        onFocus={() => {
          setIsFocused(true);
          setDraft(formatManualHeight(value));
        }}
        onBlur={() => {
          setIsFocused(false);
          setDraft(formatManualHeight(value));
        }}
        onChange={(event) => setHeightFromEntry(event.target.value)}
      />
      <div className="height-step-buttons" aria-label="Adjust height">
        <button type="button" onClick={() => step(1)} aria-label="Increase height by one inch"><ChevronUp size={12} aria-hidden="true" /></button>
        <button type="button" onClick={() => step(-1)} aria-label="Decrease height by one inch"><ChevronDown size={12} aria-hidden="true" /></button>
      </div>
    </div>
  );
}

function formatHeightDigits(digits: string) {
  if (!digits) return "";
  if (digits.length === 1) return `${digits}'`;
  return `${digits[0]}'${digits.slice(1)}`;
}

function formatManualHeight(value: string) {
  const { feet, inches } = manualHeightParts(value);
  if (!feet) return "";
  return `${feet}'${inches || "0"}`;
}

function manualHeightParts(value: string) {
  const total = Number(value);
  if (!Number.isFinite(total) || total <= 0) return { feet: "", inches: "" };
  return {
    feet: String(Math.floor(total / 12)),
    inches: String(total % 12),
  };
}

function createManualRosterRows(count: number, rosterStatus: RosterStatus) {
  return Array.from({ length: count }, () => createManualRosterRow(rosterStatus));
}

function createManualRosterRow(rosterStatus: RosterStatus): ManualRosterRow {
  return {
    id: `manual-row-${createId("row")}`,
    jerseyNumber: "",
    firstName: "",
    lastName: "",
    graduationYear: String(currentRosterYear()),
    primaryPosition: "",
    secondaryPosition: "",
    bats: "R",
    throws: "R",
    heightInches: "",
    weight: "",
    rosterStatus,
  };
}

function manualRowHasContent(row: ManualRosterRow) {
  return Boolean(
    row.jerseyNumber.trim() ||
    row.firstName.trim() ||
    row.lastName.trim() ||
    row.primaryPosition ||
    row.secondaryPosition ||
    row.heightInches.trim() ||
    row.weight.trim(),
  );
}

function manualRowProblems(row: ManualRosterRow) {
  if (!manualRowHasContent(row)) return [];
  const problems: string[] = [];
  const grad = Number(row.graduationYear);
  const height = Number(row.heightInches);
  const weight = Number(row.weight);
  if (!row.firstName.trim()) problems.push("First name required.");
  if (!row.lastName.trim()) problems.push("Last name required.");
  if (!Number.isInteger(grad) || grad < 2020 || grad > 2045) problems.push("Class year required.");
  if (!row.primaryPosition) problems.push("Primary position required.");
  if (row.heightInches && (!Number.isInteger(height) || height < 48 || height > 90)) problems.push("Height must be inches.");
  if (row.weight && (!Number.isInteger(weight) || weight < 80 || weight > 320)) problems.push("Weight out of range.");
  return problems;
}

function manualRowsToCsv(rows: ManualRosterRow[]) {
  const headers = [
    "First Name",
    "Last Name",
    "Jersey Number",
    "Graduation Year",
    "Primary Position",
    "Secondary Position",
    "Bats",
    "Throws",
    "Height",
    "Weight",
    "Roster Status",
  ];
  const values = rows.map((row) => [
    row.firstName.trim(),
    row.lastName.trim(),
    row.jerseyNumber.trim(),
    row.graduationYear.trim(),
    row.primaryPosition,
    row.secondaryPosition,
    row.bats,
    row.throws,
    row.heightInches ? formatHeightFromInches(Number(row.heightInches)) : "",
    row.weight.trim(),
    row.rosterStatus,
  ]);
  return [headers, ...values].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

function escapeCsvCell(value: string | number | undefined) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
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

function PracticeSummaryModal({
  data,
  practice,
  onClose,
  onSave,
  onOpenPlayer,
}: {
  data: AppData;
  practice: Practice;
  onClose: () => void;
  onSave: () => void;
  onOpenPlayer: (playerId: ID) => void;
}) {
  const totals = practiceTotals(data, practice.id);
  const standouts = buildPracticeStandouts(data, practice.id);

  return (
    <ModalFrame title="Practice Summary" onClose={onClose}>
      <div className="summary-hero">
        <span>{shortDate(practice.date)}</span>
        <h2>{practice.name}</h2>
        <div className="mini-stat-grid">
          <StatTile label="Players" value={practice.playerIds.length} />
          <StatTile label="Total Reps" value={totals.pitches + totals.swings + totals.defense} accent />
          <StatTile label="Hitting" value={totals.hittingSessions} sub={`${totals.swings} swings`} />
          <StatTile label="Pitching" value={totals.pitchingSessions} sub={`${totals.pitches} pitches`} />
        </div>
      </div>
      <section className="practice-standout-list">
        <div className="panel-heading tight">
          <div>
            <span>Standouts</span>
            <h2>Minimum samples applied</h2>
          </div>
        </div>
        {standouts.length ? standouts.map((standout) => (
          <button key={`${standout.label}-${standout.player.id}`} type="button" onClick={() => { onClose(); onOpenPlayer(standout.player.id); }}>
            <PlayerAvatar player={standout.player} size="sm" compact />
            <span>{standout.label}</span>
            <strong>{standout.player.name}</strong>
            <small>{standout.value}</small>
          </button>
        )) : (
          <CompactEmpty title="No standouts yet. Add a few more reps before ranking players." />
        )}
      </section>
      <div className="modal-actions">
        <button className="secondary-button" type="button" onClick={onClose}>Keep Practice Open</button>
        <button className="primary-button" type="button" onClick={onSave}>Save Practice Summary</button>
      </div>
    </ModalFrame>
  );
}

function SectionHeader({ eyebrow, title, body, context, action }: { eyebrow?: string; title: string; body?: string; context?: string; action?: React.ReactNode }) {
  return (
    <section className="section-header">
      <div>
        {eyebrow && <span>{eyebrow}</span>}
        <h2>{title}</h2>
        {context && <small>{context}</small>}
        {body && <p>{body}</p>}
      </div>
      {action}
    </section>
  );
}

function HomeInfoCard({
  icon: Icon,
  title,
  primary,
  meta,
  onClick,
  cta,
}: {
  icon: LucideIcon;
  title: string;
  primary: string;
  meta: string;
  onClick: () => void;
  cta?: string;
}) {
  return (
    <button className="home-info-card panel" type="button" onClick={onClick}>
      <span className="home-info-card__icon"><Icon size={20} aria-hidden="true" /></span>
      <span>
        <small>{title}</small>
        <strong>{primary}</strong>
        <em>{meta}</em>
      </span>
      {cta && <b>{cta}</b>}
    </button>
  );
}

function RecentActivityCard({
  activities,
  onOpenPlayer,
}: {
  activities: TeamActivity[];
  onOpenPlayer: (playerId: ID) => void;
}) {
  return (
    <article className="panel recent-activity-card">
      <h2>Recent Activity</h2>
      <div className="activity-feed">
        {activities.length ? activities.map((activity) => (
          <button
            key={activity.key}
            type="button"
            onClick={() => activity.playerId && onOpenPlayer(activity.playerId)}
            disabled={!activity.playerId}
          >
            {activity.player ? (
              <PlayerAvatar player={activity.player} size="sm" compact />
            ) : (
              <span className={`activity-feed__icon activity-feed__icon--${activity.kind}`} />
            )}
            <span>
              <strong>{activity.title}</strong>
              <small>{activity.meta}</small>
            </span>
            <time>{shortDate(activity.date)}</time>
          </button>
        )) : <CompactEmpty title="No recent activity yet" />}
      </div>
    </article>
  );
}

function TeamSnapshotBar({
  team,
  stats,
}: {
  team: string;
  stats: Array<{ label: string; value: string | number; progress?: number }>;
}) {
  return (
    <section className="panel team-snapshot-bar" aria-label={`${team} snapshot`}>
      <h2>Team Snapshot</h2>
      <div>
        {stats.map((stat) => (
          <span key={stat.label} className="snapshot-stat">
            <strong>{stat.value}</strong>
            <small>{stat.label}</small>
            {typeof stat.progress === "number" && <i style={{ width: `${Math.max(0, Math.min(100, stat.progress))}%` }} />}
          </span>
        ))}
      </div>
    </section>
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

function CompactEmpty({ title, action }: { title: string; action?: React.ReactNode }) {
  return <div className="compact-empty"><span>{title}</span>{action}</div>;
}

function ModalFrame({ title, onClose, children, panelClassName = "" }: { title: string; onClose: () => void; children: React.ReactNode; panelClassName?: string }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`modal-panel ${panelClassName}`.trim()}>
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

interface TeamActivity {
  key: string;
  kind: "practice" | "game" | "weights" | "hitting" | "pitching" | "defense";
  title: string;
  meta: string;
  date: string;
  playerId?: ID;
  player?: Player;
}

function buildWeeklyMvp(data: AppData): AwardResult | undefined {
  const latestDate = data.practices.slice().sort((a, b) => b.date.localeCompare(a.date))[0]?.date ?? "2026-08-08";
  const start = new Date(`${latestDate}T12:00:00`);
  start.setDate(start.getDate() - 7);
  const recentPracticeIds = new Set(data.practices.filter((practice) => new Date(`${practice.date}T12:00:00`) >= start).map((practice) => practice.id));

  const awards = data.players.filter((player) => !player.archived).map((player) => {
    const recentHittingEvents = data.hittingEvents.filter((event) => event.hitterId === player.id && recentPracticeIds.has(event.practiceId));
    const hittingStats = calculateHittingStats(recentHittingEvents);
    const pitchingStats = calculatePitchingStats(data.pitchEvents.filter((event) => event.pitcherId === player.id && recentPracticeIds.has(event.practiceId)));
    const defenseEvents = data.defenseEvents.filter((event) => event.playerId === player.id && recentPracticeIds.has(event.practiceId));
    const gameEvents = data.gameEvents.filter((event) => event.batterId === player.id || event.pitcherId === player.id);
    const attendance = data.attendance.filter((item) => item.playerId === player.id && recentPracticeIds.has(item.practiceId)).length;
    const defenseScore = pct(defenseEvents.filter((event) => event.outcome !== "Error").length, defenseEvents.length);
    const liveAtBats = recentHittingEvents.filter((event) => event.isLiveBp && event.action !== "Took pitch").length;
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
        liveAtBats ? `${formatPct(hittingStats.liveBpAvg * 100, 0)} Live BP AVG` : undefined,
        hittingStats.ballsInPlay ? `${Math.round(hittingStats.barrelPct)}% barrel rate` : undefined,
        hittingStats.ballsInPlay ? `${Math.round(hittingStats.hardHitPct)}% hard contact` : undefined,
        pitchingStats.totalPitches ? `${Math.round(pitchingStats.strikePct)}% strike rate` : `${attendance} practices attended`,
      ].filter((reason): reason is string => Boolean(reason)),
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
    trend,
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

function practiceElapsed(practice: Practice) {
  const start = new Date(practice.startedAt).getTime();
  const end = practice.endedAt ? new Date(practice.endedAt).getTime() : Date.now();
  const minutes = Math.max(0, Math.round((end - start) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h ${remainder}m`;
}

function practiceTotals(data: AppData, practiceId: ID) {
  const pitchEvents = data.pitchEvents.filter((event) => event.practiceId === practiceId);
  const hittingEvents = data.hittingEvents.filter((event) => event.practiceId === practiceId);
  const defenseEvents = data.defenseEvents.filter((event) => event.practiceId === practiceId);
  return {
    pitches: pitchEvents.length,
    swings: hittingEvents.filter((event) => event.action !== "Took pitch").length,
    defense: defenseEvents.length,
    hittingSessions: data.hittingSessions.filter((session) => session.practiceId === practiceId).length,
    pitchingSessions: data.pitchingSessions.filter((session) => session.practiceId === practiceId).length,
    defenseSessions: data.defenseSessions.filter((session) => session.practiceId === practiceId).length,
  };
}

function buildPracticeStandouts(data: AppData, practiceId: ID) {
  const players = data.players.filter((player) => !player.archived);
  const hitterRows = players.map((player) => {
    const stats = calculateHittingStats(data.hittingEvents.filter((event) => event.practiceId === practiceId && event.hitterId === player.id));
    return { player, stats };
  });
  const pitcherRows = players.map((player) => {
    const stats = calculatePitchingStats(data.pitchEvents.filter((event) => event.practiceId === practiceId && event.pitcherId === player.id));
    return { player, stats };
  });
  const defenderRows = players.map((player) => {
    const events = data.defenseEvents.filter((event) => event.practiceId === practiceId && event.playerId === player.id);
    return { player, events, clean: events.filter((event) => event.outcome !== "Error").length };
  });
  const hardHit = hitterRows.filter((row) => row.stats.totalSwings >= 8).sort((a, b) => b.stats.hardHitPct - a.stats.hardHitPct)[0];
  const barrel = hitterRows.filter((row) => row.stats.totalSwings >= 8).sort((a, b) => b.stats.barrelPct - a.stats.barrelPct)[0];
  const strike = pitcherRows.filter((row) => row.stats.totalPitches >= 12).sort((a, b) => b.stats.strikePct - a.stats.strikePct)[0];
  const command = pitcherRows.filter((row) => row.stats.totalPitches >= 12).sort((a, b) => b.stats.intendedTargetHitPct - a.stats.intendedTargetHitPct)[0];
  const defense = defenderRows.filter((row) => row.events.length >= 6).sort((a, b) => b.clean - a.clean)[0];

  return [
    hardHit && { label: "Top Hard-Hit %", player: hardHit.player, value: `${formatPct(hardHit.stats.hardHitPct)} / ${hardHit.stats.totalSwings} swings` },
    barrel && { label: "Top Barrel %", player: barrel.player, value: `${formatPct(barrel.stats.barrelPct)} / ${barrel.stats.totalSwings} swings` },
    strike && { label: "Best Strike %", player: strike.player, value: `${formatPct(strike.stats.strikePct)} / ${strike.stats.totalPitches} pitches` },
    command && command.stats.intendedTargetHitPct > 0 && { label: "Best Command %", player: command.player, value: `${formatPct(command.stats.intendedTargetHitPct)} target hit` },
    defense && { label: "Clean Defensive Reps", player: defense.player, value: `${defense.clean}/${defense.events.length} clean` },
  ].filter(Boolean) as Array<{ label: string; player: Player; value: string }>;
}

function buildPlayerRecentActivity(data: AppData, player: Player) {
  const practicesById = new Map(data.practices.map((practice) => [practice.id, practice]));
  const activities = [
    ...data.hittingSessions
      .filter((session) => session.hitterId === player.id)
      .map((session) => {
        const practice = practicesById.get(session.practiceId);
        const stats = calculateHittingStats(data.hittingEvents.filter((event) => event.sessionId === session.id));
        return {
          key: `hit-${session.id}`,
          date: practice?.date ?? session.startedAt,
          type: "Hitting",
          title: `${session.type} hitting`,
          meta: `${shortDate(practice?.date ?? session.startedAt.slice(0, 10))} - ${stats.totalSwings} swings - ${formatPct(stats.hardHitPct)} hard hit`,
          summaryType: "Hitting" as const,
          sessionId: session.id,
        };
      }),
    ...data.pitchingSessions
      .filter((session) => session.pitcherId === player.id)
      .map((session) => {
        const practice = practicesById.get(session.practiceId);
        const stats = calculatePitchingStats(data.pitchEvents.filter((event) => event.sessionId === session.id));
        return {
          key: `pitch-${session.id}`,
          date: practice?.date ?? session.startedAt,
          type: "Pitching",
          title: `${session.type} session`,
          meta: `${shortDate(practice?.date ?? session.startedAt.slice(0, 10))} - ${stats.totalPitches} pitches - ${formatPct(stats.strikePct)} strikes`,
          summaryType: "Pitching" as const,
          sessionId: session.id,
        };
      }),
    ...data.defenseSessions
      .filter((session) => session.playerId === player.id)
      .map((session) => {
        const practice = practicesById.get(session.practiceId);
        const reps = data.defenseEvents.filter((event) => event.sessionId === session.id);
        return {
          key: `def-${session.id}`,
          date: practice?.date ?? session.startedAt,
          type: "Defense",
          title: session.station,
          meta: `${shortDate(practice?.date ?? session.startedAt.slice(0, 10))} - ${reps.length} reps - ${formatPct(pct(reps.filter((event) => event.outcome !== "Error").length, reps.length))} clean`,
          summaryType: "Defense" as const,
          sessionId: session.id,
        };
      }),
    ...data.workoutSessions
      .filter((session) => session.playerId === player.id)
      .map((session) => ({
        key: `weight-${session.id}`,
        date: session.date,
        type: "Weight Room",
        title: `${session.day} lift`,
        meta: `${shortDate(session.date)} - ${session.completed ? "completed" : "in progress"}`,
        summaryType: undefined,
        sessionId: undefined,
      })),
    ...data.games
      .filter((game) => game.lineup.includes(player.id) || game.currentPitcherId === player.id || game.currentBatterId === player.id || game.startingPitcherId === player.id)
      .map((game) => ({
        key: `game-${game.id}`,
        date: game.date,
        type: "Game",
        title: `vs ${game.opponent}`,
        meta: `${shortDate(game.date)} - ${game.result ?? "not final"} ${game.metrolinaScore}-${game.opponentScore}`,
        summaryType: undefined,
        sessionId: undefined,
      })),
  ];

  return activities.sort((a, b) => b.date.localeCompare(a.date));
}

function buildTeamRecentActivity(data: AppData): TeamActivity[] {
  const playerById = new Map(data.players.map((player) => [player.id, player]));
  const practiceById = new Map(data.practices.map((practice) => [practice.id, practice]));
  const activities: TeamActivity[] = [
    ...data.hittingSessions.map((session) => {
      const practice = practiceById.get(session.practiceId);
      const player = playerById.get(session.hitterId);
      const stats = calculateHittingStats(data.hittingEvents.filter((event) => event.sessionId === session.id));
      return {
        key: `team-hit-${session.id}`,
        kind: "hitting" as const,
        title: session.type,
        meta: `${player?.name ?? "Hitter"} - ${stats.totalSwings} swings`,
        date: practice?.date ?? session.startedAt.slice(0, 10),
        playerId: player?.id,
        player,
      };
    }),
    ...data.pitchingSessions.map((session) => {
      const practice = practiceById.get(session.practiceId);
      const player = playerById.get(session.pitcherId);
      const stats = calculatePitchingStats(data.pitchEvents.filter((event) => event.sessionId === session.id));
      return {
        key: `team-pitch-${session.id}`,
        kind: "pitching" as const,
        title: session.type,
        meta: `${player?.name ?? "Pitcher"} - ${stats.totalPitches} pitches`,
        date: practice?.date ?? session.startedAt.slice(0, 10),
        playerId: player?.id,
        player,
      };
    }),
    ...data.defenseSessions.map((session) => {
      const practice = practiceById.get(session.practiceId);
      const player = playerById.get(session.playerId);
      const reps = data.defenseEvents.filter((event) => event.sessionId === session.id);
      return {
        key: `team-defense-${session.id}`,
        kind: "defense" as const,
        title: session.station,
        meta: `${player?.name ?? "Defender"} - ${reps.length} reps`,
        date: practice?.date ?? session.startedAt.slice(0, 10),
        playerId: player?.id,
        player,
      };
    }),
    ...data.workoutSessions.map((session) => {
      const player = playerById.get(session.playerId);
      return {
        key: `team-weight-${session.id}`,
        kind: "weights" as const,
        title: "Weights",
        meta: `${player?.name ?? "Player"} - ${session.completed ? "completed" : "in progress"}`,
        date: session.date,
        playerId: player?.id,
        player,
      };
    }),
    ...data.games.map((game) => ({
      key: `team-game-${game.id}`,
      kind: "game" as const,
      title: `${game.homeAway === "Home" ? "vs" : "at"} ${game.opponent}`,
      meta: game.result ? `${game.result} ${game.metrolinaScore}-${game.opponentScore}` : game.location,
      date: game.date,
    })),
  ];

  return activities.sort((a, b) => b.date.localeCompare(a.date));
}

function buildPlayerMembershipCards(data: AppData, player: Player) {
  const teamById = new Map((data.teamContext?.availableTeams ?? []).map((team) => [team.teamId, team]));
  const memberships = (data.playerTeamMemberships ?? []).filter((membership) => membership.playerId === player.id);

  if (!memberships.length && data.teamContext?.currentTeam) {
    const team = data.teamContext.currentTeam;
    return [{
      key: `${team.teamId}-${team.seasonId ?? "season"}`,
      team: team.teamName,
      season: team.seasonName ?? data.settings.rosterSeason,
      status: player.rosterStatus ?? "Undecided",
      number: player.jerseyNumber,
    }];
  }

  return memberships
    .filter((membership) => membership.active)
    .map((membership) => {
      const team = teamById.get(membership.teamId);
      return {
        key: membership.id,
        team: team?.teamName ?? "Team membership",
        season: team?.seasonName ?? data.settings.rosterSeason,
        status: membership.rosterStatus,
        number: membership.jerseyNumber ?? player.jerseyNumber,
      };
    });
}

function buildPlayerGameSnapshot(data: AppData, player: Player) {
  const games = data.games.filter(
    (game) => game.lineup.includes(player.id) || game.currentPitcherId === player.id || game.currentBatterId === player.id || game.startingPitcherId === player.id,
  );
  const events = data.gameEvents.filter((event) => event.batterId === player.id);
  const hitOutcomes: GameBallInPlayOutcome[] = ["Single", "Double", "Triple", "Home Run"];
  const atBatOutcomes: GameBallInPlayOutcome[] = ["Single", "Double", "Triple", "Home Run", "Ground Out", "Fly Out", "Line Out", "Pop Out", "Error", "Fielder's Choice"];
  const hits = events.filter((event) => event.ballInPlayOutcome && hitOutcomes.includes(event.ballInPlayOutcome)).length;
  const atBats = events.filter((event) => event.ballInPlayOutcome && atBatOutcomes.includes(event.ballInPlayOutcome)).length;

  return {
    games: games.length,
    hits,
    atBats,
    avg: atBats ? hits / atBats : 0,
  };
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
        { label: "Line Drive", value: formatPct(stats.lineDrivePct) },
      ],
    };
  }
  if (summary.type === "Pitching") {
    const session = data.pitchingSessions.find((item) => item.id === summary.sessionId);
    const player = data.players.find((item) => item.id === session?.pitcherId);
    const events = data.pitchEvents.filter((event) => event.sessionId === summary.sessionId);
    const stats = calculatePitchingStats(events);
    const mix = Object.values(stats.byPitchType)
      .sort((a, b) => b.pitches - a.pitches)
      .slice(0, 3)
      .map((item) => `${PITCH_TYPE_LABELS[item.pitchType]} ${item.pitches}`)
      .join(" / ");
    return {
      title: `${player?.name ?? "Pitcher"} - ${session?.type ?? "Pitching"}`,
      stats: [
        { label: "Pitches", value: stats.totalPitches },
        { label: "Strike %", value: formatPct(stats.strikePct) },
        { label: "CSW %", value: formatPct(stats.cswPct) },
        { label: "Avg Velo", value: formatNumber(stats.avgVelocity, 1) },
        { label: "Max Velo", value: formatNumber(stats.maxVelocity, 1), sub: mix || `${events.length} tracked` },
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

function mapLiveBpOutcome(label: LiveBpOutcomeLabel): NonNullable<PlateAppearance["outcome"]> {
  const outcomes: Record<LiveBpOutcomeLabel, NonNullable<PlateAppearance["outcome"]>> = {
    K: "Strikeout swinging",
    BB: "Walk",
    HBP: "HBP",
    "1B": "Single",
    "2B": "Double",
    "3B": "Triple",
    HR: "Home run",
    Out: "Groundout",
    Error: "Reached on error",
    FC: "Fielder's choice",
  };
  return outcomes[label];
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

function nextLiveBpDisplayCount(count: CountState, outcome: PitchOutcome): CountState {
  let balls = count.balls;
  let strikes = count.strikes;
  if (outcome === "Ball") balls += 1;
  if (outcome === "Called Strike" || outcome === "Whiff") strikes += 1;
  if (outcome === "Foul" && strikes < 2) strikes += 1;
  if (outcome === "Ball in play" || outcome === "HBP") return count;
  return { balls: Math.min(3, balls), strikes: Math.min(2, strikes) };
}

function baseLine(game: Game) {
  const bases = [game.runners.first ? "1B" : null, game.runners.second ? "2B" : null, game.runners.third ? "3B" : null].filter(Boolean);
  return bases.length ? bases.join(" / ") : "Bases empty";
}

function positionLine(player: Player) {
  return player.secondaryPosition ? `${player.primaryPosition} / ${player.secondaryPosition}` : player.primaryPosition;
}

function derivePlayerRoleFlags(primaryPosition?: Position, secondaryPosition?: Position) {
  const positions = [primaryPosition, secondaryPosition].filter(Boolean);
  return {
    isPitcher: positions.some((position) => position === "P" || position === "RHP" || position === "LHP"),
    isHitter: true,
  };
}

function heightToInches(value?: string) {
  if (!value) return 72;
  const feetInches = value.match(/^(\d+)\s*['-]\s*(\d{1,2})/);
  if (feetInches) return Number(feetInches[1]) * 12 + Number(feetInches[2]);
  const totalInches = value.match(/^(\d{2,3})$/);
  if (totalInches) return Number(totalInches[1]);
  return 72;
}

function formatHeightFromInches(value: number) {
  const safeValue = Math.max(48, Math.min(90, Math.round(value)));
  return `${Math.floor(safeValue / 12)}-${safeValue % 12}`;
}

function teamPracticeAttendancePct(data: AppData, activeRosterCount: number) {
  if (!data.practices.length || !activeRosterCount) return 0;
  const attended = data.practices.reduce((total, practice) => total + new Set(practice.playerIds).size, 0);
  return pct(attended, data.practices.length * activeRosterCount);
}

function weeklyRepCount(data: AppData) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoff = sevenDaysAgo.toISOString().slice(0, 10);
  return data.hittingEvents.filter((event) => event.createdAt.slice(0, 10) >= cutoff).length
    + data.pitchEvents.filter((event) => event.createdAt.slice(0, 10) >= cutoff).length
    + data.defenseEvents.filter((event) => event.createdAt.slice(0, 10) >= cutoff).length
    + data.workoutSessions.filter((session) => session.date >= cutoff).length;
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: value >= 1000 ? 1 : 0 }).format(value);
}

function formatTime(value?: string) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function sortPlayersByRecent(players: Player[], recentIds: ID[]) {
  return players.slice().sort((a, b) => {
    const recentA = recentIds.indexOf(a.id);
    const recentB = recentIds.indexOf(b.id);
    if (recentA !== recentB) return (recentA === -1 ? 999 : recentA) - (recentB === -1 ? 999 : recentB);
    return a.jerseyNumber - b.jerseyNumber;
  });
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

function suggestTeamForFile(file: ParsedRosterFile, teams: TeamOption[], fallback?: TeamOption) {
  const haystack = `${file.fileName} ${file.detectedTeamName ?? ""}`.toLowerCase();
  const direct = teams.find((team) => haystack.includes(team.teamName.toLowerCase()));
  if (direct) return direct;
  if (haystack.includes("varsity")) return teams.find((team) => /varsity/i.test(team.teamName)) ?? fallback;
  if (/\bjv\b|junior varsity/.test(haystack)) return teams.find((team) => /\bjv\b|junior varsity/i.test(team.teamName)) ?? fallback;
  return fallback;
}

function teamLevelFromName(teamName: string) {
  const value = teamName.toLowerCase();
  if (value.includes("varsity")) return "Varsity";
  if (/\bjv\b|junior varsity/.test(value)) return "JV";
  const travel = value.match(/\b(1[3-9]u)\b/i);
  return travel ? travel[1].toUpperCase() : "";
}

function teamValue(team?: TeamOption) {
  return team ? `${team.teamId}:${team.seasonId ?? "all"}` : "";
}

function roleLabel(role?: string) {
  return (role ?? "STAFF")
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function profileDisplayName(context?: TeamContext) {
  const profile = context?.profile;
  return [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim() || profile?.displayName || profile?.email || "Coach";
}

function profileInitials(context?: TeamContext) {
  const profile = context?.profile;
  const base = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim() || profile?.displayName || profile?.email || "CO";
  return base
    .split(/\s|@/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
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

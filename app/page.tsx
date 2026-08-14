"use client";

import {
  BarChart3,
  Building2,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Copy,
  Download,
  Dumbbell,
  Edit3,
  Gauge,
  Handshake,
  Heart,
  Home,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Moon,
  MoreHorizontal,
  Plus,
  Pin,
  RefreshCw,
  Save,
  Search,
  Shield,
  Sparkles,
  Sun,
  Star,
  Swords,
  Trophy,
  Trash2,
  TrendingUp,
  Undo2,
  Upload,
  User,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { BaseballField, DonutChart, Heatmap, MetricBar, MiniLineChart, PlayerAvatar, StatTile, StrikeZone } from "./components/visuals";
import { createId, gameRepository, playerRepository, touchRecentPlayers, workoutRepository } from "./data/repository";
import { authRepository, PersistenceError, supabaseAppRepository, type AuthState } from "./data/supabaseRepository";
import { APP_NAME, APP_SECONDARY_TAGLINE, APP_TAGLINE, BRAND_ASSETS } from "./lib/branding";
import { cityOptionsForState, US_STATE_OPTIONS } from "./lib/locations";
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
  shortDate,
  trendByPractice,
} from "./lib/stats";
import { deriveConcurrentPracticeTotals, nextSessionSequence, touchSessionContributor } from "./lib/practiceConcurrency";
import {
  buildWeightRoomLeaderboard as buildScoredWeightRoomLeaderboard,
  estimatedOneRepMax,
  workoutEntryVolume,
  type WeightRoomWindow,
} from "./lib/weightRoom";
import type {
  AppData,
  AppProfile,
  BattedBallType,
  CountState,
  DefenseEvent,
  DefenseOutcome,
  DefenseStation,
  Direction,
  ExerciseKind,
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
  PracticeAttendance,
  PracticeAttendanceStatus,
  PracticeType,
  ProfileFollow,
  ProfileTeamPin,
  PublicDirectoryOrganizationSummary,
  PublicDirectoryTeamSummary,
  RosterStatus,
  ScheduleEvent,
  ScheduleEventStatus,
  ScheduleEventType,
  ScheduleEventVisibility,
  StaffAccessRole,
  StaffBaseballRole,
  StaffInvitation,
  StaffMember,
  StaffTeamMembership,
  TeamContext,
  TeamOption,
  WorkoutEntry,
  WorkoutSession,
  ZonePoint,
} from "./types";

type ViewKey = "home" | "organizations" | "teams" | "following" | "discover" | "teamHome" | "schedule" | "roster" | "practice" | "weights" | "games" | "analytics" | "profile" | "account";
type PracticeMode = "Hitting" | "Pitching" | "Defense" | "Live BP";
type PracticeTrackerPlayerFilter = "All" | "Pitchers" | "Hitters" | "Infield" | "Outfield";
type RosterFilter = "All" | RosterStatus;
type RosterSection = "Players" | "Staff";
type RosterPositionFilter = "All" | Position;
type RosterYearFilter = "All" | string;
type RosterSortKey = "number" | "player" | "pos" | "bt" | "class" | "height" | "weight" | "status";
type SortDirection = "asc" | "desc";
type ProfileTab = "overview" | "practice" | "games" | "pitching" | "hitting" | "defense" | "weights" | "notes";
type AnalyticsContext = "All" | "Practice" | "Game" | "Live BP" | "Weight Room";
type DateFilter = "Last Week" | "Last 30 Days" | "Fall";
type PracticeRosterPreset = "All" | "Varsity" | "JV" | "Custom";
type PracticeHubTab = "Overview" | "Drills" | "Throwing" | "Metrics" | "History";
type PracticeDrilldown = { kind: "hub" } | { kind: "attendance" };
type LiveBpOutcomeLabel = "K" | "BB" | "HBP" | "1B" | "2B" | "3B" | "HR" | "Out" | "Error" | "FC";
type AppIcon = React.ComponentType<{ size?: number | string; "aria-hidden"?: boolean | "true" | "false"; className?: string }>;
type WeightRoomTab = "Overview" | "Athletes" | "Exercises" | "Leaderboard" | "WorkoutSession";
type WeightRoomExerciseCategory = "Lower Body" | "Upper Body" | "Power" | "Core" | "Conditioning" | "Speed" | "Mobility" | "Other";
type WorkoutMeasurementType = "WEIGHT_REPS" | "BODYWEIGHT_REPS" | "TIME" | "DISTANCE" | "HEIGHT" | "COUNT" | "RPE_ONLY";
type WeightRoomExercise = {
  name: string;
  category: WeightRoomExerciseCategory;
  measurementType: WorkoutMeasurementType;
  kind: ExerciseKind;
  unit?: WorkoutEntry["unit"];
  equipment?: string;
  active: boolean;
  targetSets?: number;
  targetReps?: number;
};
type WeightRoomSetDraft = {
  playerId: ID;
  exercise: string;
  kind: ExerciseKind;
  date?: string;
  weight?: number;
  reps?: number;
  value?: number;
  unit?: WorkoutEntry["unit"];
  rpe?: number;
  status?: WorkoutEntry["status"];
  notes?: string;
};
type ScheduleViewMode = "Calendar" | "Week" | "Agenda";
type ScheduleSource = "practice" | "game" | "lift" | "event";
type ScheduleDateFieldMode = "desktop" | "native";
type TimePeriod = "AM" | "PM";
type ScheduleEventFilter = "All" | ScheduleEventType;
type PracticeSessionActivityMode = PracticeMode;

type PracticeActiveSessionRow = {
  id: ID;
  mode: PracticeSessionActivityMode;
  sessionId: ID;
  title: string;
  station?: string;
  primaryPlayerId: ID;
  secondaryPlayerId?: ID;
  playerLine: string;
  count: string;
  contributors: string[];
  isMine: boolean;
  startedAt: string;
};

type PracticeActivityFeedRow = {
  id: ID;
  mode: PracticeSessionActivityMode;
  time: string;
  title: string;
  detail: string;
};

interface ScheduleItem {
  id: ID;
  source: ScheduleSource;
  sourceId: ID;
  eventType: ScheduleEventType;
  title: string;
  startAt: string;
  endAt?: string;
  date: string;
  location?: string;
  notes?: string;
  visibility: ScheduleEventVisibility;
  status: ScheduleEventStatus;
  accent: string;
}

interface WeightRoomWorkoutSummary {
  date: string;
  title: string;
  location?: string;
  startAt?: string;
  athletes: number;
  sets: number;
  volume: number;
  completed: boolean;
}

const GLOBAL_NAV_ITEMS: Array<{ key: ViewKey; label: string; shortLabel: string; icon: AppIcon }> = [
  { key: "home", label: "Home", shortLabel: "Home", icon: Home },
  { key: "following", label: "Following", shortLabel: "Following", icon: Star },
  { key: "discover", label: "Discover", shortLabel: "Search", icon: Search },
  { key: "account", label: "Profile", shortLabel: "Profile", icon: User },
];
const TEAM_NAV_ITEMS: Array<{ key: ViewKey; label: string; shortLabel: string; icon: AppIcon }> = [
  { key: "teamHome", label: "Team Home", shortLabel: "Home", icon: Home },
  { key: "schedule", label: "Schedule", shortLabel: "Schedule", icon: ScheduleCalendarIcon },
  { key: "roster", label: "Roster", shortLabel: "Roster", icon: Users },
  { key: "practice", label: "Practice", shortLabel: "Practice", icon: ClipboardList },
  { key: "weights", label: "Weight Room", shortLabel: "Weights", icon: Dumbbell },
  { key: "games", label: "Games", shortLabel: "Games", icon: BaseballIcon },
  { key: "analytics", label: "Analytics", shortLabel: "Analytics", icon: BarChart3 },
];
const MOBILE_NAV_ITEMS: Array<{ key: ViewKey | "more"; label: string; shortLabel: string; icon: AppIcon }> = [
  { key: "home", label: "Home", shortLabel: "Home", icon: Home },
  { key: "following", label: "Following", shortLabel: "Following", icon: Star },
  { key: "discover", label: "Discover", shortLabel: "Search", icon: Search },
  { key: "more", label: "More", shortLabel: "More", icon: MoreHorizontal },
];
const TEAM_MOBILE_NAV_ITEMS: Array<{ key: ViewKey | "more"; label: string; shortLabel: string; icon: AppIcon }> = [
  { key: "teamHome", label: "Team Home", shortLabel: "Home", icon: Home },
  { key: "schedule", label: "Schedule", shortLabel: "Schedule", icon: ScheduleCalendarIcon },
  { key: "practice", label: "Practice", shortLabel: "Practice", icon: ClipboardList },
  { key: "games", label: "Games", shortLabel: "Games", icon: BaseballIcon },
  { key: "more", label: "More", shortLabel: "More", icon: MoreHorizontal },
];
const MORE_VIEWS: ViewKey[] = ["organizations", "roster", "weights", "analytics", "account"];
const TEAM_CONTEXT_VIEWS = new Set<ViewKey>(["teamHome", "schedule", "roster", "practice", "weights", "games", "analytics", "profile"]);
const CREATE_TEAM_VALUE = "__create_team__";
const ROUTABLE_VIEWS = new Set<ViewKey>([
  ...GLOBAL_NAV_ITEMS.map((item) => item.key),
  ...TEAM_NAV_ITEMS.map((item) => item.key),
  "organizations",
  "profile",
  "account",
]);

const ROSTER_STATUSES: RosterStatus[] = ["Varsity", "JV", "Undecided", "Cut"];
const ROSTER_FILTERS: RosterFilter[] = ["All", ...ROSTER_STATUSES];
const ROSTER_SECTIONS: RosterSection[] = ["Players", "Staff"];
const STAFF_BASEBALL_ROLES: StaffBaseballRole[] = [
  "Head Coach",
  "Assistant Coach",
  "Pitching Coach",
  "Hitting Coach",
  "Strength Coach",
  "Catching Coach",
  "Athletic Trainer",
  "Manager",
  "Volunteer",
  "Other",
];
const STAFF_ACCESS_ROLES: StaffAccessRole[] = ["ADMIN", "COACH"];
const POSITIONS: Position[] = ["P", "RHP", "LHP", "C", "1B", "2B", "3B", "SS", "INF", "LF", "CF", "RF", "OF", "UTIL", "DH"];
const SECONDARY_POSITIONS: Array<Position | ""> = ["", ...POSITIONS];
const PRACTICE_TYPES: PracticeType[] = ["Team Practice", "Hitting", "Pitching", "Defense", "Live BP", "Scrimmage", "Bullpen Day", "Full Practice", "Hitting Day", "Pitcher Development", "Hitter Development", "Custom"];
const ATTENDANCE_STATUSES: PracticeAttendanceStatus[] = ["Present", "Absent", "Excused", "Late"];
const ATTENDANCE_STATUS_KEY: Array<{ status: PracticeAttendanceStatus; short: string; className: string }> = [
  { status: "Present", short: "P", className: "present" },
  { status: "Late", short: "L", className: "late" },
  { status: "Absent", short: "A", className: "absent" },
  { status: "Excused", short: "E", className: "excused" },
];
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
const HITTING_STATIONS: HittingSession["type"][] = ["Tee", "Front Toss", "Hack Attack - FB", "Hack Attack - CB", "Coach BP", "Live BP", "Other"];
const PITCHING_STATIONS: PitchingSession["type"][] = ["Bullpen", "Flat Ground", "Live", "Other"];
const DEFENSE_STATIONS: DefenseStation[] = ["Infield", "Outfield", "Catching", "PFP", "Situational defense", "Team defense"];
const GAME_TYPES: GameType[] = ["Fall Game", "Scrimmage", "Showcase", "Regular Season", "Tournament", "Other"];
const SCHEDULE_EVENT_TYPES: ScheduleEventType[] = ["Game", "Practice", "Lift", "Scrimmage", "Tournament", "Other"];
const SCHEDULE_EVENT_ACCENTS: Record<ScheduleEventType, string> = {
  Game: "game",
  Practice: "practice",
  Lift: "lift",
  Scrimmage: "scrimmage",
  Meeting: "meeting",
  "Team Event": "team-event",
  Tournament: "tournament",
  Other: "other",
};
const SCHEDULE_HOME_AWAY_OPTIONS: Game["homeAway"][] = ["TBD", "Home", "Away", "Neutral"];
const GAME_PITCH_BUTTONS: GamePitchOutcome[] = ["Ball", "Called Strike", "Swinging Strike", "Foul", "In Play"];
const BIP_OUTCOMES: GameBallInPlayOutcome[] = ["Single", "Double", "Triple", "Home Run", "Ground Out", "Fly Out", "Line Out", "Pop Out", "Error", "Fielder's Choice", "Sac Fly", "Sac Bunt"];
const LIVE_BP_OUTCOMES: LiveBpOutcomeLabel[] = ["K", "BB", "HBP", "1B", "2B", "3B", "HR", "Out", "Error", "FC"];
const EXERCISES = ["Back Squat", "Front Squat", "Bench Press", "Incline Bench", "Deadlift", "Trap Bar Deadlift", "Power Clean", "Hang Clean", "Push Press", "Pull Ups", "DB Bench", "Bulgarian Split Squat", "Sprint", "Broad Jump", "Vertical Jump"];
const WEIGHT_ROOM_TABS: WeightRoomTab[] = ["Overview", "Athletes", "Exercises", "Leaderboard"];
const WEIGHT_ROOM_BASE_EXERCISES: WeightRoomExercise[] = [
  { name: "Back Squat", category: "Lower Body", measurementType: "WEIGHT_REPS", kind: "Lift", unit: "lb", equipment: "Barbell", active: true, targetSets: 4, targetReps: 6 },
  { name: "Romanian Deadlift", category: "Lower Body", measurementType: "WEIGHT_REPS", kind: "Lift", unit: "lb", equipment: "Barbell", active: true, targetSets: 3, targetReps: 8 },
  { name: "Bench Press", category: "Upper Body", measurementType: "WEIGHT_REPS", kind: "Lift", unit: "lb", equipment: "Barbell", active: true, targetSets: 4, targetReps: 6 },
  { name: "DB Row", category: "Upper Body", measurementType: "WEIGHT_REPS", kind: "Lift", unit: "lb", equipment: "Dumbbells", active: true, targetSets: 3, targetReps: 10 },
  { name: "Power Clean", category: "Power", measurementType: "WEIGHT_REPS", kind: "Lift", unit: "lb", equipment: "Barbell", active: true, targetSets: 4, targetReps: 3 },
  { name: "Plank", category: "Core", measurementType: "TIME", kind: "Test", unit: "sec", equipment: "Bodyweight", active: true, targetSets: 3 },
  { name: "Sprint", category: "Speed", measurementType: "TIME", kind: "Speed", unit: "sec", equipment: "Track", active: true, targetSets: 4 },
  { name: "Broad Jump", category: "Power", measurementType: "DISTANCE", kind: "Jump", unit: "in", equipment: "Bodyweight", active: true, targetSets: 3 },
];
const WEIGHT_ROOM_TEMPLATES = [
  { name: "Lower Body Strength", exercises: ["Back Squat", "Romanian Deadlift", "Bulgarian Split Squat", "Trap Bar Deadlift", "Plank"] },
  { name: "Upper Body Strength", exercises: ["Bench Press", "Incline Bench", "DB Row", "Pull Ups", "Plank"] },
  { name: "Full Body Power", exercises: ["Power Clean", "Front Squat", "Bench Press", "Broad Jump", "Sprint"] },
  { name: "Conditioning", exercises: ["Sprint", "Plank"] },
];
const WEIGHT_ROOM_LEADER_WINDOWS = ["This Week", "This Month", "This Season"] as const;
const PITCH_MIX_COLORS = ["#9f244c", "#43c6ac", "#8b96a5", "#38bdf8", "#f97316", "#a78bfa", "#e2e8f0", "#22c55e"];
const ROSTER_CSV_TEMPLATE = [
  "First Name,Last Name,Jersey Number,Graduation Year,Primary Position,Secondary Position,Bats,Throws,Team,Roster Status",
  "Jackson,Smith,12,2027,SS,P,R,R,Metrolina Varsity,Varsity",
  "Mason,Lee,17,2026,P,1B,R,R,Metrolina Varsity,Varsity",
].join("\n");
const TEAM_TYPE_OPTIONS = ["School", "Travel", "Club", "Other"];
const SCHOOL_LEVEL_OPTIONS = ["Varsity", "JV", "Freshman", "Other"];
const AGE_GROUP_OPTIONS = ["18+", "18U", "17U", "16U", "15U", "14U", "13U", "12U", "11U", "10U", "9U", "8U", "7U", "6U", "Other"];
const SEASON_OPTIONS = buildSeasonOptions();

function slugifyFilePart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "current-season";
}

function currentRosterYear() {
  return new Date().getFullYear();
}

function buildSeasonOptions() {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentSeason = currentMonth <= 5 ? "Spring" : currentMonth <= 8 ? "Summer" : "Fall";
  const seasonOrder = ["Spring", "Summer", "Fall"];
  const seasons: string[] = [];
  for (let year = currentYear; year <= currentYear + 2; year += 1) {
    for (const season of seasonOrder) {
      if (year === currentYear && seasonOrder.indexOf(season) < seasonOrder.indexOf(currentSeason)) continue;
      seasons.push(`${season} ${year}`);
    }
  }
  return seasons;
}

function levelOptionsForTeamType(teamType: string) {
  return teamType === "School" ? SCHOOL_LEVEL_OPTIONS : AGE_GROUP_OPTIONS;
}

function defaultLevelForTeamType(teamType: string) {
  return teamType === "School" ? "Varsity" : "18U";
}

type SvgIconProps = React.SVGProps<SVGSVGElement> & { size?: number | string };

function BaseballIcon(props: SvgIconProps) {
  // eslint-disable-next-line react/prop-types
  const { size = 18, className, ...svgProps } = props;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...svgProps}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M7.5 4.5c2.2 2.2 3.4 4.7 3.4 7.5s-1.2 5.3-3.4 7.5" />
      <path d="M16.5 4.5c-2.2 2.2-3.4 4.7-3.4 7.5s1.2 5.3 3.4 7.5" />
      <path d="M8.2 7.8h2.1M8.8 10.2h2.1M8.8 13.8h2.1M8.2 16.2h2.1" />
      <path d="M13.7 7.8h2.1M13.1 10.2h2.1M13.1 13.8h2.1M13.7 16.2h2.1" />
    </svg>
  );
}

function ScheduleCalendarIcon(props: SvgIconProps) {
  // eslint-disable-next-line react/prop-types
  const { size = 18, className, ...svgProps } = props;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...svgProps}
    >
      <rect x="4" y="5" width="16" height="15" rx="3" />
      <path d="M8 3.5v4M16 3.5v4M4.5 9.5h15" />
      <path d="M8 13h2M13 13h3M8 16h2M13 16h3" />
    </svg>
  );
}

function rosterFileSignature(file: File) {
  return `${file.name.toLowerCase()}::${file.size}::${file.lastModified}`;
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
  const [rosterSection, setRosterSection] = useState<RosterSection>("Players");
  const [profileTab, setProfileTab] = useState<ProfileTab>("overview");
  const [practiceTrackingOpen, setPracticeTrackingOpen] = useState(false);
  const [practiceHubTab, setPracticeHubTab] = useState<PracticeHubTab>("Overview");
  const [practiceDrilldown, setPracticeDrilldown] = useState<PracticeDrilldown>({ kind: "hub" });
  const [practiceMode, setPracticeMode] = useState<PracticeMode>("Hitting");
  const [practicePlayerId, setPracticePlayerId] = useState<ID>("p-jackson-smith");
  const [hittingStation, setHittingStation] = useState<HittingSession["type"]>("Hack Attack - FB");
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
  const [weightRoomTab, setWeightRoomTab] = useState<WeightRoomTab>("Overview");
  const [weightRoomWorkoutDate, setWeightRoomWorkoutDate] = useState(todayKey());
  const [weightRoomWorkoutTitle, setWeightRoomWorkoutTitle] = useState("Lower Body Strength");
  const [weightRoomWorkoutStatus, setWeightRoomWorkoutStatus] = useState<"Idle" | "In Progress" | "Completed">("Idle");
  const [weightRoomActiveEventId, setWeightRoomActiveEventId] = useState<ID | undefined>();
  const [weightRoomActiveExercise, setWeightRoomActiveExercise] = useState("Back Squat");
  const [weightRoomSetForm, setWeightRoomSetForm] = useState({ weight: "225", reps: "6", rpe: "8", value: "" });
  const [weightRoomWeighInOpen, setWeightRoomWeighInOpen] = useState(false);
  const [startPracticeOpen, setStartPracticeOpen] = useState(false);
  const [startGameOpen, setStartGameOpen] = useState(false);
  const [scheduleEventOpen, setScheduleEventOpen] = useState(false);
  const [scheduleEventInitialDate, setScheduleEventInitialDate] = useState<string | undefined>();
  const [playerEditorOpen, setPlayerEditorOpen] = useState(false);
  const [rosterImportOpen, setRosterImportOpen] = useState(false);
  const [staffInviteOpen, setStaffInviteOpen] = useState(false);
  const [teamCreatorOpen, setTeamCreatorOpen] = useState(false);
  const [teamCreatorOrganizationId, setTeamCreatorOrganizationId] = useState<ID | undefined>();
  const [teamCreatorMode, setTeamCreatorMode] = useState<"existing" | "new" | "organization">("existing");
  const [staffActionMessage, setStaffActionMessage] = useState("");
  const [topAccountMenuOpen, setTopAccountMenuOpen] = useState(false);
  const [sidebarAccountMenuOpen, setSidebarAccountMenuOpen] = useState(false);
  const lastGlobalRefreshRef = useRef(0);
  const searchInTeamContext = TEAM_CONTEXT_VIEWS.has(view);

  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<ID | undefined>();
  const [sessionSummary, setSessionSummary] = useState<{ type: "Hitting" | "Pitching" | "Defense"; sessionId: ID } | null>(null);
  const [practiceSummaryOpen, setPracticeSummaryOpen] = useState(false);
  const [summaryNote, setSummaryNote] = useState("");
  const [analyticsContext, setAnalyticsContext] = useState<AnalyticsContext>("All");
  const [dateFilter, setDateFilter] = useState<DateFilter>("Fall");

  function navigateToView(nextView: ViewKey, options: { replace?: boolean; playerId?: ID } = {}) {
    setView(nextView);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (nextView === "home") url.searchParams.delete("view");
    else url.searchParams.set("view", nextView);
    if (options.playerId) url.searchParams.set("player", options.playerId);
    else if (nextView !== "profile") url.searchParams.delete("player");
    if (!TEAM_CONTEXT_VIEWS.has(nextView)) {
      url.searchParams.delete("team");
      url.searchParams.delete("season");
    }
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl === currentUrl) return;
    const method = options.replace ? "replaceState" : "pushState";
    window.history[method]({}, "", nextUrl);
  }

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

  useEffect(() => {
    if (!hydrated || !data) return;
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const requestedView = params.get("view") as ViewKey | null;
      const nextView = requestedView && ROUTABLE_VIEWS.has(requestedView) ? requestedView : "home";
      setView(nextView);
      const requestedPlayer = params.get("player");
      if (requestedPlayer && data.players.some((player) => player.id === requestedPlayer)) {
        setSelectedPlayerId(requestedPlayer);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [data, hydrated]);

  useEffect(() => {
    if (authState.status !== "authenticated") return;

    const refreshOnReturn = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      if (searchInTeamContext) return;
      void refreshGlobalData();
    };

    window.addEventListener("focus", refreshOnReturn);
    window.addEventListener("pageshow", refreshOnReturn);
    document.addEventListener("visibilitychange", refreshOnReturn);

    return () => {
      window.removeEventListener("focus", refreshOnReturn);
      window.removeEventListener("pageshow", refreshOnReturn);
      document.removeEventListener("visibilitychange", refreshOnReturn);
    };
  // Keep the listener tied to the current global/team context without re-registering on every data refresh.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState.status, searchInTeamContext, data?.teamContext?.currentTeam?.teamId, data?.teamContext?.currentTeam?.seasonId]);

  const practice = data ? activePractice(data) : undefined;
  const selectedPlayer = data?.players.find((player) => player.id === selectedPlayerId) ?? data?.players[0];
  const practicePlayer = data?.players.find((player) => player.id === practicePlayerId) ?? selectedPlayer;
  const currentGame = data?.games.find((game) => game.id === selectedGameId) ?? data?.games[0];
  const rosterPlayers = uniquePlayers(data?.players.filter((player) => !player.archived) ?? []);

  const globalResults = useMemo<GlobalSearchResults>(() => {
    const empty: GlobalSearchResults = { organizations: [], publicOrganizations: [], teams: [], publicTeams: [], players: [] };
    if (!data || !globalQuery.trim()) return empty;
    const needle = globalQuery.trim().toLowerCase();
    if (searchInTeamContext) {
      return {
        ...empty,
        players: uniquePlayers(data.players)
          .filter((player) => !player.archived)
          .filter((player) => `${player.name} ${player.jerseyNumber} ${player.primaryPosition}`.toLowerCase().includes(needle))
          .slice(0, 6),
      };
    }

    const teams = displayWorkspaceTeams(data.teamContext?.availableTeams ?? []);
    const organizations = organizationSummariesFromContext(data.teamContext).filter((organization) =>
      `${organization.name} ${organization.location ?? ""} ${organization.teams.map((team) => `${team.teamName} ${team.teamLevel ?? ""} ${team.seasonName ?? ""}`).join(" ")}`.toLowerCase().includes(needle),
    );
    const matchingTeams = teams.filter((team) =>
      `${team.organizationName} ${team.teamName} ${team.teamLevel ?? ""} ${team.seasonName ?? ""} ${team.title ?? ""}`.toLowerCase().includes(needle),
    );
    const publicOrganizations = (data.publicOrganizations ?? []).filter((organization) =>
      publicOrganizationSearchText(organization).includes(needle),
    );
    const publicTeams = (data.publicTeams ?? []).filter((team) => publicTeamSearchText(team).includes(needle));

    return {
      organizations: organizations.slice(0, 4),
      publicOrganizations: publicOrganizations.slice(0, 4),
      teams: matchingTeams.slice(0, 6),
      publicTeams: publicTeams.slice(0, 6),
      players: [],
    };
  }, [data, globalQuery, searchInTeamContext]);

  const activeTotals = useMemo(() => {
    if (!data || !practice) return { pitches: 0, swings: 0, defenseReps: 0, defenders: 0, players: 0, pitchers: 0, hitters: 0 };
    const pitching = data.pitchingSessions.filter((session) => session.practiceId === practice.id);
    const hitting = data.hittingSessions.filter((session) => session.practiceId === practice.id);
    const defense = data.defenseSessions.filter((session) => session.practiceId === practice.id);
    const totals = deriveConcurrentPracticeTotals(data, practice.id);
    return {
      pitches: totals.pitches,
      swings: totals.swings,
      defenseReps: totals.defense,
      defenders: new Set(defense.map((session) => session.playerId)).size,
      players: practice.playerIds.length,
      pitchers: new Set(pitching.map((session) => session.pitcherId)).size || practice.pitcherIds.length,
      hitters: new Set(hitting.map((session) => session.hitterId)).size || practice.hitterIds.length,
    };
  }, [data, practice]);

  const weeklyMvp = useMemo(() => (data ? buildWeeklyMvp(data) : undefined), [data]);
  const weightLeader = useMemo(() => (data ? buildWeightLeader(data) : undefined), [data]);
  const pinnedTeams = useMemo(
    () => (data ? pinnedTeamsFromContext(data.teamContext, data.profileTeamPins) : []),
    [data],
  );

  async function loadApplicationData(
    isCancelled: () => boolean = () => false,
    selectedTeamId?: ID,
    selectedSeasonId?: ID,
    options: { silent?: boolean } = {},
  ) {
    if (!options.silent) setHydrated(false);
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
      const params = new URLSearchParams(window.location.search);
      const requestedTeam = params.get("team") ?? selectedTeamId;
      const requestedSeason = params.get("season") ?? selectedSeasonId;
      const loaded = await supabaseAppRepository.load(requestedTeam ?? undefined, requestedSeason ?? undefined);
      if (isCancelled()) return;
      const requestedView = params.get("view") as ViewKey | null;
      const requestedPlayer = params.get("player");

      setData(loaded);
      setHydrated(true);
      document.documentElement.dataset.theme = loaded.settings.theme;

      const active = activePractice(loaded);
      const firstPlayer = loaded.settings.recentPlayerIds[0] ?? active?.playerIds[0] ?? loaded.players[0]?.id ?? "";
      const firstGame = loaded.games.find((game) => !game.result)?.id ?? loaded.games[0]?.id ?? "";

      if (!options.silent) {
        setSelectedPlayerId(requestedPlayer && loaded.players.some((player) => player.id === requestedPlayer) ? requestedPlayer : firstPlayer);
        setPracticePlayerId(firstPlayer);
        setSelectedWeightPlayerId(firstPlayer);
        setSelectedGameId(firstGame);
        setLiveBpPitcherId(loaded.players.find((player) => player.isPitcher && !player.archived)?.id ?? firstPlayer);
        setLiveBpHitterId(loaded.players.find((player) => player.isHitter && !player.archived && player.id !== firstPlayer)?.id ?? firstPlayer);

        if (requestedView && [...GLOBAL_NAV_ITEMS.map((item) => item.key), ...TEAM_NAV_ITEMS.map((item) => item.key), "profile", "account"].includes(requestedView)) {
          setView(requestedView);
        }
      }
    } catch (error) {
      if (isCancelled()) return;
      setLoadError(error instanceof Error ? error : new Error(`Unable to load ${APP_NAME} data.`));
      if (!options.silent) setData(null);
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
      setSaveError(error instanceof Error ? error.message : "Unable to save.");
    }
  }

  function openPlayer(playerId: ID) {
    commit((current) => touchRecentPlayers(current, playerId));
    setSelectedPlayerId(playerId);
    setPracticePlayerId(playerId);
    setSelectedWeightPlayerId(playerId);
    setProfileTab("overview");
    setGlobalQuery("");
    navigateToView("profile", { playerId });
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
    if (!practice || !data) {
      setPracticeDrilldown({ kind: "hub" });
      setPracticeTrackingOpen(false);
      setStartPracticeOpen(true);
      return;
    }
    const availablePlayers = availablePracticePlayers(data, practice);
    const nextPlayer =
      mode === "Pitching"
        ? availablePlayers.find((player) => player.isPitcher)
        : mode === "Hitting"
          ? availablePlayers.find((player) => player.isHitter)
          : mode === "Live BP"
            ? availablePlayers.find((player) => player.isPitcher)
            : availablePlayers[0];
    if (nextPlayer) {
      setPracticePlayerId(nextPlayer.id);
      setSelectedPlayerId(nextPlayer.id);
      if (mode === "Live BP") {
        const nextHitter = availablePlayers.find((player) => player.isHitter && player.id !== nextPlayer.id);
        setPitchingStation("Live BP");
        setHittingStation("Live BP");
        setLiveBpPitcherId(nextPlayer.id);
        if (nextHitter) setLiveBpHitterId(nextHitter.id);
      }
    }
    setPracticeDrilldown({ kind: "hub" });
    setPracticeTrackingOpen(true);
  }

  function resumePracticeSession(session: PracticeActiveSessionRow) {
    setPracticeMode(session.mode);
    setPracticePlayerId(session.primaryPlayerId);
    setSelectedPlayerId(session.primaryPlayerId);
    if (session.mode === "Hitting") setHittingStation(normalizeHittingStation(session.station));
    if (session.mode === "Pitching") setPitchingStation((session.station as PitchingSession["type"]) || "Bullpen");
    if (session.mode === "Defense") setDefenseStation((session.station as DefenseStation) || "Infield");
    if (session.mode === "Live BP") {
      setPitchingStation("Live BP");
      setHittingStation("Live BP");
      setLiveBpPitcherId(session.primaryPlayerId);
      if (session.secondaryPlayerId) setLiveBpHitterId(session.secondaryPlayerId);
    }
    setPracticeDrilldown({ kind: "hub" });
    setPracticeTrackingOpen(true);
    if (!practice) return;
    commit((current) => {
      const profileId = current.teamContext?.profile?.id;
      if (session.mode === "Hitting") return ensureHittingSession(current, practice, session.primaryPlayerId, normalizeHittingStation(session.station), profileId).data;
      if (session.mode === "Pitching") return ensurePitchingSession(current, practice, session.primaryPlayerId, (session.station as PitchingSession["type"]) || "Bullpen", profileId).data;
      if (session.mode === "Defense") return ensureDefenseSession(current, practice, session.primaryPlayerId, (session.station as DefenseStation) || "Infield", profileId).data;
      const pitchingNext = ensurePitchingSession(current, practice, session.primaryPlayerId, "Live BP", profileId, session.secondaryPlayerId);
      if (!session.secondaryPlayerId) return pitchingNext.data;
      return ensureHittingSession(pitchingNext.data, practice, session.secondaryPlayerId, "Live BP", profileId).data;
    });
  }

  function updatePracticeAttendance(playerId: ID, status: PracticeAttendanceStatus) {
    if (!practice || !data) return;
    const player = data.players.find((item) => item.id === playerId);
    if (!player) return;
    commit((current) => {
      const now = new Date().toISOString();
      const existing = current.attendance.find((item) => item.practiceId === practice.id && item.playerId === playerId);
      const nextRow: PracticeAttendance = {
        id: existing?.id ?? createId("att"),
        practiceId: practice.id,
        playerId,
        role: existing?.role ?? (player.isPitcher && player.isHitter ? "Two-way" : player.isPitcher ? "Pitcher" : player.isHitter ? "Hitter" : "Observer"),
        status,
        checkedInAt: existing?.checkedInAt ?? practice.startedAt,
        updatedByProfileId: current.teamContext?.profile?.id,
        updatedAt: now,
      };
      return {
        ...current,
        attendance: existing
          ? current.attendance.map((item) => (item.id === existing.id ? nextRow : item))
          : [nextRow, ...current.attendance],
      };
    });
  }

  function markPracticeRosterPresent() {
    if (!practice || !data) return;
    const roster = data.players.filter((player) => !player.archived && practice.playerIds.includes(player.id));
    commit((current) => {
      const now = new Date().toISOString();
      const rows = new Map(current.attendance.filter((item) => item.practiceId === practice.id).map((item) => [item.playerId, item]));
      const nextAttendance = current.attendance.filter((item) => item.practiceId !== practice.id);
      const updatedRows = roster.map((player) => {
        const existing = rows.get(player.id);
        return {
          id: existing?.id ?? createId("att"),
          practiceId: practice.id,
          playerId: player.id,
          role: existing?.role ?? (player.isPitcher && player.isHitter ? "Two-way" : player.isPitcher ? "Pitcher" : player.isHitter ? "Hitter" : "Observer"),
          status: "Present" as PracticeAttendanceStatus,
          checkedInAt: existing?.checkedInAt ?? practice.startedAt,
          updatedByProfileId: current.teamContext?.profile?.id,
          updatedAt: now,
        };
      });
      return { ...current, attendance: [...updatedRows, ...nextAttendance] };
    });
  }

  function importRosterPlan(plan: RosterImportPlan) {
    commit((current) => applyRosterImportPlan(current, plan).data);
  }

  async function createTeamForImport(input: {
    organizationId?: string;
    organizationName?: string;
    organizationCity?: string;
    organizationState?: string;
    organizationLogoUrl?: string;
    organizationVisibility?: string;
    city?: string;
    state?: string;
    teamCity?: string;
    teamState?: string;
    teamName: string;
    teamLevel?: string;
    teamType?: string;
    ageGroup?: string;
    logoUrl?: string;
    visibility?: string;
    seasonName: string;
  }) {
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
          organizations: context?.organizations ?? [],
          availableTeams: [
            team,
            ...availableTeams.filter((item) => item.teamId !== team.teamId || item.seasonId !== team.seasonId),
          ],
        },
      };
    });
    return team;
  }

  async function createOrganization(input: { organizationName: string; city?: string; state?: string; logoUrl?: string; visibility?: string }) {
    const organization = await supabaseAppRepository.createOrganization(input);
    setData((current) => {
      if (!current) return current;
      const context = current.teamContext;
      const organizations = context?.organizations ?? [];
      return {
        ...current,
        teamContext: {
          profile: context?.profile,
          currentTeam: context?.currentTeam,
          availableTeams: context?.availableTeams ?? [],
          organizations: [
            organization,
            ...organizations.filter((item) => item.id !== organization.id),
          ],
        },
      };
    });
    return organization;
  }

  function openTeamCreator(organizationId?: ID, mode: "existing" | "new" | "organization" = organizationId ? "existing" : "existing") {
    setTeamCreatorOrganizationId(organizationId);
    setTeamCreatorMode(mode);
    setTeamCreatorOpen(true);
  }

  async function reloadCurrentTeam() {
    const current = data?.teamContext?.currentTeam;
    await loadApplicationData(() => false, current?.teamId, current?.seasonId);
  }

  async function refreshGlobalData() {
    const now = Date.now();
    if (now - lastGlobalRefreshRef.current < 900) return;
    lastGlobalRefreshRef.current = now;
    const current = data?.teamContext?.currentTeam;
    await loadApplicationData(() => false, current?.teamId, current?.seasonId, { silent: true });
  }

  async function inviteStaff(input: {
    email: string;
    firstName?: string;
    lastName?: string;
    staffRole: StaffBaseballRole;
    accessRole: StaffAccessRole;
    teams: Array<{ teamId: string; seasonId?: string }>;
  }) {
    const result = await supabaseAppRepository.inviteStaff(input);
    await reloadCurrentTeam();
    return result;
  }

  async function copyStaffInviteLink(invitationId: string) {
    setStaffActionMessage("");
    const link = await supabaseAppRepository.copyStaffInviteLink(invitationId);
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      window.prompt("Copy invite link", link);
    }
    await reloadCurrentTeam();
    setStaffActionMessage("Invite link copied.");
    return link;
  }

  async function resendStaffInvitation(invitationId: string) {
    setStaffActionMessage("");
    const result = await supabaseAppRepository.resendStaffInvitation(invitationId);
    await reloadCurrentTeam();
    setStaffActionMessage(result.email?.sent ? "Invite resent." : result.email?.message ?? "Invite link refreshed. Copy the link if email is not configured.");
    return result;
  }

  async function revokeStaffInvitation(invitationId: string) {
    setStaffActionMessage("");
    await supabaseAppRepository.revokeStaffInvitation(invitationId);
    await reloadCurrentTeam();
    setStaffActionMessage("Invite revoked.");
  }

  async function updateStaffMember(input: StaffMemberUpdateInput) {
    setStaffActionMessage("");
    await supabaseAppRepository.updateStaffMember(input);
    await reloadCurrentTeam();
    setStaffActionMessage("Staff updated.");
  }

  async function saveAccountProfile(input: { firstName?: string; lastName?: string; displayName?: string; avatarUrl?: string }) {
    const profile = await authRepository.updateProfile(input);
    const nextProfile = {
      ...profile,
      firstName: profile.firstName ?? input.firstName,
      lastName: profile.lastName ?? input.lastName,
      displayName: profile.displayName ?? input.displayName,
      avatarUrl: profile.avatarUrl ?? input.avatarUrl,
    };
    setData((current) => {
      if (!current?.teamContext) return current;
      return {
        ...current,
        teamContext: {
          ...current.teamContext,
          profile: nextProfile,
        },
        staffMembers: (current.staffMembers ?? []).map((member) =>
          member.profileId === nextProfile.id
            ? {
                ...member,
                firstName: nextProfile.firstName,
                lastName: nextProfile.lastName,
                displayName: nextProfile.displayName ?? nextProfile.email ?? member.displayName,
                avatarUrl: nextProfile.avatarUrl,
                updatedAt: new Date().toISOString(),
              }
            : member,
        ),
      };
    });
    setSaveStatus("saved");
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
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("team", team.teamId);
      if (team.seasonId) url.searchParams.set("season", team.seasonId);
      else url.searchParams.delete("season");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
    navigateToView("teamHome");
  }

  async function enterTeam(team: TeamOption) {
    await switchTeam(team);
  }

  function returnToClubhouseHome() {
    setTopAccountMenuOpen(false);
    setSidebarAccountMenuOpen(false);
    navigateToView("home");
    void refreshGlobalData();
  }

  function goToView(nextView: ViewKey) {
    navigateToView(nextView);
    if ([...GLOBAL_NAV_ITEMS.map((item) => item.key), "organizations", "following", "discover"].includes(nextView)) {
      void refreshGlobalData();
    }
  }

  function openPublicOrganization(organization: PublicDirectoryOrganizationSummary) {
    setGlobalQuery("");
    window.location.href = `/org/${organization.slug ?? organization.id}`;
  }

  function openManagedOrganization(organization: OrganizationSummary) {
    setGlobalQuery("");
    window.location.href = `/org/${organization.slug ?? organization.id}`;
  }

  function openOrganizationManagement(organization: OrganizationSummary) {
    setGlobalQuery("");
    window.location.href = `/org/${organization.slug ?? organization.id}/manage`;
  }

  function openPublicTeam(team: PublicDirectoryTeamSummary) {
    setGlobalQuery("");
    window.location.href = `/team/${team.id}`;
  }

  async function togglePublicTeamFollow(team: PublicDirectoryTeamSummary) {
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const followed = isFollowingTeam(data?.profileFollows ?? [], team.id);
      const follow = !followed;
      const followResult = await supabaseAppRepository.toggleFollow({ teamId: team.id, follow });
      setData((current) => {
        if (!current) return current;
        const remaining = (current.profileFollows ?? []).filter((item) => item.teamId !== team.id);
        return {
          ...current,
          profileFollows: follow && followResult ? [followResult, ...remaining] : remaining,
        };
      });
      setSaveStatus("saved");
    } catch (error) {
      setSaveStatus("error");
      setSaveError(error instanceof Error ? error.message : "Unable to update follow.");
    }
  }

  async function togglePublicOrganizationFollow(organization: PublicDirectoryOrganizationSummary) {
    const followed = isFollowingOrganization(data?.profileFollows ?? [], organization.id);
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const follow = !followed;
      const result = await supabaseAppRepository.toggleFollow({ organizationId: organization.id, follow });
      setData((current) => {
        if (!current) return current;
        const remaining = (current.profileFollows ?? []).filter((item) => item.organizationId !== organization.id);
        return {
          ...current,
          profileFollows: follow && result ? [result, ...remaining] : remaining,
        };
      });
      setSaveStatus("saved");
    } catch (error) {
      setSaveStatus("error");
      setSaveError(error instanceof Error ? error.message : "Unable to update follow.");
    }
  }

  async function toggleTeamPin(team: TeamOption, options: { forceUnpin?: boolean } = {}) {
    const pinned = isPinnedTeam(data?.profileTeamPins, team);
    const shouldPin = options.forceUnpin ? false : !pinned;
    if (!shouldPin && !pinned) return;
    if (shouldPin && pinnedTeamsFromContext(data?.teamContext, data?.profileTeamPins).length >= 3) {
      setSaveStatus("error");
      setSaveError("You can pin up to 3 teams.");
      return;
    }

    setSaveStatus("saving");
    setSaveError(null);
    try {
      const result = await supabaseAppRepository.toggleTeamPin({ teamId: team.teamId, seasonId: team.seasonId, pin: shouldPin });
      setData((current) => {
        if (!current) return current;
        const remaining = (current.profileTeamPins ?? []).filter((pin) => !profileTeamPinMatchesTeam(pin, team));
        return {
          ...current,
          profileTeamPins: shouldPin && result ? [result, ...remaining] : remaining,
        };
      });
      setSaveStatus("saved");
    } catch (error) {
      setSaveStatus("error");
      setSaveError(error instanceof Error ? error.message : "Unable to update pinned team.");
    }
  }

  async function signOut() {
    setTopAccountMenuOpen(false);
    setSidebarAccountMenuOpen(false);
    await authRepository.signOut();
    setData(null);
    setAuthState({ status: "anonymous" });
    navigateToView("home", { replace: true });
  }

  function logHitting(action: HittingEvent["action"], contactResult?: BattedBallType, contactQuality?: HittingContactQuality, direction: Direction = hitDirection) {
    if (!practice || !practicePlayer) return;
    commit((current) => {
      const profileId = current.teamContext?.profile?.id;
      const next = ensureHittingSession(current, practice, practicePlayer.id, hittingStation, profileId);
      const session = next.session;
      const eventNumber = next.data.hittingEvents.filter((event) => event.sessionId === session.id).length + 1;
      const isBip = action === "Ball in play";
      const eventId = createId("he");
      const createdAt = new Date().toISOString();
      const event: HittingEvent = {
        id: eventId,
        practiceId: practice.id,
        sessionId: session.id,
        hitterId: practicePlayer.id,
        eventNumber,
        action,
        contactResult: isBip ? contactResult : undefined,
        contactQuality: isBip ? contactQuality : undefined,
        direction: isBip ? direction : undefined,
        fieldLocation: isBip ? fieldLocation : undefined,
        pitchType: isMachineHittingStation(hittingStation) || hittingStation === "Live BP" ? selectedPitchType : undefined,
        velocity: isMachineHittingStation(hittingStation) && velocity ? Number(velocity) : undefined,
        isLiveBp: hittingStation === "Live BP",
        createdAt,
        createdByProfileId: profileId,
        entrySource: "COACH",
        verificationStatus: "COACH_RECORDED",
        idempotencyKey: eventId,
        sessionSequence: nextSessionSequence(next.data.hittingEvents, session.id),
      };
      return touchRecentPlayers({ ...next.data, hittingEvents: [event, ...next.data.hittingEvents] }, practicePlayer.id);
    });
  }

  function logPitch(outcome: PitchOutcome, battedBall?: BattedBallType) {
    if (!practice || !practicePlayer) return;
    commit((current) => {
      const profileId = current.teamContext?.profile?.id;
      const next = ensurePitchingSession(current, practice, practicePlayer.id, pitchingStation, profileId);
      const session = next.session;
      const sessionEvents = next.data.pitchEvents.filter((event) => event.sessionId === session.id);
      const last = sessionEvents[0];
      const isBip = outcome === "Ball in play";
      const isSwing = ["Swing", "Whiff", "Foul", "Ball in play"].includes(outcome);
      const isStrike = outcome !== "Ball" && outcome !== "HBP";
      const isZone = pitchLocation ? pitchLocation.x >= 0.22 && pitchLocation.x <= 0.78 && pitchLocation.y >= 0.18 && pitchLocation.y <= 0.82 : false;
      const countBefore = last?.countAfter ?? { balls: 0, strikes: 0 };
      const countAfter = nextCount(countBefore, outcome);
      const eventId = createId("pe");
      const createdAt = new Date().toISOString();
      const event: PitchEvent = {
        id: eventId,
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
        createdAt,
        createdByProfileId: profileId,
        entrySource: "COACH",
        verificationStatus: "COACH_RECORDED",
        idempotencyKey: eventId,
        sessionSequence: nextSessionSequence(next.data.pitchEvents, session.id),
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
      const profileId = current.teamContext?.profile?.id;
      const pitchingNext = ensurePitchingSession(current, practice, pitcher.id, "Live BP", profileId, hitter.id);
      const pitchingSession = pitchingNext.session;
      const hittingNext = ensureHittingSession(pitchingNext.data, practice, hitter.id, "Live BP", profileId);
      const hittingSession = hittingNext.session;
      const pitchNumber = hittingNext.data.pitchEvents.filter((event) => event.sessionId === pitchingSession.id).length + 1;
      const eventNumber = hittingNext.data.hittingEvents.filter((event) => event.sessionId === hittingSession.id).length + 1;
      const createdAt = new Date().toISOString();
      const pitchEventId = createId("pe");
      const hittingEventId = createId("he");
      const pitchEvent: PitchEvent = {
        id: pitchEventId,
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
        createdAt,
        createdByProfileId: profileId,
        entrySource: "COACH",
        verificationStatus: "COACH_RECORDED",
        idempotencyKey: pitchEventId,
        sessionSequence: nextSessionSequence(hittingNext.data.pitchEvents, pitchingSession.id),
      };
      const hittingEvent: HittingEvent = {
        id: hittingEventId,
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
        createdAt,
        createdByProfileId: profileId,
        entrySource: "COACH",
        verificationStatus: "COACH_RECORDED",
        idempotencyKey: hittingEventId,
        sessionSequence: nextSessionSequence(hittingNext.data.hittingEvents, hittingSession.id),
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
      const profileId = current.teamContext?.profile?.id;
      const pitchingNext = ensurePitchingSession(current, practice, pitcher.id, "Live BP", profileId, hitter.id);
      const hittingNext = ensureHittingSession(pitchingNext.data, practice, hitter.id, "Live BP", profileId);
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
    const hitters = availablePracticePlayers(data, practice).filter((player) => player.isHitter && player.id !== liveBpPitcherId);
    if (!hitters.length) return;
    const currentIndex = hitters.findIndex((player) => player.id === liveBpHitterId);
    const next = hitters[(currentIndex + 1) % hitters.length] ?? hitters[0];
    setLiveBpHitterId(next.id);
  }

  function logDefense(outcome: DefenseOutcome, errorType?: DefenseEvent["errorType"]) {
    if (!practice || !practicePlayer) return;
    commit((current) => {
      const profileId = current.teamContext?.profile?.id;
      const next = ensureDefenseSession(current, practice, practicePlayer.id, defenseStation, profileId);
      const session = next.session;
      const eventNumber = next.data.defenseEvents.filter((event) => event.sessionId === session.id).length + 1;
      const eventId = createId("de");
      const createdAt = new Date().toISOString();
      const event: DefenseEvent = {
        id: eventId,
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
        createdAt,
        createdByProfileId: profileId,
        entrySource: "COACH",
        verificationStatus: "COACH_RECORDED",
        idempotencyKey: eventId,
        sessionSequence: nextSessionSequence(next.data.defenseEvents, session.id),
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
            session.id === sessionSummary.sessionId ? { ...session, endedAt, status: "COMPLETED", updatedAt: endedAt, summaryNote, sessionGrade: gradeSession(summaryNote) } : session,
          ),
        };
      }
      if (sessionSummary.type === "Pitching") {
        return {
          ...current,
          pitchingSessions: current.pitchingSessions.map((session) =>
            session.id === sessionSummary.sessionId ? { ...session, endedAt, status: "COMPLETED", updatedAt: endedAt, summaryNote, sessionGrade: gradeSession(summaryNote) } : session,
          ),
        };
      }
      return {
        ...current,
        defenseSessions: current.defenseSessions.map((session) =>
          session.id === sessionSummary.sessionId ? { ...session, endedAt, status: "COMPLETED", updatedAt: endedAt, summaryNote } : session,
        ),
      };
    });
    setSessionSummary(null);
  }

  function endPractice() {
    if (!practice) return;
    if (data) {
      const activeSessions = [
        ...data.hittingSessions.filter((session) => session.practiceId === practice.id && !session.endedAt && (session.status ?? "ACTIVE") === "ACTIVE"),
        ...data.pitchingSessions.filter((session) => session.practiceId === practice.id && !session.endedAt && (session.status ?? "ACTIVE") === "ACTIVE"),
        ...data.defenseSessions.filter((session) => session.practiceId === practice.id && !session.endedAt && (session.status ?? "ACTIVE") === "ACTIVE"),
      ];
      if (activeSessions.length > 0 && typeof window !== "undefined") {
        const confirmed = window.confirm(`${activeSessions.length} session${activeSessions.length === 1 ? " is" : "s are"} still active. End all sessions and this practice?`);
        if (!confirmed) return;
      }
    }
    setPracticeSummaryOpen(true);
  }

  function savePracticeSummary() {
    if (!practice) return;
    const endedAt = new Date().toISOString();
    commit((current) => ({
      ...current,
      practices: current.practices.map((item) =>
        item.id === practice.id ? { ...item, endedAt, updatedAt: endedAt } : item,
      ),
      hittingSessions: current.hittingSessions.map((session) =>
        session.practiceId === practice.id && !session.endedAt ? { ...session, endedAt, status: "COMPLETED", updatedAt: endedAt } : session,
      ),
      pitchingSessions: current.pitchingSessions.map((session) =>
        session.practiceId === practice.id && !session.endedAt ? { ...session, endedAt, status: "COMPLETED", updatedAt: endedAt } : session,
      ),
      defenseSessions: current.defenseSessions.map((session) =>
        session.practiceId === practice.id && !session.endedAt ? { ...session, endedAt, status: "COMPLETED", updatedAt: endedAt } : session,
      ),
      settings: { ...current.settings, activePracticeId: undefined },
    }));
    setPracticeTrackingOpen(false);
    setPracticeSummaryOpen(false);
  }

  function createPracticeRecord(practiceDraft: Practice, attendanceDraft: PracticeAttendance[], options: { openPractice?: boolean } = {}) {
    commit((current) => ({
      ...current,
      practices: [practiceDraft, ...current.practices],
      attendance: [...attendanceDraft, ...current.attendance],
      settings: { ...current.settings, activePracticeId: options.openPractice ? practiceDraft.id : current.settings.activePracticeId },
    }));
    if (options.openPractice) {
      navigateToView("practice");
      setPracticeTrackingOpen(false);
      if (practiceDraft.playerIds[0]) {
        setPracticePlayerId(practiceDraft.playerIds[0]);
        setSelectedPlayerId(practiceDraft.playerIds[0]);
      }
    }
  }

  function createGameRecord(game: Game, options: { openGame?: boolean } = {}) {
    commit((current) => gameRepository.upsert(current, game));
    setSelectedGameId(game.id);
    if (options.openGame) navigateToView("games");
  }

  function createScheduleEvent(event: ScheduleEvent) {
    commit((current) => ({ ...current, scheduleEvents: [event, ...(current.scheduleEvents ?? [])] }));
  }

  function updateScheduleEvent(event: ScheduleEvent) {
    commit((current) => ({
      ...current,
      scheduleEvents: (current.scheduleEvents ?? []).map((item) => (item.id === event.id ? event : item)),
    }));
  }

  function addWorkoutEntry(draft?: WeightRoomSetDraft) {
    if (!data) return;
    const playerId = draft?.playerId ?? selectedWeightPlayerId;
    const player = data.players.find((item) => item.id === playerId);
    if (!player) return;
    const date = draft?.date ?? new Date().toISOString().slice(0, 10);
    const weekOf = weekStart(date);
    const existingSession = data.workoutSessions.find((item) => item.playerId === player.id && item.date === date);
    const exercise = draft?.exercise ?? weightForm.exercise;
    const weight = draft?.weight ?? (Number(weightForm.weight) || undefined);
    const reps = draft?.reps ?? (Number(weightForm.reps) || undefined);
    const rpe = draft?.rpe ?? (Number(weightForm.effort) || undefined);
    const existingSets = data.workoutEntries.filter((entry) => entry.sessionId === existingSession?.id && entry.playerId === player.id && entry.exercise === exercise);
    const session: WorkoutSession = {
      id: existingSession?.id ?? createId("ws"),
      playerId: player.id,
      date,
      weekOf,
      day: weekdayName(date),
      completed: true,
      effortScore: rpe || existingSession?.effortScore || 8,
      bodyWeight: player.weight,
      createdAt: existingSession?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const entry: WorkoutEntry = {
      id: createId("we"),
      sessionId: session.id,
      playerId: player.id,
      exercise,
      kind: draft?.kind ?? workoutExerciseKind(exercise),
      setNumber: existingSets.length + 1,
      weight,
      reps,
      sets: draft ? 1 : Number(weightForm.sets) || undefined,
      value: draft?.value,
      unit: draft?.unit,
      rpe,
      status: draft?.status ?? "Completed",
      createdByProfileId: data.teamContext?.profile?.id,
      entrySource: "COACH",
      priorValue: latestExerciseValue(data, player.id, exercise),
      createdAt: new Date().toISOString(),
    };
    commit((current) => workoutRepository.logEntry(current, session, entry));
  }

  function removeWorkoutEntry(entryId: ID) {
    commit((current) => workoutRepository.removeEntry(current, entryId));
  }

  function logWeightRoomWeighIns(rows: Array<{ playerId: ID; weight?: number }>, date: string) {
    const usableRows = rows.filter((row) => typeof row.weight === "number" && row.weight > 0);
    if (!usableRows.length) return;
    commit((current) => {
      let next = current;
      usableRows.forEach((row) => {
        const existingSession = next.workoutSessions.find((item) => item.playerId === row.playerId && item.date === date);
        const session: WorkoutSession = {
          id: existingSession?.id ?? createId("ws"),
          playerId: row.playerId,
          date,
          weekOf: weekStart(date),
          day: weekdayName(date),
          completed: existingSession?.completed ?? false,
          effortScore: existingSession?.effortScore ?? 0,
          bodyWeight: row.weight,
          createdAt: existingSession?.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        next = workoutRepository.upsertSession(next, session);
      });
      return next;
    });
  }

  function startWeightRoomWorkout(input: { title: string; date: string; location?: string; eventId?: ID }) {
    const now = new Date().toISOString();
    const startAt = `${input.date}T18:00:00.000Z`;
    setWeightRoomWorkoutTitle(input.title);
    setWeightRoomWorkoutDate(input.date);
    setWeightRoomWorkoutStatus("In Progress");
    if (input.eventId) {
      setWeightRoomActiveEventId(input.eventId);
      updateScheduleEventForWeightRoom(input.eventId, { status: "Scheduled" });
      return;
    }
    const event: ScheduleEvent = {
      id: createId("se"),
      organizationId: data?.teamContext?.currentTeam?.organizationId,
      teamId: data?.teamContext?.currentTeam?.teamId,
      seasonId: data?.teamContext?.currentTeam?.seasonId,
      teamIds: data?.teamContext?.currentTeam?.teamId ? [data.teamContext.currentTeam.teamId] : [],
      eventType: "Lift",
      title: input.title,
      startAt,
      location: input.location,
      visibility: "TEAM_ONLY",
      status: "Scheduled",
      createdBy: data?.teamContext?.profile?.id,
      createdAt: now,
      updatedAt: now,
    };
    setWeightRoomActiveEventId(event.id);
    createScheduleEvent(event);
  }

  function completeWeightRoomWorkout() {
    setWeightRoomWorkoutStatus("Completed");
    if (weightRoomActiveEventId) updateScheduleEventForWeightRoom(weightRoomActiveEventId, { status: "Completed" });
  }

  function updateScheduleEventForWeightRoom(eventId: ID, patch: Partial<ScheduleEvent>) {
    if (!data) return;
    const event = data.scheduleEvents.find((item) => item.id === eventId);
    if (!event) return;
    updateScheduleEvent({ ...event, ...patch, updatedAt: new Date().toISOString() });
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
        <img className="brand-wordmark" src={BRAND_ASSETS.wordmark} alt="" />
        <img className="asset-preload" src="/brand/metrolina-warriors-alpha.png" alt="" aria-hidden="true" />
        <strong>{APP_TAGLINE}</strong>
        <span>{APP_SECONDARY_TAGLINE}</span>
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
        <img className="brand-wordmark" src={BRAND_ASSETS.wordmark} alt="" />
        <strong>{APP_NAME}</strong>
        <span>Database is connected, but no app data was returned.</span>
      </main>
    );
  }

  const inTeamContext = searchInTeamContext;
  const sidebarItems = inTeamContext ? TEAM_NAV_ITEMS : GLOBAL_NAV_ITEMS;
  const mobileItems = inTeamContext ? TEAM_MOBILE_NAV_ITEMS : MOBILE_NAV_ITEMS;

  return (
    <main className="ops-shell">
      <aside className="ops-sidebar" aria-label="Primary navigation">
        <div className="sidebar-brand">
          <button className="brand-lockup" type="button" onClick={returnToClubhouseHome}>
            <img src={BRAND_ASSETS.mark} alt="" />
            <span>
              <strong>{APP_NAME}</strong>
              <small>{APP_TAGLINE}</small>
            </span>
          </button>
          {inTeamContext && (
            <button className="context-back-button" type="button" onClick={returnToClubhouseHome}>
              <ChevronLeft size={14} aria-hidden="true" />
              <span>Clubhouse</span>
            </button>
          )}
        </div>

        <nav className="rail-nav">
          {sidebarItems.map(({ key, label, icon: Icon }) => (
            <button key={key} type="button" className={view === key ? "active" : ""} onClick={() => goToView(key)}>
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {!inTeamContext && (
          <PinnedTeamShortcuts
            teams={pinnedTeams}
            context={data.teamContext}
            onEnterTeam={enterTeam}
            onUnpin={(team) => void toggleTeamPin(team, { forceUnpin: true })}
          />
        )}

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
            onView={goToView}
            onSignOut={signOut}
            variant="icon"
          />
        </div>
      </aside>

      <section className="ops-main">
        <TopCommand
          globalQuery={globalQuery}
          globalResults={globalResults}
          searchMode={inTeamContext ? "team" : "global"}
          onQuery={setGlobalQuery}
          onOpenPlayer={openPlayer}
          onOpenOrganization={openManagedOrganization}
          onOpenPublicOrganization={openPublicOrganization}
          onEnterTeam={enterTeam}
          onOpenPublicTeam={openPublicTeam}
          onStartPractice={() => setStartPracticeOpen(true)}
          onStartGame={() => setStartGameOpen(true)}
          onView={goToView}
          showTeamActions={false}
          context={data.teamContext}
          accountMenuOpen={topAccountMenuOpen}
          onAccountMenu={(open) => {
            setTopAccountMenuOpen(open);
            if (open) setSidebarAccountMenuOpen(false);
          }}
          onSignOut={signOut}
        />

        <SyncStatusBanner status={saveStatus} error={saveError} />

        {inTeamContext && (
          <TeamWorkspaceHeader
            context={data.teamContext}
            view={view}
            onSwitch={switchTeam}
            onClubhouseHome={returnToClubhouseHome}
            onStartPractice={() => setStartPracticeOpen(true)}
            onStartGame={() => setStartGameOpen(true)}
          />
        )}

        {view === "home" && (
            <ClubhouseHome
              data={data}
              onEnterTeam={enterTeam}
              onOpenPublicTeam={openPublicTeam}
              onOpenManagedOrganization={openManagedOrganization}
              onTogglePublicTeamFollow={togglePublicTeamFollow}
              onToggleTeamPin={toggleTeamPin}
              onView={goToView}
              onCreateTeam={() => openTeamCreator(undefined, "existing")}
            />
        )}

        {view === "organizations" && (
          <OrganizationsView
            data={data}
            onEnterTeam={enterTeam}
            onCreateTeam={openTeamCreator}
          />
        )}

        {view === "teams" && (
          <MyTeamsView
            data={data}
            onEnterTeam={enterTeam}
            onToggleTeamPin={toggleTeamPin}
            onCreateTeam={() => openTeamCreator(undefined, "existing")}
          />
        )}

        {view === "following" && (
          <FollowingView
            data={data}
            onOpenPublicTeam={openPublicTeam}
            onOpenPublicOrganization={openPublicOrganization}
            onTogglePublicTeamFollow={togglePublicTeamFollow}
            onTogglePublicOrganizationFollow={togglePublicOrganizationFollow}
            onCreateTeam={() => openTeamCreator(undefined, "existing")}
          />
        )}

        {view === "discover" && (
          <DiscoverView
            data={data}
            onEnterTeam={enterTeam}
            onOpenPublicTeam={openPublicTeam}
            onOpenPublicOrganization={openPublicOrganization}
            onTogglePublicTeamFollow={togglePublicTeamFollow}
            onCreateTeam={() => openTeamCreator(undefined, "existing")}
          />
        )}

        {view === "teamHome" && (
          <HomeDashboard
            data={data}
            weeklyMvp={weeklyMvp}
            weightLeader={weightLeader}
            onView={goToView}
            onOpenPlayer={openPlayer}
            onStartPractice={() => setStartPracticeOpen(true)}
            onStartGame={() => setStartGameOpen(true)}
          />
        )}

        {view === "schedule" && (
          <ScheduleView
            data={data}
            onAddEvent={(date) => {
              setScheduleEventInitialDate(date);
              setScheduleEventOpen(true);
            }}
            onView={goToView}
            onOpenGame={(gameId) => {
              setSelectedGameId(gameId);
              goToView("games");
            }}
            onUpdateScheduleEvent={updateScheduleEvent}
          />
        )}

        {view === "roster" && (
          <RosterView
            players={rosterPlayers}
            staffMembers={data.staffMembers ?? []}
            staffTeamMemberships={data.staffTeamMemberships ?? []}
            staffInvitations={data.staffInvitations ?? []}
            staffActionMessage={staffActionMessage}
            team={data.teamContext?.currentTeam}
            availableTeams={data.teamContext?.availableTeams ?? []}
            section={rosterSection}
            filter={rosterFilter}
            positionFilter={rosterPositionFilter}
            yearFilter={rosterYearFilter}
            query={rosterQuery}
            onSection={setRosterSection}
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
            onInviteStaff={() => setStaffInviteOpen(true)}
            onStatus={updateRosterStatus}
            onDeletePlayer={(playerId) => {
              commit((current) => playerRepository.archive(current, playerId));
            }}
            onCopyStaffInvite={copyStaffInviteLink}
            onResendStaffInvite={resendStaffInvitation}
            onRevokeStaffInvite={revokeStaffInvitation}
            onUpdateStaff={updateStaffMember}
          />
        )}

        {view === "practice" && practicePlayer && !practiceTrackingOpen && practiceDrilldown.kind === "hub" && (
          <PracticeHome
            data={data}
            practice={practice}
            activeTotals={activeTotals}
            tab={practiceHubTab}
            onTab={setPracticeHubTab}
            onStartPractice={() => setStartPracticeOpen(true)}
            onOpenStation={openPracticeStation}
            onOpenSession={resumePracticeSession}
            onOpenAttendance={() => (practice ? setPracticeDrilldown({ kind: "attendance" }) : setStartPracticeOpen(true))}
            onEndPractice={endPractice}
            onStatus={updatePracticeAttendance}
            onOpenPlayer={openPlayer}
          />
        )}

        {view === "practice" && practicePlayer && practice && !practiceTrackingOpen && practiceDrilldown.kind === "attendance" && (
          <PracticeAttendanceDrilldown
            data={data}
            practice={practice}
            onBack={() => setPracticeDrilldown({ kind: "hub" })}
            onMarkAllPresent={markPracticeRosterPresent}
            onStatus={updatePracticeAttendance}
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
            body="Create the first roster player, then practice tracking will unlock."
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
            tab={weightRoomTab}
            workoutDate={weightRoomWorkoutDate}
            workoutTitle={weightRoomWorkoutTitle}
            workoutStatus={weightRoomWorkoutStatus}
            activeExercise={weightRoomActiveExercise}
            setForm={weightRoomSetForm}
            weighInOpen={weightRoomWeighInOpen}
            onPlayer={setSelectedWeightPlayerId}
            onOpenPlayer={openPlayer}
            onForm={setWeightForm}
            onTab={setWeightRoomTab}
            onWorkoutTitle={setWeightRoomWorkoutTitle}
            onWorkoutDate={setWeightRoomWorkoutDate}
            onActiveExercise={setWeightRoomActiveExercise}
            onSetForm={setWeightRoomSetForm}
            onAddEntry={addWorkoutEntry}
            onRemoveEntry={removeWorkoutEntry}
            onStartWorkout={startWeightRoomWorkout}
            onCompleteWorkout={completeWeightRoomWorkout}
            onWeighInOpen={setWeightRoomWeighInOpen}
            onSaveWeighIns={logWeightRoomWeighIns}
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
          <AccountProfileView
            context={data.teamContext}
            onEnterTeam={enterTeam}
            onManageOrganization={openOrganizationManagement}
            onCreateOrganization={() => openTeamCreator(undefined, "organization")}
            onSignOut={signOut}
            onSave={saveAccountProfile}
          />
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
        {mobileItems.map(({ key, shortLabel, icon: Icon }) => (
          <button
            key={key}
            type="button"
            className={(key === "more" ? MORE_VIEWS.includes(view) || (inTeamContext && ["roster", "weights", "analytics", "account"].includes(view)) : view === key) ? "active" : ""}
            onClick={() => {
              if (key === "more") {
                setMobileMoreOpen((open) => !open);
                return;
              }
              setMobileMoreOpen(false);
                goToView(key);
            }}
          >
            <Icon size={19} aria-hidden="true" />
            <span>{shortLabel}</span>
          </button>
        ))}
      </nav>

      {mobileMoreOpen && (
        <section className="mobile-more-sheet" aria-label="More navigation">
          {inTeamContext && (
            <button type="button" onClick={() => { returnToClubhouseHome(); setMobileMoreOpen(false); }}>
              <Home size={17} aria-hidden="true" />
              Clubhouse Home
            </button>
          )}
          {!inTeamContext && (
            <button type="button" onClick={() => { goToView("organizations"); setMobileMoreOpen(false); }}>
              <Building2 size={17} aria-hidden="true" />
              Organizations
            </button>
          )}
          {inTeamContext && (
            <button type="button" onClick={() => { goToView("roster"); setMobileMoreOpen(false); }}>
              <Users size={17} aria-hidden="true" />
              Roster
            </button>
          )}
          <button type="button" onClick={() => { goToView("weights"); setMobileMoreOpen(false); }}>
            <Dumbbell size={17} aria-hidden="true" />
            Weight Room
          </button>
          <button type="button" onClick={() => { goToView("analytics"); setMobileMoreOpen(false); }}>
            <BarChart3 size={17} aria-hidden="true" />
            Analytics
          </button>
          <button type="button" onClick={() => { goToView("account"); setMobileMoreOpen(false); }}>
            <User size={17} aria-hidden="true" />
            My Profile
          </button>
          {!inTeamContext && (
            <button type="button" onClick={() => { goToView("teams"); setMobileMoreOpen(false); }}>
              <Building2 size={17} aria-hidden="true" />
              Teams
            </button>
          )}
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
          onCreate={(practiceDraft, attendanceDraft) => {
            createPracticeRecord(practiceDraft, attendanceDraft, { openPractice: true });
            setStartPracticeOpen(false);
          }}
        />
      )}

      {startGameOpen && (
        <StartGameModal
          data={data}
          onClose={() => setStartGameOpen(false)}
          onCreate={(game) => {
            createGameRecord(game, { openGame: true });
            setStartGameOpen(false);
          }}
        />
      )}

      {scheduleEventOpen && (
        <ScheduleEventModal
          data={data}
          initialDate={scheduleEventInitialDate}
          onClose={() => {
            setScheduleEventOpen(false);
            setScheduleEventInitialDate(undefined);
          }}
          onCreatePractice={(practiceDraft, attendanceDraft) => {
            createPracticeRecord(practiceDraft, attendanceDraft);
            setScheduleEventOpen(false);
            setScheduleEventInitialDate(undefined);
          }}
          onCreateGame={(game) => {
            createGameRecord(game);
            setScheduleEventOpen(false);
            setScheduleEventInitialDate(undefined);
          }}
          onCreateEvent={(event) => {
            createScheduleEvent(event);
            setScheduleEventOpen(false);
            setScheduleEventInitialDate(undefined);
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
            navigateToView("profile", { playerId: player.id });
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

      {teamCreatorOpen && (
        <TeamCreatorModal
          organizations={organizationSummariesFromContext(data.teamContext)}
          initialOrganizationId={teamCreatorOrganizationId}
          initialMode={teamCreatorMode}
          onClose={() => setTeamCreatorOpen(false)}
          onCreateOrganization={async (input) => {
            await createOrganization(input);
            setTeamCreatorOpen(false);
            setTeamCreatorOrganizationId(undefined);
            setTeamCreatorMode("existing");
            await refreshGlobalData();
          }}
          onCreate={async (input) => {
            const team = await createTeamForImport(input);
            setTeamCreatorOpen(false);
            setTeamCreatorOrganizationId(undefined);
            setTeamCreatorMode("existing");
            await enterTeam(team);
          }}
        />
      )}

      {staffInviteOpen && (
        <InviteStaffModal
          teams={data.teamContext?.availableTeams ?? []}
          currentTeam={data.teamContext?.currentTeam}
          onClose={() => setStaffInviteOpen(false)}
          onInvite={async (input) => {
            return inviteStaff(input);
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
    if (!firstName.trim() || !lastName.trim()) {
      setMessage("First and last name are required.");
      return;
    }
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

  async function sendPasswordReset() {
    if (!email) {
      setMessage("Enter your email first.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await authRepository.resetPassword(email);
      setMessage("Password reset email sent.");
    } catch (resetError) {
      setMessage(resetError instanceof Error ? resetError.message : "Unable to send password reset email.");
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
      <img className="brand-wordmark" src={BRAND_ASSETS.wordmark} alt="" />
      <strong>{APP_TAGLINE}</strong>
      <span>{APP_SECONDARY_TAGLINE}</span>

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
            {mode === "login" && (
              <button className="auth-link-button" type="button" onClick={() => void sendPasswordReset()} disabled={busy || !email}>
                Forgot password?
              </button>
            )}
          </form>
        </>
      )}

      {authState.status === "authenticated" && needsMembership && (
        <section className="auth-form no-team-card">
          <span>Welcome to {APP_NAME}</span>
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
  if (status !== "error") return null;
  return (
    <div className="sync-banner sync-banner--error" role="alert">
      {`Save failed: ${error ?? "Check your connection and permissions."}`}
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
  searchMode,
  onQuery,
  onOpenPlayer,
  onOpenOrganization,
  onOpenPublicOrganization,
  onEnterTeam,
  onOpenPublicTeam,
  onStartPractice,
  onStartGame,
  onView,
  showTeamActions,
  context,
  accountMenuOpen,
  onAccountMenu,
  onSignOut,
}: {
  globalQuery: string;
  globalResults: GlobalSearchResults;
  searchMode: "global" | "team";
  onQuery: (value: string) => void;
  onOpenPlayer: (playerId: ID) => void;
  onOpenOrganization: (organization: OrganizationSummary) => void;
  onOpenPublicOrganization: (organization: PublicDirectoryOrganizationSummary) => void;
  onEnterTeam: (team: TeamOption) => void | Promise<void>;
  onOpenPublicTeam: (team: PublicDirectoryTeamSummary) => void;
  onStartPractice: () => void;
  onStartGame: () => void;
  onView: (view: ViewKey) => void;
  showTeamActions: boolean;
  context?: TeamContext;
  accountMenuOpen: boolean;
  onAccountMenu: (open: boolean) => void;
  onSignOut: () => void | Promise<void>;
}) {
  const hasTeamResults = globalResults.players.length > 0;
  const hasGlobalResults =
    globalResults.organizations.length > 0 ||
    globalResults.publicOrganizations.length > 0 ||
    globalResults.teams.length > 0 ||
    globalResults.publicTeams.length > 0;
  const hasResults = searchMode === "team" ? hasTeamResults : hasGlobalResults;
  const placeholder = searchMode === "team" ? "Search players..." : "Search teams or organizations...";
  const ariaLabel = searchMode === "team" ? "Search players" : "Search teams or organizations";

  return (
    <header className="top-command">
      <div className="top-command__identity">
        <button type="button" className="mobile-brand" onClick={() => onView("home")}>
          <img src={BRAND_ASSETS.mark} alt="" />
        </button>
        <strong>{APP_NAME}</strong>
      </div>

      <div className="global-search">
        <Search size={16} aria-hidden="true" />
        <input value={globalQuery} onChange={(event) => onQuery(event.target.value)} placeholder={placeholder} aria-label={ariaLabel} />
        {hasResults && (
          <div className="global-search__results">
            {searchMode === "global" ? (
              <>
                {globalResults.organizations.length > 0 && (
                  <div className="global-search__group">
                    <span className="global-search__group-title">My Organizations</span>
                    {globalResults.organizations.map((organization) => (
                      <button
                        key={organization.id}
                        type="button"
                        onClick={() => {
                          onQuery("");
                          if (organization.teams[0]) void onEnterTeam(organization.teams[0]);
                          else onOpenOrganization(organization);
                        }}
                      >
                        <OrganizationLogo name={organization.name} />
                        <span>{organization.name}</span>
                        <small>{organization.teams.length} team{organization.teams.length === 1 ? "" : "s"}</small>
                      </button>
                    ))}
                  </div>
                )}
                {globalResults.publicOrganizations.length > 0 && (
                  <div className="global-search__group">
                    <span className="global-search__group-title">Organizations</span>
                    {globalResults.publicOrganizations.map((organization) => (
                      <button
                        key={`public-org-${organization.id}`}
                        type="button"
                        onClick={() => {
                          onQuery("");
                          onOpenPublicOrganization(organization);
                        }}
                      >
                        <OrganizationLogo name={organization.name} logoUrl={organization.logoUrl} />
                        <span>{organization.name}</span>
                        <small>{organizationLocation(organization) || `${organization.teams.length} teams`}</small>
                      </button>
                    ))}
                  </div>
                )}
                {globalResults.teams.length > 0 && (
                  <div className="global-search__group">
                    <span className="global-search__group-title">My Teams</span>
                    {globalResults.teams.map((team) => (
                      <button
                        key={teamValue(team)}
                        type="button"
                        onClick={() => {
                          onQuery("");
                          void onEnterTeam(team);
                        }}
                      >
                        <OrganizationLogo name={team.organizationName} />
                        <span>{team.teamName}</span>
                        <small>{team.organizationName}</small>
                      </button>
                    ))}
                  </div>
                )}
                {globalResults.publicTeams.length > 0 && (
                  <div className="global-search__group">
                    <span className="global-search__group-title">Teams</span>
                    {globalResults.publicTeams.map((team) => (
                      <button
                        key={`public-team-${team.id}`}
                        type="button"
                        onClick={() => {
                          onQuery("");
                          onOpenPublicTeam(team);
                        }}
                      >
                        <OrganizationLogo name={team.organizationName} />
                        <span>{team.name}</span>
                        <small>{team.organizationName}</small>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              globalResults.players.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => {
                    onQuery("");
                    onOpenPlayer(player.id);
                  }}
                >
                  <PlayerAvatar player={player} size="sm" compact />
                  <span>{player.name}</span>
                  <small>#{player.jerseyNumber}</small>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="top-command__actions">
        {showTeamActions && (
          <>
            <button type="button" className="primary-button" onClick={onStartPractice}>
              <Plus size={16} aria-hidden="true" />
              Practice
            </button>
            <button type="button" className="secondary-button" onClick={onStartGame}>
              <Plus size={16} aria-hidden="true" />
              Game
            </button>
          </>
        )}
        <div className="top-command__account">
          <ProfileMenu
            context={context}
            open={accountMenuOpen}
            onOpen={onAccountMenu}
            onView={onView}
            onSignOut={onSignOut}
          />
        </div>
      </div>
    </header>
  );
}

type ChoiceOption = {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
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
      data-label={ariaLabel ?? label}
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
        {selected?.icon && <span className="choice-select__icon">{selected.icon}</span>}
        <strong>
          {selected?.label ?? "Select"}
          {selected?.description && <small>{selected.description}</small>}
        </strong>
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
              {option.icon && <span className="choice-select__icon">{option.icon}</span>}
              <span>
                {option.label}
                {option.description && <small>{option.description}</small>}
              </span>
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
  const visibleTeams = displayWorkspaceTeams(teams);
  const switchTeams = visibleTeams.some((team) => teamValue(team) === selectedValue) ? visibleTeams : teams;

  return (
    <div className={`team-switcher ${compact ? "team-switcher--compact" : ""}`}>
      <OrganizationLogo name={current.organizationName} />
      <span>
        <small>{current.organizationName}</small>
        {switchTeams.length > 1 ? (
          <ChoiceSelect
            value={selectedValue}
            aria-label="Current team"
            className="team-switch-choice"
            options={switchTeams.map((team) => ({ value: teamValue(team), label: `${team.teamName} - ${team.seasonName ?? "Current season"}` }))}
            onChange={(value) => {
              const next = switchTeams.find((team) => teamValue(team) === value);
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

function TeamWorkspaceHeader({
  context,
  view,
  onSwitch,
  onClubhouseHome,
  onStartPractice,
  onStartGame,
}: {
  context?: TeamContext;
  view: ViewKey;
  onSwitch: (team: TeamOption) => void | Promise<void>;
  onClubhouseHome: () => void;
  onStartPractice: () => void;
  onStartGame: () => void;
}) {
  const current = context?.currentTeam;
  if (!current) return null;
  const isTeamHome = view === "teamHome";
  if (!isTeamHome) return null;
  return (
    <section className="team-workspace-header team-workspace-header--home">
      <OrganizationLogo name={current.organizationName} logoUrl={teamOrganizationLogo(current, context)} />
      <div className="team-workspace-header__identity">
        <span>{current.organizationName}</span>
        <TeamIdentitySwitcher context={context} current={current} onSwitch={onSwitch} onClubhouseHome={onClubhouseHome} />
        <small>{current.seasonName ?? "Current season"}</small>
      </div>
      <div className="team-workspace-header__actions">
        <button type="button" className="primary-button" onClick={onStartPractice}>
          <Plus size={16} aria-hidden="true" />
          Practice
        </button>
        <button type="button" className="secondary-button" onClick={onStartGame}>
          <Plus size={16} aria-hidden="true" />
          Game
        </button>
      </div>
    </section>
  );
}

function TeamIdentitySwitcher({
  context,
  current,
  onSwitch,
  onClubhouseHome,
  compact = false,
}: {
  context?: TeamContext;
  current: TeamOption;
  onSwitch: (team: TeamOption) => void | Promise<void>;
  onClubhouseHome: () => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const organizations = organizationSummariesFromContext(context).filter((organization) => organization.teams.length > 0);
  const selectedValue = teamValue(current);

  return (
    <div
      className={`team-identity-switcher ${compact ? "team-identity-switcher--compact" : ""}`}
      onBlur={(event) => {
        const nextFocus = event.relatedTarget instanceof Node ? event.relatedTarget : null;
        if (!nextFocus || !event.currentTarget.contains(nextFocus)) setOpen(false);
      }}
    >
      <button type="button" className="team-identity-switcher__button" onClick={() => setOpen((value) => !value)} aria-haspopup="dialog" aria-expanded={open}>
        <strong>{current.teamName}</strong>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className="team-identity-switcher__panel">
          {organizations.map((organization) => (
            <div className="team-switcher-group" key={organization.id}>
              <div className="team-switcher-group__heading">
                <OrganizationLogo name={organization.name} logoUrl={organization.logoUrl} />
                <strong>{organization.name}</strong>
              </div>
              {organization.teams.map((team) => (
                <button
                  key={teamValue(team)}
                  type="button"
                  className={teamValue(team) === selectedValue ? "active" : ""}
                  onClick={() => {
                    setOpen(false);
                    void onSwitch(team);
                  }}
                >
                  <span>
                    <strong>{team.teamName}</strong>
                    <small>{team.seasonName ?? "Current season"}</small>
                  </span>
                  {teamValue(team) === selectedValue ? <Check size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />}
                </button>
              ))}
            </div>
          ))}
          <button className="team-switcher-home-row" type="button" onClick={() => { setOpen(false); onClubhouseHome(); }}>
            <Home size={15} aria-hidden="true" />
            Clubhouse Home
          </button>
        </div>
      )}
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
  function handleProfileClick() {
    if (variant === "icon") {
      onOpen(false);
      onView("account");
      return;
    }
    onOpen(!open);
  }

  return (
    <div className={`profile-menu profile-menu--${variant}`}>
      <button className="profile-menu__button" type="button" onClick={handleProfileClick} aria-label={variant === "icon" ? "Open profile" : "Open profile menu"} aria-expanded={variant === "card" ? open : undefined}>
        <span className="profile-menu__avatar">{profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <span>{initials}</span>}</span>
        {variant === "card" && (
          <span className="profile-menu__identity">
            <strong>{profileName}</strong>
            <small>{role}</small>
          </span>
        )}
      </button>
      {variant === "card" && open && (
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
  onEnterTeam,
  onManageOrganization,
  onCreateOrganization,
  onSignOut,
  onSave,
}: {
  context?: TeamContext;
  onEnterTeam: (team: TeamOption) => void | Promise<void>;
  onManageOrganization: (organization: OrganizationSummary) => void;
  onCreateOrganization: () => void;
  onSignOut: () => void | Promise<void>;
  onSave: (input: { firstName?: string; lastName?: string; displayName?: string; avatarUrl?: string }) => Promise<void>;
}) {
  const profile = context?.profile;
  const initialDisplayName = preferredProfileDisplayName(profile);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [firstName, setFirstName] = useState(profile?.firstName ?? "");
  const [lastName, setLastName] = useState(profile?.lastName ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl ?? "");
  const [editingName, setEditingName] = useState(false);
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const [cropState, setCropState] = useState<AvatarCropState | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim();
  const displayValue = displayName.trim() || fullName || profileDisplayName(context);
  const emailValue = profile?.email ?? "No email available";

  useEffect(() => {
    setDisplayName(initialDisplayName);
    setFirstName(profile?.firstName ?? "");
    setLastName(profile?.lastName ?? "");
    setAvatarUrl(profile?.avatarUrl ?? "");
    if ([profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim()) setEditingName(false);
  }, [initialDisplayName, profile?.avatarUrl, profile?.firstName, profile?.lastName]);

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage("");
    if (!file.type.startsWith("image/")) {
      setStatus("error");
      setMessage("Choose an image file.");
      return;
    }
    if (file.size > 8_000_000) {
      setStatus("error");
      setMessage("Choose an image under 8 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const sourceUrl = typeof reader.result === "string" ? reader.result : "";
      setCropState({ sourceUrl, fileName: file.name, zoom: 1, offsetX: 0, offsetY: 0, status: "idle", message: "" });
      setStatus("idle");
    };
    reader.onerror = () => {
      setStatus("error");
      setMessage("Unable to read that image.");
    };
    reader.readAsDataURL(file);
  }

  async function applyAvatarCrop() {
    if (!cropState) return;
    setCropState((current) => current ? { ...current, status: "saving", message: "" } : current);
    setStatus("saving");
    setMessage("");
    try {
      const nextAvatarUrl = await cropAvatarImage(cropState);
      await onSave({ avatarUrl: nextAvatarUrl });
      setAvatarUrl(nextAvatarUrl);
      setCropState(null);
      setStatus("saved");
      setMessage("Saved");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to save profile photo.");
      setCropState((current) => current ? {
        ...current,
        status: "error",
        message: error instanceof Error ? error.message : "Unable to crop that image.",
      } : current);
    }
  }

  async function saveDisplayName() {
    const nextDisplayName = displayName.trim() || initialDisplayName;
    setDisplayName(nextDisplayName);
    setStatus("saving");
    setMessage("");
    try {
      await onSave({ displayName: nextDisplayName });
      setStatus("saved");
      setMessage("Saved");
      setEditingDisplayName(false);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to save profile.");
    }
  }

  async function saveName() {
    const nextFirstName = firstName.trim();
    const nextLastName = lastName.trim();
    if (!nextFirstName || !nextLastName) {
      setStatus("error");
      setMessage("First and last name are required.");
      return;
    }
    const nextDisplayName = displayName.trim() || `${nextFirstName} ${nextLastName}`;
    setStatus("saving");
    setMessage("");
    try {
      await onSave({ firstName: nextFirstName, lastName: nextLastName, displayName: nextDisplayName });
      setDisplayName(nextDisplayName);
      setEditingName(false);
      setStatus("saved");
      setMessage("Saved");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to save name.");
    }
  }

  return (
    <div className="page-stack">
      <SectionHeader
        title="My Profile"
        titleAdornment={<ProfileAffiliationAvatars context={context} />}
        action={
          <div className="profile-header-actions">
            <button className="secondary-button" type="button" onClick={() => void onSignOut()}>
              <LogOut size={16} aria-hidden="true" />
              Sign Out
            </button>
          </div>
        }
      />
      <section className="account-grid">
        <article className="panel account-card account-card--editable">
          <label className="account-avatar account-avatar--editable" aria-label="Change profile photo">
            {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{profileInitials(context)}</span>}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} />
          </label>
          <div className="account-profile-main">
            <div className="profile-line">
              <span>Name</span>
              {editingName ? (
                <div className="profile-name-editor">
                  <input
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    placeholder="First"
                    aria-label="First name"
                  />
                  <input
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    placeholder="Last"
                    aria-label="Last name"
                  />
                  <button className="secondary-button profile-inline-action" type="button" onClick={() => void saveName()} disabled={status === "saving"}>
                    {status === "saving" ? "Saving..." : "Save"}
                  </button>
                </div>
              ) : (
                <div className="profile-display-row">
                  <strong>{fullName || "Name not set"}</strong>
                  {!fullName && (
                    <button className="secondary-button profile-inline-action" type="button" onClick={() => setEditingName(true)}>
                      Set name
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="profile-line">
              <span>Display name</span>
              <div className="profile-display-row">
                {editingDisplayName ? (
                  <input
                    className="profile-display-input"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void saveDisplayName();
                      if (event.key === "Escape") {
                        setDisplayName(initialDisplayName);
                        setEditingDisplayName(false);
                      }
                    }}
                  />
                ) : (
                  <strong>{displayValue}</strong>
                )}
                {editingDisplayName ? (
                  <button className="secondary-button profile-inline-action" type="button" onClick={() => void saveDisplayName()} disabled={status === "saving"}>
                    {status === "saving" ? "Saving..." : "Save"}
                  </button>
                ) : (
                  <button className="icon-button profile-edit-button" type="button" aria-label="Edit display name" onClick={() => setEditingDisplayName(true)}>
                    <Edit3 size={13} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
            <div className="profile-line">
              <span>Email</span>
              <p>{emailValue}</p>
            </div>
          </div>
          <div className="profile-save-row profile-save-row--compact">
            {message && <span className={`profile-save-message profile-save-message--${status}`}>{message}</span>}
          </div>
        </article>
        <article className="panel account-teams-card">
          <div className="panel-heading tight">
            <div><h2>Your Organizations</h2></div>
            <button className="icon-button account-create-button" type="button" onClick={onCreateOrganization} aria-label="Create organization">
              <Plus size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="organization-team-grid organization-team-grid--summary">
            {organizationSummariesFromContext(context).length ? organizationSummariesFromContext(context).map((organization) => (
              <ManagedOrganizationTeamCard
                key={organization.id}
                organization={organization}
                onEnterTeam={onEnterTeam}
                onOpenOrganization={onManageOrganization}
              />
            )) : <CompactEmpty title="No organizations yet" />}
          </div>
        </article>
      </section>
      {cropState && (
        <AvatarCropModal
          state={cropState}
          onChange={setCropState}
          onCancel={() => setCropState(null)}
          onPickDifferent={() => fileInputRef.current?.click()}
          onApply={() => void applyAvatarCrop()}
        />
      )}
    </div>
  );
}

type AvatarCropState = {
  sourceUrl: string;
  fileName: string;
  zoom: number;
  offsetX: number;
  offsetY: number;
  status: "idle" | "saving" | "error";
  message: string;
};

function AvatarCropModal({
  state,
  title = "Profile Photo",
  onChange,
  onCancel,
  onPickDifferent,
  onApply,
}: {
  state: AvatarCropState;
  title?: string;
  onChange: React.Dispatch<React.SetStateAction<AvatarCropState | null>>;
  onCancel: () => void;
  onPickDifferent: () => void;
  onApply: () => void;
}) {
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const previewStyle = {
    transform: `translate(calc(-50% + ${state.offsetX}px), calc(-50% + ${state.offsetY}px)) scale(${state.zoom})`,
  };

  function moveCrop(clientX: number, clientY: number) {
    const drag = dragRef.current;
    if (!drag) return;
    const maxOffset = 150;
    onChange((current) => current ? {
      ...current,
      offsetX: clampNumber(drag.originX + clientX - drag.startX, -maxOffset, maxOffset),
      offsetY: clampNumber(drag.originY + clientY - drag.startY, -maxOffset, maxOffset),
    } : current);
  }

  return (
    <div className="modal-backdrop avatar-crop-backdrop" role="dialog" aria-modal="true" aria-label="Crop profile photo">
      <div className="modal-panel avatar-crop-modal">
        <div className="modal-title">
          <div>
            <h2>{title}</h2>
            <p>{state.fileName}</p>
          </div>
          <button className="icon-button" type="button" onClick={onCancel} aria-label="Close">
            <X size={17} aria-hidden="true" />
          </button>
        </div>
        <div
          className="avatar-crop-stage"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: state.offsetX, originY: state.offsetY };
          }}
          onPointerMove={(event) => moveCrop(event.clientX, event.clientY)}
          onPointerUp={(event) => {
            if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
          }}
          onPointerCancel={() => {
            dragRef.current = null;
          }}
        >
          <img src={state.sourceUrl} alt="" style={previewStyle} draggable={false} />
          <div className="avatar-crop-mask" aria-hidden="true" />
        </div>
        <div className="avatar-crop-controls">
          <label>
            <span>Zoom</span>
            <input
              type="range"
              min="1"
              max="2.8"
              step="0.01"
              value={state.zoom}
              onChange={(event) => onChange((current) => current ? { ...current, zoom: Number(event.target.value) } : current)}
            />
          </label>
        </div>
        {state.message && <span className="profile-save-message profile-save-message--error">{state.message}</span>}
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onPickDifferent}>Choose Different</button>
          <button className="secondary-button" type="button" onClick={onCancel}>Cancel</button>
          <button className="primary-button" type="button" onClick={onApply} disabled={state.status === "saving"}>
            {state.status === "saving" ? "Cropping..." : "Use Photo"}
          </button>
        </div>
      </div>
    </div>
  );
}

async function cropAvatarImage(state: AvatarCropState) {
  const image = await loadImageElement(state.sourceUrl);
  const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
  if (!sourceSize) throw new Error("Unable to read that image.");
  const outputSize = 240;
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to crop that image.");

  const scale = outputSize / sourceSize;
  const drawnWidth = image.naturalWidth * scale * state.zoom;
  const drawnHeight = image.naturalHeight * scale * state.zoom;
  const drawX = (outputSize - drawnWidth) / 2 + state.offsetX;
  const drawY = (outputSize - drawnHeight) / 2 + state.offsetY;

  context.save();
  context.beginPath();
  context.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
  context.clip();
  context.fillStyle = "#11151b";
  context.fillRect(0, 0, outputSize, outputSize);
  context.imageSmoothingQuality = "high";
  context.drawImage(image, drawX, drawY, drawnWidth, drawnHeight);
  context.restore();

  return canvas.toDataURL("image/webp", 0.76);
}

function loadImageElement(sourceUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to read that image."));
    image.src = sourceUrl;
  });
}

function PinnedTeamShortcuts({
  teams,
  context,
  onEnterTeam,
  onUnpin,
}: {
  teams: TeamOption[];
  context?: TeamContext;
  onEnterTeam: (team: TeamOption) => void | Promise<void>;
  onUnpin: (team: TeamOption) => void;
}) {
  const longPressTimer = useRef<number | undefined>(undefined);
  const suppressNextClick = useRef(false);

  const clearLongPress = () => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = undefined;
  };

  if (!teams.length) return null;

  return (
    <div className="pinned-team-shortcuts" aria-label="Pinned teams">
      {teams.slice(0, 3).map((team) => (
        <button
          key={teamValue(team)}
          className="pinned-team-shortcut"
          type="button"
          title={`${team.teamName} - hold to unpin`}
          onPointerDown={() => {
            clearLongPress();
            suppressNextClick.current = false;
            longPressTimer.current = window.setTimeout(() => {
              suppressNextClick.current = true;
              onUnpin(team);
              clearLongPress();
            }, 650);
          }}
          onPointerUp={clearLongPress}
          onPointerLeave={clearLongPress}
          onPointerCancel={clearLongPress}
          onContextMenu={(event) => {
            event.preventDefault();
            onUnpin(team);
          }}
          onClick={(event) => {
            if (suppressNextClick.current) {
              suppressNextClick.current = false;
              event.preventDefault();
              return;
            }
            void onEnterTeam(team);
          }}
        >
          <OrganizationLogo name={team.organizationName} logoUrl={team.logoUrl ?? teamOrganizationLogo(team, context)} />
          <span>
            <strong>{shortTeamName(team.teamName)}</strong>
            <small>{team.seasonName ?? "Current season"}</small>
          </span>
        </button>
      ))}
    </div>
  );
}

function ClubhouseHome({
  data,
  onEnterTeam,
  onOpenPublicTeam,
  onOpenManagedOrganization,
  onTogglePublicTeamFollow,
  onToggleTeamPin,
  onView,
  onCreateTeam,
}: {
  data: AppData;
  onEnterTeam: (team: TeamOption) => void | Promise<void>;
  onOpenPublicTeam: (team: PublicDirectoryTeamSummary) => void;
  onOpenManagedOrganization: (organization: OrganizationSummary) => void;
  onTogglePublicTeamFollow: (team: PublicDirectoryTeamSummary) => void | Promise<void>;
  onToggleTeamPin: (team: TeamOption) => void | Promise<void>;
  onView: (view: ViewKey) => void;
  onCreateTeam: () => void;
}) {
  const teams = displayWorkspaceTeams(data.teamContext?.availableTeams ?? []);
  const organizations = organizationSummariesFromContext(data.teamContext);
  const recentTeam = teams.find((team) => teamValue(team) === teamValue(data.teamContext?.currentTeam)) ?? teams[0];

  return (
    <div className="page-stack global-home">
      <section className="global-title-row">
        <div>
          <h1>Home</h1>
        </div>
        <button className="primary-button" type="button" onClick={onCreateTeam}>
          <Plus size={16} aria-hidden="true" />
          New Team/Org
        </button>
      </section>

      <section className="global-section">
        <SectionHeader title="My Organizations" action={<button className="text-button" type="button" onClick={() => onView("organizations")}>View all</button>} />
        <div className="organization-grid">
          {organizations.length ? organizations.map((organization) => (
            <OrganizationCard
              key={organization.id}
              organization={organization}
              onEnterTeam={onEnterTeam}
              onOpenOrganization={onOpenManagedOrganization}
            />
          )) : <CompactEmpty title="No organizations yet" />}
        </div>
      </section>

      <section className="global-section">
        <SectionHeader title="My Teams" action={<button className="text-button" type="button" onClick={() => onView("following")}>View all</button>} />
        <div className="managed-team-grid">
          {teams.length ? teams.slice(0, 6).map((team) => (
            <ManagedTeamCard
              key={teamValue(team)}
              team={team}
              context={data.teamContext}
              pinnedTeams={data.profileTeamPins}
              onEnterTeam={onEnterTeam}
              onTogglePinnedTeam={onToggleTeamPin}
            />
          )) : <CompactEmpty title="No teams yet" />}
        </div>
      </section>

      <section className="global-two-column">
        <article className="panel compact-panel">
          <div className="panel-heading tight">
            <div><h2>Following</h2></div>
            <button className="text-button" type="button" onClick={() => onView("following")}>Manage</button>
          </div>
          <FollowSummary
            data={data}
            onOpenPublicTeam={onOpenPublicTeam}
            onTogglePublicTeamFollow={onTogglePublicTeamFollow}
          />
        </article>
        <article className="panel compact-panel">
          <div className="panel-heading tight">
            <div><h2>Recent</h2></div>
            <button className="text-button" type="button" onClick={() => onView("discover")}>Search</button>
          </div>
          {recentTeam ? (
            <button className="recent-team-row" type="button" onClick={() => void onEnterTeam(recentTeam)}>
              <OrganizationLogo name={recentTeam.organizationName} />
              <span>
                <strong>{recentTeam.teamName}</strong>
                <small>{recentTeam.seasonName ?? "Current season"} - {roleLabel(recentTeam.role)}</small>
              </span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          ) : <CompactEmpty title="No recent teams" />}
        </article>
      </section>
    </div>
  );
}

function OrganizationsView({
  data,
  onEnterTeam,
  onCreateTeam,
}: {
  data: AppData;
  onEnterTeam: (team: TeamOption) => void | Promise<void>;
  onCreateTeam: (organizationId?: ID, mode?: "existing" | "new" | "organization") => void;
}) {
  const organizations = organizationSummariesFromContext(data.teamContext);
  return (
    <div className="page-stack global-home">
      <SectionHeader
        title="Organizations"
        action={
          <button className="primary-button" type="button" onClick={() => onCreateTeam(undefined, "organization")}>
            <Plus size={16} aria-hidden="true" />
            New Team/Org
          </button>
        }
      />
      <section className="organization-grid">
        {organizations.length ? organizations.map((organization) => (
          <OrganizationCard
            key={organization.id}
            organization={organization}
            onEnterTeam={onEnterTeam}
            onCreateTeam={onCreateTeam}
            expanded
          />
        )) : <CompactEmpty title="No organizations yet" />}
      </section>
    </div>
  );
}

function MyTeamsView({
  data,
  onEnterTeam,
  onToggleTeamPin,
  onCreateTeam,
}: {
  data: AppData;
  onEnterTeam: (team: TeamOption) => void | Promise<void>;
  onToggleTeamPin: (team: TeamOption) => void | Promise<void>;
  onCreateTeam: () => void;
}) {
  const teams = displayWorkspaceTeams(data.teamContext?.availableTeams ?? []);
  return (
    <div className="page-stack global-home">
      <SectionHeader
        title="My Teams"
        action={
          <button className="primary-button" type="button" onClick={onCreateTeam}>
            <Plus size={16} aria-hidden="true" />
            New Team/Org
          </button>
        }
      />
      <section className="managed-team-grid">
        {teams.length ? teams.map((team) => (
          <ManagedTeamCard
            key={teamValue(team)}
            team={team}
            context={data.teamContext}
            pinnedTeams={data.profileTeamPins}
            onEnterTeam={onEnterTeam}
            onTogglePinnedTeam={onToggleTeamPin}
          />
        )) : <CompactEmpty title="No team memberships yet" />}
      </section>
    </div>
  );
}

function TeamCreatorModal({
  organizations,
  initialOrganizationId,
  initialMode,
  onClose,
  onCreateOrganization,
  onCreate,
}: {
  organizations: OrganizationSummary[];
  initialOrganizationId?: ID;
  initialMode?: "existing" | "new" | "organization";
  onClose: () => void;
  onCreateOrganization: (input: { organizationName: string; city?: string; state?: string; logoUrl?: string; visibility?: string }) => Promise<void>;
  onCreate: (input: {
    organizationId?: string;
    organizationName?: string;
    organizationCity?: string;
    organizationState?: string;
    organizationLogoUrl?: string;
    organizationVisibility?: string;
    teamCity?: string;
    teamState?: string;
    teamName: string;
    teamLevel?: string;
    teamType?: string;
    ageGroup?: string;
    visibility?: string;
    seasonName: string;
  }) => Promise<void>;
}) {
  const startingMode: "existing" | "organization" =
    initialMode === "organization" ? "organization" : "existing";
  const [mode, setMode] = useState<"existing" | "organization">(startingMode);
  const [addFirstTeam, setAddFirstTeam] = useState(initialMode === "new");
  const [form, setForm] = useState({
    organizationId: initialOrganizationId ?? organizations[0]?.id ?? "",
    organizationName: "",
    organizationCity: "",
    organizationState: "",
    organizationVisibility: "PUBLIC",
    teamName: "",
    teamType: "School",
    teamLevel: "Varsity",
    teamCity: "",
    teamState: "",
    teamVisibility: "PUBLIC",
    seasonName: SEASON_OPTIONS[0] ?? "Summer 2026",
  });
  const [organizationLogoUrl, setOrganizationLogoUrl] = useState("");
  const [cropState, setCropState] = useState<AvatarCropState | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState("");
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  function updateTeamType(teamType: string) {
    setForm((current) => ({
      ...current,
      teamType,
      teamLevel: defaultLevelForTeamType(teamType),
    }));
  }

  function updateState(scope: "organization" | "team", state: string) {
    setForm((current) => ({
      ...current,
      [scope === "organization" ? "organizationState" : "teamState"]: state,
      [scope === "organization" ? "organizationCity" : "teamCity"]: "",
    }));
  }

  function handleLogoFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage("");
    if (!file.type.startsWith("image/")) {
      setStatus("error");
      setMessage("Choose an image file.");
      return;
    }
    if (file.size > 8_000_000) {
      setStatus("error");
      setMessage("Choose an image under 8 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const sourceUrl = typeof reader.result === "string" ? reader.result : "";
      setCropState({ sourceUrl, fileName: file.name, zoom: 1, offsetX: 0, offsetY: 0, status: "idle", message: "" });
      setStatus("idle");
    };
    reader.onerror = () => {
      setStatus("error");
      setMessage("Unable to read that image.");
    };
    reader.readAsDataURL(file);
  }

  async function applyLogoCrop() {
    if (!cropState) return;
    setCropState((current) => current ? { ...current, status: "saving", message: "" } : current);
    try {
      const nextLogoUrl = await cropAvatarImage(cropState);
      setOrganizationLogoUrl(nextLogoUrl);
      setCropState(null);
      setStatus("idle");
    } catch (error) {
      setCropState((current) => current ? {
        ...current,
        status: "error",
        message: error instanceof Error ? error.message : "Unable to crop that image.",
      } : current);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");
    const teamMode = mode === "existing" || (mode === "organization" && addFirstTeam);
    if (!form.organizationName.trim() && mode === "organization") {
      setStatus("error");
      setMessage("Organization name is required.");
      return;
    }
    if (mode === "organization" && (!form.organizationState || !form.organizationCity)) {
      setStatus("error");
      setMessage("State and city are required.");
      return;
    }
    if (teamMode && !form.teamName.trim()) {
      setStatus("error");
      setMessage("Team name is required.");
      return;
    }
    if (teamMode && mode === "existing" && !form.organizationId && (!form.teamState || !form.teamCity)) {
      setStatus("error");
      setMessage("State and city are required for teams without an organization.");
      return;
    }
    if (teamMode && !form.seasonName.trim()) {
      setStatus("error");
      setMessage("Season is required.");
      return;
    }
    try {
      if (mode === "organization" && !addFirstTeam) {
        await onCreateOrganization({
          organizationName: form.organizationName,
          city: form.organizationCity,
          state: form.organizationState,
          logoUrl: organizationLogoUrl,
          visibility: form.organizationVisibility,
        });
      } else {
        await onCreate({
          organizationId: mode === "existing" ? form.organizationId : undefined,
          organizationName: mode === "organization" ? form.organizationName : undefined,
          organizationCity: mode === "organization" ? form.organizationCity : undefined,
          organizationState: mode === "organization" ? form.organizationState : undefined,
          organizationLogoUrl: mode === "organization" ? organizationLogoUrl : undefined,
          organizationVisibility: mode === "organization" ? form.organizationVisibility : undefined,
          teamCity: form.teamCity,
          teamState: form.teamState,
          teamName: form.teamName,
          teamLevel: form.teamLevel,
          teamType: form.teamType,
          ageGroup: form.teamType === "School" ? undefined : form.teamLevel,
          visibility: form.teamVisibility,
          seasonName: form.seasonName,
        });
      }
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to create.");
    }
  }

  const createsTeam = mode === "existing" || addFirstTeam;
  const selectedOrganization = organizations.find((organization) => organization.id === form.organizationId);
  const modeLabel = mode === "existing" ? "Add Team" : "New Organization";
  const selectedOrganizationOptions = [
    { value: "", label: "No organization" },
    ...organizations.map((organization) => ({ value: organization.id, label: organization.name })),
  ];
  const teamLocationRequired = mode === "existing" && !form.organizationId;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Create team or organization">
      <form className="modal-panel team-creator-modal" onSubmit={submit}>
        <div className="modal-title">
          <div>
            <h2>{modeLabel}</h2>
          </div>
          <button className="icon-button modal-close-button" type="button" onClick={onClose} aria-label="Close">
            <X size={17} aria-hidden="true" />
          </button>
        </div>

        <div className="team-creator-segment" role="tablist" aria-label="Creation type">
          <button type="button" className={mode === "existing" ? "active" : ""} onClick={() => setMode("existing")}>
            Add Team
          </button>
          <button type="button" className={mode === "organization" ? "active" : ""} onClick={() => setMode("organization")}>
            New Organization
          </button>
        </div>

        <div className="team-creator-grid">
          {mode === "existing" ? (
            <div className="form-field team-creator-org-field team-creator-span">
              <span>Organization</span>
              <div className="team-creator-org-select">
                {selectedOrganization && <OrganizationLogo name={selectedOrganization.name} logoUrl={selectedOrganization.logoUrl} />}
                <ChoiceSelect
                  aria-label="Organization"
                  className="form-choice"
                  value={form.organizationId}
                  options={selectedOrganizationOptions}
                  onChange={(organizationId) => setForm((current) => ({ ...current, organizationId }))}
                />
              </div>
            </div>
          ) : (
            <>
              <div className="organization-logo-field">
                <button className="organization-logo-picker" type="button" onClick={() => logoInputRef.current?.click()} aria-label="Choose organization logo">
                  {organizationLogoUrl ? <img src={organizationLogoUrl} alt="" /> : <Upload size={18} aria-hidden="true" />}
                </button>
                <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoFile} />
              </div>
              <label className="form-field team-creator-span">
                <span>Organization Name</span>
                <input value={form.organizationName} onChange={(event) => setForm((current) => ({ ...current, organizationName: event.target.value }))} />
              </label>
              <div className="form-field">
                <span>State</span>
                <ChoiceSelect
                  aria-label="Organization state"
                  className="form-choice"
                  value={form.organizationState}
                  options={[{ value: "", label: "Select state" }, ...US_STATE_OPTIONS.map((state) => ({ value: state, label: state }))]}
                  onChange={(state) => updateState("organization", state)}
                />
              </div>
              <div className="form-field">
                <span>City</span>
                <ChoiceSelect
                  aria-label="Organization city"
                  className="form-choice"
                  value={form.organizationCity}
                  disabled={!form.organizationState}
                  options={[
                    { value: "", label: form.organizationState ? "Select city" : "Select state first" },
                    ...cityOptionsForState(form.organizationState).map((city) => ({ value: city, label: city })),
                  ]}
                  onChange={(city) => setForm((current) => ({ ...current, organizationCity: city }))}
                />
              </div>
              <div className="form-field team-creator-span">
                <span>Visibility</span>
                <ChoiceSelect
                  aria-label="Organization visibility"
                  className="form-choice"
                  value={form.organizationVisibility}
                  options={[
                    { value: "PUBLIC", label: "Public" },
                    { value: "UNLISTED", label: "Unlisted" },
                    { value: "PRIVATE", label: "Private" },
                  ]}
                  onChange={(organizationVisibility) => setForm((current) => ({ ...current, organizationVisibility }))}
                />
              </div>
              <button
                className={`add-first-team-toggle ${addFirstTeam ? "active" : ""}`}
                type="button"
                onClick={() => setAddFirstTeam((value) => !value)}
              >
                <Plus size={15} aria-hidden="true" />
                Add first team
              </button>
            </>
          )}
          {createsTeam && (
            <>
              <label className="form-field team-creator-span">
                <span>Team Name</span>
                <input value={form.teamName} onChange={(event) => setForm((current) => ({ ...current, teamName: event.target.value }))} />
              </label>
              <div className="form-field">
                <span>Team Type</span>
                <ChoiceSelect
                  aria-label="Team type"
                  className="form-choice"
                  value={form.teamType}
                  options={TEAM_TYPE_OPTIONS.map((type) => ({ value: type, label: type }))}
                  onChange={updateTeamType}
                />
              </div>
              <div className="form-field">
                <span>{form.teamType === "School" ? "Level" : "Age"}</span>
                <ChoiceSelect
                  aria-label="Team level"
                  className="form-choice"
                  value={form.teamLevel}
                  options={levelOptionsForTeamType(form.teamType).map((level) => ({ value: level, label: level }))}
                  onChange={(teamLevel) => setForm((current) => ({ ...current, teamLevel }))}
                />
              </div>
              <div className="form-field">
                <span>Season</span>
                <ChoiceSelect
                  aria-label="Season"
                  className="form-choice"
                  value={form.seasonName}
                  options={SEASON_OPTIONS.map((season) => ({ value: season, label: season }))}
                  onChange={(seasonName) => setForm((current) => ({ ...current, seasonName }))}
                />
              </div>
              <div className="form-field">
                <span>{teamLocationRequired ? "State" : "Team State"}</span>
                <ChoiceSelect
                  aria-label="Team state"
                  className="form-choice"
                  value={form.teamState}
                  options={[{ value: "", label: teamLocationRequired ? "Required" : "Optional" }, ...US_STATE_OPTIONS.map((state) => ({ value: state, label: state }))]}
                  onChange={(state) => updateState("team", state)}
                />
              </div>
              <div className="form-field">
                <span>{teamLocationRequired ? "City" : "Team City"}</span>
                <ChoiceSelect
                  aria-label="Team city"
                  className="form-choice"
                  value={form.teamCity}
                  disabled={!form.teamState}
                  options={[
                    { value: "", label: form.teamState ? (teamLocationRequired ? "Required" : "Optional") : "Select state first" },
                    ...cityOptionsForState(form.teamState).map((city) => ({ value: city, label: city })),
                  ]}
                  onChange={(city) => setForm((current) => ({ ...current, teamCity: city }))}
                />
              </div>
              {teamLocationRequired && (
                <div className="form-field">
                  <span>Visibility</span>
                  <ChoiceSelect
                    aria-label="Team visibility"
                    className="form-choice"
                    value={form.teamVisibility}
                    options={[
                      { value: "PUBLIC", label: "Public" },
                      { value: "UNLISTED", label: "Unlisted" },
                      { value: "PRIVATE", label: "Private" },
                    ]}
                    onChange={(teamVisibility) => setForm((current) => ({ ...current, teamVisibility }))}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {message && <span className="profile-save-message profile-save-message--error">{message}</span>}
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
          <button className="primary-button" type="submit" disabled={status === "saving"}>
            {status === "saving" ? "Creating..." : createsTeam ? "Create Team" : "Create Organization"}
          </button>
        </div>
        {cropState && (
          <AvatarCropModal
            title="Organization Logo"
            state={cropState}
            onChange={setCropState}
            onCancel={() => setCropState(null)}
            onPickDifferent={() => logoInputRef.current?.click()}
            onApply={() => void applyLogoCrop()}
          />
        )}
      </form>
    </div>
  );
}

function FollowingView({
  data,
  onOpenPublicTeam,
  onOpenPublicOrganization,
  onTogglePublicTeamFollow,
  onTogglePublicOrganizationFollow,
  onCreateTeam,
}: {
  data: AppData;
  onOpenPublicTeam: (team: PublicDirectoryTeamSummary) => void;
  onOpenPublicOrganization: (organization: PublicDirectoryOrganizationSummary) => void;
  onTogglePublicTeamFollow: (team: PublicDirectoryTeamSummary) => void | Promise<void>;
  onTogglePublicOrganizationFollow: (organization: PublicDirectoryOrganizationSummary) => void | Promise<void>;
  onCreateTeam: () => void;
}) {
  const followedTeams = followedPublicTeams(data);
  const followedOrganizations = followedPublicOrganizations(data);
  return (
    <div className="page-stack global-home">
      <SectionHeader
        title="Following"
        action={
          <button className="primary-button" type="button" onClick={onCreateTeam}>
            <Plus size={16} aria-hidden="true" />
            New Team/Org
          </button>
        }
      />
      {followedTeams.length || followedOrganizations.length ? (
        <>
          {followedTeams.length > 0 && (
            <section className="global-section">
              <SectionHeader title="Teams" />
              <div className="followed-team-grid">
                {followedTeams.map((team) => (
                  <PublicTeamFollowCard
                    key={team.id}
                    team={team}
                    followed={isFollowingTeam(data.profileFollows ?? [], team.id)}
                    onOpenTeam={onOpenPublicTeam}
                    onToggleFollow={onTogglePublicTeamFollow}
                  />
                ))}
              </div>
            </section>
          )}
          {followedOrganizations.length > 0 && (
            <section className="global-section">
              <SectionHeader title="Organizations" />
              <div className="followed-organization-grid">
                {followedOrganizations.map((organization) => (
                  <PublicOrganizationFollowCard
                    key={organization.id}
                    organization={organization}
                    followed={isFollowingOrganization(data.profileFollows ?? [], organization.id)}
                    onOpenTeam={onOpenPublicTeam}
                    onOpenOrganization={onOpenPublicOrganization}
                    isTeamFollowed={(team) => isFollowingTeam(data.profileFollows ?? [], team.id)}
                    onToggleTeamFollow={onTogglePublicTeamFollow}
                    onToggleOrganizationFollow={onTogglePublicOrganizationFollow}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <CompactEmpty title="No followed teams yet" action={<span className="muted-copy">Public team discovery is ready for visibility-controlled teams.</span>} />
      )}
    </div>
  );
}

function DiscoverView({
  data,
  onEnterTeam,
  onOpenPublicTeam,
  onOpenPublicOrganization,
  onTogglePublicTeamFollow,
  onCreateTeam,
}: {
  data: AppData;
  onEnterTeam: (team: TeamOption) => void | Promise<void>;
  onOpenPublicTeam: (team: PublicDirectoryTeamSummary) => void;
  onOpenPublicOrganization: (organization: PublicDirectoryOrganizationSummary) => void;
  onTogglePublicTeamFollow: (team: PublicDirectoryTeamSummary) => void | Promise<void>;
  onCreateTeam: () => void;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const visibleTeams = displayWorkspaceTeams(data.teamContext?.availableTeams ?? []);
  const organizations = organizationSummariesFromContext(data.teamContext).filter((organization) =>
    !needle || `${organization.name} ${organization.location ?? ""} ${organization.teams.map((team) => team.teamName).join(" ")}`.toLowerCase().includes(needle),
  );
  const teams = visibleTeams.filter((team) =>
    !needle || `${team.organizationName} ${team.teamName} ${team.seasonName ?? ""}`.toLowerCase().includes(needle),
  );
  const managedOrganizationKeys = new Set(
    organizations.flatMap((organization) => [
      organization.id,
      organization.slug ?? "",
      organization.name.trim().toLowerCase(),
    ]),
  );
  const publicOrganizations = (data.publicOrganizations ?? []).filter((organization) => {
    const duplicateManagedOrganization = managedOrganizationKeys.has(organization.id) ||
      (organization.slug ? managedOrganizationKeys.has(organization.slug) : false) ||
      managedOrganizationKeys.has(organization.name.trim().toLowerCase());
    return !duplicateManagedOrganization && (!needle || publicOrganizationSearchText(organization).includes(needle));
  });
  const publicTeams = (data.publicTeams ?? []).filter((team) => !needle || publicTeamSearchText(team).includes(needle));

  return (
    <div className="page-stack global-home">
      <SectionHeader
        title="Discover"
        action={
          <button className="primary-button" type="button" onClick={onCreateTeam}>
            <Plus size={16} aria-hidden="true" />
            New Team/Org
          </button>
        }
      />
      <label className="global-discover-search">
        <Search size={17} aria-hidden="true" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search teams or organizations..." />
      </label>
      <section className="discover-grid discover-grid--two">
        <article className="panel compact-panel">
          <div className="panel-heading tight"><div><h2>Organizations</h2></div></div>
          <div className="compact-list">
            {organizations.length ? organizations.map((organization) => (
              <OrganizationMiniRow key={organization.id} organization={organization} onEnterTeam={onEnterTeam} />
            )) : null}
            {publicOrganizations.length ? publicOrganizations.map((organization) => (
              <PublicOrganizationMiniRow
                key={organization.id}
                organization={organization}
                onOpenOrganization={onOpenPublicOrganization}
              />
            )) : null}
            {!organizations.length && !publicOrganizations.length && <CompactEmpty title="No organizations found" />}
          </div>
        </article>
        <article className="panel compact-panel">
          <div className="panel-heading tight"><div><h2>Teams</h2></div></div>
          <div className="compact-list">
            {teams.length ? teams.map((team) => (
              <TeamMiniRow key={teamValue(team)} team={team} onEnterTeam={onEnterTeam} />
            )) : null}
            {publicTeams.length ? publicTeams.map((team) => (
              <PublicTeamMiniRow
                key={team.id}
                team={team}
                followed={isFollowingTeam(data.profileFollows ?? [], team.id)}
                onOpenTeam={onOpenPublicTeam}
                onToggleFollow={onTogglePublicTeamFollow}
              />
            )) : null}
            {!teams.length && !publicTeams.length && <CompactEmpty title="No teams found" />}
          </div>
        </article>
      </section>
    </div>
  );
}

type OrganizationSummary = {
  id: ID;
  name: string;
  slug?: string;
  teams: TeamOption[];
  location?: string;
  logoUrl?: string;
  role?: string;
};

type GlobalSearchResults = {
  organizations: OrganizationSummary[];
  publicOrganizations: PublicDirectoryOrganizationSummary[];
  teams: TeamOption[];
  publicTeams: PublicDirectoryTeamSummary[];
  players: Player[];
};

function OrganizationCard({
  organization,
  onEnterTeam,
  onOpenOrganization,
  onCreateTeam,
  expanded = false,
}: {
  organization: OrganizationSummary;
  onEnterTeam: (team: TeamOption) => void | Promise<void>;
  onOpenOrganization?: (organization: OrganizationSummary) => void;
  onCreateTeam?: (organizationId?: ID) => void;
  expanded?: boolean;
}) {
  const firstTeam = organization.teams[0];
  const visibleChips = organization.teams.slice(0, expanded ? 6 : 3);
  const extraTeams = Math.max(organization.teams.length - visibleChips.length, 0);
  return (
    <article className={`panel organization-card organization-card--compact ${expanded ? "organization-card--expanded" : ""}`}>
      <button
        className="organization-card__top"
        type="button"
        onClick={() => {
          if (onOpenOrganization) onOpenOrganization(organization);
          else if (firstTeam) void onEnterTeam(firstTeam);
        }}
      >
        <OrganizationLogo name={organization.name} logoUrl={organization.logoUrl} />
        <span>
          <strong>{organization.name}</strong>
          <small>{organization.location ? `${organization.location} - ` : ""}{organization.teams.length} team{organization.teams.length === 1 ? "" : "s"}</small>
        </span>
        <ChevronRight size={16} aria-hidden="true" />
      </button>
      {visibleChips.length ? (
        <div className="team-chip-row">
          {visibleChips.map((team) => (
            <button key={teamValue(team)} type="button" onClick={() => void onEnterTeam(team)}>
              {team.teamLevel ?? shortTeamName(team.teamName)}
            </button>
          ))}
          {extraTeams > 0 && <span>+{extraTeams} more</span>}
        </div>
      ) : (
        <div className="team-chip-row"><span>No teams yet</span></div>
      )}
      {onOpenOrganization && (
        <button className="text-button organization-open-button" type="button" onClick={() => onOpenOrganization(organization)}>
          Open Organization
        </button>
      )}
      {expanded && onCreateTeam && (
        <button className="secondary-button organization-add-team-button" type="button" onClick={() => onCreateTeam(organization.id)}>
          <Plus size={15} aria-hidden="true" />
          Add Team
        </button>
      )}
    </article>
  );
}

function ManagedTeamCard({
  team,
  context,
  pinnedTeams,
  onEnterTeam,
  onTogglePinnedTeam,
}: {
  team: TeamOption;
  context?: TeamContext;
  pinnedTeams?: ProfileTeamPin[];
  onEnterTeam: (team: TeamOption) => void | Promise<void>;
  onTogglePinnedTeam?: (team: TeamOption) => void | Promise<void>;
}) {
  const pinned = isPinnedTeam(pinnedTeams, team);
  const metadata = [team.organizationName, team.seasonName ?? "Current season"].filter(Boolean).join(" - ");
  return (
    <article className="panel managed-team-card">
      <button className="managed-team-card__main" type="button" onClick={() => void onEnterTeam(team)}>
        <OrganizationLogo name={team.organizationName} logoUrl={team.logoUrl ?? teamOrganizationLogo(team, context)} />
        <span>
          <strong>{team.teamName}</strong>
          <small>{metadata}</small>
        </span>
      </button>
      {onTogglePinnedTeam && (
        <button
          className={`pin-team-button${pinned ? " pin-team-button--active" : ""}`}
          type="button"
          aria-label={pinned ? `Unpin ${team.teamName}` : `Pin ${team.teamName}`}
          title={pinned ? "Pinned to sidebar" : "Pin to sidebar"}
          onClick={() => void onTogglePinnedTeam(team)}
        >
          <Pin size={14} aria-hidden="true" />
        </button>
      )}
      <ChevronRight className="managed-team-card__chevron" size={18} aria-hidden="true" />
    </article>
  );
}

function ManagedOrganizationTeamCard({
  organization,
  onEnterTeam,
  onOpenOrganization,
  pinnedTeams,
  onTogglePinnedTeam,
}: {
  organization: OrganizationSummary;
  onEnterTeam: (team: TeamOption) => void | Promise<void>;
  onOpenOrganization?: (organization: OrganizationSummary) => void;
  pinnedTeams?: ProfileTeamPin[];
  onTogglePinnedTeam?: (team: TeamOption) => void | Promise<void>;
}) {
  return (
    <article className="panel organization-team-card">
      <div className="organization-team-card__header organization-team-card__header--actionable">
        <button
          className="organization-team-card__main"
          type="button"
          onClick={() => onOpenOrganization ? onOpenOrganization(organization) : organization.teams[0] && void onEnterTeam(organization.teams[0])}
        >
          <OrganizationLogo name={organization.name} logoUrl={organization.logoUrl} />
          <span>
            <strong>{organization.name}</strong>
            <small>{organization.teams.length} team{organization.teams.length === 1 ? "" : "s"}</small>
          </span>
        </button>
        <span className="follow-heart follow-heart--locked" aria-label="Managed organization">
          <Lock size={13} aria-hidden="true" />
        </span>
      </div>
      <div className="organization-team-card__list">
        {organization.teams.length ? organization.teams.map((team) => (
          <div key={teamValue(team)} className="organization-team-row organization-team-row--managed">
            <button className="organization-team-row__main" type="button" onClick={() => void onEnterTeam(team)}>
              <span>
                <strong>{team.teamName}</strong>
                <small>{team.seasonName ?? "Current season"}</small>
              </span>
            </button>
            {onTogglePinnedTeam && (
              <button
                className={`pin-team-button${isPinnedTeam(pinnedTeams, team) ? " pin-team-button--active" : ""}`}
                type="button"
                aria-label={isPinnedTeam(pinnedTeams, team) ? `Unpin ${team.teamName}` : `Pin ${team.teamName}`}
                title={isPinnedTeam(pinnedTeams, team) ? "Pinned to sidebar" : "Pin to sidebar"}
                onClick={(event) => {
                  event.stopPropagation();
                  void onTogglePinnedTeam(team);
                }}
              >
                <Pin size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        )) : <CompactEmpty title="No teams yet" />}
      </div>
    </article>
  );
}

function PublicOrganizationFollowCard({
  organization,
  followed,
  onOpenTeam,
  onOpenOrganization,
  isTeamFollowed,
  onToggleTeamFollow,
  onToggleOrganizationFollow,
}: {
  organization: PublicDirectoryOrganizationSummary;
  followed: boolean;
  onOpenTeam: (team: PublicDirectoryTeamSummary) => void;
  onOpenOrganization: (organization: PublicDirectoryOrganizationSummary) => void;
  isTeamFollowed: (team: PublicDirectoryTeamSummary) => boolean;
  onToggleTeamFollow: (team: PublicDirectoryTeamSummary) => void | Promise<void>;
  onToggleOrganizationFollow: (organization: PublicDirectoryOrganizationSummary) => void | Promise<void>;
}) {
  return (
    <article className="panel organization-team-card">
      <div className="organization-team-card__header organization-team-card__header--actionable">
        <button className="organization-team-card__main" type="button" onClick={() => onOpenOrganization(organization)}>
          <OrganizationLogo name={organization.name} logoUrl={organization.logoUrl} />
          <span>
            <strong>{organization.name}</strong>
            <small>{organizationLocation(organization) || `${organization.teams.length} teams`}</small>
          </span>
        </button>
        <FollowButton
          followed={followed}
          label={followed ? `Unfollow ${organization.name}` : `Follow ${organization.name}`}
          onClick={() => void onToggleOrganizationFollow(organization)}
        />
      </div>
      {organization.teams.length > 0 && (
        <div className="organization-team-card__list">
          {organization.teams.map((team) => {
            const teamFollowed = isTeamFollowed(team);
            return (
              <div key={team.id} className="organization-team-row">
                <button type="button" onClick={() => onOpenTeam(team)}>
                  <span>
                    <strong>{team.name}</strong>
                    <small>{team.seasonName ?? "Current season"}</small>
                  </span>
                </button>
                <FollowButton
                  followed={teamFollowed}
                  label={teamFollowed ? `Unfollow ${team.name}` : `Follow ${team.name}`}
                  onClick={() => void onToggleTeamFollow(team)}
                />
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

function PublicTeamFollowCard({
  team,
  followed,
  onOpenTeam,
  onToggleFollow,
}: {
  team: PublicDirectoryTeamSummary;
  followed: boolean;
  onOpenTeam: (team: PublicDirectoryTeamSummary) => void;
  onToggleFollow: (team: PublicDirectoryTeamSummary) => void | Promise<void>;
}) {
  const metadata = [team.organizationName, team.seasonName ?? "Current season"].filter(Boolean).join(" - ");
  return (
    <article className="panel public-follow-team-card">
      <button className="public-follow-team-card__main" type="button" onClick={() => onOpenTeam(team)}>
        <OrganizationLogo name={team.organizationName} logoUrl={team.logoUrl} />
        <span>
          <strong>{team.name}</strong>
          <small>{metadata}</small>
        </span>
      </button>
      <FollowButton
        followed={followed}
        label={followed ? `Unfollow ${team.name}` : `Follow ${team.name}`}
        onClick={() => void onToggleFollow(team)}
      />
    </article>
  );
}

function OrganizationMiniRow({ organization, onEnterTeam }: { organization: OrganizationSummary; onEnterTeam: (team: TeamOption) => void | Promise<void> }) {
  const subtitle = organization.location || `${organization.teams.length} team${organization.teams.length === 1 ? "" : "s"}`;
  return (
    <button className="team-mini-row" type="button" onClick={() => organization.teams[0] && void onEnterTeam(organization.teams[0])}>
      <OrganizationLogo name={organization.name} />
      <span><strong>{organization.name}</strong><small>{subtitle}</small></span>
      <ChevronRight size={15} aria-hidden="true" />
    </button>
  );
}

function TeamMiniRow({
  team,
  onEnterTeam,
}: {
  team: TeamOption;
  onEnterTeam: (team: TeamOption) => void | Promise<void>;
}) {
  return (
    <button className="team-mini-row" type="button" onClick={() => void onEnterTeam(team)}>
      <OrganizationLogo name={team.organizationName} />
      <span><strong>{team.teamName}</strong><small>{team.seasonName ?? "Current season"} - {team.organizationName}</small></span>
      <ChevronRight size={15} aria-hidden="true" />
    </button>
  );
}

function PublicOrganizationMiniRow({
  organization,
  onOpenOrganization,
}: {
  organization: PublicDirectoryOrganizationSummary;
  onOpenOrganization: (organization: PublicDirectoryOrganizationSummary) => void;
}) {
  return (
    <div className="team-mini-row team-mini-row--public-organization">
      <button className="team-mini-row__main team-mini-row__main--with-chevron" type="button" onClick={() => onOpenOrganization(organization)}>
        <OrganizationLogo name={organization.name} logoUrl={organization.logoUrl} />
        <span><strong>{organization.name}</strong><small>{organizationLocation(organization) || `${organization.teams.length} teams`}</small></span>
        <ChevronRight size={15} aria-hidden="true" />
      </button>
    </div>
  );
}

function PublicTeamMiniRow({
  team,
  followed,
  onOpenTeam,
  onToggleFollow,
}: {
  team: PublicDirectoryTeamSummary;
  followed: boolean;
  onOpenTeam: (team: PublicDirectoryTeamSummary) => void;
  onToggleFollow: (team: PublicDirectoryTeamSummary) => void | Promise<void>;
}) {
  return (
    <div className="team-mini-row team-mini-row--follow">
      <button className="team-mini-row__main" type="button" onClick={() => onOpenTeam(team)}>
        <OrganizationLogo name={team.organizationName} />
        <span><strong>{team.name}</strong><small>{team.seasonName ?? team.organizationName}</small></span>
      </button>
      <FollowButton
        followed={followed}
        label={followed ? `Unfollow ${team.name}` : `Follow ${team.name}`}
        onClick={() => void onToggleFollow(team)}
      />
    </div>
  );
}

function FollowButton({
  followed,
  label,
  onClick,
}: {
  followed: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={`follow-heart ${followed ? "follow-heart--active" : ""}`} type="button" aria-label={label} onClick={onClick}>
      <Heart size={15} aria-hidden="true" fill={followed ? "currentColor" : "none"} />
    </button>
  );
}

function FollowSummary({
  data,
  onOpenPublicTeam,
  onTogglePublicTeamFollow,
}: {
  data: AppData;
  onOpenPublicTeam: (team: PublicDirectoryTeamSummary) => void;
  onTogglePublicTeamFollow: (team: PublicDirectoryTeamSummary) => void | Promise<void>;
}) {
  const teams = followedPublicTeams(data);
  if (!teams.length) return <CompactEmpty title="No followed teams yet" />;
  return (
    <div className="followed-team-grid followed-team-grid--summary">
      {teams.slice(0, 3).map((team) => (
        <PublicTeamFollowCard
          key={team.id}
          team={team}
          followed={isFollowingTeam(data.profileFollows ?? [], team.id)}
          onOpenTeam={onOpenPublicTeam}
          onToggleFollow={onTogglePublicTeamFollow}
        />
      ))}
    </div>
  );
}

function OrganizationLogo({ name, logoUrl, imageUrl, size = "md" }: { name: string; logoUrl?: string; imageUrl?: string; size?: "sm" | "md" | "lg" }) {
  const metrolina = /metrolina/i.test(name);
  const resolvedLogoUrl = logoUrl ?? imageUrl;
  return (
    <span className={`organization-logo organization-logo--${size}`} aria-hidden="true">
      {resolvedLogoUrl ? <img src={resolvedLogoUrl} alt="" /> : metrolina ? <img src="/brand/metrolina-baseball-alpha.png" alt="" /> : initialsFor(name)}
    </span>
  );
}

function organizationSummariesFromContext(context?: TeamContext) {
  const organizations = new Map<ID, OrganizationSummary>();
  for (const organization of context?.organizations ?? []) {
    const location = [organization.city, organization.state].filter(Boolean).join(", ") || undefined;
    organizations.set(organization.id, {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      teams: [],
      location,
      logoUrl: organization.logoUrl,
      role: organization.role,
    });
  }
  for (const team of displayWorkspaceTeams(context?.availableTeams ?? [])) {
    if (!team.organizationId) continue;
    const current = organizations.get(team.organizationId) ?? {
      id: team.organizationId,
      name: team.organizationName,
      teams: [],
    };
    current.teams.push(team);
    organizations.set(team.organizationId, current);
  }
  return [...organizations.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function displayWorkspaceTeams(teams: TeamOption[]) {
  const visible = teams.filter((team) => !isProgramContainerTeam(team));
  return visible.length ? visible : teams;
}

function isProgramContainerTeam(team: TeamOption) {
  const level = (team.teamLevel ?? "").trim().toLowerCase();
  const name = team.teamName.trim().toLowerCase();
  return level === "program" || name === "baseball" || name.endsWith(" baseball program") || name.includes(" program");
}

function uniquePlayers(players: Player[]) {
  const seen = new Set<ID>();
  return players.filter((player) => {
    if (seen.has(player.id)) return false;
    seen.add(player.id);
    return true;
  });
}

function shortTeamName(name: string) {
  if (/varsity/i.test(name)) return "Varsity";
  if (/\bjv\b/i.test(name)) return "JV";
  return name.replace(/^Metrolina\s+/i, "");
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
  weeklyMvp,
  weightLeader,
  onView,
  onOpenPlayer,
  onStartPractice,
  onStartGame,
}: {
  data: AppData;
  weeklyMvp?: AwardResult;
  weightLeader?: WeightLeaderResult;
  onView: (view: ViewKey) => void;
  onOpenPlayer: (playerId: ID) => void;
  onStartPractice: () => void;
  onStartGame: () => void;
}) {
  const scheduleItems = buildScheduleItems(data);
  const today = todayKey();
  const nextItems = scheduleItems.filter((item) => isUpcomingScheduleItem(item) && item.status !== "Cancelled").slice(0, 5);
  const todaysPractice = nextItems.find((item) => item.eventType === "Practice" && item.date === today);
  const nextPractice = todaysPractice ?? nextItems.find((item) => item.eventType === "Practice");
  const nextGame = nextItems.find((item) => item.eventType === "Game");
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
          title={todaysPractice ? "Today's Practice" : "Next Practice"}
          primary={nextPractice ? formatTime(nextPractice.startAt) : "No practice scheduled"}
          meta={nextPractice ? [nextPractice.title, nextPractice.location].filter(Boolean).join(" - ") : "Create the next practice when ready"}
          onClick={nextPractice ? () => onView(nextPractice.source === "practice" ? "practice" : "schedule") : onStartPractice}
          cta={nextPractice ? "Open" : "Start"}
        />
        <HomeInfoCard
          icon={BaseballIcon}
          title="Next Game"
          primary={nextGame ? nextGame.title : "No game scheduled"}
          meta={nextGame ? `${shortDate(nextGame.date)} - ${nextGame.location ?? "Location TBD"}` : "Create the next game when ready"}
          onClick={nextGame ? () => onView("games") : onStartGame}
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
        <UpcomingScheduleCard items={nextItems} onView={onView} />
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

function ScheduleView({
  data,
  onAddEvent,
  onView,
  onOpenGame,
  onUpdateScheduleEvent,
}: {
  data: AppData;
  onAddEvent: (date?: string) => void;
  onView: (view: ViewKey) => void;
  onOpenGame: (gameId: ID) => void;
  onUpdateScheduleEvent: (event: ScheduleEvent) => void;
}) {
  const [mode, setMode] = useState<ScheduleViewMode>(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches ? "Agenda" : "Calendar",
  );
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedItem, setSelectedItem] = useState<ScheduleItem | null>(null);
  const [eventFilter, setEventFilter] = useState<ScheduleEventFilter>("All");
  const items = useMemo(() => buildScheduleItems(data), [data]);
  const visibleItems = useMemo(
    () => eventFilter === "All" ? items : items.filter((item) => item.eventType === eventFilter),
    [eventFilter, items],
  );
  const upcomingItems = visibleItems.filter((item) => isUpcomingScheduleItem(item) && item.status !== "Cancelled").slice(0, 6);
  const cursorMonthLabel = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const selectedVisibleItem = selectedItem && visibleItems.some((item) => item.id === selectedItem.id) ? selectedItem : null;
  const filterOptions: ChoiceOption[] = useMemo(() => [
    { value: "All", label: "All Events", icon: <CalendarDays size={15} aria-hidden="true" /> },
    ...SCHEDULE_EVENT_TYPES.map((type) => ({ value: type, label: type, icon: <ScheduleTypeIcon type={type} /> })),
  ], []);

  function moveCursor(amount: number) {
    setCursor((current) => {
      const next = new Date(current);
      if (mode === "Week") next.setDate(next.getDate() + amount * 7);
      else next.setMonth(next.getMonth() + amount);
      return next;
    });
  }

  return (
    <div className="page-stack schedule-page">
      <SectionHeader
        title="Schedule"
        context={teamContextLine(data.teamContext?.currentTeam)}
        action={(
          <button type="button" className="primary-button" onClick={() => onAddEvent()}>
            <CalendarPlus size={16} aria-hidden="true" />
            Add Event
          </button>
        )}
      />

      <section className="panel schedule-toolbar">
        <div className="schedule-toolbar__date">
          <button type="button" className="icon-button schedule-period-button" onClick={() => moveCursor(-1)} aria-label="Previous period"><ChevronLeft size={17} aria-hidden="true" /></button>
          <strong>{mode === "Week" ? weekRangeLabel(cursor) : cursorMonthLabel}</strong>
          <button type="button" className="icon-button schedule-period-button" onClick={() => moveCursor(1)} aria-label="Next period"><ChevronRight size={17} aria-hidden="true" /></button>
        </div>
        <div className="schedule-toolbar__controls">
          <ChoiceSelect
            value={eventFilter}
            className="schedule-filter-choice"
            options={filterOptions}
            onChange={(value) => {
              setEventFilter(value as ScheduleEventFilter);
              setSelectedItem(null);
            }}
            aria-label="Filter schedule by event type"
          />
          <SegmentedControl values={["Calendar", "Week", "Agenda"] as ScheduleViewMode[]} active={mode} onChange={setMode} />
          <button type="button" className="secondary-button" onClick={() => setCursor(new Date())}>Today</button>
        </div>
      </section>

      <section className="schedule-layout">
        <div className="schedule-main">
          {mode === "Calendar" && <ScheduleMonthView cursor={cursor} items={visibleItems} onSelect={setSelectedItem} onAddEvent={onAddEvent} />}
          {mode === "Week" && <ScheduleWeekView cursor={cursor} items={visibleItems} onSelect={setSelectedItem} />}
          {mode === "Agenda" && <ScheduleAgendaView items={visibleItems} onSelect={setSelectedItem} />}
        </div>
        <aside className="schedule-side">
          <article className="panel schedule-next-card">
            <div className="panel-heading tight">
              <div>
                <span>Next Up</span>
                <h2>Upcoming</h2>
              </div>
              <button type="button" className="text-button" onClick={() => setMode("Agenda")}>Agenda</button>
            </div>
            {upcomingItems.length ? upcomingItems.map((item) => (
              <button key={item.id} type="button" className="schedule-mini-row" onClick={() => setSelectedItem(item)}>
                <ScheduleTypeIcon type={item.eventType} />
                <span>
                  <strong>{item.title}</strong>
                  <small>{shortDate(item.date)} · {formatTime(item.startAt)}</small>
                </span>
              </button>
            )) : (
              <CompactEmpty title="No events scheduled yet." />
            )}
          </article>
          <ScheduleDetailCard
            data={data}
            item={selectedVisibleItem}
            onView={onView}
            onOpenGame={onOpenGame}
            onUpdateScheduleEvent={onUpdateScheduleEvent}
          />
        </aside>
      </section>
    </div>
  );
}

function ScheduleMonthView({
  cursor,
  items,
  onSelect,
  onAddEvent,
}: {
  cursor: Date;
  items: ScheduleItem[];
  onSelect: (item: ScheduleItem) => void;
  onAddEvent: (date?: string) => void;
}) {
  const days = calendarDaysForMonth(cursor);
  const currentMonth = cursor.getMonth();
  return (
    <article className="panel schedule-calendar">
      <div className="schedule-calendar__weekdays">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="schedule-calendar__grid">
        {days.map((date) => {
          const dateKey = isoDate(date);
          const dayItems = items.filter((item) => item.date === dateKey);
          return (
            <div
              key={dateKey}
              className={`schedule-day ${date.getMonth() !== currentMonth ? "schedule-day--muted" : ""} ${isToday(dateKey) ? "schedule-day--today" : ""}`}
              onDoubleClick={(event) => {
                if ((event.target as HTMLElement).closest("button")) return;
                onAddEvent(dateKey);
              }}
            >
              <span className="schedule-day__number">{date.getDate()}</span>
              <div className="schedule-day__events">
                {dayItems.slice(0, 3).map((item) => (
                  <button key={item.id} type="button" className={`schedule-chip schedule-chip--${item.accent}`} onClick={() => onSelect(item)}>
                    <small>{formatTime(item.startAt)}</small>
                    <span>{item.title}</span>
                  </button>
                ))}
                {dayItems.length > 3 && <em>+{dayItems.length - 3} more</em>}
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function ScheduleWeekView({ cursor, items, onSelect }: { cursor: Date; items: ScheduleItem[]; onSelect: (item: ScheduleItem) => void }) {
  const days = weekDates(cursor);
  return (
    <article className="panel schedule-week">
      {days.map((date) => {
        const dateKey = isoDate(date);
        const dayItems = items.filter((item) => item.date === dateKey);
        return (
          <section key={dateKey} className={`schedule-week-day ${isToday(dateKey) ? "schedule-week-day--today" : ""}`}>
            <header>
              <strong>{date.toLocaleDateString("en-US", { weekday: "short" })}</strong>
              <span>{date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
            </header>
            <div>
              {dayItems.length ? dayItems.map((item) => (
                <button key={item.id} type="button" className={`schedule-week-event schedule-chip--${item.accent}`} onClick={() => onSelect(item)}>
                  <small>{formatTime(item.startAt)}</small>
                  <strong>{item.title}</strong>
                  {item.location && <em>{item.location}</em>}
                </button>
              )) : <span className="schedule-week-empty">No events</span>}
            </div>
          </section>
        );
      })}
    </article>
  );
}

function ScheduleAgendaView({ items, onSelect }: { items: ScheduleItem[]; onSelect: (item: ScheduleItem) => void }) {
  const upcoming = items.filter((item) => !isPastScheduleItem(item) || item.status !== "Completed").slice(0, 30);
  const groups = groupScheduleItemsByDate(upcoming.length ? upcoming : items.slice(0, 20));
  return (
    <article className="panel schedule-agenda">
      {groups.length ? groups.map((group) => (
        <section key={group.date} className="schedule-agenda-group">
          <h3>{agendaDateLabel(group.date)}</h3>
          {group.items.map((item) => (
            <button key={item.id} type="button" className="schedule-agenda-row" onClick={() => onSelect(item)}>
              <time>{formatTime(item.startAt)}</time>
              <ScheduleTypeIcon type={item.eventType} />
              <span>
                <strong>{item.title}</strong>
                <small>{item.eventType}{item.location ? ` · ${item.location}` : ""}</small>
              </span>
              <em className={`schedule-status schedule-status--${item.status.toLowerCase()}`}>{item.status}</em>
            </button>
          ))}
        </section>
      )) : (
        <CompactEmpty title="No events scheduled yet." />
      )}
    </article>
  );
}

function ScheduleDetailCard({
  data,
  item,
  onView,
  onOpenGame,
  onUpdateScheduleEvent,
}: {
  data: AppData;
  item: ScheduleItem | null;
  onView: (view: ViewKey) => void;
  onOpenGame: (gameId: ID) => void;
  onUpdateScheduleEvent: (event: ScheduleEvent) => void;
}) {
  if (!item) {
    return (
      <article className="panel schedule-detail-card">
        <CompactEmpty title="Select an event to see details." />
      </article>
    );
  }
  const genericEvent = item.source === "event" ? (data.scheduleEvents ?? []).find((event) => event.id === item.sourceId) : undefined;
  return (
    <article className="panel schedule-detail-card">
      <div className="schedule-detail-card__top">
        <ScheduleTypeIcon type={item.eventType} />
        <span>
          <small>{item.eventType}</small>
          <strong>{item.title}</strong>
        </span>
        <em className={`schedule-status schedule-status--${item.status.toLowerCase()}`}>{item.status}</em>
      </div>
      <div className="schedule-detail-list">
        <span><CalendarDays size={15} aria-hidden="true" />{fullDate(item.date)}</span>
        <span><ClockIcon />{formatTime(item.startAt)}{item.endAt ? ` - ${formatTime(item.endAt)}` : ""}</span>
        {item.location && <span><MapPin size={15} aria-hidden="true" />{item.location}</span>}
        {item.notes && <p>{item.notes}</p>}
      </div>
      <div className="schedule-detail-actions">
        {item.source === "practice" && <button type="button" className="primary-button" onClick={() => onView("practice")}>Open Practice</button>}
        {item.source === "game" && <button type="button" className="primary-button" onClick={() => onOpenGame(item.sourceId)}>View Game</button>}
        {item.source === "lift" && <button type="button" className="primary-button" onClick={() => onView("weights")}>Open Weight Room</button>}
        {genericEvent && genericEvent.status !== "Cancelled" && (
          <button type="button" className="secondary-button" onClick={() => onUpdateScheduleEvent({ ...genericEvent, status: "Cancelled", updatedAt: new Date().toISOString() })}>
            Cancel Event
          </button>
        )}
      </div>
    </article>
  );
}

function ScheduleTypeIcon({ type }: { type: ScheduleEventType }) {
  const className = `schedule-type-icon schedule-type-icon--${SCHEDULE_EVENT_ACCENTS[type]}`;
  if (type === "Practice") return <span className={className}><ClipboardList size={16} aria-hidden="true" /></span>;
  if (type === "Game") return <span className={className}><BaseballIcon size={16} aria-hidden="true" /></span>;
  if (type === "Lift") return <span className={className}><Dumbbell size={16} aria-hidden="true" /></span>;
  if (type === "Scrimmage") return <span className={className}><Swords size={16} aria-hidden="true" /></span>;
  if (type === "Tournament") return <span className={className}><Trophy size={16} aria-hidden="true" /></span>;
  if (type === "Meeting" || type === "Team Event") return <span className={className}><Handshake size={16} aria-hidden="true" /></span>;
  if (type === "Other") return <span className={className}><Sparkles size={16} aria-hidden="true" /></span>;
  return <span className={className}><CalendarDays size={16} aria-hidden="true" /></span>;
}

function ClockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function DatePickerField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<ScheduleDateFieldMode>("desktop");
  const [cursor, setCursor] = useState(() => monthCursor(value));
  const rootRef = useRef<HTMLDivElement | null>(null);
  const nativeInputRef = useRef<HTMLInputElement | null>(null);
  const today = todayKey();
  const monthDays = useMemo(() => calendarDaysForMonth(cursor), [cursor]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const query = window.matchMedia("(max-width: 720px), (pointer: coarse) and (max-width: 900px)");
    const update = () => setPickerMode(query.matches ? "native" : "desktop");
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  function moveMonth(amount: number) {
    setCursor((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  }

  function openPicker() {
    if (pickerMode === "native") {
      const nativeInput = nativeInputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
      if (nativeInput?.showPicker) {
        nativeInput.focus();
        nativeInput.showPicker();
        return;
      }
    }
    setCursor(monthCursor(value));
    setOpen((current) => !current);
  }

  function chooseDate(nextValue: string) {
    onChange(nextValue);
    setCursor(monthCursor(nextValue));
    setOpen(false);
  }

  function handleBlur() {
    window.setTimeout(() => {
      if (!rootRef.current?.contains(document.activeElement)) setOpen(false);
    }, 0);
  }

  return (
    <div ref={rootRef} className="form-field schedule-control-field schedule-picker-field" onBlur={handleBlur}>
      <span>{label}</span>
      <span className="schedule-input-shell schedule-picker-anchor">
        <CalendarDays size={15} aria-hidden="true" />
        <button type="button" className="schedule-picker-button" onClick={openPicker} aria-haspopup="dialog" aria-expanded={open}>
          {formatPickerDate(value)}
        </button>
        <input
          ref={nativeInputRef}
          className="schedule-native-picker"
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={label}
          tabIndex={-1}
        />
      </span>
      {open && pickerMode === "desktop" && (
        <div className="schedule-date-popover" role="dialog" aria-label={`${label} picker`}>
          <div className="schedule-date-popover__header">
            <button type="button" className="schedule-picker-nav" onClick={() => moveMonth(-1)} aria-label="Previous month"><ChevronLeft size={15} aria-hidden="true" /></button>
            <strong>{cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</strong>
            <button type="button" className="schedule-picker-nav" onClick={() => moveMonth(1)} aria-label="Next month"><ChevronRight size={15} aria-hidden="true" /></button>
          </div>
          <div className="schedule-date-weekdays" aria-hidden="true">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="schedule-date-grid">
            {monthDays.map((date) => {
              const dateKey = isoDate(date);
              return (
                <button
                  key={dateKey}
                  type="button"
                  className={[
                    "schedule-date-cell",
                    date.getMonth() === cursor.getMonth() ? "" : "is-muted",
                    dateKey === value ? "is-selected" : "",
                    dateKey === today ? "is-today" : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => chooseDate(dateKey)}
                  aria-current={dateKey === today ? "date" : undefined}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
          <button type="button" className="schedule-picker-today" onClick={() => chooseDate(today)}>Today</button>
        </div>
      )}
    </div>
  );
}

function TimePickerField({
  label,
  value,
  onChange,
  optional = false,
  align = "left",
  fallbackValue,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
  align?: "left" | "right";
  fallbackValue?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => formatPickerTime(value));
  const rootRef = useRef<HTMLDivElement | null>(null);
  const activeHourRef = useRef<HTMLButtonElement | null>(null);
  const activeMinuteRef = useRef<HTMLButtonElement | null>(null);
  const displayValue = open ? draft : formatPickerTime(value);
  const pickerParts = timePickerParts(value || parseTimeInput(draft) || fallbackValue || "18:00");

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      activeHourRef.current?.scrollIntoView({ block: "center" });
      activeMinuteRef.current?.scrollIntoView({ block: "center" });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, pickerParts.hour, pickerParts.minute]);

  function commitDraft() {
    const parsed = parseTimeInput(draft);
    if (parsed) {
      onChange(parsed);
      setDraft(formatPickerTime(parsed));
      return;
    }
    if (!draft.trim()) {
      onChange("");
      return;
    }
    setDraft(formatPickerTime(value));
  }

  function chooseTime(nextValue: string) {
    onChange(nextValue);
    setDraft(formatPickerTime(nextValue));
    setOpen(false);
  }

  function updatePart(partial: Partial<{ hour: number; minute: number; period: TimePeriod }>) {
    const nextValue = timeValueFromParts({ ...pickerParts, ...partial });
    onChange(nextValue);
    setDraft(formatPickerTime(nextValue));
  }

  function handleBlur() {
    window.setTimeout(() => {
      if (!rootRef.current?.contains(document.activeElement)) {
        commitDraft();
        setOpen(false);
      }
    }, 0);
  }

  return (
    <div ref={rootRef} className={`form-field schedule-control-field schedule-picker-field schedule-picker-field--align-${align}`} onBlur={handleBlur}>
      <span>{label} {optional && <small>optional</small>}</span>
      <span className="schedule-input-shell schedule-picker-anchor">
        <ClockIcon />
        <input
          className="schedule-picker-text"
          value={displayValue}
          placeholder="--:-- --"
          inputMode="text"
          onFocus={() => {
            setDraft(formatPickerTime(value));
            setOpen(true);
          }}
          onChange={(event) => {
            setDraft(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitDraft();
              setOpen(false);
            }
            if (event.key === "Escape") setOpen(false);
          }}
          aria-label={label}
        />
      </span>
      {open && (
        <div className="schedule-time-popover" role="dialog" aria-label={`${label} picker`}>
          <div className="schedule-time-scroll-picker">
            <div className="schedule-time-column" role="listbox" aria-label={`${label} hour`}>
              {Array.from({ length: 12 }, (_, index) => index + 1).map((hour) => (
                <button
                  key={hour}
                  type="button"
                  ref={pickerParts.hour === hour ? activeHourRef : undefined}
                  className={pickerParts.hour === hour ? "is-selected" : ""}
                  onClick={() => updatePart({ hour })}
                >
                  {hour}
                </button>
              ))}
            </div>
            <div className="schedule-time-column" role="listbox" aria-label={`${label} minute`}>
              {Array.from({ length: 60 }, (_, minute) => minute).map((minute) => (
                <button
                  key={minute}
                  type="button"
                  ref={pickerParts.minute === minute ? activeMinuteRef : undefined}
                  className={pickerParts.minute === minute ? "is-selected" : ""}
                  onClick={() => updatePart({ minute })}
                >
                  {String(minute).padStart(2, "0")}
                </button>
              ))}
            </div>
            <div className="schedule-period-toggle" role="group" aria-label={`${label} period`}>
              {(["AM", "PM"] as TimePeriod[]).map((period) => (
                <button
                  key={period}
                  type="button"
                  className={pickerParts.period === period ? "is-selected" : ""}
                  onClick={() => updatePart({ period })}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>
          {optional && value && <button type="button" className="schedule-time-clear" onClick={() => chooseTime("")}>Leave blank</button>}
        </div>
      )}
    </div>
  );
}

function RosterView({
  players,
  staffMembers,
  staffTeamMemberships,
  staffInvitations,
  staffActionMessage,
  team,
  availableTeams,
  section,
  filter,
  positionFilter,
  yearFilter,
  query,
  onSection,
  onFilter,
  onPositionFilter,
  onYearFilter,
  onQuery,
  onOpenPlayer,
  onEditPlayer,
  onAddPlayer,
  onImport,
  onInviteStaff,
  onStatus,
  onDeletePlayer,
  onCopyStaffInvite,
  onResendStaffInvite,
  onRevokeStaffInvite,
  onUpdateStaff,
}: {
  players: Player[];
  staffMembers: StaffMember[];
  staffTeamMemberships: StaffTeamMembership[];
  staffInvitations: StaffInvitation[];
  staffActionMessage: string;
  team?: TeamOption;
  availableTeams: TeamOption[];
  section: RosterSection;
  filter: RosterFilter;
  positionFilter: RosterPositionFilter;
  yearFilter: RosterYearFilter;
  query: string;
  onSection: (section: RosterSection) => void;
  onFilter: (filter: RosterFilter) => void;
  onPositionFilter: (filter: RosterPositionFilter) => void;
  onYearFilter: (filter: RosterYearFilter) => void;
  onQuery: (value: string) => void;
  onOpenPlayer: (playerId: ID) => void;
  onEditPlayer: (playerId: ID) => void;
  onAddPlayer: () => void;
  onImport: () => void;
  onInviteStaff: () => void;
  onStatus: (playerId: ID, status: RosterStatus) => void;
  onDeletePlayer: (playerId: ID) => void;
  onCopyStaffInvite: (invitationId: ID) => Promise<string>;
  onResendStaffInvite: (invitationId: ID) => Promise<{ email?: { sent: boolean; message?: string; reason?: string } }>;
  onRevokeStaffInvite: (invitationId: ID) => Promise<void>;
  onUpdateStaff: (input: StaffMemberUpdateInput) => Promise<void>;
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
            {section === "Players" ? (
              <>
                <button className="secondary-button" type="button" onClick={onImport}>
                  <Upload size={16} aria-hidden="true" />
                  Import Roster
                </button>
                <button className="primary-button" type="button" onClick={onAddPlayer}>
                  <UserPlus size={16} aria-hidden="true" />
                  Add Player
                </button>
              </>
            ) : (
              <button className="primary-button" type="button" onClick={onInviteStaff}>
                <Mail size={16} aria-hidden="true" />
                Invite Staff
              </button>
            )}
          </div>
        }
      />

      <section className="roster-section-row">
        <SegmentedControl values={ROSTER_SECTIONS} active={section} onChange={onSection} />
      </section>

      {section === "Staff" ? (
        <StaffRosterView
          staffMembers={staffMembers}
          staffTeamMemberships={staffTeamMemberships}
          staffInvitations={staffInvitations}
          actionMessage={staffActionMessage}
          team={team}
          availableTeams={availableTeams}
          onInviteStaff={onInviteStaff}
          onCopyInvite={onCopyStaffInvite}
          onResendInvite={onResendStaffInvite}
          onRevokeInvite={onRevokeStaffInvite}
          onUpdateStaff={onUpdateStaff}
        />
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}

function StaffRosterView({
  staffMembers,
  staffTeamMemberships,
  staffInvitations,
  actionMessage,
  team,
  availableTeams,
  onInviteStaff,
  onCopyInvite,
  onResendInvite,
  onRevokeInvite,
  onUpdateStaff,
}: {
  staffMembers: StaffMember[];
  staffTeamMemberships: StaffTeamMembership[];
  staffInvitations: StaffInvitation[];
  actionMessage: string;
  team?: TeamOption;
  availableTeams: TeamOption[];
  onInviteStaff: () => void;
  onCopyInvite: (invitationId: ID) => Promise<string>;
  onResendInvite: (invitationId: ID) => Promise<{ email?: { sent: boolean; message?: string; reason?: string } }>;
  onRevokeInvite: (invitationId: ID) => Promise<void>;
  onUpdateStaff: (input: StaffMemberUpdateInput) => Promise<void>;
}) {
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [editingStaffId, setEditingStaffId] = useState<ID | null>(null);
  const currentTeamId = team?.teamId;
  const memberById = new Map(staffMembers.map((member) => [member.id, member]));
  const invitationById = new Map(staffInvitations.map((invitation) => [invitation.id, invitation]));
  const visibleMemberships = staffTeamMemberships
    .filter((membership) => membership.active && (!currentTeamId || membership.teamId === currentTeamId) && (!team?.seasonId || !membership.seasonId || membership.seasonId === team.seasonId))
    .sort((a, b) => {
      const memberA = memberById.get(a.staffMemberId);
      const memberB = memberById.get(b.staffMemberId);
      return staffRoleRank(a.baseballRole) - staffRoleRank(b.baseballRole) || (memberA?.displayName ?? "").localeCompare(memberB?.displayName ?? "");
    });

  const rows = visibleMemberships.map((membership) => {
    const member = memberById.get(membership.staffMemberId);
    const invitation = membership.invitationId ? invitationById.get(membership.invitationId) : undefined;
    return { membership, member, invitation };
  });

  async function runAction(label: string, action: () => Promise<void>) {
    setBusyAction(label);
    setMessage("");
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update staff invitation.");
    } finally {
      setBusyAction(null);
    }
  }

  async function saveStaff(input: StaffMemberUpdateInput) {
    await onUpdateStaff(input);
    setEditingStaffId(null);
    setMessage("Staff updated.");
  }

  async function removeStaffMembership(member: StaffMember | undefined, membership: StaffTeamMembership) {
    if (!member) return;
    const teamName = availableTeams.find((item) => item.teamId === membership.teamId)?.teamName ?? "this team";
    if (!window.confirm(`Remove ${member.displayName} from ${teamName}? Their account and other team access will remain.`)) return;
    const nextMemberships = staffTeamMemberships
      .filter((item) => item.staffMemberId === member.id && item.active && item.id !== membership.id)
      .map((item) => ({
        teamId: item.teamId,
        seasonId: item.seasonId,
        baseballRole: item.baseballRole,
        accessRole: item.accessRole,
      }));
    await runAction(`remove-${membership.id}`, async () => {
      await onUpdateStaff({
        staffMemberId: member.id,
        memberships: nextMemberships,
      });
      setMessage("Staff member removed from team.");
    });
  }

  return (
    <>
      <section className="staff-roster-shell roster-table-shell">
        {(message || actionMessage) && <p className="staff-action-message">{message || actionMessage}</p>}
        <div className="staff-table__head">
          <span>Staff</span>
          <span>Role</span>
          <span>Teams</span>
          <span>Access</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
        {rows.length ? rows.map(({ membership, member, invitation }) => {
          const status = staffStatus(member, invitation);
          const actionKey = invitation?.id ?? membership.id;
          return (
            <article className="staff-table-row" key={membership.id}>
              <div className="staff-person-cell">
                <StaffAvatar member={member} />
                <span>
                  <strong>{member?.displayName ?? invitation?.email ?? "Staff Member"}</strong>
                  <small>{member?.email ?? invitation?.email ?? "No email yet"}</small>
                </span>
              </div>
              <span>{membership.baseballRole}</span>
              <span>{staffTeamLabel(membership.staffMemberId, staffTeamMemberships, availableTeams)}</span>
              <span className={`staff-access-badge staff-access-badge--${membership.accessRole.toLowerCase()}`}>{membership.accessRole === "ADMIN" ? "Admin" : "Coach"}</span>
              <span className={`staff-status-badge staff-status-badge--${status.toLowerCase().replace(/\s+/g, "-")}`}>{status}</span>
              <span className="staff-actions-cell">
                {status === "Active" || status === "No Account" ? (
                  <>
                    {status === "No Account" && (
                      <button className="secondary-button staff-invite-inline" type="button" onClick={onInviteStaff}>
                        <Mail size={14} aria-hidden="true" />
                        Add Email
                      </button>
                    )}
                    <button
                      className="row-action-button tooltip-trigger"
                      type="button"
                      onClick={() => member && setEditingStaffId(member.id)}
                      disabled={!member}
                      aria-label={`Edit ${member?.displayName ?? "staff member"}`}
                      data-tooltip="Edit staff"
                    >
                      <Edit3 size={15} aria-hidden="true" />
                    </button>
                    <button
                      className="row-action-button row-action-button--danger tooltip-trigger"
                      type="button"
                      disabled={busyAction === `remove-${membership.id}` || !member}
                      onClick={() => void removeStaffMembership(member, membership)}
                      aria-label={`Remove ${member?.displayName ?? "staff member"} from team`}
                      data-tooltip="Remove from team"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </>
                ) : invitation ? (
                  <>
                  <button
                    className="row-action-button tooltip-trigger"
                    type="button"
                    disabled={busyAction === `copy-${actionKey}`}
                    onClick={() => void runAction(`copy-${actionKey}`, async () => {
                      await onCopyInvite(invitation.id);
                      setMessage("Invite link copied.");
                    })}
                    aria-label={`Copy invite link for ${member?.displayName ?? invitation.email}`}
                    data-tooltip="Copy invite link"
                  >
                    <Copy size={15} aria-hidden="true" />
                  </button>
                  <button
                    className="row-action-button tooltip-trigger"
                    type="button"
                    disabled={busyAction === `resend-${actionKey}`}
                    onClick={() => void runAction(`resend-${actionKey}`, async () => {
                      const result = await onResendInvite(invitation.id);
                      setMessage(result.email?.sent ? "Invite resent." : result.email?.message ?? "Invite link refreshed. Copy the link if email is not configured.");
                    })}
                    aria-label={`Resend invite for ${member?.displayName ?? invitation.email}`}
                    data-tooltip="Resend invite"
                  >
                    <RefreshCw size={15} aria-hidden="true" />
                  </button>
                  <button
                    className="row-action-button row-action-button--danger tooltip-trigger"
                    type="button"
                    disabled={busyAction === `revoke-${actionKey}`}
                    onClick={() => {
                      if (window.confirm("Revoke this staff invitation? They will need a new link to join.")) {
                        void runAction(`revoke-${actionKey}`, async () => {
                          await onRevokeInvite(invitation.id);
                          setMessage("Invite revoked.");
                        });
                      }
                    }}
                    aria-label={`Revoke invite for ${member?.displayName ?? invitation.email}`}
                    data-tooltip="Revoke invite"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </>
              ) : (
                <button className="secondary-button staff-invite-inline" type="button" onClick={onInviteStaff}>
                  <Mail size={14} aria-hidden="true" />
                  Add Email & Invite
                </button>
              )}
              </span>
            </article>
          );
        }) : (
          <CompactEmpty
            title="No staff listed yet"
            action={<button className="primary-button" type="button" onClick={onInviteStaff}><Mail size={16} aria-hidden="true" />Invite Staff</button>}
          />
        )}
      </section>
      {editingStaffId && memberById.get(editingStaffId) && (
        <EditStaffModal
          member={memberById.get(editingStaffId) as StaffMember}
          memberships={staffTeamMemberships.filter((membership) => membership.staffMemberId === editingStaffId && membership.active)}
          teams={availableTeams}
          onClose={() => setEditingStaffId(null)}
          onSave={saveStaff}
        />
      )}
    </>
  );
}

function StaffAvatar({ member }: { member?: StaffMember }) {
  const initials = initialsFor(member?.displayName ?? member?.email ?? "Staff Member");
  return (
    <span className="staff-avatar">
      {member?.avatarUrl ? <img src={member.avatarUrl} alt="" /> : initials}
    </span>
  );
}

function ProfileAffiliationAvatars({ context }: { context?: TeamContext }) {
  const organizations = organizationSummariesFromContext(context);
  const organizationIds = new Set(organizations.map((organization) => organization.id));
  const standaloneTeams = displayWorkspaceTeams(context?.availableTeams ?? [])
    .filter((team) => !team.organizationId || !organizationIds.has(team.organizationId));
  const items = [
    ...organizations.map((organization) => ({
      key: `org:${organization.id}`,
      name: organization.name,
      logoUrl: organization.logoUrl,
      title: organization.name,
    })),
    ...standaloneTeams.map((team) => ({
      key: `team:${team.teamId}:${team.seasonId ?? "current"}`,
      name: team.teamName,
      logoUrl: team.logoUrl,
      title: `${team.teamName}${team.seasonName ? ` - ${team.seasonName}` : ""}`,
    })),
  ].slice(0, 10);
  if (!items.length) return null;
  return (
    <div className="profile-affiliation-avatars" aria-label="Profile organizations and teams">
      {items.map((item) => (
        <span key={item.key} className="profile-affiliation-avatar" title={item.title}>
          <OrganizationLogo name={item.name} logoUrl={item.logoUrl} />
        </span>
      ))}
    </div>
  );
}

function staffStatus(member?: StaffMember, invitation?: StaffInvitation) {
  if (member?.profileId || invitation?.status === "ACCEPTED") return "Active";
  if (invitation?.status === "PENDING") return "Invite Pending";
  if (invitation?.status === "EXPIRED") return "Invite Expired";
  if (invitation?.status === "REVOKED") return "Invite Revoked";
  return "No Account";
}

function staffRoleRank(role: StaffBaseballRole) {
  return STAFF_BASEBALL_ROLES.indexOf(role) >= 0 ? STAFF_BASEBALL_ROLES.indexOf(role) : STAFF_BASEBALL_ROLES.length;
}

function staffTeamLabel(staffMemberId: ID, memberships: StaffTeamMembership[], teams: TeamOption[]) {
  const teamNames = memberships
    .filter((membership) => membership.staffMemberId === staffMemberId && membership.active)
    .map((membership) => teams.find((team) => team.teamId === membership.teamId)?.teamLevel ?? teams.find((team) => team.teamId === membership.teamId)?.teamName ?? "Team")
    .filter((name, index, names) => names.indexOf(name) === index);
  return teamNames.join(", ") || "Team";
}

function initialsFor(value: string) {
  return value
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "ST";
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
  tab,
  onTab,
  onStartPractice,
  onOpenStation,
  onOpenSession,
  onOpenAttendance,
  onEndPractice,
  onStatus,
  onOpenPlayer,
}: {
  data: AppData;
  practice?: Practice;
  activeTotals: { pitches: number; swings: number; defenseReps: number; defenders: number; players: number; pitchers: number; hitters: number };
  tab: PracticeHubTab;
  onTab: (tab: PracticeHubTab) => void;
  onStartPractice: () => void;
  onOpenStation: (mode: PracticeMode) => void;
  onOpenSession: (session: PracticeActiveSessionRow) => void;
  onOpenAttendance: () => void;
  onEndPractice: () => void;
  onStatus: (playerId: ID, status: PracticeAttendanceStatus) => void;
  onOpenPlayer: (playerId: ID) => void;
}) {
  const [attendancePage, setAttendancePage] = useState(0);
  const [attendanceKeyOpen, setAttendanceKeyOpen] = useState(false);
  const recentPractices = data.practices.slice(0, 4);
  const practiceAttendance = practice ? data.attendance.filter((item) => item.practiceId === practice.id) : [];
  const attendancePlayerIds = practice ? new Set([...practice.playerIds, ...practiceAttendance.map((item) => item.playerId)]) : undefined;
  const attendancePlayers = sortPlayersByRecent(
    practice && attendancePlayerIds ? data.players.filter((player) => attendancePlayerIds.has(player.id)) : data.players.filter((player) => !player.archived),
    data.settings.recentPlayerIds,
  );
  const attendancePageSize = 20;
  const visibleAttendanceIds = new Set(attendancePlayers.map((player) => player.id));
  const visiblePracticeAttendance = practiceAttendance.filter((item) => visibleAttendanceIds.has(item.playerId));
  const attendanceByPlayerId = new Map(visiblePracticeAttendance.map((item) => [item.playerId, item]));
  const activeAttendance = visiblePracticeAttendance.filter((item) => item.status === "Present" || item.status === "Late");
  const rosterCount = attendancePlayers.length || data.players.filter((player) => !player.archived).length;
  const attendanceDenominator = Math.max(visiblePracticeAttendance.length, attendancePlayers.length, rosterCount);
  const attendancePct = pct(activeAttendance.length, attendanceDenominator);
  const attendancePageCount = Math.max(1, Math.ceil(attendancePlayers.length / attendancePageSize));
  const activeAttendancePage = Math.min(attendancePage, attendancePageCount - 1);
  const pagedAttendancePlayers = attendancePlayers.slice(activeAttendancePage * attendancePageSize, activeAttendancePage * attendancePageSize + attendancePageSize);
  const hittingLeaders = buildHittingLeaders(data, "hardHitPct", 4).slice(0, 3);
  const pitchingLeaders = buildPitchingLeaders(data, "strikePct", 6).slice(0, 3);
  const practiceTime = practice ? formatPracticeTimeRange(practice) : "";
  const activeSessions = practice ? buildActivePracticeSessions(data, practice.id) : [];
  const mySession = activeSessions.find((session) => session.isMine);
  const recentActivity = practice ? buildPracticeActivityFeed(data, practice.id).slice(0, 5) : [];
  const attendanceCycle: PracticeAttendanceStatus[] = ["Present", "Late", "Absent", "Excused"];

  function toggleAttendanceStatus(playerId: ID, currentStatus: PracticeAttendanceStatus) {
    const nextIndex = (attendanceCycle.indexOf(currentStatus) + 1) % attendanceCycle.length;
    onStatus(playerId, attendanceCycle[nextIndex]);
  }

  return (
    <div className="page-stack practice-home">
      <SectionHeader
        title="Practice"
        action={
          <div className="practice-title-actions">
            <time>{practice ? fullDate(practice.date) : fullDate(todayKey())}</time>
            {!practice && (
              <button className="primary-button" type="button" onClick={onStartPractice}>
                <Plus size={16} aria-hidden="true" />
                Start Practice
              </button>
            )}
            {practice && !practice.endedAt && (
              <>
                <button className="primary-button" type="button" onClick={() => onOpenStation("Hitting")}>
                  <ChevronRight size={16} aria-hidden="true" />
                  Open Practice
                </button>
                <button className="secondary-button" type="button" onClick={onEndPractice}>
                  <Save size={16} aria-hidden="true" />
                  End Practice
                </button>
              </>
            )}
          </div>
        }
      />
      <nav className="practice-tabs" aria-label="Practice sections">
        {(["Overview", "Drills", "Throwing", "Metrics", "History"] as PracticeHubTab[]).map((item) => (
          <button key={item} type="button" className={tab === item ? "active" : ""} onClick={() => onTab(item)}>
            {item}
          </button>
        ))}
      </nav>

      {tab === "Overview" && (
        <>
          <section className="practice-summary-strip panel">
            <div className="practice-summary-strip__identity">
              <span className="practice-summary-icon"><ClipboardList size={24} aria-hidden="true" /></span>
              <span>
                <small>Practice</small>
                <em>{practice ? `${practice.location || "Field"}${practiceTime ? ` - ${practiceTime}` : ""}` : "Start practice to begin today's development work"}</em>
              </span>
            </div>
            <div className="practice-summary-actions" aria-label="Practice quick entry">
              <PracticeActivityCard mode="Hitting" icon={Swords} title="Hitting" compact onClick={() => onOpenStation("Hitting")} />
              <PracticeActivityCard mode="Pitching" icon={BaseballIcon} title="Pitching" compact onClick={() => onOpenStation("Pitching")} />
              <PracticeActivityCard mode="Defense" icon={Shield} title="Defense" compact onClick={() => onOpenStation("Defense")} />
              <PracticeActivityCard mode="Live BP" icon={Gauge} title="Live BP" compact onClick={() => onOpenStation("Live BP")} />
            </div>
            <div className="attendance-ring" style={{ ["--value" as string]: `${attendancePct}%` }}>
              <strong>{formatPct(attendancePct, 0)}</strong>
              <small>Attendance</small>
            </div>
          </section>

          {practice ? (
            <section className="practice-overview-grid">
              <PracticeActiveSessionsCard
                sessions={activeSessions}
                mySession={mySession}
                recentActivity={recentActivity}
                onOpenSession={onOpenSession}
                onStartSession={() => onOpenStation("Hitting")}
              />

              <article className="panel practice-attendance-overview">
                <div className="panel-heading tight">
                  <div className="practice-attendance-heading-main">
                    <div className="practice-attendance-title-line">
                      <h2>Team Attendance</h2>
                    </div>
                    <span>{attendanceDenominator} players</span>
                  </div>
                  <button
                    type="button"
                    className="attendance-status-key"
                    aria-label="Attendance color key"
                    aria-expanded={attendanceKeyOpen}
                    onClick={() => setAttendanceKeyOpen((open) => !open)}
                  >
                    {ATTENDANCE_STATUS_KEY.map((item) => (
                      <span key={item.status}><i className={item.className} />{item.short}</span>
                    ))}
                  </button>
                </div>
                {attendanceKeyOpen && (
                  <div className="attendance-status-key-popover" role="status">
                    {ATTENDANCE_STATUS_KEY.map((item) => (
                      <span key={item.status}><i className={item.className} />{item.status}</span>
                    ))}
                  </div>
                )}
                <div className="practice-avatar-row">
                  {pagedAttendancePlayers.map((player) => {
                    const status = attendanceByPlayerId.get(player.id)?.status ?? "Present";
                    return (
                      <button
                        key={player.id}
                        type="button"
                        onClick={() => toggleAttendanceStatus(player.id, status)}
                        className={`attendance-avatar attendance-avatar--${status.toLowerCase()}`}
                        aria-label={`${player.name}: ${status}. Click to change status.`}
                      >
                        <PlayerAvatar player={player} size="sm" compact />
                        <span className="attendance-avatar__meta">
                          <strong>{player.name}</strong>
                          <small>{status}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {attendancePageCount > 1 && (
                  <div className="practice-attendance-pager" aria-label="Attendance pages">
                    <button type="button" onClick={() => setAttendancePage(Math.max(0, activeAttendancePage - 1))} disabled={activeAttendancePage === 0}>
                      <ChevronLeft size={14} aria-hidden="true" />
                    </button>
                    <span>{activeAttendancePage * attendancePageSize + 1}-{Math.min(attendancePlayers.length, (activeAttendancePage + 1) * attendancePageSize)} of {attendancePlayers.length}</span>
                    <button type="button" onClick={() => setAttendancePage(Math.min(attendancePageCount - 1, activeAttendancePage + 1))} disabled={activeAttendancePage >= attendancePageCount - 1}>
                      <ChevronRight size={14} aria-hidden="true" />
                    </button>
                  </div>
                )}
                <button className="text-button practice-card-link" type="button" onClick={onOpenAttendance}>
                  View Attendance
                  <ChevronRight size={15} aria-hidden="true" />
                </button>
              </article>

              <PracticePlanCard practice={practice} />
              <PracticeRecentCard data={data} recentPractices={recentPractices} />
              <PracticeLeadersCard hittingLeaders={hittingLeaders} pitchingLeaders={pitchingLeaders} onOpenPlayer={onOpenPlayer} />
            </section>
          ) : (
            <PracticeEmptyHub onStartPractice={onStartPractice} />
          )}

          <PracticeDashboardStrip data={data} practice={practice} activeTotals={activeTotals} attendancePct={attendancePct} />
        </>
      )}

      {tab === "Drills" && <PracticeDrillsTab onOpenStation={onOpenStation} />}
      {tab === "Throwing" && <PracticeThrowingTab data={data} onOpenPlayer={onOpenPlayer} />}
      {tab === "Metrics" && <PracticeMetricsTab data={data} />}
      {tab === "History" && <PracticeHistoryTab data={data} />}
    </div>
  );
}

function PracticeActivityCard({
  mode,
  icon: Icon,
  title,
  compact = false,
  onClick,
}: {
  mode: PracticeMode;
  icon: AppIcon;
  title: string;
  compact?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`practice-activity-card ${compact ? "practice-activity-card--compact" : ""} practice-activity-card--${practiceModeClass(mode)}`} onClick={onClick}>
      <span><Icon size={compact ? 15 : 22} aria-hidden="true" /></span>
      <strong>{title}</strong>
    </button>
  );
}

function PracticeActiveSessionsCard({
  sessions,
  mySession,
  recentActivity,
  onOpenSession,
  onStartSession,
}: {
  sessions: PracticeActiveSessionRow[];
  mySession?: PracticeActiveSessionRow;
  recentActivity: PracticeActivityFeedRow[];
  onOpenSession: (session: PracticeActiveSessionRow) => void;
  onStartSession: () => void;
}) {
  return (
    <article className="panel practice-active-sessions-card">
      <div className="panel-heading tight">
        <div>
          <h2>Active Sessions</h2>
          <span>{sessions.length ? `${sessions.length} station${sessions.length === 1 ? "" : "s"} running` : "No active stations yet"}</span>
        </div>
        <button className="secondary-button" type="button" onClick={onStartSession}>
          <Plus size={15} aria-hidden="true" />
          Start Session
        </button>
      </div>

      {mySession && (
        <button type="button" className={`practice-my-session practice-session-mode--${practiceModeClass(mySession.mode)}`} onClick={() => onOpenSession(mySession)}>
          <span>
            <small>My Session</small>
            <strong>{mySession.title}</strong>
            <em>{mySession.playerLine} - {mySession.count}</em>
          </span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      )}

      <div className="practice-active-session-grid">
        {sessions.slice(0, 6).map((session) => (
          <button key={session.id} type="button" className={`practice-active-session-card practice-session-mode--${practiceModeClass(session.mode)}`} onClick={() => onOpenSession(session)}>
            <span className="practice-session-type">{session.mode}</span>
            <strong>{session.title}</strong>
            <em>{session.playerLine}</em>
            <span className="practice-session-meta">
              <b>{session.count}</b>
              <span>{session.station || "Field"}</span>
            </span>
            <span className="practice-session-contributors">
              {session.contributors.slice(0, 3).map((contributor) => (
                <i key={`${session.id}-${contributor}`}>{initialsFor(contributor)}</i>
              ))}
              {session.contributors.length > 0 ? <small>{session.contributors[0]}</small> : <small>Open station</small>}
            </span>
          </button>
        ))}
        {!sessions.length && <CompactEmpty title="Start a session when a station opens." />}
      </div>

      {recentActivity.length > 0 && (
        <div className="practice-activity-feed">
          <span>Recent Activity</span>
          {recentActivity.map((activity) => (
            <div key={activity.id}>
              <time>{activity.time}</time>
              <strong>{activity.title}</strong>
              <em>{activity.detail}</em>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function PracticePlanCard({ practice }: { practice: Practice }) {
  const baseDate = practice.date;
  const plan = [
    { time: "6:00 PM", activity: "Team Warm-Up" },
    { time: "6:15 PM", activity: "Throwing" },
    { time: "6:30 PM", activity: "Hitting Groups", tag: "BP" },
    { time: "7:00 PM", activity: "Defense", tag: "Reps" },
    { time: "7:30 PM", activity: "Bullpens", tag: "Live" },
    { time: "7:55 PM", activity: "Team Meeting", tag: "Brief" },
  ];
  return (
    <article className="panel practice-plan-card">
      <div className="panel-heading tight">
        <div>
          <h2>Today&apos;s Plan</h2>
          <span>{shortDate(baseDate)}</span>
        </div>
        <button className="text-button" type="button">
          Edit Plan
          <Edit3 size={14} aria-hidden="true" />
        </button>
      </div>
      <div className="practice-plan-list">
        {plan.map((item, index) => (
          <div key={`${item.time}-${item.activity}`}>
            <i className={`practice-plan-dot practice-plan-dot--${index % 4}`} />
            <time>{item.time}</time>
            <strong>{item.activity}</strong>
            {item.tag && <small>{item.tag}</small>}
          </div>
        ))}
      </div>
      <button className="text-button practice-card-link" type="button">
        View Full Plan
        <ChevronRight size={15} aria-hidden="true" />
      </button>
    </article>
  );
}

function PracticeRecentCard({ data, recentPractices }: { data: AppData; recentPractices: Practice[] }) {
  return (
    <article className="panel practice-recent-card">
      <div className="panel-heading tight">
        <div>
          <h2>Recent Practices</h2>
        </div>
      </div>
      {recentPractices.length ? (
        <div className="practice-history-rows">
          {recentPractices.slice(0, 3).map((item) => {
            const totals = practiceTotals(data, item.id);
            const attendance = data.attendance.filter((row) => row.practiceId === item.id);
            const active = attendance.filter((row) => row.status !== "Absent");
            return (
              <button key={item.id} type="button">
                <span>
                  <strong>{shortDate(item.date)}</strong>
                  <small>{item.location || "Field"}</small>
                </span>
                <em>{active.length || item.playerIds.length} players</em>
                <em>{totals.pitches} pitches</em>
                <em>{totals.swings} swings</em>
                <em>{totals.defense} defense</em>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      ) : (
        <CompactEmpty title="No recent practices yet" />
      )}
    </article>
  );
}

function PracticeLeadersCard({
  hittingLeaders,
  pitchingLeaders,
  onOpenPlayer,
}: {
  hittingLeaders: Array<{ playerId: ID; name: string; value: number; sample: number }>;
  pitchingLeaders: Array<{ playerId: ID; name: string; value: number; sample: number }>;
  onOpenPlayer: (playerId: ID) => void;
}) {
  return (
    <article className="panel practice-leaders-card">
      <div className="panel-heading tight">
        <div>
          <h2>Season Leaders</h2>
        </div>
      </div>
      <div className="practice-leader-columns">
        <div>
          <span>Hitting</span>
          {hittingLeaders.length ? (
            <LeaderRows leaders={hittingLeaders} format={(value) => formatPct(value)} onOpenPlayer={onOpenPlayer} />
          ) : (
            <CompactEmpty title="Need more swings" />
          )}
        </div>
        <div>
          <span>Pitching</span>
          {pitchingLeaders.length ? (
            <LeaderRows leaders={pitchingLeaders} format={(value) => formatPct(value)} onOpenPlayer={onOpenPlayer} />
          ) : (
            <CompactEmpty title="Need more pitches" />
          )}
        </div>
      </div>
    </article>
  );
}

function PracticeDashboardStrip({
  data,
  practice,
  activeTotals,
  attendancePct,
}: {
  data: AppData;
  practice?: Practice;
  activeTotals: { pitches: number; swings: number; defenseReps: number };
  attendancePct: number;
}) {
  const weekPracticeCount = data.practices.filter((item) => isDateWithinDays(item.date, todayKey(), 7)).length;
  const totalReps = activeTotals.swings + activeTotals.pitches + activeTotals.defenseReps;
  return (
    <section className="practice-dashboard-strip panel">
      <span><ClipboardList size={22} aria-hidden="true" /></span>
      <StatTile label="Practices This Week" value={weekPracticeCount} />
      <StatTile label="Team Attendance" value={practice ? formatPct(attendancePct, 0) : "--"} />
      <StatTile label="Total Reps" value={totalReps} />
      <StatTile label="Pitch Count" value={activeTotals.pitches} />
    </section>
  );
}

function PracticeEmptyHub({ onStartPractice }: { onStartPractice: () => void }) {
  return (
    <section className="panel practice-empty-hub">
      <ClipboardList size={34} aria-hidden="true" />
      <h2>No active practice</h2>
      <p>Start a practice to take attendance, choose a session, and track development reps.</p>
      <button className="primary-button" type="button" onClick={onStartPractice}>
        <Plus size={16} aria-hidden="true" />
        Start Practice
      </button>
    </section>
  );
}

function PracticeDrillsTab({ onOpenStation }: { onOpenStation: (mode: PracticeMode) => void }) {
  const drills: Array<{ title: string; category: PracticeMode; description: string }> = [
    { title: "Machine BP", category: "Hitting", description: "Fast round-based swing logging." },
    { title: "Front Toss", category: "Hitting", description: "Short setup for contact quality." },
    { title: "Bullpen Command", category: "Pitching", description: "Pitch type, zone, and velocity." },
    { title: "Short Hop Picks", category: "Defense", description: "Clean reps and error feedback." },
    { title: "Live BP", category: "Live BP", description: "Pitcher versus hitter practice PA." },
  ];
  return (
    <section className="practice-tab-grid">
      {drills.map((drill) => (
        <article key={drill.title} className="panel practice-drill-card">
          <span>{drill.category}</span>
          <h2>{drill.title}</h2>
          <p>{drill.description}</p>
          <button className="text-button" type="button" onClick={() => onOpenStation(drill.category)}>
            Start Drill
            <ChevronRight size={15} aria-hidden="true" />
          </button>
        </article>
      ))}
    </section>
  );
}

function PracticeThrowingTab({ data, onOpenPlayer }: { data: AppData; onOpenPlayer: (playerId: ID) => void }) {
  const pitchers = data.players.filter((player) => !player.archived && player.isPitcher).slice(0, 8);
  return (
    <section className="practice-tab-grid practice-tab-grid--wide">
      {pitchers.map((player) => {
        const events = playerPitchEvents(data, player.id);
        const stats = calculatePitchingStats(events);
        const lastSession = data.pitchingSessions.find((session) => session.pitcherId === player.id);
        return (
          <button key={player.id} type="button" className="panel practice-throwing-card" onClick={() => onOpenPlayer(player.id)}>
            <PlayerAvatar player={player} size="md" />
            <span>
              <strong>{player.name}</strong>
              <small>{lastSession ? `Last ${lastSession.type}: ${events.filter((event) => event.sessionId === lastSession.id).length} pitches` : "No bullpen yet"}</small>
            </span>
            <em>{formatPct(stats.zonePct, 0)} Zone</em>
            <em>{stats.avgVelocity ? `${formatNumber(stats.avgVelocity, 1)} mph` : "--"}</em>
          </button>
        );
      })}
    </section>
  );
}

function PracticeMetricsTab({ data }: { data: AppData }) {
  const hitting = calculateHittingStats(data.hittingEvents);
  const pitching = calculatePitchingStats(data.pitchEvents);
  const clean = data.defenseEvents.filter((event) => event.outcome !== "Error" && event.outcome !== "Missed Rep").length;
  const attendancePct = teamPracticeAttendancePct(data, data.players.filter((player) => !player.archived).length);
  return (
    <section className="practice-metrics-grid">
      <article className="panel"><h2>Hitting</h2><LiveMetrics items={[{ label: "Hard Contact", value: formatPct(hitting.hardHitPct) }, { label: "Miss", value: formatPct(hitting.whiffPct) }, { label: "Line Drive", value: formatPct(hitting.lineDrivePct) }]} /></article>
      <article className="panel"><h2>Pitching</h2><LiveMetrics items={[{ label: "Zone", value: formatPct(pitching.zonePct) }, { label: "Strike", value: formatPct(pitching.strikePct) }, { label: "Competitive", value: formatPct(pitching.cswPct) }]} /></article>
      <article className="panel"><h2>Defense</h2><LiveMetrics items={[{ label: "Clean", value: formatPct(pct(clean, data.defenseEvents.length)) }, { label: "Reps", value: data.defenseEvents.length }]} /></article>
      <article className="panel"><h2>Attendance</h2><LiveMetrics items={[{ label: "Team Attendance", value: data.practices.length ? formatPct(attendancePct) : "--" }, { label: "Practices", value: data.practices.length }]} /></article>
    </section>
  );
}

function PracticeHistoryTab({ data }: { data: AppData }) {
  return (
    <section className="panel practice-history-panel">
      <h2>History</h2>
      <div className="practice-history-rows">
        {data.practices.map((practice) => {
          const totals = practiceTotals(data, practice.id);
          const attendance = data.attendance.filter((row) => row.practiceId === practice.id);
          const active = attendance.filter((row) => row.status !== "Absent");
          return (
            <button key={practice.id} type="button">
              <span>
                <strong>{shortDate(practice.date)}</strong>
                <small>{practice.location || "Field"}</small>
              </span>
              <em>{active.length || practice.playerIds.length} players</em>
              <em>{totals.pitches} pitches</em>
              <em>{totals.swings} swings</em>
              <em>{totals.defense} defense</em>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function PracticeAttendanceDrilldown({
  data,
  practice,
  onBack,
  onMarkAllPresent,
  onStatus,
}: {
  data: AppData;
  practice: Practice;
  onBack: () => void;
  onMarkAllPresent: () => void;
  onStatus: (playerId: ID, status: PracticeAttendanceStatus) => void;
}) {
  const roster = data.players.filter((player) => !player.archived && practice.playerIds.includes(player.id));
  const statuses = Object.fromEntries(
    roster.map((player) => [player.id, data.attendance.find((item) => item.practiceId === practice.id && item.playerId === player.id)?.status ?? "Present"]),
  ) as Record<ID, PracticeAttendanceStatus>;
  return (
    <div className="page-stack practice-attendance-page">
      <section className="practice-drilldown-header panel">
        <button className="ghost-button" type="button" onClick={onBack}>
          <ChevronLeft size={16} aria-hidden="true" />
          Practice
        </button>
        <div>
          <span>{shortDate(practice.date)} - {formatPracticeStartTime(practice)}</span>
          <h2>Attendance</h2>
        </div>
        <button className="primary-button" type="button" onClick={onMarkAllPresent}>
          <Check size={16} aria-hidden="true" />
          Mark All Present
        </button>
      </section>
      <AttendanceRoster players={roster} statuses={statuses} onStatus={onStatus} />
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
  const [switcherFilter, setSwitcherFilter] = useState<PracticeTrackerPlayerFilter>("All");
  const availablePlayers = useMemo(() => availablePracticePlayers(data, practice), [data, practice]);
  const fallbackPlayers = useMemo(() => sortPlayersByRecent(data.players.filter((item) => !item.archived), data.settings.recentPlayerIds), [data.players, data.settings.recentPlayerIds]);
  const players = availablePlayers.length ? availablePlayers : fallbackPlayers;
  const playerPool = useMemo(() => players
    .filter((item) => mode !== "Pitching" || item.isPitcher)
    .filter((item) => mode !== "Hitting" || item.isHitter)
    .filter((item) => mode !== "Live BP" || item.isPitcher || item.isHitter)
    .filter((item) => switcherFilter === "All"
      || (switcherFilter === "Pitchers" && item.isPitcher)
      || (switcherFilter === "Hitters" && item.isHitter)
      || (switcherFilter === "Infield" && ["P", "C", "1B", "2B", "3B", "SS"].includes(item.primaryPosition))
      || (switcherFilter === "Outfield" && ["LF", "CF", "RF", "OF"].includes(item.primaryPosition)))
    .filter((item) => `${item.name} ${item.jerseyNumber} ${item.primaryPosition} ${item.secondaryPosition ?? ""}`.toLowerCase().includes(switcherQuery.toLowerCase())), [players, mode, switcherFilter, switcherQuery]);
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
  const cleanDefenseReps = defenseEvents.filter((event) => event.outcome !== "Error" && event.outcome !== "Missed Rep").length;
  const defenseCleanPct = pct(cleanDefenseReps, defenseEvents.length);
  const activeSessions = practice ? buildActivePracticeSessions(data, practice.id) : [];
  const activeModeSessions = activeSessions.filter((session) => session.mode === mode);
  const currentSession = mode === "Hitting" ? hittingSession : mode === "Pitching" ? pitchingSession : mode === "Defense" ? defenseSession : data.pitchingSessions.find((session) => session.practiceId === practice?.id && session.pitcherId === liveBpPitcher?.id && session.type === "Live BP");
  const presentCount = practice ? availablePlayers.length : activeTotals.players;
  const roundNumber = practice
    ? Math.max(1, data.hittingSessions.filter((session) => session.practiceId === practice.id && session.hitterId === player.id && session.type === hittingStation).length || 1)
    : 1;
  const pitchers = players.filter((item) => item.isPitcher);
  const hitters = players.filter((item) => item.isHitter && item.id !== liveBpPitcher?.id);
  const activePlayerIndex = playerPool.findIndex((item) => item.id === player.id);
  const previousPlayer = playerPool.length ? playerPool[(activePlayerIndex - 1 + playerPool.length) % playerPool.length] : undefined;
  const nextPlayer = playerPool.length ? playerPool[(activePlayerIndex + 1) % playerPool.length] : undefined;
  const sessionName = mode === "Hitting" ? hittingStation : mode === "Pitching" ? pitchingStation : mode === "Defense" ? defenseStation : "Live BP";
  const sessionReps = mode === "Hitting"
    ? hittingEvents.length
    : mode === "Pitching"
      ? pitchEvents.length
      : mode === "Defense"
        ? defenseEvents.length
        : liveBpPitchEvents.length;
  const sessionParticipants = mode === "Hitting"
    ? activeTotals.hitters
    : mode === "Pitching"
      ? activeTotals.pitchers
      : mode === "Defense"
        ? activeTotals.defenders
      : [liveBpPitcher?.id, liveBpHitter?.id].filter(Boolean).length;

  useEffect(() => {
    if (!playerPool.length || playerPool.some((item) => item.id === player.id)) return;
    onSelectPlayer(playerPool[0].id);
  }, [player.id, playerPool, onSelectPlayer]);

  function changeMode(nextMode: PracticeMode) {
    onMode(nextMode);
    if (nextMode === "Live BP") {
      onPitchingStation("Live BP");
      onHittingStation("Live BP");
      if (liveBpPitcher) onSelectPlayer(liveBpPitcher.id);
    }
  }

  function selectSession(row: PracticeActiveSessionRow) {
    changeMode(row.mode);
    onSelectPlayer(row.primaryPlayerId);
    if (row.mode === "Hitting") onHittingStation(normalizeHittingStation(row.station));
    if (row.mode === "Pitching") onPitchingStation((row.station as PitchingSession["type"]) || "Bullpen");
    if (row.mode === "Defense") onDefenseStation((row.station as DefenseStation) || "Infield");
    if (row.mode === "Live BP") {
      onPitchingStation("Live BP");
      onHittingStation("Live BP");
      onLiveBpPitcher(row.primaryPlayerId);
      if (row.secondaryPlayerId) onLiveBpHitter(row.secondaryPlayerId);
    }
  }

  function adjustVelocity(delta: number) {
    const next = Math.max(0, Math.round((Number(velocity) || 0) + delta));
    onVelocity(String(next));
  }

  const sessionStarted = currentSession?.startedAt ? formatTime(currentSession.startedAt) : practice ? formatTime(practice.startedAt) : "--";

  return (
    <div className={`page-stack practice-console practice-console--active practice-console--${practiceModeClass(mode)}`}>
      <section className="practice-tracker-header panel">
        <div className="practice-tracker-title">
          <button className="icon-button" type="button" onClick={onExitTracking} aria-label="Back to practice overview">
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <div>
            <span>Practice {practice ? `- ${fullDate(practice.date)}` : ""}</span>
            <h2>{practice ? `${practice.location || "No location"} - ${formatPracticeTimeRange(practice)}` : "Active Practice"}</h2>
          </div>
        </div>
        <div className="practice-tracker-presence">
          <strong>{practice ? presentCount : activeTotals.players}</strong>
          <span>Present</span>
        </div>
        {practice ? (
          <div className="practice-header__buttons">
            <button className="ghost-button" type="button" onClick={onExitTracking}>Practice Home</button>
            <button className="ghost-button" type="button" onClick={onUndo}>
              <Undo2 size={16} aria-hidden="true" />
              Undo Last
            </button>
            <button className="secondary-button" type="button" onClick={onEndPractice}>End Practice</button>
          </div>
        ) : (
          <button className="primary-button" type="button" onClick={onStartPractice}>
            <Plus size={16} aria-hidden="true" />
            Start Practice
          </button>
        )}
      </section>

      <nav className="practice-tracker-tabs panel" aria-label="Practice tracker modes">
        {(["Hitting", "Pitching", "Defense", "Live BP"] as PracticeMode[]).map((tab) => (
          <button key={tab} type="button" className={mode === tab ? `active practice-mode-${practiceModeClass(tab)}` : ""} onClick={() => changeMode(tab)}>
            {practiceModeIcon(tab)}
            <span>{tab}</span>
          </button>
        ))}
      </nav>

      <section className="practice-tracker-grid">
        <aside className="practice-session-panel panel">
          <div className="panel-heading tight">
            <div>
              <span>Session</span>
              <h2>{sessionName}</h2>
            </div>
            <button className="ghost-button" type="button" onClick={onEndSession}>
              <Save size={15} aria-hidden="true" />
              End
            </button>
          </div>
          <div className="practice-session-meta-stack">
            <span><b>Status</b><em>{currentSession?.status ?? "ACTIVE"}</em></span>
            <span><b>Started</b><em>{sessionStarted}</em></span>
            <span><b>Players</b><em>{sessionParticipants || 1}</em></span>
            <span><b>Reps</b><em>{sessionReps}</em></span>
          </div>
          <div className="practice-session-contributor-card">
            <i>{initialsFor(profileDisplayName(data.teamContext))}</i>
            <span>
              <strong>{profileDisplayName(data.teamContext)}</strong>
              <small>Tracking</small>
            </span>
          </div>
          <div className="practice-active-mini-list">
            <div className="mini-list-heading">
              <span>Active {mode} Sessions</span>
              <b>{activeModeSessions.length}</b>
            </div>
            {activeModeSessions.slice(0, 4).map((session) => (
              <button key={session.id} type="button" className={session.sessionId === currentSession?.id ? "active" : ""} onClick={() => selectSession(session)}>
                <span>
                  <strong>{session.title}</strong>
                  <small>{session.playerLine} - {session.count}</small>
                </span>
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            ))}
            {!activeModeSessions.length && <CompactEmpty title="No active sessions" />}
          </div>
        </aside>

        <section className="tracker-console panel">
          <div className="tracker-player-banner">
            {mode === "Live BP" ? (
              <>
                <TrackerPlayerCard label="Pitcher" player={liveBpPitcher} stat={`${liveBpPitchStats.totalPitches} pitches`} onOpenPlayer={onOpenPlayer} />
                <div className="tracker-count-card">
                  <span>Count</span>
                  <strong>{liveBpCount.balls}-{liveBpCount.strikes}</strong>
                  <small>PA {liveBpPaNumber}</small>
                </div>
                <TrackerPlayerCard label="Hitter" player={liveBpHitter} stat={`${liveBpHitEvents.length} swings`} onOpenPlayer={onOpenPlayer} />
              </>
            ) : (
              <>
                <TrackerPlayerCard label={mode === "Pitching" ? "Pitcher" : mode === "Defense" ? "Defender" : "Hitter"} player={player} stat={`${sessionReps} ${mode === "Pitching" ? "pitches" : mode === "Hitting" ? "swings" : "reps"}`} onOpenPlayer={onOpenPlayer} />
                <div className="tracker-player-statline">
                  {mode === "Hitting" && (
                    <>
                      <span><strong>{hitStats.totalSwings}</strong><small>Swings</small></span>
                      <span><strong>{Math.round((hitStats.hardHitPct / 100) * hitStats.ballsInPlay)}</strong><small>Hard</small></span>
                      <span><strong>{formatPct(hitStats.hardHitPct)}</strong><small>Hard %</small></span>
                    </>
                  )}
                  {mode === "Pitching" && (
                    <>
                      <span><strong>{pitchStats.totalPitches}</strong><small>Pitches</small></span>
                      <span><strong>{pitchStats.strikes}</strong><small>Strikes</small></span>
                      <span><strong>{formatPct(pitchStats.zonePct)}</strong><small>Zone %</small></span>
                    </>
                  )}
                  {mode === "Defense" && (
                    <>
                      <span><strong>{defenseEvents.length}</strong><small>Reps</small></span>
                      <span><strong>{cleanDefenseReps}</strong><small>Clean</small></span>
                      <span><strong>{formatPct(defenseCleanPct)}</strong><small>Clean %</small></span>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          {mode === "Hitting" && (
            <div className="tracking-layout tracking-layout--dense">
              <div className="tracking-main">
                <div className="session-context">
                  <div>
                    <span>Hitting Session</span>
                    <strong>{hittingStation}</strong>
                    <small>{hittingEvents.length} reps logged</small>
                  </div>
                  <SegmentedControl values={HITTING_STATIONS} active={hittingStation} onChange={onHittingStation} />
                </div>
                <LiveMetrics
                  items={[
                    { label: "Swings", value: hitStats.totalSwings, detail: `Round ${roundNumber}` },
                    { label: "Contact", value: formatPct(hitStats.contactPct), detail: `${Math.round((hitStats.contactPct / 100) * hitStats.totalSwings)}/${hitStats.totalSwings}` },
                    { label: "Hard Hit", value: formatPct(hitStats.hardHitPct), detail: `${Math.round((hitStats.hardHitPct / 100) * hitStats.ballsInPlay)}/${hitStats.ballsInPlay} BIP` },
                    { label: "Miss", value: formatPct(hitStats.whiffPct), detail: `${Math.round((hitStats.whiffPct / 100) * hitStats.totalSwings)}/${hitStats.totalSwings}` },
                  ]}
                />
                <div className="quick-pad quick-pad--hitting">
                  <button type="button" className="impact" onClick={() => onLogHitting("Ball in play", "Line drive", "Hard")}>Hard Contact</button>
                  <button type="button" onClick={() => onLogHitting("Ball in play", "Line drive", "Solid")}>Contact</button>
                  <button type="button" onClick={() => onLogHitting("Ball in play", "Ground ball", "Weak")}>Weak Contact</button>
                  <button type="button" onClick={() => onLogHitting("Miss")}>Miss</button>
                  <button type="button" onClick={() => onLogHitting("Foul")}>Foul</button>
                </div>
                <span className="tracker-subhead">Ball type</span>
                <div className="direction-row">
                  <button type="button" onClick={() => onLogHitting("Ball in play", "Ground ball", "Solid")}>Ground Ball</button>
                  <button type="button" onClick={() => onLogHitting("Ball in play", "Line drive", "Hard")}>Line Drive</button>
                  <button type="button" onClick={() => onLogHitting("Ball in play", "Fly ball", "Solid")}>Fly Ball</button>
                  <button type="button" onClick={() => onLogHitting("Ball in play", "Pop up", "Weak")}>Pop Up</button>
                </div>
                <span className="tracker-subhead">Direction</span>
                <div className="direction-row direction-row--compact">
                  {(["Pull", "Middle", "Opposite"] as Direction[]).map((direction) => (
                    <button key={direction} type="button" className={hitDirection === direction ? "active" : ""} onClick={() => onHitDirection(direction)}>
                      {direction === "Opposite" ? "Oppo" : direction}
                    </button>
                  ))}
                </div>
                <PracticeRecentEventTable
                  title="Recent Swings"
                  rows={hittingEvents.slice(0, 6).map((event) => ({
                    id: event.id,
                    time: formatTime(event.createdAt),
                    primary: event.contactQuality ?? event.action,
                    secondary: [event.contactResult, event.direction].filter(Boolean).join(" - ") || "--",
                    tone: event.contactQuality === "Hard" || event.action === "Foul" ? "positive" : event.action === "Miss" ? "negative" : undefined,
                  }))}
                />
              </div>
              <div className="tracking-visual">
                <BaseballField points={hittingEvents.map((event) => event.fieldLocation).filter(isZonePoint)} activePoint={fieldLocation} onSelect={onFieldLocation} />
              </div>
            </div>
          )}

          {mode === "Pitching" && (
            <div className="tracking-layout tracking-layout--dense tracking-layout--pitching">
              <div className="tracking-main">
                <div className="session-context">
                  <div>
                    <span>Pitching Session</span>
                    <strong>{pitchingStation}</strong>
                    <small>{pitchEvents.length} pitches logged</small>
                  </div>
                  <SegmentedControl values={PITCHING_STATIONS} active={pitchingStation} onChange={onPitchingStation} />
                </div>
                <LiveMetrics
                  items={[
                    { label: "Pitches", value: pitchStats.totalPitches, detail: `${pitchStats.strikes}/${pitchStats.totalPitches} strikes` },
                    { label: "Strike %", value: formatPct(pitchStats.strikePct), detail: `${pitchStats.strikes}/${pitchStats.totalPitches}` },
                    { label: "Zone %", value: formatPct(pitchStats.zonePct), detail: `${Math.round((pitchStats.zonePct / 100) * pitchStats.totalPitches)}/${pitchStats.totalPitches}` },
                    { label: "CSW %", value: formatPct(pitchStats.cswPct), detail: `${Math.round((pitchStats.cswPct / 100) * pitchStats.totalPitches)}/${pitchStats.totalPitches}` },
                    ...(pitchStats.avgVelocity ? [{ label: "Avg Velo", value: formatNumber(pitchStats.avgVelocity, 1), detail: pitchStats.maxVelocity ? `Max ${formatNumber(pitchStats.maxVelocity, 1)}` : "Optional" }] : []),
                  ]}
                />
                <div className="pitch-type-row">
                  {PITCH_TYPES.slice(0, 8).map((pitchType) => (
                    <button key={pitchType} type="button" className={selectedPitchType === pitchType ? "active" : ""} onClick={() => onPitchType(pitchType)}>
                      {PITCH_TYPE_LABELS[pitchType]}
                    </button>
                  ))}
                </div>
                <div className="velo-stepper">
                  <button type="button" onClick={() => adjustVelocity(-1)} aria-label="Decrease velocity">-</button>
                  <label>
                    <span>Velo</span>
                    <input inputMode="numeric" value={velocity} onChange={(event) => onVelocity(event.target.value.replace(/[^0-9.]/g, ""))} />
                  </label>
                  <button type="button" onClick={() => adjustVelocity(1)} aria-label="Increase velocity">+</button>
                </div>
                <div className="quick-pad quick-pad--pitching">
                  <button type="button" className="impact" onClick={() => onLogPitch("Called Strike")}>Strike</button>
                  <button type="button" onClick={() => onLogPitch("Ball")}>Ball</button>
                  <button type="button" onClick={() => onLogPitch("Ball in play", "Line drive")}>In Play</button>
                  <button type="button" onClick={() => onLogPitch("Whiff")}>Whiff</button>
                </div>
                <PracticeRecentEventTable
                  title="Recent Pitches"
                  rows={pitchEvents.slice(0, 6).map((event) => ({
                    id: event.id,
                    time: formatTime(event.createdAt),
                    primary: `${event.pitchNumber}  ${PITCH_TYPE_LABELS[event.pitchType]}`,
                    secondary: [event.velocity ? `${event.velocity}` : undefined, event.location ? zoneLabel(event.location) : undefined, event.outcome].filter(Boolean).join(" - "),
                    tone: event.isStrike ? "positive" : event.outcome === "Ball" ? "negative" : undefined,
                  }))}
                />
              </div>
              <div className="tracking-visual zone-stack">
                <span>Actual location</span>
                <StrikeZone points={pitchEvents.map((event) => event.location).filter(isZonePoint)} activePoint={pitchLocation} onSelect={onPitchLocation} />
                <div className="outside-zone-controls">
                  <button type="button" onClick={() => onPitchLocation({ x: 0.5, y: 0.08 })}>High</button>
                  <button type="button" onClick={() => onPitchLocation({ x: 0.5, y: 0.92 })}>Low</button>
                  <button type="button" onClick={() => onPitchLocation({ x: 0.08, y: 0.5 })}>Arm Side</button>
                  <button type="button" onClick={() => onPitchLocation({ x: 0.92, y: 0.5 })}>Glove Side</button>
                </div>
                <button className="text-button" type="button" onClick={() => onPitchLocation(undefined)}>Clear location</button>
                <span>Target</span>
                <StrikeZone compact activePoint={targetLocation} onSelect={onTargetLocation} />
                <button className="text-button" type="button" onClick={() => onTargetLocation(undefined)}>Clear target</button>
              </div>
            </div>
          )}

          {mode === "Defense" && (
            <div className="tracking-layout tracking-layout--dense">
              <div className="tracking-main">
                <div className="session-context">
                  <div>
                    <span>Defense Session</span>
                    <strong>{defenseStation}</strong>
                    <small>{defenseEvents.length} reps logged</small>
                  </div>
                  <SegmentedControl values={DEFENSE_STATIONS} active={defenseStation} onChange={onDefenseStation} />
                </div>
                <LiveMetrics
                  items={[
                    { label: "Attempts", value: defenseEvents.length },
                    { label: "Clean", value: defenseEvents.filter((event) => event.outcome === "Clean" || event.outcome === "Good Play" || event.outcome === "Great Play").length },
                    { label: "Clean %", value: formatPct(defenseCleanPct), detail: `${defenseEvents.filter((event) => event.outcome !== "Error" && event.outcome !== "Missed Rep").length}/${defenseEvents.length}` },
                    { label: "Plus Plays", value: defenseEvents.filter((event) => event.outcome === "Great Play").length },
                  ]}
                />
                <div className="quick-pad quick-pad--defense">
                  <button type="button" onClick={() => onLogDefense("Clean")}>Clean</button>
                  <button type="button" onClick={() => onLogDefense("Error")}>Error</button>
                  <button type="button" className="impact" onClick={() => onLogDefense("Great Play")}>Great Play</button>
                  <button type="button" onClick={() => onLogDefense("Missed Rep")}>Missed Rep</button>
                </div>
                <span className="tracker-subhead">Play type</span>
                <div className="direction-row">
                  <button type="button" onClick={() => onLogDefense("Clean")}>Ground Ball</button>
                  <button type="button" onClick={() => onLogDefense("Clean")}>Fly Ball</button>
                  <button type="button" onClick={() => onLogDefense("Clean")}>Throw</button>
                  <button type="button" onClick={() => onLogDefense("Good Play")}>Double Play</button>
                  <button type="button" onClick={() => onLogDefense("Error", "Fielding")}>Fielding Error</button>
                  <button type="button" onClick={() => onLogDefense("Error", "Throwing")}>Throwing Error</button>
                </div>
                <PracticeRecentEventTable
                  title="Recent Reps"
                  rows={defenseEvents.slice(0, 6).map((event) => ({
                    id: event.id,
                    time: formatTime(event.createdAt),
                    primary: event.outcome,
                    secondary: [event.station, event.errorType].filter(Boolean).join(" - ") || "--",
                    tone: event.outcome === "Error" || event.outcome === "Missed Rep" ? "negative" : "positive",
                  }))}
                />
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
            <div className="tracking-layout live-bp-layout tracking-layout--dense">
              <div className="tracking-main">
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
                    { label: "Pitches", value: liveBpPitchStats.totalPitches, detail: `${liveBpPitchStats.strikes}/${liveBpPitchStats.totalPitches} strikes` },
                    { label: "Strike %", value: formatPct(liveBpPitchStats.strikePct), detail: `${liveBpPitchStats.strikes}/${liveBpPitchStats.totalPitches}` },
                    { label: "PAs", value: liveBpPaNumber, detail: `${data.plateAppearances.filter((item) => item.practiceId === practice?.id && item.pitcherId === liveBpPitcher?.id && item.hitterId === liveBpHitter?.id).length} complete` },
                    ...(liveBpPitchStats.avgVelocity ? [{ label: "Avg Velo", value: formatNumber(liveBpPitchStats.avgVelocity, 1), detail: liveBpPitchStats.maxVelocity ? `Max ${formatNumber(liveBpPitchStats.maxVelocity, 1)}` : "Optional" }] : []),
                  ]}
                />
                <div className="pitch-type-row">
                  {PITCH_TYPES.slice(0, 8).map((pitchType) => (
                    <button key={pitchType} type="button" className={selectedPitchType === pitchType ? "active" : ""} onClick={() => onPitchType(pitchType)}>
                      {PITCH_TYPE_LABELS[pitchType]}
                    </button>
                  ))}
                </div>
                <div className="velo-stepper">
                  <button type="button" onClick={() => adjustVelocity(-1)} aria-label="Decrease velocity">-</button>
                  <label>
                    <span>Velo</span>
                    <input inputMode="numeric" value={velocity} onChange={(event) => onVelocity(event.target.value.replace(/[^0-9.]/g, ""))} />
                  </label>
                  <button type="button" onClick={() => adjustVelocity(1)} aria-label="Increase velocity">+</button>
                </div>
                <div className="quick-pad quick-pad--pitching">
                  <button type="button" onClick={() => onLogLiveBpPitch("Ball")}>Ball</button>
                  <button type="button" onClick={() => onLogLiveBpPitch("Called Strike")}>Called Strike</button>
                  <button type="button" className="impact" onClick={() => onLogLiveBpPitch("Whiff")}>Whiff</button>
                  <button type="button" onClick={() => onLogLiveBpPitch("Foul")}>Foul</button>
                  <button type="button" onClick={() => onLogLiveBpPitch("Ball in play", "Line drive")}>In Play</button>
                </div>
                <span className="tracker-subhead">If in play</span>
                <div className="direction-row">
                  <button type="button" onClick={() => onLogLiveBpPitch("Ball in play", "Ground ball")}>Hard Ground</button>
                  <button type="button" onClick={() => onLogLiveBpPitch("Ball in play", "Ground ball")}>Soft Ground</button>
                  <button type="button" onClick={() => onLogLiveBpPitch("Ball in play", "Line drive")}>Line Drive</button>
                  <button type="button" onClick={() => onLogLiveBpPitch("Ball in play", "Fly ball")}>Fly Ball</button>
                </div>
                <div className="pa-outcome-grid">
                  {LIVE_BP_OUTCOMES.map((outcome) => (
                    <button key={outcome} type="button" onClick={() => onCompleteLiveBpPa(outcome)}>{outcome}</button>
                  ))}
                  <button type="button" className="secondary-button" onClick={onNextLiveBpHitter}>Next Hitter</button>
                </div>
                <PracticeRecentEventTable
                  title="Live BP Log"
                  rows={liveBpPitchEvents.slice(0, 6).map((event) => ({
                    id: event.id,
                    time: formatTime(event.createdAt),
                    primary: event.outcome,
                    secondary: event.countAfter ? `${event.countAfter.balls}-${event.countAfter.strikes}` : PITCH_TYPE_LABELS[event.pitchType],
                    tone: event.isStrike ? "positive" : event.outcome === "Ball" ? "negative" : undefined,
                  }))}
                />
              </div>
              <div className="tracking-visual zone-stack">
                <span>Actual location</span>
                <StrikeZone points={liveBpPitchEvents.map((event) => event.location).filter(isZonePoint)} activePoint={pitchLocation} onSelect={onPitchLocation} />
                <div className="outside-zone-controls">
                  <button type="button" onClick={() => onPitchLocation({ x: 0.5, y: 0.08 })}>High</button>
                  <button type="button" onClick={() => onPitchLocation({ x: 0.5, y: 0.92 })}>Low</button>
                  <button type="button" onClick={() => onPitchLocation({ x: 0.08, y: 0.5 })}>Arm Side</button>
                  <button type="button" onClick={() => onPitchLocation({ x: 0.92, y: 0.5 })}>Glove Side</button>
                </div>
                <button className="text-button" type="button" onClick={() => onPitchLocation(undefined)}>Clear location</button>
                <span>Target</span>
                <StrikeZone compact activePoint={targetLocation} onSelect={onTargetLocation} />
                <button className="text-button" type="button" onClick={() => onTargetLocation(undefined)}>Clear target</button>
              </div>
            </div>
          )}
        </section>

        <aside className="practice-tracker-side panel">
          <div className="panel-heading tight">
            <div>
              <span>Session Totals</span>
              <h2>{sessionName}</h2>
            </div>
          </div>
          {mode === "Hitting" && (
            <LiveMetrics items={[
              { label: "Total Swings", value: hittingEvents.length },
              { label: "Hard Contact", value: Math.round((hitStats.hardHitPct / 100) * hitStats.ballsInPlay), detail: formatPct(hitStats.hardHitPct) },
              { label: "Misses", value: Math.round((hitStats.whiffPct / 100) * hitStats.totalSwings), detail: formatPct(hitStats.whiffPct) },
            ]} />
          )}
          {mode === "Pitching" && (
            <LiveMetrics items={[
              { label: "Pitches", value: pitchStats.totalPitches },
              { label: "Strikes", value: pitchStats.strikes, detail: formatPct(pitchStats.strikePct) },
              { label: "Zone", value: formatPct(pitchStats.zonePct), detail: "current session" },
            ]} />
          )}
          {mode === "Defense" && (
            <LiveMetrics items={[
              { label: "Total Reps", value: defenseEvents.length },
              { label: "Clean", value: cleanDefenseReps, detail: formatPct(defenseCleanPct) },
              { label: "Great Plays", value: defenseEvents.filter((event) => event.outcome === "Great Play").length },
            ]} />
          )}
          {mode === "Live BP" && (
            <LiveMetrics items={[
              { label: "Pitches", value: liveBpPitchStats.totalPitches },
              { label: "Strikes", value: liveBpPitchStats.strikes, detail: formatPct(liveBpPitchStats.strikePct) },
              { label: "Swings", value: liveBpHitEvents.filter((event) => event.action !== "Took pitch").length },
            ]} />
          )}
          <div className="practice-on-deck">
            <span>On Deck</span>
            {(mode === "Live BP" ? hitters : playerPool).filter((item) => item.id !== player.id && item.id !== liveBpHitter?.id).slice(0, 5).map((item) => (
              <button key={item.id} type="button" onClick={() => mode === "Live BP" ? onLiveBpHitter(item.id) : onSelectPlayer(item.id)}>
                <PlayerAvatar player={item} size="sm" compact />
                <strong>{item.name.split(" ").slice(-1)[0]}</strong>
              </button>
            ))}
          </div>
        </aside>
      </section>

      <section className="practice-player-strip panel" aria-label="Practice player switcher">
        <button type="button" disabled={!previousPlayer} onClick={() => previousPlayer && onSelectPlayer(previousPlayer.id)}>
          <ChevronLeft size={16} aria-hidden="true" />
          Previous
        </button>
        <label className="switcher-search practice-player-strip__search">
          <Search size={14} aria-hidden="true" />
          <input value={switcherQuery} onChange={(event) => setSwitcherQuery(event.target.value)} placeholder="Search present players..." />
        </label>
        <SegmentedControl values={["All", "Pitchers", "Hitters", "Infield", "Outfield"] as PracticeTrackerPlayerFilter[]} active={switcherFilter} onChange={setSwitcherFilter} />
        <div className="practice-player-strip__players">
          {playerPool.slice(0, 18).map((item) => (
            <button key={item.id} type="button" className={item.id === player.id || item.id === liveBpPitcher?.id || item.id === liveBpHitter?.id ? "active" : ""} onClick={() => mode === "Live BP" && item.isHitter ? onLiveBpHitter(item.id) : onSelectPlayer(item.id)} title={`${item.name}: ${practicePlayerStatus(data, practice, item.id)}`}>
              <PlayerAvatar player={item} size="sm" compact />
              <span>{lastName(item.name)}</span>
              <small>#{item.jerseyNumber}</small>
            </button>
          ))}
          {!playerPool.length && <CompactEmpty title="No available players" />}
        </div>
        <button type="button" disabled={!nextPlayer} onClick={() => nextPlayer && onSelectPlayer(nextPlayer.id)}>
          Next
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </section>
    </div>
  );
}

function TrackerPlayerCard({ label, player, stat, onOpenPlayer }: { label: string; player?: Player; stat?: string; onOpenPlayer: (playerId: ID) => void }) {
  return (
    <button className="tracker-player-card" type="button" disabled={!player} onClick={() => player && onOpenPlayer(player.id)}>
      {player ? <PlayerAvatar player={player} size="md" /> : <span className="player-avatar player-avatar--md">--</span>}
      <span>
        <small>{label}</small>
        <strong>{player ? `${player.name}` : `Select ${label.toLowerCase()}`}</strong>
        <em>{player ? `${player.jerseyNumber ? `#${player.jerseyNumber} - ` : ""}${positionLine(player)}${stat ? ` - ${stat}` : ""}` : "--"}</em>
      </span>
    </button>
  );
}

function PracticeRecentEventTable({ title, rows }: { title: string; rows: Array<{ id: ID; time: string; primary: string; secondary: string; tone?: "positive" | "negative" }> }) {
  return (
    <div className="practice-recent-event-table">
      <div>
        <span>{title}</span>
        <small>{rows.length ? "Newest first" : "No events yet"}</small>
      </div>
      {rows.map((row) => (
        <span key={row.id} className={row.tone ? `practice-recent-event-row practice-recent-event-row--${row.tone}` : "practice-recent-event-row"}>
          <small>{row.time}</small>
          <strong>{row.primary}</strong>
          <em>{row.secondary}</em>
        </span>
      ))}
      {!rows.length && <CompactEmpty title="Ready when you are" />}
    </div>
  );
}

function WeightRoomView({
  data,
  selectedPlayerId,
  form,
  leader,
  tab,
  workoutDate,
  workoutTitle,
  workoutStatus,
  activeExercise,
  setForm,
  weighInOpen,
  onPlayer,
  onOpenPlayer,
  onForm,
  onTab,
  onWorkoutTitle,
  onWorkoutDate,
  onActiveExercise,
  onSetForm,
  onAddEntry,
  onRemoveEntry,
  onStartWorkout,
  onCompleteWorkout,
  onWeighInOpen,
  onSaveWeighIns,
}: {
  data: AppData;
  selectedPlayerId: ID;
  form: { exercise: string; weight: string; reps: string; sets: string; effort: string };
  leader?: WeightLeaderResult;
  tab: WeightRoomTab;
  workoutDate: string;
  workoutTitle: string;
  workoutStatus: "Idle" | "In Progress" | "Completed";
  activeExercise: string;
  setForm: { weight: string; reps: string; rpe: string; value: string };
  weighInOpen: boolean;
  onPlayer: (playerId: ID) => void;
  onOpenPlayer: (playerId: ID) => void;
  onForm: (form: { exercise: string; weight: string; reps: string; sets: string; effort: string }) => void;
  onTab: (tab: WeightRoomTab) => void;
  onWorkoutTitle: (value: string) => void;
  onWorkoutDate: (value: string) => void;
  onActiveExercise: (value: string) => void;
  onSetForm: (form: { weight: string; reps: string; rpe: string; value: string }) => void;
  onAddEntry: (draft?: WeightRoomSetDraft) => void;
  onRemoveEntry: (entryId: ID) => void;
  onStartWorkout: (input: { title: string; date: string; location?: string; eventId?: ID }) => void;
  onCompleteWorkout: () => void;
  onWeighInOpen: (open: boolean) => void;
  onSaveWeighIns: (rows: Array<{ playerId: ID; weight?: number }>, date: string) => void;
}) {
  const players = sortPlayersByRecent(data.players.filter((player) => !player.archived), data.settings.recentPlayerIds);
  const selected = players.find((player) => player.id === selectedPlayerId) ?? players[0];
  const team = data.teamContext?.currentTeam;
  const exercises = buildWeightRoomExerciseLibrary(data);
  const selectedExercise = exercises.find((exercise) => exercise.name === activeExercise) ?? exercises[0];
  const sessionsForDate = data.workoutSessions.filter((session) => session.date === workoutDate);
  const entriesForDate = data.workoutEntries.filter((entry) => entrySessionDate(data, entry) === workoutDate);
  const teamOverview = buildWeightRoomTeamOverview(data, players, workoutDate);
  const leaderboard = buildScoredWeightRoomLeaderboard(players, data.workoutSessions, data.workoutEntries, "This Season");
  const leaderRows = leaderboard.length ? leaderboard.slice(0, 5) : leader ? [leader] : [];
  const template = WEIGHT_ROOM_TEMPLATES.find((item) => item.name === workoutTitle) ?? WEIGHT_ROOM_TEMPLATES[0];
  const workoutExercises = uniqueStrings([activeExercise, ...template.exercises])
    .map((name) => exercises.find((exercise) => exercise.name === name) ?? makeWeightRoomExercise(name))
    .slice(0, 8);
  const [reviewWorkoutDate, setReviewWorkoutDate] = useState<string | undefined>();
  const reviewSessionsForDate = reviewWorkoutDate ? data.workoutSessions.filter((session) => session.date === reviewWorkoutDate) : [];
  const reviewEntriesForDate = reviewWorkoutDate ? data.workoutEntries.filter((entry) => entrySessionDate(data, entry) === reviewWorkoutDate) : [];

  function startWorkoutFromSelection(input?: { title?: string; date?: string; location?: string; eventId?: ID }) {
    setReviewWorkoutDate(undefined);
    onStartWorkout({
      title: input?.title ?? workoutTitle,
      date: input?.date ?? workoutDate,
      location: input?.location ?? teamLocation(team),
      eventId: input?.eventId,
    });
    onTab("WorkoutSession");
  }

  function reviewWorkout(row: WeightRoomWorkoutSummary) {
    setReviewWorkoutDate(row.date);
    onWorkoutTitle(row.title);
    onWorkoutDate(row.date);
    onTab("WorkoutSession");
  }

  function openWorkoutBuilder() {
    setReviewWorkoutDate(undefined);
    onTab("WorkoutSession");
  }

  function completeSet(status: WorkoutEntry["status"] = "Completed") {
    if (!selected || !selectedExercise) return;
    const weight = optionalNumber(setForm.weight);
    const reps = optionalNumber(setForm.reps);
    const value = optionalNumber(setForm.value);
    const rpe = optionalNumber(setForm.rpe);
    const draft: WeightRoomSetDraft = {
      playerId: selected.id,
      exercise: selectedExercise.name,
      kind: selectedExercise.kind,
      date: workoutDate,
      rpe,
      status,
      unit: selectedExercise.unit,
    };

    if (selectedExercise.measurementType === "WEIGHT_REPS") {
      draft.weight = weight;
      draft.reps = reps;
      draft.unit = "lb";
    } else if (selectedExercise.measurementType === "BODYWEIGHT_REPS") {
      draft.reps = reps;
      draft.unit = "reps";
    } else if (selectedExercise.measurementType === "TIME") {
      draft.value = value;
      draft.unit = selectedExercise.unit ?? "sec";
    } else if (selectedExercise.measurementType === "DISTANCE" || selectedExercise.measurementType === "HEIGHT") {
      draft.value = value;
      draft.unit = selectedExercise.unit ?? "in";
    } else if (selectedExercise.measurementType === "COUNT") {
      draft.value = value ?? reps;
      draft.unit = "reps";
    }

    if (status === "Skipped") draft.notes = "Skipped set";
    onAddEntry(draft);
  }

  return (
    <div className="page-stack weights-page weight-room-page">
      <section className="weight-room-shell-header panel">
        <div className="weight-room-shell-header__identity">
          {team && <OrganizationLogo name={team.teamName} imageUrl={team.logoUrl} size="lg" />}
          <span>
            <h2>Weight Room</h2>
          </span>
        </div>
        <SegmentedControl values={WEIGHT_ROOM_TABS} active={tab} onChange={onTab} />
        <div className="weight-room-shell-header__actions">
          <button className="secondary-button" type="button" onClick={() => onWeighInOpen(true)}>
            <Gauge size={16} aria-hidden="true" />
            Log Weigh-Ins
          </button>
          <button className="primary-button" type="button" onClick={() => startWorkoutFromSelection()}>
            <Plus size={16} aria-hidden="true" />
            Start Workout
          </button>
        </div>
      </section>

      {tab === "Overview" && (
        <section className="weight-room-overview-grid">
          <WeightLeaderCard leaders={leaderRows} onOpenPlayer={onOpenPlayer} />
          <WeightRoomWeighInCard data={data} players={players} date={workoutDate} onOpen={() => onWeighInOpen(true)} />
          <WeightRoomRecentWorkouts data={data} players={players} onStart={startWorkoutFromSelection} onReview={reviewWorkout} onViewAll={openWorkoutBuilder} />
          <WeightRoomTeamOverview overview={teamOverview} onViewWorkouts={openWorkoutBuilder} onStartWorkout={() => startWorkoutFromSelection()} />
        </section>
      )}

      {tab === "WorkoutSession" && (
        <section className="weight-room-workout-stack">
          {workoutStatus === "In Progress" ? (
            <WeightRoomActiveWorkout
              data={data}
              players={players}
              selectedPlayer={selected}
              exercises={workoutExercises}
              workoutTitle={workoutTitle}
              workoutDate={workoutDate}
              workoutStatus={workoutStatus}
              activeExercise={selectedExercise}
              setForm={setForm}
              entriesForDate={entriesForDate}
              sessionsForDate={sessionsForDate}
              onPlayer={onPlayer}
              onOpenPlayer={onOpenPlayer}
              onActiveExercise={onActiveExercise}
              onSetForm={onSetForm}
              onCompleteSet={() => completeSet("Completed")}
              onSkipSet={() => completeSet("Skipped")}
              onRemoveEntry={onRemoveEntry}
              onCompleteWorkout={onCompleteWorkout}
              onWeighInOpen={() => onWeighInOpen(true)}
            />
          ) : reviewWorkoutDate ? (
            <WeightRoomWorkoutReview
              title={workoutTitle}
              date={reviewWorkoutDate}
              players={players}
              sessions={reviewSessionsForDate}
              entries={reviewEntriesForDate}
              data={data}
              onStartNew={() => startWorkoutFromSelection({ title: workoutTitle, date: reviewWorkoutDate })}
              onPlayer={onOpenPlayer}
            />
          ) : (
            <>
              <WeightRoomTemplateGrid
                title={workoutTitle}
                date={workoutDate}
                exercises={exercises}
                onTitle={onWorkoutTitle}
                onDate={onWorkoutDate}
                onExercise={onActiveExercise}
                onStart={() => startWorkoutFromSelection()}
              />
              <WeightRoomRecentWorkouts data={data} players={players} onStart={startWorkoutFromSelection} onReview={reviewWorkout} expanded />
            </>
          )}
        </section>
      )}

      {tab === "Athletes" && selected && (
        <WeightRoomPlayerPanel data={data} players={players} player={selected} onPlayer={onPlayer} onOpenPlayer={onOpenPlayer} />
      )}

      {tab === "Exercises" && (
        <section className="weight-room-exercise-grid">
          <WeightRoomExerciseLibraryCard
            exercises={exercises}
            activeExercise={activeExercise}
            customExercise={form.exercise}
            onCustomExercise={(value) => onForm({ ...form, exercise: value })}
            onExercise={(exercise) => {
              onActiveExercise(exercise);
              openWorkoutBuilder();
            }}
          />
          <WeightRoomExerciseResults data={data} players={players} exercise={activeExercise} onPlayer={onPlayer} />
        </section>
      )}

      {tab === "Leaderboard" && (
        <WeightRoomLeaderboardPanel players={players} sessions={data.workoutSessions} entries={data.workoutEntries} onOpenPlayer={onOpenPlayer} />
      )}

      {weighInOpen && (
        <WeightRoomWeighInModal
          data={data}
          players={players}
          date={workoutDate}
          onClose={() => onWeighInOpen(false)}
          onSave={(rows, date) => {
            onSaveWeighIns(rows, date);
            onWorkoutDate(date);
            onWeighInOpen(false);
          }}
        />
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyWeightRoomView({
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
  const liftEvents = buildScheduleItems(data).filter((item) => item.eventType === "Lift").slice(0, 5);

  return (
    <div className="page-stack weights-page">
      <SectionHeader title="Weight Room" context={data.teamContext?.currentTeam ? `${data.teamContext.currentTeam.teamName} - ${data.teamContext.currentTeam.seasonName ?? "Current season"}` : undefined} />
      <section className="weights-grid">
        <WeightLeaderCard leader={leader} onOpenPlayer={onOpenPlayer} />
        <article className="panel weight-schedule-card">
          <div className="panel-heading tight">
            <div>
              <span>Schedule</span>
              <h2>Team Lifts</h2>
            </div>
            <ScheduleCalendarIcon size={18} aria-hidden="true" />
          </div>
          {liftEvents.length ? (
            <div className="upcoming-schedule-list">
              {liftEvents.map((item) => (
                <button key={item.id} type="button">
                  <time>{item.date === todayKey() ? "Today" : shortDate(item.date)}</time>
                  <ScheduleTypeIcon type={item.eventType} />
                  <span>
                    <strong>{item.title}</strong>
                    <small>{formatTime(item.startAt)}{item.location ? ` - ${item.location}` : ""}</small>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <CompactEmpty title="No lifts scheduled yet" />
          )}
        </article>
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

function WeightRoomWeighInCard({ data, players, date, onOpen }: { data: AppData; players: Player[]; date: string; onOpen: () => void }) {
  const [page, setPage] = useState(0);
  const currentWeek = weekStart(date);
  const rows = players.map((player) => {
    const thisWeek = latestWeeklyBodyWeight(data, player.id, currentWeek, date);
    const lastWeek = latestBodyWeightBeforeWeek(data, player.id, currentWeek);
    const starting = startingBodyWeight(data, player.id);
    const change = typeof thisWeek === "number" && typeof lastWeek === "number" ? thisWeek - lastWeek : undefined;
    return { player, thisWeek, lastWeek, starting, change };
  });
  const pageSize = 5;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visibleRows = rows.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const weighed = rows.filter((row) => typeof row.thisWeek === "number").length;

  return (
    <article className="panel weight-room-weigh-card">
      <div className="panel-heading tight">
        <div>
          <span>{weighed}/{players.length} logged</span>
          <h2>Weigh-ins</h2>
        </div>
        <div className="weight-room-card-actions">
          <button className="icon-button weight-room-pager-button" type="button" disabled={safePage === 0} onClick={() => setPage(Math.max(0, safePage - 1))} aria-label="Previous weigh-in page">
            <ChevronLeft size={15} aria-hidden="true" />
          </button>
          <button className="icon-button weight-room-pager-button" type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))} aria-label="Next weigh-in page">
            <ChevronRight size={15} aria-hidden="true" />
          </button>
          <button className="text-button" type="button" onClick={onOpen}>View All</button>
        </div>
      </div>
      <div className="weight-room-mini-table">
        <div>
          <span>Player</span>
          <span>This Week</span>
          <span>Last Week</span>
          <span>Change</span>
          <span>Starting</span>
        </div>
        {visibleRows.map((row) => (
          <button key={row.player.id} type="button" onClick={onOpen}>
            <strong><PlayerAvatar player={row.player} size="sm" compact />{row.player.name}</strong>
            <span>{row.thisWeek ? `${formatNumber(row.thisWeek, 1)} lb` : "-"}</span>
            <span>{row.lastWeek ? `${formatNumber(row.lastWeek, 1)} lb` : "-"}</span>
            <em className={row.change && row.change > 0 ? "positive" : row.change && row.change < 0 ? "negative" : ""}>
              {typeof row.change === "number" ? `${row.change > 0 ? "+" : ""}${formatNumber(row.change, 1)}` : "-"}
            </em>
            <span>{row.starting ? `${formatNumber(row.starting, 1)} lb` : "-"}</span>
          </button>
        ))}
      </div>
    </article>
  );
}

function WeightRoomRecentWorkouts({
  data,
  players,
  onStart,
  onReview,
  onViewAll,
  expanded = false,
}: {
  data: AppData;
  players: Player[];
  onStart: (input?: { title?: string; date?: string; location?: string; eventId?: ID }) => void;
  onReview?: (row: WeightRoomWorkoutSummary) => void;
  onViewAll?: () => void;
  expanded?: boolean;
}) {
  const allWorkoutRows = buildRecentWeightRoomWorkouts(data, players);
  const allLiftRows = buildScheduleItems(data)
    .filter((item) => item.eventType === "Lift" && item.status !== "Cancelled")
    .sort((left, right) => Date.parse(left.startAt) - Date.parse(right.startAt));
  const upcomingLifts = allLiftRows.filter((item) => item.status !== "Completed" && isUpcomingScheduleItem(item));
  const lifts = expanded ? upcomingLifts.slice(0, 5) : upcomingLifts.slice(0, 1);
  const completedRows = allWorkoutRows.filter((row) => row.completed);
  const openRows = allWorkoutRows.filter((row) => !row.completed);
  const workoutRows = expanded
    ? [...openRows, ...completedRows].slice(0, 8)
    : completedRows.slice(0, 1);
  const totalRows = lifts.length + workoutRows.length;

  return (
    <article className="panel weight-room-recent-card">
      <div className="panel-heading tight">
        <div>
          <span>{expanded ? "Workout History" : "Team sessions"}</span>
          <h2>{totalRows ? "Lifts" : "No workouts yet"}</h2>
        </div>
        {!expanded && onViewAll && totalRows > 0 && (
          <button className="text-button" type="button" onClick={onViewAll}>View All</button>
        )}
      </div>
      <div className="weight-room-workout-list">
        {lifts.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onStart({ title: item.title, date: item.date, location: item.location, eventId: item.source === "event" ? item.sourceId : undefined })}
          >
            <ScheduleTypeIcon type="Lift" />
            <span>
              <strong>{item.title}</strong>
              <small>{formatWeightRoomSessionMeta(item.date, item.startAt)}</small>
            </span>
            <em>Scheduled</em>
          </button>
        ))}
        {workoutRows.map((row) => (
          <button
            key={`${row.date}-${row.title}`}
            type="button"
            onClick={() => row.completed && onReview ? onReview(row) : onStart({ title: row.title, date: row.date, location: row.location })}
          >
            <ScheduleTypeIcon type="Lift" />
            <span>
              <strong>{row.title}</strong>
              <small>{formatWeightRoomSessionMeta(row.date, row.startAt)}</small>
            </span>
            <em>{row.completed ? "Completed" : "Open"}</em>
          </button>
        ))}
        {!totalRows && <CompactEmpty title="Start the first lift to begin tracking." />}
      </div>
    </article>
  );
}

function WeightRoomTeamOverview({
  overview,
  onViewWorkouts,
  onStartWorkout,
}: {
  overview: ReturnType<typeof buildWeightRoomTeamOverview>;
  onViewWorkouts: () => void;
  onStartWorkout: () => void;
}) {
  const setsPerAthlete = overview.completedAthletes ? overview.sets / overview.completedAthletes : 0;
  const volumeTrend = overview.volumeChangePct !== undefined
    ? `${overview.volumeChangePct >= 0 ? "+" : ""}${formatNumber(overview.volumeChangePct, 0)}% vs last week`
    : overview.completedWorkoutCount > 1 ? "No prior week sample" : "Logged this week";
  const strengthTrend = overview.strengthTrendPct !== undefined
    ? `${overview.strengthTrendPct >= 0 ? "+" : ""}${formatNumber(overview.strengthTrendPct, 0)}%`
    : "--";
  const strengthTrendDetail = overview.strengthTrendPct !== undefined ? "own-baseline trend" : "Need more data";

  return (
    <article className="panel weight-room-team-overview weight-room-pulse-card">
      <div className="weight-room-pulse-header">
        <div className="weight-room-pulse-title">
          <span className="weight-room-pulse-title-icon" aria-hidden="true">
            <Dumbbell size={17} />
          </span>
          <h2>This Week</h2>
        </div>
        <button className="text-button" type="button" onClick={onViewWorkouts}>View All Workouts <ChevronRight size={15} aria-hidden="true" /></button>
      </div>
      {overview.completedWorkoutCount === 0 ? (
        <div className="weight-room-pulse-empty">
          <span>No completed workouts this week</span>
          <small>{overview.nextLift ? `Next lift: ${overview.nextLift.title} - ${formatWeightRoomSessionMeta(overview.nextLift.date, overview.nextLift.startAt)}` : "Build the next lift when the team is ready."}</small>
          <button className="secondary-button" type="button" onClick={onStartWorkout}>
            <Plus size={15} aria-hidden="true" />
            Start Workout
          </button>
        </div>
      ) : (
        <>
          <div className="weight-room-pulse-metrics">
            <div className="weight-room-pulse-metric weight-room-pulse-metric--completion" aria-label={`Completion ${Math.round(overview.completionPct)} percent, ${overview.completedAthletes} of ${overview.athletes} athletes`}>
              <span className="weight-room-pulse-icon" aria-hidden="true"><Check size={15} /></span>
              <span className="weight-room-pulse-label">Completion</span>
              <strong>{Math.round(overview.completionPct)}%</strong>
            </div>
            <div className="weight-room-pulse-metric weight-room-pulse-metric--sets" aria-label={`${formatNumber(setsPerAthlete, setsPerAthlete % 1 ? 1 : 0)} sets per athlete, ${overview.sets} total sets`}>
              <span className="weight-room-pulse-icon" aria-hidden="true"><BarChart3 size={15} /></span>
              <span className="weight-room-pulse-label">Sets / Athlete</span>
              <strong>{formatNumber(setsPerAthlete, setsPerAthlete % 1 ? 1 : 0)}</strong>
            </div>
            <div className="weight-room-pulse-metric weight-room-pulse-metric--volume" aria-label={`Total volume ${formatWorkoutVolume(overview.volume)}, ${volumeTrend}`}>
              <span className="weight-room-pulse-icon" aria-hidden="true"><Dumbbell size={15} /></span>
              <span className="weight-room-pulse-label">Total Volume</span>
              <strong>{formatWorkoutVolume(overview.volume)}</strong>
            </div>
            <div className="weight-room-pulse-metric weight-room-pulse-metric--trend" aria-label={`Strength trend ${strengthTrend}, ${strengthTrendDetail}`}>
              <span className="weight-room-pulse-icon" aria-hidden="true"><TrendingUp size={15} /></span>
              <span className="weight-room-pulse-label">Strength Trend</span>
              <strong className={overview.strengthTrendPct && overview.strengthTrendPct > 0 ? "positive" : ""}>{strengthTrend}</strong>
            </div>
          </div>
        </>
      )}
    </article>
  );
}

function WeightRoomWorkoutReview({
  title,
  date,
  players,
  sessions,
  entries,
  data,
  onStartNew,
  onPlayer,
}: {
  title: string;
  date: string;
  players: Player[];
  sessions: WorkoutSession[];
  entries: WorkoutEntry[];
  data: AppData;
  onStartNew: () => void;
  onPlayer: (playerId: ID) => void;
}) {
  const activeEntries = entries.filter((entry) => (entry.status ?? "Completed") !== "Skipped");
  const sessionPlayers = sessions
    .map((session) => players.find((player) => player.id === session.playerId))
    .filter((player): player is Player => Boolean(player));
  const playerRows = sessionPlayers.map((player) => {
    const playerEntries = activeEntries.filter((entry) => entry.playerId === player.id);
    return {
      player,
      sets: playerEntries.reduce((sum, entry) => sum + Math.max(1, entry.sets ?? 1), 0),
      volume: playerEntries.reduce((sum, entry) => sum + workoutEntryVolume(entry), 0),
      weight: latestBodyWeight(data, player.id, date, true),
    };
  });
  const exerciseRows = uniqueStrings(activeEntries.map((entry) => entry.exercise)).map((exercise) => {
    const exerciseEntries = activeEntries.filter((entry) => entry.exercise === exercise);
    return {
      exercise,
      sets: exerciseEntries.reduce((sum, entry) => sum + Math.max(1, entry.sets ?? 1), 0),
      volume: exerciseEntries.reduce((sum, entry) => sum + workoutEntryVolume(entry), 0),
      best: bestWorkoutEntry(exerciseEntries),
    };
  });
  const weighInRows = sessionPlayers
    .map((player) => ({ player, weight: latestBodyWeight(data, player.id, date, true) }))
    .filter((row) => typeof row.weight === "number");
  const workoutMeta = buildRecentWeightRoomWorkouts(data, players).find((row) => row.date === date && row.title === title);

  return (
    <article className="panel weight-room-review-card">
      <div className="panel-heading tight">
        <div>
          <span>Completed workout</span>
          <h2>{title}</h2>
          <p>{formatWeightRoomSessionMeta(date, workoutMeta?.startAt)}</p>
        </div>
        <button className="secondary-button" type="button" onClick={onStartNew}>
          <Plus size={15} aria-hidden="true" />
          Start New Workout
        </button>
      </div>
      <div className="weight-room-review-metrics">
        <StatTile label="Athletes" value={sessionPlayers.length} />
        <StatTile label="Sets" value={activeEntries.reduce((sum, entry) => sum + Math.max(1, entry.sets ?? 1), 0)} />
        <StatTile label="Volume" value={formatWorkoutVolume(activeEntries.reduce((sum, entry) => sum + workoutEntryVolume(entry), 0))} />
        <StatTile label="Weigh-ins" value={weighInRows.length} />
      </div>
      <div className="weight-room-review-grid">
        <div className="weight-room-review-table">
          <h3>Players</h3>
          {playerRows.length ? playerRows.map((row) => (
            <button key={row.player.id} type="button" onClick={() => onPlayer(row.player.id)}>
              <strong><PlayerAvatar player={row.player} size="sm" compact />{row.player.name}</strong>
              <span>{row.sets} sets</span>
              <span>{formatWorkoutVolume(row.volume)}</span>
              <span>{row.weight ? `${formatNumber(row.weight, 1)} lb` : "--"}</span>
            </button>
          )) : <CompactEmpty title="No player stats recorded." />}
        </div>
        <div className="weight-room-review-table">
          <h3>Exercises</h3>
          {exerciseRows.length ? exerciseRows.map((row) => (
            <div key={row.exercise}>
              <strong>{row.exercise}</strong>
              <span>{row.sets} sets</span>
              <span>{formatWorkoutVolume(row.volume)}</span>
              <span>{row.best ? formatWorkoutEntryValue(row.best) : "--"}</span>
            </div>
          )) : <CompactEmpty title="No exercise stats recorded." />}
        </div>
        <div className="weight-room-review-table">
          <h3>Weigh-ins</h3>
          {weighInRows.length ? weighInRows.map((row) => (
            <button key={row.player.id} type="button" onClick={() => onPlayer(row.player.id)}>
              <strong><PlayerAvatar player={row.player} size="sm" compact />{row.player.name}</strong>
              <span>{formatNumber(row.weight, 1)} lb</span>
            </button>
          )) : <CompactEmpty title="No weigh-ins logged for this workout." />}
        </div>
      </div>
    </article>
  );
}

function WeightRoomTemplateGrid({
  title,
  date,
  exercises,
  onTitle,
  onDate,
  onExercise,
  onStart,
}: {
  title: string;
  date: string;
  exercises: WeightRoomExercise[];
  onTitle: (value: string) => void;
  onDate: (value: string) => void;
  onExercise: (value: string) => void;
  onStart: () => void;
}) {
  const template = WEIGHT_ROOM_TEMPLATES.find((item) => item.name === title) ?? WEIGHT_ROOM_TEMPLATES[0];
  return (
    <section className="panel weight-room-template-builder">
      <div className="panel-heading tight">
        <div>
          <span>Create Workout</span>
          <h2>Choose a template and start fast</h2>
        </div>
        <button className="primary-button" type="button" onClick={onStart}><Plus size={16} aria-hidden="true" />Start Workout</button>
      </div>
      <div className="weight-room-create-grid">
        <ChoiceSelect
          value={title}
          className="form-choice"
          options={WEIGHT_ROOM_TEMPLATES.map((item) => ({ value: item.name, label: item.name, description: `${item.exercises.length} exercises`, icon: <Dumbbell size={15} aria-hidden="true" /> }))}
          onChange={onTitle}
          aria-label="Workout template"
        />
        <DatePickerField label="Workout date" value={date} onChange={onDate} />
      </div>
      <div className="weight-room-template-grid">
        {WEIGHT_ROOM_TEMPLATES.map((item) => (
          <button key={item.name} type="button" className={item.name === title ? "active" : ""} onClick={() => onTitle(item.name)}>
            <strong>{item.name}</strong>
            <small>{item.exercises.join(" - ")}</small>
          </button>
        ))}
      </div>
      <div className="weight-room-exercise-chip-list">
        {template.exercises.map((exercise) => {
          const meta = exercises.find((item) => item.name === exercise);
          return (
            <button key={exercise} type="button" onClick={() => onExercise(exercise)}>
              <strong>{exercise}</strong>
              <small>{meta?.targetSets ?? 3} sets{meta?.targetReps ? ` - ${meta.targetReps} reps` : ""}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function WeightRoomActiveWorkout({
  data,
  players,
  selectedPlayer,
  exercises,
  workoutTitle,
  workoutDate,
  workoutStatus,
  activeExercise,
  setForm,
  entriesForDate,
  sessionsForDate,
  onPlayer,
  onOpenPlayer,
  onActiveExercise,
  onSetForm,
  onCompleteSet,
  onSkipSet,
  onRemoveEntry,
  onCompleteWorkout,
  onWeighInOpen,
}: {
  data: AppData;
  players: Player[];
  selectedPlayer?: Player;
  exercises: WeightRoomExercise[];
  workoutTitle: string;
  workoutDate: string;
  workoutStatus: "Idle" | "In Progress" | "Completed";
  activeExercise?: WeightRoomExercise;
  setForm: { weight: string; reps: string; rpe: string; value: string };
  entriesForDate: WorkoutEntry[];
  sessionsForDate: WorkoutSession[];
  onPlayer: (playerId: ID) => void;
  onOpenPlayer: (playerId: ID) => void;
  onActiveExercise: (value: string) => void;
  onSetForm: (form: { weight: string; reps: string; rpe: string; value: string }) => void;
  onCompleteSet: () => void;
  onSkipSet: () => void;
  onRemoveEntry: (entryId: ID) => void;
  onCompleteWorkout: () => void;
  onWeighInOpen: () => void;
}) {
  const selected = selectedPlayer ?? players[0];
  const exercise = activeExercise ?? exercises[0];
  const selectedEntries = entriesForDate
    .filter((entry) => entry.playerId === selected?.id && entry.exercise === exercise?.name)
    .sort((a, b) => (a.setNumber ?? 0) - (b.setNumber ?? 0) || a.createdAt.localeCompare(b.createdAt));
  const setCount = selectedEntries.filter((entry) => (entry.status ?? "Completed") !== "Skipped").length;
  const targetSets = exercise?.targetSets ?? 4;
  const lastEntry = selectedEntries[selectedEntries.length - 1];
  const previousEntries = data.workoutEntries
    .filter((entry) => entry.playerId === selected?.id && entry.exercise === exercise?.name && entrySessionDate(data, entry) < workoutDate)
    .slice(0, 4);
  const bodyWeight = selected ? latestBodyWeight(data, selected.id, workoutDate) : undefined;

  return (
    <section className="weight-room-active-layout">
      <aside className="panel weight-room-athlete-panel">
        {selected && (
          <button type="button" className="weight-room-athlete-card" onClick={() => onOpenPlayer(selected.id)}>
            <PlayerAvatar player={selected} size="lg" />
            <span>
              <strong>{selected.name}</strong>
              <small>#{selected.jerseyNumber} - {selected.primaryPosition}</small>
            </span>
          </button>
        )}
        <div className="weight-room-bodyweight">
          <span>{bodyWeight ? `${formatNumber(bodyWeight, 1)} lb` : "No weigh-in"}</span>
          <button type="button" onClick={onWeighInOpen}>{bodyWeight ? "Change" : "Add Weight"}</button>
        </div>
        <div className="weight-room-progress-block">
          <MetricBar label="Exercises" value={uniqueStrings(entriesForDate.map((entry) => entry.exercise)).length} max={Math.max(1, exercises.length)} helper={`${uniqueStrings(entriesForDate.map((entry) => entry.exercise)).length}/${exercises.length}`} />
          <MetricBar label="Sets Completed" value={entriesForDate.filter((entry) => (entry.status ?? "Completed") !== "Skipped").length} max={Math.max(1, players.length * exercises.length * 3)} helper={`${entriesForDate.filter((entry) => (entry.status ?? "Completed") !== "Skipped").length} sets`} />
        </div>
        <div className="weight-room-next-up">
          <span>Workout</span>
          <strong>{workoutTitle}</strong>
          <small>{formatPickerDate(workoutDate)} - {workoutStatus}</small>
        </div>
      </aside>

      <main className="panel weight-room-set-console">
        <div className="weight-room-active-header">
          <div>
            <span>{workoutTitle}</span>
            <h2>{exercise?.name ?? "Exercise"}</h2>
            <small>{exercise?.equipment ?? exercise?.category} - Set {Math.min(setCount + 1, targetSets)} of {targetSets}</small>
          </div>
          <div className="weight-room-session-stats">
            <strong>{selectedEntries.length}</strong><span>sets</span>
            <strong>{formatWorkoutVolume(selectedEntries.reduce((sum, entry) => sum + workoutEntryVolume(entry), 0))}</strong><span>volume</span>
          </div>
        </div>

        <div className="weight-room-entry-grid">
          {exercise?.measurementType === "WEIGHT_REPS" && (
            <>
              <WeightNumberStepper label="Weight" suffix="lbs" value={setForm.weight} step={5} onChange={(value) => onSetForm({ ...setForm, weight: value })} />
              <WeightNumberStepper label="Reps" value={setForm.reps} step={1} onChange={(value) => onSetForm({ ...setForm, reps: value })} />
            </>
          )}
          {exercise?.measurementType !== "WEIGHT_REPS" && exercise?.measurementType !== "RPE_ONLY" && (
            <WeightNumberStepper
              label={weightRoomMeasurementLabel(exercise)}
              suffix={exercise?.unit}
              value={exercise?.measurementType === "BODYWEIGHT_REPS" ? setForm.reps : setForm.value}
              step={exercise?.measurementType === "TIME" ? 5 : 1}
              onChange={(value) => onSetForm(exercise?.measurementType === "BODYWEIGHT_REPS" ? { ...setForm, reps: value } : { ...setForm, value })}
            />
          )}
          <WeightNumberStepper label="RPE" value={setForm.rpe} step={1} min={0} max={10} onChange={(value) => onSetForm({ ...setForm, rpe: value })} optional />
        </div>

        <div className="weight-room-set-actions">
          <button className="primary-button" type="button" onClick={onCompleteSet}><Check size={16} aria-hidden="true" />Complete Set</button>
          <button className="secondary-button" type="button" onClick={onSkipSet}>Skip Set</button>
          <button className="ghost-button" type="button" disabled={!lastEntry} onClick={() => lastEntry && onRemoveEntry(lastEntry.id)}><Undo2 size={16} aria-hidden="true" />Undo Last</button>
          <span className="weight-room-rest-timer"><ClockIcon /> Rest 1:30</span>
        </div>

        <div className="weight-room-suggestion-row">
          <span>Previous</span>
          {previousEntries.length ? previousEntries.map((entry) => (
            <button key={entry.id} type="button" onClick={() => onSetForm({
              ...setForm,
              weight: entry.weight ? String(entry.weight) : setForm.weight,
              reps: entry.reps ? String(entry.reps) : setForm.reps,
              value: entry.value ? String(entry.value) : setForm.value,
              rpe: entry.rpe ? String(entry.rpe) : setForm.rpe,
            })}>
              {formatWorkoutEntryValue(entry)}
            </button>
          )) : <small>No previous sets for this athlete/exercise.</small>}
        </div>

        <WeightRoomSetTable entries={selectedEntries} onRemoveEntry={onRemoveEntry} />
      </main>

      <aside className="panel weight-room-exercise-rail">
        <div className="panel-heading tight">
          <div>
            <span>Workout Exercises</span>
            <h2>{entriesForDate.length} sets today</h2>
          </div>
        </div>
        <div className="weight-room-exercise-rail__list">
          {exercises.map((item, index) => {
            const completed = entriesForDate.filter((entry) => entry.exercise === item.name && (entry.status ?? "Completed") !== "Skipped").length;
            return (
              <button key={item.name} type="button" className={item.name === exercise?.name ? "active" : ""} onClick={() => onActiveExercise(item.name)}>
                <em>{index + 1}</em>
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.equipment ?? item.category}</small>
                </span>
                <small>{completed}/{item.targetSets ?? 3}</small>
              </button>
            );
          })}
        </div>
        <button className="ghost-button stretch-button" type="button"><Plus size={16} aria-hidden="true" />Add Exercise</button>
      </aside>

      <WeightRoomAthleteStrip players={players} selectedPlayerId={selected?.id} onPlayer={onPlayer} />

      <section className="panel weight-room-active-summary">
        <StatTile label="Athletes Active" value={sessionsForDate.length || players.length} />
        <StatTile label="Exercises Completed" value={`${uniqueStrings(entriesForDate.map((entry) => entry.exercise)).length}/${exercises.length}`} />
        <StatTile label="Sets Completed" value={entriesForDate.filter((entry) => (entry.status ?? "Completed") !== "Skipped").length} />
        <StatTile label="Weigh-Ins" value={sessionsForDate.filter((session) => typeof session.bodyWeight === "number").length} />
        <button className="primary-button" type="button" onClick={onCompleteWorkout}>Finish Workout</button>
      </section>
    </section>
  );
}

function WeightNumberStepper({
  label,
  value,
  suffix,
  step,
  min = 0,
  max = 9999,
  optional = false,
  onChange,
}: {
  label: string;
  value: string;
  suffix?: string;
  step: number;
  min?: number;
  max?: number;
  optional?: boolean;
  onChange: (value: string) => void;
}) {
  const numeric = optionalNumber(value) ?? 0;
  function adjust(delta: number) {
    onChange(String(Math.max(min, Math.min(max, numeric + delta))));
  }
  return (
    <label className="weight-number-stepper">
      <span>{label}{optional ? " optional" : ""}</span>
      <div>
        <button type="button" onClick={() => adjust(-step)} aria-label={`Decrease ${label}`}>-</button>
        <input inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value.replace(/[^0-9.]/g, ""))} />
        <button type="button" onClick={() => adjust(step)} aria-label={`Increase ${label}`}>+</button>
      </div>
      {suffix && <small>{suffix}</small>}
    </label>
  );
}

function WeightRoomSetTable({ entries, onRemoveEntry }: { entries: WorkoutEntry[]; onRemoveEntry: (entryId: ID) => void }) {
  return (
    <div className="weight-room-set-table" role="table" aria-label="Workout sets">
      <div role="row">
        <span>Set</span>
        <span>Value</span>
        <span>Reps</span>
        <span>RPE</span>
        <span>Status</span>
        <span />
      </div>
      {entries.map((entry) => (
        <div key={entry.id} role="row">
          <strong>{entry.setNumber ?? "-"}</strong>
          <span>{formatWorkoutEntryValue(entry)}</span>
          <span>{entry.reps ?? "-"}</span>
          <span>{entry.rpe ?? "-"}</span>
          <em className={entry.status === "Skipped" ? "muted" : "positive"}>{entry.status ?? "Completed"}</em>
          <button type="button" onClick={() => onRemoveEntry(entry.id)} aria-label={`Remove set ${entry.setNumber ?? ""}`}><Trash2 size={14} aria-hidden="true" /></button>
        </div>
      ))}
      {!entries.length && <CompactEmpty title="No sets logged for this athlete yet." />}
    </div>
  );
}

function WeightRoomAthleteStrip({ players, selectedPlayerId, onPlayer }: { players: Player[]; selectedPlayerId?: ID; onPlayer: (playerId: ID) => void }) {
  const selectedIndex = Math.max(0, players.findIndex((player) => player.id === selectedPlayerId));
  const previous = players[Math.max(0, selectedIndex - 1)];
  const next = players[Math.min(players.length - 1, selectedIndex + 1)];
  return (
    <div className="panel weight-room-athlete-strip">
      <button type="button" disabled={!previous || previous.id === selectedPlayerId} onClick={() => previous && onPlayer(previous.id)}><ChevronLeft size={16} aria-hidden="true" />Previous</button>
      <div>
        {players.slice(Math.max(0, selectedIndex - 3), selectedIndex + 6).map((player) => (
          <button key={player.id} type="button" className={player.id === selectedPlayerId ? "active" : ""} onClick={() => onPlayer(player.id)}>
            <PlayerAvatar player={player} size="sm" compact />
            <span>{player.name.split(" ").slice(-1)[0]}</span>
          </button>
        ))}
      </div>
      <button type="button" disabled={!next || next.id === selectedPlayerId} onClick={() => next && onPlayer(next.id)}>Next<ChevronRight size={16} aria-hidden="true" /></button>
    </div>
  );
}

function WeightRoomPlayerPanel({
  data,
  players,
  player,
  onPlayer,
  onOpenPlayer,
}: {
  data: AppData;
  players: Player[];
  player: Player;
  onPlayer: (playerId: ID) => void;
  onOpenPlayer: (playerId: ID) => void;
}) {
  const [playerTab, setPlayerTab] = useState<"Overview" | "Workouts" | "Exercises" | "Progress">("Overview");
  const [playerPage, setPlayerPage] = useState(0);
  const profile = buildWeightRoomPlayerProfile(data, player);
  const entries = data.workoutEntries.filter((entry) => entry.playerId === player.id);
  const playerPageSize = 6;
  const totalPlayerPages = Math.max(1, Math.ceil(players.length / playerPageSize));
  const safePlayerPage = Math.min(playerPage, totalPlayerPages - 1);
  const playerPageStart = safePlayerPage * playerPageSize;
  const visiblePlayers = players.slice(playerPageStart, playerPageStart + playerPageSize);

  return (
    <section className="weight-room-player-layout">
      <aside className="panel weight-room-player-list">
        <div className="panel-heading tight">
          <div>
            <span>Athletes</span>
            <h2>{players.length} players</h2>
          </div>
        </div>
        <div className="weight-room-player-list__scroll">
          {visiblePlayers.map((item) => (
            <button key={item.id} type="button" className={item.id === player.id ? "active" : ""} onClick={() => onPlayer(item.id)}>
              <PlayerAvatar player={item} size="sm" compact />
              <span><strong>{item.name}</strong><small>#{item.jerseyNumber} - {item.primaryPosition}</small></span>
            </button>
          ))}
        </div>
        <div className="weight-room-player-list__pager">
          <button type="button" disabled={safePlayerPage === 0} onClick={() => setPlayerPage((current) => Math.max(0, current - 1))} aria-label="Previous athletes">
            <ChevronLeft size={15} aria-hidden="true" />
          </button>
          <span>{players.length ? `${playerPageStart + 1}-${Math.min(playerPageStart + playerPageSize, players.length)} of ${players.length}` : "0 players"}</span>
          <button type="button" disabled={safePlayerPage >= totalPlayerPages - 1} onClick={() => setPlayerPage((current) => Math.min(totalPlayerPages - 1, current + 1))} aria-label="Next athletes">
            <ChevronRight size={15} aria-hidden="true" />
          </button>
        </div>
      </aside>
      <article className="panel weight-room-player-profile">
        <div className="profile-header weight-room-profile-header">
          <PlayerAvatar player={player} size="xl" />
          <div>
            <span>Athlete Profile</span>
            <h2>{player.name}</h2>
            <small>#{player.jerseyNumber} - {player.primaryPosition} - Class of {player.graduationYear}</small>
          </div>
          <button className="secondary-button" type="button" onClick={() => onOpenPlayer(player.id)}>Open Full Profile</button>
        </div>
        <SegmentedControl values={["Overview", "Workouts", "Exercises", "Progress"]} active={playerTab} onChange={setPlayerTab} />
        {playerTab === "Overview" && (
          <div className="weight-room-player-overview">
            <StatTile label="Workouts This Week" value={profile.workoutsThisWeek} />
            <StatTile label="Total Volume" value={formatWorkoutVolume(profile.volume)} />
            <StatTile label="Sets" value={profile.sets} />
            <StatTile label="Current Weight" value={profile.currentWeight ? `${formatNumber(profile.currentWeight, 1)} lb` : "--"} />
            <StatTile label="Development Score" value={profile.score?.score ?? "--"} accent />
            <div className="panel weight-room-insight-card">
              <span>What to work on</span>
              <p>{profile.summary}</p>
            </div>
            {profile.weightTrend.length > 1 && <MiniLineChart values={profile.weightTrend} labels={["Start", "Now"]} />}
          </div>
        )}
        {playerTab === "Workouts" && (
          <div className="weight-room-workout-list">
            {data.workoutSessions.filter((session) => session.playerId === player.id).slice(0, 10).map((session) => (
              <div key={session.id} className="weight-room-read-row">
                <strong>{shortDate(session.date)}</strong>
                <span>{session.completed ? "Completed" : "Open"}</span>
                <small>{data.workoutEntries.filter((entry) => entry.sessionId === session.id).length} sets</small>
              </div>
            ))}
          </div>
        )}
        {playerTab === "Exercises" && (
          <div className="weight-room-exercise-history">
            {uniqueStrings(entries.map((entry) => entry.exercise)).map((exercise) => {
              const exerciseEntries = entries.filter((entry) => entry.exercise === exercise);
              const latest = exerciseEntries[0];
              const best = bestWorkoutEntry(exerciseEntries);
              return (
                <div key={exercise} className="weight-room-read-row">
                  <strong>{exercise}</strong>
                  <span>Latest {latest ? formatWorkoutEntryValue(latest) : "--"}</span>
                  <small>Best {best ? formatWorkoutEntryValue(best) : "--"}</small>
                </div>
              );
            })}
          </div>
        )}
        {playerTab === "Progress" && (
          <div className="weight-room-player-overview">
            <WeightScoreBreakdown score={profile.score} />
            {profile.exerciseTrends.map((trend) => (
              <MetricBar key={trend.exercise} label={trend.exercise} value={Math.max(0, Math.min(100, 50 + trend.changePct))} helper={`${trend.changePct > 0 ? "+" : ""}${formatNumber(trend.changePct, 1)}%`} />
            ))}
          </div>
        )}
      </article>
    </section>
  );
}

function WeightRoomExerciseLibraryCard({
  exercises,
  activeExercise,
  customExercise,
  onCustomExercise,
  onExercise,
}: {
  exercises: WeightRoomExercise[];
  activeExercise: string;
  customExercise: string;
  onCustomExercise: (value: string) => void;
  onExercise: (exercise: string) => void;
}) {
  const [category, setCategory] = useState<WeightRoomExerciseCategory | "All">("All");
  const [query, setQuery] = useState("");
  const [confirmingExercise, setConfirmingExercise] = useState<string | undefined>();
  const [hiddenExercises, setHiddenExercises] = useState<Set<string>>(() => new Set());
  const filtered = exercises.filter((exercise) =>
    !hiddenExercises.has(exercise.name.toLowerCase())
    && (category === "All" || exercise.category === category)
    && `${exercise.name} ${exercise.category} ${exercise.equipment ?? ""}`.toLowerCase().includes(query.toLowerCase()),
  );
  const categories: Array<WeightRoomExerciseCategory | "All"> = ["All", "Lower Body", "Upper Body", "Power", "Core", "Speed", "Conditioning", "Mobility", "Other"];

  return (
    <article className="panel weight-room-library-card">
      <div className="panel-heading tight">
        <div>
          <span>Exercise Library</span>
          <h2>Team exercises</h2>
        </div>
      </div>
      <div className="weight-room-library-toolbar">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search exercises..." />
        <ChoiceSelect
          value={category}
          className="form-choice"
          options={categories.map((item) => ({ value: item, label: item }))}
          onChange={(value) => setCategory(value as WeightRoomExerciseCategory | "All")}
          aria-label="Exercise category"
        />
      </div>
      <div className="weight-room-custom-exercise">
        <input aria-label="Exercise name" value={customExercise} onChange={(event) => onCustomExercise(event.target.value)} placeholder="Exercise name" />
        <button className="secondary-button" type="button" onClick={() => customExercise.trim() && onExercise(customExercise.trim())}>Add Exercise</button>
      </div>
      <div className="weight-room-library-list">
        {filtered.map((exercise) => {
          const confirming = confirmingExercise === exercise.name;
          return (
            <div key={exercise.name} className={`weight-room-library-row ${exercise.name === activeExercise ? "active" : ""} ${confirming ? "confirming" : ""}`}>
              <button type="button" className="weight-room-library-select" onClick={() => onExercise(exercise.name)}>
                <span>
                  <strong>{exercise.name}</strong>
                </span>
              </button>
              {confirming ? (
                <span className="weight-room-inline-confirm">
                  <small>Remove?</small>
                  <button type="button" onClick={() => setHiddenExercises((current) => new Set([...current, exercise.name.toLowerCase()]))}>Yes</button>
                  <button type="button" onClick={() => setConfirmingExercise(undefined)}>No</button>
                </span>
              ) : (
                <button
                  type="button"
                  className="weight-room-remove-exercise"
                  onClick={() => setConfirmingExercise(exercise.name)}
                  aria-label={`Remove ${exercise.name} from team exercises`}
                >
                  -
                </button>
              )}
            </div>
          );
        })}
      </div>
    </article>
  );
}

function WeightRoomExerciseResults({ data, players, exercise, onPlayer }: { data: AppData; players: Player[]; exercise: string; onPlayer: (playerId: ID) => void }) {
  const rows = players.map((player) => {
    const entries = data.workoutEntries.filter((entry) => entry.playerId === player.id && entry.exercise === exercise);
    const latest = entries[0];
    const previous = entries[1];
    const best = bestWorkoutEntry(entries);
    const latestValue = latest ? workoutEntryComparableForDisplay(latest) : undefined;
    const previousValue = previous ? workoutEntryComparableForDisplay(previous) : undefined;
    const change = latestValue !== undefined && previousValue ? ((latestValue - previousValue) / Math.max(1, previousValue)) * 100 : undefined;
    return { player, latest, previous, best, change };
  }).filter((row) => row.latest || row.best);

  return (
    <article className="panel weight-room-exercise-results">
      <div className="panel-heading tight">
        <div>
          <span>Exercise View</span>
          <h2>{exercise}</h2>
        </div>
      </div>
      <div className="weight-room-result-table">
        <div>
          <span>Player</span>
          <span>Latest</span>
          <span>Previous</span>
          <span>Change</span>
          <span>Best</span>
        </div>
        {rows.map((row) => (
          <button key={row.player.id} type="button" onClick={() => onPlayer(row.player.id)}>
            <strong>{row.player.name}</strong>
            <span>{row.latest ? formatWorkoutEntryValue(row.latest) : "--"}</span>
            <span>{row.previous ? formatWorkoutEntryValue(row.previous) : "--"}</span>
            <em className={row.change && row.change > 0 ? "positive" : row.change && row.change < 0 ? "negative" : ""}>{typeof row.change === "number" ? `${row.change > 0 ? "+" : ""}${formatNumber(row.change, 1)}%` : "--"}</em>
            <span>{row.best ? formatWorkoutEntryValue(row.best) : "--"}</span>
          </button>
        ))}
        {!rows.length && <CompactEmpty title="No results for this exercise yet." />}
      </div>
    </article>
  );
}

function WeightRoomLeaderboardPanel({
  players,
  sessions,
  entries,
  onOpenPlayer,
}: {
  players: Player[];
  sessions: WorkoutSession[];
  entries: WorkoutEntry[];
  onOpenPlayer: (playerId: ID) => void;
}) {
  const [window, setWindow] = useState<WeightRoomWindow>("This Week");
  const rows = buildScoredWeightRoomLeaderboard(players, sessions, entries, window);
  const selected = rows[0];

  return (
    <section className="weight-room-leaderboard-layout">
      <article className="panel weight-room-leaderboard-card">
        <div className="panel-heading tight">
          <div>
            <span>Weight Room Leaderboard</span>
            <h2>Development score, not raw volume</h2>
          </div>
          <SegmentedControl values={[...WEIGHT_ROOM_LEADER_WINDOWS] as WeightRoomWindow[]} active={window} onChange={setWindow} />
        </div>
        <div className="weight-room-leaderboard-table">
          <div>
            <span>Rank</span>
            <span>Athlete</span>
            <span>Score</span>
            <span>Workouts</span>
            <span>Progress</span>
            <span>Volume</span>
          </div>
          {rows.map((row, index) => (
            <button key={row.player.id} type="button" onClick={() => onOpenPlayer(row.player.id)}>
              <strong>{index + 1}</strong>
              <span><PlayerAvatar player={row.player} size="sm" compact />{row.player.name}</span>
              <em>{row.score}</em>
              <span>{row.completedSessions}</span>
              <span>{row.progressPct > 0 ? `+${formatNumber(row.progressPct, 1)}%` : "Baseline"}</span>
              <span>{formatWorkoutVolume(row.volume)}</span>
            </button>
          ))}
          {!rows.length && <CompactEmpty title="Not enough workout samples yet." />}
        </div>
        <small className="weight-room-algorithm-note">Formula: improvement 35%, consistency 25%, relative performance 20%, effort 10%, attendance 10%. Missing RPE/bodyweight groups are reweighted.</small>
      </article>
      <WeightScoreBreakdown score={selected} />
    </section>
  );
}

function WeightScoreBreakdown({ score }: { score?: WeightLeaderResult }) {
  return (
    <article className="panel weight-score-breakdown">
      <div className="panel-heading tight">
        <div>
          <span>Score Breakdown</span>
          <h2>{score ? `${score.score}/100` : "No qualifier"}</h2>
        </div>
      </div>
      {score ? (
        <div className="metric-list">
          {score.breakdown?.map((part) => (
            <MetricBar key={part.label} label={part.label} value={part.value} max={part.max} helper={`${part.value}/${part.max}`} />
          ))}
          <div className="reason-list">{score.reasons.map((reason) => <span key={reason}>{reason}</span>)}</div>
        </div>
      ) : (
        <CompactEmpty title="Two workouts or four tracked sets are required to qualify." />
      )}
    </article>
  );
}

function WeightRoomWeighInModal({
  data,
  players,
  date,
  onClose,
  onSave,
}: {
  data: AppData;
  players: Player[];
  date: string;
  onClose: () => void;
  onSave: (rows: Array<{ playerId: ID; weight?: number }>, date: string) => void;
}) {
  const [draftDate, setDraftDate] = useState(date);
  const [rows, setRows] = useState(() =>
    players.map((player) => ({
      playerId: player.id,
      value: latestBodyWeight(data, player.id, date, true)?.toString() ?? "",
    })),
  );

  function update(playerId: ID, value: string) {
    setRows((current) => current.map((row) => (row.playerId === playerId ? { ...row, value: value.replace(/[^0-9.]/g, "") } : row)));
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-panel weight-room-weigh-modal" role="dialog" aria-modal="true" aria-labelledby="weigh-in-title">
        <div className="modal-title">
          <div>
            <span>Weight Room</span>
            <h2 id="weigh-in-title">Bulk Weigh-In</h2>
          </div>
          <button className="icon-button modal-close-button" type="button" onClick={onClose} aria-label="Close weigh-ins"><X size={18} aria-hidden="true" /></button>
        </div>
        <div className="weight-room-weigh-modal__date">
          <DatePickerField label="Weigh-in date" value={draftDate} onChange={setDraftDate} />
          <small>Blank rows are ignored. No zero weights are stored.</small>
        </div>
        <div className="weight-room-weigh-table">
          <div>
            <span>Player</span>
            <span>Last</span>
            <span>Today</span>
            <span>Change</span>
          </div>
          {players.map((player) => {
            const row = rows.find((item) => item.playerId === player.id);
            const last = previousBodyWeight(data, player.id, draftDate);
            const today = optionalNumber(row?.value ?? "");
            const change = typeof today === "number" && typeof last === "number" ? today - last : undefined;
            return (
              <label key={player.id}>
                <strong>{player.name}</strong>
                <span>{last ? `${formatNumber(last, 1)} lb` : "-"}</span>
                <input inputMode="decimal" value={row?.value ?? ""} onChange={(event) => update(player.id, event.target.value)} />
                <em className={change && change > 0 ? "positive" : change && change < 0 ? "negative" : ""}>
                  {typeof change === "number" ? `${change > 0 ? "+" : ""}${formatNumber(change, 1)}` : "-"}
                </em>
              </label>
            );
          })}
        </div>
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
          <button
            className="primary-button"
            type="button"
            onClick={() => onSave(rows.map((row) => ({ playerId: row.playerId, weight: optionalNumber(row.value) })), draftDate)}
          >
            <Save size={16} aria-hidden="true" />
            Save Weigh-Ins
          </button>
        </div>
      </div>
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
              <strong>{matchupPrefix(item.homeAway).replace(".", "")} {item.opponent}</strong>
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

function StartPracticeModal({ data, onClose, onCreate }: { data: AppData; onClose: () => void; onCreate: (practice: Practice, attendance: PracticeAttendance[]) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const availablePlayers = data.players.filter((player) => !player.archived);
  const currentTeam = data.teamContext?.currentTeam;
  const defaultPracticeName = `${shortDate(today)} ${currentTeam?.teamLevel === "JV" ? "JV" : currentTeam?.teamLevel === "Varsity" ? "Varsity" : "Team"} Practice`;
  const [form, setForm] = useState({
    date: today,
    time: "18:00",
    name: defaultPracticeName,
    type: "Team Practice" as PracticeType,
    location: data.teamContext?.currentTeam?.city && data.teamContext?.currentTeam?.state ? `${data.teamContext.currentTeam.city}, ${data.teamContext.currentTeam.state}` : "",
    notes: "",
  });
  const [preset, setPreset] = useState<PracticeRosterPreset>("All");
  const [attendanceStatuses, setAttendanceStatuses] = useState<Record<ID, PracticeAttendanceStatus>>(
    Object.fromEntries(availablePlayers.map((player) => [player.id, "Present" as PracticeAttendanceStatus])),
  );
  const attending = availablePlayers.filter((player) => ["Present", "Late"].includes(attendanceStatuses[player.id] ?? "Present")).map((player) => player.id);
  const presentCount = availablePlayers.filter((player) => attendanceStatuses[player.id] === "Present").length;
  const lateCount = availablePlayers.filter((player) => attendanceStatuses[player.id] === "Late").length;
  const excusedCount = availablePlayers.filter((player) => attendanceStatuses[player.id] === "Excused").length;
  const absentCount = availablePlayers.filter((player) => attendanceStatuses[player.id] === "Absent").length;

  function applyPreset(nextPreset: PracticeRosterPreset) {
    setPreset(nextPreset);
    if (nextPreset === "Custom") return;
    setAttendanceStatuses(Object.fromEntries(availablePlayers.map((player) => [
      player.id,
      nextPreset === "All" || player.rosterStatus === nextPreset ? "Present" : "Absent",
    ])));
  }

  function setPlayerAttendance(id: ID, status: PracticeAttendanceStatus) {
    setPreset("Custom");
    setAttendanceStatuses((current) => ({ ...current, [id]: status }));
  }

  function bulkAttendance(status: PracticeAttendanceStatus) {
    setPreset("Custom");
    setAttendanceStatuses(Object.fromEntries(availablePlayers.map((player) => [player.id, status])));
  }

  function createPractice() {
    const selectedPlayers = availablePlayers.filter((player) => attending.includes(player.id));
    const pitchers = selectedPlayers.filter((player) => player.isPitcher).map((player) => player.id);
    const hitters = selectedPlayers.filter((player) => player.isHitter).map((player) => player.id);
    const startedAt = new Date(`${form.date}T${form.time || "18:00"}:00`).toISOString();
    const practice: Practice = {
      id: createId("practice"),
      date: form.date,
      name: form.name,
      type: form.type,
      location: form.location,
      notes: form.notes,
      playerIds: attending,
      pitcherIds: pitchers,
      hitterIds: hitters,
      startedAt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const attendance: PracticeAttendance[] = availablePlayers.map((player) => ({
      id: createId("att"),
      practiceId: practice.id,
      playerId: player.id,
      role: player.isPitcher && player.isHitter ? "Two-way" : player.isPitcher ? "Pitcher" : player.isHitter ? "Hitter" : "Observer",
      status: attendanceStatuses[player.id] ?? "Present",
      checkedInAt: startedAt,
    }));
    onCreate(practice, attendance);
  }

  return (
    <ModalFrame title="Start Practice" onClose={onClose}>
      <div className="practice-start-grid">
        <label className="wide"><span>Practice Name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label><span>Date</span><input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
        <label><span>Time</span><input type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} /></label>
        <div className="form-field"><span>Type</span><ChoiceSelect value={form.type} className="form-choice" options={PRACTICE_TYPES.map((type) => ({ value: type, label: type }))} onChange={(value) => setForm({ ...form, type: value as PracticeType })} aria-label="Practice type" /></div>
        <label><span>Location</span><input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label>
        {currentTeam && (
          <section className="practice-team-context wide" aria-label="Practice team">
            <span>Team</span>
            <strong>{currentTeam.teamName}</strong>
            <small>{currentTeam.seasonName ?? data.settings.rosterSeason}</small>
          </section>
        )}
      </div>
      <section className="practice-preset-panel">
        <div>
          <span>Attendance</span>
          <strong>{attending.length}/{availablePlayers.length} active</strong>
          <small>{presentCount} present - {lateCount} late - {excusedCount} excused - {absentCount} absent</small>
        </div>
        <SegmentedControl values={["All", "Varsity", "JV", "Custom"] as PracticeRosterPreset[]} active={preset} onChange={applyPreset} />
      </section>
      <section className="attendance-bulk-row" aria-label="Bulk attendance actions">
        <button type="button" onClick={() => bulkAttendance("Present")}>Mark All Present</button>
        <button type="button" onClick={() => bulkAttendance("Absent")}>Mark All Absent</button>
      </section>
      <AttendanceRoster players={availablePlayers} statuses={attendanceStatuses} onStatus={setPlayerAttendance} />
      <button className="primary-button stretch-button" type="button" onClick={createPractice} disabled={attending.length === 0}>
        Enter Active Practice
      </button>
    </ModalFrame>
  );
}

function StartGameModal({ data, onClose, onCreate }: { data: AppData; onClose: () => void; onCreate: (game: Game) => void }) {
  const starters = data.players.filter((player) => !player.archived && player.rosterStatus !== "Cut").slice(0, 9).map((player) => player.id);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    opponent: "Charlotte Latin",
    homeAway: "Home" as Game["homeAway"],
    date: today,
    time: "18:00",
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
        <label><span>Time</span><input type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} /></label>
        <label><span>Location</span><input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label>
        <div className="form-field"><span>Game type</span><ChoiceSelect value={form.type} className="form-choice" options={GAME_TYPES.map((type) => ({ value: type, label: type }))} onChange={(value) => setForm({ ...form, type: value as GameType })} aria-label="Game type" /></div>
        <div className="form-field"><span>Starting pitcher</span><ChoiceSelect value={form.startingPitcherId ?? ""} className="form-choice" options={data.players.filter((player) => player.isPitcher).map((player) => ({ value: player.id, label: player.name }))} onChange={(value) => setForm({ ...form, startingPitcherId: value })} aria-label="Starting pitcher" /></div>
      </div>
      <RosterPicker title="Lineup" players={data.players.filter((player) => player.rosterStatus !== "Cut")} selected={lineup} onToggle={(id) => setLineup(lineup.includes(id) ? lineup.filter((item) => item !== id) : [...lineup, id])} />
      <button className="primary-button stretch-button" type="button" onClick={() => onCreate({
        id: createId("game"),
        date: form.date,
        startsAt: toLocalIso(form.date, form.time || "18:00"),
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

function ScheduleEventModal({
  data,
  initialDate,
  onClose,
  onCreatePractice,
  onCreateGame,
  onCreateEvent,
}: {
  data: AppData;
  initialDate?: string;
  onClose: () => void;
  onCreatePractice: (practice: Practice, attendance: PracticeAttendance[]) => void;
  onCreateGame: (game: Game) => void;
  onCreateEvent: (event: ScheduleEvent) => void;
}) {
  const today = initialDate ?? new Date().toISOString().slice(0, 10);
  const currentTeam = data.teamContext?.currentTeam;
  const availablePlayers = data.players.filter((player) => !player.archived && player.rosterStatus !== "Cut");
  const starters = availablePlayers.slice(0, 9).map((player) => player.id);
  const [eventType, setEventType] = useState<ScheduleEventType>("Game");
  const [selectedOpponentTeamId, setSelectedOpponentTeamId] = useState<ID | undefined>();
  const [opponentResultsOpen, setOpponentResultsOpen] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [form, setForm] = useState({
    title: "",
    date: today,
    endDate: today,
    startTime: "18:00",
    endTime: "",
    location: "",
    notes: "",
    opponent: "",
    homeAway: "Home" as Game["homeAway"],
    intersquad: false,
    visibility: defaultScheduleVisibility("Game", currentTeam),
  });
  const eventTypeOptions: ChoiceOption[] = SCHEDULE_EVENT_TYPES.map((type) => ({
    value: type,
    label: type,
    description:
      type === "Game" ? "Opponent matchup" :
      type === "Practice" ? "Team work" :
      type === "Lift" ? "Weight room" :
      type === "Scrimmage" ? "Controlled matchup" :
      type === "Tournament" ? "Multi-game event" :
      type === "Other" ? "Meeting / Team Event / Etc." :
      undefined,
    icon: <ScheduleTypeIcon type={type} />,
  }));
  const isGenericTitleType = eventType === "Other";
  const opponentTeams = useMemo(() => {
    const seen = new Set<ID>();
    const teams: Array<{
      id: ID;
      name: string;
      organizationName?: string;
      seasonName?: string;
      city?: string;
      state?: string;
      logoUrl?: string;
    }> = [];
    function addTeam(team: {
      id: ID;
      name: string;
      organizationName?: string;
      seasonName?: string;
      city?: string;
      state?: string;
      logoUrl?: string;
    }) {
      if (!team.id || seen.has(team.id) || team.id === currentTeam?.teamId) return;
      seen.add(team.id);
      teams.push(team);
    }
    data.publicTeams?.forEach((team) => addTeam(team));
    data.teamContext?.availableTeams.forEach((team) => addTeam({
      id: team.teamId,
      name: team.teamName,
      organizationName: team.organizationName,
      seasonName: team.seasonName,
      city: team.city,
      state: team.state,
      logoUrl: team.logoUrl,
    }));
    return teams.sort((left, right) => left.name.localeCompare(right.name));
  }, [currentTeam?.teamId, data.publicTeams, data.teamContext?.availableTeams]);
  const opponentQuery = form.opponent.trim().toLowerCase();
  const opponentSuggestions = useMemo(() => {
    if (!opponentQuery) return [];
    return opponentTeams
      .filter((team) => [team.name, team.organizationName, team.seasonName, team.city, team.state].filter(Boolean).join(" ").toLowerCase().includes(opponentQuery))
      .slice(0, 5);
  }, [opponentQuery, opponentTeams]);
  const hasExactOpponentMatch = opponentTeams.some((team) => team.name.toLowerCase() === opponentQuery);
  const mapsQuery = form.location.trim();
  const mapsUrl = mapsQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}` : "";

  function chooseType(type: ScheduleEventType) {
    setErrors([]);
    setEventType(type);
    setOpponentResultsOpen(false);
    setSelectedOpponentTeamId(undefined);
    setForm((current) => ({
      ...current,
      intersquad: type === "Scrimmage" ? current.intersquad : false,
      title: type === "Tournament" && shouldResetScheduleTitle(type, current.title)
        ? ""
        : shouldResetScheduleTitle(type, current.title)
        ? defaultScheduleTitle(type, type === "Scrimmage" && current.intersquad ? "Intersquad" : current.opponent, current.homeAway)
        : current.title,
      visibility: defaultScheduleVisibility(type, currentTeam),
    }));
  }

  function updateOpponent(value: string) {
    setSelectedOpponentTeamId(undefined);
    setOpponentResultsOpen(Boolean(value.trim()));
    setForm((current) => ({ ...current, opponent: value, intersquad: false, title: defaultScheduleTitle(eventType, value, current.homeAway) }));
  }

  function updateHomeAway(value: Game["homeAway"]) {
    setForm((current) => ({
      ...current,
      homeAway: value,
      title: defaultScheduleTitle(eventType, current.intersquad ? "Intersquad" : current.opponent, value),
    }));
  }

  function chooseOpponent(team: (typeof opponentTeams)[number]) {
    setSelectedOpponentTeamId(team.id);
    setOpponentResultsOpen(false);
    setForm((current) => ({ ...current, opponent: team.name, intersquad: false, title: defaultScheduleTitle(eventType, team.name, current.homeAway) }));
  }

  function chooseTypedOpponent() {
    const opponent = form.opponent.trim();
    setSelectedOpponentTeamId(undefined);
    setOpponentResultsOpen(false);
    setForm((current) => ({ ...current, opponent, intersquad: false, title: defaultScheduleTitle(eventType, opponent, current.homeAway) }));
  }

  function toggleIntersquad(checked: boolean) {
    setSelectedOpponentTeamId(undefined);
    setOpponentResultsOpen(false);
    setForm((current) => ({
      ...current,
      intersquad: checked,
      opponent: checked ? "" : current.opponent,
      title: checked ? "Intersquad Scrimmage" : defaultScheduleTitle(eventType, current.opponent, current.homeAway),
    }));
  }

  function updateDate(value: string) {
    setForm((current) => ({
      ...current,
      date: value,
      endDate: current.endDate && current.endDate >= value ? current.endDate : value,
    }));
  }

  function renderOpponentLookup(optional = false) {
    const typedOpponent = form.opponent.trim();
    const isScrimmage = eventType === "Scrimmage";
    return (
      <div className="form-field schedule-opponent-field">
        <span className={isScrimmage ? "schedule-opponent-label-row" : ""}>
          <span>Opponent {optional && <small>optional</small>}</span>
          {isScrimmage && (
            <label className="schedule-intersquad-toggle">
              <input
                type="checkbox"
                checked={form.intersquad}
                onChange={(event) => toggleIntersquad(event.target.checked)}
              />
              Intersquad
            </label>
          )}
        </span>
        <span className="schedule-input-shell">
          <Search size={15} aria-hidden="true" />
          <input
            value={form.intersquad ? "Intersquad Scrimmage" : form.opponent}
            placeholder="Search teams or enter opponent"
            disabled={form.intersquad}
            onChange={(event) => updateOpponent(event.target.value)}
            onFocus={() => setOpponentResultsOpen(Boolean(typedOpponent) && !form.intersquad)}
          />
        </span>
        {typedOpponent && opponentResultsOpen && !form.intersquad && (
          <div className="schedule-opponent-results">
            {opponentSuggestions.map((team) => (
              <button
                key={team.id}
                type="button"
                className={`schedule-opponent-option ${selectedOpponentTeamId === team.id ? "is-selected" : ""}`}
                onClick={() => chooseOpponent(team)}
              >
                <OrganizationLogo name={team.name} logoUrl={team.logoUrl} />
                <span>
                  <strong>{team.name}</strong>
                  <small>{[team.organizationName, team.seasonName].filter(Boolean).join(" - ") || [team.city, team.state].filter(Boolean).join(", ")}</small>
                </span>
                {selectedOpponentTeamId === team.id && <Check size={14} aria-hidden="true" />}
              </button>
            ))}
            {!hasExactOpponentMatch && (
              <button type="button" className="schedule-opponent-option schedule-opponent-option--create" onClick={chooseTypedOpponent}>
                <span className="schedule-result-mark"><Plus size={14} aria-hidden="true" /></span>
                <span>
                  <strong>Create New: {typedOpponent}</strong>
                  <small>Use this opponent name</small>
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  function submit() {
    const validationErrors: string[] = [];
    if (!form.date) validationErrors.push("Date is required.");
    if (!form.startTime) validationErrors.push("Start time is required.");
    if (eventType === "Tournament" && !form.title.trim()) validationErrors.push("Tournament name is required.");
    if (eventType === "Tournament" && !form.endDate) validationErrors.push("End date is required for Tournament.");
    if (eventType === "Tournament" && form.endDate && form.date && form.endDate < form.date) validationErrors.push("End date cannot be before start date.");
    if (isGenericTitleType && !form.title.trim()) validationErrors.push("Title is required for this event type.");
    if (validationErrors.length) {
      setErrors(validationErrors);
      return;
    }
    const now = new Date().toISOString();
    const startAt = toLocalIso(form.date, form.startTime || "18:00");
    const endAt = eventType === "Tournament"
      ? toLocalIso(form.endDate || form.date, form.endTime || "23:59")
      : form.endTime ? toLocalIso(form.date, form.endTime) : undefined;
    if (eventType === "Practice") {
      const selectedPlayers = availablePlayers;
      const practice: Practice = {
        id: createId("practice"),
        date: form.date,
        name: "Practice",
        type: "Team Practice",
        location: form.location,
        notes: form.notes,
        playerIds: selectedPlayers.map((player) => player.id),
        pitcherIds: selectedPlayers.filter((player) => player.isPitcher).map((player) => player.id),
        hitterIds: selectedPlayers.filter((player) => player.isHitter).map((player) => player.id),
        startedAt: startAt,
        endedAt: undefined,
        createdAt: now,
        updatedAt: now,
      };
      const attendance = selectedPlayers.map((player) => ({
        id: createId("att"),
        practiceId: practice.id,
        playerId: player.id,
        role: (player.isPitcher && player.isHitter ? "Two-way" : player.isPitcher ? "Pitcher" : player.isHitter ? "Hitter" : "Observer") as PracticeAttendance["role"],
        status: "Present" as PracticeAttendanceStatus,
        checkedInAt: startAt,
      }));
      onCreatePractice(practice, attendance);
      return;
    }
    if (eventType === "Game") {
      const opponent = form.opponent.trim() || "TBD";
      onCreateGame({
        id: createId("game"),
        date: form.date,
        startsAt: startAt,
        opponent,
        homeAway: form.homeAway,
        location: form.location,
        type: "Fall Game",
        metrolinaScore: 0,
        opponentScore: 0,
        inning: 1,
        half: form.homeAway === "Home" ? "Top" : "Bottom",
        outs: 0,
        balls: 0,
        strikes: 0,
        runners: {},
        lineup: starters,
        positions: {},
        startingPitcherId: data.players.find((player) => player.isPitcher)?.id ?? starters[0],
        currentPitcherId: data.players.find((player) => player.isPitcher)?.id ?? starters[0],
        currentBatterId: starters[0],
        createdAt: now,
        updatedAt: now,
      });
      return;
    }
    const scheduleOpponent = form.intersquad ? "Intersquad" : form.opponent;
    const title = form.title.trim() || defaultScheduleTitle(eventType, scheduleOpponent, form.homeAway);
    onCreateEvent({
      id: createId("schedule"),
      organizationId: currentTeam?.organizationId,
      teamId: currentTeam?.teamId,
      seasonId: currentTeam?.seasonId,
      teamIds: currentTeam?.teamId ? [currentTeam.teamId] : [],
      eventType,
      title,
      startAt,
      endAt,
      location: form.location,
      notes: form.notes,
      visibility: form.visibility,
      status: "Scheduled",
      createdBy: data.teamContext?.profile?.id,
      createdAt: now,
      updatedAt: now,
    });
  }

  return (
    <ModalFrame title="Add Event" onClose={onClose} panelClassName={`schedule-event-modal schedule-event-modal--${SCHEDULE_EVENT_ACCENTS[eventType]}`}>
      <div className="schedule-event-form">
        <div className="form-field schedule-event-type-field wide">
          <span>Event Type</span>
          <ChoiceSelect value={eventType} className="form-choice schedule-event-type-select" options={eventTypeOptions} onChange={(value) => chooseType(value as ScheduleEventType)} aria-label="Event type" />
        </div>
        {eventType === "Game" && (
          <>
            {renderOpponentLookup(false)}
            <div className="form-field schedule-home-away-field"><span>Home/Away</span><ChoiceSelect value={form.homeAway} className="form-choice" options={SCHEDULE_HOME_AWAY_OPTIONS.map((value) => ({ value, label: value }))} onChange={(value) => updateHomeAway(value as Game["homeAway"])} aria-label="Home or away" /></div>
          </>
        )}
        {eventType === "Scrimmage" && (
          <>
            {renderOpponentLookup(true)}
            <div className="form-field schedule-home-away-field"><span>Home/Away</span><ChoiceSelect value={form.homeAway} className="form-choice" options={SCHEDULE_HOME_AWAY_OPTIONS.map((value) => ({ value, label: value }))} onChange={(value) => updateHomeAway(value as Game["homeAway"])} aria-label="Scrimmage home or away" /></div>
          </>
        )}
        {eventType === "Tournament" && (
          <label className="wide"><span>Tournament Name</span><input value={form.title} placeholder="Tournament name" onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
        )}
        {isGenericTitleType && (
          <label className="wide"><span>Title</span><input value={form.title} placeholder="Film Review" onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
        )}
        <DatePickerField label={eventType === "Tournament" ? "Start Date" : "Date"} value={form.date} onChange={updateDate} />
        {eventType === "Tournament" && (
          <DatePickerField label="End Date" value={form.endDate} onChange={(value) => setForm({ ...form, endDate: value })} />
        )}
        <TimePickerField label="Start" value={form.startTime} onChange={(value) => setForm({ ...form, startTime: value })} />
        <TimePickerField label="End" value={form.endTime} onChange={(value) => setForm({ ...form, endTime: value })} fallbackValue={defaultEndTime(form.startTime)} optional align="right" />
        <label className="wide schedule-control-field">
          <span>Location</span>
          <span className="schedule-input-shell schedule-input-shell--with-action">
            <MapPin size={15} aria-hidden="true" />
            <input value={form.location} placeholder="Varsity Field or address" onChange={(event) => setForm({ ...form, location: event.target.value })} />
            {mapsUrl && <a className="schedule-map-link" href={mapsUrl} target="_blank" rel="noreferrer">Search Maps</a>}
          </span>
        </label>
        <label className="wide"><span>Notes <small>optional</small></span><textarea value={form.notes} placeholder="Add notes..." onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
        {errors.length > 0 && (
          <div className="form-errors wide" role="alert">
            {errors.map((error) => <span key={error}>{error}</span>)}
          </div>
        )}
      </div>
      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
        <button type="button" className="primary-button" onClick={submit}>
          <CalendarPlus size={16} aria-hidden="true" />
          Save Event
        </button>
      </div>
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
            <input aria-label="Name" placeholder="Player name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <ManualNumberCell label="Number" placeholder="#" value={form.jerseyNumber ? String(form.jerseyNumber) : ""} min={0} max={99} onChange={(value) => setForm({ ...form, jerseyNumber: Number(value) || 0 })} />
            <ManualNumberCell label="Graduation" placeholder="Class" value={String(form.graduationYear || currentRosterYear())} min={2020} max={2045} onChange={(value) => setForm({ ...form, graduationYear: Number(value) || currentRosterYear() })} />
            <ChoiceSelect aria-label="Primary" value={form.primaryPosition} className="manual-choice-cell" options={POSITIONS.map((position) => ({ value: position, label: position }))} onChange={(value) => setForm({ ...form, primaryPosition: value as Position })} />
            <ChoiceSelect aria-label="Secondary" value={form.secondaryPosition ?? ""} className="manual-choice-cell" options={SECONDARY_POSITIONS.map((position) => ({ value: position, label: position || "None" }))} onChange={(value) => setForm({ ...form, secondaryPosition: value ? value as Position : undefined })} />
            <ChoiceSelect aria-label="Bats" value={form.bats} className="manual-choice-cell" options={["R", "L", "S"].map((value) => ({ value, label: value }))} onChange={(value) => setForm({ ...form, bats: value as Player["bats"] })} />
            <ChoiceSelect aria-label="Throws" value={form.throws} className="manual-choice-cell" options={["R", "L"].map((value) => ({ value, label: value }))} onChange={(value) => setForm({ ...form, throws: value as Player["throws"] })} />
            <ManualHeightCell value={String(heightToInches(form.height))} onChange={(heightInches) => setForm({ ...form, height: heightInches ? formatHeightFromInches(Number(heightInches)) : undefined })} />
            <ManualNumberCell label="Weight" placeholder="Wt" value={form.weight ? String(form.weight) : ""} min={80} max={320} onChange={(value) => setForm({ ...form, weight: Number(value) || undefined })} />
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

type StaffMemberUpdateInput = {
  staffMemberId: ID;
  memberships: Array<{
    teamId: ID;
    seasonId?: ID;
    baseballRole: StaffBaseballRole;
    accessRole: StaffAccessRole;
  }>;
};

function InviteStaffModal({
  teams,
  currentTeam,
  onClose,
  onInvite,
}: {
  teams: TeamOption[];
  currentTeam?: TeamOption;
  onClose: () => void;
  onInvite: (input: {
    email: string;
    firstName?: string;
    lastName?: string;
    staffRole: StaffBaseballRole;
    accessRole: StaffAccessRole;
    teams: Array<{ teamId: string; seasonId?: string }>;
  }) => Promise<{ invitation?: StaffInvitation; email?: { sent: boolean; message?: string; reason?: string } }>;
}) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [staffRole, setStaffRole] = useState<StaffBaseballRole>("Assistant Coach");
  const [accessRole, setAccessRole] = useState<StaffAccessRole>("COACH");
  const [selectedTeams, setSelectedTeams] = useState<string[]>(() => currentTeam ? [teamSelectionKey(currentTeam)] : []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const uniqueTeams = teams.filter((team, index, list) => list.findIndex((item) => teamSelectionKey(item) === teamSelectionKey(team)) === index);

  async function submitInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setInviteLink("");
    const assignedTeams = selectedTeams
      .map((key) => uniqueTeams.find((team) => teamSelectionKey(team) === key))
      .filter((team): team is TeamOption => Boolean(team));
    if (!email.trim() || assignedTeams.length === 0) {
      setMessage("Enter an email and choose at least one team.");
      return;
    }
    setBusy(true);
    try {
      const result = await onInvite({
        email: email.trim(),
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        staffRole,
        accessRole,
        teams: assignedTeams.map((team) => ({ teamId: team.teamId, seasonId: team.seasonId })),
      });
      const link = result.invitation?.inviteLink ?? "";
      setInviteLink(link);
      setMessage(result.email?.sent ? "Invite sent." : result.email?.message ?? "Invite created. Copy the link to send it manually.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to invite staff.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setMessage("Invite link copied.");
    } catch {
      setMessage(inviteLink);
    }
  }

  function toggleTeam(key: string) {
    setSelectedTeams((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  return (
    <ModalFrame title="Invite Staff" onClose={onClose} panelClassName="modal-panel--staff">
      <form className="staff-invite-form" onSubmit={(event) => void submitInvite(event)}>
        <div className="staff-invite-grid">
          <label className="form-field">
            <span>Email</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="coach@example.com" autoComplete="email" />
          </label>
          <label className="form-field">
            <span>First name</span>
            <input value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" />
          </label>
          <label className="form-field">
            <span>Last name</span>
            <input value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" />
          </label>
          <div className="form-field">
            <span>Staff role</span>
            <ChoiceSelect
              value={staffRole}
              className="form-choice"
              options={STAFF_BASEBALL_ROLES.map((role) => ({ value: role, label: role }))}
              onChange={(value) => setStaffRole(value as StaffBaseballRole)}
              aria-label="Staff role"
            />
          </div>
          <div className="form-field">
            <span>Application access</span>
            <ChoiceSelect
              value={accessRole}
              className="form-choice"
              options={STAFF_ACCESS_ROLES.map((role) => ({ value: role, label: role === "ADMIN" ? "Admin" : "Coach" }))}
              onChange={(value) => setAccessRole(value as StaffAccessRole)}
              aria-label="Application access"
            />
          </div>
        </div>

        <section className="staff-team-picker" aria-label="Staff teams">
          {uniqueTeams.map((team) => {
            const key = teamSelectionKey(team);
            return (
              <button
                key={key}
                type="button"
                className={selectedTeams.includes(key) ? "active" : ""}
                onClick={() => toggleTeam(key)}
              >
                <Check size={15} aria-hidden="true" />
                <span>
                  <strong>{team.teamLevel ?? team.teamName}</strong>
                  <small>{team.teamName} - {team.seasonName ?? "Current season"}</small>
                </span>
              </button>
            );
          })}
        </section>

        {message && <p className="staff-invite-message">{message}</p>}
        {inviteLink && (
          <div className="staff-invite-link">
            <span>{inviteLink}</span>
            <button className="secondary-button" type="button" onClick={() => void copyLink()}>
              <Copy size={15} aria-hidden="true" />
              Copy Link
            </button>
          </div>
        )}

        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>Close</button>
          <button className="primary-button" type="submit" disabled={busy || !email.trim() || selectedTeams.length === 0}>
            {busy ? "Creating..." : "Send Invite"}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}

function EditStaffModal({
  member,
  memberships,
  teams,
  onClose,
  onSave,
}: {
  member: StaffMember;
  memberships: StaffTeamMembership[];
  teams: TeamOption[];
  onClose: () => void;
  onSave: (input: StaffMemberUpdateInput) => Promise<void>;
}) {
  const primaryMembership = memberships[0];
  const [staffRole, setStaffRole] = useState<StaffBaseballRole>(primaryMembership?.baseballRole ?? "Assistant Coach");
  const [accessRole, setAccessRole] = useState<StaffAccessRole>(primaryMembership?.accessRole ?? "COACH");
  const [selectedTeams, setSelectedTeams] = useState<string[]>(() => memberships.map((membership) => `${membership.teamId}:${membership.seasonId ?? ""}`));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const uniqueTeams = teams.filter((team, index, list) => list.findIndex((item) => teamSelectionKey(item) === teamSelectionKey(team)) === index);

  function toggleTeam(key: string) {
    setSelectedTeams((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const membershipByKey = new Map(memberships.map((membership) => [`${membership.teamId}:${membership.seasonId ?? ""}`, membership]));
    const assignedTeams: Array<{ teamId: ID; seasonId?: ID }> = selectedTeams
      .flatMap((key) => {
        const team = uniqueTeams.find((item) => teamSelectionKey(item) === key);
        if (team) return [{ teamId: team.teamId, seasonId: team.seasonId }];
        const existing = membershipByKey.get(key);
        return existing ? [{ teamId: existing.teamId, seasonId: existing.seasonId }] : [];
      });
    if (assignedTeams.length === 0) {
      setMessage("Choose at least one team.");
      return;
    }
    setBusy(true);
    try {
      await onSave({
        staffMemberId: member.id,
        memberships: assignedTeams.map((team) => ({
          teamId: team.teamId,
          seasonId: team.seasonId,
          baseballRole: staffRole,
          accessRole,
        })),
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update staff.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalFrame title="Edit Staff" onClose={onClose} panelClassName="modal-panel--staff">
      <form className="staff-invite-form" onSubmit={(event) => void submit(event)}>
        <div className="staff-edit-summary">
          <StaffAvatar member={member} />
          <span>
            <strong>{member.displayName}</strong>
            <small>{member.email ?? "No account email"}</small>
          </span>
        </div>

        <div className="staff-invite-grid staff-edit-grid">
          <div className="form-field">
            <span>Staff role</span>
            <ChoiceSelect
              value={staffRole}
              className="form-choice"
              options={STAFF_BASEBALL_ROLES.map((role) => ({ value: role, label: role }))}
              onChange={(value) => setStaffRole(value as StaffBaseballRole)}
              aria-label="Staff role"
            />
          </div>
          <div className="form-field">
            <span>Application access</span>
            <ChoiceSelect
              value={accessRole}
              className="form-choice"
              options={STAFF_ACCESS_ROLES.map((role) => ({ value: role, label: role === "ADMIN" ? "Admin" : "Coach" }))}
              onChange={(value) => setAccessRole(value as StaffAccessRole)}
              aria-label="Application access"
            />
          </div>
        </div>

        <section className="staff-team-picker" aria-label="Staff teams">
          {uniqueTeams.map((team) => {
            const key = teamSelectionKey(team);
            return (
              <button
                key={key}
                type="button"
                className={selectedTeams.includes(key) ? "active" : ""}
                onClick={() => toggleTeam(key)}
              >
                <Check size={15} aria-hidden="true" />
                <span>
                  <strong>{team.teamLevel ?? team.teamName}</strong>
                  <small>{team.teamName} - {team.seasonName ?? "Current season"}</small>
                </span>
              </button>
            );
          })}
        </section>

        {message && <p className="staff-invite-message">{message}</p>}
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
          <button className="primary-button" type="submit" disabled={busy || selectedTeams.length === 0}>
            {busy ? "Saving..." : "Save Staff"}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}

function teamSelectionKey(team: TeamOption) {
  return `${team.teamId}:${team.seasonId ?? ""}`;
}

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
  const [staffSelections, setStaffSelections] = useState<Record<ID, boolean>>({});
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
          staff: staffSelections[file.sourceId] ? file.staff : [],
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
    anchor.download = `clubhouse9-roster-template-${slugifyFilePart(fallbackTeam?.seasonName ?? data.settings.rosterSeason)}.csv`;
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
      setStaffSelections((current) => {
        const next = { ...current };
        parsed.forEach((file) => {
          if (file.staff.length > 0 && next[file.id] === undefined) next[file.id] = true;
        });
        return next;
      });
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
        setStaffSelections((current) => ({ ...current, [sourceId]: parsed.staff.length > 0 }));
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
    setStaffSelections((current) => {
      const next = { ...current };
      delete next[sourceId];
      return next;
    });
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
                {((files.find((source) => source.id === file.sourceId)?.staff ?? file.staff).length > 0) && (
                  <div className="staff-detected staff-detected--selectable">
                    <input
                      type="checkbox"
                      aria-label={`Add detected staff from ${file.fileName} to team`}
                      checked={Boolean(staffSelections[file.sourceId])}
                      onChange={(event) => setStaffSelections((current) => ({ ...current, [file.sourceId]: event.target.checked }))}
                    />
                    <span>
                      <strong>Add detected staff to team</strong>
                      <em>{(files.find((source) => source.id === file.sourceId)?.staff ?? file.staff).map((staff) => `${staff.name} - ${staff.role}`).join("; ")}</em>
                    </span>
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
                <ManualNumberCell label="Jersey number" placeholder="#" value={row.jerseyNumber} min={0} max={99} onChange={(jerseyNumber) => onChangeRow(row.id, { jerseyNumber })} />
                <input
                  aria-label="First name"
                  placeholder="First"
                  value={row.firstName}
                  onChange={(event) => onChangeRow(row.id, { firstName: event.target.value })}
                />
                <input
                  aria-label="Last name"
                  placeholder="Last"
                  value={row.lastName}
                  onChange={(event) => onChangeRow(row.id, { lastName: event.target.value })}
                />
                <ManualNumberCell label="Graduation year" placeholder="Class" value={row.graduationYear} min={2020} max={2045} onChange={(graduationYear) => onChangeRow(row.id, { graduationYear })} />
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
                <ManualNumberCell label="Weight" placeholder="Wt" value={row.weight} min={80} max={320} onChange={(weight) => onChangeRow(row.id, { weight })} />
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
  placeholder = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min: number;
  max: number;
  step?: number;
  placeholder?: string;
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
    <div className="manual-number-cell" data-label={label}>
      <input
        aria-label={label}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder={placeholder}
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
    <div className="height-ft-in-cell" data-label="Height">
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

function SectionHeader({
  eyebrow,
  title,
  titleAdornment,
  body,
  context,
  action,
}: {
  eyebrow?: string;
  title: string;
  titleAdornment?: React.ReactNode;
  body?: string;
  context?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="section-header">
      <div>
        {eyebrow && <span>{eyebrow}</span>}
        <div className="section-header__title-row">
          <h2>{title}</h2>
          {titleAdornment}
        </div>
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
  icon: AppIcon;
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

function WeightLeaderCard({
  leader,
  leaders,
  onOpenPlayer,
}: {
  leader?: WeightLeaderResult;
  leaders?: WeightLeaderResult[];
  onOpenPlayer: (playerId: ID) => void;
}) {
  const rows = leaders?.length ? leaders.slice(0, 5) : leader ? [leader] : [];
  return (
    <article className="panel award-card weight-leader">
      <div className="award-card__top">
        <span>Weight Room Leaders</span>
        <Dumbbell size={18} aria-hidden="true" />
      </div>
      {rows.length ? (
        <div className="weight-leader-list">
          {rows.map((row, index) => (
            <button type="button" key={row.player.id} onClick={() => onOpenPlayer(row.player.id)}>
              <em>{index + 1}</em>
              <PlayerAvatar player={row.player} size="sm" compact />
              <span>
                <strong>{row.player.name}</strong>
                <small>{row.score} score{typeof row.volume === "number" ? ` - ${formatWorkoutVolume(row.volume)}` : ""}</small>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <CompactEmpty title="No workouts yet" />
      )}
    </article>
  );
}
function UpcomingScheduleCard({ items, onView }: { items: ScheduleItem[]; onView: (view: ViewKey) => void }) {
  return (
    <article className="panel upcoming-schedule-card">
      <div className="award-card__top">
        <span>Upcoming</span>
        <button type="button" className="text-button" onClick={() => onView("schedule")}>View Schedule</button>
      </div>
      {items.length ? (
        <div className="upcoming-schedule-list">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onView(item.source === "game" ? "games" : item.source === "practice" ? "practice" : item.source === "lift" ? "weights" : "schedule")}
            >
              <time>{item.date === todayKey() ? "Today" : shortDate(item.date)}</time>
              <ScheduleTypeIcon type={item.eventType} />
              <span>
                <strong>{item.title}</strong>
                <small>{formatTime(item.startAt)}{item.location ? ` - ${item.location}` : ""}</small>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <CompactEmpty title="No upcoming team events" />
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

function LiveMetrics({ items }: { items: Array<{ label: string; value: string | number; detail?: string }> }) {
  return (
    <div className="live-metrics">
      {items.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong>{item.detail && <small>{item.detail}</small>}</div>)}
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

function AttendanceRoster({
  players,
  statuses,
  onStatus,
}: {
  players: Player[];
  statuses: Record<ID, PracticeAttendanceStatus>;
  onStatus: (playerId: ID, status: PracticeAttendanceStatus) => void;
}) {
  return (
    <section className="attendance-roster" aria-label="Practice attendance">
      <div className="attendance-roster__head">
        <span>#</span>
        <span>Player</span>
        <span>Status</span>
      </div>
      <div className="attendance-roster__list">
        {players.filter((player) => !player.archived).map((player) => {
          const status = statuses[player.id] ?? "Present";
          return (
            <article key={player.id} className={`attendance-row attendance-row--${status.toLowerCase()}`}>
              <strong>{player.jerseyNumber}</strong>
              <span>
                <PlayerAvatar player={player} size="sm" compact />
                <span>
                  <b>{player.name}</b>
                  <small>{positionLine(player)} - {player.rosterStatus}</small>
                </span>
              </span>
              <div className="attendance-status-grid">
                {ATTENDANCE_STATUSES.map((value) => (
                  <button key={value} type="button" className={status === value ? "active" : ""} onClick={() => onStatus(player.id, value)}>
                    {value}
                  </button>
                ))}
              </div>
            </article>
          );
        })}
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
  breakdown?: Array<{ label: string; value: number; max: number }>;
  qualified?: boolean;
  sessions?: number;
  completedSessions?: number;
  sets?: number;
  volume?: number;
  progressPct?: number;
  completionPct?: number;
  attendancePct?: number;
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
  return buildScoredWeightRoomLeaderboard(
    data.players.filter((player) => !player.archived),
    data.workoutSessions,
    data.workoutEntries,
    "This Season",
  )[0];
}

function buildWeightMetrics(data: AppData, playerId: ID) {
  const player = data.players.find((item) => item.id === playerId);
  const entries = data.workoutEntries.filter((entry) => entry.playerId === playerId);
  const squat = latestExercise(entries, "Back Squat");
  const bench = latestExercise(entries, "Bench Press");
  const bodyWeight = latestBodyWeight(data, playerId) ?? player?.weight ?? 0;
  const previousWeight = previousBodyWeight(data, playerId, todayKey());
  const trend = entries.slice(0, 8).reverse().map((entry) => entry.weight ?? entry.value ?? 0).filter(Boolean);
  const score = buildWeightLeader({ ...data, players: player ? [player] : [] })?.score ?? 0;

  return {
    bodyWeight,
    bodyDelta: typeof previousWeight === "number" && bodyWeight ? `${bodyWeight - previousWeight > 0 ? "+" : ""}${formatNumber(bodyWeight - previousWeight, 1)} lb` : "baseline",
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

function workoutExerciseKind(exercise: string): ExerciseKind {
  const normalized = exercise.toLowerCase();
  if (/(sprint|dash|run|agility|shuttle)/.test(normalized)) return "Speed";
  if (/(jump|broad|vertical|hop)/.test(normalized)) return "Jump";
  if (/(plank|hold|mobility|test)/.test(normalized)) return "Test";
  if (/(squat|press|deadlift|clean|row|pull|curl|lunge|raise|bench|hinge|barbell|dumbbell|db)/.test(normalized)) return "Lift";
  return "Custom";
}

function buildWeightRoomExerciseLibrary(data: AppData): WeightRoomExercise[] {
  const byName = new Map<string, WeightRoomExercise>();
  for (const exercise of WEIGHT_ROOM_BASE_EXERCISES) {
    byName.set(exercise.name.toLowerCase(), exercise);
  }
  for (const entry of data.workoutEntries) {
    const key = entry.exercise.toLowerCase();
    if (!byName.has(key)) byName.set(key, makeWeightRoomExercise(entry.exercise));
  }
  for (const exerciseName of EXERCISES) {
    const key = exerciseName.toLowerCase();
    if (!byName.has(key)) byName.set(key, makeWeightRoomExercise(exerciseName));
  }
  return [...byName.values()].sort((left, right) => left.category.localeCompare(right.category) || left.name.localeCompare(right.name));
}

function makeWeightRoomExercise(name: string): WeightRoomExercise {
  const measurementType = weightRoomMeasurementType(name);
  const kind = workoutExerciseKind(name);
  return {
    name,
    category: weightRoomExerciseCategory(name, kind),
    measurementType,
    kind,
    unit: weightRoomUnitForType(measurementType),
    active: true,
    targetSets: measurementType === "RPE_ONLY" ? 1 : 3,
    targetReps: measurementType === "WEIGHT_REPS" || measurementType === "BODYWEIGHT_REPS" ? 8 : undefined,
  };
}

function weightRoomExerciseCategory(name: string, kind: ExerciseKind): WeightRoomExerciseCategory {
  const normalized = name.toLowerCase();
  if (kind === "Speed") return "Speed";
  if (kind === "Jump" || /(clean|power|jump)/.test(normalized)) return "Power";
  if (/(plank|core|rotation|mobility|stretch)/.test(normalized)) return "Core";
  if (/(sprint|conditioning|run|tempo)/.test(normalized)) return "Conditioning";
  if (/(bench|press|row|pull|curl|raise|shoulder|upper)/.test(normalized)) return "Upper Body";
  if (/(squat|deadlift|lunge|leg|hamstring|calf|lower)/.test(normalized)) return "Lower Body";
  return "Other";
}

function weightRoomMeasurementType(name: string): WorkoutMeasurementType {
  const normalized = name.toLowerCase();
  if (/(sprint|dash|plank|hold|timed)/.test(normalized)) return "TIME";
  if (/(jump|broad|vertical)/.test(normalized)) return "DISTANCE";
  if (/(pull up|push up|sit up|bodyweight)/.test(normalized)) return "BODYWEIGHT_REPS";
  if (/(rpe|mobility|stretch)/.test(normalized)) return "RPE_ONLY";
  return "WEIGHT_REPS";
}

function weightRoomUnitForType(type: WorkoutMeasurementType): WorkoutEntry["unit"] | undefined {
  if (type === "WEIGHT_REPS") return "lb";
  if (type === "BODYWEIGHT_REPS" || type === "COUNT") return "reps";
  if (type === "TIME") return "sec";
  if (type === "DISTANCE" || type === "HEIGHT") return "in";
  return undefined;
}

function weightRoomMeasurementLabel(exercise?: WeightRoomExercise) {
  if (!exercise) return "Value";
  if (exercise.measurementType === "TIME") return "Time";
  if (exercise.measurementType === "DISTANCE") return "Distance";
  if (exercise.measurementType === "HEIGHT") return "Height";
  if (exercise.measurementType === "BODYWEIGHT_REPS" || exercise.measurementType === "COUNT") return "Reps";
  return "Value";
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function optionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function entrySessionDate(data: AppData, entry: WorkoutEntry) {
  return data.workoutSessions.find((session) => session.id === entry.sessionId)?.date ?? entry.createdAt.slice(0, 10);
}

function formatWorkoutEntryValue(entry: WorkoutEntry) {
  if (typeof entry.weight === "number" && typeof entry.reps === "number") return `${formatNumber(entry.weight, 0)} lb x ${entry.reps}`;
  if (typeof entry.weight === "number") return `${formatNumber(entry.weight, 0)} lb`;
  if (typeof entry.value === "number") return `${formatNumber(entry.value, entry.unit === "sec" ? 2 : 1)}${entry.unit ? ` ${entry.unit}` : ""}`;
  if (typeof entry.reps === "number") return `${entry.reps} reps`;
  return "--";
}

function formatWorkoutVolume(value: number) {
  if (!value) return "--";
  if (value >= 1000) return `${formatCompactNumber(value)} lbs`;
  return `${formatNumber(value, 0)} lbs`;
}

function latestBodyWeight(data: AppData, playerId: ID, throughDate?: string, exactDateOnly = false) {
  const sessions = data.workoutSessions
    .filter((session) => session.playerId === playerId && typeof session.bodyWeight === "number")
    .filter((session) => exactDateOnly ? session.date === throughDate : !throughDate || session.date <= throughDate)
    .sort((left, right) => right.date.localeCompare(left.date) || right.updatedAt.localeCompare(left.updatedAt));
  return sessions[0]?.bodyWeight;
}

function previousBodyWeight(data: AppData, playerId: ID, beforeDate: string) {
  const sessions = data.workoutSessions
    .filter((session) => session.playerId === playerId && typeof session.bodyWeight === "number" && session.date < beforeDate)
    .sort((left, right) => right.date.localeCompare(left.date) || right.updatedAt.localeCompare(left.updatedAt));
  return sessions[0]?.bodyWeight;
}

function latestWeeklyBodyWeight(data: AppData, playerId: ID, weekOf: string, throughDate: string) {
  const sessions = data.workoutSessions
    .filter((session) => session.playerId === playerId && typeof session.bodyWeight === "number")
    .filter((session) => (session.weekOf || weekStart(session.date)) === weekOf && session.date <= throughDate)
    .sort((left, right) => right.date.localeCompare(left.date) || right.updatedAt.localeCompare(left.updatedAt));
  return sessions[0]?.bodyWeight;
}

function latestBodyWeightBeforeWeek(data: AppData, playerId: ID, weekOf: string) {
  const sessions = data.workoutSessions
    .filter((session) => session.playerId === playerId && typeof session.bodyWeight === "number")
    .filter((session) => (session.weekOf || weekStart(session.date)) < weekOf)
    .sort((left, right) => right.date.localeCompare(left.date) || right.updatedAt.localeCompare(left.updatedAt));
  return sessions[0]?.bodyWeight;
}

function startingBodyWeight(data: AppData, playerId: ID) {
  const sessions = data.workoutSessions
    .filter((session) => session.playerId === playerId && typeof session.bodyWeight === "number")
    .sort((left, right) => left.date.localeCompare(right.date) || left.createdAt.localeCompare(right.createdAt));
  return sessions[0]?.bodyWeight;
}

function teamLocation(team?: TeamOption) {
  return [team?.city, team?.state].filter(Boolean).join(", ");
}

function buildRecentWeightRoomWorkouts(data: AppData, players: Player[]): WeightRoomWorkoutSummary[] {
  const playerIds = new Set(players.map((player) => player.id));
  const byDate = new Map<string, WorkoutSession[]>();
  for (const session of data.workoutSessions.filter((item) => playerIds.has(item.playerId))) {
    const group = byDate.get(session.date) ?? [];
    group.push(session);
    byDate.set(session.date, group);
  }
  return [...byDate.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([date, sessions]) => {
      const sessionIds = new Set(sessions.map((session) => session.id));
      const entries = data.workoutEntries.filter((entry) => sessionIds.has(entry.sessionId));
      const liftEvent = (data.scheduleEvents ?? []).find((event) => event.eventType === "Lift" && dateKeyFromIso(event.startAt) === date);
      return {
        date,
        title: liftEvent?.title ?? "Team Lift",
        location: liftEvent?.location,
        startAt: liftEvent?.startAt,
        athletes: new Set(sessions.map((session) => session.playerId)).size,
        sets: entries.filter((entry) => (entry.status ?? "Completed") !== "Skipped").length,
        volume: entries.reduce((sum, entry) => sum + workoutEntryVolume(entry), 0),
        completed: sessions.length > 0 && sessions.every((session) => session.completed),
      };
    });
}

function buildWeightRoomTeamOverview(data: AppData, players: Player[], date: string) {
  const playerIds = new Set(players.map((player) => player.id));
  const week = weekStart(date);
  const previousWeek = shiftDateKey(week, -7);
  const sessionsThisWeek = data.workoutSessions.filter((session) => playerIds.has(session.playerId) && (session.weekOf || weekStart(session.date)) === week);
  const completedSessionsThisWeek = sessionsThisWeek.filter((session) => session.completed);
  const completedSessionIds = new Set(completedSessionsThisWeek.map((session) => session.id));
  const entriesThisWeek = data.workoutEntries.filter((entry) => completedSessionIds.has(entry.sessionId) && (entry.status ?? "Completed") !== "Skipped");
  const sessionsLastWeek = data.workoutSessions.filter((session) => playerIds.has(session.playerId) && (session.weekOf || weekStart(session.date)) === previousWeek && session.completed);
  const lastWeekSessionIds = new Set(sessionsLastWeek.map((session) => session.id));
  const entriesLastWeek = data.workoutEntries.filter((entry) => lastWeekSessionIds.has(entry.sessionId) && (entry.status ?? "Completed") !== "Skipped");
  const completedAthletes = new Set(completedSessionsThisWeek.map((session) => session.playerId)).size;
  const completedWorkoutCount = new Set(completedSessionsThisWeek.map((session) => session.date)).size;
  const volume = entriesThisWeek.reduce((sum, entry) => sum + workoutEntryVolume(entry), 0);
  const lastWeekVolume = entriesLastWeek.reduce((sum, entry) => sum + workoutEntryVolume(entry), 0);
  const leaderboardThisWeek = buildScoredWeightRoomLeaderboard(players, data.workoutSessions, data.workoutEntries, "This Week", date);
  const trendValues = leaderboardThisWeek.map((row) => row.progressPct).filter((value) => Number.isFinite(value) && value !== 0);
  const improvementEntries = entriesThisWeek.filter(isWorkoutEntryImprovement);
  const nextLift = buildScheduleItems(data)
    .filter((item) => item.eventType === "Lift" && item.status !== "Completed" && item.status !== "Cancelled" && isUpcomingScheduleItem(item))
    .sort((left, right) => Date.parse(left.startAt) - Date.parse(right.startAt))[0];
  return {
    athletes: players.length,
    completedAthletes,
    completedWorkoutCount,
    workoutsThisWeek: new Set(sessionsThisWeek.map((session) => session.date)).size,
    sets: entriesThisWeek.reduce((sum, entry) => sum + Math.max(1, entry.sets ?? 1), 0),
    volume,
    completionPct: players.length ? pct(completedAthletes, players.length) : 0,
    volumeChangePct: completedWorkoutCount > 1 && lastWeekVolume > 0 ? ((volume - lastWeekVolume) / lastWeekVolume) * 100 : undefined,
    strengthTrendPct: trendValues.length ? trendValues.reduce((sum, value) => sum + value, 0) / trendValues.length : undefined,
    improvingAthletes: new Set(improvementEntries.map((entry) => entry.playerId)).size,
    trackedImprovements: improvementEntries.length,
    nextLift,
  };
}

function formatWeightRoomSessionMeta(date: string, startAt?: string) {
  return [shortDate(date), startAt ? formatTime(startAt) : undefined].filter(Boolean).join(" - ");
}

function shiftDateKey(dateKey: string, days: number) {
  const date = parseDateKey(dateKey) ?? new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

function isWorkoutEntryImprovement(entry: WorkoutEntry) {
  if (!entry.priorValue) return false;
  const current = entry.weight ?? entry.value ?? entry.reps ?? 0;
  const prior = entry.priorValue;
  if (!current || !prior) return false;
  const timeBased = entry.kind === "Speed" || entry.unit === "sec";
  return timeBased ? current < prior : current > prior;
}

function buildWeightRoomPlayerProfile(data: AppData, player: Player) {
  const sessions = data.workoutSessions.filter((session) => session.playerId === player.id).sort((left, right) => right.date.localeCompare(left.date));
  const entries = data.workoutEntries.filter((entry) => entry.playerId === player.id);
  const score = buildScoredWeightRoomLeaderboard([player], data.workoutSessions, data.workoutEntries, "This Season")[0];
  const bodyWeights = sessions
    .filter((session) => typeof session.bodyWeight === "number")
    .slice()
    .reverse()
    .map((session) => session.bodyWeight ?? 0);
  const exerciseTrends = uniqueStrings(entries.map((entry) => entry.exercise)).map((exercise) => trendForExercise(entries.filter((entry) => entry.exercise === exercise))).filter((trend) => trend.samples > 1);
  const week = weekStart(todayKey());
  const workoutsThisWeek = new Set(sessions.filter((session) => session.weekOf === week).map((session) => session.date)).size;
  return {
    workoutsThisWeek,
    volume: entries.reduce((sum, entry) => sum + workoutEntryVolume(entry), 0),
    sets: entries.filter((entry) => (entry.status ?? "Completed") !== "Skipped").length,
    currentWeight: latestBodyWeight(data, player.id),
    score,
    weightTrend: bodyWeights,
    exerciseTrends,
    summary: score ? `${player.name.split(" ")[0]} is scoring ${score.score}/100 from ${score.sets} tracked sets.` : "Log two workouts or four sets to unlock development scoring.",
  };
}

function bestWorkoutEntry(entries: WorkoutEntry[]) {
  return entries.slice().sort((left, right) => workoutEntryComparableForDisplay(right) - workoutEntryComparableForDisplay(left))[0];
}

function workoutEntryComparableForDisplay(entry: WorkoutEntry) {
  if (entry.unit === "sec" && typeof entry.value === "number") return -entry.value;
  return estimatedOneRepMax(entry.weight, entry.reps) ?? entry.weight ?? entry.value ?? entry.reps ?? 0;
}

function trendForExercise(entries: WorkoutEntry[]) {
  const sorted = entries.slice().sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const first = sorted[0];
  const latest = sorted[sorted.length - 1];
  const firstValue = first ? workoutEntryComparableForDisplay(first) : 0;
  const latestValue = latest ? workoutEntryComparableForDisplay(latest) : 0;
  const changePct = firstValue ? ((latestValue - firstValue) / Math.abs(firstValue)) * 100 : 0;
  return {
    exercise: latest?.exercise ?? first?.exercise ?? "Exercise",
    samples: sorted.length,
    changePct,
  };
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

function practiceTotals(data: AppData, practiceId: ID) {
  const totals = deriveConcurrentPracticeTotals(data, practiceId);
  return {
    pitches: totals.pitches,
    swings: totals.swings,
    defense: totals.defense,
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

function isMachineHittingStation(station: HittingSession["type"]) {
  return station === "Machine" || station === "Hack Attack - FB" || station === "Hack Attack - CB";
}

function normalizeHittingStation(station?: string): HittingSession["type"] {
  if (station === "Tee" || station === "Front Toss" || station === "Coach BP" || station === "Live BP" || station === "Other" || station === "Hack Attack - FB" || station === "Hack Attack - CB") {
    return station;
  }
  if (station === "Machine") return "Hack Attack - FB";
  return "Hack Attack - FB";
}

function practicePlayerStatus(data: AppData, practice: Practice | undefined, playerId: ID): PracticeAttendanceStatus {
  if (!practice) return "Present";
  return data.attendance.find((item) => item.practiceId === practice.id && item.playerId === playerId)?.status ?? "Present";
}

function availablePracticePlayers(data: AppData, practice: Practice | undefined) {
  const basePlayers = sortPlayersByRecent(data.players.filter((player) => !player.archived), data.settings.recentPlayerIds);
  if (!practice) return basePlayers;
  const participatingIds = new Set<ID>([
    ...practice.playerIds,
    ...practice.pitcherIds,
    ...practice.hitterIds,
    ...data.attendance.filter((item) => item.practiceId === practice.id).map((item) => item.playerId),
  ]);
  return basePlayers.filter((player) => {
    if (participatingIds.size && !participatingIds.has(player.id)) return false;
    const status = practicePlayerStatus(data, practice, player.id);
    return status === "Present" || status === "Late";
  });
}

function buildActivePracticeSessions(data: AppData, practiceId: ID): PracticeActiveSessionRow[] {
  const playerById = new Map(data.players.map((player) => [player.id, player]));
  const currentProfileId = data.teamContext?.profile?.id;
  const rows: PracticeActiveSessionRow[] = [
    ...data.hittingSessions
      .filter((session) => session.practiceId === practiceId && !session.endedAt)
      .map((session) => {
        const player = playerById.get(session.hitterId);
        const events = data.hittingEvents.filter((event) => event.sessionId === session.id);
        return {
          id: `hit-${session.id}`,
          mode: "Hitting" as const,
          sessionId: session.id,
          title: session.title ?? `${session.type} Hitting`,
          station: session.type,
          primaryPlayerId: session.hitterId,
          playerLine: player?.name ?? "Hitter",
          count: `${events.filter((event) => event.action !== "Took pitch").length} swings`,
          contributors: contributorLabels(data, session.id, session.createdByProfileId, session.contributorProfileIds),
          isMine: Boolean(currentProfileId && (session.createdByProfileId === currentProfileId || session.contributorProfileIds?.includes(currentProfileId))),
          startedAt: session.startedAt,
        };
      }),
    ...data.pitchingSessions
      .filter((session) => session.practiceId === practiceId && !session.endedAt)
      .map((session) => {
        const player = playerById.get(session.pitcherId);
        const hitter = session.hitterId ? playerById.get(session.hitterId) : undefined;
        const events = data.pitchEvents.filter((event) => event.sessionId === session.id);
        return {
          id: `pitch-${session.id}`,
          mode: session.type === "Live BP" ? "Live BP" as const : "Pitching" as const,
          sessionId: session.id,
          title: session.title ?? (session.type === "Live BP" ? "Live BP" : `${session.type} Pitching`),
          station: session.station ?? session.type,
          primaryPlayerId: session.pitcherId,
          secondaryPlayerId: session.hitterId,
          playerLine: hitter ? `${player?.name ?? "Pitcher"} vs ${hitter.name}` : player?.name ?? "Pitcher",
          count: `${events.length} pitches`,
          contributors: contributorLabels(data, session.id, session.createdByProfileId, session.contributorProfileIds),
          isMine: Boolean(currentProfileId && (session.createdByProfileId === currentProfileId || session.contributorProfileIds?.includes(currentProfileId))),
          startedAt: session.startedAt,
        };
      }),
    ...data.defenseSessions
      .filter((session) => session.practiceId === practiceId && !session.endedAt)
      .map((session) => {
        const player = playerById.get(session.playerId);
        const events = data.defenseEvents.filter((event) => event.sessionId === session.id);
        return {
          id: `def-${session.id}`,
          mode: "Defense" as const,
          sessionId: session.id,
          title: session.title ?? `${session.station} Defense`,
          station: session.station,
          primaryPlayerId: session.playerId,
          playerLine: player?.name ?? "Defender",
          count: `${events.length} reps`,
          contributors: contributorLabels(data, session.id, session.createdByProfileId, session.contributorProfileIds),
          isMine: Boolean(currentProfileId && (session.createdByProfileId === currentProfileId || session.contributorProfileIds?.includes(currentProfileId))),
          startedAt: session.startedAt,
        };
      }),
  ];
  return rows.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

function contributorLabels(data: AppData, sessionId: ID, createdByProfileId?: ID, contributorProfileIds?: ID[]) {
  const profile = data.teamContext?.profile;
  const staffByProfileId = new Map((data.staffMembers ?? []).filter((member) => member.profileId).map((member) => [member.profileId as ID, member.displayName]));
  const ids = new Set<ID>([
    ...(createdByProfileId ? [createdByProfileId] : []),
    ...(contributorProfileIds ?? []),
    ...((data.practiceSessionContributors ?? []).filter((row) => row.sessionId === sessionId).map((row) => row.profileId)),
  ]);
  return [...ids].map((profileId) => {
    if (profileId === profile?.id) return profileDisplayName(data.teamContext);
    return staffByProfileId.get(profileId) ?? "Coach";
  });
}

function buildPracticeActivityFeed(data: AppData, practiceId: ID): PracticeActivityFeedRow[] {
  const playerById = new Map(data.players.map((player) => [player.id, player]));
  const rows: Array<PracticeActivityFeedRow & { createdAt: string }> = [
    ...data.pitchEvents
      .filter((event) => event.practiceId === practiceId)
      .map((event) => ({
        id: `pitch-${event.id}`,
        mode: "Pitching" as const,
        time: formatTime(event.createdAt),
        title: playerById.get(event.pitcherId)?.name ?? "Pitcher",
        detail: `${PITCH_TYPE_LABELS[event.pitchType]} ${event.outcome}`,
        createdAt: event.createdAt,
      })),
    ...data.hittingEvents
      .filter((event) => event.practiceId === practiceId)
      .map((event) => ({
        id: `hit-${event.id}`,
        mode: "Hitting" as const,
        time: formatTime(event.createdAt),
        title: playerById.get(event.hitterId)?.name ?? "Hitter",
        detail: event.contactQuality ? `${event.contactQuality} ${event.contactResult ?? "contact"}` : event.action,
        createdAt: event.createdAt,
      })),
    ...data.defenseEvents
      .filter((event) => event.practiceId === practiceId)
      .map((event) => ({
        id: `def-${event.id}`,
        mode: "Defense" as const,
        time: formatTime(event.createdAt),
        title: playerById.get(event.playerId)?.name ?? "Defender",
        detail: `${event.station} ${event.outcome}`,
        createdAt: event.createdAt,
      })),
  ];
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((row) => ({
    id: row.id,
    mode: row.mode,
    time: row.time,
    title: row.title,
    detail: row.detail,
  }));
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
      title: `${matchupPrefix(game.homeAway).replace(".", "")} ${game.opponent}`,
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

function ensureHittingSession(data: AppData, practice: Practice, playerId: ID, type: HittingSession["type"], profileId?: ID) {
  const now = new Date().toISOString();
  const existing = data.hittingSessions.find((session) => session.practiceId === practice.id && session.hitterId === playerId && session.type === type && !session.endedAt);
  if (existing) {
    const session = {
      ...existing,
      contributorProfileIds: withContributorProfile(existing.contributorProfileIds, profileId),
      updatedAt: now,
    };
    const nextData = {
      ...data,
      hittingSessions: data.hittingSessions.map((item) => (item.id === session.id ? session : item)),
      practiceSessionContributors: touchSessionContributor(data.practiceSessionContributors ?? [], { sessionId: session.id, profileId, at: now }),
    };
    return { data: nextData, session };
  }
  const session: HittingSession = {
    id: createId("hs"),
    practiceId: practice.id,
    hitterId: playerId,
    type,
    roundGoals: ["Line drives"],
    plannedReps: 20,
    machineVelocity: isMachineHittingStation(type) ? 85 : undefined,
    machinePitchType: isMachineHittingStation(type) ? (type === "Hack Attack - CB" ? "Curveball" : "4-Seam") : undefined,
    startedAt: now,
    title: `${type} - Hitting`,
    status: "ACTIVE",
    createdByProfileId: profileId,
    contributorProfileIds: withContributorProfile([], profileId),
    location: practice.location,
    station: type,
    entryPolicy: "COACH_ONLY",
    updatedAt: now,
  };
  return {
    data: {
      ...data,
      hittingSessions: [session, ...data.hittingSessions],
      practiceSessionContributors: touchSessionContributor(data.practiceSessionContributors ?? [], { sessionId: session.id, profileId, at: now }),
    },
    session,
  };
}

function ensurePitchingSession(data: AppData, practice: Practice, playerId: ID, type: PitchingSession["type"], profileId?: ID, hitterId?: ID) {
  const now = new Date().toISOString();
  const existing = data.pitchingSessions.find((session) => session.practiceId === practice.id && session.pitcherId === playerId && session.type === type && !session.endedAt);
  if (existing) {
    const session = {
      ...existing,
      hitterId: hitterId ?? existing.hitterId,
      contributorProfileIds: withContributorProfile(existing.contributorProfileIds, profileId),
      updatedAt: now,
    };
    const nextData = {
      ...data,
      pitchingSessions: data.pitchingSessions.map((item) => (item.id === session.id ? session : item)),
      practiceSessionContributors: touchSessionContributor(data.practiceSessionContributors ?? [], { sessionId: session.id, profileId, at: now }),
    };
    return { data: nextData, session };
  }
  const session: PitchingSession = {
    id: createId("ps"),
    practiceId: practice.id,
    pitcherId: playerId,
    type,
    hitterId,
    focusTags: ["Strike throwing"],
    intendedFocus: "Win the zone early and finish every pitch.",
    startedAt: now,
    title: type === "Live BP" ? "Live BP" : `${type} - Pitching`,
    status: "ACTIVE",
    createdByProfileId: profileId,
    contributorProfileIds: withContributorProfile([], profileId),
    location: practice.location,
    station: type === "Live BP" ? "Main Field" : "Bullpen",
    entryPolicy: "COACH_ONLY",
    updatedAt: now,
  };
  return {
    data: {
      ...data,
      pitchingSessions: [session, ...data.pitchingSessions],
      practiceSessionContributors: touchSessionContributor(data.practiceSessionContributors ?? [], { sessionId: session.id, profileId, at: now }),
    },
    session,
  };
}

function ensureDefenseSession(data: AppData, practice: Practice, playerId: ID, station: DefenseStation, profileId?: ID) {
  const now = new Date().toISOString();
  const existing = data.defenseSessions.find((session) => session.practiceId === practice.id && session.playerId === playerId && session.station === station && !session.endedAt);
  if (existing) {
    const session = {
      ...existing,
      contributorProfileIds: withContributorProfile(existing.contributorProfileIds, profileId),
      updatedAt: now,
    };
    const nextData = {
      ...data,
      defenseSessions: data.defenseSessions.map((item) => (item.id === session.id ? session : item)),
      practiceSessionContributors: touchSessionContributor(data.practiceSessionContributors ?? [], { sessionId: session.id, profileId, at: now }),
    };
    return { data: nextData, session };
  }
  const session = {
    id: createId("ds"),
    practiceId: practice.id,
    playerId,
    station,
    mode: "Quick Practice" as const,
    startedAt: now,
    title: `${station} - Defense`,
    status: "ACTIVE" as const,
    createdByProfileId: profileId,
    contributorProfileIds: withContributorProfile([], profileId),
    location: practice.location,
    entryPolicy: "COACH_ONLY" as const,
    updatedAt: now,
  };
  return {
    data: {
      ...data,
      defenseSessions: [session, ...data.defenseSessions],
      practiceSessionContributors: touchSessionContributor(data.practiceSessionContributors ?? [], { sessionId: session.id, profileId, at: now }),
    },
    session,
  };
}

function withContributorProfile(ids: ID[] | undefined, profileId?: ID) {
  if (!profileId) return ids ?? [];
  return [...new Set([...(ids ?? []), profileId])];
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

function lastName(name: string) {
  return name.split(" ").filter(Boolean).slice(-1)[0] ?? name;
}

function practiceModeClass(mode: PracticeMode) {
  return mode.toLowerCase().replace(/\s+/g, "-");
}

function practiceModeIcon(mode: PracticeMode) {
  const Icon = mode === "Hitting" ? Swords : mode === "Pitching" ? BaseballIcon : mode === "Defense" ? Shield : Gauge;
  return <Icon size={16} aria-hidden="true" />;
}

function zoneLabel(point: ZonePoint) {
  const column = point.x < 0.34 ? 0 : point.x > 0.66 ? 2 : 1;
  const row = point.y < 0.34 ? 0 : point.y > 0.66 ? 2 : 1;
  return String(row * 3 + column + 1);
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

function buildScheduleItems(data: AppData): ScheduleItem[] {
  const practiceItems: ScheduleItem[] = data.practices.map((practice) => ({
    id: `practice-${practice.id}`,
    source: "practice",
    sourceId: practice.id,
    eventType: "Practice",
    title: practice.name || practice.type,
    startAt: practice.startedAt,
    endAt: practice.endedAt,
    date: practice.date,
    location: practice.location,
    notes: practice.notes,
    visibility: "TEAM_ONLY",
    status: practice.endedAt ? "Completed" : "Scheduled",
    accent: SCHEDULE_EVENT_ACCENTS.Practice,
  }));

  const gameItems: ScheduleItem[] = data.games.map((game) => ({
    id: `game-${game.id}`,
    source: "game",
    sourceId: game.id,
    eventType: "Game",
    title: `${matchupPrefix(game.homeAway).replace(".", "")} ${game.opponent}`,
    startAt: game.startsAt ?? toLocalIso(game.date, "18:00"),
    date: game.date,
    location: game.location,
    notes: game.type,
    visibility: defaultScheduleVisibility("Game", data.teamContext?.currentTeam),
    status: game.result ? "Completed" : "Scheduled",
    accent: SCHEDULE_EVENT_ACCENTS.Game,
  }));

  const workoutsByDate = new Map<string, WorkoutSession[]>();
  for (const session of data.workoutSessions) {
    const dateSessions = workoutsByDate.get(session.date) ?? [];
    dateSessions.push(session);
    workoutsByDate.set(session.date, dateSessions);
  }
  const liftItems: ScheduleItem[] = [...workoutsByDate.entries()].map(([date, sessions]) => ({
    id: `lift-${date}`,
    source: "lift",
    sourceId: sessions[0]?.id ?? date,
    eventType: "Lift",
    title: sessions.length > 1 ? `Team Lift (${sessions.length})` : "Team Lift",
    startAt: toLocalIso(date, "16:00"),
    date,
    location: "Weight Room",
    visibility: "TEAM_ONLY",
    status: sessions.every((session) => session.completed) ? "Completed" : "Scheduled",
    accent: SCHEDULE_EVENT_ACCENTS.Lift,
  }));

  const genericItems: ScheduleItem[] = (data.scheduleEvents ?? [])
    .filter((event) => !event.practiceId && !event.gameId && !event.workoutSessionId)
    .map((event) => ({
      id: `event-${event.id}`,
      source: "event",
      sourceId: event.id,
      eventType: event.eventType,
      title: event.title,
      startAt: event.startAt,
      endAt: event.endAt,
      date: dateKeyFromIso(event.startAt),
      location: event.location,
      notes: event.notes,
      visibility: event.visibility,
      status: event.status,
      accent: SCHEDULE_EVENT_ACCENTS[event.eventType],
    }));

  return [...practiceItems, ...gameItems, ...liftItems, ...genericItems].sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
}

function toLocalIso(date: string, time = "12:00") {
  const safeTime = time || "12:00";
  return new Date(`${date}T${safeTime}:00`).toISOString();
}

function dateKeyFromIso(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return localDateKey(date);
}

function todayKey() {
  return localDateKey(new Date());
}

function isDateWithinDays(date: string, anchor: string, days: number) {
  const value = Date.parse(`${date}T12:00:00`);
  const anchorValue = Date.parse(`${anchor}T12:00:00`);
  if (Number.isNaN(value) || Number.isNaN(anchorValue)) return false;
  const diff = anchorValue - value;
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
}

function isUpcomingScheduleItem(item: ScheduleItem) {
  return Date.parse(item.startAt) >= Date.parse(`${todayKey()}T00:00:00`);
}

function isPastScheduleItem(item: ScheduleItem) {
  return Date.parse(item.startAt) < Date.parse(`${todayKey()}T00:00:00`);
}

function isoDate(date: Date) {
  return localDateKey(date);
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isToday(dateKey: string) {
  return dateKey === todayKey();
}

function calendarDaysForMonth(cursor: Date) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(first);
  const day = start.getDay();
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function weekDates(cursor: Date) {
  const start = new Date(cursor);
  const day = start.getDay();
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function weekRangeLabel(cursor: Date) {
  const days = weekDates(cursor);
  const first = days[0];
  const last = days[6];
  return `${first.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${last.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

function monthCursor(dateKey?: string) {
  const date = parseDateKey(dateKey) ?? new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function parseDateKey(dateKey?: string) {
  if (!dateKey) return undefined;
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function formatPickerDate(dateKey?: string) {
  const date = parseDateKey(dateKey);
  if (!date) return "Select date";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function parseTimeValue(value?: string) {
  if (!value) return undefined;
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return undefined;
  return hours * 60 + minutes;
}

function formatMinutesAsTimeValue(totalMinutes: number) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatPickerTime(value?: string) {
  const minutes = parseTimeValue(value);
  if (minutes === undefined) return "";
  const hours = Math.floor(minutes / 60);
  const minutePart = minutes % 60;
  const hour12 = hours % 12 || 12;
  const period = hours >= 12 ? "PM" : "AM";
  return `${hour12}:${String(minutePart).padStart(2, "0")} ${period}`;
}

function timePickerParts(value?: string): { hour: number; minute: number; period: TimePeriod } {
  const totalMinutes = parseTimeValue(value) ?? 18 * 60;
  const hours = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return {
    hour: hours % 12 || 12,
    minute,
    period: hours >= 12 ? "PM" : "AM",
  };
}

function timeValueFromParts(parts: { hour: number; minute: number; period: TimePeriod }) {
  let hour = clampNumber(parts.hour, 1, 12);
  const minute = clampNumber(parts.minute, 0, 59);
  if (parts.period === "AM" && hour === 12) hour = 0;
  if (parts.period === "PM" && hour !== 12) hour += 12;
  return formatMinutesAsTimeValue(hour * 60 + minute);
}

function parseTimeInput(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "";
  const match = normalized.match(/^(\d{1,2})(?::?(\d{2}))?\s*(a|am|p|pm)?$/);
  if (!match) return undefined;
  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? "0");
  const period = match[3];
  if (minutes > 59 || hours > 24) return undefined;
  if (period) {
    if (hours < 1 || hours > 12) return undefined;
    if (period.startsWith("p") && hours !== 12) hours += 12;
    if (period.startsWith("a") && hours === 12) hours = 0;
  } else if (hours === 24) {
    hours = 0;
  }
  return formatMinutesAsTimeValue(hours * 60 + minutes);
}

function defaultEndTime(startTime: string) {
  const startMinutes = parseTimeValue(startTime);
  if (startMinutes === undefined) return "19:00";
  return formatMinutesAsTimeValue(startMinutes + 60);
}

function groupScheduleItemsByDate(items: ScheduleItem[]) {
  const groups = new Map<string, ScheduleItem[]>();
  for (const item of items) {
    const group = groups.get(item.date) ?? [];
    group.push(item);
    groups.set(item.date, group);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, groupItems]) => ({
      date,
      items: groupItems.sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt)),
    }));
}

function agendaDateLabel(date: string) {
  const today = todayKey();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = tomorrow.toISOString().slice(0, 10);
  if (date === today) return "Today";
  if (date === tomorrowKey) return "Tomorrow";
  return fullDate(date);
}

function teamContextLine(team?: TeamOption) {
  if (!team) return "Current team";
  return `${team.teamName} - ${team.seasonName ?? "Current season"}`;
}

function defaultScheduleVisibility(type: ScheduleEventType, team?: TeamOption): ScheduleEventVisibility {
  void team;
  if (type === "Game" || type === "Tournament") return "PUBLIC";
  return "TEAM_ONLY";
}

function matchupPrefix(homeAway: Game["homeAway"]) {
  return homeAway === "Away" ? "at" : "vs.";
}

function defaultScheduleTitle(type: ScheduleEventType, opponent = "", homeAway: Game["homeAway"] = "Home") {
  const trimmedOpponent = opponent.trim();
  if (type === "Practice") return "Practice";
  if (type === "Game") return trimmedOpponent ? `${matchupPrefix(homeAway)} ${trimmedOpponent}` : "Game";
  if (type === "Lift") return "Team Lift";
  if (type === "Scrimmage") return trimmedOpponent === "Intersquad" ? "Intersquad Scrimmage" : trimmedOpponent ? `${matchupPrefix(homeAway)} ${trimmedOpponent} Scrimmage` : "Scrimmage";
  if (type === "Meeting") return "Team Meeting";
  if (type === "Team Event") return "Team Event";
  if (type === "Tournament") return "Tournament";
  return "Other";
}

function isDefaultScheduleTitle(title: string) {
  const normalized = title.trim();
  if (!normalized) return true;
  return SCHEDULE_EVENT_TYPES.some((type) => normalized === defaultScheduleTitle(type));
}

function shouldResetScheduleTitle(nextType: ScheduleEventType, currentTitle: string) {
  if (nextType === "Practice" || nextType === "Lift") return true;
  return isDefaultScheduleTitle(currentTitle);
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

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatTime(value?: string) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatPracticeStartTime(practice: Practice) {
  return formatTime(practice.startedAt);
}

function formatPracticeTimeRange(practice: Practice) {
  const start = formatTime(practice.startedAt);
  if (practice.endedAt) return `${start}-${formatTime(practice.endedAt)}`;
  return start;
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

function profileTeamPinMatchesTeam(pin: ProfileTeamPin, team: TeamOption) {
  return pin.teamId === team.teamId && (pin.seasonId ?? "") === (team.seasonId ?? "");
}

function isPinnedTeam(pins: ProfileTeamPin[] | undefined, team: TeamOption) {
  return Boolean(pins?.some((pin) => profileTeamPinMatchesTeam(pin, team)));
}

function pinnedTeamsFromContext(context?: TeamContext, pins: ProfileTeamPin[] = []) {
  const teams = displayWorkspaceTeams(context?.availableTeams ?? []);
  const teamsByValue = new Map(teams.map((team) => [teamValue(team), team]));
  return pins
    .map((pin) => teamsByValue.get(`${pin.teamId}:${pin.seasonId ?? "all"}`))
    .filter((team): team is TeamOption => Boolean(team))
    .slice(0, 3);
}

function teamOrganizationLogo(team: TeamOption, context?: TeamContext) {
  return context?.organizations?.find((organization) => organization.id === team.organizationId)?.logoUrl;
}

function isFollowingTeam(follows: ProfileFollow[] | undefined, teamId: ID) {
  return Boolean(follows?.some((follow) => follow.teamId === teamId));
}

function isFollowingOrganization(follows: ProfileFollow[] | undefined, organizationId: ID) {
  return Boolean(follows?.some((follow) => follow.organizationId === organizationId && !follow.teamId));
}

function followedPublicTeams(data: AppData) {
  const managedTeamIds = new Set((data.teamContext?.availableTeams ?? []).map((team) => team.teamId));
  const follows = data.profileFollows ?? [];
  const followedTeamIds = new Set(follows.map((follow) => follow.teamId).filter((teamId): teamId is ID => Boolean(teamId)));
  return (data.publicTeams ?? []).filter((team) => followedTeamIds.has(team.id) && !managedTeamIds.has(team.id));
}

function followedPublicOrganizations(data: AppData) {
  const follows = data.profileFollows ?? [];
  const followedOrganizationIds = new Set(
    follows
      .filter((follow) => follow.organizationId && !follow.teamId)
      .map((follow) => follow.organizationId)
      .filter((organizationId): organizationId is ID => Boolean(organizationId)),
  );
  return (data.publicOrganizations ?? []).filter((organization) => followedOrganizationIds.has(organization.id));
}

function organizationLocation(source: { city?: string; state?: string }) {
  return [source.city, source.state].filter(Boolean).join(", ");
}

function publicOrganizationSearchText(organization: PublicDirectoryOrganizationSummary) {
  return [
    organization.name,
    organization.city,
    organization.state,
    organization.teams.map((team) => `${team.name} ${team.level ?? ""} ${team.seasonName ?? ""}`).join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function publicTeamSearchText(team: PublicDirectoryTeamSummary) {
  return [team.organizationName, team.name, team.level, team.seasonName, team.city, team.state]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
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
  const named = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim();
  const display = profile?.displayName && !profile.displayName.includes("@") ? profile.displayName : "";
  return named || display || profile?.email?.split("@")[0]?.replace(/[._-]+/g, " ") || "Coach";
}

function preferredProfileDisplayName(profile?: AppProfile) {
  const named = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim();
  const display = profile?.displayName && !profile.displayName.includes("@") ? profile.displayName : "";
  return display || named || profile?.email?.split("@")[0]?.replace(/[._-]+/g, " ") || "Coach";
}

function profileInitials(context?: TeamContext) {
  const profile = context?.profile;
  const named = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim();
  const display = profile?.displayName && !profile.displayName.includes("@") ? profile.displayName : "";
  const emailLocal = profile?.email?.split("@")[0]?.replace(/[._-]+/g, " ").trim() ?? "";
  return initialsFor(named || display || emailLocal || profile?.email || "C9");
}

function gradeSession(note: string) {
  return note.length > 80 ? "A-" : note.length > 20 ? "B+" : "B";
}

function distanceBetween(a: ZonePoint, b: ZonePoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function isZonePoint(point: ZonePoint | undefined): point is ZonePoint {
  return Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.y));
}

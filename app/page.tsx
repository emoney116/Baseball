"use client";

import {
  Activity,
  Archive,
  BarChart3,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Crosshair,
  Edit3,
  Flame,
  Gauge,
  Home,
  Layers,
  MapPin,
  Moon,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Shield,
  Sparkles,
  StopCircle,
  Sun,
  Target,
  Trophy,
  Undo2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  BaseballField,
  DonutChart,
  EmptyState,
  Heatmap,
  MetricBar,
  MiniLineChart,
  PlayerAvatar,
  StatTile,
  StrikeZone,
} from "./components/visuals";
import { createId, localPracticeRepository, touchRecentPlayers } from "./data/repository";
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
  CoachNote,
  CountState,
  DevelopmentGoal,
  Direction,
  HittingContactQuality,
  HittingEvent,
  HittingSession,
  ID,
  PitchEvent,
  PitchFocusTag,
  PitchOutcome,
  PitchType,
  PitchingSession,
  Player,
  Position,
  Practice,
  PracticeStation,
  PracticeType,
  RoundGoal,
  ZonePoint,
} from "./types";

type ViewKey =
  | "dashboard"
  | "active"
  | "pitching"
  | "hitting"
  | "players"
  | "profile"
  | "history"
  | "analytics"
  | "settings";

type PlayerFilter = "all" | "pitchers" | "hitters" | Position;

const navItems: Array<{ key: ViewKey; label: string; icon: LucideIcon }> = [
  { key: "dashboard", label: "Dashboard", icon: Home },
  { key: "active", label: "Active Practice", icon: Gauge },
  { key: "pitching", label: "Pitching", icon: Target },
  { key: "hitting", label: "Hitting", icon: Crosshair },
  { key: "players", label: "Players", icon: Users },
  { key: "history", label: "Practice History", icon: CalendarDays },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "settings", label: "Settings", icon: Settings },
];

const mobileNav: ViewKey[] = ["dashboard", "active", "pitching", "hitting", "players"];
const practiceTypes: PracticeType[] = [
  "Full Practice",
  "Bullpen Day",
  "Live BP",
  "Hitting Day",
  "Scrimmage",
  "Pitcher Development",
  "Hitter Development",
  "Custom",
];
const pitchTypes: PitchType[] = ["4-Seam", "2-Seam", "Sinker", "Cutter", "Slider", "Curveball", "Changeup", "Splitter", "Other"];
const pitchFocusTags: PitchFocusTag[] = [
  "Fastball command",
  "Secondary command",
  "Velocity",
  "Mechanics",
  "Sequencing",
  "Strike throwing",
  "Two-strike pitches",
  "Changeup development",
  "Breaking ball development",
  "Other",
];
const roundGoals: RoundGoal[] = ["Pull", "Middle", "Oppo", "Line drives", "Two-strike", "Situational", "Fastball timing", "Breaking balls", "Velocity", "Approach", "Custom"];
const positions: Position[] = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "UTL", "DH"];
const noteTags: CoachNote["tags"] = ["Mechanics", "Approach", "Timing", "Command", "Velocity", "Confidence", "Defense", "Strength", "Development Goal"];
const pitchMixColors = ["#f4c16f", "#9f244c", "#8b96a5", "#43c6ac", "#f97316", "#a78bfa", "#e2e8f0", "#38bdf8"];

export default function Home() {
  const [data, setData] = useState<AppData | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<ViewKey>("dashboard");
  const [query, setQuery] = useState("");
  const [playerFilter, setPlayerFilter] = useState<PlayerFilter>("all");
  const [selectedPlayerId, setSelectedPlayerId] = useState<ID>("p-jackson-smith");
  const [selectedPracticeId, setSelectedPracticeId] = useState<ID>("practice-aug8");
  const [profileTab, setProfileTab] = useState<"overview" | "hitting" | "pitching" | "practices" | "notes">("overview");
  const [selectedPitcherId, setSelectedPitcherId] = useState<ID>("p-jackson-smith");
  const [selectedHitterId, setSelectedHitterId] = useState<ID>("p-ethan-brooks");
  const [pitchStation, setPitchStation] = useState<"Bullpen" | "Live BP">("Bullpen");
  const [hittingStation, setHittingStation] = useState<HittingSession["type"]>("Machine");
  const [selectedPitchType, setSelectedPitchType] = useState<PitchType>("4-Seam");
  const [selectedVelocity, setSelectedVelocity] = useState<number | undefined>(84);
  const [pitchQuality, setPitchQuality] = useState(4);
  const [missedLocation, setMissedLocation] = useState(false);
  const [pitchLocation, setPitchLocation] = useState<ZonePoint>({ x: 0.5, y: 0.5 });
  const [fieldLocation, setFieldLocation] = useState<ZonePoint>({ x: 0.5, y: 0.54 });
  const [direction, setDirection] = useState<Direction>("Middle");
  const [practiceModalOpen, setPracticeModalOpen] = useState(false);
  const [playerModalOpen, setPlayerModalOpen] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<ID | undefined>();
  const [summary, setSummary] = useState<{ type: "pitching" | "hitting"; sessionId: ID } | null>(null);

  useEffect(() => {
    const loaded = localPracticeRepository.load();
    const params = new URLSearchParams(window.location.search);
    const requestedView = params.get("view") as ViewKey | null;
    const requestedPlayer = params.get("player");
    setData(loaded);
    setHydrated(true);
    const active = activePractice(loaded);
    const firstPitcher = active?.pitcherIds[0] ?? loaded.players.find((player) => player.isPitcher)?.id;
    const firstHitter = active?.hitterIds[0] ?? loaded.players.find((player) => player.isHitter)?.id;
    setSelectedPracticeId(active?.id ?? loaded.practices[0]?.id ?? "");
    setSelectedPitcherId(firstPitcher ?? loaded.players[0]?.id ?? "");
    setSelectedHitterId(firstHitter ?? loaded.players[1]?.id ?? loaded.players[0]?.id ?? "");
    if (requestedPlayer && loaded.players.some((player) => player.id === requestedPlayer)) {
      setSelectedPlayerId(requestedPlayer);
      const player = loaded.players.find((item) => item.id === requestedPlayer);
      if (player?.isPitcher) setSelectedPitcherId(requestedPlayer);
      if (player?.isHitter) setSelectedHitterId(requestedPlayer);
    } else {
      setSelectedPlayerId(loaded.settings.recentPlayerIds[0] ?? loaded.players[0]?.id ?? "");
    }
    if (requestedView && navItems.some((item) => item.key === requestedView)) {
      setView(requestedView);
    }
  }, []);

  useEffect(() => {
    if (hydrated && data) {
      localPracticeRepository.save(data);
      document.documentElement.dataset.theme = data.settings.theme;
    }
  }, [data, hydrated]);

  const practice = data ? activePractice(data) : undefined;
  const selectedPlayer = data?.players.find((player) => player.id === selectedPlayerId) ?? data?.players[0];
  const selectedPractice = data?.practices.find((item) => item.id === selectedPracticeId) ?? practice;

  const activeTotals = useMemo(() => {
    if (!data || !practice) return { pitches: 0, swings: 0, pitchers: 0, hitters: 0, players: 0 };
    return {
      pitches: practicePitchEvents(data, practice.id).length,
      swings: practiceHittingEvents(data, practice.id).filter((event) => event.action !== "Took pitch").length,
      pitchers: new Set(data.pitchingSessions.filter((session) => session.practiceId === practice.id).map((session) => session.pitcherId)).size || practice.pitcherIds.length,
      hitters: new Set(data.hittingSessions.filter((session) => session.practiceId === practice.id).map((session) => session.hitterId)).size || practice.hitterIds.length,
      players: practice.playerIds.length,
    };
  }, [data, practice]);

  const visiblePlayers = useMemo(() => {
    if (!data) return [];
    const normalized = query.trim().toLowerCase();
    return sortPlayersByRecent(data.players, data.settings.recentPlayerIds)
      .filter((player) => !player.archived)
      .filter((player) => {
        if (playerFilter === "pitchers") return player.isPitcher;
        if (playerFilter === "hitters") return player.isHitter;
        if (playerFilter !== "all") return player.primaryPosition === playerFilter || player.secondaryPosition === playerFilter;
        return true;
      })
      .filter((player) =>
        normalized
          ? player.name.toLowerCase().includes(normalized) ||
            String(player.jerseyNumber).includes(normalized) ||
            player.primaryPosition.toLowerCase().includes(normalized)
          : true,
      );
  }, [data, playerFilter, query]);

  if (!data) {
    return (
      <main className="loading-shell">
        <img src="/brand/metrolina-warriors-alpha.png" alt="Metrolina Warriors" />
        <span>Loading Metrolina Fall Ball</span>
      </main>
    );
  }

  const pitcher = data.players.find((player) => player.id === selectedPitcherId) ?? data.players.find((player) => player.isPitcher) ?? data.players[0];
  const hitter = data.players.find((player) => player.id === selectedHitterId) ?? data.players.find((player) => player.isHitter) ?? data.players[0];
  const currentPitchSession = findActivePitchingSession(data, selectedPitcherId, pitchStation);
  const currentHitSession = findActiveHittingSession(data, selectedHitterId, hittingStation);
  const currentPitchEvents = currentPitchSession ? data.pitchEvents.filter((event) => event.sessionId === currentPitchSession.id) : [];
  const currentHitEvents = currentHitSession ? data.hittingEvents.filter((event) => event.sessionId === currentHitSession.id) : [];
  const currentPitchStats = calculatePitchingStats(currentPitchEvents);
  const currentHitStats = calculateHittingStats(currentHitEvents);
  const currentCount = currentPitchEvents.at(-1)?.countAfter ?? { balls: 0, strikes: 0 };

  function updateData(updater: (current: AppData) => AppData) {
    setData((current) => (current ? updater(current) : current));
  }

  function selectPlayer(playerId: ID, destination: ViewKey = "profile") {
    updateData((current) => touchRecentPlayers(current, playerId));
    setSelectedPlayerId(playerId);
    const player = data.players.find((item) => item.id === playerId);
    if (player?.isPitcher) setSelectedPitcherId(playerId);
    if (player?.isHitter) setSelectedHitterId(playerId);
    setView(destination);
  }

  function toggleTheme() {
    updateData((current) => ({
      ...current,
      settings: {
        ...current.settings,
        theme: current.settings.theme === "dark" ? "light" : "dark",
      },
    }));
  }

  function handleStartPractice(input: PracticeDraft) {
    const now = new Date().toISOString();
    const practiceId = createId("practice");
    const newPractice: Practice = {
      id: practiceId,
      date: input.date,
      name: input.name,
      type: input.type,
      location: input.location,
      notes: input.notes,
      playerIds: input.playerIds,
      pitcherIds: input.pitcherIds,
      hitterIds: input.hitterIds,
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    updateData((current) => ({
      ...current,
      practices: [newPractice, ...current.practices],
      attendance: [
        ...input.playerIds.map((playerId) => ({
          id: createId("att"),
          practiceId,
          playerId,
          role: input.pitcherIds.includes(playerId) && input.hitterIds.includes(playerId) ? "Two-way" : input.pitcherIds.includes(playerId) ? "Pitcher" : "Hitter",
          checkedInAt: now,
        })),
        ...current.attendance,
      ],
      settings: {
        ...current.settings,
        activePracticeId: practiceId,
      },
    }));
    setSelectedPracticeId(practiceId);
    setSelectedPitcherId(input.pitcherIds[0] ?? input.playerIds[0]);
    setSelectedHitterId(input.hitterIds[0] ?? input.playerIds[0]);
    setPracticeModalOpen(false);
    setView("active");
  }

  function logPitch(kind: "Ball" | "Called Strike" | "Whiff" | "Foul" | "GB" | "LD" | "FB" | "HBP") {
    updateData((current) => {
      const active = activePractice(current);
      if (!active) return current;
      const { next, session } = ensurePitchingSession(current, active, selectedPitcherId, pitchStation, selectedHitterId);
      const sessionEvents = next.pitchEvents.filter((event) => event.sessionId === session.id);
      const countBefore = sessionEvents.at(-1)?.countAfter ?? { balls: 0, strikes: 0 };
      const outcome = pitchOutcomeFromQuick(kind);
      const isBallInPlay = outcome === "Ball in play";
      const battedBall = battedBallFromQuick(kind);
      const countAfter = advanceCount(countBefore, outcome, battedBall);
      const event: PitchEvent = {
        id: createId("pitch"),
        practiceId: active.id,
        sessionId: session.id,
        pitcherId: selectedPitcherId,
        hitterId: pitchStation === "Live BP" ? selectedHitterId : undefined,
        pitchNumber: sessionEvents.length + 1,
        pitchType: selectedPitchType,
        outcome,
        isStrike: outcome !== "Ball" && outcome !== "HBP",
        isSwing: ["Whiff", "Foul", "Ball in play"].includes(outcome),
        isZone: pitchLocation.x >= 0.22 && pitchLocation.x <= 0.78 && pitchLocation.y >= 0.18 && pitchLocation.y <= 0.82,
        isChase: ["Whiff", "Foul", "Ball in play"].includes(outcome) && !(pitchLocation.x >= 0.22 && pitchLocation.x <= 0.78 && pitchLocation.y >= 0.18 && pitchLocation.y <= 0.82),
        isWhiff: outcome === "Whiff",
        isCalledStrike: outcome === "Called Strike",
        isBallInPlay,
        battedBall,
        contactQuality: isBallInPlay ? (kind === "LD" || kind === "FB" ? "Hard contact" : "Medium contact") : undefined,
        velocity: selectedVelocity,
        qualityRating: pitchQuality,
        missedIntendedLocation: missedLocation,
        intendedTarget: { x: 0.5, y: 0.5 },
        location: pitchLocation,
        countBefore,
        countAfter,
        createdAt: new Date().toISOString(),
      };
      return touchRecentPlayers(
        {
          ...next,
          pitchEvents: [...next.pitchEvents, event],
        },
        selectedPitcherId,
      );
    });
  }

  function logHitting(kind: "TAKE" | "MISS" | "FOUL" | "GB" | "LD" | "FB" | "BARREL" | "HARD") {
    updateData((current) => {
      const active = activePractice(current);
      if (!active) return current;
      const { next, session } = ensureHittingSession(current, active, selectedHitterId, hittingStation);
      const events = next.hittingEvents.filter((event) => event.sessionId === session.id);
      const inPlay = ["GB", "LD", "FB", "BARREL", "HARD"].includes(kind);
      const event: HittingEvent = {
        id: createId("hit"),
        practiceId: active.id,
        sessionId: session.id,
        hitterId: selectedHitterId,
        eventNumber: events.length + 1,
        action: kind === "TAKE" ? "Took pitch" : kind === "MISS" ? "Miss" : kind === "FOUL" ? "Foul" : "Ball in play",
        contactResult: inPlay ? (kind === "GB" ? "Ground ball" : kind === "FB" ? "Fly ball" : kind === "LD" || kind === "BARREL" || kind === "HARD" ? "Line drive" : undefined) : undefined,
        contactQuality: contactQualityFromQuick(kind),
        direction: inPlay ? direction : undefined,
        fieldLocation: inPlay ? fieldLocation : undefined,
        pitchType: hittingStation === "Machine" ? selectedPitchType : undefined,
        velocity: hittingStation === "Machine" ? selectedVelocity : undefined,
        isLiveBp: hittingStation === "Live BP",
        createdAt: new Date().toISOString(),
      };
      return touchRecentPlayers(
        {
          ...next,
          hittingEvents: [...next.hittingEvents, event],
        },
        selectedHitterId,
      );
    });
  }

  function undoPitch() {
    updateData((current) => {
      const session = findActivePitchingSession(current, selectedPitcherId, pitchStation);
      if (!session) return current;
      const sessionEvents = current.pitchEvents.filter((event) => event.sessionId === session.id);
      const last = sessionEvents.at(-1);
      if (!last) return current;
      return {
        ...current,
        pitchEvents: current.pitchEvents.filter((event) => event.id !== last.id),
      };
    });
  }

  function undoHit() {
    updateData((current) => {
      const session = findActiveHittingSession(current, selectedHitterId, hittingStation);
      if (!session) return current;
      const events = current.hittingEvents.filter((event) => event.sessionId === session.id);
      const last = events.at(-1);
      if (!last) return current;
      return {
        ...current,
        hittingEvents: current.hittingEvents.filter((event) => event.id !== last.id),
      };
    });
  }

  function endSession(type: "pitching" | "hitting", sessionId?: ID) {
    const target = sessionId ?? (type === "pitching" ? currentPitchSession?.id : currentHitSession?.id);
    if (!target) return;
    setSummary({ type, sessionId: target });
  }

  function saveSessionSummary(sessionId: ID, type: "pitching" | "hitting", note: string, grade: string) {
    const now = new Date().toISOString();
    updateData((current) => {
      if (type === "pitching") {
        return {
          ...current,
          pitchingSessions: current.pitchingSessions.map((session) =>
            session.id === sessionId ? { ...session, endedAt: now, summaryNote: note, sessionGrade: grade } : session,
          ),
        };
      }

      return {
        ...current,
        hittingSessions: current.hittingSessions.map((session) =>
          session.id === sessionId ? { ...session, endedAt: now, summaryNote: note, sessionGrade: grade } : session,
        ),
      };
    });
    setSummary(null);
  }

  function savePlayer(player: Player) {
    updateData((current) => {
      const exists = current.players.some((item) => item.id === player.id);
      return {
        ...current,
        players: exists ? current.players.map((item) => (item.id === player.id ? player : item)) : [player, ...current.players],
      };
    });
    setSelectedPlayerId(player.id);
    setPlayerModalOpen(false);
    setEditingPlayerId(undefined);
  }

  function archivePlayer(playerId: ID) {
    if (!window.confirm("Archive this player? They will be hidden from active roster screens but their history stays saved.")) return;
    updateData((current) => ({
      ...current,
      players: current.players.map((player) => (player.id === playerId ? { ...player, archived: true, updatedAt: new Date().toISOString() } : player)),
    }));
  }

  function addNote(scope: CoachNote["scope"], text: string, tags: CoachNote["tags"]) {
    if (!text.trim()) return;
    const now = new Date().toISOString();
    updateData((current) => ({
      ...current,
      coachNotes: [
        {
          id: createId("note"),
          scope,
          tags,
          text: text.trim(),
          createdAt: now,
          updatedAt: now,
        },
        ...current.coachNotes,
      ],
    }));
  }

  function addGoal(playerId: ID, title: string) {
    if (!title.trim()) return;
    const now = new Date().toISOString();
    const goal: DevelopmentGoal = {
      id: createId("goal"),
      playerId,
      title: title.trim(),
      tags: ["Development Goal"],
      createdAt: now,
      updatedAt: now,
    };
    updateData((current) => ({
      ...current,
      developmentGoals: [goal, ...current.developmentGoals],
    }));
  }

  return (
    <main className="app-shell">
      <aside className="side-nav" aria-label="Primary navigation">
        <div className="brand-lockup">
          <img src="/brand/metrolina-warriors-alpha.png" alt="Metrolina Warriors" />
          <div>
            <span>Metrolina</span>
            <strong>Fall Ball Lab</strong>
          </div>
        </div>
        <nav>
          {navItems.map(({ key, label, icon: Icon }) => (
            <button key={key} className={view === key ? "active" : ""} type="button" onClick={() => setView(key)}>
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="side-nav__footer">
          <button type="button" className="ghost-button" onClick={toggleTheme}>
            {data.settings.theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            {data.settings.theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
        </div>
      </aside>

      <section className="workspace">
        <TopBar
          data={data}
          view={view}
          query={query}
          onQuery={setQuery}
          onStartPractice={() => setPracticeModalOpen(true)}
          onTheme={toggleTheme}
        />

        {view === "dashboard" && (
          <DashboardView
            data={data}
            active={practice}
            totals={activeTotals}
            onStartPractice={() => setPracticeModalOpen(true)}
            onView={(nextView) => setView(nextView)}
            onSelectPlayer={selectPlayer}
            query={query}
          />
        )}

        {view === "active" && (
          <ActivePracticeView
            practice={practice}
            totals={activeTotals}
            currentPlayer={selectedPlayer}
            players={visiblePlayers}
            onStartPractice={() => setPracticeModalOpen(true)}
            onStation={(station) => {
              if (station === "Bullpen" || station === "Live BP") {
                setPitchStation(station);
                setView("pitching");
              } else {
                setHittingStation(station);
                setView("hitting");
              }
            }}
            onSelectPlayer={(playerId) => {
              const player = data.players.find((item) => item.id === playerId);
              setSelectedPlayerId(playerId);
              if (player?.isPitcher) setSelectedPitcherId(playerId);
              if (player?.isHitter) setSelectedHitterId(playerId);
              updateData((current) => touchRecentPlayers(current, playerId));
            }}
            onLogPitch={logPitch}
            onLogHit={logHitting}
            pitchStats={currentPitchStats}
            hitStats={currentHitStats}
          />
        )}

        {view === "pitching" && (
          <PitchingView
            data={data}
            practice={practice}
            pitcher={pitcher}
            hitter={hitter}
            session={currentPitchSession}
            events={currentPitchEvents}
            stats={currentPitchStats}
            station={pitchStation}
            pitchType={selectedPitchType}
            velocity={selectedVelocity}
            quality={pitchQuality}
            missedLocation={missedLocation}
            pitchLocation={pitchLocation}
            count={currentCount}
            query={query}
            onStation={setPitchStation}
            onPitchType={setSelectedPitchType}
            onVelocity={setSelectedVelocity}
            onQuality={setPitchQuality}
            onMissedLocation={setMissedLocation}
            onLocation={setPitchLocation}
            onPitcher={(playerId) => {
              setSelectedPitcherId(playerId);
              setSelectedPlayerId(playerId);
              updateData((current) => touchRecentPlayers(current, playerId));
            }}
            onHitter={setSelectedHitterId}
            onLog={logPitch}
            onUndo={undoPitch}
            onEnd={() => endSession("pitching")}
          />
        )}

        {view === "hitting" && (
          <HittingView
            data={data}
            practice={practice}
            hitter={hitter}
            session={currentHitSession}
            events={currentHitEvents}
            stats={currentHitStats}
            station={hittingStation}
            pitchType={selectedPitchType}
            velocity={selectedVelocity}
            direction={direction}
            fieldLocation={fieldLocation}
            query={query}
            onStation={setHittingStation}
            onPitchType={setSelectedPitchType}
            onVelocity={setSelectedVelocity}
            onDirection={setDirection}
            onFieldLocation={setFieldLocation}
            onHitter={(playerId) => {
              setSelectedHitterId(playerId);
              setSelectedPlayerId(playerId);
              updateData((current) => touchRecentPlayers(current, playerId));
            }}
            onLog={logHitting}
            onUndo={undoHit}
            onEnd={() => endSession("hitting")}
          />
        )}

        {view === "players" && (
          <PlayersView
            data={data}
            players={visiblePlayers}
            filter={playerFilter}
            onFilter={setPlayerFilter}
            onAdd={() => {
              setEditingPlayerId(undefined);
              setPlayerModalOpen(true);
            }}
            onEdit={(playerId) => {
              setEditingPlayerId(playerId);
              setPlayerModalOpen(true);
            }}
            onArchive={archivePlayer}
            onSelect={selectPlayer}
          />
        )}

        {view === "profile" && selectedPlayer && (
          <ProfileView
            data={data}
            player={selectedPlayer}
            tab={profileTab}
            onTab={setProfileTab}
            onAddNote={addNote}
            onAddGoal={addGoal}
            onEdit={() => {
              setEditingPlayerId(selectedPlayer.id);
              setPlayerModalOpen(true);
            }}
          />
        )}

        {view === "history" && (
          <HistoryView
            data={data}
            selectedPractice={selectedPractice}
            onSelectPractice={(practiceId) => setSelectedPracticeId(practiceId)}
            onSelectPlayer={selectPlayer}
          />
        )}

        {view === "analytics" && <AnalyticsView data={data} onSelectPlayer={selectPlayer} />}

        {view === "settings" && (
          <SettingsView
            data={data}
            onAddPlayer={() => {
              setEditingPlayerId(undefined);
              setPlayerModalOpen(true);
            }}
            onReset={() => {
              if (!window.confirm("Reset local Metrolina sample data? This clears changes stored in this browser.")) return;
              const reset = localPracticeRepository.reset();
              setData(reset);
            }}
            onTheme={toggleTheme}
          />
        )}
      </section>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {mobileNav.map((key) => {
          const item = navItems.find((navItem) => navItem.key === key);
          if (!item) return null;
          const Icon = item.icon;
          return (
            <button key={key} className={view === key ? "active" : ""} type="button" onClick={() => setView(key)}>
              <Icon size={20} />
              <span>{item.label.replace(" Practice", "")}</span>
            </button>
          );
        })}
      </nav>

      {practiceModalOpen && <StartPracticeModal data={data} onClose={() => setPracticeModalOpen(false)} onStart={handleStartPractice} />}
      {playerModalOpen && (
        <PlayerModal
          player={editingPlayerId ? data.players.find((playerItem) => playerItem.id === editingPlayerId) : undefined}
          onClose={() => {
            setPlayerModalOpen(false);
            setEditingPlayerId(undefined);
          }}
          onSave={savePlayer}
        />
      )}
      {summary && (
        <SessionSummaryModal
          data={data}
          summary={summary}
          onClose={() => setSummary(null)}
          onSave={saveSessionSummary}
        />
      )}
    </main>
  );
}

function TopBar({
  data,
  view,
  query,
  onQuery,
  onStartPractice,
  onTheme,
}: {
  data: AppData;
  view: ViewKey;
  query: string;
  onQuery: (value: string) => void;
  onStartPractice: () => void;
  onTheme: () => void;
}) {
  return (
    <header className="top-bar">
      <div>
        <span className="eyebrow">Metrolina Fall Ball</span>
        <h1>{navItems.find((item) => item.key === view)?.label ?? "Practice Dashboard"}</h1>
      </div>
      <label className="search-box">
        <Search size={18} aria-hidden="true" />
        <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search player, #, position..." />
      </label>
      <button className="icon-button" type="button" onClick={onTheme} aria-label="Toggle light and dark mode">
        {data.settings.theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
      </button>
      <button className="primary-button" type="button" onClick={onStartPractice}>
        <Plus size={18} />
        Start New Practice
      </button>
    </header>
  );
}

function DashboardView({
  data,
  active,
  totals,
  onStartPractice,
  onView,
  onSelectPlayer,
  query,
}: {
  data: AppData;
  active?: Practice;
  totals: { pitches: number; swings: number; pitchers: number; hitters: number; players: number };
  onStartPractice: () => void;
  onView: (view: ViewKey) => void;
  onSelectPlayer: (playerId: ID, destination?: ViewKey) => void;
  query: string;
}) {
  const pitchingLeaders = buildPitchingLeaders(data, "strikePct", 16).slice(0, 4);
  const hittingLeaders = buildHittingLeaders(data, "hardHitPct", 12).slice(0, 4);
  const recentPractices = data.practices.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  const searchablePlayers = sortPlayersByRecent(data.players.filter((player) => !player.archived), data.settings.recentPlayerIds)
    .filter((player) => (query ? player.name.toLowerCase().includes(query.toLowerCase()) || String(player.jerseyNumber).includes(query) : true))
    .slice(0, 5);

  return (
    <div className="dashboard-grid">
      <section className="hero-panel">
        <div className="hero-panel__mark">
          <img src="/brand/metrolina-warriors-alpha.png" alt="" />
        </div>
        <div className="hero-panel__content">
          <span className="eyebrow">Metrolina Christian Academy</span>
          <h2>Fall practice tracking built for fast reps, not box scores.</h2>
          <p>
            Log bullpen quality, machine swings, coach BP rounds, Live BP matchups, player notes, and development trends while coaches stay on the field.
          </p>
          <div className="hero-actions">
            <button type="button" className="primary-button primary-button--large" onClick={onStartPractice}>
              <Plus size={20} />
              Start New Practice
            </button>
            <button type="button" className="secondary-button" onClick={() => onView("active")}>
              Active Console
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <div className="hero-panel__live">
          <span>Current practice</span>
          <strong>{active?.name ?? "No active practice"}</strong>
          <small>{active ? `${fullDate(active.date)} at ${active.location}` : "Create a practice to begin tracking."}</small>
        </div>
      </section>

      <section className="stat-grid stat-grid--hero">
        <StatTile label="Pitchers Today" value={totals.pitchers} sub="Throwing or queued" icon={Target} />
        <StatTile label="Hitters Today" value={totals.hitters} sub="Taking reps" icon={Crosshair} />
        <StatTile label="Pitches Logged" value={totals.pitches} sub="Current practice" icon={Gauge} accent />
        <StatTile label="Swings Logged" value={totals.swings} sub="Pitches seen and swings" icon={Activity} />
      </section>

      <section className="panel panel--wide">
        <SectionHeader eyebrow="Quick search" title="Jump straight to a player" action={<button type="button" onClick={() => onView("players")}>Roster</button>} />
        <div className="quick-player-row">
          {searchablePlayers.map((player) => (
            <button key={player.id} type="button" className="quick-player" onClick={() => onSelectPlayer(player.id)}>
              <PlayerAvatar player={player} size="sm" />
              <span>{player.name}</span>
              <small>#{player.jerseyNumber} {player.primaryPosition}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <SectionHeader eyebrow="Recent standouts" title="Practice sparks" />
        <div className="standout-list">
          <Standout player={findPlayer(data, "p-jackson-smith")} title="71% strikes" body="Fastball command held through 34-pitch bullpen." />
          <Standout player={findPlayer(data, "p-ben-parker")} title="Barrel jump" body="Best middle/oppo round of the week." />
          <Standout player={findPlayer(data, "p-daniel-moore")} title="86 mph machine" body="Quality contact climbed across velocity block." />
        </div>
      </section>

      <section className="panel">
        <SectionHeader eyebrow="Pitching leaders" title="Minimum 16 pitches" action={<button type="button" onClick={() => onView("analytics")}>All leaders</button>} />
        <LeaderList leaders={pitchingLeaders} format={(leader) => formatPct(leader.value)} onSelect={(id) => onSelectPlayer(id)} />
      </section>

      <section className="panel">
        <SectionHeader eyebrow="Hitting leaders" title="Minimum 12 swings" action={<button type="button" onClick={() => onView("analytics")}>All leaders</button>} />
        <LeaderList leaders={hittingLeaders} format={(leader) => formatPct(leader.value)} onSelect={(id) => onSelectPlayer(id)} />
      </section>

      <section className="panel">
        <SectionHeader eyebrow="Recent practices" title="Fall timeline" />
        <div className="practice-list">
          {recentPractices.map((practice) => {
            const pitches = practicePitchEvents(data, practice.id).length;
            const swings = practiceHittingEvents(data, practice.id).filter((event) => event.action !== "Took pitch").length;
            return (
              <button key={practice.id} type="button" className="practice-row" onClick={() => onView("history")}>
                <span>
                  <strong>{practice.name}</strong>
                  <small>{practice.type} - {shortDate(practice.date)}</small>
                </span>
                <em>{pitches} P / {swings} S</em>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ActivePracticeView({
  practice,
  totals,
  currentPlayer,
  players,
  onStartPractice,
  onStation,
  onSelectPlayer,
  onLogPitch,
  onLogHit,
  pitchStats,
  hitStats,
}: {
  practice?: Practice;
  totals: { pitches: number; swings: number; pitchers: number; hitters: number; players: number };
  currentPlayer?: Player;
  players: Player[];
  onStartPractice: () => void;
  onStation: (station: PracticeStation) => void;
  onSelectPlayer: (playerId: ID) => void;
  onLogPitch: (kind: "Ball" | "Called Strike" | "Whiff" | "Foul" | "GB" | "LD" | "FB" | "HBP") => void;
  onLogHit: (kind: "TAKE" | "MISS" | "FOUL" | "GB" | "LD" | "FB" | "BARREL" | "HARD") => void;
  pitchStats: ReturnType<typeof calculatePitchingStats>;
  hitStats: ReturnType<typeof calculateHittingStats>;
}) {
  if (!practice) {
    return (
      <EmptyState
        title="No active practice"
        body="Start a practice to open the on-field tracking console."
        action={<button className="primary-button" type="button" onClick={onStartPractice}><Plus size={18} />Start Practice</button>}
      />
    );
  }

  const stations: Array<{ group: string; station: PracticeStation; icon: LucideIcon; detail: string }> = [
    { group: "Pitching", station: "Bullpen", icon: Target, detail: "Pitch quality, velo, zone" },
    { group: "Pitching", station: "Live BP", icon: Shield, detail: "Pitcher vs hitter counts" },
    { group: "Hitting", station: "Machine", icon: Gauge, detail: "Velocity and location blocks" },
    { group: "Hitting", station: "Coach BP", icon: ClipboardList, detail: "Approach rounds" },
    { group: "Hitting", station: "Front Toss", icon: Crosshair, detail: "Direction and barrels" },
    { group: "Hitting", station: "Tee", icon: Layers, detail: "Fast reps, no pitch input" },
  ];

  return (
    <div className="active-layout">
      <section className="console-header">
        <div>
          <span className="eyebrow">Metrolina Fall Ball</span>
          <h2>{practice.name}</h2>
          <p>{fullDate(practice.date)} - {formatDuration(practice.startedAt, practice.endedAt)} - {practice.location}</p>
        </div>
        <div className="console-header__metrics">
          <StatTile label="Pitches" value={totals.pitches} />
          <StatTile label="Swings" value={totals.swings} />
          <StatTile label="Players Active" value={totals.players} />
        </div>
      </section>

      <section className="panel panel--wide current-player-card">
        <div className="current-player-card__identity">
          {currentPlayer && <PlayerAvatar player={currentPlayer} size="lg" />}
          <div>
            <span className="eyebrow">Current player</span>
            <h3>{currentPlayer?.name ?? "Select player"}</h3>
            <p>#{currentPlayer?.jerseyNumber} - {currentPlayer?.primaryPosition}{currentPlayer?.secondaryPosition ? ` / ${currentPlayer.secondaryPosition}` : ""} - B/T {currentPlayer?.bats}/{currentPlayer?.throws}</p>
          </div>
        </div>
        <div className="current-player-card__stats">
          <StatTile label="Pitch Strike %" value={formatPct(pitchStats.strikePct)} />
          <StatTile label="Avg Velo" value={formatNumber(pitchStats.avgVelocity, 1)} />
          <StatTile label="Hitter Contact" value={formatPct(hitStats.contactPct)} />
          <StatTile label="Hard Hit" value={formatPct(hitStats.hardHitPct)} />
        </div>
      </section>

      <section className="panel panel--wide">
        <SectionHeader eyebrow="Fast switching" title="Recent and active players" />
        <div className="player-switcher">
          {players.slice(0, 14).map((player) => (
            <button key={player.id} type="button" className={currentPlayer?.id === player.id ? "active" : ""} onClick={() => onSelectPlayer(player.id)}>
              <PlayerAvatar player={player} size="sm" compact />
              <span>{player.name.split(" ")[0]}</span>
              <small>#{player.jerseyNumber}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="station-grid">
        {stations.map(({ group, station, icon: Icon, detail }) => (
          <button key={station} className="station-card" type="button" onClick={() => onStation(station)}>
            <span>{group}</span>
            <Icon size={26} />
            <strong>{station}</strong>
            <small>{detail}</small>
          </button>
        ))}
      </section>

      <section className="panel panel--wide quick-console">
        <SectionHeader eyebrow="Quick mode" title="One-tap rep entry" />
        <div className="quick-console__groups">
          <div>
            <h3>Pitching</h3>
            <div className="event-grid event-grid--pitching">
              {[
                ["BALL", "Ball"],
                ["CALLED STRIKE", "Called Strike"],
                ["WHIFF", "Whiff"],
                ["FOUL", "Foul"],
                ["GB", "GB"],
                ["LD", "LD"],
                ["FB", "FB"],
              ].map(([label, value]) => (
                <button key={label} type="button" onClick={() => onLogPitch(value as Parameters<typeof onLogPitch>[0])}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3>Hitting</h3>
            <div className="event-grid event-grid--hitting">
              {["MISS", "FOUL", "GB", "LD", "FB", "BARREL"].map((label) => (
                <button key={label} type="button" onClick={() => onLogHit(label as Parameters<typeof onLogHit>[0])}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function PitchingView({
  data,
  practice,
  pitcher,
  hitter,
  session,
  events,
  stats,
  station,
  pitchType,
  velocity,
  quality,
  missedLocation,
  pitchLocation,
  count,
  query,
  onStation,
  onPitchType,
  onVelocity,
  onQuality,
  onMissedLocation,
  onLocation,
  onPitcher,
  onHitter,
  onLog,
  onUndo,
  onEnd,
}: {
  data: AppData;
  practice?: Practice;
  pitcher: Player;
  hitter: Player;
  session?: PitchingSession;
  events: PitchEvent[];
  stats: ReturnType<typeof calculatePitchingStats>;
  station: "Bullpen" | "Live BP";
  pitchType: PitchType;
  velocity?: number;
  quality: number;
  missedLocation: boolean;
  pitchLocation: ZonePoint;
  count: CountState;
  query: string;
  onStation: (station: "Bullpen" | "Live BP") => void;
  onPitchType: (pitchType: PitchType) => void;
  onVelocity: (value?: number) => void;
  onQuality: (value: number) => void;
  onMissedLocation: (value: boolean) => void;
  onLocation: (point: ZonePoint) => void;
  onPitcher: (playerId: ID) => void;
  onHitter: (playerId: ID) => void;
  onLog: (kind: "Ball" | "Called Strike" | "Whiff" | "Foul" | "GB" | "LD" | "FB" | "HBP") => void;
  onUndo: () => void;
  onEnd: () => void;
}) {
  const pitchers = filterPlayersForSwitcher(data, query, "pitchers");
  const hitters = filterPlayersForSwitcher(data, query, "hitters");
  const pitchMix = Object.values(stats.byPitchType).map((item, index) => ({
    label: item.pitchType,
    value: item.pitches,
    color: pitchMixColors[index % pitchMixColors.length],
  }));

  return (
    <div className="tracking-layout">
      <section className="tracking-console tracking-console--pitching">
        <div className="tracking-hero">
          <div className="tracking-hero__player">
            <PlayerAvatar player={pitcher} size="lg" />
            <div>
              <span className="eyebrow">{practice?.name ?? "Practice"} - {station}</span>
              <h2>#{pitcher.jerseyNumber} {pitcher.name}</h2>
              <p>{pitcher.throws}HP / {pitcher.primaryPosition} - Focus: {session?.focusTags.join(", ") ?? "Fastball command"}</p>
            </div>
          </div>
          <div className="count-box">
            <span>Count</span>
            <strong>{count.balls}-{count.strikes}</strong>
            <small>{station === "Live BP" ? `vs ${hitter.name}` : "Bullpen mode"}</small>
          </div>
        </div>

        <div className="stat-grid stat-grid--tracking">
          <StatTile label="Pitches" value={stats.totalPitches} icon={Gauge} accent />
          <StatTile label="Strikes" value={stats.strikes} icon={Target} />
          <StatTile label="Strike %" value={formatPct(stats.strikePct)} icon={Activity} />
          <StatTile label="Avg Velo" value={formatNumber(stats.avgVelocity, 1)} icon={Flame} />
        </div>

        <div className="tracking-main">
          <div className="zone-card">
            <SectionHeader eyebrow="Pitch location" title="Tap strike zone" />
            <StrikeZone points={events.map((event) => event.location).filter(Boolean) as ZonePoint[]} activePoint={pitchLocation} onSelect={onLocation} />
          </div>

          <div className="quick-entry-card">
            <div className="segment-row">
              {(["Bullpen", "Live BP"] as const).map((mode) => (
                <button key={mode} type="button" className={station === mode ? "active" : ""} onClick={() => onStation(mode)}>
                  {mode}
                </button>
              ))}
            </div>
            <PlayerStrip label="Pitcher" players={pitchers} activeId={pitcher.id} onSelect={onPitcher} />
            {station === "Live BP" && <PlayerStrip label="Hitter" players={hitters} activeId={hitter.id} onSelect={onHitter} />}
            <div className="pitch-type-row">
              {pitchTypes.map((type) => (
                <button key={type} type="button" className={pitchType === type ? "active" : ""} onClick={() => onPitchType(type)}>
                  {type}
                </button>
              ))}
            </div>
            <div className="tag-cloud tag-cloud--tight focus-tags" aria-label="Pitching focus tags">
              {pitchFocusTags.slice(0, 8).map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <div className="event-grid event-grid--pitching event-grid--large">
              {[
                ["BALL", "Ball"],
                ["CALLED STRIKE", "Called Strike"],
                ["WHIFF", "Whiff"],
                ["FOUL", "Foul"],
                ["GB", "GB"],
                ["LD", "LD"],
                ["FB", "FB"],
                ["HBP", "HBP"],
              ].map(([label, value]) => (
                <button key={label} type="button" onClick={() => onLog(value as Parameters<typeof onLog>[0])}>
                  {label}
                </button>
              ))}
            </div>
            <div className="control-row">
              <VelocityPad value={velocity} onChange={onVelocity} />
              <div className="quality-control">
                <span className="control-label">Pitch quality</span>
                <div>
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button key={rating} type="button" className={quality === rating ? "active" : ""} onClick={() => onQuality(rating)}>
                      {rating}
                    </button>
                  ))}
                </div>
                <label className="check-row">
                  <input type="checkbox" checked={missedLocation} onChange={(event) => onMissedLocation(event.target.checked)} />
                  Missed intended location
                </label>
              </div>
            </div>
            <div className="console-actions">
              <button type="button" className="secondary-button" onClick={onUndo}>
                <Undo2 size={18} />
                Undo Last Pitch
              </button>
              <button type="button" className="danger-button" onClick={onEnd} disabled={!events.length}>
                <StopCircle size={18} />
                End Session
              </button>
            </div>
          </div>
        </div>
      </section>

      <aside className="insight-rail">
        <section className="panel">
          <SectionHeader eyebrow="Session stats" title={session ? "Live summary" : "Ready to track"} />
          <MetricBar label="Strike %" value={stats.strikePct} />
          <MetricBar label="CSW %" value={stats.cswPct} />
          <MetricBar label="Whiff %" value={stats.whiffPct} />
          <MetricBar label="Zone %" value={stats.zonePct} />
          <MetricBar label="Hard contact" value={stats.hardContactPct} />
        </section>
        <section className="panel">
          <SectionHeader eyebrow="Pitch mix" title="Usage" />
          {pitchMix.length ? <DonutChart items={pitchMix} /> : <p className="muted">Log pitches to build mix.</p>}
        </section>
        <section className="panel">
          <SectionHeader eyebrow="Heatmap" title="Locations" />
          <Heatmap points={events.map((event) => event.location).filter(Boolean) as ZonePoint[]} />
        </section>
      </aside>
    </div>
  );
}

function HittingView({
  data,
  practice,
  hitter,
  session,
  events,
  stats,
  station,
  pitchType,
  velocity,
  direction,
  fieldLocation,
  query,
  onStation,
  onPitchType,
  onVelocity,
  onDirection,
  onFieldLocation,
  onHitter,
  onLog,
  onUndo,
  onEnd,
}: {
  data: AppData;
  practice?: Practice;
  hitter: Player;
  session?: HittingSession;
  events: HittingEvent[];
  stats: ReturnType<typeof calculateHittingStats>;
  station: HittingSession["type"];
  pitchType: PitchType;
  velocity?: number;
  direction: Direction;
  fieldLocation: ZonePoint;
  query: string;
  onStation: (station: HittingSession["type"]) => void;
  onPitchType: (pitchType: PitchType) => void;
  onVelocity: (value?: number) => void;
  onDirection: (direction: Direction) => void;
  onFieldLocation: (point: ZonePoint) => void;
  onHitter: (playerId: ID) => void;
  onLog: (kind: "TAKE" | "MISS" | "FOUL" | "GB" | "LD" | "FB" | "BARREL" | "HARD") => void;
  onUndo: () => void;
  onEnd: () => void;
}) {
  const hitters = filterPlayersForSwitcher(data, query, "hitters");
  const stations: HittingSession["type"][] = ["Tee", "Front Toss", "Machine", "Coach BP", "Live BP"];
  const fieldPoints = events.map((event) => event.fieldLocation).filter(Boolean) as ZonePoint[];

  return (
    <div className="tracking-layout">
      <section className="tracking-console tracking-console--hitting">
        <div className="tracking-hero">
          <div className="tracking-hero__player">
            <PlayerAvatar player={hitter} size="lg" />
            <div>
              <span className="eyebrow">{practice?.name ?? "Practice"} - {station}</span>
              <h2>#{hitter.jerseyNumber} {hitter.name}</h2>
              <p>{hitter.primaryPosition} - B/T {hitter.bats}/{hitter.throws} - Goals: {session?.roundGoals.join(", ") ?? "Line drives, middle field"}</p>
            </div>
          </div>
          <div className="count-box">
            <span>Round</span>
            <strong>{events.length}/{session?.plannedReps ?? "open"}</strong>
            <small>{station === "Machine" ? `${velocity ?? "--"} mph ${pitchType}` : "Quick mode"}</small>
          </div>
        </div>

        <div className="stat-grid stat-grid--tracking">
          <StatTile label="Swings" value={stats.totalSwings} icon={Activity} accent />
          <StatTile label="Contact" value={formatPct(stats.contactPct)} icon={Crosshair} />
          <StatTile label="Hard Hit" value={formatPct(stats.hardHitPct)} icon={Flame} />
          <StatTile label="Barrel" value={formatPct(stats.barrelPct)} icon={Sparkles} />
        </div>

        <div className="tracking-main">
          <div className="zone-card">
            <SectionHeader eyebrow="Spray chart" title="Tap ball flight" />
            <BaseballField points={fieldPoints} activePoint={fieldLocation} onSelect={onFieldLocation} />
          </div>

          <div className="quick-entry-card">
            <div className="segment-row segment-row--scroll">
              {stations.map((mode) => (
                <button key={mode} type="button" className={station === mode ? "active" : ""} onClick={() => onStation(mode)}>
                  {mode}
                </button>
              ))}
            </div>
            <PlayerStrip label="Hitter" players={hitters} activeId={hitter.id} onSelect={onHitter} />
            {station === "Machine" && (
              <div className="pitch-type-row">
                {pitchTypes.slice(0, 7).map((type) => (
                  <button key={type} type="button" className={pitchType === type ? "active" : ""} onClick={() => onPitchType(type)}>
                    {type}
                  </button>
                ))}
              </div>
            )}
            <div className="direction-row">
              {(["Pull", "Pull-center", "Center", "Opposite-center", "Opposite"] as Direction[]).map((item) => (
                <button key={item} type="button" className={direction === item ? "active" : ""} onClick={() => onDirection(item)}>
                  {item}
                </button>
              ))}
            </div>
            <div className="event-grid event-grid--hitting event-grid--large">
              {["MISS", "FOUL", "GB", "LD", "FB", "BARREL", "HARD", "TAKE"].map((label) => (
                <button key={label} type="button" onClick={() => onLog(label as Parameters<typeof onLog>[0])}>
                  {label}
                </button>
              ))}
            </div>
            <div className="control-row">
              <VelocityPad value={velocity} onChange={onVelocity} disabled={station !== "Machine"} />
              <div className="quality-control">
                <span className="control-label">Round goals</span>
                <div className="tag-cloud tag-cloud--tight">
                  {roundGoals.slice(0, 8).map((goal) => (
                    <span key={goal}>{goal}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="console-actions">
              <button type="button" className="secondary-button" onClick={onUndo}>
                <Undo2 size={18} />
                Undo Last Rep
              </button>
              <button type="button" className="danger-button" onClick={onEnd} disabled={!events.length}>
                <StopCircle size={18} />
                End Session
              </button>
            </div>
          </div>
        </div>
      </section>

      <aside className="insight-rail">
        <section className="panel">
          <SectionHeader eyebrow="Practice metrics" title="Round quality" />
          <MetricBar label="Contact %" value={stats.contactPct} />
          <MetricBar label="Whiff %" value={stats.whiffPct} />
          <MetricBar label="Line-drive %" value={stats.lineDrivePct} />
          <MetricBar label="Hard-hit %" value={stats.hardHitPct} />
          <MetricBar label="Barrel %" value={stats.barrelPct} />
        </section>
        <section className="panel">
          <SectionHeader eyebrow="Direction" title="Spray profile" />
          <MetricBar label="Pull" value={stats.pullPct} />
          <MetricBar label="Middle" value={stats.middlePct} />
          <MetricBar label="Opposite" value={stats.oppositePct} />
        </section>
        <section className="panel">
          <SectionHeader eyebrow="Live BP" title="Game-style stats" />
          <div className="small-stat-list">
            <span><strong>{formatDecimal(stats.liveBpAvg)}</strong> AVG</span>
            <span><strong>{formatDecimal(stats.liveBpObp)}</strong> OBP</span>
            <span><strong>{formatDecimal(stats.liveBpSlg)}</strong> SLG</span>
            <span><strong>{formatDecimal(stats.liveBpOps)}</strong> OPS</span>
          </div>
        </section>
      </aside>
    </div>
  );
}

function PlayersView({
  data,
  players,
  filter,
  onFilter,
  onAdd,
  onEdit,
  onArchive,
  onSelect,
}: {
  data: AppData;
  players: Player[];
  filter: PlayerFilter;
  onFilter: (filter: PlayerFilter) => void;
  onAdd: () => void;
  onEdit: (playerId: ID) => void;
  onArchive: (playerId: ID) => void;
  onSelect: (playerId: ID) => void;
}) {
  return (
    <div className="section-stack">
      <section className="panel panel--wide roster-header">
        <div>
          <span className="eyebrow">Roster management</span>
          <h2>{data.settings.rosterSeason} Warriors</h2>
          <p>{data.players.filter((player) => !player.archived).length} active players - {data.players.filter((player) => player.isPitcher && !player.archived).length} pitchers - {data.players.filter((player) => player.isHitter && !player.archived).length} hitters</p>
        </div>
        <button type="button" className="primary-button" onClick={onAdd}>
          <UserPlus size={18} />
          Add Player
        </button>
      </section>

      <section className="panel panel--wide">
        <div className="filter-row">
          {(["all", "pitchers", "hitters", ...positions] as PlayerFilter[]).map((item) => (
            <button key={item} type="button" className={filter === item ? "active" : ""} onClick={() => onFilter(item)}>
              {item === "all" ? "All" : item === "pitchers" ? "Pitchers" : item === "hitters" ? "Hitters" : item}
            </button>
          ))}
        </div>
      </section>

      <section className="player-grid">
        {players.map((player) => {
          const pitchStats = calculatePitchingStats(playerPitchEvents(data, player.id));
          const hitStats = calculateHittingStats(playerHittingEvents(data, player.id));
          return (
            <article key={player.id} className="player-card">
              <button type="button" className="player-card__main" onClick={() => onSelect(player.id)}>
                <PlayerAvatar player={player} size="lg" />
                <div>
                  <span>#{player.jerseyNumber}</span>
                  <h3>{player.name}</h3>
                  <p>{player.primaryPosition}{player.secondaryPosition ? ` / ${player.secondaryPosition}` : ""} - B/T {player.bats}/{player.throws}</p>
                </div>
              </button>
              <div className="player-card__stats">
                <span><strong>{formatPct(hitStats.hardHitPct)}</strong> Hard hit</span>
                <span><strong>{formatPct(pitchStats.strikePct)}</strong> Strike</span>
              </div>
              <div className="player-card__actions">
                <button type="button" onClick={() => onEdit(player.id)}><Edit3 size={16} />Edit</button>
                <button type="button" onClick={() => onArchive(player.id)}><Archive size={16} />Archive</button>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function ProfileView({
  data,
  player,
  tab,
  onTab,
  onAddNote,
  onAddGoal,
  onEdit,
}: {
  data: AppData;
  player: Player;
  tab: "overview" | "hitting" | "pitching" | "practices" | "notes";
  onTab: (tab: "overview" | "hitting" | "pitching" | "practices" | "notes") => void;
  onAddNote: (scope: CoachNote["scope"], text: string, tags: CoachNote["tags"]) => void;
  onAddGoal: (playerId: ID, title: string) => void;
  onEdit: () => void;
}) {
  const [noteText, setNoteText] = useState("");
  const [goalText, setGoalText] = useState("");
  const pitchEvents = playerPitchEvents(data, player.id);
  const hitEvents = playerHittingEvents(data, player.id);
  const pitchStats = calculatePitchingStats(pitchEvents);
  const hitStats = calculateHittingStats(hitEvents);
  const notes = data.coachNotes.filter((note) => noteMatchesPlayer(note, player.id));
  const goals = data.developmentGoals.filter((goal) => goal.playerId === player.id && !goal.completed);
  const attended = data.attendance.filter((item) => item.playerId === player.id).length;
  const playerPractices = data.practices.filter((practice) => practice.playerIds.includes(player.id));
  const hittingTrend = trendByPractice(data.practices, hitEvents, (events) => calculateHittingStats(events).hardHitPct);
  const pitchingTrend = trendByPractice(data.practices, pitchEvents, (events) => calculatePitchingStats(events).strikePct);
  const pitchMix = Object.values(pitchStats.byPitchType).map((item, index) => ({
    label: item.pitchType,
    value: item.pitches,
    color: pitchMixColors[index % pitchMixColors.length],
  }));

  return (
    <div className="section-stack">
      <section className="profile-header">
        <div className="profile-header__bg">
          <img src="/brand/metrolina-baseball-alpha.png" alt="" />
        </div>
        <div className="profile-header__identity">
          <PlayerAvatar player={player} size="xl" />
          <div>
            <span className="eyebrow">Player profile</span>
            <h2>#{player.jerseyNumber} {player.name}</h2>
            <p>{player.primaryPosition}{player.secondaryPosition ? ` / ${player.secondaryPosition}` : ""} - Bats {player.bats} - Throws {player.throws} - {player.graduationYear}</p>
          </div>
        </div>
        <button type="button" className="secondary-button" onClick={onEdit}>
          <Edit3 size={18} />
          Edit Player
        </button>
      </section>

      <section className="profile-tabs">
        {(["overview", "hitting", "pitching", "practices", "notes"] as const).map((item) => (
          <button key={item} type="button" className={tab === item ? "active" : ""} onClick={() => onTab(item)}>
            {item}
          </button>
        ))}
        <select aria-label="Filter player profile range" defaultValue="all">
          <option value="all">All Fall</option>
          <option value="30">Last 30 Days</option>
          <option value="10">Last 10 Practices</option>
          <option value="custom">Custom Date Range</option>
        </select>
      </section>

      {tab === "overview" && (
        <div className="profile-grid">
          <section className="stat-grid stat-grid--hero">
            <StatTile label="Attendance" value={attended} sub="Fall practices" icon={CalendarDays} />
            <StatTile label="Recent Sessions" value={pitchStats.totalPitches + hitStats.totalSwings} sub="Total reps logged" icon={Activity} />
            <StatTile label="Best Recent" value={player.isPitcher ? formatPct(pitchStats.strikePct) : formatPct(hitStats.hardHitPct)} sub={player.isPitcher ? "Strike rate" : "Hard-hit rate"} icon={Trophy} accent />
            <StatTile label="Development Focus" value={goals.length} sub="Active goals" icon={Sparkles} />
          </section>
          <section className="panel">
            <SectionHeader eyebrow="Performance trend" title="Recent form" />
            <MiniLineChart values={(player.isPitcher ? pitchingTrend : hittingTrend).map((item) => item.value)} labels={(player.isPitcher ? pitchingTrend : hittingTrend).map((item) => item.label)} />
          </section>
          <section className="panel">
            <SectionHeader eyebrow="Current focus" title="Development goals" />
            <ol className="goal-list">
              {goals.map((goal) => (
                <li key={goal.id}>{goal.title}</li>
              ))}
            </ol>
            <form
              className="inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                onAddGoal(player.id, goalText);
                setGoalText("");
              }}
            >
              <input value={goalText} onChange={(event) => setGoalText(event.target.value)} placeholder="Add development focus..." />
              <button type="submit"><Plus size={16} />Add</button>
            </form>
          </section>
          <section className="panel">
            <SectionHeader eyebrow="Coach notes" title="Latest" />
            <NoteList notes={notes.slice(0, 4)} />
          </section>
        </div>
      )}

      {tab === "hitting" && (
        <div className="profile-grid">
          <section className="stat-grid stat-grid--hero">
            <StatTile label="Swings" value={hitStats.totalSwings} icon={Activity} />
            <StatTile label="Contact" value={formatPct(hitStats.contactPct)} icon={Crosshair} />
            <StatTile label="Hard-hit" value={formatPct(hitStats.hardHitPct)} icon={Flame} accent />
            <StatTile label="Live BP OPS" value={formatDecimal(hitStats.liveBpOps)} icon={BarChart3} />
          </section>
          <section className="panel">
            <SectionHeader eyebrow="Trend" title="Hard-hit %" />
            <MiniLineChart values={hittingTrend.map((item) => item.value)} labels={hittingTrend.map((item) => item.label)} />
          </section>
          <section className="panel">
            <SectionHeader eyebrow="Spray" title="Batted balls" />
            <BaseballField points={hitEvents.map((event) => event.fieldLocation).filter(Boolean) as ZonePoint[]} />
          </section>
          <section className="panel">
            <SectionHeader eyebrow="Distribution" title="Batted-ball profile" />
            <MetricBar label="Line drives" value={hitStats.lineDrivePct} />
            <MetricBar label="Ground balls" value={hitStats.groundBallPct} />
            <MetricBar label="Fly balls" value={hitStats.flyBallPct} />
            <MetricBar label="Barrels" value={hitStats.barrelPct} />
          </section>
        </div>
      )}

      {tab === "pitching" && (
        <div className="profile-grid">
          <section className="stat-grid stat-grid--hero">
            <StatTile label="Pitches" value={pitchStats.totalPitches} icon={Gauge} />
            <StatTile label="Strike %" value={formatPct(pitchStats.strikePct)} icon={Target} accent />
            <StatTile label="CSW %" value={formatPct(pitchStats.cswPct)} icon={Activity} />
            <StatTile label="Max Velo" value={formatNumber(pitchStats.maxVelocity, 1)} icon={Flame} />
          </section>
          <section className="panel">
            <SectionHeader eyebrow="Trend" title="Strike %" />
            <MiniLineChart values={pitchingTrend.map((item) => item.value)} labels={pitchingTrend.map((item) => item.label)} />
          </section>
          <section className="panel">
            <SectionHeader eyebrow="Pitch mix" title="Usage" />
            {pitchMix.length ? <DonutChart items={pitchMix} /> : <p className="muted">No pitches logged.</p>}
          </section>
          <section className="panel">
            <SectionHeader eyebrow="Location" title="Heatmap" />
            <Heatmap points={pitchEvents.map((event) => event.location).filter(Boolean) as ZonePoint[]} />
          </section>
        </div>
      )}

      {tab === "practices" && (
        <section className="panel panel--wide">
          <SectionHeader eyebrow="Practice participation" title={`${playerPractices.length} practices`} />
          <div className="practice-list">
            {playerPractices.map((practice) => (
              <div key={practice.id} className="practice-row practice-row--static">
                <span>
                  <strong>{practice.name}</strong>
                  <small>{practice.type} - {fullDate(practice.date)} - {practice.location}</small>
                </span>
                <em>{practicePitchEvents(data, practice.id).filter((event) => event.pitcherId === player.id).length} P / {practiceHittingEvents(data, practice.id).filter((event) => event.hitterId === player.id).length} H</em>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "notes" && (
        <section className="panel panel--wide notes-panel">
          <SectionHeader eyebrow="Player development notes" title="Coach notebook" />
          <form
            className="note-composer"
            onSubmit={(event) => {
              event.preventDefault();
              onAddNote({ type: "Player", playerId: player.id }, noteText, ["Development Goal"]);
              setNoteText("");
            }}
          >
            <textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Add mechanics, approach, timing, confidence, or development note..." />
            <div>
              <div className="tag-cloud">
                {noteTags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <button type="submit" className="primary-button"><Save size={18} />Save Note</button>
            </div>
          </form>
          <NoteList notes={notes} />
        </section>
      )}
    </div>
  );
}

function HistoryView({
  data,
  selectedPractice,
  onSelectPractice,
  onSelectPlayer,
}: {
  data: AppData;
  selectedPractice?: Practice;
  onSelectPractice: (practiceId: ID) => void;
  onSelectPlayer: (playerId: ID) => void;
}) {
  const [filter, setFilter] = useState<PracticeType | "All">("All");
  const practices = data.practices
    .filter((practice) => (filter === "All" ? true : practice.type === filter))
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));
  const practice = selectedPractice ?? practices[0];

  return (
    <div className="history-layout">
      <section className="panel history-list">
        <SectionHeader eyebrow="Practice history" title="Timeline" />
        <select value={filter} onChange={(event) => setFilter(event.target.value as PracticeType | "All")}>
          <option value="All">All practice types</option>
          {practiceTypes.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        <div className="practice-list">
          {practices.map((item) => (
            <button key={item.id} type="button" className={`practice-row ${practice?.id === item.id ? "active" : ""}`} onClick={() => onSelectPractice(item.id)}>
              <span>
                <strong>{item.name}</strong>
                <small>{item.type} - {fullDate(item.date)}</small>
              </span>
              <em>{item.playerIds.length} players</em>
            </button>
          ))}
        </div>
      </section>
      <section className="panel panel--wide practice-detail">
        {practice ? (
          <>
            <SectionHeader eyebrow={practice.type} title={practice.name} />
            <p className="muted"><MapPin size={15} /> {practice.location} - {formatDuration(practice.startedAt, practice.endedAt)}</p>
            <div className="stat-grid stat-grid--hero">
              <StatTile label="Players" value={practice.playerIds.length} icon={Users} />
              <StatTile label="Pitches" value={practicePitchEvents(data, practice.id).length} icon={Target} />
              <StatTile label="Swings" value={practiceHittingEvents(data, practice.id).filter((event) => event.action !== "Took pitch").length} icon={Activity} />
              <StatTile label="Notes" value={data.coachNotes.filter((note) => note.scope.type === "Practice" && note.scope.practiceId === practice.id).length} icon={ClipboardList} />
            </div>
            <div className="practice-detail__players">
              {practice.playerIds.slice(0, 12).map((playerId) => {
                const player = findPlayer(data, playerId);
                if (!player) return null;
                return (
                  <button key={playerId} type="button" onClick={() => onSelectPlayer(playerId)}>
                    <PlayerAvatar player={player} size="sm" compact />
                    <span>{player.name}</span>
                  </button>
                );
              })}
            </div>
            <div className="practice-detail__sessions">
              <SessionRows data={data} practice={practice} />
            </div>
          </>
        ) : (
          <EmptyState title="No practice selected" body="Choose a practice from the timeline to inspect its logged sessions." />
        )}
      </section>
    </div>
  );
}

function AnalyticsView({ data, onSelectPlayer }: { data: AppData; onSelectPlayer: (playerId: ID) => void }) {
  const hittingHard = buildHittingLeaders(data, "hardHitPct", 12).slice(0, 5);
  const hittingBarrel = buildHittingLeaders(data, "barrelPct", 12).slice(0, 5);
  const hittingContact = buildHittingLeaders(data, "contactPct", 12).slice(0, 5);
  const pitchingStrike = buildPitchingLeaders(data, "strikePct", 16).slice(0, 5);
  const pitchingCsw = buildPitchingLeaders(data, "cswPct", 16).slice(0, 5);
  const pitchingWhiff = buildPitchingLeaders(data, "whiffPct", 16).slice(0, 5);
  const attendanceLeaders = data.players
    .filter((player) => !player.archived)
    .map((player) => ({
      playerId: player.id,
      name: player.name,
      value: data.attendance.filter((attendance) => attendance.playerId === player.id).length,
      sample: data.attendance.filter((attendance) => attendance.playerId === player.id).length,
      label: "Practices",
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return (
    <div className="analytics-grid">
      <section className="analytics-hero panel panel--wide">
        <div>
          <span className="eyebrow">Analytics and leaderboards</span>
          <h2>Useful leaderboards with sample-size guardrails.</h2>
          <p>Rankings require meaningful minimum samples so coaches do not overreact to tiny practice bursts.</p>
        </div>
        <div className="sample-rules">
          <span>Hitting leaders: min 12 swings</span>
          <span>Pitching leaders: min 16 pitches</span>
          <span>Live BP game-style stats stay separate</span>
        </div>
      </section>
      <LeaderPanel title="Hard-hit %" leaders={hittingHard} format={(leader) => formatPct(leader.value)} onSelect={onSelectPlayer} />
      <LeaderPanel title="Barrel %" leaders={hittingBarrel} format={(leader) => formatPct(leader.value)} onSelect={onSelectPlayer} />
      <LeaderPanel title="Contact %" leaders={hittingContact} format={(leader) => formatPct(leader.value)} onSelect={onSelectPlayer} />
      <LeaderPanel title="Strike %" leaders={pitchingStrike} format={(leader) => formatPct(leader.value)} onSelect={onSelectPlayer} />
      <LeaderPanel title="CSW %" leaders={pitchingCsw} format={(leader) => formatPct(leader.value)} onSelect={onSelectPlayer} />
      <LeaderPanel title="Whiff %" leaders={pitchingWhiff} format={(leader) => formatPct(leader.value)} onSelect={onSelectPlayer} />
      <LeaderPanel title="Practice attendance" leaders={attendanceLeaders} format={(leader) => `${leader.value}`} onSelect={onSelectPlayer} />
      <section className="panel">
        <SectionHeader eyebrow="Reps by player" title="Workload balance" />
        {data.players.slice(0, 7).map((player) => (
          <MetricBar key={player.id} label={player.name} value={playerPitchEvents(data, player.id).length + playerHittingEvents(data, player.id).length} max={90} helper={`${playerPitchEvents(data, player.id).length + playerHittingEvents(data, player.id).length} reps`} />
        ))}
      </section>
      <section className="panel">
        <SectionHeader eyebrow="Most improved" title="Coach watchlist" />
        <div className="standout-list">
          <Standout player={findPlayer(data, "p-daniel-moore")} title="+18% hard-hit" body="Velocity machine rounds are trending up." />
          <Standout player={findPlayer(data, "p-mason-lee")} title="+11% zone" body="Changeup confidence is carrying into Live BP." />
          <Standout player={findPlayer(data, "p-tyler-adams")} title="Lowest whiff" body="Contact profile remains the roster baseline." />
        </div>
      </section>
    </div>
  );
}

function SettingsView({
  data,
  onAddPlayer,
  onReset,
  onTheme,
}: {
  data: AppData;
  onAddPlayer: () => void;
  onReset: () => void;
  onTheme: () => void;
}) {
  return (
    <div className="settings-grid">
      <section className="panel panel--wide">
        <SectionHeader eyebrow="Local data" title="Browser storage now, database-ready later" />
        <p className="muted">
          Roster, practices, sessions, individual pitch and swing events, notes, and settings are persisted locally through a repository layer. The UI is not coupled directly to browser storage.
        </p>
        <div className="settings-actions">
          <button type="button" className="primary-button" onClick={onAddPlayer}><UserPlus size={18} />Add Player</button>
          <button type="button" className="secondary-button" onClick={onTheme}><Moon size={18} />Toggle Theme</button>
          <button type="button" className="danger-button" onClick={onReset}><RefreshCw size={18} />Reset Local Sample Data</button>
        </div>
      </section>
      <section className="panel">
        <SectionHeader eyebrow="Data model" title="Stored records" />
        <div className="small-stat-list small-stat-list--stack">
          <span><strong>{data.players.length}</strong> Players</span>
          <span><strong>{data.practices.length}</strong> Practices</span>
          <span><strong>{data.pitchingSessions.length}</strong> Pitching sessions</span>
          <span><strong>{data.pitchEvents.length}</strong> Pitch events</span>
          <span><strong>{data.hittingSessions.length}</strong> Hitting sessions</span>
          <span><strong>{data.hittingEvents.length}</strong> Hitting events</span>
          <span><strong>{data.coachNotes.length}</strong> Coach notes</span>
          <span><strong>{data.developmentGoals.length}</strong> Development goals</span>
        </div>
      </section>
      <section className="panel">
        <SectionHeader eyebrow="Roster roles" title="Fall setup" />
        <MetricBar label="Pitchers" value={data.players.filter((player) => player.isPitcher && !player.archived).length} max={data.players.length} helper={`${data.players.filter((player) => player.isPitcher && !player.archived).length}`} />
        <MetricBar label="Hitters" value={data.players.filter((player) => player.isHitter && !player.archived).length} max={data.players.length} helper={`${data.players.filter((player) => player.isHitter && !player.archived).length}`} />
        <MetricBar label="Two-way players" value={data.players.filter((player) => player.isPitcher && player.isHitter && !player.archived).length} max={data.players.length} helper={`${data.players.filter((player) => player.isPitcher && player.isHitter && !player.archived).length}`} />
      </section>
    </div>
  );
}

function SectionHeader({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="section-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function PlayerStrip({ label, players, activeId, onSelect }: { label: string; players: Player[]; activeId: ID; onSelect: (playerId: ID) => void }) {
  return (
    <div className="player-strip">
      <span>{label}</span>
      <div>
        {players.slice(0, 10).map((player) => (
          <button key={player.id} type="button" className={activeId === player.id ? "active" : ""} onClick={() => onSelect(player.id)}>
            <PlayerAvatar player={player} size="sm" compact />
            <strong>{player.name.split(" ")[0]}</strong>
            <small>#{player.jerseyNumber}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function VelocityPad({ value, onChange, disabled = false }: { value?: number; onChange: (value?: number) => void; disabled?: boolean }) {
  const quick = [72, 76, 80, 82, 84, 86, 88, 90];

  return (
    <div className={`velocity-pad ${disabled ? "velocity-pad--disabled" : ""}`}>
      <span className="control-label">Velocity</span>
      <strong>{value ? `${value} MPH` : "Blank"}</strong>
      <div>
        {quick.map((speed) => (
          <button key={speed} type="button" disabled={disabled} className={value === speed ? "active" : ""} onClick={() => onChange(speed)}>
            {speed}
          </button>
        ))}
        <button type="button" disabled={disabled} onClick={() => onChange(value ? value + 1 : 80)}>+1</button>
        <button type="button" disabled={disabled} onClick={() => onChange(value ? Math.max(40, value - 1) : 80)}>-1</button>
        <button type="button" disabled={disabled} onClick={() => onChange(undefined)}>Blank</button>
      </div>
    </div>
  );
}

function StartPracticeModal({ data, onClose, onStart }: { data: AppData; onClose: () => void; onStart: (input: PracticeDraft) => void }) {
  const today = "2026-08-08";
  const [date, setDate] = useState(today);
  const [name, setName] = useState("Aug 8 Fall Practice");
  const [type, setType] = useState<PracticeType>("Full Practice");
  const [location, setLocation] = useState("Metrolina Varsity Field");
  const [notes, setNotes] = useState("");
  const activePlayers = data.players.filter((player) => !player.archived);
  const [playerIds, setPlayerIds] = useState<ID[]>(activePlayers.map((player) => player.id));
  const [pitcherIds, setPitcherIds] = useState<ID[]>(activePlayers.filter((player) => player.isPitcher).map((player) => player.id));
  const [hitterIds, setHitterIds] = useState<ID[]>(activePlayers.filter((player) => player.isHitter).map((player) => player.id));

  function toggle(list: ID[], setter: (value: ID[]) => void, id: ID) {
    setter(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal practice-modal" role="dialog" aria-modal="true" aria-labelledby="start-practice-title">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close start practice">
          <X size={20} />
        </button>
        <span className="eyebrow">Start practice flow</span>
        <h2 id="start-practice-title">Create a practice</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onStart({ date, name, type, location, notes, playerIds, pitcherIds, hitterIds });
          }}
        >
          <div className="form-grid">
            <label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
            <label>Practice name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label>Practice type<select value={type} onChange={(event) => setType(event.target.value as PracticeType)}>{practiceTypes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label>Location<input value={location} onChange={(event) => setLocation(event.target.value)} /></label>
          </div>
          <label>Optional notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Station plan, goals, weather, reminders..." /></label>
          <div className="modal-player-select">
            <h3>Players attending</h3>
            <div>
              {activePlayers.map((player) => (
                <button key={player.id} type="button" className={playerIds.includes(player.id) ? "active" : ""} onClick={() => toggle(playerIds, setPlayerIds, player.id)}>
                  <PlayerAvatar player={player} size="sm" compact />
                  {player.name}
                </button>
              ))}
            </div>
          </div>
          <div className="form-grid form-grid--roles">
            <div className="modal-player-select">
              <h3>Pitchers throwing</h3>
              <div>
                {activePlayers.filter((player) => player.isPitcher).map((player) => (
                  <button key={player.id} type="button" className={pitcherIds.includes(player.id) ? "active" : ""} onClick={() => toggle(pitcherIds, setPitcherIds, player.id)}>
                    #{player.jerseyNumber} {player.name.split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-player-select">
              <h3>Hitters participating</h3>
              <div>
                {activePlayers.filter((player) => player.isHitter).map((player) => (
                  <button key={player.id} type="button" className={hitterIds.includes(player.id) ? "active" : ""} onClick={() => toggle(hitterIds, setHitterIds, player.id)}>
                    #{player.jerseyNumber} {player.name.split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-button"><Plus size={18} />Create Active Practice</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function PlayerModal({ player, onClose, onSave }: { player?: Player; onClose: () => void; onSave: (player: Player) => void }) {
  const now = new Date().toISOString();
  const [draft, setDraft] = useState<Player>(
    player ?? {
      id: createId("player"),
      name: "",
      jerseyNumber: 0,
      primaryPosition: "P",
      secondaryPosition: "SS",
      bats: "R",
      throws: "R",
      graduationYear: 2028,
      avatarColor: "#9f244c",
      isPitcher: true,
      isHitter: true,
      notes: "",
      createdAt: now,
      updatedAt: now,
    },
  );

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="player-modal-title">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close player editor"><X size={20} /></button>
        <span className="eyebrow">Roster management</span>
        <h2 id="player-modal-title">{player ? "Edit player" : "Add player"}</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSave({ ...draft, updatedAt: new Date().toISOString() });
          }}
        >
          <div className="form-grid">
            <label>Name<input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
            <label>Jersey #<input type="number" value={draft.jerseyNumber} onChange={(event) => setDraft({ ...draft, jerseyNumber: Number(event.target.value) })} /></label>
            <label>Primary position<select value={draft.primaryPosition} onChange={(event) => setDraft({ ...draft, primaryPosition: event.target.value as Position })}>{positions.map((position) => <option key={position}>{position}</option>)}</select></label>
            <label>Secondary position<select value={draft.secondaryPosition} onChange={(event) => setDraft({ ...draft, secondaryPosition: event.target.value as Position })}>{positions.map((position) => <option key={position}>{position}</option>)}</select></label>
            <label>Bats<select value={draft.bats} onChange={(event) => setDraft({ ...draft, bats: event.target.value as Player["bats"] })}><option>R</option><option>L</option><option>S</option></select></label>
            <label>Throws<select value={draft.throws} onChange={(event) => setDraft({ ...draft, throws: event.target.value as Player["throws"] })}><option>R</option><option>L</option></select></label>
            <label>Grad year<input type="number" value={draft.graduationYear} onChange={(event) => setDraft({ ...draft, graduationYear: Number(event.target.value) })} /></label>
            <label>Avatar color<input type="color" value={draft.avatarColor} onChange={(event) => setDraft({ ...draft, avatarColor: event.target.value })} /></label>
          </div>
          <div className="check-grid">
            <label><input type="checkbox" checked={draft.isPitcher} onChange={(event) => setDraft({ ...draft, isPitcher: event.target.checked })} /> Pitcher</label>
            <label><input type="checkbox" checked={draft.isHitter} onChange={(event) => setDraft({ ...draft, isHitter: event.target.checked })} /> Hitter</label>
          </div>
          <label>Notes<textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-button"><Save size={18} />Save Player</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function SessionSummaryModal({
  data,
  summary,
  onClose,
  onSave,
}: {
  data: AppData;
  summary: { type: "pitching" | "hitting"; sessionId: ID };
  onClose: () => void;
  onSave: (sessionId: ID, type: "pitching" | "hitting", note: string, grade: string) => void;
}) {
  const session =
    summary.type === "pitching"
      ? data.pitchingSessions.find((item) => item.id === summary.sessionId)
      : data.hittingSessions.find((item) => item.id === summary.sessionId);
  const [note, setNote] = useState(session?.summaryNote ?? "");
  const [grade, setGrade] = useState(session?.sessionGrade ?? "A-");

  if (!session) return null;

  const isPitching = summary.type === "pitching";
  const player = findPlayer(data, isPitching ? (session as PitchingSession).pitcherId : (session as HittingSession).hitterId);
  const pitchStats = isPitching ? calculatePitchingStats(data.pitchEvents.filter((event) => event.sessionId === session.id)) : undefined;
  const hitStats = !isPitching ? calculateHittingStats(data.hittingEvents.filter((event) => event.sessionId === session.id)) : undefined;
  const pitchGroups = pitchStats ? Object.values(pitchStats.byPitchType) : [];

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal summary-modal" role="dialog" aria-modal="true" aria-labelledby="summary-title">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close session summary"><X size={20} /></button>
        <span className="eyebrow">Session summary</span>
        <h2 id="summary-title">{player?.name} - {session.type}</h2>
        {isPitching && pitchStats && (
          <>
            <div className="stat-grid stat-grid--hero">
              <StatTile label="Pitches" value={pitchStats.totalPitches} />
              <StatTile label="Strikes" value={pitchStats.strikes} sub={formatPct(pitchStats.strikePct)} accent />
              <StatTile label="Avg Velo" value={formatNumber(pitchStats.avgVelocity, 1)} />
              <StatTile label="CSW" value={formatPct(pitchStats.cswPct)} />
            </div>
            <div className="summary-breakdown">
              {pitchGroups.map((group) => (
                <div key={group.pitchType}>
                  <strong>{group.pitchType}</strong>
                  <span>{group.pitches} pitches - {formatNumber(group.minVelocity, 0)}-{formatNumber(group.maxVelocity, 0)} MPH - {formatPct(group.strikePct)} strikes</span>
                </div>
              ))}
            </div>
          </>
        )}
        {!isPitching && hitStats && (
          <div className="stat-grid stat-grid--hero">
            <StatTile label="Swings" value={hitStats.totalSwings} />
            <StatTile label="Contact" value={formatPct(hitStats.contactPct)} accent />
            <StatTile label="Hard-hit" value={formatPct(hitStats.hardHitPct)} />
            <StatTile label="Barrels" value={formatPct(hitStats.barrelPct)} />
          </div>
        )}
        <div className="form-grid">
          <label>Session grade<select value={grade} onChange={(event) => setGrade(event.target.value)}>{["A+", "A", "A-", "B+", "B", "B-", "C+", "C"].map((item) => <option key={item}>{item}</option>)}</select></label>
        </div>
        <label>Coach notes<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add final session notes before saving..." /></label>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Keep Tracking</button>
          <button type="button" className="primary-button" onClick={() => onSave(session.id, summary.type, note, grade)}><Save size={18} />Save Summary</button>
        </div>
      </section>
    </div>
  );
}

function LeaderPanel<T>({ title, leaders, format, onSelect }: { title: string; leaders: Array<{ playerId: ID; name: string; value: number; sample: number; label: string; meta?: T }>; format: (leader: { value: number }) => string; onSelect: (playerId: ID) => void }) {
  return (
    <section className="panel">
      <SectionHeader eyebrow="Leaderboard" title={title} />
      <LeaderList leaders={leaders} format={format} onSelect={onSelect} />
    </section>
  );
}

function LeaderList<T>({ leaders, format, onSelect }: { leaders: Array<{ playerId: ID; name: string; value: number; sample: number; label: string; meta?: T }>; format: (leader: { value: number }) => string; onSelect: (playerId: ID) => void }) {
  return (
    <div className="leader-list">
      {leaders.map((leader, index) => (
        <button key={`${leader.playerId}-${leader.label}`} type="button" onClick={() => onSelect(leader.playerId)}>
          <span>{index + 1}</span>
          <strong>{leader.name}</strong>
          <em>{format(leader)}<small>{leader.sample} reps</small></em>
        </button>
      ))}
      {!leaders.length && <p className="muted">No players have reached the minimum sample yet.</p>}
    </div>
  );
}

function Standout({ player, title, body }: { player?: Player; title: string; body: string }) {
  if (!player) return null;
  return (
    <div className="standout">
      <PlayerAvatar player={player} size="sm" compact />
      <span>
        <strong>{title}</strong>
        <small>{player.name} - {body}</small>
      </span>
    </div>
  );
}

function NoteList({ notes }: { notes: CoachNote[] }) {
  if (!notes.length) return <p className="muted">No notes yet.</p>;
  return (
    <div className="note-list">
      {notes.map((note) => (
        <article key={note.id}>
          <div className="tag-cloud tag-cloud--tight">
            {note.tags.map((tag) => <span key={tag}>{tag}</span>)}
          </div>
          <p>{note.text}</p>
          <small>{new Date(note.createdAt).toLocaleDateString()}</small>
        </article>
      ))}
    </div>
  );
}

function SessionRows({ data, practice }: { data: AppData; practice: Practice }) {
  const pitching = data.pitchingSessions.filter((session) => session.practiceId === practice.id);
  const hitting = data.hittingSessions.filter((session) => session.practiceId === practice.id);
  return (
    <>
      {[...pitching, ...hitting].map((session) => {
        const isPitching = "pitcherId" in session;
        const player = findPlayer(data, isPitching ? session.pitcherId : session.hitterId);
        const count = isPitching
          ? data.pitchEvents.filter((event) => event.sessionId === session.id).length
          : data.hittingEvents.filter((event) => event.sessionId === session.id).length;
        return (
          <div key={session.id} className="session-row">
            <span>
              <strong>{player?.name}</strong>
              <small>{session.type} - {isPitching ? "Pitching" : "Hitting"}</small>
            </span>
            <em>{count} reps</em>
          </div>
        );
      })}
    </>
  );
}

interface PracticeDraft {
  date: string;
  name: string;
  type: PracticeType;
  location: string;
  notes?: string;
  playerIds: ID[];
  pitcherIds: ID[];
  hitterIds: ID[];
}

function ensurePitchingSession(data: AppData, practice: Practice, pitcherId: ID, type: "Bullpen" | "Live BP", hitterId?: ID): { next: AppData; session: PitchingSession } {
  const existing = data.pitchingSessions.find((session) => session.practiceId === practice.id && session.pitcherId === pitcherId && session.type === type && !session.endedAt);
  if (existing) return { next: data, session: existing };
  const now = new Date().toISOString();
  const session: PitchingSession = {
    id: createId("ps"),
    practiceId: practice.id,
    pitcherId,
    type,
    hitterId: type === "Live BP" ? hitterId : undefined,
    focusTags: type === "Live BP" ? ["Sequencing", "Strike throwing"] : ["Fastball command", "Mechanics"],
    intendedFocus: type === "Live BP" ? "Win strike one, compete in two-strike counts." : "Repeat fastball command and track secondary feel.",
    startedAt: now,
  };
  return { next: { ...data, pitchingSessions: [...data.pitchingSessions, session] }, session };
}

function ensureHittingSession(data: AppData, practice: Practice, hitterId: ID, type: HittingSession["type"]): { next: AppData; session: HittingSession } {
  const existing = data.hittingSessions.find((session) => session.practiceId === practice.id && session.hitterId === hitterId && session.type === type && !session.endedAt);
  if (existing) return { next: data, session: existing };
  const now = new Date().toISOString();
  const session: HittingSession = {
    id: createId("hs"),
    practiceId: practice.id,
    hitterId,
    type,
    roundGoals: type === "Live BP" ? ["Two-strike", "Situational"] : ["Line drives", "Middle", "Approach"],
    plannedReps: type === "Tee" ? 20 : type === "Live BP" ? 12 : 18,
    startedAt: now,
  };
  return { next: { ...data, hittingSessions: [...data.hittingSessions, session] }, session };
}

function findActivePitchingSession(data: AppData, pitcherId: ID, type: "Bullpen" | "Live BP"): PitchingSession | undefined {
  const practice = activePractice(data);
  if (!practice) return undefined;
  return data.pitchingSessions.find((session) => session.practiceId === practice.id && session.pitcherId === pitcherId && session.type === type && !session.endedAt);
}

function findActiveHittingSession(data: AppData, hitterId: ID, type: HittingSession["type"]): HittingSession | undefined {
  const practice = activePractice(data);
  if (!practice) return undefined;
  return data.hittingSessions.find((session) => session.practiceId === practice.id && session.hitterId === hitterId && session.type === type && !session.endedAt);
}

function filterPlayersForSwitcher(data: AppData, query: string, mode: "pitchers" | "hitters"): Player[] {
  const normalized = query.trim().toLowerCase();
  return sortPlayersByRecent(data.players, data.settings.recentPlayerIds)
    .filter((player) => !player.archived)
    .filter((player) => (mode === "pitchers" ? player.isPitcher : player.isHitter))
    .filter((player) => (normalized ? player.name.toLowerCase().includes(normalized) || String(player.jerseyNumber).includes(normalized) : true));
}

function sortPlayersByRecent(players: Player[], recentIds: ID[]): Player[] {
  return players.slice().sort((a, b) => {
    const aRecent = recentIds.indexOf(a.id);
    const bRecent = recentIds.indexOf(b.id);
    if (aRecent !== -1 || bRecent !== -1) {
      if (aRecent === -1) return 1;
      if (bRecent === -1) return -1;
      return aRecent - bRecent;
    }
    return a.jerseyNumber - b.jerseyNumber;
  });
}

function findPlayer(data: AppData, playerId: ID): Player | undefined {
  return data.players.find((player) => player.id === playerId);
}

function pitchOutcomeFromQuick(kind: "Ball" | "Called Strike" | "Whiff" | "Foul" | "GB" | "LD" | "FB" | "HBP"): PitchOutcome {
  if (kind === "GB" || kind === "LD" || kind === "FB") return "Ball in play";
  return kind;
}

function battedBallFromQuick(kind: "Ball" | "Called Strike" | "Whiff" | "Foul" | "GB" | "LD" | "FB" | "HBP"): BattedBallType | undefined {
  if (kind === "GB") return "Ground ball";
  if (kind === "LD") return "Line drive";
  if (kind === "FB") return "Fly ball";
  return undefined;
}

function contactQualityFromQuick(kind: "TAKE" | "MISS" | "FOUL" | "GB" | "LD" | "FB" | "BARREL" | "HARD"): HittingContactQuality | undefined {
  if (kind === "BARREL") return "Barrel";
  if (kind === "HARD" || kind === "LD") return "Hard";
  if (kind === "GB" || kind === "FB") return "Solid";
  return undefined;
}

function advanceCount(before: CountState, outcome: PitchOutcome, battedBall?: BattedBallType): CountState {
  if (outcome === "HBP" || battedBall) return { balls: 0, strikes: 0 };
  let balls = before.balls;
  let strikes = before.strikes;
  if (outcome === "Ball") balls += 1;
  if (outcome === "Called Strike" || outcome === "Whiff") strikes += 1;
  if (outcome === "Foul" && strikes < 2) strikes += 1;
  if (balls >= 4 || strikes >= 3) return { balls: 0, strikes: 0 };
  return { balls: Math.min(balls, 3), strikes: Math.min(strikes, 2) };
}

function noteMatchesPlayer(note: CoachNote, playerId: ID): boolean {
  if (note.scope.type === "Player") return note.scope.playerId === playerId;
  if (note.scope.type === "PitchingSession" || note.scope.type === "HittingSession") return note.scope.playerId === playerId;
  return false;
}

function formatDuration(startedAt: string, endedAt?: string): string {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const minutes = Math.max(1, Math.round((end - start) / 60000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}



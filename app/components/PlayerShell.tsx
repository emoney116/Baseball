"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Home,
  CalendarDays,
  Activity,
  ChartNoAxesCombined,
  MoreHorizontal,
  Sparkles,
  LogOut,
  ClipboardList,
  Dumbbell,
  Trophy,
} from "lucide-react";
import type { PlayerSession, PlayerContext } from "../lib/playerAccess";
import type { AnalyticsDomain, AnalyticsSource, AnalyticsQuery } from "../lib/analyticsQuery";
import type { PitchType } from "../types";
import { executeAnalyticsQuery } from "../lib/analyticsQuery";
import { defaultAnalyticsMetricIds } from "../lib/analyticsCatalog";
import { AnalyticsView, ScheduleView, SectionHeader } from "./TeamWorkspaceViews";
import { PracticeHistoryTab, WeightRoomRecentWorkouts } from "./TeamTrainingViews";
import { buildWeightRoomPlayerProfile, WeightRoomAthleteOverview } from "./WeightRoomPlayerViews";
import { GameLibrary, GameScoreRibbon, PracticeWorkspaceHeader, PracticeWorkspaceSummary, WeightRoomWorkspaceHeader, type PracticeWorkspaceTab } from "./TeamFeatureLayouts";
import { PlayerAccountLinksPanel } from "./PlayerAccountLinksPanel";
import { authRepository } from "../data/supabaseRepository";
import { createClient } from "../lib/supabase/client";
import type { AskClubhouseAction, AskClubhouseApiResponse } from "../lib/askClubhouse/types";
import { AskClubhouseDrawer, AskClubhouseFab, ASK_CLUBHOUSE_GENERIC_STAGE, type AskClubhouseChatMessage } from "./AskClubhouseDrawer";
import { AnalyticsPlayerMetrics } from "./AnalyticsPlayerMetrics";
import { ClubhouseBottomNav } from "./ClubhouseBottomNav";
import { ChoiceSelect } from "./ChoiceSelect";
import { ScheduleAgendaRow } from "./ScheduleAgendaRow";
import { DensePlayerIdentity } from "./DensePlayerIdentity";
import { TeamWorkspaceHeader } from "./TeamContextHeader";
import { PlayerSelfTracking } from "./PlayerSelfTracking";
import { PlayerLiveEntry } from "./PlayerLiveEntry";
import { PLAYER_MODE_DETAILS } from "../lib/playerCapabilities";

type View = "Home" | "Schedule" | "Practice" | "Games" | "Weight Room" | "Analytics" | "More";
const VIEW_ROUTES = { Home: "teamHome", Schedule: "schedule", Practice: "practice", Games: "games", "Weight Room": "weights", Analytics: "analytics", More: "more" } as const;
const nav = [
  { name: "Home", icon: Home },
  { name: "Schedule", icon: CalendarDays },
  { name: "Practice", icon: ClipboardList },
  { name: "Games", icon: Trophy },
  { name: "More", icon: MoreHorizontal },
] as const;
const PLAYER_ASK_SUGGESTIONS = [
  { label: "How did I hit in Practice today?", icon: Activity },
  { label: "Show me my spray chart.", icon: ChartNoAxesCombined },
  { label: "How has my pitching velocity changed?", icon: Activity },
  { label: "How is my Weight Room progress?", icon: ChartNoAxesCombined },
  { label: "What should I work on?", icon: Sparkles },
  { label: "What is OPS?", icon: Sparkles },
];
export function PlayerShell({
  initialSession,
  preview = false,
  previewReply,
}: {
  initialSession: PlayerSession;
  preview?: boolean;
  previewReply?: AskClubhouseApiResponse;
}) {
  const [session, setSession] = useState(initialSession),
    [view, setView] = useState<View>(() => {
      if (typeof window === "undefined") return "Home";
      const route = new URLSearchParams(window.location.search).get("view");
      return (Object.entries(VIEW_ROUTES).find(([, value]) => value === route)?.[0] as View) ?? "Home";
    });
  const [domain, setDomain] = useState<AnalyticsDomain>("hitting"),
    [source, setSource] = useState<AnalyticsSource>("practice"),
    [pitchType, setPitchType] = useState("");
  const [ask, setAsk] = useState(false),
    [question, setQuestion] = useState(""),
    [answer, setAnswer] = useState<AskClubhouseApiResponse | null>(null),
    [asking, setAsking] = useState(false);
  const [askMessages, setAskMessages] = useState<AskClubhouseChatMessage[]>([]);
  const [askQuery, setAskQuery] = useState<Partial<AnalyticsQuery>>({});
  const [askAnalytics, setAskAnalytics] = useState<Partial<AnalyticsQuery>>({});
  const [askAllTeams, setAskAllTeams] = useState(false);
  const [analyticsRevision, setAnalyticsRevision] = useState(0);
  const [practiceTab, setPracticeTab] = useState<PracticeWorkspaceTab>("Overview");
  const [weightTab, setWeightTab] = useState<"Overview" | "Workouts" | "Progress">("Overview");
  const [selectedGameId, setSelectedGameId] = useState("");
  const askGeneration = useRef(0);
  const askInFlight = useRef(false);
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const [eventId, setEventId] = useState("");
  const generation = useRef(0),
    active = useRef(session.context);
  const contextGeneration = useRef(0);
  const refreshSession = useRef<() => void>(() => {});
  const profileId =
    session.profileId ?? initialSession.data?.teamContext?.profile?.id;
  useEffect(() => {
    active.current = session.context;
  }, [session.context]);
  useEffect(() => {
    if (preview) return;
    let cancelled = false;
    const refresh = async () => {
      const seq = ++generation.current,
        c = active.current;
      const q = new URLSearchParams(
        c
          ? {
              playerId: c.playerId,
              teamId: c.team.teamId,
              seasonId: c.team.seasonId ?? "",
              workspace: "player",
            }
          : {},
      );
      try {
        const r = await fetch(`/api/player/session?${q}`, {
            cache: "no-store",
          }),
          p = await r.json();
        if (cancelled || seq !== generation.current) return;
        if (!r.ok || p.mode !== "player")
          throw new Error(
            p.message ?? "Your account access changed. Reload to continue.",
          );
        if (p.context?.membershipId !== c?.membershipId || !p.access?.capabilities.canUseAskClubhouse) {
          contextGeneration.current++;
          setAnswer(null);
          setAskMessages([]);
          setQuestion("");
          setAsking(false);
          askInFlight.current = false;
          setAsk(false);
        }
        setSession(p);
        setError("");
      } catch (e) {
        if (cancelled || seq !== generation.current) return;
        setSession({ mode: "player", contexts: [] });
        contextGeneration.current++;
        setAnswer(null);
        setAskMessages([]);
        setAsking(false);
        askInFlight.current = false;
        setAsk(false);
        setError(
          e instanceof Error ? e.message : "Unable to verify player access.",
        );
      }
    };
    refreshSession.current = () => void refresh();
    const timer = window.setInterval(() => void refresh(), 30000);
    window.addEventListener("focus", refresh);
    const client = createClient();
    const channel = profileId
      ? client
          .channel(`player-access-${profileId}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "profile_player_links",
              filter: `profile_id=eq.${profileId}`,
            },
            () => {
              contextGeneration.current++;
              setSession((s) => ({ ...s, data: undefined }));
              setAnswer(null);
              setAskMessages([]);
              setAsking(false);
              askInFlight.current = false;
              setAsk(false);
              void refresh();
            },
          )
          .subscribe()
      : undefined;
    const { data: authListener } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        generation.current++;
        contextGeneration.current++;
        setSession({ mode: "player", contexts: [] });
        setAnswer(null);
        setAskMessages([]);
        setAsking(false);
        askInFlight.current = false;
        setAsk(false);
      }
    });
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      if (channel) void client.removeChannel(channel);
      authListener.subscription.unsubscribe();
    };
  }, [preview, profileId]);
  async function switchContext(c: PlayerContext) {
    contextGeneration.current++;
    setEventId("");
    setPitchType("");
    setAskQuery({});
    setAskAnalytics({});
    setAskAllTeams(false);
    resetAsk();
    const seq = ++generation.current;
    setLoading(true);
    setAnswer(null);
    setAsk(false);
    setError("");
    setSession((s) => ({ ...s, context: c, data: undefined }));
    try {
      if (preview) {
        setSession(initialSession);
        return;
      }
      const q = new URLSearchParams({
        playerId: c.playerId,
        teamId: c.team.teamId,
        seasonId: c.team.seasonId ?? "",
        workspace: "player",
      });
      const r = await fetch(`/api/player/session?${q}`, { cache: "no-store" }),
        p = await r.json();
      if (seq !== generation.current) return;
      if (!r.ok || p.mode !== "player")
        throw new Error(p.message ?? "Unable to switch player context.");
      setSession(p);
      const url = new URL(window.location.href);
      url.searchParams.set("player", c.playerId);
      url.searchParams.set("team", c.team.teamId);
      url.searchParams.set("season", c.team.seasonId ?? "");
      url.searchParams.set("workspace", "player");
      window.history.replaceState(null, "", url);
    } catch (e) {
      if (seq === generation.current) {
        setSession({ mode: "player", contexts: [] });
        setError(e instanceof Error ? e.message : "Unable to switch context.");
      }
    } finally {
      setLoading(false);
    }
  }
  const { context, data } = session;
  function navigate(next: View) {
    setView(next);
    setEventId("");
    setAskQuery({});
    setAnalyticsRevision(0);
    if (next === "Practice") { setDomain("hitting"); setSource("practice"); setPracticeTab("Overview"); }
    if (next === "Weight Room") { setDomain("development"); setSource("all"); setWeightTab("Overview"); }
    if (next === "Games") { setDomain("hitting"); setSource("games"); }
    const url = new URL(window.location.href);
    url.searchParams.set("workspace", "player");
    url.searchParams.set("view", VIEW_ROUTES[next]);
    for (const key of ["domain", "source", "period", "start", "end", "analyticsWorkspace", "event", "events"]) url.searchParams.delete(key);
    window.history.replaceState(null, "", url);
  }
  const activePractice = data?.practices.find(practice => !practice.endedAt);
  const ownPlayer = data?.players.find(player => player.id === context?.playerId);
  const weightProfile = useMemo(() => data && ownPlayer ? buildWeightRoomPlayerProfile(data, ownPlayer) : undefined, [data, ownPlayer]);
  const selectedGame = data?.games.find(game => game.id === selectedGameId) ?? data?.games[0];
  const analyticsScope = useMemo(() => context ? { playerId: context.playerId } : undefined, [context]);
  const analyticsSource = domain === "development" ? "all" : source;
  const initialAnalyticsQuery: Partial<AnalyticsQuery> = analyticsRevision > 0 || view === "Practice" || view === "Weight Room" || view === "Games"
    ? { ...askQuery, domain: view === "Weight Room" ? "development" : domain === "development" && view !== "Analytics" ? "hitting" : domain, source: view === "Weight Room" ? "all" : view === "Games" ? "games" : view === "Practice" ? "practice" : analyticsSource, eventIds: view === "Games" && selectedGame ? [selectedGame.id] : eventId ? [eventId] : undefined }
    : { source: typeof window !== "undefined" && new URLSearchParams(window.location.search).has("source") ? undefined : "practice" };
  const result = useMemo(
    () =>
      data && context
        ? executeAnalyticsQuery(data, {
            ...askQuery,
            domain,
            source: analyticsSource,
            metrics: defaultAnalyticsMetricIds(domain, analyticsSource),
            eventIds: eventId ? [eventId] : undefined,
            mode: "box-score",
            timeRange: askQuery.timeRange ?? "season",
            groupBy: "player",
            playerIds: [context.playerId],
            filters: { ...askQuery.filters, ...(pitchType ? { pitchTypes: [pitchType as PitchType] } : {}) },
            context: {
              teamId: context.team.teamId,
              seasonId: context.team.seasonId,
              role: "PLAYER",
            },
          })
        : null,
    [data, context, domain, analyticsSource, pitchType, eventId, askQuery],
  );
  function resetAsk() {
    askGeneration.current++;
    askInFlight.current = false;
    setAsking(false);
    setAnswer(null);
    setAskMessages([]);
    setQuestion("");
  }
  function openAskAnalytics(action: AskClubhouseAction) {
    if (!context || !session.access?.capabilities.canViewOwnAnalytics) return;
    // Only filters cross this boundary; identity always comes from the approved context.
    setAskQuery({ timeRange: action.query.timeRange, customDateRange: action.query.customDateRange, filters: action.query.filters });
    setDomain(action.query.domain);
    setSource(action.query.source);
    setPitchType(action.query.filters?.pitchTypes?.[0] ?? "");
    setEventId(action.query.eventIds?.[0] ?? "");
    setAnalyticsRevision(value => value + 1);
    setView("Analytics");
    setAsk(false);
  }
  async function askQuestion(value: string) {
    const message = value.trim();
    if (!context || !session.access?.capabilities.canUseAskClubhouse || !message || askInFlight.current) return;
    const seq = contextGeneration.current;
    const request = ++askGeneration.current;
    askInFlight.current = true;
    const pendingId = crypto.randomUUID();
    const userMessage: AskClubhouseChatMessage = { id: crypto.randomUUID(), role: "user", content: message, createdAt: new Date().toISOString() };
    const history = [...askMessages.filter(m => !m.pending), userMessage].slice(-8);
    setAskMessages(current => [...current, userMessage, { id: pendingId, role: "assistant", content: ASK_CLUBHOUSE_GENERIC_STAGE, pending: true, pendingStartedAt: Date.now() }]);
    setQuestion("");
    setAsking(true);
    try {
      if (preview && (!previewReply || process.env.NODE_ENV !== "development"))
        throw new Error("Live answers require a signed-in player account.");
      const r = preview ? new Response(JSON.stringify(previewReply)) : await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          messages: history.map(({ role, content, createdAt }) => ({ role, content, createdAt })),
          conversationId: answer?.conversationId,
          uiContext: {
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            playerId: context.playerId,
            viewerPlayerId: context.playerId,
            playerScope: askAllTeams ? "all" : "current",
            teamId: context.team.teamId,
            seasonId: context.team.seasonId,
            analytics: {
              ...askAnalytics,
              domain: askAnalytics.domain ?? domain,
              source: askAnalytics.source ?? analyticsSource,
              playerIds: [context.playerId],
              filters: askAnalytics.filters ?? (pitchType ? { pitchTypes: [pitchType] } : {}),
            },
            visualContext: answer?.visuals?.[0]
              ? {
                  type: answer.visuals[0].type,
                  mode: answer.visuals[0].mode,
                  playerId: context.playerId,
                  query: answer.visuals[0].query,
                }
              : undefined,
          },
        }),
      });
      const p: AskClubhouseApiResponse = await r.json();
      if (seq !== contextGeneration.current || request !== askGeneration.current) return;
      setAnswer(p);
      setAskMessages(current => current.map(m => m.id === pendingId ? {
        id: pendingId, role: "assistant", content: p.answer ?? p.message?.content ?? "Unable to complete that question.", createdAt: p.message?.createdAt ?? new Date().toISOString(),
        status: p.status, route: p.route, evidence: p.evidence, actions: p.actions, followUps: p.followUps, usage: p.usage, visuals: p.visuals, visualUnavailable: p.visualUnavailable,
      } : m));
    } catch (e) {
      if (seq === contextGeneration.current && request === askGeneration.current) {
        setAskMessages(current => current.map(m => m.id === pendingId ? { id: pendingId, role: "assistant", status: "failed", content: e instanceof Error ? e.message : "Unable to answer.", createdAt: new Date().toISOString() } : m));
      }
    } finally {
      if (seq === contextGeneration.current && request === askGeneration.current) {
        askInFlight.current = false;
        setAsking(false);
      }
    }
  }
  const items = data
    ? [
        ...data.practices
          .filter(
            (p) => !data.scheduleEvents.some((e) => e.practiceId === p.id),
          )
          .map((p) => ({
            id: p.id,
            title: p.name || "Practice",
            type: "Practice",
            date: p.date,
            location: p.location,
          })),
        ...data.games
          .filter((g) => !data.scheduleEvents.some((e) => e.gameId === g.id))
          .map((g) => ({
            id: g.id,
            title: `${g.homeAway === "Away" ? "at" : "vs"} ${g.opponent}`,
            type: "Game",
            date: g.date,
            location: g.location,
          })),
        ...data.scheduleEvents.map((e) => ({
          id: e.id,
          title: e.title,
          type: e.eventType,
          date: e.startAt,
          location: e.location,
        })),
      ].sort((a, b) => a.date.localeCompare(b.date))
    : [];
  const upcoming = items.filter(
    (i) => i.date.slice(0, 10) >= new Date().toISOString().slice(0, 10),
  );
  const renderMetrics = () => result && <AnalyticsPlayerMetrics result={result} row={result.rows[0]} limit={view === "Home" ? 4 : undefined} />;
  return (
    <main className="player-beta">
      {context && <TeamWorkspaceHeader context={{ ...data?.teamContext, currentTeam: context.team, availableTeams: session.contexts.map(c => c.team) }}
        view={VIEW_ROUTES[view] === "more" ? "teamHome" : VIEW_ROUTES[view]}
        onClubhouseHome={() => window.location.assign("/")}
        onSwitch={team => { const next = session.contexts.find(c => c.team.teamId === team.teamId && c.team.seasonId === team.seasonId); if (next) void switchContext(next); }}
      />}
      <div className="player-context-caption"><strong>{context ? `${context.jersey !== undefined ? `#${context.jersey} ` : ""}${context.name}` : "My Clubhouse"}</strong>{session.access && <span>{PLAYER_MODE_DETAILS[session.access.mode].label}</span>}</div>
      {session.contexts.length > 1 && (
        <ChoiceSelect className="player-beta-context" label="Player Context" value={context?.membershipId ?? ""} disabled={loading} options={session.contexts.map(c => ({ value: c.membershipId, label: c.name, description: `${c.team.teamName} · ${c.team.seasonName}` }))} onChange={value => { const c = session.contexts.find(c => c.membershipId === value); if (c) void switchContext(c); }} />
      )}
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p role="status">Loading your player context...</p>
      ) : !context ? (
        <PlayerAccountLinksPanel />
      ) : (
        data && (
          <>
            {view === "Practice" && session.access?.capabilities.canViewOwnPractice && <div className="page-stack practice-home">
              <PracticeWorkspaceHeader tab={practiceTab} onTab={setPracticeTab} />
              {practiceTab === "Overview" && <>
                <PracticeWorkspaceSummary label={activePractice ? "Current Practice" : "Practice"} title={activePractice?.name ?? "No active practice"} detail={activePractice?.location ?? "Waiting on coach to begin Practice session."} />
                {!preview && <PlayerLiveEntry key={`practice-${context.membershipId}`} membershipId={context.membershipId} excludeWorkout onSaved={() => refreshSession.current()} />}
              </>}
              {practiceTab !== "Metrics" && <PracticeHistoryTab data={data} onOpenPractice={id => { setEventId(id); setDomain("hitting"); setSource("practice"); setAnalyticsRevision(value => value + 1); setPracticeTab("Metrics"); }} />}
            </div>}
            {view === "Weight Room" && session.access?.capabilities.canViewOwnWeightRoom && <div className="page-stack weights-page weight-room-page">
              <WeightRoomWorkspaceHeader team={context.team} tab={weightTab} tabs={["Overview", "Workouts", "Progress"]} onTab={setWeightTab} />
              {weightTab === "Overview" && !preview && <PlayerLiveEntry key={`workout-${context.membershipId}`} membershipId={context.membershipId} domain="workout" onSaved={() => refreshSession.current()} />}
              {(weightTab === "Overview" || weightTab === "Progress") && ownPlayer && weightProfile && <WeightRoomAthleteOverview data={data} player={ownPlayer} profile={weightProfile} />}
              {weightTab !== "Progress" && <WeightRoomRecentWorkouts data={data} players={data.players} expanded onReview={row => { setAskQuery({ timeRange: "custom", customDateRange: { start: row.date, end: row.date } }); setAnalyticsRevision(value => value + 1); setWeightTab("Progress"); }} />}
              {weightTab === "Overview" && <PlayerSelfTracking key={context.membershipId} session={session} preview={preview} onSaved={() => switchContext(context)} />}
            </div>}
            {view === "Games" && session.access?.capabilities.canViewOwnGames && <div className="page-stack games-page player-games-page">
              <SectionHeader title="Game Center" />
              {selectedGame ? <section className="games-layout"><GameLibrary games={data.games} selectedGameId={selectedGame.id} onGame={id => { setSelectedGameId(id); setAnalyticsRevision(value => value + 1); }} /><section className="game-console"><GameScoreRibbon game={selectedGame} teamName={context.team.teamName} /></section></section> : <p>No games available for this player context.</p>}
            </div>}
            {view === "Home" && !preview && <PlayerLiveEntry key={`live-${context.membershipId}`} membershipId={context.membershipId} onSaved={() => refreshSession.current()} />}
            {view === "Home" && <PlayerSelfTracking key={context.membershipId} session={session} preview={preview} onSaved={() => switchContext(context)} />}
            {view === "Home" && (
              <>
                <section className="player-beta-section">
                  <h2>Today & Next</h2>
                  {upcoming.length ? (
                    upcoming.slice(0, 3).map((i) => (
                      <ScheduleAgendaRow key={i.id} title={i.title} time={new Date(i.date.includes("T") ? i.date : `${i.date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })} type={i.type} location={i.location} />
                    ))
                  ) : (
                    <p>No upcoming team events.</p>
                  )}
                </section>
                <section className="player-beta-section">
                  <h2>Quick Access</h2>
                  <div className="player-beta-development">
                    {(
                      [{ view: "Practice", icon: ClipboardList }, { view: "Games", icon: Trophy }, { view: "Weight Room", icon: Dumbbell }, { view: "Analytics", icon: ChartNoAxesCombined }] as const
                    ).map((item) => (
                      <button
                        key={item.view}
                        onClick={() => navigate(item.view)}
                      >
                        <item.icon size={18} />
                        {item.view}
                      </button>
                    ))}
                  </div>
                </section>
                <section className="player-beta-section">
                  <div className="player-beta-section-title">
                    <h2>Recent Performance</h2>
                    <button
                      className="ghost-button"
                      onClick={() => navigate("Analytics")}
                    >
                      My Analytics
                    </button>
                  </div>
                  <p>{result?.sourceLabel}</p>
                  {renderMetrics()}
                </section>
                <section className="player-beta-section">
                  <h2>My Goals</h2>
                  {data.developmentGoals
                    .filter((g) => !g.completed)
                    .map((g) => (
                      <p key={g.id}>{g.title}</p>
                    ))}
                  {!data.developmentGoals.some((g) => !g.completed) && (
                    <p>No current player-visible goals.</p>
                  )}
                </section>
                {data.coachNotes.length > 0 && (
                  <section className="player-beta-section">
                    <h2>Coach Feedback</h2>
                    {data.coachNotes.map((n) => (
                      <p key={n.id}>{n.text}</p>
                    ))}
                  </section>
                )}
              </>
            )}
            {view === "Schedule" && session.access?.capabilities.canViewTeamSchedule && (
              <ScheduleView data={data} onView={next => {
                navigate(next === "weights" ? "Weight Room" : next === "games" ? "Games" : "Practice");
              }} onOpenGame={gameId => {
                navigate("Games"); setSelectedGameId(gameId);
              }} />
            )}
            {(view === "Analytics" || (view === "Practice" && practiceTab === "Metrics") || (view === "Weight Room" && weightTab === "Progress") || (view === "Games" && selectedGame)) && session.access?.capabilities.canViewOwnAnalytics && (
              <AnalyticsView
                key={`${context.membershipId}:${view}:${analyticsRevision}`}
                data={data}
                playerScope={analyticsScope}
                initialQuery={initialAnalyticsQuery}
                onAsk={query => {
                  setAskAnalytics(query); setAsk(true);
                }}
              />
            )}
            {view === "More" && (
              <section className="player-beta-section">
                <div className="player-beta-development">
                  {session.access?.capabilities.canViewOwnWeightRoom && <button onClick={() => navigate("Weight Room")}><Dumbbell size={18} />Weight Room</button>}
                  {session.access?.capabilities.canViewOwnAnalytics && <button onClick={() => navigate("Analytics")}><ChartNoAxesCombined size={18} />Analytics</button>}
                </div>
                {session.access?.capabilities.canViewRoster && <><h2>Team Roster</h2>{session.teamRoster?.map(p => <div className="player-beta-item" key={p.playerId}><DensePlayerIdentity player={{ name: p.name, jerseyNumber: p.jersey ?? 0 }} showJersey={p.jersey !== undefined} /><span>{p.position}</span></div>)}</>}
                {!preview && <PlayerAccountLinksPanel />}
              </section>
            )}
          </>
        )
      )}
      {(!context || view === "More") && (
        <button
          className="ghost-button"
          onClick={() =>
            void authRepository
              .signOut()
              .then(() => window.location.assign("/"))
          }
        >
          <LogOut size={16} /> Sign Out
        </button>
      )}
      {context && session.access?.capabilities.canUseAskClubhouse && <AskClubhouseFab onClick={() => setAsk(true)} />}
      {ask && context && session.access?.capabilities.canUseAskClubhouse && (
        <AskClubhouseDrawer
          messages={askMessages}
          input={question}
          sending={asking}
          stage={ASK_CLUBHOUSE_GENERIC_STAGE}
          scopeControl={<div className="ask-scope-control"><span>Data from</span><ChoiceSelect
            aria-label="Ask Clubhouse player team scope"
            value={askAllTeams ? "all" : context.membershipId}
            options={[...session.contexts.map(c => ({ value: c.membershipId, label: c.team.teamName, description: `${c.name} · ${c.team.seasonName}` })), ...(session.contexts.length > 1 ? [{ value: "all", label: "All My Teams", description: "Your approved player contexts" }] : [])]}
            onChange={value => {
              resetAsk(); setAskAnalytics({});
              if (value === "all") { setAskAllTeams(true); return; }
              setAskAllTeams(false);
              const next = session.contexts.find(c => c.membershipId === value);
              if (next && next.membershipId !== context.membershipId) void switchContext(next).then(() => setAsk(true));
            }}
          /></div>}
          suggestions={PLAYER_ASK_SUGGESTIONS}
          includeDefaultSuggestions={false}
          onClose={() => setAsk(false)}
          onNewChat={resetAsk}
          onInput={setQuestion}
          onQuestion={(value) => void askQuestion(value)}
          onSubmit={() => void askQuestion(question)}
          onAction={openAskAnalytics}
        />
      )}
      <ClubhouseBottomNav label="Player navigation" persistent>
        {nav.map((n) => (
          <button
            key={n.name}
            aria-current={view === n.name ? "page" : undefined}
            className={view === n.name || (n.name === "More" && (view === "Weight Room" || view === "Analytics")) ? "active" : ""}
            onClick={() => navigate(n.name)}
          >
            <n.icon size={20} />
            <span>{n.name}</span>
          </button>
        ))}
      </ClubhouseBottomNav>
    </main>
  );
}

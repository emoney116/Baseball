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
  ArrowUp,
  X,
} from "lucide-react";
import type { PlayerSession, PlayerContext } from "../lib/playerAccess";
import type { AnalyticsDomain, AnalyticsSource } from "../lib/analyticsQuery";
import type { PitchType } from "../types";
import { executeAnalyticsQuery } from "../lib/analyticsQuery";
import { defaultAnalyticsMetricIds } from "../lib/analyticsCatalog";
import { ClubhouseBaseballField } from "./ClubhouseBaseballField";
import { Heatmap } from "./visuals";
import { PlayerAccountLinksPanel } from "./PlayerAccountLinksPanel";
import { authRepository } from "../data/supabaseRepository";
import { createClient } from "../lib/supabase/client";
import type { AskClubhouseApiResponse } from "../lib/askClubhouse/types";
import { BRAND_ASSETS } from "../lib/branding";

type View = "Home" | "Schedule" | "Development" | "Analytics" | "More";
const nav = [
  { name: "Home", icon: Home },
  { name: "Schedule", icon: CalendarDays },
  { name: "Development", icon: Activity },
  { name: "Analytics", icon: ChartNoAxesCombined },
  { name: "More", icon: MoreHorizontal },
] as const;
export function PlayerShell({
  initialSession,
  preview = false,
}: {
  initialSession: PlayerSession;
  preview?: boolean;
}) {
  const [session, setSession] = useState(initialSession),
    [view, setView] = useState<View>("Home");
  const [domain, setDomain] = useState<AnalyticsDomain>("hitting"),
    [source, setSource] = useState<AnalyticsSource>("practice"),
    [pitchType, setPitchType] = useState("");
  const [ask, setAsk] = useState(false),
    [question, setQuestion] = useState(""),
    [answer, setAnswer] = useState<AskClubhouseApiResponse | null>(null),
    [asking, setAsking] = useState(false);
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const [eventId, setEventId] = useState("");
  const generation = useRef(0),
    active = useRef(session.context);
  const contextGeneration = useRef(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const profileId =
    session.profileId ?? initialSession.data?.teamContext?.profile?.id;
  useEffect(() => {
    if (ask) dialog.current?.showModal();
  }, [ask]);
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
        setSession(p);
        setError("");
      } catch (e) {
        if (cancelled || seq !== generation.current) return;
        setSession({ mode: "player", contexts: [] });
        contextGeneration.current++;
        setAnswer(null);
        setAsk(false);
        setError(
          e instanceof Error ? e.message : "Unable to verify player access.",
        );
      }
    };
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
  const result = useMemo(
    () =>
      data && context
        ? executeAnalyticsQuery(data, {
            domain,
            source,
            metrics: defaultAnalyticsMetricIds(domain, source),
            eventIds: eventId ? [eventId] : undefined,
            mode: "box-score",
            timeRange: "season",
            groupBy: "player",
            playerIds: [context.playerId],
            filters: pitchType ? { pitchTypes: [pitchType as PitchType] } : {},
            context: {
              teamId: context.team.teamId,
              seasonId: context.team.seasonId,
              role: "PLAYER",
            },
          })
        : null,
    [data, context, domain, source, pitchType, eventId],
  );
  async function askQuestion(event: React.FormEvent) {
    event.preventDefault();
    if (!context || !question.trim()) return;
    const seq = contextGeneration.current;
    setAsking(true);
    setAnswer(null);
    try {
      if (preview)
        throw new Error("Live answers require a signed-in player account.");
      const r = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: question,
          conversationId: answer?.conversationId,
          uiContext: {
            playerId: context.playerId,
            viewerPlayerId: context.playerId,
            teamId: context.team.teamId,
            seasonId: context.team.seasonId,
            analytics: {
              domain,
              source,
              playerIds: [context.playerId],
              filters: pitchType ? { pitchTypes: [pitchType] } : {},
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
      const p = await r.json();
      if (seq !== contextGeneration.current) return;
      setAnswer(p);
    } catch (e) {
      if (seq === contextGeneration.current)
        setAnswer({
          ok: false,
          status: "failed",
          answer: e instanceof Error ? e.message : "Unable to answer.",
        });
    } finally {
      setAsking(false);
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
            date: p.date,
            location: p.location,
          })),
        ...data.games
          .filter((g) => !data.scheduleEvents.some((e) => e.gameId === g.id))
          .map((g) => ({
            id: g.id,
            title: `${g.homeAway === "Away" ? "at" : "vs"} ${g.opponent}`,
            date: g.date,
            location: g.location,
          })),
        ...data.scheduleEvents.map((e) => ({
          id: e.id,
          title: e.title,
          date: e.startAt,
          location: e.location,
        })),
      ].sort((a, b) => a.date.localeCompare(b.date))
    : [];
  const upcoming = items.filter(
    (i) => i.date.slice(0, 10) >= new Date().toISOString().slice(0, 10),
  );
  const renderMetrics = () =>
    result && (
      <dl className="player-beta-metrics">
        {result.columns
          .filter((c) => c.metricId !== "player")
          .slice(0, view === "Home" ? 4 : undefined)
          .map((c) => (
            <div key={c.metricId}>
              <dt title={c.definition}>{c.fullName}</dt>
              <dd>{result.rows[0]?.cells[c.metricId]?.display ?? "—"}</dd>
            </div>
          ))}
      </dl>
    );
  return (
    <main className="player-beta">
      <header className="player-beta-header">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={context?.team.logoUrl || BRAND_ASSETS.mark} alt="" />
        <div>
          <h1>
            {context
              ? `${context.jersey !== undefined ? `#${context.jersey} ` : ""}${context.name}`
              : "My Clubhouse"}
          </h1>
          <p>
            {context
              ? `${context.team.teamName} · ${context.team.seasonName}`
              : "Player Account"}
          </p>
        </div>
        {context && (
          <button
            className="icon-button"
            title="Ask Clubhouse"
            aria-label="Ask Clubhouse"
            onClick={() => setAsk(true)}
          >
            <Sparkles size={20} />
          </button>
        )}
      </header>
      {session.contexts.length > 1 && (
        <label className="player-beta-context">
          Player Context
          <select
            value={context?.membershipId}
            disabled={loading}
            onChange={(e) => {
              const c = session.contexts.find(
                (c) => c.membershipId === e.target.value,
              );
              if (c) void switchContext(c);
            }}
          >
            {session.contexts.map((c) => (
              <option key={c.membershipId} value={c.membershipId}>
                {c.name} · {c.team.teamName} · {c.team.seasonName}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p role="status">Loading your player context...</p>
      ) : !context ? (
        <PlayerAccountLinksPanel />
      ) : (
        data && (
          <>
            {view === "Home" && (
              <>
                <section className="player-beta-section">
                  <h2>Today & Next</h2>
                  {upcoming.length ? (
                    upcoming.slice(0, 3).map((i) => (
                      <div className="player-beta-item" key={i.id}>
                        <strong>{i.title}</strong>
                        <span>
                          {i.date.slice(0, 10)} {i.location}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p>No upcoming team events.</p>
                  )}
                </section>
                <section className="player-beta-section">
                  <h2>My Development</h2>
                  <div className="player-beta-development">
                    {(
                      ["hitting", "pitching", "defense", "development"] as const
                    ).map((d) => (
                      <button
                        key={d}
                        onClick={() => {
                          setDomain(d);
                          setEventId("");
                          setPitchType("");
                          setView("Development");
                        }}
                      >
                        <Activity size={18} />
                        {d === "development"
                          ? "Weight Room"
                          : d[0].toUpperCase() + d.slice(1)}
                      </button>
                    ))}
                  </div>
                </section>
                <section className="player-beta-section">
                  <div className="player-beta-section-title">
                    <h2>Recent Performance</h2>
                    <button
                      className="ghost-button"
                      onClick={() => setView("Analytics")}
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
            {view === "Schedule" && (
              <section className="player-beta-section">
                <h2>My Schedule</h2>
                {items.map((i) => (
                  <div className="player-beta-item" key={i.id}>
                    <strong>{i.title}</strong>
                    <span>
                      {i.date.slice(0, 10)} {i.location}
                    </span>
                  </div>
                ))}
                {!items.length && <p>No team events available.</p>}
              </section>
            )}
            {(view === "Analytics" || view === "Development") && (
              <section className="player-beta-section">
                <h2>
                  {view === "Analytics" ? "My Analytics" : "My Development"}
                </h2>
                <div className="player-beta-filters">
                  <label>
                    Discipline
                    <select
                      value={domain}
                      onChange={(e) => {
                        setDomain(e.target.value as AnalyticsDomain);
                        setEventId("");
                      }}
                    >
                      <option value="hitting">Hitting</option>
                      <option value="pitching">Pitching</option>
                      <option value="defense">Defense</option>
                      <option value="development">Weight Room</option>
                    </select>
                  </label>
                  {domain !== "development" && (
                    <>
                      <label>
                        Source
                        <select
                          value={source}
                          onChange={(e) => {
                            setSource(e.target.value as AnalyticsSource);
                            setEventId("");
                          }}
                        >
                          <option value="games">Games</option>
                          <option value="practice">Practice</option>
                          <option value="live-bp">Live BP</option>
                        </select>
                      </label>
                      <label>
                        Pitch Type
                        <select
                          value={pitchType}
                          onChange={(e) => setPitchType(e.target.value)}
                        >
                          <option value="">All Pitches</option>
                          {[
                            "4-Seam",
                            "2-Seam",
                            "Sinker",
                            "Cutter",
                            "Slider",
                            "Curveball",
                            "Changeup",
                            "Splitter",
                            "Knuckleball",
                            "Other",
                          ].map((p) => (
                            <option key={p}>{p}</option>
                          ))}
                        </select>
                      </label>
                    </>
                  )}
                </div>
                {domain !== "development" && (
                  <label>
                    Session / Game
                    <select
                      value={eventId}
                      onChange={(e) => setEventId(e.target.value)}
                    >
                      <option value="">All Events</option>
                      {result?.availableEvents.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {renderMetrics()}
                {domain === "development" ? (
                  <>
                    <h3>Workout History</h3>
                    {data.workoutSessions.map((w) => (
                      <details className="player-beta-item" key={w.id}>
                        <summary>{w.date}</summary>
                        <span>
                          {w.bodyWeight !== undefined
                            ? `${w.bodyWeight} lb`
                            : "Weight not recorded"}{" "}
                          · {w.completed ? "Completed" : "In progress"}
                        </span>
                        <dl className="player-beta-metrics">
                          {data.workoutEntries
                            .filter((e) => e.sessionId === w.id)
                            .map((e) => (
                              <div key={e.id}>
                                <dt>{e.exercise}</dt>
                                <dd>
                                  {e.weight !== undefined
                                    ? `${e.weight} lb`
                                    : e.value !== undefined
                                      ? `${e.value} ${e.unit ?? ""}`
                                      : "—"}
                                  {e.reps !== undefined ? ` x ${e.reps}` : ""}
                                </dd>
                              </div>
                            ))}
                        </dl>
                      </details>
                    ))}
                    {!data.workoutSessions.length && (
                      <p>No workout history yet.</p>
                    )}
                  </>
                ) : (
                  <>
                    {result?.sprayChart && (
                      <div className="player-beta-chart">
                        <h3>My Spray Chart</h3>
                        <ClubhouseBaseballField
                          mode="spray"
                          points={result.sprayChart.points}
                          ariaLabel="My spray chart"
                        />
                      </div>
                    )}
                    {result?.pitchLocationChart && (
                      <div className="player-beta-chart">
                        <h3>My Pitch Locations</h3>
                        <Heatmap points={result.pitchLocationChart.points} />
                      </div>
                    )}
                  </>
                )}
              </section>
            )}
            {view === "More" && (
              <section className="player-beta-section">
                <PlayerAccountLinksPanel />
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
      {ask && (
        <dialog
          ref={dialog}
          onCancel={() => setAsk(false)}
          className="player-beta-ask"
          aria-label="Ask Clubhouse"
        >
          <div className="player-beta-section-title">
            <h2>Ask Clubhouse</h2>
            <button
              className="icon-button"
              title="Close"
              aria-label="Close Ask Clubhouse"
              onClick={() => setAsk(false)}
            >
              <X size={18} />
            </button>
          </div>
          <p>
            {context?.name} · {context?.team.seasonName}
          </p>
          <div className="player-beta-answer" aria-live="polite">
            {asking ? (
              <p>Looking at your data...</p>
            ) : (
              answer && (
                <>
                  <p>{answer.answer ?? answer.message?.content}</p>
                  {answer.visuals?.map((v, index) => {
                    const q = data
                      ? executeAnalyticsQuery(data, {
                          ...v.query,
                          groupBy: "player",
                          playerIds: [context!.playerId],
                        })
                      : null;
                    return (
                      q && (
                        <div key={index}>
                          <h3>{v.title}</h3>
                          {v.type === "spray_chart" ? (
                            <ClubhouseBaseballField
                              points={q.sprayChart?.points ?? []}
                              mode={v.mode === "heat" ? "heat" : "spray"}
                            />
                          ) : v.type === "pitch_location" ? (
                            <Heatmap
                              points={q.pitchLocationChart?.points ?? []}
                            />
                          ) : (
                            <dl className="player-beta-metrics">
                              {v.metrics?.map((m) => (
                                <div key={m.label}>
                                  <dt>{m.label}</dt>
                                  <dd>{m.value}</dd>
                                </div>
                              ))}
                            </dl>
                          )}
                        </div>
                      )
                    );
                  })}
                </>
              )
            )}
          </div>
          <form onSubmit={askQuestion}>
            <label className="sr-only" htmlFor="player-question">
              Ask a question
            </label>
            <input
              id="player-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="How have I been hitting lately?"
            />
            <button
              className="icon-button"
              title="Send"
              aria-label="Send question"
              disabled={asking || !question.trim()}
            >
              <ArrowUp size={18} />
            </button>
          </form>
        </dialog>
      )}
      <nav className="player-beta-nav" aria-label="Player navigation">
        {nav.map((n) => (
          <button
            key={n.name}
            aria-current={view === n.name ? "page" : undefined}
            onClick={() => setView(n.name)}
          >
            <n.icon size={20} />
            <span>{n.name}</span>
          </button>
        ))}
      </nav>
    </main>
  );
}

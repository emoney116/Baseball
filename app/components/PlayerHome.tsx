"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, ChevronRight, Dumbbell, Pin, Sparkles } from "lucide-react";
import type { PlayerSession } from "../lib/playerAccess";
import type { AnalyticsQuery } from "../lib/analyticsQuery";
import type { PlayerLiveSession } from "../lib/playerLiveModels";
import { HOME_METRICS, homeDateRange, playerHomeDomains, playerHomeMetric, playerHomePerformance, type HomeDomain } from "../lib/playerHome";
import { buildScheduleItems, formatTime } from "./TeamWorkspaceViews";
import { buildWeightRoomPlayerProfile } from "./WeightRoomPlayerViews";
import { ChoiceSelect } from "./ChoiceSelect";
import { PlayerLiveEntry } from "./PlayerLiveEntry";
import { PlayerSelfTracking } from "./PlayerSelfTracking";

type Destination = "Schedule" | "Practice" | "Games" | "Weight Room" | "Analytics";
const dateLabel = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
export function PlayerHome({ session, preview, onNavigate, onAnalytics, onEnter, onAsk, onSaved }: {
  session: PlayerSession; preview: boolean;
  onNavigate: (view: Destination) => void;
  onAnalytics: (query: Partial<AnalyticsQuery>) => void;
  onEnter: (session: PlayerLiveSession) => void;
  onAsk: (question: string) => void;
  onSaved: () => void;
}) {
  const { data, context } = session;
  const player = data?.players.find(p => p.id === context?.playerId);
  const domains = useMemo(() => data && player ? playerHomeDomains(data, player) : [], [data, player]);
  const [selectedDomain, setDomain] = useState<HomeDomain>();
  const domain = selectedDomain && domains.includes(selectedDomain) ? selectedDomain : domains[0] ?? "hitting";
  const [period, setPeriod] = useState("30d");
  const [pinned, setPinned] = useState(false), [pinBusy, setPinBusy] = useState(true), [pinError, setPinError] = useState("");
  useEffect(() => {
    let cancelled = false;
    if (preview) return;
    fetch("/api/team-pins", { cache: "no-store" }).then(async r => {
      const payload = await r.json();
      if (!r.ok) throw new Error(payload.message ?? "Unable to load pinned teams.");
      if (!cancelled) setPinned(payload.pins.some((p: { teamId: string; seasonId?: string }) => p.teamId === context?.team.teamId && p.seasonId === context?.team.seasonId));
    }).catch(e => { if (!cancelled) setPinError(e.message); }).finally(() => { if (!cancelled) setPinBusy(false); });
    return () => { cancelled = true; };
  }, [context?.team.teamId, context?.team.seasonId, preview]);
  if (!data || !context || !player) return null;
  const now = new Date();
  const query: Partial<AnalyticsQuery> = period === "season" ? { timeRange: "season" } : { timeRange: "custom", customDateRange: homeDateRange(now, 30) };
  const metrics = playerHomePerformance(data, player.id, domain, query);
  const upcoming = buildScheduleItems(data).filter(item => item.status !== "Completed" && item.status !== "Cancelled" && item.date >= homeDateRange(now, 1).start).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  const weight = buildWeightRoomPlayerProfile(data, player);
  const recent = [...(data.personalSessions ?? []).flatMap(personal => {
    const metric = HOME_METRICS[personal.domain].find(m => m.source !== "games")!;
    const summary = playerHomeMetric(data, player.id, personal.domain, { ...metric, source: "personal" }, { eventIds: [personal.id] });
    return [{ id: personal.id, date: personal.startedAt.slice(0, 10), title: `Personal ${personal.domain === "pitching" ? "Bullpen" : personal.domain === "hitting" ? "Hitting" : "Defense"}`, detail: `${personal.endedAt ? "Completed" : "In progress"} · ${summary.label} ${summary.cell?.display ?? "--"}`, query: summary.query }];
  }), ...data.practices.flatMap(practice => domains.flatMap(d => {
    const count = d === "hitting" ? data.hittingEvents.filter(e => e.practiceId === practice.id && e.hitterId === player.id).length : d === "pitching" ? data.pitchEvents.filter(e => e.practiceId === practice.id && e.pitcherId === player.id).length : data.defenseEvents.filter(e => e.practiceId === practice.id && e.playerId === player.id).length;
    if (!count) return [];
    const metric = HOME_METRICS[d].find(m => m.source !== "games")!;
    const summary = playerHomeMetric(data, player.id, d, { ...metric, source: "practice" }, { eventIds: [practice.id] });
    return [{ id: `${practice.id}:${d}`, date: practice.date, title: `${d[0].toUpperCase()}${d.slice(1)} · ${practice.name || "Practice"}`, detail: `${count} ${d === "hitting" ? "tracked events" : d === "pitching" ? "pitches" : "reps"} · ${summary.label} ${summary.cell?.display ?? "--"}`, query: summary.query }];
  }))].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const trends = HOME_METRICS[domain].filter(m => m.source !== "games").slice(0, 3).map(m => ({
    before: playerHomeMetric(data, player.id, domain, m, { timeRange: "custom", customDateRange: homeDateRange(now, 14, 14) }),
    after: playerHomeMetric(data, player.id, domain, m, { timeRange: "custom", customDateRange: homeDateRange(now, 14) }),
  })).filter(t => typeof t.before.cell?.value === "number" && typeof t.after.cell?.value === "number");
  const goals = data.developmentGoals.filter(g => g.playerId === player.id && g.playerVisible && !g.completed);
  const feedback = data.coachNotes.filter(n => n.visibility === "player_visible");
  const lastWorkout = data.workoutSessions.filter(w => w.playerId === player.id).sort((a, b) => b.date.localeCompare(a.date))[0];
  async function togglePin() {
    setPinError(""); setPinBusy(true);
    try {
      if (preview) { setPinned(!pinned); return; }
      const response = await fetch("/api/team-pins", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamId: context!.team.teamId, seasonId: context!.team.seasonId, pin: !pinned }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Unable to pin team.");
      setPinned(!pinned);
    } catch (e) { setPinError(e instanceof Error ? e.message : "Unable to pin team."); }
    finally { setPinBusy(false); }
  }
  return <div className="player-home-dashboard">
    <header className="player-home-greeting"><div><h1>My Development</h1><p>{context.name} · {context.team.seasonName}</p></div><button className="icon-button" aria-label={pinned ? "Unpin team" : "Pin team"} title={pinned ? "Unpin team" : "Pin team"} aria-pressed={pinned} disabled={!preview && pinBusy} onClick={() => void togglePin()}><Pin size={18} fill={pinned ? "currentColor" : "none"} /></button></header>
    {pinError && <p role="alert">{pinError}</p>}
    <section><div className="player-home-heading"><h2>Today & Next</h2><button className="text-button" onClick={() => onNavigate("Schedule")}>Schedule <ChevronRight size={14}/></button></div>
      {!preview ? <PlayerLiveEntry membershipId={context.membershipId} onEnter={onEnter} onSaved={onSaved}/> : <p className="muted">Waiting on coach to begin a live session.</p>}
      {upcoming.map(item => <button className="player-home-row" key={item.id} onClick={() => onNavigate(item.eventType === "Practice" ? "Practice" : item.eventType === "Game" ? "Games" : item.eventType === "Lift" ? "Weight Room" : "Schedule")}><CalendarDays size={18}/><span><strong>{item.title}</strong><small>{dateLabel(item.date)}{item.startAt ? ` · ${formatTime(item.startAt)}` : ""}{item.location ? ` · ${item.location}` : ""}</small></span><ChevronRight size={16}/></button>)}
      {!upcoming.length && <p className="muted">No upcoming team events.</p>}
    </section>
    <section><div className="player-home-heading"><h2>My Performance</h2><ChoiceSelect label="Performance period" value={period} options={[{ value: "30d", label: "Last 30 Days" }, { value: "season", label: "Season" }]} onChange={setPeriod}/></div>
      {domains.length > 1 && <div className="segmented-control player-home-domains" role="group" aria-label="Performance discipline">{domains.map(d => <button key={d} className={domain === d ? "active" : ""} aria-pressed={domain === d} onClick={() => setDomain(d)}>{d[0].toUpperCase() + d.slice(1)}</button>)}</div>}
      <div className="player-home-metrics">{metrics.map(m => <button key={m.id} onClick={() => onAnalytics(m.query)}><strong>{m.cell?.display ?? "--"}</strong><span>{m.label}</span><small>{m.source === "games" ? "Games" : m.source === "practice" ? "Practice" : "All sources"}</small></button>)}</div>
    </section>
    <section><div className="player-home-heading"><h2>Recent Development</h2><button className="text-button" onClick={() => onNavigate("Practice")}>View all <ChevronRight size={14}/></button></div>{recent.map(row => <button key={row.id} className="player-home-row" onClick={() => onAnalytics(row.query)}><span><strong>{row.title}</strong><small>{dateLabel(row.date)} · {row.detail}</small></span><ChevronRight size={16}/></button>)}{lastWorkout && <button className="player-home-row" onClick={() => onNavigate("Weight Room")}><Dumbbell size={18}/><span><strong>Weight Room</strong><small>{dateLabel(lastWorkout.date)} · {lastWorkout.completed ? "Completed" : "In progress"}</small></span><ChevronRight size={16}/></button>}{!recent.length && !lastWorkout && <p className="muted">No tracked development yet.</p>}</section>
    <section><div className="player-home-heading"><h2>My Trends</h2><span className="muted">Last 4 weeks</span></div>{trends.map(t => <button className="player-home-row" key={t.after.id} onClick={() => onAnalytics(t.after.query)}><span><strong>{t.after.label}</strong><small>{t.after.sourceLabel} · Previous 14 days / Latest 14 days</small></span><b>{t.before.cell!.display} <ArrowRight size={14}/> {t.after.cell!.display}</b></button>)}{!trends.length && <p className="muted">More tracked data in both periods is needed for a comparison.</p>}<button className="text-button" onClick={() => onNavigate("Analytics")}>View Analytics <ArrowRight size={14}/></button></section>
    <section><h2>Goals</h2>{goals.slice(0, 3).map(g => <p key={g.id}>{g.title}</p>)}{!goals.length && <p className="muted">No current player-visible goals.</p>}{session.access?.capabilities.canCreateGoals && <details><summary>Personal Tracking</summary><PlayerSelfTracking session={session} preview={preview} onSaved={async () => onSaved()}/></details>}</section>
    {feedback.length > 0 && <section><h2>Coach Feedback</h2>{feedback.slice(0, 2).map(n => <p key={n.id}>{n.text}</p>)}</section>}
    <section><div className="player-home-heading"><h2>Weight Room</h2><button className="text-button" onClick={() => onNavigate("Weight Room")}>View Progress <ChevronRight size={14}/></button></div><div className="player-home-weight"><div><strong>{weight.currentWeight ? `${weight.currentWeight} lb` : "--"}</strong><small>Body Weight</small></div><div><strong>{weight.completedWorkoutsThisWeek}</strong><small>Completed this week</small></div><div><strong>{lastWorkout ? dateLabel(lastWorkout.date) : "--"}</strong><small>Last Workout</small></div></div></section>
    {session.access?.capabilities.canUseAskClubhouse && <section className="player-home-ask"><h2><Sparkles size={18}/>Ask Clubhouse</h2>{["What should I work on today?", "How have I been hitting lately?", "Show me my spray chart.", "How am I doing against sliders?"].map(prompt => <button className="player-home-row" key={prompt} onClick={() => onAsk(prompt)}><span>{prompt}</span><ArrowRight size={16}/></button>)}</section>}
  </div>;
}

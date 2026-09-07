import type { AppData, Player } from "../types.ts";
import { executeAnalyticsQuery, type AnalyticsDomain, type AnalyticsQuery, type AnalyticsSource } from "./analyticsQuery.ts";

export type HomeDomain = "hitting" | "pitching" | "defense";
export const HOME_METRICS: Record<HomeDomain, Array<{ id: string; source: AnalyticsSource }>> = {
  hitting: [{ id: "avg", source: "games" }, { id: "ops", source: "games" }, { id: "contactPct", source: "practice" }, { id: "avgEv", source: "practice" }, { id: "hardPct", source: "practice" }, { id: "swings", source: "practice" }, { id: "bip", source: "practice" }],
  pitching: [{ id: "strikePct", source: "all" }, { id: "cswPct", source: "all" }, { id: "avgPitchVelo", source: "all" }, { id: "whiffPct", source: "all" }, { id: "threePitchOutRate", source: "games" }, { id: "pitches", source: "all" }],
  defense: [{ id: "cleanPct", source: "practice" }, { id: "throwAcc", source: "practice" }, { id: "errorPct", source: "practice" }, { id: "reps", source: "practice" }],
};
export function playerHomeDomains(data: AppData, player: Player): HomeDomain[] {
  const hitting = player.isHitter || data.hittingEvents.some(e => e.hitterId === player.id) || data.gameEvents.some(e => e.batterId === player.id);
  const pitching = player.isPitcher || data.pitchEvents.some(e => e.pitcherId === player.id) || data.gameEvents.some(e => e.pitcherId === player.id);
  const defense = data.defenseEvents.some(e => e.playerId === player.id);
  const domains: HomeDomain[] = [...(hitting ? ["hitting" as const] : []), ...(pitching ? ["pitching" as const] : []), ...(defense ? ["defense" as const] : [])];
  return domains.length ? domains : ["defense"];
}
export function homeDateRange(now: Date, days: number, offset = 0) {
  const end = new Date(now); end.setDate(end.getDate() - offset);
  const start = new Date(end); start.setDate(start.getDate() - days + 1);
  const date = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  return { start: date(start), end: date(end) };
}
export function playerHomeMetric(data: AppData, playerId: string, domain: AnalyticsDomain, metric: { id: string; source: AnalyticsSource }, query: Partial<AnalyticsQuery> = {}) {
  const result = executeAnalyticsQuery(data, { ...query, domain, source: metric.source, metrics: [metric.id], mode: "box-score", groupBy: "player", timeRange: query.timeRange ?? "season", playerIds: [playerId] });
  const cell = result.rows.find(row => row.player.id === playerId)?.cells[metric.id];
  return { ...metric, cell, label: result.columns.find(c => c.metricId === metric.id)?.label ?? metric.id, query: result.query, sourceLabel: result.sourceLabel };
}
export function playerHomePerformance(data: AppData, playerId: string, domain: HomeDomain, query: Partial<AnalyticsQuery> = {}) {
  const metrics = HOME_METRICS[domain].map(metric => playerHomeMetric(data, playerId, domain, metric, query));
  const tracked = metrics.filter(metric => typeof metric.cell?.value === "number");
  return [...tracked, ...metrics.filter(metric => !tracked.includes(metric))].slice(0, domain === "defense" ? 4 : 5);
}

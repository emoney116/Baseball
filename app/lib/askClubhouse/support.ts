import type { AnalyticsDomain, AnalyticsFilterAvailability, AnalyticsSource } from "../analyticsQuery.ts";

export type ClubhouseDimensionStatus = "supported" | "partial" | "not_tracked";

export interface ClubhouseDimensionSupport {
  dimension: string;
  status: ClubhouseDimensionStatus;
  domains: AnalyticsDomain[];
  sources: AnalyticsSource[];
  note: string;
}

const ALL_SOURCES: AnalyticsSource[] = ["all", "practice", "live-bp", "games"];

export const CLUBHOUSE_DIMENSION_SUPPORT: readonly ClubhouseDimensionSupport[] = [
  { dimension: "source", status: "supported", domains: ["hitting", "pitching", "defense", "development"], sources: ALL_SOURCES, note: "Practice, Live BP, Games, or combined scope is selected server-side." },
  { dimension: "player", status: "supported", domains: ["hitting", "pitching", "defense", "development"], sources: ALL_SOURCES, note: "Authorized roster identity is resolved from the selected team context." },
  { dimension: "team", status: "supported", domains: ["hitting", "pitching", "defense", "development"], sources: ALL_SOURCES, note: "Queries are scoped to the authorized current team dataset." },
  { dimension: "date", status: "supported", domains: ["hitting", "pitching", "defense", "development"], sources: ALL_SOURCES, note: "Season, rolling windows, and custom date ranges are supported." },
  { dimension: "practice", status: "supported", domains: ["hitting", "pitching", "defense", "development"], sources: ["all", "practice", "live-bp"], note: "Practice and session IDs are retained on tracked events." },
  { dimension: "game", status: "partial", domains: ["hitting", "pitching"], sources: ["games"], note: "Logged game pitches/BIP are queryable, but complete plate-appearance outcomes are not yet tracked." },
  { dimension: "session", status: "supported", domains: ["hitting", "pitching", "defense"], sources: ["all", "practice", "live-bp"], note: "Hitting, pitching, and defense session IDs are retained." },
  { dimension: "pitch type", status: "partial", domains: ["hitting", "pitching"], sources: ALL_SOURCES, note: "Pitch type is required for pitching events and optional for hitting/game events." },
  { dimension: "pitch velocity", status: "partial", domains: ["hitting", "pitching"], sources: ALL_SOURCES, note: "Velocity filters use recorded values only; unrecorded pitches are excluded and reported through coverage." },
  { dimension: "pitch location", status: "partial", domains: ["hitting", "pitching"], sources: ALL_SOURCES, note: "Location is optional and is evaluated from tracked coordinates/zone data." },
  { dimension: "batter handedness", status: "partial", domains: ["hitting", "pitching"], sources: ALL_SOURCES, note: "Resolved from the roster when the batter identity is present; missing batter IDs cannot be split." },
  { dimension: "pitcher handedness", status: "partial", domains: ["hitting", "pitching"], sources: ALL_SOURCES, note: "Resolved from the roster when the pitcher identity is present; missing pitcher IDs cannot be split." },
  { dimension: "count", status: "partial", domains: ["hitting", "pitching"], sources: ["practice", "live-bp"], note: "Count-before is tracked on pitching events; hitting events do not currently persist count." },
  { dimension: "spray", status: "partial", domains: ["hitting"], sources: ["all", "practice", "live-bp"], note: "Hitting direction is available for logged contact events; it is not a complete game spray field." },
  { dimension: "contact type", status: "partial", domains: ["hitting", "pitching"], sources: ["all", "practice", "live-bp"], note: "Contact result/quality are optional and only apply to contact events." },
  { dimension: "exit velocity", status: "partial", domains: ["hitting"], sources: ["all", "practice", "live-bp"], note: "EV is available for recorded swings only." },
  { dimension: "result", status: "supported", domains: ["hitting", "pitching", "defense"], sources: ALL_SOURCES, note: "Tracked event outcomes are available, with game outcome coverage explicitly limited." },
  { dimension: "thrower", status: "partial", domains: ["hitting", "pitching"], sources: ["all", "practice", "live-bp"], note: "Live BP thrower source is tracked when the session records it." },
  { dimension: "drill", status: "supported", domains: ["hitting", "defense"], sources: ["all", "practice", "live-bp"], note: "Hitting session type and defense drill context are retained." },
  { dimension: "position", status: "supported", domains: ["defense"], sources: ["all", "practice"], note: "Position worked is retained on defensive sessions/events." },
  { dimension: "defensive rep type", status: "supported", domains: ["defense"], sources: ["all", "practice"], note: "Rep type is normalized with conservative fallbacks." },
  { dimension: "defensive subtype", status: "partial", domains: ["defense"], sources: ["all", "practice"], note: "Subtype is optional; untyped reps are kept as not tracked." },
  { dimension: "throw result", status: "partial", domains: ["defense"], sources: ["all", "practice"], note: "Throw result is optional and No Throw is excluded from accuracy denominators." },
  { dimension: "medical diagnosis", status: "not_tracked", domains: ["development"], sources: ["all"], note: "Clubhouse has no medical, video, or biomechanical evidence for diagnosis." },
];

export function getClubhouseDimensionSupport(dimension: string, domain?: AnalyticsDomain): ClubhouseDimensionSupport | undefined {
  const normalized = dimension.trim().toLowerCase();
  return CLUBHOUSE_DIMENSION_SUPPORT.find((item) => item.dimension === normalized && (!domain || item.domains.includes(domain)));
}

export function dimensionStatusForFilter(availability: AnalyticsFilterAvailability): ClubhouseDimensionStatus {
  if (availability === "supported") return "supported";
  if (availability === "partial") return "partial";
  return "not_tracked";
}

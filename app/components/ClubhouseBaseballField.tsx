import type React from "react";
import {
  canonicalPointToLegacyGame,
  getSprayDistribution,
  getSprayHeatClusters,
  type SprayLaneDistribution,
  legacyGamePointToCanonical,
} from "../lib/sprayChart";
import type { Handedness, ZonePoint } from "../types";

export type ClubhouseFieldMode = "blank" | "spray" | "count" | "percent" | "heat";
export type ClubhouseFieldSize = "compact" | "standard" | "large";
export type ClubhouseFieldCoordinateSpace = "game" | "practice";
export const CLUBHOUSE_BASEBALL_FIELD_ASSET = "/game-tracking/baseball-field-spray-chart-v1.png";

export type ClubhouseFieldPoint = ZonePoint & {
  id?: string;
  color?: string;
  label?: string;
};

// Cambell's Game Center asset is the single visual field source. Practice
// coordinates are adapted at this boundary so existing recorded data remains valid.
export function ClubhouseBaseballField({
  points = [],
  activePoint,
  onSelect,
  mode = onSelect ? "spray" : "blank",
  onModeCycle,
  batterHandedness = "R",
  size = "standard",
  coordinateSpace = "practice",
  className = "",
  showLabels = true,
  showTrajectory = false,
  ariaLabel,
}: {
  points?: ClubhouseFieldPoint[];
  activePoint?: ZonePoint;
  onSelect?: (point: ZonePoint) => void;
  mode?: ClubhouseFieldMode;
  onModeCycle?: () => void;
  batterHandedness?: Handedness;
  size?: ClubhouseFieldSize;
  coordinateSpace?: ClubhouseFieldCoordinateSpace;
  className?: string;
  showLabels?: boolean;
  showTrajectory?: boolean;
  ariaLabel?: string;
}) {
  const toGamePoint = (point: ZonePoint) => coordinateSpace === "game" ? point : canonicalPointToLegacyGame(point);
  const toStoredPoint = (point: ZonePoint) => coordinateSpace === "game" ? point : legacyGamePointToCanonical(point);
  const gamePoints = points.map((point) => ({ ...point, ...toGamePoint(point) }));
  const gameActivePoint = activePoint ? toGamePoint(activePoint) : undefined;
  const canonicalPoints = coordinateSpace === "game" ? points.map(legacyGamePointToCanonical) : points;
  const heatClusters = getSprayHeatClusters(canonicalPoints).map((point) => ({ ...point, ...toGamePoint(point) }));
  const sectorDistribution = getSprayDistribution(canonicalPoints, batterHandedness);
  const showSectorMetrics = mode === "percent" || mode === "count";
  const showPointDots = mode === "spray" || Boolean(onSelect);
  const isInteractive = Boolean(onSelect);

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (!onSelect) return;
    const rect = event.currentTarget.getBoundingClientRect();
    onSelect(toStoredPoint({
      x: clamp((event.clientX - rect.left) / rect.width, 0.01, 0.99),
      y: clamp((event.clientY - rect.top) / rect.height, 0.035, 0.902),
    }));
  }

  const contents = <>
    <span className="clubhouse-baseball-field__asset" style={{ backgroundImage: `url(${CLUBHOUSE_BASEBALL_FIELD_ASSET})` }} aria-hidden="true" />
    {!isInteractive && mode !== "blank" && <span className="practice-spray-field__mode" aria-hidden="true">{fieldModeLabel(mode)}</span>}
    {mode === "heat" && heatClusters.map((cluster, index) => (
      <span
        key={`${cluster.x}-${cluster.y}-${index}`}
        className="clubhouse-baseball-field__heat"
        style={{ left: `${cluster.x * 100}%`, top: `${cluster.y * 100}%`, "--heat-weight": cluster.value } as React.CSSProperties}
      />
    ))}
    {showSectorMetrics && <SectorMetrics distribution={sectorDistribution} mode={mode} />}
    {showPointDots && gamePoints.slice(-120).map((point, index) => (
      <span
        key={point.id ?? `${point.x}-${point.y}-${index}`}
        className="field-chart__dot clubhouse-baseball-field__dot"
        style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%`, "--point-color": point.color } as React.CSSProperties}
      />
    ))}
    {gameActivePoint && <ActivePoint point={gameActivePoint} showTrajectory={showTrajectory} />}
    {showLabels && <>
      <span className="clubhouse-baseball-field__label clubhouse-baseball-field__label--lf">LF</span>
      <span className="clubhouse-baseball-field__label clubhouse-baseball-field__label--cf">CF</span>
      <span className="clubhouse-baseball-field__label clubhouse-baseball-field__label--rf">RF</span>
    </>}
    {!isInteractive && mode === "blank" && <span className="practice-spray-field__empty">No spray locations tracked</span>}
  </>;

  const classes = ["clubhouse-baseball-field", "practice-spray-field", `clubhouse-baseball-field--${size}`, `clubhouse-baseball-field--${mode}`, !isInteractive ? "practice-spray-field--readonly" : "", className].filter(Boolean).join(" ");
  const label = ariaLabel ?? (isInteractive ? "Set batted ball location" : `${points.length} tracked batted ball locations`);
  if (!isInteractive) return <div className={classes} role="img" aria-label={label}>{contents}</div>;
  return <button className={classes} type="button" onPointerDown={handlePointerDown} onClick={onModeCycle} aria-label={label}>{contents}</button>;
}

function SectorMetrics({ distribution, mode }: { distribution: ReturnType<typeof getSprayDistribution>; mode: ClubhouseFieldMode }) {
  return <>
    {distribution.lanes.filter((lane) => lane.count > 0).map((lane) => <SectorMetric key={lane.id} lane={lane} mode={mode} />)}
  </>;
}

function SectorMetric({ lane, mode }: { lane: SprayLaneDistribution; mode: ClubhouseFieldMode }) {
  const point = canonicalPointToLegacyGame({ x: lane.labelPoint.x / 1000, y: lane.labelPoint.y / 700 });
  const value = mode === "count" ? String(lane.count) : `${Math.round(lane.pct)}%`;
  return <span className="clubhouse-baseball-field__sector-label" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}><strong>{value}</strong>{mode === "percent" && <small>{shortLaneLabel(lane.label)}</small>}</span>;
}

function ActivePoint({ point, showTrajectory }: { point: ZonePoint; showTrajectory: boolean }) {
  return <>
    {showTrajectory && <svg className="clubhouse-baseball-field__trajectory-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line className="clubhouse-baseball-field__trajectory-glow" x1="50" y1="90.2" x2={point.x * 100} y2={point.y * 100} /><line className="clubhouse-baseball-field__trajectory" x1="50" y1="90.2" x2={point.x * 100} y2={point.y * 100} /></svg>}
    <span className="field-chart__target clubhouse-baseball-field__target" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} />
  </>;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function shortLaneLabel(label: string) {
  if (label === "Extreme Pull") return "Ext Pull";
  if (label === "Extreme Oppo") return "Ext Oppo";
  return label;
}

function fieldModeLabel(mode: ClubhouseFieldMode) {
  if (mode === "spray") return "Spray";
  if (mode === "percent") return "%";
  if (mode === "count") return "#";
  if (mode === "heat") return "Heat";
  return "Blank";
}

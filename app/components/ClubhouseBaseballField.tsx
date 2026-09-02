import type React from "react";
import { useId } from "react";
import {
  getSprayDistribution,
  getSprayHeatClusters,
  getSpraySectorBoundaryPoint,
  projectSprayPoint,
  SPRAY_FIELD_GEOMETRY,
  SPRAY_FIELD_PATHS,
  SPRAY_FIELD_VIEWBOX,
  type SprayLaneDistribution,
} from "../lib/sprayChart";
import type { Handedness, ZonePoint } from "../types";

export type ClubhouseFieldMode = "blank" | "spray" | "count" | "percent" | "heat";
export type ClubhouseFieldSize = "compact" | "standard" | "large";

export type ClubhouseFieldPoint = ZonePoint & {
  id?: string;
  color?: string;
  label?: string;
};

export function ClubhouseBaseballField({
  points = [],
  activePoint,
  onSelect,
  mode = onSelect ? "spray" : "blank",
  onModeCycle,
  batterHandedness = "R",
  size = "standard",
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
  className?: string;
  showLabels?: boolean;
  showTrajectory?: boolean;
  ariaLabel?: string;
}) {
  const chartId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const home = SPRAY_FIELD_GEOMETRY.home;
  const heatClusters = getSprayHeatClusters(points);
  const maxHeatValue = Math.max(1, ...heatClusters.map((cluster) => cluster.value));
  const sectorDistribution = getSprayDistribution(points, batterHandedness);
  const showSectorMetrics = mode === "percent" || mode === "count";
  const showPointDots = mode === "spray" || Boolean(onSelect);
  const isInteractive = Boolean(onSelect);

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (!onSelect) return;
    const rect = event.currentTarget.getBoundingClientRect();
    onSelect({
      x: clamp((event.clientX - rect.left) / rect.width, 0.05, 0.95),
      y: clamp((event.clientY - rect.top) / rect.height, 0.04, 0.96),
    });
  }

  function handleClick() {
    if (!onSelect) onModeCycle?.();
  }

  const contents = <>
    {!isInteractive && mode !== "blank" && <span className="practice-spray-field__mode" aria-hidden="true">{fieldModeLabel(mode)}</span>}
    <svg className="practice-spray-field__svg" viewBox={`0 0 ${SPRAY_FIELD_VIEWBOX.width} ${SPRAY_FIELD_VIEWBOX.height}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <linearGradient id={`fieldGrass-${chartId}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--spray-field-grass-top)" />
          <stop offset="100%" stopColor="var(--spray-field-grass-bottom)" />
        </linearGradient>
        <linearGradient id={`fieldDirt-${chartId}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--spray-field-dirt-top)" />
          <stop offset="100%" stopColor="var(--spray-field-dirt-bottom)" />
        </linearGradient>
        <radialGradient id={`fieldHeat-${chartId}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--spray-heat-hot)" stopOpacity="0.95" />
          <stop offset="42%" stopColor="var(--spray-heat-warm)" stopOpacity="0.68" />
          <stop offset="72%" stopColor="var(--spray-heat-cool)" stopOpacity="0.34" />
          <stop offset="100%" stopColor="var(--spray-heat-cold)" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`fieldFair-${chartId}`}>
          <path d={SPRAY_FIELD_PATHS.fairTerritory} />
        </clipPath>
      </defs>
      <g clipPath={`url(#fieldFair-${chartId})`}>
        <path className="practice-spray-field__outfield" d={SPRAY_FIELD_PATHS.fairTerritory} fill={`url(#fieldGrass-${chartId})`} />
        <path className="practice-spray-field__field-band" d={SPRAY_FIELD_PATHS.outfieldBandDeep} />
        <path className="practice-spray-field__field-band practice-spray-field__field-band--alt" d={SPRAY_FIELD_PATHS.outfieldBandShallow} />
        {showSectorMetrics && <SectorOverlay distribution={sectorDistribution} home={home} />}
        {mode === "heat" && <g className="practice-spray-field__heat">
          {heatClusters.map((cluster, index) => {
            const point = projectSprayPoint(cluster);
            return <circle key={`${cluster.x}-${cluster.y}-${index}`} cx={point.x} cy={point.y} r={heatRadius(cluster.value, maxHeatValue)} fill={`url(#fieldHeat-${chartId})`} opacity={heatOpacity(cluster.value, maxHeatValue, points.length)} />;
          })}
        </g>}
      </g>
      <g className="practice-spray-field__ground">
        <path className="practice-spray-field__field-outline" d={SPRAY_FIELD_PATHS.fairTerritory} />
        <path className="practice-spray-field__warning-line" d={SPRAY_FIELD_PATHS.warningTrack} />
        <path className="practice-spray-field__dirt" d={SPRAY_FIELD_PATHS.infieldDirt} fill={`url(#fieldDirt-${chartId})`} />
        <path className="practice-spray-field__infield-grass" d={SPRAY_FIELD_PATHS.infieldGrass} />
        <path className="practice-spray-field__arc-line practice-spray-field__arc-line--infield" d={SPRAY_FIELD_PATHS.infieldArc} />
        <line className="practice-spray-field__foul-line" x1={home.x} y1={home.y} x2={SPRAY_FIELD_GEOMETRY.leftFoulPole.x} y2={SPRAY_FIELD_GEOMETRY.leftFoulPole.y} />
        <line className="practice-spray-field__foul-line" x1={home.x} y1={home.y} x2={SPRAY_FIELD_GEOMETRY.rightFoulPole.x} y2={SPRAY_FIELD_GEOMETRY.rightFoulPole.y} />
        <path className="practice-spray-field__diamond-line" d={SPRAY_FIELD_PATHS.diamond} />
        <path className="practice-spray-field__mound" d={SPRAY_FIELD_PATHS.mound} />
        <line className="practice-spray-field__mound-rubber" x1={SPRAY_FIELD_GEOMETRY.mound.x - 12} y1={SPRAY_FIELD_GEOMETRY.mound.y} x2={SPRAY_FIELD_GEOMETRY.mound.x + 12} y2={SPRAY_FIELD_GEOMETRY.mound.y} />
        {[SPRAY_FIELD_GEOMETRY.secondBase, SPRAY_FIELD_GEOMETRY.firstBase, SPRAY_FIELD_GEOMETRY.thirdBase].map((base) => <rect key={`${base.x}-${base.y}`} className="practice-spray-field__base" x={base.x - 10} y={base.y - 10} width="20" height="20" rx="2" transform={`rotate(45 ${base.x} ${base.y})`} />)}
        <path className="practice-spray-field__plate" d={SPRAY_FIELD_PATHS.homePlate} />
      </g>
      {showPointDots && <g className="practice-spray-field__dots" clipPath={`url(#fieldFair-${chartId})`}>
        {points.slice(-120).map((point, index) => {
          const dot = projectSprayPoint(point);
          return <circle key={point.id ?? `${point.x}-${point.y}-${index}`} className="practice-spray-field__dot" cx={dot.x} cy={dot.y} r="7.5" style={point.color ? { fill: point.color } : undefined} />;
        })}
      </g>}
      {activePoint && <ActivePoint point={activePoint} showTrajectory={showTrajectory} />}
      {showSectorMetrics && <g className="practice-spray-field__sector-labels">
        {sectorDistribution.lanes.filter((lane) => lane.count > 0).map((lane) => <SectorLabel key={lane.id} lane={lane} mode={mode} />)}
      </g>}
    </svg>
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
  return <button className={classes} type="button" onPointerDown={handlePointerDown} onClick={handleClick} aria-label={label}>{contents}</button>;
}

function SectorOverlay({ distribution, home }: { distribution: ReturnType<typeof getSprayDistribution>; home: { x: number; y: number } }) {
  return <g className="practice-spray-field__sector-layer">
    {distribution.lanes.map((lane) => <path key={lane.id} className="practice-spray-field__sector" d={lane.path} style={{ "--spray-sector-opacity": lane.intensity } as React.CSSProperties} />)}
    {distribution.lanes.slice(1).map((lane) => {
      const boundary = getSpraySectorBoundaryPoint(lane.startAngle);
      return <line key={`${lane.id}-line`} className="practice-spray-field__sector-line" x1={home.x} y1={home.y} x2={boundary.x} y2={boundary.y} />;
    })}
  </g>;
}

function ActivePoint({ point, showTrajectory }: { point: ZonePoint; showTrajectory: boolean }) {
  const active = projectSprayPoint(point);
  return <g className="practice-spray-field__active-point">
    {showTrajectory && <>
      <line className="clubhouse-baseball-field__trajectory-glow" x1={SPRAY_FIELD_GEOMETRY.home.x} y1={SPRAY_FIELD_GEOMETRY.home.y} x2={active.x} y2={active.y} />
      <line className="clubhouse-baseball-field__trajectory" x1={SPRAY_FIELD_GEOMETRY.home.x} y1={SPRAY_FIELD_GEOMETRY.home.y} x2={active.x} y2={active.y} />
    </>}
    <circle cx={active.x} cy={active.y} r="16" />
    <circle cx={active.x} cy={active.y} r="31" />
  </g>;
}

function SectorLabel({ lane, mode }: { lane: SprayLaneDistribution; mode: ClubhouseFieldMode }) {
  const value = mode === "count" ? String(lane.count) : `${Math.round(lane.pct)}%`;
  return <g className="practice-spray-field__sector-label" transform={`translate(${lane.labelPoint.x.toFixed(2)} ${lane.labelPoint.y.toFixed(2)})`}><text textAnchor="middle" dominantBaseline="middle"><tspan x="0" dy="-0.2em">{value}</tspan>{mode === "percent" && <tspan x="0" dy="1.15em">{shortLaneLabel(lane.label)}</tspan>}</text></g>;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function heatRadius(value: number, maxValue: number) {
  return 44 + (value / Math.max(1, maxValue)) * 62;
}

function heatOpacity(value: number, maxValue: number, total: number) {
  const sampleWeight = Math.min(1, total / 18);
  return Math.min(0.82, 0.18 + (value / Math.max(1, maxValue)) * 0.42 + sampleWeight * 0.18);
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

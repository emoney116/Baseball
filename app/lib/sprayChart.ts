import type { Handedness, ZonePoint } from "../types";

export type SprayLaneId = "extreme-left" | "left" | "middle" | "right" | "extreme-right";

export type SprayLaneDistribution = {
  id: SprayLaneId;
  index: number;
  label: string;
  physicalLabel: string;
  count: number;
  pct: number;
  startAngle: number;
  endAngle: number;
  centerAngle: number;
  path: string;
  labelPoint: ZonePoint;
  intensity: number;
};

export type SprayDistribution = {
  total: number;
  lanes: SprayLaneDistribution[];
};

export type SprayHeatCluster = ZonePoint & {
  value: number;
};

export const SPRAY_FIELD_VIEWBOX = {
  width: 100,
  height: 78,
};

export const SPRAY_HOME_PLATE_ORIGIN: ZonePoint = {
  x: 0.5,
  y: 0.93,
};

export const SPRAY_LEFT_FOUL_POINT: ZonePoint = {
  x: 0.055,
  y: 0.29,
};

export const SPRAY_RIGHT_FOUL_POINT: ZonePoint = {
  x: 0.945,
  y: 0.29,
};

const PHYSICAL_LANE_LABELS = ["Left", "Left Center", "Center", "Right Center", "Right"] as const;
const RHH_LANE_LABELS = ["Extreme Pull", "Pull", "Middle", "Oppo", "Extreme Oppo"] as const;
const LHH_LANE_LABELS = ["Extreme Oppo", "Oppo", "Middle", "Pull", "Extreme Pull"] as const;
const SECTOR_RADIUS = 0.76;
const LABEL_RADIUS = 0.51;
const HEAT_GRID_SIZE = 6;

const LEFT_FOUL_ANGLE = getSprayAngle(SPRAY_LEFT_FOUL_POINT);
const RIGHT_FOUL_ANGLE = getSprayAngle(SPRAY_RIGHT_FOUL_POINT);
const FAIR_ANGLE_RANGE = LEFT_FOUL_ANGLE - RIGHT_FOUL_ANGLE;

export function getSprayAngle(point: ZonePoint) {
  return Math.atan2(SPRAY_HOME_PLATE_ORIGIN.y - point.y, point.x - SPRAY_HOME_PLATE_ORIGIN.x);
}

export function getSprayLane(point: ZonePoint, batterHandedness: Handedness = "R") {
  const angle = getSprayAngle(point);
  const index = getSprayLaneIndex(angle);
  if (index === undefined) return undefined;
  return {
    id: laneId(index),
    index,
    label: laneLabel(index, batterHandedness),
    physicalLabel: PHYSICAL_LANE_LABELS[index],
  };
}

export function getSprayDistribution(points: ZonePoint[], batterHandedness: Handedness = "R"): SprayDistribution {
  const counts = [0, 0, 0, 0, 0];
  for (const point of points) {
    const lane = getSprayLane(point, batterHandedness);
    if (lane) counts[lane.index] += 1;
  }
  const total = counts.reduce((sum, count) => sum + count, 0);
  const maxCount = Math.max(...counts, 1);
  return {
    total,
    lanes: counts.map((count, index) => {
      const startAngle = laneBoundaryAngle(index);
      const endAngle = laneBoundaryAngle(index + 1);
      const centerAngle = (startAngle + endAngle) / 2;
      const pct = total ? (count / total) * 100 : 0;
      return {
        id: laneId(index),
        index,
        label: laneLabel(index, batterHandedness),
        physicalLabel: PHYSICAL_LANE_LABELS[index],
        count,
        pct,
        startAngle,
        endAngle,
        centerAngle,
        path: spraySectorPath(startAngle, endAngle),
        labelPoint: pointFromHomeAngle(centerAngle, LABEL_RADIUS),
        intensity: count ? spraySectorIntensity(count, total, maxCount) : 0,
      };
    }),
  };
}

export function getSprayHeatClusters(points: ZonePoint[]): SprayHeatCluster[] {
  if (!points.length) return [];
  const clusters = new Map<string, SprayHeatCluster>();
  for (const point of points) {
    const xBucket = Math.max(0, Math.min(HEAT_GRID_SIZE - 1, Math.floor(point.x * HEAT_GRID_SIZE)));
    const yBucket = Math.max(0, Math.min(HEAT_GRID_SIZE - 1, Math.floor(point.y * HEAT_GRID_SIZE)));
    const key = `${xBucket}-${yBucket}`;
    const existing = clusters.get(key);
    if (existing) {
      existing.value += 1;
      existing.x = (existing.x + point.x) / 2;
      existing.y = (existing.y + point.y) / 2;
    } else {
      clusters.set(key, {
        x: (xBucket + 0.5) / HEAT_GRID_SIZE,
        y: (yBucket + 0.5) / HEAT_GRID_SIZE,
        value: 1,
      });
    }
  }
  return Array.from(clusters.values());
}

export function sprayPointForLane(index: number, radius = 0.42): ZonePoint {
  return pointFromHomeAngle((laneBoundaryAngle(index) + laneBoundaryAngle(index + 1)) / 2, radius);
}

function getSprayLaneIndex(angle: number) {
  if (angle > LEFT_FOUL_ANGLE || angle < RIGHT_FOUL_ANGLE) return undefined;
  const normalized = (LEFT_FOUL_ANGLE - angle) / FAIR_ANGLE_RANGE;
  return Math.max(0, Math.min(4, Math.floor(normalized * 5)));
}

function laneBoundaryAngle(index: number) {
  return LEFT_FOUL_ANGLE - (FAIR_ANGLE_RANGE / 5) * index;
}

function laneId(index: number): SprayLaneId {
  return (["extreme-left", "left", "middle", "right", "extreme-right"] as const)[index] ?? "middle";
}

function laneLabel(index: number, batterHandedness: Handedness) {
  if (batterHandedness === "L") return LHH_LANE_LABELS[index] ?? "Middle";
  return RHH_LANE_LABELS[index] ?? "Middle";
}

function spraySectorPath(startAngle: number, endAngle: number) {
  const home = svgPoint(SPRAY_HOME_PLATE_ORIGIN);
  const start = svgPoint(pointFromHomeAngle(startAngle, SECTOR_RADIUS));
  const end = svgPoint(pointFromHomeAngle(endAngle, SECTOR_RADIUS));
  return [
    `M ${home.x.toFixed(2)} ${home.y.toFixed(2)}`,
    `L ${start.x.toFixed(2)} ${start.y.toFixed(2)}`,
    `A ${(SECTOR_RADIUS * 100).toFixed(2)} ${(SECTOR_RADIUS * SPRAY_FIELD_VIEWBOX.height).toFixed(2)} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

function pointFromHomeAngle(angle: number, radius: number): ZonePoint {
  return {
    x: SPRAY_HOME_PLATE_ORIGIN.x + Math.cos(angle) * radius,
    y: SPRAY_HOME_PLATE_ORIGIN.y - Math.sin(angle) * radius,
  };
}

function svgPoint(point: ZonePoint) {
  return {
    x: point.x * SPRAY_FIELD_VIEWBOX.width,
    y: point.y * SPRAY_FIELD_VIEWBOX.height,
  };
}

function spraySectorIntensity(count: number, total: number, maxCount: number) {
  const sampleWeight = Math.min(total / 16, 1);
  const relativeWeight = count / maxCount;
  return Math.min(0.42, 0.08 + sampleWeight * 0.16 + relativeWeight * 0.18);
}

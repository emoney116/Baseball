import type { Handedness, ZonePoint } from "../types";

export type SprayFieldPoint = {
  x: number;
  y: number;
};

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
  labelPoint: SprayFieldPoint;
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
  width: 1000,
  height: 700,
};

export const SPRAY_FIELD_GEOMETRY = {
  home: { x: 500, y: 660 },
  leftFoulPole: { x: 55, y: 245 },
  rightFoulPole: { x: 945, y: 245 },
  outfieldArcControlLeft: { x: 245, y: 56 },
  outfieldArcControlRight: { x: 755, y: 56 },
  firstBase: { x: 652, y: 535 },
  secondBase: { x: 500, y: 420 },
  thirdBase: { x: 348, y: 535 },
  mound: { x: 500, y: 585 },
};

export const SPRAY_FIELD_PATHS = {
  fairTerritory: [
    `M ${SPRAY_FIELD_GEOMETRY.home.x} ${SPRAY_FIELD_GEOMETRY.home.y}`,
    `L ${SPRAY_FIELD_GEOMETRY.leftFoulPole.x} ${SPRAY_FIELD_GEOMETRY.leftFoulPole.y}`,
    `C ${SPRAY_FIELD_GEOMETRY.outfieldArcControlLeft.x} ${SPRAY_FIELD_GEOMETRY.outfieldArcControlLeft.y} ${SPRAY_FIELD_GEOMETRY.outfieldArcControlRight.x} ${SPRAY_FIELD_GEOMETRY.outfieldArcControlRight.y} ${SPRAY_FIELD_GEOMETRY.rightFoulPole.x} ${SPRAY_FIELD_GEOMETRY.rightFoulPole.y}`,
    "Z",
  ].join(" "),
  outfieldDepthLine: "M 88 268 C 270 104 730 104 912 268",
  outfieldBandDeep: "M 102 284 C 282 126 718 126 898 284 L 850 328 C 692 194 308 194 150 328 Z",
  outfieldBandShallow: "M 184 360 C 324 238 676 238 816 360 L 760 410 C 642 318 358 318 240 410 Z",
  warningTrack: "M 69 256 C 256 84 744 84 931 256",
  infieldDirt: "M 500 660 C 392 622 298 548 300 456 C 350 386 432 354 500 354 C 568 354 650 386 700 456 C 702 548 608 622 500 660 Z",
  infieldGrass: "M 500 636 L 348 535 L 500 420 L 652 535 Z",
  infieldArc: "M 306 466 C 360 402 434 374 500 374 C 566 374 640 402 694 466",
  diamond: "M 500 646 L 348 535 L 500 420 L 652 535 Z",
  homePlate: "M 500 646 L 526 664 L 514 690 L 486 690 L 474 664 Z",
  mound: "M 500 573 C 520 573 536 584 536 598 C 536 613 520 624 500 624 C 480 624 464 613 464 598 C 464 584 480 573 500 573 Z",
};

export const SPRAY_HOME_PLATE_ORIGIN: ZonePoint = unprojectSprayPoint(SPRAY_FIELD_GEOMETRY.home);
export const SPRAY_LEFT_FOUL_POINT: ZonePoint = unprojectSprayPoint(SPRAY_FIELD_GEOMETRY.leftFoulPole);
export const SPRAY_RIGHT_FOUL_POINT: ZonePoint = unprojectSprayPoint(SPRAY_FIELD_GEOMETRY.rightFoulPole);

const PHYSICAL_LANE_LABELS = ["Left", "Left Center", "Center", "Right Center", "Right"] as const;
const RHH_LANE_LABELS = ["Extreme Pull", "Pull", "Middle", "Oppo", "Extreme Oppo"] as const;
const LHH_LANE_LABELS = ["Extreme Oppo", "Oppo", "Middle", "Pull", "Extreme Pull"] as const;
const SECTOR_DISTANCE = 920;
const LABEL_DISTANCE = 405;
const HEAT_GRID_SIZE = 8;

const LEFT_FOUL_ANGLE = getSprayAngle(SPRAY_LEFT_FOUL_POINT);
const RIGHT_FOUL_ANGLE = getSprayAngle(SPRAY_RIGHT_FOUL_POINT);
const FAIR_ANGLE_RANGE = LEFT_FOUL_ANGLE - RIGHT_FOUL_ANGLE;

export function projectSprayPoint(point: ZonePoint): SprayFieldPoint {
  return {
    x: point.x * SPRAY_FIELD_VIEWBOX.width,
    y: point.y * SPRAY_FIELD_VIEWBOX.height,
  };
}

export function unprojectSprayPoint(point: SprayFieldPoint): ZonePoint {
  return {
    x: point.x / SPRAY_FIELD_VIEWBOX.width,
    y: point.y / SPRAY_FIELD_VIEWBOX.height,
  };
}

export function getSprayAngle(point: ZonePoint) {
  const projected = projectSprayPoint(point);
  return Math.atan2(SPRAY_FIELD_GEOMETRY.home.y - projected.y, projected.x - SPRAY_FIELD_GEOMETRY.home.x);
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
      const sector = getDistributionSector(index);
      const pct = total ? (count / total) * 100 : 0;
      return {
        id: laneId(index),
        index,
        label: laneLabel(index, batterHandedness),
        physicalLabel: PHYSICAL_LANE_LABELS[index],
        count,
        pct,
        ...sector,
        intensity: count ? spraySectorIntensity(count, total, maxCount) : 0,
      };
    }),
  };
}

export function getDistributionSector(index: number) {
  const startAngle = laneBoundaryAngle(index);
  const endAngle = laneBoundaryAngle(index + 1);
  const centerAngle = (startAngle + endAngle) / 2;
  return {
    startAngle,
    endAngle,
    centerAngle,
    path: spraySectorPath(startAngle, endAngle),
    labelPoint: getDistributionLabelPoint(index),
  };
}

export function getDistributionLabelPoint(index: number) {
  const startAngle = laneBoundaryAngle(index);
  const endAngle = laneBoundaryAngle(index + 1);
  return pointFromHomeAngle((startAngle + endAngle) / 2, LABEL_DISTANCE);
}

export function getSpraySectorBoundaryPoint(angle: number) {
  return pointFromHomeAngle(angle, SECTOR_DISTANCE);
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

export function sprayPointForLane(index: number, distance = 405): ZonePoint {
  const point = pointFromHomeAngle((laneBoundaryAngle(index) + laneBoundaryAngle(index + 1)) / 2, distance);
  return unprojectSprayPoint(point);
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
  const home = SPRAY_FIELD_GEOMETRY.home;
  const start = pointFromHomeAngle(startAngle, SECTOR_DISTANCE);
  const end = pointFromHomeAngle(endAngle, SECTOR_DISTANCE);
  return [
    `M ${home.x.toFixed(2)} ${home.y.toFixed(2)}`,
    `L ${start.x.toFixed(2)} ${start.y.toFixed(2)}`,
    `A ${SECTOR_DISTANCE.toFixed(2)} ${SECTOR_DISTANCE.toFixed(2)} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

function pointFromHomeAngle(angle: number, distance: number): SprayFieldPoint {
  return {
    x: SPRAY_FIELD_GEOMETRY.home.x + Math.cos(angle) * distance,
    y: SPRAY_FIELD_GEOMETRY.home.y - Math.sin(angle) * distance,
  };
}

function spraySectorIntensity(count: number, total: number, maxCount: number) {
  const sampleWeight = Math.min(total / 20, 1);
  const relativeWeight = count / maxCount;
  return Math.min(0.36, 0.06 + sampleWeight * 0.12 + relativeWeight * 0.16);
}

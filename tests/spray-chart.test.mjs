import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalPointToLegacyGame,
  getDistributionLabelPoint,
  getDistributionSector,
  getSprayDistribution,
  getSprayLane,
  legacyGamePointToCanonical,
  projectSprayPoint,
  SPRAY_FIELD_GEOMETRY,
  SPRAY_FIELD_PATHS,
  SPRAY_FIELD_VIEWBOX,
  sprayPointForLane,
} from "../app/lib/sprayChart.ts";

test("spray lanes classify physical field coordinates from home plate", () => {
  assert.equal(getSprayLane(sprayPointForLane(0), "R")?.label, "Extreme Pull");
  assert.equal(getSprayLane(sprayPointForLane(1), "R")?.label, "Pull");
  assert.equal(getSprayLane(sprayPointForLane(2), "R")?.label, "Middle");
  assert.equal(getSprayLane(sprayPointForLane(3), "R")?.label, "Oppo");
  assert.equal(getSprayLane(sprayPointForLane(4), "R")?.label, "Extreme Oppo");
});

test("spray lanes interpret pull and oppo by batter handedness", () => {
  const leftField = sprayPointForLane(1);

  assert.equal(getSprayLane(leftField, "R")?.label, "Pull");
  assert.equal(getSprayLane(leftField, "L")?.label, "Oppo");
});

test("spray distribution percentages use tracked coordinates only", () => {
  const points = [
    sprayPointForLane(0),
    sprayPointForLane(1),
    sprayPointForLane(1),
    sprayPointForLane(2),
    sprayPointForLane(2),
    sprayPointForLane(2),
    sprayPointForLane(2),
    sprayPointForLane(3),
    sprayPointForLane(3),
    sprayPointForLane(4),
  ];

  const distribution = getSprayDistribution(points, "R");
  assert.equal(distribution.total, 10);
  assert.deepEqual(distribution.lanes.map((lane) => lane.count), [1, 2, 4, 2, 1]);
  assert.deepEqual(distribution.lanes.map((lane) => Math.round(lane.pct)), [10, 20, 40, 20, 10]);
});

test("spray distribution omits points outside fair territory", () => {
  const distribution = getSprayDistribution([
    sprayPointForLane(2),
    { x: 0.02, y: 0.9 },
    { x: 0.98, y: 0.9 },
  ], "R");

  assert.equal(distribution.total, 1);
  assert.deepEqual(distribution.lanes.map((lane) => lane.count), [0, 0, 1, 0, 0]);
});

test("spray chart uses one fixed SVG field coordinate system", () => {
  assert.deepEqual(SPRAY_FIELD_VIEWBOX, { width: 1000, height: 700 });
  assert.match(SPRAY_FIELD_PATHS.fairTerritory, /^M 500 660 L 55 245 C /);
  assert.match(SPRAY_FIELD_PATHS.fairTerritory, /945 245 Z$/);

  const projectedHome = projectSprayPoint({
    x: SPRAY_FIELD_GEOMETRY.home.x / SPRAY_FIELD_VIEWBOX.width,
    y: SPRAY_FIELD_GEOMETRY.home.y / SPRAY_FIELD_VIEWBOX.height,
  });
  assert.deepEqual(projectedHome, SPRAY_FIELD_GEOMETRY.home);
});

test("distribution sectors and labels radiate from home plate", () => {
  const sector = getDistributionSector(2);
  const label = getDistributionLabelPoint(2);

  assert.match(sector.path, /^M 500\.00 660\.00 L /);
  assert.equal(sector.labelPoint.x, label.x);
  assert.equal(sector.labelPoint.y, label.y);
  assert.ok(label.y < SPRAY_FIELD_GEOMETRY.secondBase.y);
  assert.ok(label.x > SPRAY_FIELD_GEOMETRY.thirdBase.x);
  assert.ok(label.x < SPRAY_FIELD_GEOMETRY.firstBase.x);
});

test("spray field mound is centered inside the infield diamond", () => {
  const infieldCenterY = (
    SPRAY_FIELD_GEOMETRY.secondBase.y +
    SPRAY_FIELD_GEOMETRY.firstBase.y +
    SPRAY_FIELD_GEOMETRY.thirdBase.y +
    646
  ) / 4;

  assert.equal(SPRAY_FIELD_GEOMETRY.mound.x, SPRAY_FIELD_GEOMETRY.secondBase.x);
  assert.ok(Math.abs(SPRAY_FIELD_GEOMETRY.mound.y - infieldCenterY) < 12);
});

test("legacy Game Center field points map into the canonical field space", () => {
  const home = legacyGamePointToCanonical({ x: 0.5, y: 0.902 });
  const leftFoul = legacyGamePointToCanonical({ x: 0.01, y: 0.4 });

  assert.ok(Math.abs(home.x - SPRAY_FIELD_GEOMETRY.home.x / SPRAY_FIELD_VIEWBOX.width) < 0.000001);
  assert.ok(Math.abs(home.y - SPRAY_FIELD_GEOMETRY.home.y / SPRAY_FIELD_VIEWBOX.height) < 0.000001);
  assert.ok(Math.abs(leftFoul.x - SPRAY_FIELD_GEOMETRY.leftFoulPole.x / SPRAY_FIELD_VIEWBOX.width) < 0.000001);
  assert.ok(Math.abs(leftFoul.y - SPRAY_FIELD_GEOMETRY.leftFoulPole.y / SPRAY_FIELD_VIEWBOX.height) < 0.000001);
});

test("legacy Game Center conversions round-trip without changing stored coordinates", () => {
  const legacyPoint = { x: 0.72, y: 0.61 };
  const roundTrip = canonicalPointToLegacyGame(legacyGamePointToCanonical(legacyPoint));

  assert.ok(Math.abs(roundTrip.x - legacyPoint.x) < 0.000001);
  assert.ok(Math.abs(roundTrip.y - legacyPoint.y) < 0.000001);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  getSprayDistribution,
  getSprayLane,
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

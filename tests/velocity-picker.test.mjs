import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync("app/components/TeamTrainingViews.tsx", "utf8");
const start = source.indexOf("export function normalizedVelocityValue(");
const end = source.indexOf("export function WeightRoomRecentWorkouts", start);
const context = { exports: {}, TRACKING_VELOCITY_MIN_MPH: 1, TRACKING_VELOCITY_MAX_MPH: 300 };
vm.runInNewContext(ts.transpileModule(source.slice(start, end), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
const normalize = context.exports.normalizedVelocityValue;

test("empty Practice velocity wheel opens at the configured default, not 1 mph", () => {
  assert.equal(normalize("", 80), 80);
  assert.equal(normalize("  ", 85), 85);
  assert.equal(normalize("invalid", 80), 80);
});

test("Practice velocity wheel retains entered values and existing bounds", () => {
  assert.equal(normalize("84", 80), 84);
  assert.equal(normalize("84.7", 80), 85);
  assert.equal(normalize("0", 80), 1);
  assert.equal(normalize("400", 80), 300);
});

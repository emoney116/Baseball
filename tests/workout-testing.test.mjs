import { test } from "node:test";
import assert from "node:assert/strict";
import { BASELINE_TESTING_CIRCUIT, parseTestResult, formatTestResult, testComparisonKey, validateTestConditions } from "../app/lib/workoutTesting.ts";

test("baseline has seven tests and never invents plate load", () => {
  assert.equal(BASELINE_TESTING_CIRCUIT.length, 7);
  assert.equal(BASELINE_TESTING_CIRCUIT[2].conditions.loadLb, 45);
  assert.equal(BASELINE_TESTING_CIRCUIT[6].conditions.loadLb, 135);
  assert.equal(BASELINE_TESTING_CIRCUIT[5].conditions.loadLb, undefined);
  assert.equal(BASELINE_TESTING_CIRCUIT[4].conditions.bilateral, true);
});
for (const { name, conditions } of BASELINE_TESTING_CIRCUIT) {
  test(`${name}: blank, zero and result stay distinct`, () => {
    assert.equal(parseTestResult("", conditions), undefined);
    assert.equal(parseTestResult("0", conditions), 0);
    assert.equal(parseTestResult("24", conditions), 24);
    assert.equal(formatTestResult(undefined, conditions), "—");
    assert.throws(() => parseTestResult("-1", conditions));
  });
}
test("duration parses seconds and m:ss and displays fractional seconds correctly", () => {
  const c = BASELINE_TESTING_CIRCUIT[3].conditions;
  assert.equal(parseTestResult("1:18", c), 78);
  assert.equal(formatTestResult(78, c), "1:18");
  assert.equal(formatTestResult(65.2, c), "1:05.2");
  assert.equal(formatTestResult(59.999, c), "1:00");
  assert.throws(() => parseTestResult("1:60", c));
  assert.throws(() => parseTestResult("NaN", c));
});
test("comparison keys separate load, duration and side", () => {
  const c = BASELINE_TESTING_CIRCUIT[2].conditions;
  assert.notEqual(testComparisonKey(c), testComparisonKey({ ...c, loadLb: 65 }));
  assert.notEqual(testComparisonKey(c), testComparisonKey({ ...c, durationSeconds: 30 }));
  assert.notEqual(testComparisonKey(c, "Left"), testComparisonKey(c, "Right"));
  assert.throws(() => validateTestConditions({ ...c, loadLb: undefined }));
  assert.throws(() => parseTestResult("2.5", c));
});

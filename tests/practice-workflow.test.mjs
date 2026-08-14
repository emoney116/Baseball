import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("practice hub opens active tracker modes without setup screen", () => {
  const page = readFileSync("app/page.tsx", "utf8");
  const styles = readFileSync("app/globals.css", "utf8");

  assert.match(page, /type PracticeHubTab = "Overview" \| "Drills" \| "Throwing" \| "Metrics" \| "History"/);
  assert.match(page, /type PracticeDrilldown = \{ kind: "hub" \} \| \{ kind: "attendance" \}/);
  assert.match(page, /function PracticeHome\(/);
  assert.match(page, /function PracticeAttendanceDrilldown\(/);
  assert.doesNotMatch(page, /function PracticeSessionSetup\(/);
  assert.doesNotMatch(page, /kind: "setup"/);
  assert.match(page, /function PracticeConsole\(/);
  assert.match(page, /function availablePracticePlayers\(/);
  assert.match(page, /return status === "Present" \|\| status === "Late"/);
  assert.match(page, /"Hack Attack - FB", "Hack Attack - CB"/);
  assert.match(page, /practice-tracker-tabs/);
  assert.match(page, /PracticeRecentEventTable/);
  assert.match(page, /Undo Last/);
  assert.match(page, /function openPracticeStation\(mode: PracticeMode\)/);
  assert.match(page, /setPracticeTrackingOpen\(true\)/);
  assert.match(page, /onOpenAttendance=\{\(\) => \(practice \? setPracticeDrilldown\(\{ kind: "attendance" \}\)/);
  assert.match(page, /onOpenStation=\{openPracticeStation\}/);
  assert.match(page, /onUndo=\{undoPracticeEvent\}/);

  assert.match(page, /Hard Contact/);
  assert.match(page, /StrikeZone points=\{pitchEvents\.map/);
  assert.match(page, /PracticeDashboardStrip/);

  assert.match(styles, /\.practice-summary-strip/);
  assert.match(styles, /\.practice-activity-card--pitching/);
  assert.match(styles, /\.practice-tracker-tabs/);
  assert.match(styles, /\.practice-player-strip/);
});

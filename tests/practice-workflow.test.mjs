import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("practice hub routes coaches through setup before active tracking", () => {
  const page = readFileSync("app/page.tsx", "utf8");
  const styles = readFileSync("app/globals.css", "utf8");

  assert.match(page, /type PracticeHubTab = "Overview" \| "Drills" \| "Throwing" \| "Metrics" \| "History"/);
  assert.match(page, /type PracticeDrilldown = \{ kind: "hub" \} \| \{ kind: "attendance" \} \| \{ kind: "setup"; mode: PracticeMode \}/);
  assert.match(page, /function PracticeHome\(/);
  assert.match(page, /function PracticeAttendanceDrilldown\(/);
  assert.match(page, /function PracticeSessionSetup\(/);
  assert.match(page, /setPracticeDrilldown\(\{ kind: "setup", mode \}\)/);
  assert.match(page, /onOpenAttendance=\{\(\) => \(practice \? setPracticeDrilldown\(\{ kind: "attendance" \}\)/);
  assert.match(page, /startConfiguredPracticeSession/);
  assert.match(page, /onUndo=\{undoPracticeEvent\}/);

  assert.match(page, /Hard Contact/);
  assert.match(page, /StrikeZone points=\{pitchEvents\.map/);
  assert.match(page, /PracticeDashboardStrip/);

  assert.match(styles, /\.practice-summary-strip/);
  assert.match(styles, /\.practice-activity-card--pitching/);
  assert.match(styles, /\.practice-drilldown-header/);
  assert.match(styles, /\.practice-player-grid/);
});

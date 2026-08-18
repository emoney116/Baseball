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
  assert.match(page, /const HITTING_STATIONS: HittingSession\["type"\]\[\] = \["Tee", "Front Toss", "Machine", "Coach BP", "Live BP", "Other"\]/);
  assert.match(page, /const HITTING_RESULT_ACTIONS/);
  assert.match(page, /label: "Hard LD"/);
  assert.match(page, /const HITTING_CONTACT_CHOICES/);
  assert.match(page, /exitVelocityMph/);
  assert.match(page, /function clearPendingHittingContext\(\)/);
  assert.match(page, /onTrackExitVelocity/);
  assert.match(page, /practice-hitting-shell/);
  assert.match(page, /practice-hitting-log-trigger/);
  assert.match(page, /Log Swing/);
  assert.match(page, /What happened\?/);
  assert.match(page, /Skip Location/);
  assert.match(page, /function PracticeSprayField/);
  assert.match(page, /function deriveHitDirectionFromFieldLocation/);
  assert.match(page, /practicePitchTypeLabel/);
  assert.match(page, /attendance-roster__scroll/);
  assert.match(page, /practice-player-strip__player-scroll/);
  assert.match(page, /practice-tracker-tabs/);
  assert.match(page, /PracticeRecentEventTable/);
  assert.match(page, /Undo Last/);
  assert.match(page, /function openPracticeStation\(mode: PracticeMode\)/);
  assert.match(page, /setPracticeTrackingOpen\(true\)/);
  assert.match(page, /onOpenAttendance=\{\(\) => \(practice \? setPracticeDrilldown\(\{ kind: "attendance" \}\)/);
  assert.match(page, /onOpenStation=\{openPracticeStation\}/);
  assert.match(page, /onUndo=\{undoPracticeEvent\}/);

  assert.doesNotMatch(page, /Hard Contact<\/button>/);
  assert.doesNotMatch(page, /PITCH<\/button>/);
  assert.match(page, /StrikeZone points=\{pitchEvents\.map/);
  assert.match(page, /PracticeDashboardStrip/);

  assert.match(styles, /\.practice-summary-strip/);
  assert.match(styles, /\.practice-activity-card--pitching/);
  assert.match(styles, /\.practice-tracker-tabs/);
  assert.match(styles, /\.practice-player-strip/);
  assert.match(styles, /\.practice-hitting-shell/);
  assert.match(styles, /\.practice-hitting-sheet/);
  assert.match(styles, /\.practice-spray-field/);
});

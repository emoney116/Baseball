import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  densePlayerIdentityLabel,
  denseJerseyNumber,
  formatDensePlayerIdentity,
  formatDensePlayerName,
} from "../app/lib/densePlayerIdentity.ts";

const player = { name: "Jackson Smith", jerseyNumber: 12 };

test("dense player names preserve a readable initial and full surname", () => {
  assert.equal(formatDensePlayerName("Jackson Smith"), "J. Smith");
  assert.equal(formatDensePlayerName("Ana de la Cruz"), "A. de la Cruz");
  assert.equal(formatDensePlayerName("Madonna"), "Madonna");
});

test("dense player identities retain team jersey semantics without changing player data", () => {
  assert.equal(formatDensePlayerIdentity(player), "#12 J. Smith");
  assert.equal(formatDensePlayerIdentity({ name: "Tyler Adams", jerseyNumber: "2" }), "#2 T. Adams");
  assert.equal(denseJerseyNumber({ jerseyNumber: "2" }), 2);
  assert.equal(formatDensePlayerIdentity({ name: "Ethan Brooks", jerseyNumber: 0 }), "E. Brooks");
  assert.equal(densePlayerIdentityLabel(player), "Jackson Smith, number 12");
});

test("dense stat tables use the shared player identity and compact Weight Room headers", () => {
  const page = readFileSync("app/page.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");
  const weighInCard = page.slice(page.indexOf("function WeightRoomWeighInCard"), page.indexOf("function WeightRoomRecentWorkouts"));
  const analyticsTable = page.slice(page.indexOf("function AnalyticsTable"), page.indexOf("function AnalyticsCellView"));
  const practiceColumns = page.slice(page.indexOf("function practiceMetricColumns"), page.indexOf("function practiceHittingSessionOptions"));
  const completedWorkout = page.slice(page.indexOf("function WeightRoomCompletedWorkoutSummary"), page.indexOf("function WeightRoomExerciseResults"));

  assert.match(weighInCard, /Weight \(lb\)/);
  assert.match(weighInCard, /<span role="columnheader">This<\/span>/);
  assert.match(weighInCard, /<span role="columnheader">\+\/-<\/span>/);
  assert.match(weighInCard, /<DensePlayerIdentity player=\{row\.player\} \/>/);
  assert.doesNotMatch(weighInCard, /PlayerAvatar|\$\{formatNumber\(row\.(thisWeek|lastWeek|starting), 1\)\} lb/);
  assert.match(analyticsTable, /<DensePlayerIdentity player=\{row\.player\} \/>/);
  assert.doesNotMatch(analyticsTable, /PlayerAvatar player=\{row\.player\}/);
  assert.doesNotMatch(analyticsTable, /\{sample && <small>/);
  assert.match(analyticsTable, /minmax\(132px, 1\.35fr\)/);
  assert.match(analyticsTable, /minTableWidth = Math\.max\(676, 144 \+ result\.columns\.length \* 64\)/);
  assert.match(analyticsTable, /analytics-team-mark/);
  assert.match(page, /cell\?\.display\?\.endsWith\("%"\) \? cell\.display\.slice\(0, -1\)/);
  assert.match(page, /Contact%": "CT%"/);
  assert.match(page, /"Avg EV": "AEV"/);
  assert.match(page, /analyticsWorkspace === "overview"/);
  assert.match(page, /<AnalyticsCharts/);
  assert.match(page, /analyticsWorkspace === "insights"/);
  assert.match(page, /<AnalyticsInsights\s+data=\{data\}\s+query=\{query\}\s+domain=\{insightsDomain\}/);
  assert.doesNotMatch(page, /<AnalyticsSummaryStrip result=\{result\}/);
  assert.match(practiceColumns, /render: \(row\) => <DensePlayerIdentity player=\{row\.player\} \/>/);
  assert.ok((completedWorkout.match(/<DensePlayerIdentity player=/g) ?? []).length >= 3);
  assert.match(css, /\.dense-player-identity[\s\S]*white-space:\s*nowrap/);
  assert.match(css, /\.dense-player-identity__jersey[\s\S]*flex:\s*0 0 auto/);
  assert.match(css, /\.analytics-box-score__row--team \{[\s\S]*border-top/);
  assert.doesNotMatch(css, /\.analytics-box-score__row--team \{\s*position: sticky/);
  assert.match(css, /\.weight-room-mini-table \{[\s\S]*gap:\s*0/);
});

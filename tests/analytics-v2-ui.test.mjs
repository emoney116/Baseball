import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("app/page.tsx", "utf8");
const css = readFileSync("app/globals.css", "utf8");
const catalog = readFileSync("app/lib/analyticsCatalog.ts", "utf8");

test("Analytics V2 removes the permanent mode split and exposes contextual views", () => {
  const analyticsView = page.slice(page.indexOf("function AnalyticsView"), page.indexOf("function AnalyticsSummaryStrip"));
  assert.doesNotMatch(analyticsView, /SegmentedControl values=\{\["box-score", "situational"\]/);
  assert.match(analyticsView, /className="analytics-view-tabs"/);
  assert.match(analyticsView, /result\.availableViews\.map/);
  assert.match(analyticsView, /statView/);
  assert.match(analyticsView, /serializeAnalyticsContext/);
});
test("Analytics V2 uses one filter panel with ranges, a location grid, and removable chips", () => {
  assert.match(page, /aria-label="Analytics filters"/);
  assert.match(page, /className="analytics-pitch-location-selector"/);
  assert.match(page, /className="analytics-filter-range"/);
  assert.match(page, /definition\.type === "range" \? \[\] :/);
  assert.match(page, /removeFilterValue\(chip\.id, chip\.value\)/);
  assert.match(page, /className="analytics-clear-filter-chip"/);
  assert.match(css, /\.analytics-pitch-location-selector\s*\{[\s\S]*grid-template-columns:\s*repeat\(3/);
});

test("Analytics V2 keeps stat-sheet density and converts panels to phone bottom sheets", () => {
  assert.match(css, /\.analytics-box-score__cell--player\s*\{[\s\S]*position:\s*sticky/);
  assert.match(css, /@media \(max-width: 720px\) \{[\s\S]*\.analytics-popover\s*\{[\s\S]*position:\s*fixed/);
  assert.match(css, /@media \(max-width: 720px\) \{[\s\S]*\.analytics-table-panel\s*\{[\s\S]*padding:\s*0/);
  assert.match(css, /\.analytics-sheet-scrim\s*\{[\s\S]*position:\s*fixed/);
  assert.match(page, /row\.rowKind === "group"/);
});

test("Analytics catalog centralizes views, metrics, filters, and presets", () => {
  assert.match(catalog, /ANALYTICS_VIEW_CATALOG/);
  assert.match(catalog, /ANALYTICS_METRICS/);
  assert.match(catalog, /ANALYTICS_FILTER_CATALOG/);
  assert.match(catalog, /ANALYTICS_COLUMN_PRESETS/);
  assert.match(catalog, /analyticsSourcesForDomain/);
  assert.match(catalog, /defaultAnalyticsMetricIds/);
});

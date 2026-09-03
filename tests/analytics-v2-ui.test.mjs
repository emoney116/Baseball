import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("app/page.tsx", "utf8");
const css = readFileSync("app/globals.css", "utf8");
const catalog = readFileSync("app/lib/analyticsCatalog.ts", "utf8");

test("Analytics exposes focused overview and chart workspaces", () => {
  const analyticsView = page.slice(page.indexOf("function AnalyticsView"), page.indexOf("function AnalyticsCharts"));
  assert.doesNotMatch(analyticsView, /SegmentedControl values=\{\["box-score", "situational"\]/);
  assert.match(analyticsView, /className="analytics-view-tabs"/);
  assert.match(analyticsView, /analyticsWorkspace === "overview"/);
  assert.match(analyticsView, /\["overview", "charts", "insights"\]/);
  assert.match(analyticsView, /className="analytics-domain-select"/);
  assert.match(analyticsView, /statView/);
  assert.match(analyticsView, /serializeAnalyticsContext/);
});
test("Analytics filter sheet stages values and reuses the canonical catcher-view location grid", () => {
  assert.match(page, /aria-label="Analytics filters"/);
  assert.match(page, /Catcher View/);
  assert.match(page, /PITCH_LOCATION_BUCKETS\.map/);
  assert.match(page, /analyticsLocationRegionForBucket/);
  assert.match(page, /className="analytics-filter-range"/);
  assert.match(page, /definition\.type === "range" \? \[\] :/);
  assert.match(page, /removeFilterValue\(chip\.id, chip\.value\)/);
  assert.match(page, /className="analytics-clear-filter-chip"/);
  assert.match(page, /setStagedFilters\(cloneAnalyticsFilters\(filters\)\)/);
  assert.match(page, /function applyStagedFilters/);
  assert.match(css, /\.analytics-filter-sheet__footer\s*\{/);
  assert.match(css, /\.analytics-filter-sheet__body\s*\{[\s\S]*overflow-y:\s*auto/);
});

test("Analytics workspace keeps chart controls with the selected chart and supports player groups", () => {
  assert.match(page, /analytics-workspace-tabs/);
  assert.match(page, /AnalyticsChartPlayerSelector/);
  assert.match(page, /aria-multiselectable="true"/);
  assert.match(page, /AnalyticsChartModes/);
  assert.match(page, /analytics-chart-surface-control/);
});

test("Analytics V2 keeps stat-sheet density and converts panels to phone bottom sheets", () => {
  assert.match(css, /\.analytics-box-score__cell--player\s*\{[\s\S]*position:\s*sticky/);
  assert.match(css, /@media \(max-width: 720px\) \{[\s\S]*\.analytics-popover\s*\{[\s\S]*position:\s*fixed/);
  assert.match(css, /@media \(max-width: 720px\) \{[\s\S]*\.analytics-table-panel\s*\{[\s\S]*padding:\s*0/);
  assert.match(css, /\.analytics-sheet-scrim\s*\{[\s\S]*position:\s*fixed/);
  assert.match(page, /row\.rowKind === "group"/);
});

test("Analytics columns upgrade legacy defaults and keep the wider catalog controllable", () => {
  assert.match(page, /LEGACY_ANALYTICS_STANDARD_COLUMNS/);
  assert.match(page, /isLegacyAnalyticsStandardColumns\(requestedMetricIds\)/);
  assert.match(page, /const visibleIds = current \?\? result\.columns\.map\(\(column\) => column\.metricId\)/);
  assert.match(page, /\[\.\.\.visibleIds, metricId\]/);
  assert.match(page, /url\.searchParams\.set\("columnPreset", columnPreset\)/);
  assert.match(css, /\.analytics-box-score\s*\{[\s\S]*overflow-x:\s*auto/);
  assert.match(page, /const minTableWidth = Math\.max\(660, 132 \+ result\.columns\.length \* 60\)/);
});

test("Analytics catalog centralizes views, metrics, filters, and presets", () => {
  assert.match(catalog, /ANALYTICS_VIEW_CATALOG/);
  assert.match(catalog, /ANALYTICS_METRICS/);
  assert.match(catalog, /ANALYTICS_FILTER_CATALOG/);
  assert.match(catalog, /ANALYTICS_COLUMN_PRESETS/);
  assert.match(catalog, /analyticsSourcesForDomain/);
  assert.match(catalog, /defaultAnalyticsMetricIds/);
});

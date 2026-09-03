import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("mobile productization primitives keep phone workflows compact and app-like", () => {
  const css = readFileSync("app/globals.css", "utf8");
  const mobileLayer = css.match(/\/\* Mobile productization Phase 1:[\s\S]*$/)?.[0] ?? "";

  assert.match(css, /--mobile-page-gutter:\s*clamp\(12px,\s*3\.6vw,\s*16px\)/);
  assert.match(css, /--mobile-control-height:\s*44px/);
  assert.match(css, /--mobile-primary-height:\s*48px/);
  assert.match(css, /--mobile-sheet-radius:\s*18px/);
  assert.match(css, /--mobile-bottom-nav-safe-space:\s*calc\(94px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /--mobile-practice-mode-nav-space:\s*calc\(158px \+ env\(safe-area-inset-bottom\)\)/);

  assert.match(mobileLayer, /@media \(max-width: 720px\) \{/);
  assert.match(mobileLayer, /\.ops-main\s*\{[\s\S]*padding:\s*var\(--mobile-page-gutter\) var\(--mobile-page-gutter\) var\(--mobile-bottom-nav-safe-space\)/);
  assert.match(mobileLayer, /\.ops-main--practice-tracking\s*\{[\s\S]*padding-bottom:\s*var\(--mobile-practice-mode-nav-space\)/);
  assert.match(mobileLayer, /\.modal-backdrop\s*\{[\s\S]*place-items:\s*end center/);
  assert.match(mobileLayer, /\.modal-panel,[\s\S]*\.weight-room-scoring-modal\s*\{[\s\S]*width:\s*min\(480px, calc\(100vw - 24px\)\)/);
  assert.match(mobileLayer, /\.modal-panel,[\s\S]*\.weight-room-scoring-modal\s*\{[\s\S]*border-radius:\s*var\(--mobile-sheet-radius\) var\(--mobile-sheet-radius\) 0 0/);
  assert.match(mobileLayer, /\.modal-title::before\s*\{[\s\S]*width:\s*38px/);

  assert.match(mobileLayer, /\.modal-actions \.primary-button\s*\{[\s\S]*min-height:\s*var\(--mobile-primary-height\)/);
  assert.match(mobileLayer, /\.modal-actions \.secondary-button,[\s\S]*\.modal-actions \.text-button\s*\{[\s\S]*width:\s*auto/);
  assert.match(mobileLayer, /\.modal-actions \.secondary-button,[\s\S]*\.modal-actions \.text-button\s*\{[\s\S]*min-height:\s*var\(--mobile-control-height-compact\)/);

  assert.match(mobileLayer, /\.analytics-summary-strip,[\s\S]*\.practice-hitting-metric-line\s*\{[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(mobileLayer, /\.analytics-scroll-panel\s*\{[\s\S]*max-height:\s*min\(60dvh, 520px\)/);
  assert.match(mobileLayer, /\.analytics-player-cell small\s*\{[\s\S]*display:\s*none/);
  assert.match(mobileLayer, /\.analytics-metric-key > div\s*\{[\s\S]*columns:\s*1/);
  assert.match(css, /\.account-appearance-setting \.segmented-control\s*\{[\s\S]*width:\s*fit-content/);
  assert.match(css, /\.account-appearance-setting \.segmented-control button\s*\{[\s\S]*min-height:\s*34px/);

  assert.match(mobileLayer, /\.practice-hitting-sheet__step--spray \.practice-spray-field,[\s\S]*\.practice-live-bp-sheet__step--spray \.practice-spray-field\s*\{[\s\S]*height:\s*clamp\(190px, 36dvh, 280px\)/);
  assert.match(mobileLayer, /\.modal-panel\.practice-pitching-sheet \.practice-pitch-location-grid,[\s\S]*\.modal-panel\.practice-pitching-stats-sheet \.practice-pitch-location-grid\s*\{[\s\S]*max-width:\s*360px/);
  assert.match(mobileLayer, /\.practice-hitting-sheet__spray-actions \.primary-button,[\s\S]*\.practice-live-bp-sheet__actions \.primary-button\s*\{[\s\S]*max-height:\s*var\(--mobile-primary-height\)/);
  assert.match(mobileLayer, /\.practice-console--active \.practice-hitting-player-card small,[\s\S]*\.practice-console--active \.practice-pitching-player-card small\s*\{[\s\S]*display:\s*none/);
  assert.match(mobileLayer, /\.practice-console--active \.practice-tracker-tabs\s*\{[\s\S]*bottom:\s*calc\(78px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(mobileLayer, /\.practice-console--active \.practice-tracker-tabs\s*\{[\s\S]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(mobileLayer, /\.practice-console--active \.practice-tracker-tabs button\s*\{[\s\S]*flex:\s*0 1 auto/);
  assert.match(mobileLayer, /\.practice-console--active \.practice-hitting-quick-controls button\s*\{[\s\S]*text-overflow:\s*ellipsis/);

  assert.match(mobileLayer, /\.roster-table-shell,[\s\S]*\.practice-pitching-breakdown-table\s*\{[\s\S]*overflow-x:\s*auto/);
  assert.match(mobileLayer, /\.mobile-more-menu,[\s\S]*\.mobile-pinned-menu\s*\{[\s\S]*bottom:\s*calc\(76px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(mobileLayer, /@media \(max-width: 430px\) \{[\s\S]*\.bottom-nav\s*\{[\s\S]*width:\s*min\(calc\(100vw - 20px\), calc\(var\(--bottom-nav-count, 5\) \* 62px\)\)/);
  assert.match(mobileLayer, /@media \(max-width: 430px\) \{[\s\S]*\.bottom-nav\s*\{[\s\S]*grid-template-columns:\s*repeat\(var\(--bottom-nav-count, 5\), minmax\(0, 1fr\)\)/);
  assert.match(mobileLayer, /@media \(max-width: 560px\) \{[\s\S]*\.bottom-nav\s*\{[\s\S]*width:\s*min\(calc\(100vw - 20px\), 360px\)/);
  assert.match(mobileLayer, /@media \(max-width: 560px\) \{[\s\S]*\.practice-console--active \.practice-tracker-tabs\s*\{[\s\S]*width:\s*min\(calc\(100vw - 20px\), 360px\)/);
  assert.match(mobileLayer, /@media \(max-width: 560px\) \{[\s\S]*\.practice-console--active \.practice-hitting-quick-controls,[\s\S]*\.practice-console--pitching \.practice-hitting-quick-controls\s*\{[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
});

test("phase two phone composition keeps live tracking focused on the next rep", () => {
  const css = readFileSync("app/globals.css", "utf8");
  const page = readFileSync("app/page.tsx", "utf8");
  const phase2Layer = css.match(/\/\* Mobile productization Phase 2:[\s\S]*$/)?.[0] ?? "";

  assert.match(page, /practiceModePickerOpen/);
  assert.match(page, /className="practice-mode-picker-trigger"/);
  assert.match(page, /className="practice-mode-select"/);
  assert.match(page, /mobilePresentation="popover"/);
  assert.match(page, /practice-hitting-more-trigger/);
  assert.match(page, /PracticeHittingChartCarousel/);
  assert.match(page, /PracticeHittingPitchLocationGrid/);
  assert.match(page, /Filter hitting charts by pitch type/);
  assert.match(page, /pitchFilters\.length/);
  assert.match(page, /trackHittingPitchLocation/);
  assert.match(page, /trackHittingPitchVelocity/);
  assert.match(page, /VelocityPickerField/);
  assert.match(page, /showAllPitchingPlayers \? "On" : "Off"/);

  assert.match(phase2Layer, /\.practice-mode-picker-trigger,[\s\S]*\.practice-tracking-control-trigger\s*\{[\s\S]*display:\s*none/);
  assert.match(phase2Layer, /@media \(max-width: 560px\) \{[\s\S]*\.practice-console--active \.practice-tracker-tabs\s*\{[\s\S]*display:\s*none/);
  assert.match(phase2Layer, /@media \(max-width: 560px\) \{[\s\S]*\.practice-mode-picker-trigger\s*\{[\s\S]*display:\s*grid/);
  assert.match(phase2Layer, /@media \(max-width: 560px\) \{[\s\S]*\.practice-console--active \.practice-hitting-quick-controls,[\s\S]*\.practice-console--pitching \.practice-hitting-quick-controls\s*\{[\s\S]*display:\s*none/);
  assert.match(phase2Layer, /@media \(max-width: 560px\) \{[\s\S]*\.practice-console--hitting \.practice-hitting-quick-controls\s*\{[\s\S]*display:\s*grid/);
  assert.match(phase2Layer, /@media \(max-width: 560px\) \{[\s\S]*\.practice-console--hitting \.practice-hitting-quick-controls\s*\{[\s\S]*grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(phase2Layer, /@media \(max-width: 360px\) \{[\s\S]*\.practice-console--hitting \.practice-hitting-quick-controls,[\s\S]*\.modal-panel\.practice-hitting-sheet \.practice-hitting-sheet__context-controls\s*\{[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(phase2Layer, /@media \(max-width: 560px\) \{[\s\S]*\.practice-console--hitting \.practice-tracking-control-trigger\s*\{[\s\S]*display:\s*none/);
  assert.match(phase2Layer, /@media \(max-width: 560px\) \{[\s\S]*\.ops-main--practice-tracking \.team-workspace-header--compact\s*\{[\s\S]*display:\s*none/);
  assert.match(phase2Layer, /@media \(max-width: 560px\) \{[\s\S]*\.practice-home \.practice-overview-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/);

  assert.match(page, /const analyticsScopeOptions: ChoiceOption\[\]/);
  assert.match(page, /className="analytics-primary-navigation"/);
  assert.match(page, /className="analytics-scope-select"/);
  assert.doesNotMatch(page, /className="analytics-domain-select-wrap"/);
  assert.doesNotMatch(page, /className="analytics-source-select-wrap"/);
  assert.match(css, /\.analytics-primary-navigation\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) 116px/);
  assert.match(css, /\.analytics-box-score__row\s*\{[\s\S]*width:\s*100%/);
  assert.match(css, /\.analytics-box-score__cell--player\s*\{[\s\S]*width:\s*144px/);
  assert.match(phase2Layer, /@media \(max-width: 560px\) \{[\s\S]*\.practice-console--active \.practice-hitting-metric-line,[\s\S]*\.practice-console--active \.practice-pitching-metric-line\s*\{[\s\S]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);

  assert.match(page, /"Knuckleball"/);
  assert.match(page, /function defaultPitchLocationMetricMode\(mode: PitchLocationGridMode\): PitchLocationMetricMode \{\s*void mode;\s*return "heat";\s*\}/);
  assert.match(page, /function pitchLocationHeatColor/);
  assert.match(page, /if \(mode === "heat"\) return "percent";/);
  assert.match(page, /if \(mode === "percent"\) return "count";/);
  assert.match(page, /return "heat";\s*\}/);
  assert.match(phase2Layer, /\.practice-pitch-location-grid--heat \.practice-pitch-location-grid__marker-layer i\s*\{[\s\S]*display:\s*none/);
  assert.match(css, /\.practice-pitch-location-grid--heat \.practice-pitch-location-grid__marker-layer i\s*\{[\s\S]*display:\s*none/);
  assert.match(css, /\.practice-hitting-live-charts__scroller\s*\{[\s\S]*scroll-snap-type:\s*x mandatory/);
  assert.match(css, /\.practice-spray-field__sector\s*\{/);
  assert.match(css, /\.practice-spray-field__sector-label text/);

  assert.match(phase2Layer, /@media \(max-width: 560px\) \{[\s\S]*\.weight-room-shell-header__identity \.organization-logo\s*\{[\s\S]*display:\s*none/);
  assert.match(phase2Layer, /@media \(max-width: 560px\) \{[\s\S]*\.weight-room-overview-grid,[\s\S]*\.weight-room-review-grid\s*\{[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(phase2Layer, /@media \(max-width: 560px\) \{[\s\S]*\.account-card--editable\s*\{[\s\S]*min-height:\s*auto/);
});

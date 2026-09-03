import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Ask Clubhouse mobile UI uses a full-screen assistant with stacked suggestions", () => {
  const page = readFileSync("app/page.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");

  assert.match(page, /function AskClubhouseLanding/);
  assert.match(page, /className="ask-suggestion-stack"/);
  assert.match(page, /Show more ideas/);
  assert.doesNotMatch(page, /className="ask-question-list"/);
  assert.match(page, /document\.body\.dataset\.askClubhouseOpen = "true"/);
  assert.match(page, /delete document\.body\.dataset\.askClubhouseOpen/);

  assert.match(css, /\.analytics-ask-backdrop/);
  assert.match(css, /@media \(max-width: 560px\) \{[\s\S]*\.analytics-ask-drawer\s*\{[\s\S]*height:\s*100dvh/);
  assert.match(css, /@media \(max-width: 560px\) \{[\s\S]*\.analytics-ask-drawer\s*\{[\s\S]*border-radius:\s*0/);
  assert.match(css, /body\[data-ask-clubhouse-open="true"\] \.bottom-nav/);
  assert.match(css, /body\[data-ask-clubhouse-open="true"\] \.analytics-ask-fab\s*\{[\s\S]*display:\s*none !important/);
  assert.match(css, /body\[data-ask-clubhouse-open="true"\]\s*\{[\s\S]*overflow:\s*hidden/);
  assert.match(css, /body\[data-ask-clubhouse-open="true"\] \.mobile-brand/);
  assert.match(css, /body\[data-ask-clubhouse-open="true"\] \.profile-menu--icon/);
  assert.match(css, /body\[data-ask-clubhouse-open="true"\] \.analytics-ask-fab/);
  assert.match(css, /@media \(max-width: 560px\) \{[\s\S]*\.analytics-ask-drawer\s*\{[\s\S]*grid-template-rows:\s*auto auto minmax\(0, 1fr\) auto/);
  assert.match(css, /@media \(max-width: 560px\) \{[\s\S]*\.analytics-ask-drawer\s*\{[\s\S]*position:\s*fixed/);
  assert.match(css, /@media \(max-width: 560px\) \{[\s\S]*\.analytics-ask-drawer\s*\{[\s\S]*inset:\s*0/);
  assert.match(css, /\.ask-suggestion-stack button,[\s\S]*\.ask-show-more\s*\{[\s\S]*grid-template-columns:\s*22px minmax\(0, 1fr\) 16px/);
  assert.match(css, /\.analytics-ask-drawer \.ask-composer\s*\{[\s\S]*border-top:\s*1px solid var\(--line\)/);
  assert.match(css, /@media \(max-width: 560px\) \{[\s\S]*\.analytics-ask-drawer \.ask-composer\s*\{[\s\S]*min-height:\s*calc\(62px \+ env\(safe-area-inset-bottom\)\)/);
});

test("Ask Clubhouse UI supports structured answers and deduped setup/error states", () => {
  const page = readFileSync("app/page.tsx", "utf8");

  assert.match(page, /type AskClubhouseUiPayload/);
  assert.match(page, /function AskClubhouseRankingAnswer/);
  assert.match(page, /function AskClubhouseComparisonAnswer/);
  assert.match(page, /function AskClubhouseTextRanking/);
  assert.match(page, /function stripAskMarkdownInline/);
  assert.match(page, /function parseAskClubhouseTextAnswer/);
  assert.match(page, /function AskClubhouseStatusCard/);
  assert.match(page, /function dedupeAskClubhouseMessages/);
  assert.match(page, /normalizeAskContent\(message\.content\) === normalizeAskContent\(error\)/);
  assert.match(page, /ASK_CLUBHOUSE_GENERIC_STAGE = "Analyzing your Clubhouse data\.\.\."/);
});

test("Ask Clubhouse keeps launch suggestions on landing and follow-ups on only the latest answer", () => {
  const page = readFileSync("app/page.tsx", "utf8");

  assert.match(page, /ASK_CLUBHOUSE_UI_SUGGESTIONS/);
  assert.doesNotMatch(page, /Which teams need my attention\?/);
  assert.doesNotMatch(page, /What should we watch next game\?/);
  assert.match(page, /Who has the highest Practice Contact %\?/);
  assert.match(page, /Show our latest Practice summary/);
  assert.match(page, /function AskClubhouseFollowUps/);
  assert.match(page, /showFollowUps=\{message\.id === lastAssistantId\}/);
  assert.match(page, /showFollowUps && <AskClubhouseFollowUps/);
});

test("Ask Clubhouse exposes shared launch surfaces and authorized team scope controls", () => {
  const page = readFileSync("app/page.tsx", "utf8");

  assert.match(page, /function AskClubhouseLauncher/);
  assert.match(page, /function AskClubhouseScopeSelector/);
  assert.match(page, /<span>Data from<\/span>/);
  assert.match(page, /role="menuitemcheckbox"/);
  assert.match(page, /openAskClubhouse\("clubhouse_home"\)/);
  assert.match(page, /openAskClubhouse\("team_home"\)/);
  assert.match(page, /openAskClubhouse\("practice"\)/);
  assert.match(page, /openAskClubhouse\("weight_room"\)/);
  assert.match(page, /openAskClubhouse\("games"\)/);
  assert.match(page, /openAskClubhouse\("analytics"/);
  assert.doesNotMatch(page, /className="ask-header__back"/);
});

test("Ask Clubhouse answer styles include hierarchy and flat text rankings", () => {
  const css = readFileSync("app/globals.css", "utf8");
  const page = readFileSync("app/page.tsx", "utf8");

  assert.match(css, /\.ask-answer-primary\s*\{/);
  assert.match(css, /\.ask-answer-scope\s*\{/);
  assert.match(css, /\.ask-data-note\s*\{/);
  assert.match(css, /\.ask-ranking--text\s*\{/);
  assert.match(css, /\.ask-header__close-button\s*\{/);
  assert.match(css, /\.ask-header\s*\{[\s\S]*grid-template-columns:\s*minmax\(96px, 1fr\) minmax\(0, auto\) minmax\(96px, 1fr\)/);
  assert.match(css, /\.ask-scope-menu\s*\{[\s\S]*top:\s*calc\(100% \+ 6px\)/);
  assert.match(page, /function AskClubhouseVisualAnswers/);
  assert.match(page, /<ClubhouseBaseballField/);
  assert.match(page, /showTrajectories=\{mode === "spray"\}/);
  assert.match(page, /<StrikeZone points=\{visual\.points\}/);
  assert.match(page, /encodeAnalyticsFilters\(next\.filters\)/);
  assert.match(page, /visualContext: askVisualContext/);
  assert.match(css, /\.ask-visual-card\s*\{/);
  assert.match(css, /\.ask-visual-card__modes\s*\{/);
});

test("Ask Clubhouse visual answers keep metric strips single-row and suppress redundant tool evidence", () => {
  const source = readFileSync("app/page.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");

  assert.match(source, /const metrics = visual\.metrics\?\.slice\(0, 5\) \?\? \[\]/);
  assert.doesNotMatch(source, /\{metric\.sample && <small>\{metric\.sample\}<\/small>\}/);
  assert.match(source, /!message\.visuals\?\.length[\s\S]*item\.title\.startsWith\("Baseball Knowledge"\)/);
  assert.match(css, /grid-template-columns: repeat\(var\(--ask-visual-metric-count, 1\), minmax\(0, 1fr\)\)/);
});

test("Ask Clubhouse mock states are local development only", () => {
  const page = readFileSync("app/page.tsx", "utf8");

  assert.match(page, /function readInitialAskClubhouseFixture/);
  assert.match(page, /process\.env\.NODE_ENV === "production"/);
  assert.match(page, /params\.get\("askMock"\) \?\? params\.get\("askState"\)/);
  assert.match(page, /case "ranking":/);
  assert.match(page, /case "comparison":/);
  assert.match(page, /case "web-loading":/);
  assert.match(page, /case "low-sample":/);
  assert.match(page, /case "rule":/);
  assert.match(page, /case "setup":/);
  assert.match(page, /case "error":/);
});

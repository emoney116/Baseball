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

  assert.match(css, /\.analytics-ask-backdrop/);
  assert.match(css, /@media \(max-width: 560px\) \{[\s\S]*\.analytics-ask-drawer\s*\{[\s\S]*height:\s*100dvh/);
  assert.match(css, /@media \(max-width: 560px\) \{[\s\S]*\.analytics-ask-drawer\s*\{[\s\S]*border-radius:\s*0/);
  assert.match(css, /\.ask-suggestion-stack button,[\s\S]*\.ask-show-more\s*\{[\s\S]*grid-template-columns:\s*22px minmax\(0, 1fr\) 16px/);
  assert.match(css, /\.analytics-ask-drawer \.ask-composer\s*\{[\s\S]*border-top:\s*1px solid var\(--line\)/);
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

test("Ask Clubhouse suggestions stay on the landing state instead of repeating after answers", () => {
  const page = readFileSync("app/page.tsx", "utf8");

  assert.match(page, /ASK_CLUBHOUSE_UI_SUGGESTIONS/);
  assert.doesNotMatch(page, /function AskClubhouseFollowUps/);
  assert.doesNotMatch(page, /<AskClubhouseFollowUps/);
});

test("Ask Clubhouse answer styles include hierarchy and flat text rankings", () => {
  const css = readFileSync("app/globals.css", "utf8");

  assert.match(css, /\.ask-answer-primary\s*\{/);
  assert.match(css, /\.ask-answer-scope\s*\{/);
  assert.match(css, /\.ask-data-note\s*\{/);
  assert.match(css, /\.ask-ranking--text\s*\{/);
  assert.match(css, /\.ask-header__close-button\s*\{/);
});

test("Ask Clubhouse mock states are local development only", () => {
  const page = readFileSync("app/page.tsx", "utf8");

  assert.match(page, /function readInitialAskClubhouseFixture/);
  assert.match(page, /process\.env\.NODE_ENV === "production"/);
  assert.match(page, /params\.get\("askMock"\) \?\? params\.get\("askState"\)/);
  assert.match(page, /case "ranking":/);
  assert.match(page, /case "comparison":/);
  assert.match(page, /case "setup":/);
  assert.match(page, /case "error":/);
});

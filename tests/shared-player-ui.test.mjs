import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const player = readFileSync("app/components/PlayerShell.tsx", "utf8");
const staff = readFileSync("app/page.tsx", "utf8");
const drawer = readFileSync("app/components/AskClubhouseDrawer.tsx", "utf8");

test("staff and player use one Ask renderer rather than independent dialogs", () => {
  for (const source of [staff, player]) {
    assert.match(source, /import \{ AskClubhouseDrawer/);
    assert.match(source, /<AskClubhouseDrawer/);
    assert.doesNotMatch(source, /function AskClubhouseDrawer/);
  }
  assert.doesNotMatch(player, /player-beta-ask|player-beta-answer|dialog\.current/);
  assert.match(drawer, /function stripAskMarkdownInline/);
  assert.match(drawer, /function AskClubhouseVisualAnswers/);
  assert.match(drawer, /createPortal\(/);
});
test("shared Ask presentation does not weaken player scope or add team-wide suggestions", () => {
  assert.match(player, /includeDefaultSuggestions=\{false\}/);
  assert.match(player, /playerIds: \[context\.playerId\]/);
  assert.match(player, /viewerPlayerId: context\.playerId/);
  assert.match(player, /session\.access\?\.capabilities\.canUseAskClubhouse/);
  assert.doesNotMatch(player, /setSession\([^\n]*FULL_PLAYER/);
});
test("player conversation invalidates old replies on reset, context change and revoked access", () => {
  assert.match(player, /request !== askGeneration\.current/);
  assert.match(player, /seq !== contextGeneration\.current/);
  assert.match(player, /askInFlight\.current\) return/);
  assert.match(player, /function resetAsk\(\)[\s\S]*?askGeneration\.current\+\+/);
  assert.match(player, /p\.context\?\.membershipId !== c\?\.membershipId/);
  assert.match(player, /setAskMessages\(\[\]\)/);
  assert.match(player, /messages: history\.map/);
});
test("player analytics actions retain filters while approved context owns identity", () => {
  const handler = player.slice(player.indexOf("function openAskAnalytics"), player.indexOf("async function askQuestion"));
  assert.match(handler, /canViewOwnAnalytics/);
  assert.match(handler, /customDateRange: action\.query\.customDateRange/);
  assert.doesNotMatch(handler, /setSession|action\.playerId|action\.query\.context|action\.query\.playerIds/);
});
test("navigation, personal metrics and selectors share the staff components", () => {
  for (const name of ["ClubhouseBottomNav", "AnalyticsPlayerMetrics", "ChoiceSelect", "ScheduleAgendaRow", "DensePlayerIdentity"]) {
    assert.match(player, new RegExp("<" + name));
    assert.match(staff, new RegExp("<" + name));
  }
  assert.doesNotMatch(player, /className="player-beta-nav"/);
  assert.doesNotMatch(staff, /function ChoiceSelect/);
  assert.match(player, /domain === "development" \? "all" : source/);
  assert.match(player, /defaultAnalyticsMetricIds\(domain, analyticsSource\)/);
});
test("Ask preview answers require development fixtures and cannot replace hosted answers", () => {
  assert.match(player, /preview && \(!previewReply \|\| process\.env\.NODE_ENV !== "development"\)/);
  assert.match(player, /preview \? new Response\(JSON\.stringify\(previewReply\)\) : await fetch\("\/api\/ai\/chat"/);
  assert.match(readFileSync("app/player-preview/page.tsx", "utf8"), /process\.env\.NODE_ENV !== "development"\) notFound\(\)/);
});

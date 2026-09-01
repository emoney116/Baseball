import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../app/game-session.css", import.meta.url), "utf8");
const globalCss = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const visuals = fs.readFileSync(new URL("../app/components/visuals.tsx", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const centerBaseball = new URL("../public/game-tracking/baseball-center-control-v1.png", import.meta.url);

test("active games render as an immersive session with a deliberate exit", () => {
  assert.match(page, /game-session-active/);
  assert.match(page, />Exit game</);
  assert.match(page, />Score</);
  assert.match(page, />Our Team</);
  assert.match(page, />Opponent</);
  assert.match(page, />Plays</);
  assert.match(page, />Stats</);
  assert.match(page, /game-session-bottom-nav/);
  assert.match(page, /GameFieldCommand/);
  assert.match(page, /Record the next pitch/);
  assert.match(css, /\.ops-shell:has\(\.game-session-active\)/);
  assert.match(css, /height:\s*100dvh/);
  assert.match(layout, /import "\.\/game-session\.css";/);
});

test("the field-first score lane and scoring decisions stay in one viewport", () => {
  assert.match(css, /Field-first command surface overrides/);
  assert.match(css, /\.game-session-active,\s*\.ops-main:has\(\.game-session-active\)\s*\{\s*overflow:\s*hidden/);
  assert.match(css, /\.game-session-active \.game-workstation[\s\S]*?height:\s*calc\(100dvh - 20px\)/);
  assert.match(css, /\.game-session-active \.game-context-sheet\s*\{\s*overflow-y:\s*auto/);
  assert.match(css, /\.game-session-active \.game-context-sheet--scoring\s*\{[\s\S]*?overflow:\s*hidden/);
  assert.match(css, /Every live scoring decision fits as a single app screen/);
  assert.match(css, /max-height:\s*48dvh/);
  assert.match(css, /game-context-sheet--scoring \.game-flow-steps\s*\{?[\s\S]*?display:\s*none/);
  assert.match(globalCss, /\.game-field-command\s*\{[^}]*grid-template-rows:\s*auto minmax\(0,1fr\) auto/);
  assert.match(globalCss, /\.game-context-sheet--scoring/);
});

test("game session exposes reversible correction and mobile base controls", () => {
  assert.match(page, /Correct latest pitch/);
  assert.match(page, /Undo latest event/);
  assert.match(page, /History & Corrections/);
  assert.match(page, /setSessionDrawer\("bases"\)/);
  assert.match(css, /\.game-session-drawer-layer/);
});

test("scorekeeper branches into pitch-first detail for balls in play", () => {
  assert.match(page, /useState<"result" \| "play" \| "location" \| "pitch">\("result"\)/);
  assert.match(page, /\["result", "pitch", "location", "play"\]/);
  assert.match(page, /\["result", "location", "pitch"\]/);
  assert.match(page, /Record the call first, then add location and pitch detail/);
  assert.match(page, /Choose the pitch to continue to location/);
  assert.match(page, /The batter result opens automatically after both selections/);
  assert.match(page, /Confirm play/);
});

test("field tracking renders the generated field asset, spray line, and draggable runners", () => {
  assert.match(visuals, /field-chart__image/);
  assert.match(globalCss, /baseball-field-spray-chart-v1\.png/);
  assert.match(globalCss, /aspect-ratio:\s*1 \/ 1/);
  assert.match(visuals, /field-chart__spray-line/);
  assert.match(page, /draggable=\{Boolean\(runner\)\}/);
  assert.match(page, /onMoveRunner/);
  assert.match(page, /if \(!player\) return null/);
  assert.match(page, /baseball-center-control-v1\.png/);
  assert.ok(fs.statSync(centerBaseball).size > 0);
  assert.match(css, /game-base-diamond > button\.occupied[\s\S]*?width:\s*44px/);
  assert.match(globalCss, /game-field-command__runners \.game-base-diamond\s*\{[^}]*height:\s*40%;[^}]*top:\s*70%;[^}]*width:\s*44%/);
  assert.match(globalCss, /button\[data-base="second"\][^}]*top:\s*0;[^}]*translate\(-50%,-50%\)/);
  assert.match(globalCss, /button\[data-base="first"\][^}]*right:\s*0;[^}]*translate\(50%,-50%\)/);
  assert.match(page, /GAME_FIELD_POSITION_COORDINATES/);
  assert.match(page, /P:\s*\[50,\s*61\], C:\s*\[50,\s*92\], "1B":\s*\[85,\s*58\], "2B":\s*\[68,\s*40\], "3B":\s*\[15,\s*58\]/);
  assert.match(page, /data-position=\{position\}/);
  assert.match(globalCss, /\.game-field-player\s*\{[^}]*height:\s*44px;[^}]*max-width:\s*58px;[^}]*min-width:\s*58px;[^}]*text-align:\s*center;[^}]*width:\s*58px/);
  assert.match(globalCss, /clip-path:\s*polygon\(0 0, 100% 0, 100% 45%, 50% 100%, 0 45%\)/);
});

test("compact desktop uses the full scorer width and moves bases into the drawer", () => {
  assert.match(css, /@media \(max-width: 1180px\)[\s\S]*?\.game-session-active \.game-scorekeeper-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(css, /@media \(max-width: 1180px\)[\s\S]*?\.game-session-active \.game-scorekeeper-layout \.game-bases-console\s*\{[^}]*display:\s*none/);
  assert.match(css, /@media \(max-width: 1180px\)[\s\S]*?\.game-session-bases-trigger\s*\{[^}]*display:\s*inline-flex/);
  assert.match(css, /@media \(min-width: 761px\) and \(max-height: 720px\)[\s\S]*?\.game-session-active \.game-inning-state\s*\{[^}]*display:\s*flex/);
});

test("analysis view has no branded live model banner", () => {
  assert.doesNotMatch(page, /Tendex Live Model/);
  assert.doesNotMatch(page, /Live Tendex/);
});

test("location, heatmap, and spray evidence share category colors and legends", () => {
  assert.match(page, /GAME_CONTACT_TYPE_COLOR_VARS/);
  assert.match(page, /PITCH_TYPE_COLOR_VARS\[type\]/);
  assert.match(page, /category: PITCH_TYPE_LABELS\[type\]/);
  assert.match(page, /category: contact/);
  assert.match(page, /GameChartLegend label="Pitch type colors"/);
  assert.match(page, /GameChartLegend label="Contact type colors"/);
  assert.match(page, /game-contact-result-table/);
  assert.match(page, /game-contact-result-row/);
  assert.match(globalCss, /game-context-sheet--analysis \.game-context-sheet__bar\s*\{[^}]*position:\s*relative/);
  assert.match(visuals, /type CategorizedZonePoint/);
  assert.match(visuals, /data-category=\{point\.category\}/);
  assert.match(globalCss, /--contact-type-ground:/);
  assert.match(globalCss, /--contact-type-line:/);
  assert.match(globalCss, /--contact-type-fly:/);
  assert.match(globalCss, /--contact-type-popup:/);
  assert.match(globalCss, /--contact-type-bunt:/);
  assert.match(globalCss, /var\(--point-color/);
});

test("game operations support auditable personnel changes and scored-run reasons", () => {
  assert.match(page, /GamePersonnelWorkbench/);
  assert.match(page, /Save lineup & field/);
  assert.match(page, /eventKind: "substitution"/);
  assert.match(page, /Why did the runner score\?/);
  assert.match(page, /scoringReason: reason/);
  assert.match(page, /Confirm run/);
  assert.match(globalCss, /\.game-base-diamond > button/);
  assert.doesNotMatch(globalCss, /\.game-base-diamond button\s*\{/);
  assert.match(page, /Zone Heatmap/);
  assert.match(page, /Spray Chart/);
  assert.doesNotMatch(page, /Next Pitch Read/);
});

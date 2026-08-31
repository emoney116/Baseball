import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../app/game-session.css", import.meta.url), "utf8");
const globalCss = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const visuals = fs.readFileSync(new URL("../app/components/visuals.tsx", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

test("active games render as an immersive session with a deliberate exit", () => {
  assert.match(page, /game-session-active/);
  assert.match(page, />Exit game</);
  assert.match(page, />Score</);
  assert.match(page, />Analyze</);
  assert.match(css, /\.ops-shell:has\(\.game-session-active\)/);
  assert.match(css, /height:\s*100dvh/);
  assert.match(layout, /import "\.\/game-session\.css";/);
});

test("the session allows natural page scrolling while each scoring transition is brought into view", () => {
  assert.match(css, /\.ops-main:has\(\.game-session-active\)[\s\S]*?overflow:\s*visible/);
  assert.match(css, /\.game-session-active \.game-live-shell[\s\S]*?overflow:\s*visible/);
  assert.doesNotMatch(css, /\.ops-main:has\(\.game-session-active\)\s*\{[^}]*overflow:\s*hidden/);
  assert.match(page, /scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/);
});

test("game session exposes reversible correction and mobile base controls", () => {
  assert.match(page, /Correct latest pitch/);
  assert.match(page, /Undo latest event/);
  assert.match(page, /History & Corrections/);
  assert.match(page, /setSessionDrawer\("bases"\)/);
  assert.match(css, /\.game-session-drawer-layer/);
});

test("scorekeeper starts with outcome and records pitch detail last", () => {
  assert.match(page, /useState<"result" \| "play" \| "location" \| "pitch">\("result"\)/);
  assert.match(page, /\["result", "play", "location", "pitch"\]/);
  assert.match(page, /Record the call first, then add location and pitch detail/);
  assert.match(page, /Final step · \{pendingPitchOutcome\}/);
});

test("field tracking renders the generated field asset, spray line, and draggable runners", () => {
  assert.match(visuals, /field-chart__image/);
  assert.match(globalCss, /baseball-field-spray-chart-v1\.png/);
  assert.match(globalCss, /aspect-ratio:\s*1 \/ 1/);
  assert.match(visuals, /field-chart__spray-line/);
  assert.match(page, /draggable=\{Boolean\(runner\)\}/);
  assert.match(page, /onMoveRunner/);
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

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const css = fs.readFileSync(new URL("../app/theme.css", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

test("theme palette uses true white and #111111 neutral canvases", () => {
  assert.match(layout, /import "\.\/globals\.css";\s*import "\.\/theme\.css";/);
  assert.match(css, /--canvas:\s*#111111;/);
  assert.match(css, /\[data-theme="light"\][\s\S]*?--canvas:\s*#ffffff;/);
  assert.match(css, /--text-primary:\s*#ffffff;/);
  assert.match(css, /\[data-theme="light"\][\s\S]*?--text-primary:\s*#111111;/);
});

test("live Tendex status is neutral instead of green", () => {
  assert.doesNotMatch(page, /Tendex Live Model|Live Tendex/);
  const neutralStatus = css.match(/\.game-live-badge::before,[\s\S]*?\.game-live-pulse\s*\{[\s\S]*?\}/)?.[0] ?? "";
  assert.match(neutralStatus, /background:\s*var\(--muted\)/);
  assert.doesNotMatch(neutralStatus, /#36b77a/);
});

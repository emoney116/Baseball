// Browser fixtures only. No credentials, production API calls, or persisted baseball rows.
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  openSync,
  closeSync,
} from "node:fs";
import assert from "node:assert/strict";
const cli = process.argv[2];
if (!cli) throw new Error("Pass the installed agent-browser CLI path.");
const base = "http://localhost:3110",
  out = "outputs/clu948";
mkdirSync(out, { recursive: true });
const results = [];
let commandNumber = 0;
function browser(...args) {
  // On Windows the detached browser daemon inherits pipes and keeps spawnSync open.
  const path = `${out}/command-${commandNumber++}.log`,
    fd = openSync(path, "w");
  try {
    execFileSync(process.execPath, [cli, "--session", "clu948", ...args], {
      stdio: ["ignore", fd, fd],
      timeout: 45000,
    });
  } finally {
    closeSync(fd);
  }
  return readFileSync(path, "utf8").trim();
}
const evaluate = (code) => JSON.parse(browser("eval", code));
function until(expression) {
  for (let i = 0; i < 25; i++) {
    if (evaluate(expression)) return;
    browser("wait", "250");
  }
  throw new Error(`Timed out: ${expression}`);
}
const modeSelect = ".live-qa-controls label:nth-of-type(1) select",
  domainSelect = ".live-qa-controls label:nth-of-type(2) select";
function button(name) {
  browser("find", "role", "button", "click", "--name", name, "--exact");
}
function checkLayout() {
  const d = evaluate(
    `({width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('.player-live-section input,.player-live-section select,.player-live-section button')].filter(e=>{const r=e.getBoundingClientRect();return r.width&& (r.left<0||r.right>innerWidth+1)}).length})`,
  );
  assert.ok(d.scroll <= d.width);
  assert.equal(d.overflow, 0);
}
try {
  for (const [width, height] of [
    [390, 844],
    [430, 932],
    [820, 1180],
    [1180, 820],
  ]) {
    browser("set", "viewport", String(width), String(height));
    browser("open", `${base}/player-live-preview`);
    browser("snapshot");
    until(
      `document.querySelector('.player-live-section')?.textContent.includes('Waiting on coach')`,
    );
    checkLayout();
    browser("screenshot", `${out}/waiting-${width}.png`);
    results.push({ width, height, case: "Practice waiting", pass: true });
    browser("select", domainSelect, "workout");
    until(
      `document.querySelector('.player-live-section')?.textContent.includes('Waiting on coach to begin Weight Room')`,
    );
    results.push({ width, height, case: "Weight Room waiting", pass: true });
    button("Coach: Start Session");
    until(`!!document.querySelector('.player-live-form')`);
    for (const domain of ["hitting", "pitching", "defense", "workout"]) {
      browser("select", domainSelect, domain);
      browser("snapshot");
      for (const mode of ["TRACK_AND_VIEW", "FULL_PLAYER", "VIEW_ONLY"]) {
        browser("select", modeSelect, mode);
        until(
          mode === "VIEW_ONLY"
            ? `document.querySelector('.player-live-section')?.textContent.includes('View Only. Live entry is not permitted.')`
            : `!!document.querySelector('.player-live-form')`,
        );
        if (mode !== "VIEW_ONLY") {
          if (domain !== "workout")
            browser(
              "select",
              '[aria-label="Result"]',
              domain === "hitting"
                ? "Miss"
                : domain === "pitching"
                  ? "Whiff"
                  : "Clean",
            );
          button(domain === "workout" ? "Save Set" : "Save Rep");
          until(
            `document.querySelector('.player-live-message')?.textContent.includes('saved')`,
          );
          assert.ok(
            evaluate(`!!document.querySelector('.player-live-recent')`),
          );
        } else
          assert.equal(
            evaluate(`document.querySelectorAll('.player-live-form').length`),
            0,
          );
        checkLayout();
        browser(
          "screenshot",
          `${out}/${domain}-${mode.toLowerCase()}-${width}.png`,
        );
        results.push({ width, height, case: `${domain} ${mode}`, pass: true });
      }
    }
    browser("select", modeSelect, "TRACK_AND_VIEW");
    until(`!!document.querySelector('.player-live-form')`);
    button("Coach: End Session");
    until(
      `document.querySelector('.player-live-section')?.textContent.includes('Session ended')`,
    );
    assert.equal(
      evaluate(`document.querySelectorAll('.player-live-form').length`),
      0,
    );
    results.push({ width, height, case: "Stale session end", pass: true });
    button("Coach: Start Session");
    until(`!!document.querySelector('.player-live-form')`);
    button("Coach: Revoke Link");
    until(`!document.querySelector('.player-live-form')`);
    results.push({ width, height, case: "Revoked link", pass: true });
    button("Coach: Approve Link");
    until(`!!document.querySelector('.player-live-form')`);
    browser("select", ".live-qa-controls label:nth-of-type(3) select", "B");
    until(`!document.querySelector('.player-live-form')`);
    results.push({ width, height, case: "Team isolation", pass: true });
    browser("click", ".coach-live-entry summary");
    browser("snapshot");
    assert.equal(
      evaluate(`document.querySelector('.coach-live-entry').open`),
      true,
    );
    checkLayout();
    browser("screenshot", `${out}/coach-settings-${width}.png`);
    results.push({ width, height, case: "Coach enable controls", pass: true });
    console.log(`${width}x${height}: all live-entry fixture cases passed`);
  }
  const errors = browser("errors");
  assert.doesNotMatch(errors, /Error:|Uncaught/);
  console.log(
    JSON.stringify({
      cases: results.length,
      passed: results.length,
      output: out,
    }),
  );
} finally {
  writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  browser("close");
}

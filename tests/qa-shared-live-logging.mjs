// Local fixtures only; all non-local network requests are blocked.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const base = process.argv[3] ?? "http://localhost:3120";
assert.equal(new URL(base).hostname, "localhost");
const out = "outputs/shared-live-logging";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const cases = [], errors = [];
try {
  const context = await browser.newContext();
  await context.route("**/*", route => new URL(route.request().url()).hostname === "localhost" ? route.continue() : route.abort());
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  const button = name => page.getByRole("button", { name, exact: true });
  const visible = async locator => locator.waitFor({ state: "visible", timeout: 15000 });
  const form = page.locator(".player-live-form");
  for (const [width, height] of [[390,844],[430,932],[820,1180],[1180,820]]) {
    await page.setViewportSize({ width, height });
    await page.goto(base + "/player-live-preview");
    await visible(page.getByText("Waiting on coach to begin Practice session.", { exact: true }));
    await page.getByLabel("Domain", { exact: true }).selectOption("workout");
    await visible(page.getByText("Waiting on coach to begin Weight Room session.", { exact: true }));
    cases.push({ width, case: "Practice and workout waiting", passed: true });
    await button("Coach: Start Session").click();
    for (const domain of ["hitting", "pitching", "defense", "workout"]) {
      await page.getByLabel("Domain", { exact: true }).selectOption(domain);
      for (const mode of ["TRACK_AND_VIEW", "FULL_PLAYER", "VIEW_ONLY"]) {
        await page.getByLabel("Access Mode", { exact: true }).selectOption(mode);
        if (mode === "VIEW_ONLY") {
          await visible(page.getByText("View Only. Live entry is not permitted.", { exact: true }));
          assert.equal(await form.count(), 0);
        } else {
          await visible(form);
          if (domain === "workout") {
            await form.getByLabel("lbs", { exact: true }).fill("185");
            await form.getByLabel("reps", { exact: true }).fill("5");
          } else {
            await form.getByRole("group", { name: "Result", exact: true }).getByRole("button", { name: domain === "hitting" ? "Miss" : domain === "pitching" ? "Whiff" : "Clean", exact: true }).click();
          }
          await button(domain === "workout" ? "Save Set" : "Save Rep").click();
          await visible(page.getByText(domain === "workout" ? "Set saved." : "Rep saved. Ready for the next one.", { exact: true }));
          assert.equal(await page.locator(".player-live-recent").count(), 1);
          if (domain === "workout" && mode === "TRACK_AND_VIEW") {
            await page.locator(".player-live-recent summary").click();
            await button("Correct your entry").first().click();
            assert.equal(await form.getByLabel("lbs", { exact: true }).inputValue(), "185");
            await form.getByLabel("lbs", { exact: true }).fill("190");
            await button("Save Correction").click();
            await visible(page.getByText("Correction saved.", { exact: true }));
            await visible(page.getByText(/Set 1 · Completed · 190 lb/));
          }
        }
        const layout = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, overflow: [...document.querySelectorAll(".player-live-section input,.player-live-section select,.player-live-section button")].filter(el => { const r = el.getBoundingClientRect(); return r.width && (r.left < 0 || r.right > innerWidth + 1); }).length }));
        assert.ok(layout.scroll <= layout.width + 1, JSON.stringify(layout));
        assert.equal(layout.overflow, 0);
        await page.screenshot({ path: `${out}/${domain}-${mode}-${width}.png` });
        cases.push({ width, domain, mode, passed: true });
      }
    }
    await page.getByLabel("Access Mode", { exact: true }).selectOption("TRACK_AND_VIEW");
    await visible(form);
    await button("Coach: End Session").click();
    await visible(page.getByText(/Session ended or assignment changed/));
    assert.equal(await form.count(), 0);
    await button("Coach: Start Session").click();
    await visible(form);
    await button("Coach: Revoke Link").click();
    await form.waitFor({ state: "detached", timeout: 15000 });
    await button("Coach: Approve Link").click();
    await visible(form);
    await page.getByLabel("Team", { exact: true }).selectOption("B");
    await form.waitFor({ state: "detached", timeout: 15000 });
    cases.push({ width, case: "Session end, revoke, and team isolation", passed: true });
    console.log(`${width}: live logging and access transitions passed`);
  }
  assert.deepEqual(errors, []);
} finally {
  writeFileSync(`${out}/results.json`, JSON.stringify({ cases, errors }, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ passed: cases.length, errors }));

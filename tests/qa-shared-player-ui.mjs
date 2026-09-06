// Isolated local fixtures only. Pass the installed Playwright module path.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const base = process.argv[3] ?? "http://localhost:3120";
assert.equal(new URL(base).hostname, "localhost");
const out = "outputs/shared-role-ui";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const rows = [], errors = [];
try {
  const context = await browser.newContext();
  await context.route("**/*", route => new URL(route.request().url()).hostname === "localhost" ? route.continue() : route.abort());
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  const layout = async () => {
    const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(size.scroll <= size.width + 1, JSON.stringify(size));
  };
  for (const [width, height] of [[390, 844], [430, 932], [820, 1180], [1180, 820], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    for (const mode of ["VIEW_ONLY", "TRACK_AND_VIEW", "FULL_PLAYER"]) {
      await page.goto(base + "/player-preview?askFixture=1&access=" + mode);
      await page.getByRole("button", { name: "Ask Clubhouse", exact: true }).waitFor();
      await layout();
      assert.equal(await page.locator(".player-self-tracking").count(), mode === "VIEW_ONLY" ? 0 : 1);
      await page.screenshot({ path: out + "/home-" + mode + "-" + width + ".png" });
      await page.getByRole("button", { name: "Ask Clubhouse", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Ask Clubhouse" });
      await dialog.waitFor();
      const newChatRect = await dialog.getByRole("button", { name: "Start a new Ask Clubhouse chat" }).boundingBox();
      assert.equal(newChatRect.width, 38);
      assert.equal(newChatRect.height, 38);
      assert.equal(await dialog.locator(".ask-suggestion-stack button").count(), 4);
      assert.equal(await page.getByRole("navigation", { name: "Player navigation" }).isVisible(), false);
      await dialog.getByRole("textbox", { name: "Ask a question" }).fill("How did I hit in Practice today?");
      await dialog.getByRole("button", { name: "Send Ask Clubhouse message" }).click();
      await dialog.getByText("Today in practice, you had 4 tracked swings:", { exact: true }).waitFor();
      assert.equal(await dialog.getByRole("textbox").inputValue(), "");
      assert.equal((await dialog.innerText()).includes("**"), false);
      assert.equal(await dialog.locator(".ask-visual-card").count(), 1);
      const rect = await dialog.boundingBox();
      assert.ok(rect.x >= -1 && rect.y >= -1 && rect.x + rect.width <= width + 1 && rect.y + rect.height <= height + 1);
      await page.screenshot({ path: out + "/ask-" + mode + "-" + width + ".png" });
      await dialog.getByRole("textbox").fill("What should I work on?");
      await dialog.getByRole("button", { name: "Send Ask Clubhouse message" }).click();
      await dialog.getByText("What should I work on?", { exact: true }).waitFor();
      await dialog.getByRole("button", { name: "Start a new Ask Clubhouse chat" }).click();
      assert.equal(await dialog.locator(".ask-visual-card").count(), 0);
      assert.equal(await dialog.locator(".ask-suggestion-stack").count(), 1);
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "detached" });
      assert.equal(await page.getByRole("button", { name: "Ask Clubhouse", exact: true }).evaluate(el => el === document.activeElement), true);
      const nav = page.getByRole("navigation", { name: "Player navigation" });
      for (const view of ["Schedule", "Development", "Analytics", "More"]) {
        await nav.getByRole("button", { name: view, exact: true }).click();
        await layout();
      }
      assert.equal(await page.getByRole("heading", { name: "Team Roster" }).count(), mode === "FULL_PLAYER" ? 1 : 0);
      await nav.getByRole("button", { name: "Analytics", exact: true }).click();
      await page.getByRole("button", { name: "Discipline", exact: true }).click();
      await page.getByRole("option", { name: "Weight Room", exact: true }).click();
      await page.getByRole("heading", { name: "Workout History" }).waitFor();
      await layout();
      await page.screenshot({ path: out + "/weight-room-" + mode + "-" + width + ".png" });
      rows.push({ surface: "player", mode, width, height, passed: true });
    }
    await page.goto(base + "/?devBypass=1&askMock=low-sample");
    const coachDialog = page.getByRole("dialog", { name: "Ask Clubhouse" });
    await coachDialog.waitFor();
    assert.equal(await coachDialog.locator(".ask-composer textarea").count(), 1);
    await page.screenshot({ path: out + "/ask-coach-" + width + ".png" });
    await page.keyboard.press("Escape");
    await coachDialog.waitFor({ state: "detached" });
    await layout();
    rows.push({ surface: "coach", width, height, passed: true });
  }
  assert.deepEqual(errors, []);
  writeFileSync(out + "/results.json", JSON.stringify({ rows, errors }, null, 2));
  console.log(JSON.stringify({ passed: rows.length, errors, out }));
} finally {
  await browser.close();
}

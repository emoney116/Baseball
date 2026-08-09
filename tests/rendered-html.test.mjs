import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("next build contains the Metrolina app shell", async () => {
  assert.equal(existsSync(".next"), true);
  assert.equal(existsSync(".next/server"), true);

  const layout = readFileSync("app/layout.tsx", "utf8");
  const page = readFileSync("app/page.tsx", "utf8");

  assert.match(layout, /title:\s*"Metrolina Baseball Ops"/);
  assert.match(page, /Metrolina Baseball/);
  assert.match(page, /supabaseAppRepository/);
  assert.doesNotMatch(page, /localPracticeRepository\.load/);
});

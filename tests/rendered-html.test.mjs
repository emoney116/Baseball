import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("next build contains the Metrolina app shell", async () => {
  assert.equal(existsSync(".next"), true);
  assert.equal(existsSync(".next/server"), true);

  const layout = readFileSync("app/layout.tsx", "utf8");
  const page = readFileSync("app/page.tsx", "utf8");
  const repository = readFileSync("app/data/supabaseRepository.ts", "utf8");
  const workflow = readFileSync(".github/workflows/supabase-migrations.yml", "utf8");
  const bootstrapRoute = readFileSync("app/api/setup/bootstrap/route.ts", "utf8");

  assert.match(layout, /title:\s*"Metrolina Baseball"/);
  assert.match(page, /Metrolina Baseball/);
  assert.match(page, /supabaseAppRepository/);
  assert.doesNotMatch(page, /localPracticeRepository\.load/);
  assert.match(page, /Create Account/);
  assert.match(page, /TeamSwitcher/);
  assert.match(page, /Your account is ready/);
  assert.doesNotMatch(repository, /claim_initial_metrolina_admin/);
  assert.match(workflow, /supabase\/setup-cli@v2/);
  assert.match(workflow, /SUPABASE_ACCESS_TOKEN/);
  assert.match(workflow, /SUPABASE_DB_PASSWORD/);
  assert.match(workflow, /SUPABASE_PROJECT_ID/);
  assert.match(bootstrapRoute, /authorizeSetupUser/);
  assert.match(bootstrapRoute, /bootstrap_metrolina_admin/);
});

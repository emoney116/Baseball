import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import net from "node:net";
import { test } from "node:test";

test("production Player Access routes enforce anonymous boundaries and hide QA fixtures", async (t) => {
  const listener = net.createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const port = listener.address().port;
  listener.close();
  await once(listener, "close");
  const base = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", String(port)], {
    env: { ...process.env, NODE_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:1", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "local-test-public-key" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  server.stdout.on("data", chunk => { output += chunk; });
  server.stderr.on("data", chunk => { output += chunk; });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      try { ready = (await fetch(base)).status < 500; } catch { /* Server startup. */ }
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.ok(ready, output);
    for (const [path, method, body] of [
      ["/api/player-access?teamId=10000000-0000-4000-8000-000000000020", "GET"],
      ["/api/player-access", "PATCH", { teamId: "10000000-0000-4000-8000-000000000020", mode: "FULL_PLAYER" }],
      ["/api/player/self-tracking", "POST", { kind: "goal", operation: "create", mode: "FULL_PLAYER" }],
      ["/api/player/session?workspace=player", "GET"],
    ]) await t.test(`anonymous ${method} ${path} is denied`, async () => {
      const response = await fetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      assert.equal(response.status, 401, await response.text());
    });
    for (const path of ["/player-preview?access=FULL_PLAYER", "/player-access-preview"]) {
      await t.test(`${path} is unavailable in production`, async () => {
        assert.equal((await fetch(`${base}${path}`)).status, 404);
      });
    }
  } finally {
    server.kill();
    await once(server, "exit");
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { voiceDeploymentEnabled } from "../app/lib/voiceAvailability.ts";

test("unfinished Voice is off in production and unknown deployment environments", () => {
  for (const environment of ["production", "staging", "development", undefined]) {
    assert.equal(voiceDeploymentEnabled(environment, "production"), false);
  }
  assert.equal(voiceDeploymentEnabled("production", "development"), false);
});

test("Voice remains available in Preview and local development", () => {
  assert.equal(voiceDeploymentEnabled("preview", "production"), true);
  assert.equal(voiceDeploymentEnabled(undefined, "development"), true);
});

test("Voice UI and server endpoints fail closed before capture or provider work", () => {
  const ui = readFileSync("app/components/VoiceEntry.tsx", "utf8");
  assert.match(ui, /NEXT_PUBLIC_CLUBHOUSE_VOICE_ENABLED !== "true"\) return null/);
  for (const route of ["transcribe", "metrics"]) {
    const source = readFileSync(`app/api/voice/${route}/route.ts`, "utf8");
    assert.ok(source.indexOf('NEXT_PUBLIC_CLUBHOUSE_VOICE_ENABLED !== "true"') < source.indexOf("auth.getUser()"));
  }
});

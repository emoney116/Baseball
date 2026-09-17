import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { voiceDeploymentEnabled } from "../app/lib/voiceAvailability.ts";
import { voiceTranscriptionModel } from "../app/lib/voiceModel.ts";

for (const environment of ["production", "preview", "development", undefined]) {
  test(`explicit Voice configuration controls ${environment ?? 'local'}`, () => {
    assert.equal(voiceDeploymentEnabled(environment, "development", "true"), true);
    assert.equal(voiceDeploymentEnabled(environment, "development", "false"), false);
    assert.equal(voiceDeploymentEnabled(environment, "production", "invalid"), false);
  });
}

test("Voice model defaults to validated gpt-4o-transcribe without environment-dependent fallback", () => {
  assert.equal(voiceTranscriptionModel(), "gpt-4o-transcribe");
  assert.equal(voiceTranscriptionModel("gpt-4o-transcribe"), "gpt-4o-transcribe");
  assert.throws(() => voiceTranscriptionModel("whisper-1"), /Unvalidated/);
  const route=readFileSync("app/api/voice/transcribe/route.ts", "utf8");
  assert.match(route,/voiceTranscriptionModel\(process.env.OPENAI_VOICE_TRANSCRIBE_MODEL\)/);
  assert.doesNotMatch(route,/whisper-1/);
  const config=readFileSync("next.config.ts", "utf8");
  assert.doesNotMatch(config,/OPENAI_VOICE_API_KEY|OPENAI_VOICE_TRANSCRIBE_MODEL/);
});

test("server independently checks availability and retains coach authorization before provider access", () => {
  const route=readFileSync("app/api/voice/transcribe/route.ts", "utf8");
  assert.match(route,/!voiceDeploymentEnabled\(process.env.VERCEL_ENV, process.env.NODE_ENV, process.env.VOICE_ENABLED\)/);
  for (const guard of ["auth.getUser()", "assertPlayerLinkTeamManager(db, data.user.id, practice.data.team_id)", 'practice.data.status !== "active"', '"reserve_voice_usage"']) {
    assert.ok(route.indexOf(guard)>0);
    assert.ok(route.indexOf(guard)<route.indexOf('"https://api.openai.com/v1/audio/transcriptions"'));
  }
});

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

test("continuous Live BP capture is not remounted by transient save busy state",()=>{
  const ui=readFileSync('app/components/VoiceEntry.tsx','utf8');
  const console=readFileSync('app/components/LiveBpConsole.tsx','utf8');
  assert.match(ui,/<SessionVoiceCapture key=\{practiceId\}/);
  assert.match(ui,/disabled=\{captureDisabled \?\? disabled\}/);
  const capture=console.match(/captureDisabled=\{([^}]+)\}/)?.[1];
  assert.ok(capture);assert.doesNotMatch(capture,/\bbusy\b/);
  assert.match(capture,/!active/);assert.match(capture,/uncertain/);
});

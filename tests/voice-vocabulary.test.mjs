import assert from "node:assert/strict";
import test from "node:test";
import { TENDEX_PITCH_TYPES } from "../app/lib/tendexGameAnalysis.ts";
import {
  VOICE_PITCH_ALIASES,
  VOICE_RESULT_ALIASES,
  VOICE_CONTACT_ALIASES,
  normalizeVoiceText,
  matchVoiceVocabulary,
  resolveVoicePitchType,
  resolveVoiceIdentity,
} from "../app/lib/voiceVocabulary.ts";

test("every controlled pitch alias resolves to an existing canonical pitch type", () => {
  for (const [alias, value] of Object.entries(VOICE_PITCH_ALIASES)) {
    assert.ok(TENDEX_PITCH_TYPES.includes(value));
    assert.deepEqual(resolveVoicePitchType(`${alias} 78 down and away`), {
      value,
      ambiguous: false,
    });
  }
});
test("conflicting pitches cannot silently select the first match", () => {
  assert.deepEqual(resolveVoicePitchType("slider or changeup"), {
    value: undefined,
    ambiguous: true,
  });
  assert.deepEqual(resolveVoicePitchType("heater four-seam"), {
    value: "4-Seam",
    ambiguous: false,
  });
  assert.deepEqual(resolveVoicePitchType("cut"), {
    value: undefined,
    ambiguous: false,
  });
});
test("whole-word matching excludes names and unrelated word fragments", () => {
  assert.deepEqual(resolveVoicePitchType("Chase slid into second"), {
    value: undefined,
    ambiguous: false,
  });
});
test("longest result and contact phrases win over embedded shorter phrases", () => {
  assert.deepEqual(
    matchVoiceVocabulary(
      normalizeVoiceText("ball in play"),
      VOICE_RESULT_ALIASES,
    ).map((m) => m.value),
    ["Ball in play"],
  );
  assert.deepEqual(
    matchVoiceVocabulary(
      normalizeVoiceText("hard ground ball"),
      VOICE_CONTACT_ALIASES,
    ).map((m) => m.value),
    ["Hard ground ball"],
  );
});
test("identity requires exact unique approved alias and never creates a player", () => {
  const roster = [
    { id: "a", aliases: ["Jackson", "Jackson Smith"] },
    { id: "b", aliases: ["Jackson", "Jackson Jones"] },
  ];
  assert.deepEqual(resolveVoiceIdentity("Jackson", roster), {
    id: undefined,
    candidates: ["a", "b"],
  });
  assert.deepEqual(resolveVoiceIdentity("Jackson Smith", roster), {
    id: "a",
    candidates: ["a"],
  });
  assert.deepEqual(resolveVoiceIdentity("Jack", roster), {
    id: undefined,
    candidates: [],
  });
  assert.deepEqual(resolveVoiceIdentity("", roster), {
    id: undefined,
    candidates: [],
  });
});

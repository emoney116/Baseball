import test from "node:test";
import assert from "node:assert/strict";
import {
  interpretVoice,
  canFastSaveVoice,
  assertVoiceIntent,
  voiceLocationPoint,
} from "../app/lib/voiceIntent.ts";
import {
  buildBpPitch,
  initialBpSettings,
  initialBpState,
} from "../app/lib/liveBp.ts";
import { encodeVoiceWav, validateVoiceWav } from "../app/lib/voiceAudio.ts";
import { sprayPointForLane } from "../app/lib/sprayChart.ts";

const context = () => ({
  domain: "live-bp",
  bats: "R",
  playerId: "hitter",
  roster: [
    { id: "hitter", aliases: ["Jackson", "Jackson Smith"] },
    { id: "pitcher", aliases: ["Mylo", "Mylo White"] },
  ],
  settings: {
    ...initialBpSettings("hitter"),
    source: "PLAYER",
    pitcherId: "pitcher",
    pitchMode: "MULTI",
    pitchType: "4-Seam",
    mode: "AB",
    velocity: true,
    location: true,
    ev: true,
    spray: true,
  },
  state: initialBpState(),
});
const pitches = [
  ["slider", "Slider"],
  ["heater", "4-Seam"],
  ["four seam", "4-Seam"],
  ["two seam", "2-Seam"],
  ["sinker", "Sinker"],
  ["changeup", "Changeup"],
  ["curve", "Curveball"],
  ["cutter", "Cutter"],
  ["splitter", "Splitter"],
];

test("strict intent contract rejects extra fields, invalid taxonomy and confidence", () => {
  const good = interpretVoice(
    "slider 78 middle whiff",
    context(),
    "schema",
    0.99,
  );
  for (const bad of [
    { ...good, sql: "delete" },
    { ...good, draft: { ...good.draft, outcome: "HomeRun" } },
    { ...good, draft: { ...good.draft, table: "pitch_events" } },
    { ...good, confidence: { ...good.confidence, transcription: Infinity } },
    { ...good, draft: { ...good.draft, location: { x: 2, y: 0.5 } } },
  ]) {
    assert.throws(() => assertVoiceIntent(bad));
    assert.equal(canFastSaveVoice(bad), false);
  }
});
test("catcher-view named locations match manual grid centers and handedness", () => {
  assert.deepEqual(voiceLocationPoint("down away", "R"), { x: 0.7, y: 0.9 });
  assert.deepEqual(voiceLocationPoint("up in", "L"), { x: 0.7, y: 0.1 });
  assert.deepEqual(voiceLocationPoint("low", "R"), { x: 0.5, y: 0.7 });
  assert.deepEqual(voiceLocationPoint("high", "R"), { x: 0.5, y: 0.3 });
  assert.equal(voiceLocationPoint("away", "S"), undefined);
});
test("spoken measurements survive disabled prompting defaults and Fast-save", () => {
  const c = context();
  c.settings.velocity = false;
  c.settings.location = false;
  const i = interpretVoice("slider 78 middle whiff", c, "disabled", 0.99);
  assert.equal(i.draft.velocity, 78);
  assert.deepEqual(i.draft.location, { x: 0.5, y: 0.5 });
  assert.deepEqual(i.ignoredFields, []);
  assert.equal(canFastSaveVoice(i), true);
});
test("Practice hitting does not invent pitch context or unsupported batter results", () => {
  const c = context();
  c.domain = "hitting";
  c.settings.pitchMode = "OFF";
  const i = interpretVoice("Line drive left center 91 EV", c, "hitting", 0.99);
  assert.deepEqual(i.unresolvedFields, []);
  assert.equal(i.draft.pitchType, undefined);
  assert.equal(i.draft.velocity, undefined);
  assert.equal(i.draft.ev, 91);
  assert.ok(
    interpretVoice("line drive single", c, "hitting-single").unresolvedFields
      .length,
  );
});
test("Practice defense preserves contact, position and throwing evidence", () => {
  const c = context();
  c.domain = "defense";
  c.settings.pitchMode = "OFF";
  const i = interpretVoice(
    "Ground ball short clean rep accurate throw",
    c,
    "defense",
    0.99,
  );
  assert.deepEqual(i.unresolvedFields, []);
  assert.equal(i.draft.position, "SS");
  assert.equal(i.draft.defenseResult, "Clean");
  assert.equal(i.draft.throwResult, "Accurate");
  assert.equal(
    interpretVoice("Ground ball third fielding error", c, "fielding").draft
      .errorType,
    "Fielding",
  );
  assert.ok(
    interpretVoice(
      "ground ball short throwing error accurate throw",
      c,
      "conflict",
    ).unresolvedFields.includes("throw result"),
  );
  c.defenseRepType = "Fly Ball";
  assert.ok(
    interpretVoice(
      "ground ball short clean rep",
      c,
      "drill",
    ).unresolvedFields.includes("current defensive drill"),
  );
});
test("outs correction is explicit, game-like only, and never auto-saved", () => {
  const c = context();
  c.settings.mode = "GAME";
  const i = interpretVoice("set outs two", c, "outs", 0.99);
  assert.deepEqual(i.correction, { outs: 2 });
  assert.equal(canFastSaveVoice(i), false);
  c.settings.mode = "FREE";
  assert.ok(interpretVoice("outs two", c, "free-outs").unresolvedFields.length);
});
const outcomes = [
  ["whiff", "Whiff"],
  ["swing and miss", "Whiff"],
  ["called strike", "Called Strike"],
  ["strike looking", "Called Strike"],
  ["ball", "Ball"],
  ["foul", "Foul"],
];
for (const [spoken, pitchType] of pitches)
  for (const [spokenResult, outcome] of outcomes) {
    const text = `${spoken} 78 middle ${spokenResult}`;
    test(`canonical draft parity: ${text}`, () => {
      const c = context(),
        intent = interpretVoice(text, c, "qa-request", 0.99);
      assert.deepEqual(intent.unresolvedFields, []);
      const manual = {
        outcome,
        pitchType,
        velocity: 78,
        location: { x: 0.5, y: 0.5 },
      };
      assert.deepEqual(
        buildBpPitch(c.settings, c.state, intent.draft),
        buildBpPitch(c.settings, c.state, manual),
      );
      assert.equal(canFastSaveVoice(intent), true);
    });
  }
test("BIP EV and spray use canonical field and builder", () => {
  const c = context(),
    i = interpretVoice(
      "Four seam 84 middle line drive left center 92 exit velo single",
      c,
      "qa-bip",
      0.99,
    );
  assert.deepEqual(i.unresolvedFields, []);
  assert.deepEqual(
    buildBpPitch(c.settings, c.state, i.draft),
    buildBpPitch(c.settings, c.state, {
      outcome: "Ball in play",
      pitchType: "4-Seam",
      velocity: 84,
      location: { x: 0.5, y: 0.5 },
      battedBall: "Line drive",
      spray: sprayPointForLane(1),
      ev: 92,
      result: "Single",
    }),
  );
});
test("context reuse and source attribution remain canonical", () => {
  for (const source of ["MACHINE", "COACH", "PLAYER"]) {
    const c = context();
    c.settings.source = source;
    c.settings.pitchMode = "ONE";
    c.settings.pitchType = "Slider";
    const i = interpretVoice("Whiff", c, "qa-context");
    assert.deepEqual(i.unresolvedFields, []);
    assert.equal(i.draft.pitchType, "Slider");
    assert.equal(i.pitcherId, source === "PLAYER" ? "pitcher" : undefined);
    assert.equal(canFastSaveVoice(i), false);
  }
  const c = context();
  c.settings.hitterId = "";
  assert.ok(
    interpretVoice("Whiff", c, "missing").unresolvedFields.includes("player"),
  );
});
test("ambiguous names, critical results, negation and unknown words never auto-save", () => {
  const c = context();
  c.roster.push({ id: "other", aliases: ["Jackson"] });
  for (const text of [
    "Jackson whiff",
    "slider or changeup whiff",
    "not a ball",
    "slider 78 please delete the team",
  ])
    assert.equal(
      canFastSaveVoice(interpretVoice(text, c, "ambiguous", 1)),
      false,
    );
});
test("game-like runner requires a unique existing runner and a batter result", () => {
  const c = context();
  c.settings.mode = "GAME";
  c.state.runners = [2];
  c.state.job = "Move Runner";
  const i = interpretVoice(
    "Ground ball runner to third job done",
    c,
    "runner",
    1,
  );
  assert.deepEqual(i.draft.runnerOutcomes, { 2: "3" });
  assert.equal(i.draft.jobSuccess, true);
  assert.ok(i.unresolvedFields.includes("batter result"));
  const complete = interpretVoice(
    "Ground ball runner to third job done out",
    c,
    "runner-complete",
    1,
  );
  assert.deepEqual(complete.unresolvedFields, []);
  assert.equal(
    buildBpPitch(c.settings, c.state, complete.draft).context.after.outs,
    1,
  );
  c.state.runners = [1, 2];
  assert.ok(
    interpretVoice(
      "Ground ball runner to third out",
      c,
      "runners",
      1,
    ).unresolvedFields.some(field => field.startsWith("Which existing runner")),
  );
});
test("count corrections respect count tracking and never Fast-save", () => {
  const c = context();
  const i = interpretVoice("set count one and two", c, "count", 1);
  assert.deepEqual(i.correction, { balls: 1, strikes: 2 });
  assert.equal(canFastSaveVoice(i), false);
  c.settings.countTracking = false;
  assert.ok(
    interpretVoice("count 2-1", c, "count", 1).unresolvedFields.includes(
      "count tracking",
    ),
  );
});
test("actual PCM duration is bounded and malformed audio rejected", () => {
  const wav = new Uint8Array(encodeVoiceWav(new Float32Array(48000), 48000));
  assert.equal(validateVoiceWav(wav), 1);
  assert.throws(() => validateVoiceWav(new Uint8Array(500000)));
  wav[22] = 2;
  assert.throws(() => validateVoiceWav(wav));
});

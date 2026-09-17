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

test("real ambiguous narration identifies missing baseball information without vague filler warnings", () => {
  for (const [transcript, message] of [
    ["He made an error.", "Identify the fielder"],
    ["Runner advanced.", "Specify which runner"],
    ["It was like 82 or 84.", "Pitch velocity unclear"],
  ]) {
    const intent = interpretVoice(transcript, context(), "ambiguous-real-audio", .9999);
    assert.ok(intent.unresolvedFields.some(value => value.startsWith(message)));
    assert.ok(!intent.unresolvedFields.some(value => value.startsWith("Couldn't interpret")));
    assert.equal(canFastSaveVoice(intent), false);
  }
});

test("real audio baseline wording is spray, not conflicting pitch location or fielder", () => {
  for (const [phrase, lane] of [["first baseline",4],["first base line",4],["third baseline",0]]) {
    const intent = interpretVoice(`changeup, 75 low, ground ball down the ${phrase}, double.`, context(), "baseline-audio", .6861);
    assert.deepEqual(intent.unresolvedFields, []);
    assert.deepEqual(intent.draft.location, voiceLocationPoint("low", "R"));
    assert.deepEqual(intent.draft.spray, sprayPointForLane(lane));
    assert.equal(intent.draft.position, undefined);
    assert.equal(intent.draft.result, "Double");
  }
});

test("real successful sacrifice with pitcher-to-first throw preserves clean defensive evidence", () => {
  const ctx = context();
  ctx.roster[0].aliases.push("Andrew");
  ctx.settings.defense = "ALL";
  ctx.state = {...ctx.state, runners:[2], outs:0, situationKnown:true};
  const intent = interpretVoice("Fastball, 84 low and away bunt, successful sac, runner moves to third, Andrew out pitcher to first.", ctx, "sac-real-audio", .5077);
  assert.equal(intent.draft.result, "Sac Bunt");
  assert.equal(intent.draft.defenseResult, "Clean");
  assert.deepEqual(intent.draft.fieldingSequence, ["P", "1B"]);
  assert.deepEqual(intent.draft.runnerOutcomes, {2:"3"});
  assert.ok(!intent.unresolvedFields.includes("Choose the defensive result."));
});

test("bare left/right batted-ball directions map to canonical spray without guessing ambiguous EV", () => {
  const intent = interpretVoice('Fastball 89 middle fly ball to left 101 exit velo home run',context(),'bare-left',.6794);
  assert.deepEqual(intent.unresolvedFields,[]);
  assert.deepEqual(intent.draft.spray,sprayPointForLane(0));
  const ambiguous = interpretVoice('Fastball 89 middle fly ball to left one-on-one exit velo home run',context(),'ambiguous-ev',.6794);
  assert.ok(ambiguous.unresolvedFields.length);
  assert.equal(ambiguous.draft.ev,undefined);
});

test("real audio pop flight variant keeps pop-up and second baseman", () => {
  const intent=interpretVoice('Pop Flight a Second, out.',context(),'pop-flight',.4115);
  assert.deepEqual(intent.unresolvedFields,[]);
  assert.equal(intent.draft.battedBall,'Pop up');
  assert.equal(intent.draft.position,'2B');
  assert.equal(intent.draft.result,'Out');
});
test("double and triple never silently leave a preceding runner behind the batter",()=>{
  const c=context();c.state={...c.state,situationKnown:true,runners:[1]};
  for(const result of ['Double','Triple']) {
    const draft={outcome:'Ball in play',result};
    assert.throws(()=>buildBpPitch(c.settings,c.state,draft),/Choose advancement/);
    assert.doesNotThrow(()=>buildBpPitch(c.settings,c.state,{...draft,runnerOutcomes:{1:'score'}}));
  }
});

test("real audio throwing error preserves fielder and explicit batter safe at first", () => {
  const c=context();
  c.settings.alignment={'3B':'pitcher'};
  const intent=interpretVoice('Ground ball to third. Third baseman makes a throwing error. Batter safe at first.',c,'third-error',.9352);
  assert.equal(intent.draft.position,'3B');
  assert.equal(intent.draft.errorType,'Throwing');
  assert.equal(intent.draft.result,'Reached on Error');
  assert.ok(!intent.unresolvedFields.some(field=>/fielder|batter result|interpret/.test(field)));
});

test("real audio center fielder makes the catch records an out and clean rep", () => {
  const intent=interpretVoice('Fly ball to center, center fielder makes the catch.',context(),'center-catch',.9397);
  assert.equal(intent.draft.position,'CF');
  assert.equal(intent.draft.result,'Out');
  assert.equal(intent.draft.defenseResult,'Clean');
  assert.ok(!intent.unresolvedFields.some(field=>/batter result|interpret/.test(field)));
});

test("explicit throw retiring an existing runner preserves defense on a single", () => {
  const c=context();c.state={...c.state,situationKnown:true,runners:[2]};c.settings.alignment={RF:'pitcher'};
  const intent=interpretVoice('Single to right, right fielder throws to third, runner is out at third.',c,'runner-throw',.9888);
  assert.deepEqual(intent.unresolvedFields,[]);
  assert.equal(intent.draft.result,'Single');
  assert.equal(intent.draft.defenseResult,'Clean');
  assert.deepEqual(intent.draft.fieldingSequence,['RF','3B']);
  assert.deepEqual(intent.draft.runnerOutcomes,{'2':'out'});
});

test("cutoff narration retains BIP, spray, relay and explicit hold without inventing outcome",()=>{
  const c=context();c.state={...c.state,situationKnown:true,runners:[2]};
  const intent=interpretVoice('Ball to left center, center fielder cuts it off, then throws to shortstop, runner holds at second.',c,'cutoff',.8175);
  assert.equal(intent.draft.outcome,'Ball in play');
  assert.deepEqual(intent.draft.runnerOutcomes,{'2':'2'});
  assert.deepEqual(intent.draft.fieldingSequence,['CF','SS']);
  assert.deepEqual(intent.draft.spray,sprayPointForLane(1));
  assert.equal(intent.draft.result,undefined);
  assert.ok(intent.unresolvedFields.includes('batter result'));
  assert.ok(!intent.unresolvedFields.some(f=>f.includes("Couldn't interpret")));
});

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

test("rich narration keeps all 22 seconds with a hard 30-second bound",()=>{
  const wav=new Uint8Array(encodeVoiceWav(new Float32Array(16000*22.19),16000));
  assert.equal(validateVoiceWav(wav),22.19);
  assert.throws(()=>validateVoiceWav(new Uint8Array(44+16000*2*31)));
});

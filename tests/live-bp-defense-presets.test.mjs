import test from "node:test";
import assert from "node:assert/strict";
import { initialBpSettings, validateBpSettings } from "../app/lib/liveBp.ts";
import {
  captureDefensePreset,
  applyDefensePreset,
} from "../app/lib/liveBpDefensePresets.ts";

test("defense presets preserve matchup and tracking dimensions while swapping fielders", () => {
  const s = {
    ...initialBpSettings("hitter"),
    source: "PLAYER",
    pitcherId: "pitcher",
    defense: "SELECTED",
    positions: ["SS", "CF"],
    alignment: { P: "old", SS: "a", CF: "b" },
  };
  const first = captureDefensePreset(s, "1", "Team 1");
  assert.equal(first.alignment.P, undefined);
  const current = { ...s, alignment: { SS: "c" }, velocity: true };
  const loaded = applyDefensePreset(current, first, ["a", "b", "pitcher"]);
  assert.deepEqual(loaded.alignment, { SS: "a", CF: "b", P: "pitcher" });
  assert.equal(loaded.hitterId, "hitter");
  assert.equal(loaded.velocity, true);
  assert.equal(loaded.source, "PLAYER");
  assert.deepEqual(loaded.positions, ["SS", "CF"]);
  assert.deepEqual(
    applyDefensePreset({ ...current, source: "COACH" }, first, ["a"]).alignment,
    { SS: "a" },
  );
  assert.deepEqual(first.alignment, { SS: "a", CF: "b" });
});

test("preset settings survive JSON round storage and reject oversized inputs", () => {
  const s = initialBpSettings("hitter");
  const preset = captureDefensePreset(s, "1", "Team 1");
  const round = JSON.parse(JSON.stringify({ ...s, defensePresets: [preset] }));
  validateBpSettings(round);
  assert.equal(round.defensePresets[0].name, "Team 1");
  assert.throws(() =>
    validateBpSettings({ ...s, defensePresets: Array(13).fill(preset) }),
  );
  assert.throws(() =>
    validateBpSettings({
      ...s,
      defensePresets: [{ ...preset, name: "x".repeat(41) }],
    }),
  );
});

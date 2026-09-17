import test from "node:test";
import assert from "node:assert/strict";
import { initialBpSettings, validateBpSettings } from "../app/lib/liveBp.ts";
import {
  captureDefensePreset,
  applyDefensePreset,
  activeDefensePresetId,
  defensePresetIsActive,
} from "../app/lib/liveBpDefensePresets.ts";
import {parseVoiceCommand} from '../app/lib/voiceCommands.ts';
import {initialBpState} from '../app/lib/liveBp.ts';

test('Voice preserves Team 2 selection when presets have identical assignments, including reload',()=>{
  const base={...initialBpSettings('hitter'),source:'COACH',alignment:{SS:'fielder'}};
  const settings={...base,defensePresets:[captureDefensePreset(base,'one','Team1'),captureDefensePreset(base,'two','Team 2')]};
  const command=parseVoiceCommand('team two on defense',[{id:'fielder',aliases:['Alex']}],settings,initialBpState());
  assert.deepEqual(command.problems,[]);
  const saved=JSON.parse(JSON.stringify({...settings,...command.patch}));
  validateBpSettings(saved);
  assert.equal(activeDefensePresetId(saved),'two');
  assert.equal(defensePresetIsActive(saved,settings.defensePresets[0]),false);
  assert.equal(defensePresetIsActive(saved,settings.defensePresets[1]),true);
  assert.equal(activeDefensePresetId(applyDefensePreset(saved,settings.defensePresets[0],['fielder'])),'one');
});

test('legacy identical layouts do not arbitrarily select Team1; changed or deleted selection is not stale',()=>{
  const base={...initialBpSettings('hitter'),alignment:{SS:'fielder'}};
  const settings={...base,defensePresets:[captureDefensePreset(base,'one','Team1'),captureDefensePreset(base,'two','Team 2')]};
  assert.equal(activeDefensePresetId(settings),'');
  assert.equal(activeDefensePresetId({...settings,activeDefensePresetId:'two',alignment:{SS:'other'}}),'');
  assert.equal(activeDefensePresetId({...settings,activeDefensePresetId:'two',defensePresets:[]}), '');
  assert.equal(activeDefensePresetId({...settings,defensePresets:[settings.defensePresets[0]]}),'one');
  assert.throws(()=>validateBpSettings({...settings,activeDefensePresetId:42}));
});

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

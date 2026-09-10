import test from "node:test";
import assert from "node:assert/strict";
import { liveBpFieldLabel } from "../app/lib/liveBpFieldLabel.ts";

test("field labels use assigned jersey and surname, with position fallback", () => {
  const players = [
    { id: "a", name: "Jacob Seamon", jerseyNumber: 12 },
    { id: "b", name: "Mylo White", jerseyNumber: 18 },
  ];
  const settings = {
    source: "PLAYER",
    pitcherId: "b",
    alignment: { SS: "a", P: "a" },
  };
  assert.equal(liveBpFieldLabel(settings, players, "SS"), "#12 Seamon");
  assert.equal(liveBpFieldLabel(settings, players, "P"), "#18 White");
  assert.equal(liveBpFieldLabel(settings, players, "CF"), "CF");
  assert.equal(
    liveBpFieldLabel(
      { ...settings, source: "COACH", coachName: "Coach Campbell" },
      players,
      "P",
    ),
    "Campbell",
  );
  assert.equal(
    liveBpFieldLabel({ ...settings, source: "MACHINE" }, players, "P"),
    "Machine",
  );
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const fieldComponent = await readFile(new URL("../app/components/ClubhouseBaseballField.tsx", import.meta.url), "utf8");
const gameCompatibilityWrapper = await readFile(new URL("../app/components/visuals.tsx", import.meta.url), "utf8");

test("shared field renderer owns every supported visualization mode", () => {
  assert.match(fieldComponent, /"blank" \| "spray" \| "count" \| "percent" \| "heat"/);
  assert.match(fieldComponent, /SPRAY_FIELD_PATHS\.fairTerritory/);
  assert.match(fieldComponent, /getSprayHeatClusters/);
  assert.match(fieldComponent, /getSprayDistribution/);
  assert.match(fieldComponent, /showTrajectory/);
  assert.match(fieldComponent, /clubhouse-baseball-field__trajectory/);
});

test("Game Center uses the shared renderer and not the retired static field asset", () => {
  assert.match(gameCompatibilityWrapper, /ClubhouseBaseballField/);
  assert.match(gameCompatibilityWrapper, /legacyGamePointToCanonical/);
  assert.match(gameCompatibilityWrapper, /canonicalPointToLegacyGame/);
  assert.doesNotMatch(gameCompatibilityWrapper, /baseball-field-spray-chart-v1\.png/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const fieldComponent = await readFile(new URL("../app/components/ClubhouseBaseballField.tsx", import.meta.url), "utf8");
const gameCompatibilityWrapper = await readFile(new URL("../app/components/visuals.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("shared field renderer owns every supported visualization mode", () => {
  assert.match(fieldComponent, /"blank" \| "spray" \| "count" \| "percent" \| "heat"/);
  assert.match(fieldComponent, /baseball-field-spray-chart-v1\.png/);
  assert.match(fieldComponent, /getSprayHeatClusters/);
  assert.match(fieldComponent, /getSprayDistribution/);
  assert.match(fieldComponent, /showTrajectory/);
  assert.match(fieldComponent, /clubhouse-baseball-field__trajectory/);
});

test("Game Center uses the shared renderer with Cambell's native Game coordinate space", () => {
  assert.match(gameCompatibilityWrapper, /ClubhouseBaseballField/);
  assert.match(gameCompatibilityWrapper, /coordinateSpace="game"/);
  assert.match(styles, /clubhouse-baseball-field__asset/);
});

test("Game Center overrides the Practice chart width cap for field-relative controls", () => {
  assert.match(styles, /\.game-field-command__surface > \.field-chart \{ inset: 0; max-width: none; position: absolute; width: 100%; \}/);
  assert.match(styles, /\.game-field-editor > \.field-chart \{ cursor: default; max-width: none; width: 100%; \}/);
});

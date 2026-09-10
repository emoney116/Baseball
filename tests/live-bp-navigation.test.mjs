import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Live BP is embedded inside the shared Practice tracker, with compact entry controls", () => {
  const page = fs.readFileSync("app/page.tsx", "utf8");
  assert.equal(
    page
      .slice(0, page.indexOf("function PracticeConsole("))
      .includes("<LiveBpConsole"),
    false,
  );
  const tracker = page.slice(page.indexOf("function PracticeConsole("));
  assert.match(tracker, /<LiveBpConsole/);
  const header = tracker.slice(
    tracker.indexOf("practice-tracker-header"),
    tracker.indexOf("practice-mode-picker-trigger"),
  );
  assert.doesNotMatch(header, /CoachLiveEntrySettings/);
  const source = fs.readFileSync("app/components/LiveBpConsole.tsx", "utf8");
  assert.match(source, /practice-hitting-player-row/);
  assert.match(source, /aria-label="Previous hitter"/);
  assert.match(source, /aria-label="Next hitter"/);
  assert.match(source, /entryOpen &&/);
  assert.match(source, /chartsOpen && charts/);
});

test("Practice mode switch delegates one route transition without stale station callbacks", () => {
  const page = fs.readFileSync("app/page.tsx", "utf8");
  const callback = page.slice(
    page.indexOf("function changeMode(nextMode:"),
    page.indexOf("function selectSession(row:"),
  );
  assert.match(callback, /onMode\(nextMode\)/);
  assert.doesNotMatch(
    callback,
    /onHittingStation|onPitchingStation|onSelectPlayer/,
  );
});
test("Live BP enters directly and prepares its round before the first pitch", () => {
  const source = fs.readFileSync("app/components/LiveBpConsole.tsx", "utf8");
  assert.doesNotMatch(source, /Start Live BP|Apply Settings|setConfig/);
  assert.match(source, /operation: savedRound \? "configure" : "start"/);
  assert.match(source, /version: savedRound\?\.version \?\? 0/);
  assert.match(source, /requestId: pending\.current\?\.id/);
});

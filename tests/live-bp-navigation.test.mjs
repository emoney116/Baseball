import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Live BP uses a numeric count and one shared correction control", () => {
  const console = fs.readFileSync("app/components/LiveBpConsole.tsx", "utf8");
  assert.match(
    console,
    /aria-label=\{`Count \$\{state.balls\}-\$\{state.strikes\}`\}/,
  );
  assert.doesNotMatch(
    console,
    /<BpCount|aria-label="Reset outs"|aria-label="Clear bases"/,
  );
  assert.match(console, /<LiveBpCorrections/);
  const corrections = fs.readFileSync(
    "app/components/LiveBpCorrections.tsx",
    "utf8",
  );
  for (const label of [
    "Reset count",
    "Reset outs",
    "Clear bases",
    "Add or remove runners",
    "Set count / outs",
  ]) {
    assert.ok(corrections.includes(label));
  }
  assert.match(corrections, /balls: 0, strikes: 0/);
  assert.match(corrections, /outs: 0/);
  assert.match(corrections, /withBpRunners\(state, \[\]\)/);
  assert.match(corrections, /event.key === "Escape"/);
});

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
  assert.match(
    page,
    /nextMode === "Hitting" && hittingStation === "Live BP" \? "Tee"/,
  );
  assert.match(
    page,
    /nextMode === "Pitching" && pitchingStation === "Live BP" \? "Bullpen"/,
  );
  const header = tracker.slice(
    tracker.indexOf("practice-tracker-header"),
    tracker.indexOf("practice-mode-picker-trigger"),
  );
  assert.doesNotMatch(header, /CoachLiveEntrySettings/);
  const source = fs.readFileSync("app/components/LiveBpConsole.tsx", "utf8");
  assert.match(source, /styles.matchup/);
  assert.doesNotMatch(
    source,
    /aria-label="Previous hitter"|aria-label="Next hitter"/,
  );
  assert.match(source, /label="Analytics player"/);
  assert.match(source, /aria-label="Defense tracking settings"/);
  assert.doesNotMatch(source, /entryOpen/);
  assert.match(source, /setStage\("bip"\)/);
  assert.match(source, /<LiveBpSetup/);
  assert.match(source, /chartsOpen &&\s*sheet/);
  assert.match(source, /<LiveBpPitchDetails/);
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

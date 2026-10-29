# Practice and Player Analytics - October 29, 2026

## Scope

Isolated local branch `codex/practice-player-analytics`, based on deployed
`73b95f913d5a220a6494b1254fd2113d46752f68`. No migrations, result edits,
Voice changes, or deployment are required to validate this candidate.

## Read-only Production audit

- Metrolina Fall Ball has no open practices or Weight Room workouts to close.
- October 15 and 22 contain 282 saved pitches with 260 velocity readings.
- Earlier practice records do not contain pitching events; these cannot be
  reconstructed from batting results or inferred velocity.

## Changes

- Coach and player Analytics default to one Practice source including Live BP.
  Games can be added into the same athlete line; Personal remains a separate
  option. Domain changes clear incompatible session filters.
- Coach athlete selection, event selection, date range, source, pitch/contact
  filters and column presets use the same canonical query pipeline.
- Practice pitching derives BF, K, BB, H, HBP, opponent batting rates and other
  supported rates from recorded player-pitched terminal outcomes. Innings and
  innings-based rates require recorded out states. Per-nine rates use 27 outs.
- Pitch velocity and batted-ball exit velocity remain distinct measurements.
- Batting validation checks PA/AB/H/AVG against terminal results, not swing counts.
- Weight Room has a visible domain control and saved exercise/set/load/reps/time
  results with exercise filtering. Completion, time and weight-only records cannot
  become lifting volume; fixed-load rep results retain their prescribed load.
  The accepted Weight Room Score formula is unchanged.
- Mobile filters fit in a two-column toolbar. Wide data tables scroll internally;
  athlete identity remains sticky. Metric definitions are collapsible.
- Player data remains server-scoped to the approved player. Test conditions and
  referenced exercise measurement definitions survive projection, while teammate
  runner identities, defensive assignments and private metadata are redacted.

## Acceptance

Full sanitized validation: 2,030 tests passed; Next build and TypeScript passed;
ESLint has zero errors and 23 existing image warnings. All eight browser matrix
cases passed, including athlete selection, filter-panel bounds and reload.

`tests/analytics-practice-player.test.mjs` covers canonical pitching/batting,
missing outcomes, athlete/event boundaries, own-player splits, volume exclusions,
nested privacy, guessed identity rejection, measured weight and station projection.

`scripts/analytics-practice-player-browser.mjs` exercises the actual coach and
player components at 360x780, 390x844, 820x1180 and 1440x900. It verifies velocity,
saved workout primitives, domain switching, reload, custom dates, own-only rows,
no page overflow and no browser exceptions. Screenshots are under
`build/qa-analytics/` (untracked).

Owner-approved release follow-up also covers mixed Practice/Live BP/Games stat
lines and pitch-type/count splits. ISO, BABIP, K%, BB%, extra-base rates and other
derived batting rates are recomputed from summed counts. Pitching Source filters
apply to ordinary Practice as well as Live BP; explicit event evidence wins,
unknown throwers stay unclassified, and Games cannot leak into coach/machine
splits. Recorded complete Practice sequences support P/PA; matched nonterminal
game pitches cannot import a later PA outcome. Own baserunning evidence cannot
count another batter's PA. Browser cases additionally toggle Games into the
single Practice line and verify the combined PA total.

Browser authentication and server data are synthetic fixtures. These runs are not
physical-device tests or a claim of live Supabase Auth/RLS acceptance. Existing
server authorization regression tests remain in the full repository suite.

Run the sanitized local QA validation workflow, start its build on loopback port
3192, then run:

```powershell
node --experimental-strip-types scripts/analytics-practice-player-browser.mjs "file:///ABSOLUTE/PATH/TO/playwright/index.mjs"
```

## Remaining Evidence Boundaries

- Do not fabricate ERA, decisions, earned runs or outcomes that were never logged.
- Standalone Practice runner actions currently use a coach-authorized database
  projection. This change does not weaken that authorization to expose those
  actions to players. An own-runner projection needs separate database acceptance
  before claiming full player running totals from standalone actions.
- Production deployment and authenticated real-device smoke testing are separate
  gates. No saved data needs to be rewritten for these display/query fixes.

# Post-Practice mobile reacceptance

Scope: recap and canonical defensive evidence only. Voice V2, production history,
billing, and main remain untouched. Owner phone acceptance is still required.

## Read-only Sept. 17 findings

- 86 hitting events; 46 BIP; 5 runs; 16 runner advances; 2 runner outs.
- Contact 96%; average EV display 81.3; maximum EV 95.0.
- Underlying EV sample 20 and spray sample 24 remain unchanged. Recap no longer
  repeats sample subtext; qualification and Full Analytics evidence remain intact.
- Dedicated defensive records: 0, including Practice, round and session linkage.
- Standalone defensive actions: 0. Two hitting records explicitly say Reached on
  Error, one fly ball and one ground ball. Neither identifies a fielder, position,
  error type, throw or receive. Entry provenance is COACH; that does not distinguish
  manual input from Voice.
- The old recap checked only dedicated defensive reps. It missed these error plays.
  The current capture code already allows explicit aligned defense when defaults
  are OFF. There is no evidence that a persisted dedicated rep was filtered out.

## Shared projection

Defense Analytics now exposes Error plays independently from fielder Errors and
Reps. It counts unique canonical ROE hitting IDs and uses the same Practice/date/
source scope. It does not add those plays to player errors, rep denominators or
clean percentages. Player/position filters do not attribute an unknown actor.
Ask's defensive evidence includes this same metric, not separate arithmetic.

Existing OFF/ALL/SELECTED explicit-defense capture tests remain. Added regressions
cover ROE ID deduplication, unknown attribution, scope, and unchanged rep/rate totals.

## Mobile and charts

- Removed duplicate team selector only on completed-review surface.
- Replaced large card/CTA with back, date, team/time, Analytics icon; Full Analytics
  and Ask also remain in Quick Links. Exact deep-link callbacks are unchanged.
- 390x844 measured header: 40.83px. Tabs end at 108.83px; first metric label starts
  at 162.92px; core Overview through three takeaways ends at 680.09px.
- Prior owner screenshot header stack is approximately 300px, not a measured DOM
  baseline. Approximate reclaimed space is 190px; do not claim exact before/after.
- Eight Overview metrics, compact domain rows, three traceable takeaways.
- Shared Analytics spray chart now visible immediately after six Hitting metrics.
  Shared donut renders expanded BIP profile. Secondary metrics/leaders use disclosure.
- Player Pitching uses shared pitch map and pitch-mix donut when records exist.
  Sept. 17 has no player pitching, so no player chart is invented.
- Dedicated Defense uses shared outcome donut when reps exist. Sept. 17 displays
  two error plays and unknown attribution, not a fictional position chart or clean rate.
- Situational preserves canonical run/advance/out/job/sacrifice metrics.

## Validation

50 actual-data-derived local browser cases passed: five tabs at 390x844, 430x932,
820x1180, 1180x820, 1440x900 in dark and light. No horizontal/text overflow; visible
spray chart verified in both phone themes. Private screenshots and canonical exports
remain outside Git. These browser loops use local fixtures, not shared Supabase.

Build, 1,952 tests, TypeScript, diff check pass. Lint has no errors (23 existing
warnings). Historical DB queries are SELECT only. No events were changed.

Limitations: no fielder attribution can be recovered from these two persisted
ROE records; owner-recalled additional reps are not established by the available
records. New hosted build still needs physical phone retest. No Voice expansion.

# Ask Clubhouse Intelligence Validation

This pass validates the query planner and player-development diagnosis layer for CLU9-1, CLU9-5, and CLU9-6. It does not add a migration, change the AI model, or redesign the UI.

## Query contract

Each data message produces an internal `AskClubhouseQueryPlan` with:

- domain and metric
- source and time range
- composable analytics filters
- optional player, comparison, or ranking scope
- metric-specific minimum sample
- unsupported and partial dimensions

The plan is internal test/debug state. It is not rendered as JSON to coaches or players. The existing bounded analytics tools execute the plan and return compact rows, denominators, warnings, and coverage.

Supported composed filters currently include pitch type, pitch velocity range, pitch location region, spray direction, pitcher/batter hand where the identity exists, count groups for pitching, batted-ball type, and drill/session type. Game spray direction and game batted-ball type are explicitly rejected because the current game event model does not preserve those fields.

Trend plans use two bounded custom-date queries. The anchor is the latest date in the loaded data, with a recent 7-day or 30-day window and a same-length prior window. The model receives the two summaries; it does not calculate the trend from raw events.

## Dimension support matrix

| Dimension | Status | Current evidence / limitation |
| --- | --- | --- |
| source | SUPPORTED | Practice, Live BP, Games, and All are modeled server-side. |
| player | SUPPORTED | Authorized roster identity is resolved from the selected team dataset. |
| team | SUPPORTED | Current authorized team scope is enforced before data is loaded. |
| date | SUPPORTED | Season, 7-day, 30-day, and custom windows. |
| practice | SUPPORTED | Practice and session IDs are retained. |
| game | PARTIAL | Logged game pitches/BIP are queryable; complete PA outcomes are not complete. |
| session | SUPPORTED | Hitting, pitching, and defense sessions retain IDs and source context. |
| pitch type | PARTIAL | Required on pitching events; optional on hitting and game events. |
| pitch velocity | PARTIAL | Recorded values can be ranged; missing velocity is excluded, not inferred. |
| pitch location | PARTIAL | Coordinates/zone data are optional. |
| batter handedness | PARTIAL | Resolved from roster when batter identity is present. |
| pitcher handedness | PARTIAL | Resolved from roster when pitcher identity is present. |
| count | PARTIAL | `countBefore` exists on pitching events; hitting events do not persist count. |
| spray | PARTIAL | Hitting direction exists for logged contact; complete game spray is not tracked. |
| contact type | PARTIAL | Contact result/quality are optional and apply to contact events. |
| exit velocity | PARTIAL | Recorded EV samples only. |
| result | SUPPORTED | Event outcomes are structured; game outcome coverage remains partial. |
| thrower | PARTIAL | Live BP thrower source is available when recorded on the session. |
| drill | SUPPORTED | Hitting session type and defense drill context are retained. |
| position | SUPPORTED | Defensive position worked is retained. |
| defensive rep type | SUPPORTED | Normalized with conservative fallbacks. |
| defensive subtype | PARTIAL | Optional; untyped reps remain not tracked. |
| throw result | PARTIAL | Optional; No Throw is excluded from accuracy denominators. |
| medical diagnosis | NOT TRACKED | No medical, video, or biomechanical evidence exists in Clubhouse. |

## Development diagnosis

`diagnosePlayerDevelopment` uses the same request shape for hitting and pitching. It filters the actual event set, calculates bounded signals, checks a minimum sample, assigns low/moderate/high confidence, retrieves trusted Hitting or Pitching knowledge, and returns a structured recommendation:

- WHAT I SEE
- YOUR DATA
- WHAT TO WORK ON
- PRACTICE IDEA
- WATCH NEXT

Hitting signals currently supported where fields are present include overall Contact, in-zone Contact derived from tracked pitch location, chase derived from out-of-zone tracked opportunities, in-zone takes, Hard Contact, ground-ball and pull tendencies, and EV. Pitching signals include Strike, target-miss direction, and velocity spread. The implementation does not claim a mechanical cause without biomechanical evidence.

Samples below the diagnosis minimum are reported as insufficient with low confidence. A larger but not yet deep sample is limited/moderate. Knowledge misses never trigger web search during the beta because `AI_WEB_SEARCH_ENABLED` remains false by default.

## Deterministic QA

`tests/fixtures/ask-clubhouse-intelligence-qa.mjs` contains 124 representative cases grouped as basic, filtered, situational, comparison, ranking, trend, low sample, unsupported, ambiguous, follow-up, development, knowledge, mixed, and security. Additional tests cover:

- velocity, location, and spray filter composition
- period comparison plan creation
- sample states
- route independence and web-disabled behavior
- chase vs in-zone contact vs weak-contact diagnoses
- small-sample refusal to over-diagnose
- pitching command diagnosis
- trusted knowledge evidence

The suite is deterministic and does not call OpenAI.

## Manual Metrolina test set

Run these manually against the current authorized Metrolina data after confirming the relevant dimensions have coverage:

1. Who has the highest Practice Contact %?
2. Who has the highest Practice Avg EV?
3. Who has the most tracked Practice hitting reps?
4. Who has the best Practice Hard % with at least the minimum sample?
5. What is Jacob Seamon's Contact % on sliders during Practice?
6. What is the highest tracked EV on fastballs over 80 mph?
7. Who hits curveballs best in Practice?
8. Compare Practice and Games for Jacob Seamon.
9. What changed in my hitting this month?
10. Who improved most in the Weight Room this month?
11. Which pitcher has the best bullpen Strike %?
12. What is Mylo White's slider Strike %?
13. What pitch does Mylo White locate best by Zone %?
14. How has Mylo White's fastball command changed?
15. How can Jacob Seamon hit sliders better?
16. How can Mylo White improve his slider?
17. Who has the best Clean % at SS?
18. Which defensive drill has Jacob Seamon struggled with most?
19. What is OPS?
20. What is the 2026 NFHS balk rule?

Expected behavior for unsupported fields is an explicit limitation with coverage, not a guessed answer. The current-rule question should return the beta research-unavailable response unless a trusted NFHS 2026 item is present. The development questions should show a tracked diagnosis only when the named player and pitch sample meet the relevant minimum.

## Known gaps / future QA

- Complete game plate appearances, game spray, and game count splits need the parallel Games work before their cases can be promoted from future QA.
- Hitting count-before is not persisted, so two-strike hitting splits are rejected rather than approximated.
- Spin rate, launch angle, bat path, and biomechanical/video signals are not tracked.
- Multi-team query execution remains constrained by the server-loaded authorized dataset; persistent player identity aggregation needs a dedicated cross-team analytics contract.
- The current UI was intentionally left unchanged in this validation pass. Existing responsive Ask Clubhouse UI should be rechecked with the manual answer set at 390x844, 430x932, 820x1180, and 1180x820 when live data is available.

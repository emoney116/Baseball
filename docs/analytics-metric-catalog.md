# Analytics Metric Catalog

Last audited: 2026-09-02

The executable source of truth is `app/lib/analyticsCatalog.ts`. Analytics UI code selects metrics from that catalog; metric values continue to be calculated by `app/lib/analyticsQuery.ts` and shared statistic helpers. The UI does not recalculate percentages.

## Capability Matrix

| Area | Games | Practice | Live BP | Notes |
| --- | --- | --- | --- | --- |
| Hitting event volume | Partial | Supported | Supported | Games currently has pitch/play events, but not a complete imported scorebook for every PA. |
| Hitting AVG / SLG / ISO / BABIP | Partial | Not applicable | Not applicable | Game values use supported logged ball-in-play outcomes only and are labeled accordingly. |
| Hitting PA / OBP / OPS / RBI / BB / SO / HBP / SF | Not tracked reliably | Not applicable | Not applicable | Hidden until complete terminal plate-appearance ingestion is available. |
| Practice Contact / Whiff / Swing / Take | Not applicable | Supported | Supported | Calculated from hitting opportunities and swing outcomes. |
| Zone Contact / Chase | Not applicable | Derivable | Derivable | Requires charted pitch location. Missing locations stay out of the denominator. |
| Hard / contact type | Partial | Supported | Supported | Practice uses coach-entered contact quality; this is not a Statcast barrel calculation. |
| Exit velocity | Partial | Partial | Partial | Values and coverage use only events with recorded EV. Games do not yet expose a canonical hitter EV field. |
| Spray direction | Partial | Supported | Supported | Practice directions are normalized to Pull / Middle / Opposite. Game field coordinates are retained but not relabeled as spray until the shared field contract is finalized. |
| Pitch count | Supported | Supported | Supported | Hitting practice is partial because a hitting event must link to a pitch/PA count. |
| Pitch type | Supported | Supported | Supported | Uses the canonical Clubhouse pitch taxonomy. |
| Pitch velocity | Partial | Partial | Partial | Missing values are excluded and coverage remains visible. |
| Pitch location / zone | Supported | Supported | Supported | Uses charted location and the existing 5x5-compatible zone contract. |
| Pitching Strike / Zone / Whiff / CSW | Supported | Supported | Supported | Team values use aggregate numerators and denominators, never averages of player rates. |
| Pitching ERA / WHIP / IP / ER / decisions | Not tracked reliably | Not applicable | Not applicable | Hidden until official inning and terminal game scoring are complete. |
| Defense reps / Clean / Error / Throw accuracy | Not tracked | Supported | Not tracked | Defense V1 is practice-rep based. No MLB-style game fielding line is fabricated. |
| Weight Room score / workouts | Not applicable | Supported | Not applicable | Existing bounded Weight Room scoring is reused. |
| Attendance / practice reps | Not applicable | Supported | Supported where relevant | Uses recorded attendance and event counts. |

## Current Metrolina Coverage

Read-only production audit on 2026-09-02 for the current Metrolina team scope:

| Source | Events | Useful dimension coverage |
| --- | ---: | --- |
| Practice hitting | 41 | Pitch type 41/41, velocity 37/41, spray 28/41, contact result/quality 30/41, EV 2/41, pitch location 0/41, linked PA/count 0/41. |
| Practice pitching | 10 | Pitch type 10/10, count 10/10, location 10/10, velocity 1/10, identified hitter 0/10. |
| Practice defense | 0 | Schema is ready; no current reps qualify. |
| Games | 0 confirmed pitch events | Two scheduled games exist, but there is no scored event sample yet. |

This snapshot is not the capability contract. It explains current empty and partial states; the executable catalog remains source-aware as new events arrive.

## Minimum Samples

| Metric family | Qualified sample |
| --- | ---: |
| Hitting swing rates | 12 swings |
| Batted-ball rates | 8 balls in play |
| Exit velocity averages | 3 EV samples |
| Pitching rates | 18 pitches |
| First-pitch strike rate | 8 first pitches |
| Defense rates | 8 reps |
| Weight Room score | Existing Weight Room qualification rules |

Cells below their threshold remain visible as limited samples and retain numerator/denominator evidence. Sorting does not convert a limited sample into a qualified ranking.

## Column Presets

- **Standard:** source-specific common counting and headline rate metrics.
- **Advanced:** rate, discipline, and sabermetric metrics that are actually supported.
- **Development:** Clubhouse tracking metrics such as contact quality, EV, spray, command, and sample-aware development measures.
- **Custom:** an explicit user selection from the same catalog.

Games, Practice, Live BP, Defense, and Development each receive only the intersection of their supported metrics and the selected preset. Unsupported columns are absent rather than rendered as invented zeroes.

## Team Aggregation

The `TEAM` row is calculated from the selected qualifying events. Percentages use combined numerators and denominators; player percentages are never averaged. Filters, date windows, event selections, and source boundaries are applied before aggregation.

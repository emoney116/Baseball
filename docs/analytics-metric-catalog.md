# Analytics Metric Catalog

Last audited: 2026-09-03

The executable source of truth is `app/lib/analyticsCatalog.ts`. It owns each metric's label, source availability, qualification guidance, sort intent, and preset membership. Metric values continue to be calculated by `app/lib/analyticsQuery.ts` from the same filtered events used by the table and charts; the UI does not recalculate percentages.

## Capability Matrix

| Area | Games | Practice | Live BP | Notes |
| --- | --- | --- | --- | --- |
| Hitting event volume | Partial | Supported | Supported | Games currently has pitch/play events, but not a complete imported scorebook for every PA. |
| Hitting AVG / SLG / ISO / BABIP / HR/AB / XBH/AB / TB/AB | Partial | Not applicable | Not applicable | Game values use supported logged ball-in-play outcomes only and are labeled accordingly. |
| Hitting PA / OBP / OPS / RBI / BB / SO / HBP / SF | Not tracked reliably | Not applicable | Not applicable | Hidden until complete terminal plate-appearance ingestion is available. |
| Practice Contact / Whiff / Swing / Take / BIP / Foul | Not applicable | Supported | Supported | Calculated from hitting opportunities and swing outcomes. |
| Zone swing / contact / chase | Not applicable | Derivable | Derivable | Requires charted pitch location. Missing locations stay out of the denominator. |
| Hard / soft / contact type / GB-FB | Partial | Supported | Supported | Practice uses coach-entered contact quality; this is not a Statcast barrel calculation. |
| Exit velocity distribution | Partial | Partial | Partial | Average, median, 90th, 95th, and max use only recorded EV. Games do not yet expose a canonical hitter EV field. |
| Spray direction | Partial | Supported | Supported | Practice directions are normalized to Pull / Middle / Opposite. Game field coordinates are retained but not relabeled as spray until the shared field contract is finalized. |
| Pitch count | Supported | Supported | Supported | Hitting practice is partial because a hitting event must link to a pitch/PA count. |
| Pitch type | Supported | Supported | Supported | Uses the canonical Clubhouse pitch taxonomy. |
| Pitch velocity | Partial | Partial | Partial | Missing values are excluded and coverage remains visible. |
| Pitch location / zone | Supported | Supported | Supported | Uses charted location and the existing 5x5-compatible zone contract. |
| Pitching Strike / Ball / Swing / Whiff / CSW / Contact | Supported | Supported | Supported | Includes zone and out-of-zone whiff splits plus recorded velocity distribution. Team values use aggregate numerators and denominators, never averages of player rates. |
| Pitching ERA / WHIP / IP / ER / decisions | Not tracked reliably | Not applicable | Not applicable | Hidden until official inning and terminal game scoring are complete. |
| Defense reps / Clean / Error / Throw accuracy | Not tracked | Supported | Not tracked | Includes fielding, throwing, and decision error detail, missed reps, and inaccurate throws. No MLB-style game fielding line is fabricated. |
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
| Exit velocity percentiles | 10 EV samples |
| Pitching rates | 18 pitches |
| First-pitch strike rate | 8 first pitches |
| Pitch velocity averages / median / spread | 3 velocity samples |
| Pitch velocity 90th percentile | 10 velocity samples |
| Defense rates | 8 reps |
| Weight Room score | Existing Weight Room qualification rules |

Cells below their threshold remain visible as limited samples and retain numerator/denominator evidence. Sorting does not convert a limited sample into a qualified ranking.

## Column Presets

- **Standard:** source-specific common counting and headline rate metrics.
- **Advanced:** source-supported rates and outcome efficiency metrics.
- **Development:** Clubhouse tracking metrics such as contact quality, EV distribution, spray, command, rep detail, and sample-aware development measures.
- **Custom:** an explicit user selection from the same catalog.

Games, Practice, Live BP, Defense, and Development each receive only the intersection of their supported metrics and the selected preset. Unsupported columns are absent rather than rendered as invented zeroes.

The column chooser groups metrics from catalog metadata, rather than a second hand-maintained metric list. Catalog availability and qualifications distinguish an available `0`, an insufficient sample, and an untracked value (`--`).

## Team Aggregation

The `TEAM` row is calculated from the selected qualifying events. Percentages use combined numerators and denominators; player percentages are never averaged. Filters, date windows, event selections, and source boundaries are applied before aggregation.

## Deferred Metric Families

Official PA, BB, SO, HBP, OBP, OPS, RBI, SF, IP, ERA, WHIP, ER, decisions, complete official fielding, scouting-grade tracking, and proprietary professional-model metrics remain intentionally deferred. Clubhouse will add them only when terminal plate appearances, innings, earned runs, defensive credits, or the necessary tracked primitives are complete and documented. No proxy is calculated from partial event data.

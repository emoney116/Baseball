# Analytics Metric-Catalog Audit

**Scope:** correctness and completeness audit of `df30ee0` and the canonical metric catalog. This is not a redesign, and Analytics V3 remains active.

## Current Catalog After Accepted Audit Additions

| Domain | Metric count |
| --- | ---: |
| Hitting | 87 |
| Pitching | 79 |
| Defense | 15 |

All exposed metrics now have a key, short label, full name, formula/definition, source availability, and at least one preset category. The taxonomy is: Hitting `Standard`, `Advanced`, `Approach`, `Contact`, `Batted Ball`, `Baserunning`, `Development`, `Custom`; Pitching `Standard`, `Advanced`, `Command`, `Efficiency`, `Contact`, `Velocity`, `Pitch Mix`, `Development`, `Custom`; Defense `Standard`, `Development`, `Position`, `Custom`.

## Formula Audit

| Metric | Audit result |
| --- | --- |
| 3PO% / 4PO% | Correct: three/four-pitch retired PAs divided by retired PAs, not all BF. |
| 13PI% / 15PI% | Correct: qualifying completed three-out innings divided by the pitcher's completed three-out innings. Partial innings are excluded. |
| 123% | Correct: 1-2-3 innings divided by completed three-out innings; qualifying innings have three retired batters and no reacher. |
| LOO% | Correct: first completed PA faced in each inning that is retired divided by leadoff PAs faced. |
| Finish% / PutAway% | Correct: any batting out / strikeout after reaching two strikes, respectively, divided by PAs reaching two strikes. |
| BABIP | Correct: `(H - HR) / (AB - SO - HR + SF)`; unavailable rather than zero for an empty denominator. |
| OBP | Correct: `(H + BB + HBP) / (AB + BB + HBP + SF)`; IBB remains unavailable until explicitly captured. |
| IP and per-nine | Correct: IP stores outs and formats 5 outs as `1.2`; per-nine is `stat * 3 / outs`, never a decimal-IP calculation. |
| Contact%, Whiff%, Chase%, Zone%, CSW% | Correct canonical pitch-event denominators. Location metrics use only pitches with recorded locations; contact is contacts/swings, whiff is misses/swings, chase is out-of-zone swings/out-of-zone pitches, zone is in-zone/charted pitches, and CSW is called strikes plus misses/all pitches. |
| EV percentiles | Correct nearest-rank definition: percentile index `ceil(p * n) - 1`; qualification thresholds determine availability. |
| Team rates | Correctly aggregated from raw totals, not averaged player rates. Deterministic tests cover rate aggregation. |
| Hitting GB/LD/FB/PU rates | Corrected in this audit: denominator is classified BIP, not all BIP. Unclassified contact now renders `—`, never a misleading 0%. |

## Accepted Immediately-Derivable Additions

| Short | Full name | Key | Formula | Why useful | Game | Practice | Live BP | Currently derivable? | Missing primitive |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P/PA | Pitches per Plate Appearance | `pitches_per_plate_appearance` | Confirmed pitches in complete terminal PA sequences / those PAs | Measures hitter pitch efficiency without mixing field reps | Yes | No | No | Yes | Terminal linked pitch sequence required per PA |
| SBA | Stolen Base Attempts | `stolen_base_attempts` | `SB + CS` | Separates running volume from stolen-base success | Yes | No | No | Yes | None |
| BIP | Balls in Play Allowed | `balls_in_play_allowed` | Direct BIP count against pitcher | Captures pitcher contact workload | Yes | Yes | Yes | Yes | None where BIP is recorded |
| GB / LD / FB / PU | Batted Balls Allowed | `ground_balls_allowed`, `line_drives_allowed`, `fly_balls_allowed`, `pop_ups_allowed` | Count of directly classified BIP | Shows pitcher contact shape | Yes | Yes | Yes | Yes | BIP type only where current event is classified |
| GB% / LD% / FB% / PU% / GB/FB / Air% | Pitcher Batted-Ball Mix | `ground_ball_pct_allowed`, `line_drive_pct_allowed`, `fly_ball_pct_allowed`, `pop_up_pct_allowed`, `gb_fb_ratio_allowed`, `air_pct_allowed` | Type count / classified BIP; GB/FB is GB / FB; Air% is LD + FB + PU / classified BIP | Gives a source-safe pitcher batted-ball profile | Yes | Yes | Yes | Yes | Classified BIP only; missing classifications are unavailable |
| Hard / Hard% / Soft% | Pitcher Contact Quality Allowed | `hard_contact_allowed`, `hard_contact_allowed_pct`, `soft_contact_allowed_pct` | Hard count; hard or weak BIP / quality-classified BIP | Shows direct tagged contact quality without proxying EV | No | Yes | Yes | Yes | Game has no quality tag |

## Proposed but Deferred

| Short | Full name | Key | Formula | Why useful | Game | Practice | Live BP | Currently derivable? | Missing primitive |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| IBB | Intentional Walks | `intentional_walks` | Count of explicit intentional walks | Completes traditional line | No | No | No | No | `intentionalWalk` on completed PA |
| ER / ERA | Earned Runs / Earned Run Average | `earned_runs`, `earned_run_average` | Official ER; `ER * 3 / outs` | Official pitching evaluation | No | No | No | No | Runner responsibility and earned/unearned scoring resolution |
| W / L / SV | Pitcher Decisions | `wins`, `losses`, `saves` | Official scoring decision count | Traditional pitching line | No | No | No | No | Official pitcher-decision ledger |
| BK | Balks | `balks` | Explicit balk event count | Traditional pitching line | No | No | No | No | `Balk` event/outcome |
| AvgEV / MedEV / EV90 / MaxEV Allowed | Pitcher Exit Velocity Allowed | `average_exit_velocity_allowed`, `median_exit_velocity_allowed`, `exit_velocity_90th_percentile_allowed`, `maximum_exit_velocity_allowed` | Linked pitcher-facing BIP EV summaries | Direct contact-quality result | No | No | No | No | EV on pitcher BIP or stable hitter-contact-to-pitch link |
| Pull% / Mid% / Oppo% Allowed | Pitcher Spray Allowed | `pull_rate_allowed`, `middle_rate_allowed`, `opposite_rate_allowed` | Direction-qualified BIP / direction-qualified BIP | Shows contact direction allowed | No | No | No | No | Direction on pitcher BIP and batter hand/link |
| Usage% | Pitch Type Usage | `pitch_type_usage_pct` | Pitches of selected type / all pitches in unfiltered query context | Core pitch-mix measure | Yes | Yes | Yes | Not yet | Query must retain an unfiltered sibling denominator; a pitch-type filter alone yields 100% |
| IR / IRS% | Inherited Runners / Inherited Runner Scoring Rate | `inherited_runners`, `inherited_runner_scoring_pct` | Entrants inherited; inherited runners scoring / inherited runners | Relief evaluation | No | No | No | No | Responsible pitcher per runner plus pitcher-entry state |
| GP / INN / TC / PO / A / E / FPCT / DP | Game Fielding Line | `games_played`, `innings_fielded`, `total_chances`, `putouts`, `assists`, `errors`, `fielding_percentage`, `double_plays` | Official fielder-attributed play totals; `FPCT = (PO + A) / (PO + A + E)` | Traditional defense | No | No | No | No | Fielder play participation and defensive-outs/innings attribution |
| CS / PB / Blocks / Pop Time | Catcher Metrics | `caught_stealing`, `passed_balls`, `blocks`, `pop_time` | Catcher-attributed official/drill outcomes | Position-specific coaching | No | Partial | No | Partial | Catcher attribution, passed-ball, block, and timing records |
| QAB / Productive Out | Quality At-Bat / Productive Out | `quality_at_bats`, `productive_outs` | No canonical formula accepted | Coaching discussion aid | No | No | No | No | Team-approved definitions and game context |

## Intentionally Deferred Pro Metrics

`wOBA`, `wRC`, `wRC+`, and `OPS+` require league weights, run environment, and park/league baselines. `FIP`, `xFIP`, and `SIERA` require validated constants plus HR/FB or batted-ball models. `xAVG`, `xSLG`, and `xwOBA` require launch angle and a calibrated expected-outcome model. `DRS`, `OAA`, and `UZR` require play difficulty, positioning, and external/advanced tracking. None should be approximated in Analytics.

## Source and Preset Rules

Game result metrics and field-session tracking metrics may coexist in a table but never share invented denominators. Canonical pitch metrics may aggregate only identical pitch primitives across selected sources. Contact, quality, velocity, and BIP calculations require the relevant primitive at each source; unavailable remains `—`. Pitch Mix is a preset of canonical metrics applied through the pitch-type filter/view, not a collection of static pitch-type columns.

## Linear Handoff

No Linear connector is available in this task, so the local `docs/analytics-v3-backlog.md` records Analytics V3 status and the concrete Games/Defense data-capture requirements. Analytics V3 is explicitly not marked Done.

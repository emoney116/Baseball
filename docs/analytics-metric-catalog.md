# Clubhouse Analytics Metric Catalog

This document is the source of truth for Analytics metric semantics, source availability, and feasibility. A dash in the product means the required primitive is unavailable; it never means zero.

## Source Combination Rules

| Rule | Definition |
| --- | --- |
| Game box score + tracked field data | Game-only metrics (for example PA and ERA) coexist with Practice/Live BP tracking metrics (for example SW and Contact%) in a mixed table. They are never given a shared denominator. |
| Canonical pitch tracking | Pitch-level rates (for example Strike%, CSW%, Zone%, Whiff%) may aggregate Games, Practice, and Live BP only from their identical pitch-level primitives. |
| Canonical batted-ball tracking | Contact%, hard-contact, batted-ball type, direction, and exit-velocity metrics may aggregate Practice and Live BP when their event primitives are identical. Game data participates only when it includes the same primitive. |
| Game results | PA, AB, batting line, traditional pitching line, and efficiency metrics use confirmed game events and completed plate appearances only. They never combine with field-session reps. |
| Availability | A metric shown for a selected source set is calculated only from sources that provide its canonical primitive. Missing primitives render `—`; they do not contribute zero. |

## Gap Matrix

`Supported` has a canonical calculator backed by recorded primitives. `Partial` means the calculator is intentionally limited to the sources that supply every required primitive. `Requires primitive` is intentionally unavailable until the listed data is captured.

### Hitting Game Line

| Metric | Short label | Full name | Key | Domain | Formula / definition | Game | Practice | Live BP | Status | Missing primitive / reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Games Played | GP | Games Played | `games_played` | Hitting | Distinct confirmed game IDs with a batter event | Yes | No | No | Supported | None |
| Plate Appearances | PA | Plate Appearances | `plate_appearances` | Hitting | Completed linked plate appearances | Yes | No | Live BP only when completed PAs are linked | Supported | No practice PA contract |
| At Bats | AB | At Bats | `at_bats` | Hitting | PA - BB - IBB - HBP - SF - SH | Yes | No | No | Supported | IBB unavailable, treated separately as unavailable |
| Runs | R | Runs Scored | `runs_scored` | Hitting | Confirmed runner movements to home for batter/runner | Yes | No | No | Supported | None |
| Hits | H | Hits | `hits` | Hitting | 1B + 2B + 3B + HR | Yes | No | No | Supported | None |
| Singles / Doubles / Triples / Home Runs | 1B / 2B / 3B / HR | Hit type counts | `singles`, `doubles`, `triples`, `home_runs` | Hitting | Confirmed terminal BIP outcome count | Yes | No | No | Supported | None |
| Runs Batted In | RBI | Runs Batted In | `runs_batted_in` | Hitting | Confirmed event RBI, excluding error-attributed runs | Yes | No | No | Supported | None |
| Total Bases | TB | Total Bases | `total_bases` | Hitting | 1B + 2*2B + 3*3B + 4*HR | Yes | No | No | Supported | None |
| Walks / Hit By Pitch / Strikeouts | BB / HBP / SO | Plate-appearance outcome counts | `walks`, `hit_by_pitch`, `strikeouts` | Hitting | Completed PA outcome counts | Yes | No | No | Supported | None |
| Intentional Walks | IBB | Intentional Walks | `intentional_walks` | Hitting | Explicit intentional-walk PA flag | No | No | No | Requires primitive | No intentional-walk flag |
| Sacrifice Fly / Bunt | SF / SH | Sacrifice Fly / Sacrifice Bunt | `sacrifice_flies`, `sacrifice_bunts` | Hitting | Confirmed terminal BIP outcome count | Yes | No | No | Supported | None |
| Reached on Error / Fielder's Choice | ROE / FC | Reached on Error / Fielder's Choice | `reached_on_error`, `fielders_choice` | Hitting | Confirmed terminal BIP outcome count | Yes | No | No | Supported | None |
| Stolen Bases / Caught Stealing | SB / CS | Stolen Bases / Caught Stealing | `stolen_bases`, `caught_stealing` | Hitting | Confirmed runner actions for player | Yes | No | No | Supported | None |
| Batting Average | AVG | Batting Average | `batting_average` | Hitting | H / AB | Yes | No | No | Supported | None |
| On-Base Percentage | OBP | On-Base Percentage | `on_base_percentage` | Hitting | (H + BB + HBP) / (AB + BB + HBP + SF) | Yes | No | No | Supported | None |
| Slugging / OPS / ISO | SLG / OPS / ISO | Slugging / On-Base Plus Slugging / Isolated Power | `slugging_percentage`, `on_base_plus_slugging`, `isolated_power` | Hitting | TB/AB; OBP+SLG; SLG-AVG | Yes | No | No | Supported | None |
| K%, BB%, BB/K, PA/K, PA/BB | K% / BB% / BB/K / PA/K / PA/BB | Plate discipline game rates | `strikeout_rate`, `walk_rate`, `walk_to_strikeout`, `plate_appearances_per_strikeout`, `plate_appearances_per_walk` | Hitting | SO/PA; BB/PA; BB/SO; PA/SO; PA/BB | Yes | No | No | Supported | None |
| BABIP / XBH / XBH% / HR% / TB/PA | BABIP / XBH / XBH% / HR% / TB/PA | Game outcome rates | `batting_average_on_balls_in_play`, `extra_base_hits`, `extra_base_hit_rate`, `home_run_rate`, `total_bases_per_plate_appearance` | Hitting | (H-HR)/(AB-SO-HR+SF); 2B+3B+HR; XBH/H; HR/PA; TB/PA | Yes | No | No | Supported | Requires completed PA and terminal outcome coverage; otherwise `—` |
| Stolen Base Percentage | SB% | Stolen Base Percentage | `stolen_base_percentage` | Hitting | SB / (SB + CS) | Yes | No | No | Supported | None |

### Hitting Tracking and Contact

| Metric | Short label | Full name | Key | Domain | Formula / definition | Game | Practice | Live BP | Status | Missing primitive / reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Swing / Take / Contact / Whiff / Foul | Swing% / Take% / Contact% / Whiff% / Foul% | Pitch-decision rates | `swing_rate`, `take_rate`, `contact_rate`, `whiff_rate`, `foul_rate` | Hitting | Per tracked pitch: swings/opportunities; takes/opportunities; (fouls+BIP)/swings; misses/swings; fouls/swings | Yes when pitch sequence exists | Yes | Yes | Supported | None |
| Chase / Zone Swing / Zone Contact / O-Contact | Chase% / Zone SW% / Zone CT% / O-Contact% | Location decision rates | `chase_rate`, `zone_swing_rate`, `zone_contact_rate`, `out_of_zone_contact_rate` | Hitting | Location-qualified pitch-event ratios | Yes when location exists | Yes | Yes | Supported | Missing location produces `—` |
| Called / Swinging Strike | CS% / SwStr% | Called Strike / Swinging Strike Rate | `called_strike_rate`, `swinging_strike_rate` | Hitting | Called strikes/opportunities; swinging strikes/opportunities | Yes | No | Live BP pitch sequence only | Supported | Game pitch-event bridge is implemented; practice requires linked pitch records |
| First-Pitch Swing / Two-Strike Contact | FPSw% / 2S CT% | First-Pitch Swing Rate / Two-Strike Contact Rate | `first_pitch_swing_rate`, `two_strike_contact_rate` | Hitting | Swings on 0-0 / 0-0 pitches; contacts on two-strike swings / two-strike swings | Yes | Linked-pitch only | Yes when counts link | Supported | Linked count required; otherwise `—` |
| BIP and contact quality | BIP / BIP% / Hard% / Soft% | Balls in Play and quality | `balls_in_play`, `balls_in_play_rate`, `hard_contact_rate`, `soft_contact_rate` | Hitting | BIP; BIP/swings; quality-tagged BIP/BIP | Game BIP only; hard/soft need quality | Yes | Yes | Partial | Game has no contact-quality tag |
| Exit velocity | Avg EV / Med EV / EV90 / EV95 / Max EV | Exit Velocity summaries | `average_exit_velocity`, `median_exit_velocity`, `exit_velocity_90th_percentile`, `exit_velocity_95th_percentile`, `maximum_exit_velocity` | Hitting | Recorded EV summary; percentiles require qualification | No | Yes | Yes | Supported for field sources | Game event velocity is pitch velocity, not EV |
| Batted-ball mix | GB% / LD% / FB% / PU% / GB/FB | Batted-ball distribution | `ground_ball_rate`, `line_drive_rate`, `fly_ball_rate`, `pop_up_rate`, `ground_ball_to_fly_ball` | Hitting | Type count/BIP; GB/FB | Yes when contact type exists | Yes | Yes | Supported / partial game | Missing scored contact type produces `—` |
| Spray distribution | Pull% / Mid% / Oppo% | Pull / Middle / Opposite Field Rate | `pull_rate`, `middle_rate`, `opposite_rate` | Hitting | Direction-qualified BIP / direction-qualified BIP | Derivable from field point + batter hand | Yes | Yes | Partial | Game requires field location and batter hand |

### Pitching Game Line and Efficiency

| Metric | Short label | Full name | Key | Domain | Formula / definition | Game | Practice | Live BP | Status | Missing primitive / reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Appearances / Starts | APP / GS | Pitching Appearances / Games Started | `appearances`, `games_started` | Pitching | Distinct game IDs pitched; game starting-pitcher assignment | Yes | No | No | Supported | None |
| Decisions | W / L / SV | Wins / Losses / Saves | `wins`, `losses`, `saves` | Pitching | Official pitcher decision attribution | No | No | No | Requires primitive | No official decision ledger |
| Innings / Batters Faced | IP / BF | Innings Pitched / Batters Faced | `innings_pitched`, `batters_faced` | Pitching | Outs recorded / 3, formatted baseball innings; completed PA faced | Yes | No | Live BP PAs only when completed | Supported | None |
| Pitches / Strikes / Balls | P / Strikes / Balls | Pitch count line | `pitches`, `strikes`, `balls` | Pitching | Confirmed pitch outcomes | Yes | Yes | Yes | Supported | None |
| H / R / ER / HR / BB / IBB / HBP / SO / WP / BK | H / R / ER / HR / BB / IBB / HBP / SO / WP / BK | Traditional pitching results | `hits_allowed`, `runs_allowed`, `earned_runs`, `home_runs_allowed`, `walks_allowed`, `intentional_walks_allowed`, `hit_batters`, `strikeouts`, `wild_pitches`, `balks` | Pitching | Terminal PA/runners; error-aware ER needs official attribution | H/R/HR/BB/HBP/SO/WP derivable; ER/IBB/BK unavailable | No | No | Partial | No earned-run, IBB, or balk primitive |
| ERA / WHIP | ERA / WHIP | Earned Run Average / Walks and Hits per Inning Pitched | `earned_run_average`, `walks_hits_per_inning` | Pitching | ER*9/IP; (BB+H)/IP | ERA unavailable; WHIP derivable | No | No | Partial | No earned runs |
| K%, BB%, K-BB%, K/BB | K% / BB% / K-BB% / K/BB | Strikeout and walk efficiency | `strikeout_rate`, `walk_rate`, `strikeout_minus_walk_rate`, `strikeout_to_walk` | Pitching | SO/BF; BB/BF; K%-BB%; SO/BB | Yes | No | No | Supported | None |
| K/9, BB/9, H/9, HR/9 | K/9 / BB/9 / H/9 / HR/9 | Per-nine rates | `strikeouts_per_nine`, `walks_per_nine`, `hits_per_nine`, `home_runs_per_nine` | Pitching | Stat*9/IP | Yes | No | No | Supported | None |
| Opponent line | Opp AVG / OBP / SLG / OPS / BABIP | Opponent batting metrics | `opponent_batting_average`, `opponent_on_base_percentage`, `opponent_slugging_percentage`, `opponent_ops`, `opponent_babip` | Pitching | Same canonical formulas from faced PAs | Yes | No | No | Supported | None |
| Pitches per inning / BF / out | P/IP / P/BF / P/Out | Pitching efficiency ratios | `pitches_per_inning`, `pitches_per_batter_faced`, `pitches_per_out` | Pitching | P/(outs/3); P/BF; P/outs | Yes | No | No | Supported | None |
| Three/Four-pitch outs | 3PO / 3PO% / 4PO / 4PO% | Three/Four-Pitch Out and Rate | `three_pitch_out`, `three_pitch_out_rate`, `four_pitch_out`, `four_pitch_out_rate` | Pitching | Retired PA with exactly 3 or 4 confirmed pitches; rate / retired batters | Yes | No | No | Supported | Needs linked terminal PA sequence; otherwise `—` |
| Short innings | 13PI / 13PI% / 15PI / 15PI% | 13/15-Pitch Inning and Rate | `thirteen_pitch_inning`, `thirteen_pitch_inning_rate`, `fifteen_pitch_inning`, `fifteen_pitch_inning_rate` | Pitching | Completed 3-out pitcher inning at <=13 or <=15 pitches; rate / completed pitcher innings | Yes | No | No | Supported | Needs inning snapshots and pitcher association; otherwise `—` |
| Clean innings | 123 / 123% / Zero% | 1-2-3 Inning / Rate / Scoreless Inning Rate | `one_two_three_inning`, `one_two_three_inning_rate`, `scoreless_inning_rate` | Pitching | Completed 3-out inning with no batter reaching; rate / completed pitcher innings; scoreless completed innings / completed pitcher innings | Yes | No | No | Supported | None |
| Leadoff and two-strike finishes | LOO / LOO% / Finish% / PutAway% | Leadoff Out / Rate / Two-Strike Finish / Putaway Rate | `leadoff_out`, `leadoff_out_rate`, `two_strike_finish_rate`, `putaway_rate` | Pitching | First faced PA in inning retired; rate / leadoff BF. Any out after reaching 2 strikes / two-strike PAs; strikeouts / two-strike PAs | Yes | No | No | Supported | Needs linked pitch sequence; otherwise `—` |
| Pitch tracking | Strike%, Ball%, FPS%, Zone%, CS%, SwStr%, CSW%, Whiff%, Chase%, Swing%, Z-Whiff%, Z-Contact% | Canonical pitch quality rates | `strike_rate`, `ball_rate`, `first_pitch_strike_rate`, `zone_rate`, `called_strike_rate`, `swinging_strike_rate`, `csw_rate`, `whiff_rate`, `chase_rate`, `swing_rate`, `zone_whiff_rate`, `zone_contact_rate` | Pitching | Event-level defined denominators | Yes | Yes | Yes | Supported | Missing location produces `—` |
| Velocity | AvgV / MedV / V90 / MinV / MaxV / VeloΔ | Pitch velocity summaries | `average_velocity`, `median_velocity`, `velocity_90th_percentile`, `minimum_velocity`, `maximum_velocity`, `velocity_delta` | Pitching | Recorded velocity summary; max-min for delta | Yes | Yes | Yes | Supported | None |
| Contact allowed | BIP / GB% / LD% / FB% / PU% / Hard% / Avg EV / Med EV / EV90 / Max EV / Pull% / Mid% / Oppo% | Pitcher contact allowed | `balls_in_play_allowed`, `ground_ball_rate_allowed`, `line_drive_rate_allowed`, `fly_ball_rate_allowed`, `pop_up_rate_allowed`, `hard_contact_rate_allowed`, `average_exit_velocity_allowed`, `median_exit_velocity_allowed`, `exit_velocity_90th_percentile_allowed`, `maximum_exit_velocity_allowed`, `pull_rate_allowed`, `middle_rate_allowed`, `opposite_rate_allowed` | Pitching | Faced BIP summaries | Game type/direction partial; no game EV/hard | Practice/Live BP where linked hitter events exist | Practice/Live BP where linked hitter events exist | Partial | Game lacks EV/quality; practice needs hitter-pitch linkage |

### Defense and Pro-Metric Feasibility

| Metric | Short label | Full name | Key | Domain | Formula / definition | Game | Practice | Live BP | Status | Missing primitive / reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Traditional defense | GP / INN / TC / PO / A / E / FPCT / DP | Game fielding line | `games_played`, `innings_fielded`, `total_chances`, `putouts`, `assists`, `errors`, `fielding_percentage`, `double_plays` | Defense | Official fielder attribution for each play | No | No | No | Requires primitive | Game Center has no fielder/assist/putout attribution |
| Practice defense | REP / Clean / Clean% / Err / Err% / THR / Acc / Throw% / Conversion% | Practice defensive development | `reps`, `clean_reps`, `clean_rate`, `errors`, `error_rate`, `throws`, `accurate_throws`, `throw_accuracy`, `conversion_rate` | Defense | Current structured rep and throw outcome calculations | No | Yes | No | Supported except Conversion% | No defined conversion opportunity primitive |
| Catcher specifics | SBA / CS / CS% / PB / Blocks / Block% / Pop Time | Catcher game and drill metrics | `stolen_base_attempts`, `caught_stealing`, `caught_stealing_rate`, `passed_balls`, `blocks`, `block_rate`, `pop_time` | Defense | Requires catcher-attributed runner and blocking events | No | Blocks in drills only | No | Requires primitive | No catcher attribution, passed ball, or pop-time field |
| wOBA / wRC / wRC+ / OPS+ | — | Context-normalized hitting metrics | `woba`, `wrc`, `wrc_plus`, `ops_plus` | Hitting | League weights and park/league baseline | No | No | No | Requires baseline | No league weights, run environment, or park factors |
| FIP / xFIP / SIERA | — | Pitcher independent estimators | `fip`, `xfip`, `siera` | Pitching | Requires ER-independent constants, league HR/FB or batted-ball model | No | No | No | Requires baseline / advanced tracking | No league constants or validated model |
| xAVG / xSLG / xwOBA | — | Expected outcome metrics | `xavg`, `xslg`, `xwoba` | Hitting/Pitching | Validated launch-angle/EV model | No | No | No | Requires advanced tracking | No launch angle or calibrated model |
| DRS / OAA / UZR | — | Advanced defensive value | `drs`, `oaa`, `uzr` | Defense | Play difficulty, positioning, league baselines, tracking | No | No | No | Requires advanced tracking | No requisite tracking or baselines |

## Efficiency Denominators

| Metric | Deterministic definition |
| --- | --- |
| 3PO% / 4PO% | Three/four-pitch retired plate appearances divided by all retired plate appearances. This measures how efficiently outs are produced, not the share of all batters faced. |
| 13PI% / 15PI% | Completed three-out innings by that pitcher at or below the pitch threshold divided by the pitcher’s completed three-out innings. Partial innings do not qualify for either denominator. |
| 123% | 1-2-3 innings divided by completed three-out innings by that pitcher. A 1-2-3 inning has three retired batters and no batter reaching base. |
| LOO% | Leadoff batters retired divided by leadoff batters faced. A leadoff batter is the first completed PA faced by the pitcher in an inning. |
| Finish% | Two-strike PAs ending in any batting out divided by PAs that reached two strikes. |
| PutAway% | Strikeouts divided by PAs that reached two strikes. |

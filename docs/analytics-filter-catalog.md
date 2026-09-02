# Analytics Filter and View Catalog

Last audited: 2026-09-02

The executable catalog is `app/lib/analyticsCatalog.ts`. Every view is a grouping/preset over the same bounded Analytics Query Engine. There is no separate Box Score and Situational calculation path.

## Views

| Domain | View | Games | Practice | Live BP | Behavior |
| --- | --- | --- | --- | --- | --- |
| Hitting | Overview | Supported | Supported | Supported | Player rows. |
| Hitting | Counts | Supported | Partial | Partial | Exact count groups; practice requires linked pitch count. |
| Hitting | Pitch Types | Supported | Supported | Supported | Pitch-type group rows. |
| Hitting | vs LHP / RHP | Partial | Partial | Partial | Requires identified pitcher and handedness. |
| Hitting | Game State | Supported | Not applicable | Not applicable | Winning / tied / trailing before the event. |
| Hitting | Batted Ball | Supported | Supported | Supported | Uses scored/recorded contact type. |
| Hitting | Spray / Location | Pending shared Game field contract | Supported | Supported | Pull / Middle / Opposite for practice data. |
| Pitching | Overview | Supported | Supported | Supported | Player rows. |
| Pitching | Counts | Supported | Supported | Supported | Exact count groups. |
| Pitching | Pitch Types | Supported | Supported | Supported | Pitch-type group rows. |
| Pitching | vs LHB / RHB | Partial | Partial | Partial | Requires identified hitter and handedness. |
| Pitching | Game State | Supported | Not applicable | Not applicable | Winning / tied / trailing before the pitch. |
| Pitching | Location | Supported | Supported | Supported | Hitter-relative 3x3 regions plus in/out zone. |
| Defense | Overview / Positions / Rep Types / Drills | Not tracked | Supported | Not tracked | Practice defensive reps only. |
| Development | Overview / Weight Room / Attendance / Trends | Not applicable | Supported | Source-independent | Reuses bounded development calculations. |

Views with partial coverage report how many qualifying events contain the grouping dimension. Unclassified events are not silently assigned to a default bucket.

## Universal Filters

### Source and time

- Source: Games, Practice, Live BP, or All where the domain supports it.
- Season/time: Season, 7 days, 30 days, or custom date range.
- Event/session selection: existing Games and Practice session identifiers.

### Pitch and matchup

- Canonical pitch type.
- Minimum and maximum recorded pitch velocity.
- Hitting pitch location: hitter-relative 3x3 regions (`Inside`, `Away`, vertical combinations), in zone, or out of zone. Switch-side questions require tracked side context; roster handedness is not treated as a pitch-by-pitch switch-hitter fact.
- Pitching pitch location: pitcher-relative 3x3 regions (`Arm Side`, `Glove Side`, vertical combinations), in zone, or out of zone. Horizontal semantics use the tracked pitcher's throwing hand, matching the bullpen location grid.
- Exact count and grouped count: first pitch, hitter ahead, even, pitcher ahead, two strike, full count.
- Pitcher hand for hitting and batter hand for pitching when an identified player is attached.

### Game state

- Opponent and home/away.
- Inning and outs.
- Winning, tied, or trailing before the event.
- Bases empty, runners on, or RISP.
- Pitch outcome and scored ball-in-play outcome.

The current model does not have a canonical leverage-index or late-and-close calculation. Those labels remain unavailable rather than inferred from arbitrary thresholds.

### Contact, Practice, and Defense

- Batted-ball type and Practice spray direction.
- Hitting drill/session type and Live BP thrower source.
- Defense station, position, drill, rep type/subtype, result, and throw result.

## Composition Rules

All active filters are combined with `AND`; multiple selected values inside one filter are combined with `OR`. For example:

`Games + Slider + 85+ mph + Down & Away + 1-2 + RISP`

returns only events satisfying every selected dimension. A missing required dimension does not qualify. Active filters are URL-serializable, individually removable, and passed with visible columns and scope in the Analytics context foundation for CLU9-40.

## Unsupported Data

- Complete Game PA statistics and official pitching/fielding lines are not exposed until the scorer/import layer guarantees them.
- Game spray remains separate from the Practice spray taxonomy until CLU9-41 finalizes the shared field rendering/coordinate contract.
- Practice hitting count is partial unless the hitting event is linked to a pitch/plate appearance.
- Opponent handedness is partial when the opponent is not represented by a resolvable player identity.

No unsupported filter is silently ignored by the query layer.

# Analytics Filter and View Catalog

Last audited: 2026-09-03

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

## Filter experience

The Analytics filter sheet is a staged control surface over the same bounded Analytics Query Engine. It does not run a query while the coach is composing a selection.

- Opening **Filters** clones the currently applied filter state into a staged state.
- **Apply Filters** commits the staged state once, closes the sheet, updates the table/charts, active chips, and the Analytics deep link.
- **Cancel** discards the staged state and leaves applied Analytics unchanged.
- **Clear All** clears only staged Analytics filters. It does not reset domain, source, season/time context, or event selection.
- The Filters trigger shows an active count when applied filters exist. Applied chips remain individually removable outside the sheet.

### Hierarchy and availability

The sheet shows only filters supported by the active domain and source. Its sections are ordered for baseball workflows:

1. **Pitch**: pitch type, velocity, and pitch location.
2. **Count**: exact count and count group.
3. **Matchup**: pitcher hand for hitting, batter hand for pitching.
4. **Contact**: batted-ball type and spray direction where available.
5. **Practice**: drill and Live BP thrower context where available.
6. **Game Situation**: score state, inning, outs, and runners for Games.
7. **Game**, **Result**, and defense-specific sections appear only when their catalog definitions support the active context.

Pitch and Count open by default. Other sections stay compact until selected; an active count keeps a section visibly expanded so no applied condition is hidden. The sheet uses the existing ChoiceSelect family where single-choice context controls already exist; its specialized multi-select controls remain local because the current branch has no CLU9-42 shared multi-select surface to reuse.

### Pitch location

Pitch Location uses the same canonical 25-cell pitch grid used by tracking: the nine in-zone cells plus the full outer ring and home plate. It is explicitly labeled **Catcher View** and does not create another SVG or coordinate model.

- **All**, **In Zone**, and **Out of Zone** remain available above the visual grid.
- Region selection supports the query engine's existing union semantics. Multiple selected regions are shown as a region count.
- Hitting locations map to the existing hitter-relative `Away` / `In` region identifiers. Pitching locations map to the existing pitcher-relative `Arm Side` / `Glove Side` identifiers. The query engine remains responsible for applying each player’s handedness to recorded coordinates.
- Partial coverage is shown once, quietly, inside the relevant filter card. Events without tracked locations do not qualify when a location filter is applied.

### Count behavior

Exact count and count group are separate existing filters. Exact count exposes the canonical twelve count states. Count groups use the centralized `First Pitch`, `Hitter Ahead`, `Even`, `Pitcher Ahead`, `Two Strike`, and `Full Count` definitions. Active filter groups retain existing AND semantics; multiple options inside a filter retain existing OR semantics.

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

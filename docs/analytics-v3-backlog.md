# Analytics V3 Backlog

This is a local handoff for the Analytics V3 work that would normally be entered in Linear. The current task has no Linear integration, so no external issue state was changed.

## In Progress / Landed in This Pass

- Expanded canonical metric catalog with key, short label, full name, formula, source availability, presets, and Custom-column search.
- Game result mapping and compatible multi-source aggregation rules.
- Deterministic game hitting, pitching efficiency, baseball-innings, batted-ball, and practice-defense validation.
- Audit-backed additions: game P/PA, SBA, direct pitcher batted-ball/contact-quality metrics, source-safe batted-ball denominators, and Baserunning/Pitch Mix presets.

## Metric-Catalog Audit Status

The metric catalog was audited after `df30ee0` for baseball-stat correctness and completeness. Analytics V3 remains active and is not Done. The detailed assessment lives in `docs/analytics-metric-catalog-audit.md`.

## Upstream Data-Capture Requirements

### Games

- Add `intentionalWalk` to the completed plate-appearance record to expose IBB without assuming every walk is intentional.
- Add official pitcher-decision records (`win`, `loss`, `save`) keyed by game and pitcher. Decisions cannot be inferred safely from final score state alone.
- Attach each runner to a `responsiblePitcherId` and preserve earned/unearned-run scoring resolution. This is required for ER, ERA, inherited runners, and inherited runs.
- Capture a `Balk` event or pitch outcome explicitly; it cannot be reconstructed from existing runner movement.
- Add fielder-attributed play participants: position, putout, assist, fielding error, throwing error, and double-play participation. Include innings fielded / defensive outs to complete the game fielding line.
- Add catcher-specific attribution for steal attempts, caught stealing, passed balls, blocks, and pop time where those events are tracked.

### Practice and Live BP

- Store exit velocity and directional/spray primitives on the pitcher-facing contact record, or add a stable hitter-contact-to-pitch-event link. Current session records do not safely support pitcher Avg EV or spray allowed.
- Preserve a queryable unfiltered pitch total alongside a pitch-type filtered total before offering Pitch Mix `Usage%`; a pitch-type-filtered denominator alone always produces 100%.
- Define conversion opportunities/results for practice defense before exposing Conversion%.

## Remaining Product Work

- Capture earned runs, official pitching decisions, intentional-walk flags, and balks to complete ERA, W, L, SV, IBB, and BK.
- Add fielder attribution, putouts, assists, double-play attribution, and innings fielded to support traditional game defense.
- Link hitter exit velocity/direction to pitcher events before exposing pitcher EV and spray allowed.
- Capture catcher-specific attempted steals, passed balls, blocks, and pop time where applicable.
- Establish league and park baselines before considering wOBA, wRC, wRC+, OPS+, FIP, xFIP, or SIERA.
- Add launch-angle and calibrated tracking inputs before considering xAVG, xSLG, xwOBA, DRS, OAA, or UZR.

Analytics remains an active product area; this backlog does not mark it complete.

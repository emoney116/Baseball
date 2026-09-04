# Analytics Insights V1

Analytics Insights is a team-first reading layer over the canonical Analytics query engine. It does not own a second calculator or persist a second rollup. Every number is produced by `executeAnalyticsQuery` with the same source selection, time range, event scope, and filters used by Analytics Overview and Charts.

## Source Rules

- The selected source scope stays visible at the top of Insights.
- Game-only sections issue an explicit Games query. They are never blended with Practice or Live BP values.
- Practice and Live BP display only compatible tracking and development measures such as contact, whiff, hard contact, and exit velocity.
- Where Games and practice are selected together, an insight either uses the engine's source-compatible aggregate or is labelled and calculated as Games only. No combined game PA / practice-swing denominator is created.
- Unavailable values stay `-`; an observed zero remains `0`.

## Insight Families

### Offense

Game scope provides an offense overview, situational hitting (RISP, RISP with two outs, two outs, first pitch, two strikes, score state), count performance, handedness, inning splits, and qualified 30-day hot/cold leaders. Practice or Live BP replaces game situations with Contact Quality and Approach sections.

### Pitching

Game scope provides standard pitching, Inning Efficiency, Command, Pitch Mix, and Two-Strike Performance. Efficiency rows use the canonical definitions for P/IP, P/BF, P/Out, 3PO%, 4PO%, 13PI%, 15PI%, 1-2-3 innings, scoreless innings, leadoff-out rate, and two-strike finish rate. Pitch Mix intentionally does not show Usage% until the engine has both unfiltered and filtered pitch totals.

### Defense

The Defense view provides canonical defense totals and source-aware development/position views. Traditional Game fielding measures remain unavailable until Games captures fielder-attributed participation.

### Team

The Team view is a quick identity layer that surfaces compatible offensive, pitching, and defensive measures. It does not invent a cross-domain composite score.

## Interaction Contract

Rows and section details carry their exact query context back into Analytics Overview. A situational row therefore opens the normal dense table with its relevant source, metric columns, time window, and filters applied. Qualified hot/cold rows open the existing player context.

`View All` expands one insight family without turning Insights into a report builder. Ask Clubhouse receives the active query plus the relevant detail-section context.

## Trends and Takeaways

Trends appear only for 7-day and 30-day windows without an explicit event selection. The comparison uses the immediately preceding equal-length range via the same canonical query. Favorability is metric-aware, so a lower strikeout rate is positive while a higher OPS is positive.

Takeaways are deterministic threshold checks over canonical values. They do not claim league ranks, opponent benchmarks, or causality when those primitives are unavailable.

## Intentional Gaps

- No league ranks, percentile claims, or opponent-average comparisons without a supplied comparable dataset.
- No Game-only score situations that lack filter primitives, including exact base configurations and late-and-close.
- No player heat/cold labels below the documented 10-PA Games qualification.
- No unsupported defensive attribution, pitcher earned-run/decision statistics, or pitch-mix usage rates.

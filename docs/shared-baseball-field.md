# Shared Baseball Field Visualization

`ClubhouseBaseballField` is the canonical scalable field renderer for Clubhouse.
It uses the normalized `0..1` coordinate space and SVG geometry exported from
`app/lib/sprayChart.ts`, with a `1000 x 700` view box. New Practice and
Analytics batted-ball locations must be written in that normalized space.

## Rendering modes

The shared component supports `blank`, `spray`, `count`, `percent`, and `heat`
views. It accepts point overlays, a selectable active point, and an optional
click handler for location entry. Count, percentage, and heat views use the
same fair-territory geometry and calculated point distribution as spray dots.

## Legacy Game Center locations

Existing Game Center events were recorded against the retired square field
asset. They remain stored in their original coordinate space. `BaseballField`
in `app/components/visuals.tsx` is now a compatibility wrapper: it converts
legacy Game points to the canonical field for display and converts selected
points back before the existing Game write path runs. No historical events are
rewritten as part of this change.

`legacyGamePointToCanonical` and `canonicalPointToLegacyGame` provide the
explicit adapter. They are intentionally limited to the legacy Game surface;
new Practice, Live BP, and Analytics locations must not pass through them.

## Analytics ownership

Analytics spray-chart points are calculated in `executeAnalyticsQuery` after
the existing source, date, event, and situational filters run. The UI consumes
the returned `sprayChart` descriptor only; it does not independently filter or
aggregate hitting events. The descriptor preserves balls-in-play and tracked
location coverage so missing charting data is visible instead of implied.

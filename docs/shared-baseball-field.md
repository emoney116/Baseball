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

## CLU9-40 visual answer contract

CLU9-40 should request a bounded visual descriptor from the existing Analytics
query layer, then render it with an existing Clubhouse component. It must not
ask a model to generate a chart image or calculate filters independently.

```ts
type AnalyticsVisualDescriptor = {
  kind: "spray_chart" | "pitch_location" | "heat_map";
  mode: "blank" | "spray" | "count" | "percent" | "heat";
  scope: { teamId: string; seasonId?: string; source: string };
  filters: Record<string, string | number | boolean | undefined>;
  coverage: { qualifyingEvents: number; trackedLocations: number };
  data: unknown;
};
```

For batted-ball answers, `data` is the existing `AnalyticsResult.sprayChart`
payload and `ClubhouseBaseballField` is the renderer. Pitch-location answers
continue to use the existing strike-zone renderer. The response/audit layer
may retain the descriptor beside the query plan, but the model receives only
the already-filtered, bounded summary required to explain it.

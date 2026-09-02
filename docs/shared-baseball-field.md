# Shared Baseball Field Visualization

`ClubhouseBaseballField` is the canonical field renderer for Clubhouse. It
uses Cambell's existing Game Center asset at
`/game-tracking/baseball-field-spray-chart-v1.png` as its only field surface.
Practice and Analytics retain their existing normalized stored coordinates and
adapt them only at the rendering boundary.

## Rendering modes

The shared component supports `blank`, `spray`, `count`, `percent`, and `heat`
views. It accepts point overlays, a selectable active point, and an optional
click handler for location entry. Count, percentage, and heat views layer
calculated data above the same Game Center field asset.

## Legacy Game Center locations

Existing Game Center events already use the asset's native coordinate space.
`BaseballField` in `app/components/visuals.tsx` passes those coordinates
straight through. The explicit coordinate adapter preserves existing Practice
and Analytics point data without rewriting a historical event.

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

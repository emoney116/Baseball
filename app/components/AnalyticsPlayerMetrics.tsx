"use client";
import type { AnalyticsResult, AnalyticsRow } from "../lib/analyticsQuery";
import type { AnalyticsCell } from "../lib/analyticsQuery";

export function AnalyticsPlayerMetrics({ result, row, limit }: { result: AnalyticsResult; row?: AnalyticsRow; limit?: number }) {
  return (
    <div className={`analytics-player-metric-list${limit ? " analytics-player-metric-list--summary" : ""}`}>
      {result.columns.slice(0, limit).map(column => (
        <div key={column.metricId} title={column.definition}>
          <span>{column.label}</span>
          <strong>{row?.cells[column.metricId]?.display ?? "—"}</strong>
          {analyticsSampleText(row?.cells[column.metricId]) && <small>{analyticsSampleText(row?.cells[column.metricId])}</small>}
        </div>
      ))}
    </div>
  );
}

function analyticsSampleText(cell?: AnalyticsCell): string | undefined {
  if (!cell?.sample) return undefined;
  const { numerator, denominator, label } = cell.sample;
  if (typeof numerator === "number" && typeof denominator === "number") return `${numerator}/${denominator}`;
  if (typeof denominator === "number" && label) return `${denominator} ${label}`;
  if (typeof denominator === "number") return `${denominator}`;
  return undefined;
}

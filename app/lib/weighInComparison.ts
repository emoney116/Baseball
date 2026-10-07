type WeighIn = { playerId: string; date: string; updatedAt: string; bodyWeight?: number; notes?: string };

export function actualWeighIn(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function measuredWeighIn(row: Pick<WeighIn, "bodyWeight" | "notes">) {
  return actualWeighIn(row.bodyWeight) && !row.notes?.includes("Unverified roster-copy");
}

export function weighInComparison(sessions: readonly WeighIn[], playerId: string, date: string, current?: number) {
  const recorded = sessions.filter(row => row.playerId === playerId && row.date <= date && measuredWeighIn(row))
    .slice().sort((a, b) => a.date.localeCompare(b.date) || a.updatedAt.localeCompare(b.updatedAt));
  const previous = recorded.filter(row => row.date < date).at(-1)?.bodyWeight;
  const first = recorded[0]?.bodyWeight;
  const change = (baseline?: number) => actualWeighIn(current) && actualWeighIn(baseline)
    ? (current - baseline) / baseline * 100 : undefined;
  return { previous, first, fromPrevious: change(previous), fromFirst: change(first) };
}

export function signedWeighInPercent(value?: number) {
  if (value === undefined || !Number.isFinite(value)) return "--";
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)}%`;
}

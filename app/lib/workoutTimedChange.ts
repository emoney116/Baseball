export function timedAttemptDropoff(first: number | undefined, second: number | undefined): number | undefined {
  if (first === undefined || second === undefined || !Number.isFinite(first) || !Number.isFinite(second) || first <= 0 || second <= 0) return undefined;
  const percent = ((second - first) / first) * 100;
  return Number.isFinite(percent) ? percent : undefined;
}

export function formatTimedAttemptDropoff(percent: number): string {
  const rounded = Math.round(Math.abs(percent) * 10) / 10;
  return percent < 0 && rounded > 0 ? `${rounded.toFixed(1)}% faster` : `Drop-off ${rounded.toFixed(1)}%`;
}

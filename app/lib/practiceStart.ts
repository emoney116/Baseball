export function localPracticeStartFields(now = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  };
}

export function validatePracticeStart(date: string, time: string, now = new Date()):
  { startedAt: string; error?: never } | { error: string; startedAt?: never } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return { error: "Enter a valid Practice date and time." };
  }
  const start = new Date(`${date}T${time}:00`);
  const normalized = localPracticeStartFields(start);
  // Date can normalize invalid calendar dates or nonexistent local DST times.
  if (!Number.isFinite(start.getTime()) || normalized.date !== date || normalized.time !== time) {
    return { error: "Enter a valid Practice date and time." };
  }
  if (start.getTime() > now.getTime()) {
    return { error: "Practice cannot start in the future. Choose the current time or an earlier start." };
  }
  return { startedAt: start.toISOString() };
}

export type WorkoutTestConditions = {
  key: string;
  mode: "TIMED_REPS" | "MAX_DURATION" | "FIXED_LOAD_TIMED_REPS";
  durationSeconds?: number;
  loadLb?: number;
  configurableLoad?: boolean;
  bilateral?: boolean;
};

export const BASELINE_TESTING_CIRCUIT = [
  { name: "Pull-Ups", conditions: { key: "pull-ups-60", mode: "TIMED_REPS", durationSeconds: 60 } },
  { name: "Push-Ups", conditions: { key: "push-ups-60", mode: "TIMED_REPS", durationSeconds: 60 } },
  { name: "Bar Bench Press", conditions: { key: "bar-bench-60", mode: "FIXED_LOAD_TIMED_REPS", durationSeconds: 60, loadLb: 45 } },
  { name: "Dead Hang", conditions: { key: "dead-hang", mode: "MAX_DURATION" } },
  { name: "Side Plank", conditions: { key: "side-plank", mode: "MAX_DURATION", bilateral: true } },
  { name: "Grip / Plate Hold", conditions: { key: "plate-hold", mode: "MAX_DURATION", configurableLoad: true } },
  { name: "Squat", conditions: { key: "squat-60", mode: "FIXED_LOAD_TIMED_REPS", durationSeconds: 60, loadLb: 135 } },
] satisfies Array<{ name: string; conditions: WorkoutTestConditions }>;

export function validateTestConditions(value: WorkoutTestConditions) {
  if (!value || !/^[a-z0-9-]{1,80}$/.test(value.key) || !["TIMED_REPS", "MAX_DURATION", "FIXED_LOAD_TIMED_REPS"].includes(value.mode)) throw new Error("Choose a valid test.");
  if (value.mode !== "MAX_DURATION" && (!Number.isInteger(value.durationSeconds) || value.durationSeconds! <= 0 || value.durationSeconds! > 3600)) throw new Error("Set the test duration in seconds.");
  if (value.loadLb !== undefined && (!Number.isFinite(value.loadLb) || value.loadLb < 0 || value.loadLb > 2000)) throw new Error("Check the configured load.");
  if (value.mode === "FIXED_LOAD_TIMED_REPS" && value.loadLb === undefined) throw new Error("Set the fixed load.");
  return value;
}

export function parseTestResult(text: string, conditions: WorkoutTestConditions): number | undefined {
  validateTestConditions(conditions);
  if (!text.trim()) return undefined;
  const trimmed = text.trim();
  let value: number;
  if (conditions.mode === "MAX_DURATION") {
    if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed) && !/^\d+:\d{2}(?:\.\d{1,2})?$/.test(trimmed)) throw new Error("Enter seconds or minutes:seconds.");
    const parts = trimmed.split(":");
    if (parts.length === 2 && Number(parts[1]) >= 60) throw new Error("Seconds after the colon must be below 60.");
    value = parts.length === 2 ? Number(parts[0]) * 60 + Number(parts[1]) : Number(trimmed);
  } else {
    if (!/^\d+$/.test(trimmed)) throw new Error("Enter whole reps.");
    value = Number(trimmed);
  }
  if (!Number.isFinite(value) || value < 0 || value > (conditions.mode === "MAX_DURATION" ? 86400 : 10000)) throw new Error("Check the result.");
  return value;
}

export function formatTestResult(value: number | undefined | null, conditions: WorkoutTestConditions) {
  if (value == null) return "—";
  if (conditions.mode !== "MAX_DURATION") return `${value}`;
  const hundredths = Math.round(value * 100);
  const minutes = Math.floor(hundredths / 6000);
  const seconds = (hundredths % 6000) / 100;
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}

export function testConditionLabel(conditions: WorkoutTestConditions) {
  return [conditions.loadLb === undefined ? undefined : `${conditions.loadLb} lb`, conditions.mode === "MAX_DURATION" ? "Max time" : `${conditions.durationSeconds} sec`].filter(Boolean).join(" · ");
}

export function testComparisonKey(conditions: WorkoutTestConditions, side?: string) {
  return JSON.stringify([conditions.key, conditions.mode, conditions.durationSeconds ?? null, conditions.loadLb ?? null, side ?? null]);
}

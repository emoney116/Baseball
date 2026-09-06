import type { PlayerCapabilities } from "./playerCapabilities";

export const LIVE_DOMAINS = [
  "hitting",
  "pitching",
  "defense",
  "workout",
] as const;
export type LiveDomain = (typeof LIVE_DOMAINS)[number];
export type LiveField = {
  key: string;
  label: string;
  options?: readonly string[];
  kind?: "number" | "point" | "count";
  min?: number;
  max?: number;
};
const pitchTypes = [
  "4-Seam",
  "2-Seam",
  "Sinker",
  "Cutter",
  "Slider",
  "Curveball",
  "Changeup",
  "Splitter",
  "Knuckleball",
  "Other",
];
const balls = ["Ground ball", "Line drive", "Fly ball", "Pop up"];
export const LIVE_RESULTS: Record<LiveDomain, readonly string[]> = {
  hitting: ["Ball in play", "Foul", "Miss", "Took pitch", "Swing"],
  pitching: [
    "Called Strike",
    "Ball",
    "Whiff",
    "Foul",
    "Ball in play",
    "HBP",
    "Swing",
    "Take",
  ],
  defense: ["Clean", "Error", "Missed Rep", "Good Play", "Great Play"],
  workout: ["Completed", "Modified", "Skipped"],
};
export const LIVE_FIELDS: Record<LiveDomain, LiveField[]> = {
  hitting: [
    { key: "pitch_type", label: "Pitch Type", options: pitchTypes },
    {
      key: "velocity",
      label: "Pitch Velocity",
      kind: "number",
      min: 1,
      max: 130,
    },
    {
      key: "exit_velocity_mph",
      label: "Exit Velocity",
      kind: "number",
      min: 1,
      max: 130,
    },
    { key: "pitch_location", label: "Pitch Location", kind: "point" },
    { key: "contact_result", label: "Batted Ball", options: balls },
    {
      key: "contact_quality",
      label: "Contact Quality",
      options: ["Poor", "Weak", "Solid", "Hard", "Barrel"],
    },
    {
      key: "direction",
      label: "Spray Direction",
      options: ["Pull", "Pull-center", "Center", "Opposite-center", "Opposite"],
    },
    { key: "field_location", label: "Spray Location", kind: "point" },
  ],
  pitching: [
    { key: "pitch_type", label: "Pitch Type", options: pitchTypes },
    { key: "velocity", label: "Velocity", kind: "number", min: 1, max: 130 },
    { key: "location", label: "Pitch Location", kind: "point" },
    { key: "count_before", label: "Count Before", kind: "count" },
    { key: "batted_ball", label: "Batted Ball", options: balls },
    {
      key: "contact_quality",
      label: "Contact Quality",
      options: ["Weak contact", "Medium contact", "Hard contact"],
    },
  ],
  defense: [
    {
      key: "rep_type",
      label: "Rep Type",
      options: [
        "Ground Ball",
        "Fly Ball",
        "Line Drive",
        "Throw",
        "Double Play",
        "Block",
        "Pick",
        "Bunt",
        "Other",
      ],
    },
    {
      key: "rep_subtype",
      label: "Rep Detail",
      options: [
        "Routine",
        "Forehand",
        "Backhand",
        "Slow Roller",
        "Charge",
        "Drop Step",
        "Over Shoulder",
        "Cutoff",
        "Relay",
        "Block",
        "Throwdown",
        "Pick",
        "Bunt",
        "Other",
      ],
    },
    {
      key: "throw_result",
      label: "Throw",
      options: ["Accurate", "Inaccurate", "No Throw"],
    },
    {
      key: "error_type",
      label: "Error Type",
      options: ["Fielding", "Throwing", "Decision"],
    },
    {
      key: "difficulty",
      label: "Difficulty",
      options: ["Routine", "Difficult", "Plus"],
    },
  ],
  workout: [
    { key: "weight", label: "Load", kind: "number", min: 0, max: 1500 },
    { key: "reps", label: "Reps", kind: "number", min: 0, max: 1000 },
    { key: "value", label: "Result", kind: "number", min: 0, max: 100000 },
    { key: "rpe", label: "RPE", kind: "number", min: 0, max: 10 },
  ],
};
export type PlayerLiveSession = {
  id: string;
  domain: LiveDomain;
  title: string;
  station: string;
  startedAt: string;
  fields: string[];
  practiceId?: string;
  exercise?: {
    id: string;
    name: string;
    sets: number;
    reps?: number;
    weight?: number;
    value?: number;
    measurement: string;
    unit?: string;
  };
};
export type PlayerLiveEntry = {
  id: string;
  sessionId: string;
  domain: LiveDomain;
  payload: Record<string, unknown>;
  editable: boolean;
  createdAt: string;
};
export type PlayerLiveState = {
  sessions: PlayerLiveSession[];
  entries: PlayerLiveEntry[];
  capabilities: PlayerCapabilities;
  context: {
    playerId: string;
    name: string;
    teamName: string;
    seasonName?: string;
  };
};

export function normalizeLivePayload(
  domain: LiveDomain,
  value: unknown,
  deleting = false,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid entry fields.");
  const input = value as Record<string, unknown>,
    output: Record<string, unknown> = {};
  const resultKey =
    domain === "workout"
      ? "status"
      : domain === "hitting"
        ? "action"
        : "outcome";
  for (const [key, v] of Object.entries(input)) {
    if (key === resultKey) {
      if (!LIVE_RESULTS[domain].includes(String(v)))
        throw new Error("Choose a valid result.");
      output[key] = v;
      continue;
    }
    if (domain === "workout" && key === "stationId") {
      if (typeof v !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(v))
        throw new Error("Choose an assigned station.");
      output[key] = v;
      continue;
    }
    if (domain === "workout" && key === "setNumber") {
      if (!Number.isInteger(v) || Number(v) < 1 || Number(v) > 100)
        throw new Error("Choose a valid set.");
      output[key] = v;
      continue;
    }
    const field = LIVE_FIELDS[domain].find((f) => f.key === key);
    if (!field) throw new Error("Unsupported entry field.");
    if (v === undefined || v === "" || v === null) continue;
    if (field.options) {
      if (typeof v !== "string" || !field.options.includes(v))
        throw new Error(`Invalid ${field.label}.`);
      output[key] = v;
    } else if (field.kind === "number") {
      if (
        typeof v !== "number" ||
        !Number.isFinite(v) ||
        v < field.min! ||
        v > field.max! ||
        (key === "reps" && !Number.isInteger(v))
      )
        throw new Error(`Invalid ${field.label}.`);
      output[key] = v;
    } else if (field.kind === "point") {
      const point = v as { x?: unknown; y?: unknown };
      if (
        !point ||
        typeof point.x !== "number" ||
        typeof point.y !== "number" ||
        !Number.isFinite(point.x) ||
        !Number.isFinite(point.y) ||
        point.x < 0 ||
        point.x > 1 ||
        point.y < 0 ||
        point.y > 1
      )
        throw new Error("Choose a valid location.");
      output[key] = { x: point.x, y: point.y };
    } else if (field.kind === "count") {
      const count = v as { balls?: unknown; strikes?: unknown };
      if (
        !count ||
        !Number.isInteger(count.balls) ||
        !Number.isInteger(count.strikes) ||
        Number(count.balls) < 0 ||
        Number(count.balls) > 3 ||
        Number(count.strikes) < 0 ||
        Number(count.strikes) > 2
      )
        throw new Error("Choose a valid count.");
      output[key] = { balls: count.balls, strikes: count.strikes };
    }
  }
  if (!deleting && !output[resultKey]) throw new Error("Choose a result.");
  if (domain === "workout" && (!output.stationId || !output.setNumber))
    throw new Error("Choose a station and set.");
  return output;
}

export function liveCapability(domain: LiveDomain) {
  return {
    hitting: "canLogLiveHitting",
    pitching: "canLogLivePitching",
    defense: "canLogLiveDefense",
    workout: "canLogWorkoutSets",
  }[domain] as
    | "canLogLiveHitting"
    | "canLogLivePitching"
    | "canLogLiveDefense"
    | "canLogWorkoutSets";
}

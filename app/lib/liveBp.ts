import type { ZonePoint, PitchType, ContactQuality } from "../types.ts";

export function liveBpPitchContactQuality(
  value?: string,
): ContactQuality | undefined {
  if (["Hard", "Barrel", "Hard contact"].includes(value ?? ""))
    return "Hard contact";
  if (["Solid", "Medium contact"].includes(value ?? ""))
    return "Medium contact";
  if (["Poor", "Weak", "Weak contact"].includes(value ?? ""))
    return "Weak contact";
  return undefined;
}
import { TENDEX_PITCH_TYPES } from "./tendexGameAnalysis.ts";
import { advancePitchCount } from "./pitchCount.ts";

export const BP_POSITIONS = [
  "P",
  "C",
  "1B",
  "2B",
  "3B",
  "SS",
  "LF",
  "CF",
  "RF",
] as const;
export type BpPosition = (typeof BP_POSITIONS)[number];
export type BpSettings = {
  mode: "FREE" | "AB" | "GAME";
  source: "MACHINE" | "COACH" | "PLAYER";
  hitterId: string;
  pitcherId?: string;
  coachName?: string;
  pitchMode: "OFF" | "ONE" | "MULTI";
  pitchType?: PitchType;
  velocity: boolean;
  location: boolean;
  ev: boolean;
  spray: boolean;
  countTracking?: boolean;
  defense: "OFF" | "ALL" | "SELECTED";
  positions: BpPosition[];
  alignment: Partial<Record<BpPosition, string>>;
};
export type BpState = {
  balls: number;
  strikes: number;
  outs: number;
  runners: number[];
  job: string;
  pa: number;
};
export type BpContext = {
  source: "Live BP";
  thrower: BpSettings["source"];
  coachName?: string;
  mode: BpSettings["mode"];
  countTracked?: boolean;
  before: Omit<BpState, "balls" | "strikes"> &
    Partial<Pick<BpState, "balls" | "strikes">>;
  after: Omit<BpState, "balls" | "strikes"> &
    Partial<Pick<BpState, "balls" | "strikes">>;
  result: string;
  jobSuccess?: boolean;
  runnerOutcomes?: Record<string, string>;
};
export type BpRound = {
  id: string;
  practice_id: string;
  settings: BpSettings;
  state: BpState;
  version: number;
  ended_at: string | null;
};
export type BpDraft = {
  outcome: string;
  pitchType?: PitchType;
  velocity?: number;
  location?: ZonePoint;
  ev?: number;
  spray?: ZonePoint;
  battedBall?: string;
  contactQuality?: string;
  result?: string;
  position?: BpPosition;
  defenseResult?: string;
  errorType?: string;
  throwResult?: string;
  runnerOutcomes?: Record<string, string>;
  jobSuccess?: boolean;
};
export const initialBpState = (): BpState => ({
  balls: 0,
  strikes: 0,
  outs: 0,
  runners: [],
  job: "",
  pa: 1,
});
export const bpTracksCount = (
  settings: Pick<BpSettings, "mode" | "countTracking">,
) => settings.countTracking ?? settings.mode !== "FREE";
export const initialBpSettings = (hitterId: string): BpSettings => ({
  mode: "FREE",
  source: "MACHINE",
  hitterId,
  pitchMode: "OFF",
  velocity: false,
  location: false,
  ev: false,
  spray: false,
  defense: "OFF",
  positions: [],
  alignment: {},
});
export function bpAssert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message);
}
export function validateBpSettings(s: BpSettings) {
  bpAssert(
    s?.coachName === undefined ||
      (typeof s.coachName === "string" &&
        s.coachName.trim().length > 0 &&
        s.coachName.length <= 80),
    "Enter a coach name of up to 80 characters.",
  );
  bpAssert(
    s &&
      ["FREE", "AB", "GAME"].includes(s.mode) &&
      ["MACHINE", "COACH", "PLAYER"].includes(s.source),
    "Choose a Live BP mode and source.",
  );
  bpAssert(
    ["OFF", "ONE", "MULTI"].includes(s.pitchMode) &&
      ["OFF", "ALL", "SELECTED"].includes(s.defense),
    "Choose tracking options.",
  );
  bpAssert(
    s.hitterId &&
      (s.source !== "PLAYER" || (s.pitcherId && s.pitcherId !== s.hitterId)),
    "Select distinct hitter and player pitcher.",
  );
  bpAssert(
    s.pitchMode === "OFF" || TENDEX_PITCH_TYPES.includes(s.pitchType!),
    "Choose a pitch type.",
  );
  bpAssert(
    Array.isArray(s.positions) &&
      s.positions.every((p) => BP_POSITIONS.includes(p)) &&
      s.alignment &&
      Object.keys(s.alignment).every((p) =>
        BP_POSITIONS.includes(p as BpPosition),
      ),
    "Choose defensive positions.",
  );
  bpAssert(
    [s.velocity, s.location, s.ev, s.spray].every(
      (v) => typeof v === "boolean",
    ),
    "Invalid tracking settings.",
  );
  bpAssert(
    s.countTracking === undefined || typeof s.countTracking === "boolean",
    "Invalid count tracking setting.",
  );
  const assigned = Object.values(s.alignment).filter(Boolean);
  bpAssert(
    new Set(assigned).size === assigned.length,
    "Assign each fielder to one position.",
  );
}
export function withBpPitcherAlignment(settings: BpSettings): BpSettings {
  const alignment = { ...settings.alignment };
  delete alignment.P;
  if (settings.source === "PLAYER" && settings.pitcherId) {
    for (const position of BP_POSITIONS)
      if (alignment[position] === settings.pitcherId)
        delete alignment[position];
    alignment.P = settings.pitcherId;
  }
  return { ...settings, alignment };
}

export function bpPositionTracked(settings: BpSettings, position: BpPosition) {
  return (
    !(position === "P" && settings.source !== "PLAYER") &&
    (settings.defense === "ALL" ||
      (settings.defense === "SELECTED" &&
        settings.positions.includes(position)))
  );
}

export function toggleBpPosition(
  settings: BpSettings,
  position: BpPosition,
): BpSettings {
  if (position === "P" && settings.source !== "PLAYER") return settings;
  const enabled = BP_POSITIONS.filter((p) => bpPositionTracked(settings, p));
  const positions = enabled.includes(position)
    ? enabled.filter((p) => p !== position)
    : [...enabled, position];
  return {
    ...settings,
    defense: positions.length ? "SELECTED" : "OFF",
    positions,
  };
}

export function validateBpState(s: BpState) {
  bpAssert(
    s &&
      Number.isInteger(s.balls) &&
      s.balls >= 0 &&
      s.balls <= 3 &&
      Number.isInteger(s.strikes) &&
      s.strikes >= 0 &&
      s.strikes <= 2,
    "Check the count.",
  );
  bpAssert(
    Number.isInteger(s.outs) &&
      s.outs >= 0 &&
      s.outs <= 2 &&
      Array.isArray(s.runners) &&
      s.runners.every((b) => [1, 2, 3].includes(b)) &&
      new Set(s.runners).size === s.runners.length,
    "Check runners and outs.",
  );
  bpAssert(
    typeof s.job === "string" &&
      s.job.length <= 80 &&
      Number.isInteger(s.pa) &&
      s.pa > 0,
    "Check the situational job.",
  );
}
function point(p?: ZonePoint) {
  if (p !== undefined)
    bpAssert(
      Number.isFinite(p.x) &&
        Number.isFinite(p.y) &&
        p.x >= 0 &&
        p.x <= 1 &&
        p.y >= 0 &&
        p.y <= 1,
      "Choose a valid location.",
    );
  return p;
}
function speed(n?: number) {
  if (n !== undefined)
    bpAssert(
      Number.isFinite(n) && n >= 1 && n <= 130,
      "Velocity must be 1-130 mph.",
    );
  return n;
}

export function buildBpPitch(
  settings: BpSettings,
  before: BpState,
  draft: BpDraft,
) {
  validateBpSettings(settings);
  validateBpState(before);
  const outcomes = [
    "Ball",
    "Called Strike",
    "Whiff",
    "Foul",
    "Ball in play",
    "HBP",
  ];
  bpAssert(outcomes.includes(draft.outcome), "Choose a pitch result.");
  const bip = draft.outcome === "Ball in play",
    swing = ["Whiff", "Foul", "Ball in play"].includes(draft.outcome);
  const pitchType =
    settings.pitchMode === "OFF"
      ? undefined
      : settings.pitchMode === "ONE"
        ? settings.pitchType
        : (draft.pitchType ?? settings.pitchType);
  bpAssert(
    !pitchType || TENDEX_PITCH_TYPES.includes(pitchType),
    "Choose a pitch type.",
  );
  const location = settings.location ? point(draft.location) : undefined;
  const velocity = settings.velocity ? speed(draft.velocity) : undefined;
  const ev = bip && settings.ev ? speed(draft.ev) : undefined;
  const spray = bip && settings.spray ? point(draft.spray) : undefined;
  bpAssert(
    !bip ||
      !draft.contactQuality ||
      ["Poor", "Weak", "Solid", "Hard", "Barrel"].includes(
        draft.contactQuality,
      ),
    "Choose contact quality.",
  );
  bpAssert(
    !bip ||
      !draft.battedBall ||
      ["Ground ball", "Line drive", "Fly ball", "Pop up"].includes(
        draft.battedBall,
      ),
    "Choose a batted-ball type.",
  );
  bpAssert(
    !bip ||
      !draft.result ||
      [
        "Out",
        "Single",
        "Double",
        "Triple",
        "Home Run",
        "Reached on Error",
        "Fielders Choice",
      ].includes(draft.result),
    "Choose a batter result.",
  );
  bpAssert(
    !bip || settings.mode !== "GAME" || draft.result,
    "Choose the batter result before updating runners.",
  );
  const trackedCount = bpTracksCount(settings);
  const count = trackedCount
    ? advancePitchCount(before, draft.outcome)
    : { balls: 0, strikes: 0 };
  const ended =
    bip || draft.outcome === "HBP" || count.balls >= 4 || count.strikes >= 3;
  const after: BpState = {
    ...before,
    runners: [...before.runners],
    ...(!trackedCount || ended ? { balls: 0, strikes: 0 } : count),
    pa: before.pa + (ended ? 1 : 0),
  };
  const runnerOutcomes: Record<string, string> = {};
  let result = bip ? (draft.result ?? "Ball in play") : draft.outcome;
  if (trackedCount)
    result =
      count.balls >= 4 ? "Walk" : count.strikes >= 3 ? "Strikeout" : result;
  if (settings.mode === "GAME" && ended) {
    result =
      count.balls >= 4 ? "Walk" : count.strikes >= 3 ? "Strikeout" : result;
    const defaults: Record<string, string> = {};
    for (const base of before.runners) defaults[String(base)] = String(base);
    if (result === "Walk" || result === "HBP") {
      if (before.runners.includes(1)) {
        defaults["1"] = "2";
        if (before.runners.includes(2)) {
          defaults["2"] = "3";
          if (before.runners.includes(3)) defaults["3"] = "score";
        }
      }
      defaults.batter = "1";
    } else
      defaults.batter = ["Out", "Strikeout"].includes(result)
        ? "out"
        : ["Single", "Reached on Error", "Fielders Choice"].includes(result)
          ? "1"
          : result === "Double"
            ? "2"
            : result === "Triple"
              ? "3"
              : result === "Home Run"
                ? "score"
                : "hold";
    if (result === "Home Run")
      for (const base of before.runners) defaults[String(base)] = "score";
    for (const [key, value] of Object.entries({
      ...defaults,
      ...(bip ? draft.runnerOutcomes : {}),
    })) {
      bpAssert(
        key === "batter" || before.runners.includes(Number(key)),
        "Runner is not on base.",
      );
      bpAssert(
        ["1", "2", "3", "score", "out", "hold"].includes(value),
        "Choose a runner outcome.",
      );
      runnerOutcomes[key] = value;
    }
    after.runners = [];
    for (const [key, value] of Object.entries(runnerOutcomes)) {
      if (value === "out") after.outs++;
      const dest =
        value === "hold" ? (key === "batter" ? 0 : Number(key)) : Number(value);
      if (dest >= 1 && dest <= 3) {
        bpAssert(
          !after.runners.includes(dest),
          "Two runners cannot finish on the same base.",
        );
        after.runners.push(dest);
      }
    }
    if (after.outs >= 3) {
      after.outs = 0;
      after.runners = [];
    }
  }
  if (settings.mode !== "GAME") {
    after.outs = 0;
    after.runners = [];
    after.job = "";
  }
  if (draft.jobSuccess !== undefined)
    bpAssert(typeof draft.jobSuccess === "boolean", "Choose the job result.");
  const beforeSituation = {
    outs: before.outs,
    runners: before.runners,
    job: before.job,
    pa: before.pa,
  };
  const afterSituation = {
    outs: after.outs,
    runners: after.runners,
    job: after.job,
    pa: after.pa,
  };
  const context: BpContext = {
    source: "Live BP",
    thrower: settings.source,
    ...(settings.source === "COACH" && settings.coachName
      ? { coachName: settings.coachName.trim() }
      : {}),
    mode: settings.mode,
    countTracked: trackedCount,
    before: trackedCount ? before : beforeSituation,
    after: trackedCount ? after : afterSituation,
    result,
    ...(settings.mode === "GAME" && ended
      ? {
          runnerOutcomes,
          jobSuccess: before.job ? draft.jobSuccess : undefined,
        }
      : {}),
  };
  const zone = location
    ? location.x >= 0.22 &&
      location.x <= 0.78 &&
      location.y >= 0.18 &&
      location.y <= 0.82
    : false;
  const hitting = {
    action: swing
      ? bip
        ? "Ball in play"
        : draft.outcome === "Whiff"
          ? "Miss"
          : "Foul"
      : "Took pitch",
    pitch_type: pitchType,
    velocity,
    pitch_location: location,
    exit_velocity_mph: ev,
    field_location: spray,
    contact_result: bip ? draft.battedBall : undefined,
    contact_quality: bip ? draft.contactQuality : undefined,
    is_live_bp: true,
  };
  const pitching =
    settings.source === "PLAYER"
      ? {
          pitch_type: pitchType ?? "",
          velocity,
          location,
          outcome: draft.outcome,
          is_strike: !["Ball", "HBP"].includes(draft.outcome),
          is_swing: swing,
          is_zone: zone,
          is_chase: location ? swing && !zone : undefined,
          is_whiff: draft.outcome === "Whiff",
          is_called_strike: draft.outcome === "Called Strike",
          is_ball_in_play: bip,
          batted_ball: bip ? draft.battedBall : undefined,
          contact_quality: bip
            ? liveBpPitchContactQuality(draft.contactQuality)
            : undefined,
          count_before: !trackedCount
            ? undefined
            : { balls: before.balls, strikes: before.strikes },
          count_after: !trackedCount
            ? undefined
            : { balls: after.balls, strikes: after.strikes },
        }
      : undefined;
  let defense;
  if (bip && settings.defense !== "OFF" && draft.position) {
    bpAssert(
      BP_POSITIONS.includes(draft.position) &&
        (settings.defense === "ALL" ||
          settings.positions.includes(draft.position)),
      "Defense position is not enabled.",
    );
    bpAssert(
      settings.alignment[draft.position],
      "Assign a fielder to this position.",
    );
    bpAssert(
      ["Clean", "Missed Rep", "Error", "Great Play"].includes(
        draft.defenseResult ?? "",
      ),
      "Choose the defensive result.",
    );
    bpAssert(
      !draft.errorType ||
        ["Fielding", "Throwing", "Decision"].includes(draft.errorType),
      "Choose error type.",
    );
    bpAssert(
      !draft.throwResult ||
        ["Accurate", "Inaccurate", "No Throw"].includes(draft.throwResult),
      "Choose throw result.",
    );
    defense = {
      player_id: settings.alignment[draft.position],
      position_worked: draft.position,
      station: ["LF", "CF", "RF"].includes(draft.position)
        ? "Outfield"
        : draft.position === "C"
          ? "Catching"
          : draft.position === "P"
            ? "PFP"
            : "Infield",
      outcome: draft.defenseResult,
      result: draft.defenseResult,
      error_type: draft.defenseResult === "Error" ? draft.errorType : undefined,
      throw_result: draft.throwResult,
      rep_type:
        draft.battedBall === "Ground ball"
          ? "Ground Ball"
          : draft.battedBall === "Line drive"
            ? "Line Drive"
            : draft.battedBall
              ? "Fly Ball"
              : "Other",
      location: spray,
    };
  }
  return {
    hitting,
    pitching,
    defense,
    context,
    stateBefore: before,
    stateAfter: after,
  };
}

import type { BpDraft, BpSettings, BpState } from "./liveBp.ts";
import { buildBpPitch, BP_POSITIONS } from "./liveBp.ts";
import type { ZonePoint } from "../types.ts";
import { sprayPointForLane } from "./sprayChart.ts";
import {
  matchVoiceVocabulary,
  normalizeVoiceText,
  VOICE_CONTACT_ALIASES,
  VOICE_PITCH_ALIASES,
  VOICE_RESULT_ALIASES,
  type VoiceIdentity,
} from "./voiceVocabulary.ts";

export type VoiceContext = {
  domain: "live-bp" | "hitting" | "pitching" | "defense";
  playerId?: string;
  roster: readonly VoiceIdentity[];
  bats?: "R" | "L" | "S";
  defenseRepType?: string;
  settings: BpSettings;
  state: BpState;
};
export type VoiceIntent = {
  version: 1;
  requestId: string;
  transcript: string;
  domain: VoiceContext["domain"];
  playerId?: string;
  pitcherId?: string;
  source: BpSettings["source"];
  draft: BpDraft;
  correction?: { balls?: number; strikes?: number; outs?: number };
  unresolvedFields: string[];
  ignoredFields: string[];
  confidence: {
    transcription: number | null;
    interpretation: number;
    identity: number;
    critical: number;
  };
};

const results = { ...VOICE_RESULT_ALIASES, strike: "Called Strike" };
const batterResults = {
  single: "Single",
  double: "Double",
  triple: "Triple",
  "home run": "Home Run",
  homer: "Home Run",
  out: "Out",
  error: "Reached on Error",
  "reached on error": "Reached on Error",
  "fielders choice": "Fielders Choice",
  "sac bunt": "Sac Bunt",
  "sac fly": "Sac Fly",
};
const fielders = {
  shortstop: "SS",
  short: "SS",
  second: "2B",
  "second base": "2B",
  third: "3B",
  "third base": "3B",
  first: "1B",
  "first base": "1B",
  pitcher: "P",
  catcher: "C",
  "left fielder": "LF",
  "center fielder": "CF",
  "right fielder": "RF",
} as const;
const defenseResults = {
  "clean play": "Clean",
  "clean rep": "Clean",
  clean: "Clean",
  "fielding error": "Error",
  "throwing error": "Error",
  "missed rep": "Missed Rep",
  "great play": "Great Play",
};
const throwResults = {
  "accurate throw": "Accurate",
  "inaccurate throw": "Inaccurate",
  "no throw": "No Throw",
};
const sprayLanes = {
  "left field line": "0",
  "left field": "0",
  "left center": "1",
  lcf: "1",
  center: "2",
  "center field": "2",
  "right center": "3",
  rcf: "3",
  "right field": "4",
  "right field line": "4",
};
const locations = {
  "up and in": "up in",
  "up in": "up in",
  "high inside": "high in",
  "up and away": "up away",
  "up away": "up away",
  "high outside": "high away",
  "down and in": "down in",
  "down in": "down in",
  "low inside": "low in",
  "down and away": "down away",
  "down away": "down away",
  "low and away": "low away",
  "low outside": "low away",
  "middle middle": "middle",
  middle: "middle",
  up: "up",
  high: "high",
  down: "down",
  low: "low",
  inside: "in",
  outside: "away",
  away: "away",
};

export function voiceLocationPoint(
  label: string,
  bats?: "R" | "L" | "S",
): ZonePoint | undefined {
  if ((label.includes("in") && label !== "middle") || label.includes("away")) {
    if (bats !== "R" && bats !== "L") return undefined;
  }
  const inside = label.split(" ").includes("in");
  const away = label.includes("away");
  return {
    x: inside
      ? bats === "L"
        ? 0.7
        : 0.3
      : away
        ? bats === "L"
          ? 0.3
          : 0.7
        : 0.5,
    y: label.includes("up")
      ? 0.1
      : label.includes("high")
        ? 0.3
        : label.includes("down")
          ? 0.9
          : label.includes("low")
            ? 0.7
            : 0.5,
  };
}

export function interpretVoice(
  transcript: string,
  context: VoiceContext,
  requestId: string,
  transcriptionConfidence: number | null = null,
): VoiceIntent {
  if (
    typeof transcript !== "string" ||
    transcript.length > 700 ||
    !transcript.trim()
  )
    throw new Error("Speak one short event.");
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(requestId))
    throw new Error("Invalid voice request.");
  let remaining = normalizeVoiceText(transcript);
  const unresolved = new Set<string>();
  const draft: BpDraft = { outcome: "" };
  const take = <T extends string>(
    key: string,
    vocabulary: Readonly<Record<string, T>>,
  ): T | undefined => {
    const matches = matchVoiceVocabulary(remaining, vocabulary);
    const values = [...new Set(matches.map((m) => m.value))];
    for (const m of [...matches].reverse())
      remaining =
        remaining.slice(0, m.start) +
        " ".repeat(m.end - m.start) +
        remaining.slice(m.end);
    if (values.length > 1) unresolved.add(key);
    return values.length === 1 ? values[0] : undefined;
  };
  let playerId =
    context.domain === "live-bp" ? context.settings.hitterId : context.playerId;
  const named: { id: string; phrase: string }[] = [];
  for (const player of context.roster)
    for (const alias of player.aliases) {
      const phrase = normalizeVoiceText(alias);
      if (
        phrase &&
        (remaining === phrase || remaining.startsWith(`${phrase} `))
      )
        named.push({ id: player.id, phrase });
    }
  if (named.length) {
    const longest = Math.max(...named.map((n) => n.phrase.length));
    const candidates = [
      ...new Set(
        named.filter((n) => n.phrase.length === longest).map((n) => n.id),
      ),
    ];
    if (candidates.length === 1) playerId = candidates[0];
    else {
      playerId = undefined;
      unresolved.add("player");
    }
    remaining = remaining.slice(longest).trim();
  }
  if (!playerId || !context.roster.some((p) => p.id === playerId))
    unresolved.add("player");
  if (
    playerId !==
    (context.domain === "live-bp"
      ? context.settings.hitterId
      : context.playerId)
  )
    unresolved.add("player selection");
  const pitcherId =
    context.settings.source === "PLAYER"
      ? context.settings.pitcherId
      : undefined;
  if (
    context.domain === "live-bp" &&
    context.settings.source === "PLAYER" &&
    (!pitcherId || !context.roster.some((p) => p.id === pitcherId))
  )
    unresolved.add("pitcher");
  let correction: VoiceIntent["correction"];
  const count = remaining.match(
    /^(?:set )?count (zero|one|two|three|[0-3]) (?:and )?(zero|one|two|[0-2])$/,
  );
  const outs = remaining.match(/^(?:set )?outs? (zero|one|two|[0-2])$/);
  if (outs) {
    correction = {
      outs: { zero: 0, one: 1, two: 2 }[outs[1]] ?? Number(outs[1]),
    };
    remaining = "";
    if (context.domain !== "live-bp" || context.settings.mode !== "GAME")
      unresolved.add("game-like outs");
  } else if (count) {
    const n = (v: string) =>
      ({ zero: 0, one: 1, two: 2, three: 3 })[v] ?? Number(v);
    correction = { balls: n(count[1]), strikes: n(count[2]) };
    remaining = "";
    if (
      context.domain !== "live-bp" ||
      context.settings.countTracking === false
    )
      unresolved.add("count tracking");
  } else {
    const runner = remaining.match(
      /\brunner (?:moves? |advances? )?to (first|second|third|home)\b/,
    );
    if (runner) {
      remaining = remaining.replace(runner[0], " ");
      if (
        context.settings.mode !== "GAME" ||
        context.state.runners.length !== 1
      )
        unresolved.add("runner");
      else
        draft.runnerOutcomes = {
          [String(context.state.runners[0])]: {
            first: "1",
            second: "2",
            third: "3",
            home: "score",
          }[runner[1] as "first" | "second" | "third" | "home"],
        };
    }
    const job = remaining.match(/\bjob (not done|done)\b/);
    if (job) {
      remaining = remaining.replace(job[0], " ");
      if (context.settings.mode !== "GAME" || !context.state.job)
        unresolved.add("job");
      else draft.jobSuccess = job[1] === "done";
    }
    draft.pitchType = take("pitch type", VOICE_PITCH_ALIASES);
    draft.defenseResult = take("defense result", defenseResults);
    if (/fielding error/i.test(transcript)) draft.errorType = "Fielding";
    if (/throwing error/i.test(transcript)) draft.errorType = "Throwing";
    draft.throwResult = take("throw result", throwResults);
    draft.battedBall = take("batted ball", VOICE_CONTACT_ALIASES);
    draft.result = take("batter result", batterResults);
    draft.position = take("fielder", fielders);
    const lane = take("spray", sprayLanes);
    if (lane !== undefined) draft.spray = sprayPointForLane(Number(lane));
    const location = take("pitch location", locations);
    if (location) {
      draft.location = voiceLocationPoint(location, context.bats);
      if (!draft.location) unresolved.add("batter handedness");
    }
    draft.outcome = take("pitch result", results) ?? "";
    if (draft.battedBall || draft.result) {
      if (draft.outcome && draft.outcome !== "Ball in play")
        unresolved.add("pitch result");
      draft.outcome = "Ball in play";
    }
    const evMatches = [
      ...remaining.matchAll(
        /\b(\d{2,3})\s*(?:exit velo(?:city)?|ev|exit)\b|\b(?:exit velo(?:city)?|ev)\s*(\d{2,3})\b/g,
      ),
    ];
    if (evMatches.length > 1) unresolved.add("exit velocity");
    if (evMatches.length === 1)
      draft.ev = Number(evMatches[0][1] ?? evMatches[0][2]);
    for (const m of evMatches) remaining = remaining.replace(m[0], " ");
    const velocities = [...remaining.matchAll(/\b\d{2,3}\b/g)];
    if (velocities.length > 1) unresolved.add("velocity");
    if (velocities.length === 1) draft.velocity = Number(velocities[0][0]);
    for (const m of velocities) remaining = remaining.replace(m[0], " ");
    if (
      draft.velocity !== undefined &&
      (draft.velocity < 25 || draft.velocity > 110)
    )
      unresolved.add("velocity");
    if (draft.ev !== undefined && (draft.ev < 20 || draft.ev > 130))
      unresolved.add("exit velocity");
    if (context.settings.pitchMode === "ONE") {
      if (draft.pitchType && draft.pitchType !== context.settings.pitchType)
        unresolved.add("sticky pitch type");
      draft.pitchType = context.settings.pitchType;
    }
    if (context.settings.pitchMode === "OFF") draft.pitchType = undefined;
    if (context.domain !== "defense" && !draft.outcome)
      unresolved.add("pitch result");
    if (
      context.domain === "defense" &&
      (!draft.battedBall || !draft.defenseResult)
    )
      unresolved.add("defense result");
    if (context.domain === "defense") {
      const rep = (
        {
          "Ground ball": "Ground Ball",
          "Hard ground ball": "Ground Ball",
          "Line drive": "Line Drive",
          "Fly ball": "Fly Ball",
          "Pop up": "Fly Ball",
          Bunt: "Bunt",
        } as Record<string, string>
      )[draft.battedBall ?? ""];
      if (context.defenseRepType && rep !== context.defenseRepType)
        unresolved.add("current defensive drill");
      if (draft.errorType === "Throwing" && draft.throwResult === "Accurate")
        unresolved.add("throw result");
      if (draft.errorType === "Fielding" && draft.throwResult === "Inaccurate")
        unresolved.add("error type");
    }
    if (context.domain !== "live-bp" && draft.result)
      unresolved.add("batter result requires Live BP");
    if (
      context.domain !== "live-bp" &&
      context.domain !== "defense" &&
      (draft.position || draft.defenseResult || draft.throwResult)
    )
      unresolved.add("defense requires Live BP");
    if (
      context.domain === "hitting" &&
      (!["Whiff", "Foul", "Ball in play"].includes(draft.outcome) ||
        draft.battedBall === "Bunt")
    )
      unresolved.add("hitting result");
    if (
      context.domain === "pitching" &&
      context.settings.location &&
      !draft.location
    )
      unresolved.add("pitch location");
    if (
      context.domain === "live-bp" &&
      draft.outcome === "Ball in play" &&
      context.settings.mode === "GAME" &&
      !draft.result
    )
      unresolved.add("batter result");
    if (
      context.domain === "live-bp" &&
      draft.position &&
      context.settings.defense === "OFF"
    )
      unresolved.add("defense disabled");
  }
  remaining = remaining
    .replace(
      /\b(?:and|to|at|mph|miles per hour|a|the|throws|throw|pitch|velo|velocity)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
  if (remaining) unresolved.add("unrecognized words");
  if (context.domain === "live-bp" && !correction && !unresolved.size) {
    try {
      buildBpPitch(context.settings, context.state, draft);
    } catch (e) {
      unresolved.add(e instanceof Error ? e.message : "event");
    }
  }
  const unresolvedFields = [...unresolved];
  const ignoredFields: string[] = [];
  for (const [key, enabled, label] of [
    ["velocity", context.settings.velocity, "Velocity"],
    ["location", context.settings.location, "Pitch location"],
    ["ev", context.settings.ev, "EV"],
    ["spray", context.settings.spray, "Spray"],
  ] as const) {
    if (!enabled && draft[key] !== undefined) {
      ignoredFields.push(label);
      delete draft[key];
    }
  }
  const intent: VoiceIntent = {
    version: 1,
    requestId,
    transcript,
    domain: context.domain,
    playerId,
    pitcherId,
    source: context.settings.source,
    draft,
    correction,
    unresolvedFields,
    ignoredFields,
    confidence: {
      transcription:
        transcriptionConfidence !== null &&
        Number.isFinite(transcriptionConfidence) &&
        transcriptionConfidence >= 0 &&
        transcriptionConfidence <= 1
          ? transcriptionConfidence
          : null,
      interpretation: remaining ? 0 : 1,
      identity:
        unresolved.has("player") ||
        unresolved.has("pitcher") ||
        unresolved.has("player selection")
          ? 0
          : 1,
      critical: unresolved.size ? 0 : 1,
    },
  };
  assertVoiceIntent(intent);
  return intent;
}

// Provider-neutral contract: reject additional fields and noncanonical values before dispatch.
export function assertVoiceIntent(
  value: unknown,
): asserts value is VoiceIntent {
  const object = (
    v: unknown,
    keys: readonly string[],
  ): Record<string, unknown> => {
    if (
      !v ||
      typeof v !== "object" ||
      Array.isArray(v) ||
      Object.keys(v).some((key) => !keys.includes(key))
    )
      throw new Error("Invalid Voice intent.");
    return v as Record<string, unknown>;
  };
  const text = (v: unknown, max: number) =>
    typeof v === "string" && v.length <= max;
  const number = (v: unknown, min: number, max: number) =>
    typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
  const i = object(value, [
    "version",
    "requestId",
    "transcript",
    "domain",
    "playerId",
    "pitcherId",
    "source",
    "draft",
    "correction",
    "unresolvedFields",
    "ignoredFields",
    "confidence",
  ]);
  if (
    i.version !== 1 ||
    !text(i.requestId, 80) ||
    !/^[a-zA-Z0-9-]{1,80}$/.test(String(i.requestId)) ||
    !text(i.transcript, 700) ||
    !String(i.transcript).trim() ||
    !["live-bp", "hitting", "pitching", "defense"].includes(String(i.domain)) ||
    !["MACHINE", "COACH", "PLAYER"].includes(String(i.source))
  )
    throw new Error("Invalid Voice intent.");
  for (const key of ["playerId", "pitcherId"])
    if (i[key] !== undefined && !text(i[key], 100))
      throw new Error("Invalid Voice identity.");
  if (
    !Array.isArray(i.unresolvedFields) ||
    i.unresolvedFields.length > 30 ||
    i.unresolvedFields.some((v) => !text(v, 200))
  )
    throw new Error("Invalid Voice clarification.");
  if (
    !Array.isArray(i.ignoredFields) ||
    i.ignoredFields.length > 4 ||
    i.ignoredFields.some(
      (v) => !["Velocity", "Pitch location", "EV", "Spray"].includes(String(v)),
    )
  )
    throw new Error("Invalid Voice tracking fields.");
  const c = object(i.confidence, [
    "transcription",
    "interpretation",
    "identity",
    "critical",
  ]);
  for (const key of ["transcription", "interpretation", "identity", "critical"])
    if (!(key === "transcription" && c[key] === null) && !number(c[key], 0, 1))
      throw new Error("Invalid Voice confidence.");
  const d = object(i.draft, [
    "outcome",
    "pitchType",
    "velocity",
    "location",
    "ev",
    "spray",
    "battedBall",
    "result",
    "position",
    "defenseResult",
    "errorType",
    "throwResult",
    "runnerOutcomes",
    "jobSuccess",
  ]);
  const enums: Record<string, readonly string[]> = {
    outcome: ["", ...Object.values(results)],
    pitchType: Object.values(VOICE_PITCH_ALIASES),
    battedBall: Object.values(VOICE_CONTACT_ALIASES),
    result: Object.values(batterResults),
    position: BP_POSITIONS,
    defenseResult: Object.values(defenseResults),
    errorType: ["Fielding", "Throwing", "Decision"],
    throwResult: Object.values(throwResults),
  };
  for (const [key, allowed] of Object.entries(enums))
    if (
      (key === "outcome" || d[key] !== undefined) &&
      !allowed.includes(String(d[key]))
    )
      throw new Error("Invalid Voice taxonomy.");
  for (const key of ["velocity", "ev"])
    if (d[key] !== undefined && !number(d[key], 0, 999))
      throw new Error("Invalid Voice measurement.");
  for (const key of ["location", "spray"])
    if (d[key] !== undefined) {
      const p = object(d[key], ["x", "y"]);
      if (!number(p.x, 0, 1) || !number(p.y, 0, 1))
        throw new Error("Invalid Voice location.");
    }
  if (d.jobSuccess !== undefined && typeof d.jobSuccess !== "boolean")
    throw new Error("Invalid Voice job.");
  if (d.runnerOutcomes !== undefined) {
    const r = object(d.runnerOutcomes, ["1", "2", "3"]);
    if (
      Object.values(r).some(
        (v) => !["1", "2", "3", "score", "out", "hold"].includes(String(v)),
      )
    )
      throw new Error("Invalid Voice runner.");
  }
  if (i.correction !== undefined) {
    const correction = object(i.correction, ["balls", "strikes", "outs"]);
    if (!Object.keys(correction).length)
      throw new Error("Invalid Voice correction.");
    for (const [key, v] of Object.entries(correction))
      if (!number(v, 0, key === "balls" ? 3 : 2) || !Number.isInteger(v))
        throw new Error("Invalid Voice correction.");
  }
}

export function canFastSaveVoice(intent: VoiceIntent): boolean {
  try {
    assertVoiceIntent(intent);
  } catch {
    return false;
  }
  return (
    !intent.correction &&
    intent.ignoredFields.length === 0 &&
    intent.unresolvedFields.length === 0 &&
    intent.confidence.transcription !== null &&
    intent.confidence.transcription >= 0.97 &&
    intent.confidence.interpretation === 1 &&
    intent.confidence.identity === 1 &&
    intent.confidence.critical === 1
  );
}

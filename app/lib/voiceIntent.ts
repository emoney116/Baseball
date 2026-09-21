import type { BpDraft, BpSettings, BpState } from "./liveBp.ts";
import { buildBpPitch, BP_POSITIONS, bpTracksCount } from "./liveBp.ts";
import type { ZonePoint } from "../types.ts";
import { sprayPointForLane } from "./sprayChart.ts";
import { correctedVoiceText } from "./voiceSession.ts";
import { parseVoiceRunners, normalizeNamedRunners } from "./voiceRunners.ts";
import { VOICE_QUALITY, anchorContactMeasurements } from './voiceBaseballLanguage.ts';
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
  manualDraft?: BpDraft;
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
  inferredRunnerChanges?: string[];
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
  doubled: "Double",
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
  "second baseman": "2B",
  third: "3B",
  "third base": "3B",
  first: "1B",
  "first base": "1B",
  "first baseman": "1B",
  "third baseman": "3B",
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
  "left center field": "1",
  "right center field": "3",
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
  "low away": "low away",
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
  let remaining = anchorContactMeasurements(correctedVoiceText(transcript));
  const unresolved = new Set<string>();
  const namedRunners = normalizeNamedRunners(remaining, context.roster, context.state);
  remaining = namedRunners.text;
  namedRunners.problems.forEach(problem=>unresolved.add(problem));
  remaining = remaining.replace(/\b(?:launch angle (\d{1,3})|(\d{1,3}) degrees?(?: launch angle)?)\b/g,()=>{
    unresolved.add('Launch angle is not supported in Live BP; no velocity inferred from degrees.');return ' ';
  });
  const draft: BpDraft = { outcome: "", ...Object.fromEntries(
    ["pitchType", "velocity", "location", "ev", "spray"].filter(key => context.manualDraft?.[key as keyof BpDraft] !== undefined)
      .map(key => [key, context.manualDraft![key as keyof BpDraft]]),
  ) };
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
  if(context.domain==='live-bp') {
    const aliases=new Map<string,string[]>();
    for(const player of context.roster)for(const alias of player.aliases) {
      const key=normalizeVoiceText(alias);
      if(key&&!(key in fielders))aliases.set(key,[...new Set([...(aliases.get(key)??[]),player.id])]);
    }
    const vocabulary=Object.fromEntries([...aliases.keys()].map(key=>[key,key]));
    for(const match of matchVoiceVocabulary(remaining,vocabulary).reverse()) {
      const suffix=remaining.slice(match.end).match(/^\s+(made (?:the play|an error)|booted it|dropped it|made the catch)\b/);
      if(!suffix)continue;
      const ids=aliases.get(match.value)!;
      const positions=ids.length===1?BP_POSITIONS.filter(position=>context.settings.alignment[position]===ids[0]):[];
      if(positions.length!==1){unresolved.add('defensive player');continue;}
      if(draft.defenderId&&draft.defenderId!==ids[0]){unresolved.add('defensive player');continue;}
      draft.defenderId=ids[0];
      draft.position=positions[0];
      const result=/error|booted|dropped/.test(suffix[1])?'error':'clean play';
      remaining=remaining.slice(0,match.start)+result+remaining.slice(match.end+suffix[0].length);
    }
  }
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
    if (/\bwalk\b/.test(remaining)) {
      if (bpTracksCount(context.settings,context.state) && context.state.balls===3) remaining=remaining.replace(/\bwalk\b/g,'ball');
      else unresolved.add('A walk needs a known three-ball count. Set the count first.');
    }
    if (/\bstrikeout (swinging|looking)\b/.test(remaining)) {
      if (bpTracksCount(context.settings,context.state) && context.state.strikes===2) remaining=remaining.replace(/\bstrikeout swinging\b/g,'whiff').replace(/\bstrikeout looking\b/g,'called strike');
      else unresolved.add('A strikeout needs a known two-strike count. Set the count first.');
    }
    remaining = remaining
      .replace(/\bhe bunted the ball\b/g, 'bunt')
      .replace(/\bit was (?:a )?successful sac(?:rifice)? bunt\b/g, 'sac bunt')
      .replace(/\bsuccessful (?:sacrifice|sac)\b(?: bunt)?/g, 'sac bunt')
      .replace(/\bmakes? (?:the |a )?catch\b/g, 'caught');
    remaining = remaining.replace(/^ball to (?=(?:left|right|center)\b)/, 'ball in play to ');
    remaining = remaining.replace(/\bbatter (?:is |was )?out at first(?: base)?\b/g, 'out');
    for (const alias of context.roster.find(p=>p.id===playerId)?.aliases ?? []) {
      const name = normalizeVoiceText(alias).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      remaining = remaining.replace(new RegExp(`\\b${name} bunted the ball\\b`, 'g'), 'bunt');
    }
    if (/\b(?:throwing|fielding) error\b/.test(remaining)) {
      remaining = remaining.replace(/\bbatter (?:is |was )?safe at first(?: base)?\b/g, 'reached on error')
        .replace(/\bmakes? (?:a )?(?=(?:throwing|fielding) error\b)/g, '');
      if (!context.state.runners.includes(1)) remaining=remaining.replace(/\brunner safe at first\b/g,'reached on error');
    }
    remaining=remaining.replace(/\bfly ball (?:to )?(left|center|right)(?: field)? caught\b/g,'fly ball $1 field $1 fielder caught');
    // A named batter out is distinct from an existing runner being retired.
    for (const alias of context.roster.find(p=>p.id===playerId)?.aliases ?? []) {
      const name = normalizeVoiceText(alias).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const batterOut = new RegExp(`\\b${name} (?:was thrown |was |is )?out (?:(?:at )?first(?: base)?(?: by (?:the )?)?\\b|(?=pitcher to first\\b))`, 'g');
      remaining = remaining.replace(batterOut, /\bsac(?:rifice)? bunt\b/.test(remaining) ? ' ' : 'out ');
    }
    const scoringError = /\brunner from (first|second|third) attempted to advance to home and was safe at home due to an error from the throw from (?:the )?(first baseman|second baseman|third baseman|shortstop|pitcher|catcher|left fielder|center fielder|right fielder) to (?:the )?(first baseman|second baseman|third baseman|shortstop|pitcher|catcher)\b/;
    const scoredOnError = remaining.match(scoringError);
    if (scoredOnError) {
      remaining = remaining.replace(scoringError, 'runner from $1 to home $2 throwing error throws to $3');
    }
    const receivingScoreError = /\brunner from (first|second|third) attempted to advance (?:to )?home and was safe at home after (?:the )?(first baseman|second baseman|third baseman|shortstop|pitcher|catcher|left fielder|center fielder|right fielder) threw to (?:the )?(first baseman|second baseman|third baseman|shortstop|pitcher|catcher) and (?:the )?(first baseman|second baseman|third baseman|shortstop|pitcher|catcher) made an error on the play\b/;
    const scoredOnReceivingError = remaining.match(receivingScoreError);
    if (scoredOnReceivingError) remaining = remaining.replace(receivingScoreError, 'runner from $1 to home $2 throws to $3 $4 made an error on the play');
    const taggedRunner = /\brunner tags and scores\b/.test(remaining);
    remaining = remaining.replace(/\brunner tags and scores\b/g, 'runner scores');
    const runners = parseVoiceRunners(remaining, context.state);
    remaining = runners.remaining;
    for (const problem of runners.problems) unresolved.add(problem);
    if (Object.keys(runners.outcomes).length) {
      draft.runnerOutcomes = runners.outcomes;
      draft.runnerMovements = runners.movements;
      if (taggedRunner && runners.movements.length === 1) draft.runnerReasons = {[runners.movements[0].runnerBase]:'Tag up'};
      if (scoredOnError) {
        const scored = Object.entries(runners.outcomes).filter(([,to])=>to==='score');
        if (scored.length===1) draft.runnerReasons = {[scored[0][0]]:'On throwing error'};
      }
      if (scoredOnReceivingError) {
        const scored = Object.entries(runners.outcomes).filter(([,to])=>to==='score');
        if (scored.length===1) draft.runnerReasons = {[scored[0][0]]:'Other'};
      }
      if (context.settings.mode !== "GAME" && !context.state.situationKnown) unresolved.add("runner situation");
    }
    // Consume foul-line spray phrases before "down" and base names become pitch/fielder data.
    remaining = remaining.replace(/\bdown (?:the )?(first|third) base\s*line\b/g,
      (_, base: string) => base === "first" ? "right field line" : "left field line");
    const sequence = matchVoiceVocabulary(remaining, fielders);
    if (/\bcuts? it off\b/.test(remaining)) {
      unresolved.add('Cutoff action has no separate canonical metric; review the fielding sequence and batter result.');
      remaining = remaining.replace(/\bcuts? it off\b/g, value => ' '.repeat(value.length));
    }
    const narratedThrow = /\b(?:threw|throws?|throw)\s+to\b/.test(remaining) || /\b(?:pitcher|shortstop|baseman) to (?:the )?(?:first|second|third|catcher)\b/.test(remaining);
    if(narratedThrow && sequence.length>1) {
      draft.fieldingSequence=sequence.map(m=>m.value).filter((value,index,all)=>index===0||all[index-1]!==value);
      const receivingError=/\b(?:drops? the tag|made an error fielding it(?: on the tag)?|fielding error|made an error on the play)\b/.exec(remaining);
      if(receivingError){
        const before=sequence.filter(m=>m.start<receivingError.index);
        draft.position=before.at(-1)?.value;
        draft.defenseResult="Error";draft.errorType=receivingError[0]==='made an error on the play'?undefined:"Fielding";
        remaining=remaining.replace(receivingError[0]," ".repeat(receivingError[0].length));
      }else {
        const throwingError = /\bthrowing error\b/.exec(remaining);
        draft.position = throwingError ? sequence.filter(m=>m.start<throwingError.index).at(-1)?.value ?? sequence[0].value : sequence[0].value;
      }
      for(const m of [...sequence].reverse()) remaining=remaining.slice(0,m.start)+" ".repeat(m.end-m.start)+remaining.slice(m.end);
    }
    remaining = remaining.replace(/\b(ground ball|line drive|fly ball|pop fly|bunt)(?: to)? (left|right)\b(?! (?:center|field))/g, '$1 to $2 field');
    const hitArea=remaining.match(/\b(?:ball (?:was )?hit|single|double)(?: to)? (left|right)\b(?! (?:center|field))/);
    if(hitArea){
      draft.spray=sprayPointForLane(hitArea[1]==="left"?0:4);
      remaining=remaining.replace(hitArea[0],hitArea[0].startsWith("single")?"single":hitArea[0].startsWith("double")?"double":"ball in play");
    }
    const job = remaining.match(/\bjob (not done|done)\b/);
    if (job) {
      remaining = remaining.replace(job[0], " ");
      if ((context.settings.mode !== "GAME" && !context.state.situationKnown) || !context.state.job)
        unresolved.add("job");
      else draft.jobSuccess = job[1] === "done";
    }
    draft.pitchType = take("pitch type", VOICE_PITCH_ALIASES) ?? draft.pitchType;
    if (/fielding error/.test(remaining)) draft.errorType = "Fielding";
    if (/throwing error/.test(remaining)) draft.errorType = "Throwing";
    draft.defenseResult = take("defense result", defenseResults) ?? draft.defenseResult;
    draft.throwResult = take("throw result", throwResults);
    draft.result = take("batter result", batterResults);
    draft.contactQuality = take("contact quality", VOICE_QUALITY);
    draft.battedBall = take("batted ball", VOICE_CONTACT_ALIASES);
    if (draft.result === 'Sac Bunt') draft.battedBall ??= 'Bunt';
    if (draft.result === 'Sac Fly') draft.battedBall ??= 'Fly ball';
    if (narratedThrow && draft.position && (draft.result === 'Out' || draft.result === 'Sac Bunt' || Object.values(draft.runnerOutcomes ?? {}).includes('out'))) draft.defenseResult ??= 'Clean';
    draft.position = take("fielder", fielders) ?? draft.position;
    const lane = take("spray", sprayLanes);
    if (lane !== undefined) draft.spray = sprayPointForLane(Number(lane));
    const location = take("pitch location", locations);
    if (location) {
      draft.location = voiceLocationPoint(location, context.roster.find(p=>p.id===playerId)?.bats ?? context.bats);
      if (!draft.location) unresolved.add("batter handedness");
    }
    draft.outcome = take("pitch result", results) ?? "";
    if (draft.battedBall || draft.result) {
      if (draft.outcome && draft.outcome !== "Ball in play")
        unresolved.add("pitch result");
      draft.outcome = "Ball in play";
    }
    if (draft.battedBall && draft.position && /\bcaught\b/.test(remaining)) {
      if (draft.result && draft.result !== 'Out') unresolved.add('batter result');
      else draft.result = 'Out';
      draft.defenseResult ??= 'Clean';
      remaining = remaining.replace(/\bcaught\b/g, ' ');
    }
    const evMatches = [
      ...remaining.matchAll(
        /\b(\d{2,3})\s*(?:(?:mph|miles? (?:per|an?) hour)\s*)?(?:exit velo(?:city)?|ev|exit|off the bat)\b|\b(?:exit velo(?:city)?|ev|came off at|hit it)\s*(\d{2,3})\b/g,
      ),
    ];
    if (evMatches.length > 1) unresolved.add("exit velocity");
    if (evMatches.length === 1)
      draft.ev = Number(evMatches[0][1] ?? evMatches[0][2]);
    for (const m of evMatches) remaining = remaining.replace(m[0], " ");
    const velocities = [...remaining.matchAll(/\b\d{2,3}\b/g)];
    if (velocities.length > 1) unresolved.add("Pitch velocity unclear: multiple numbers were spoken.");
    if (velocities.length === 1) draft.velocity = Number(velocities[0][0]);
    for (const m of velocities) remaining = remaining.replace(m[0], " ");
    if (
      draft.velocity !== undefined &&
      (draft.velocity < 25 || draft.velocity > 110)
    )
      unresolved.add("Pitch velocity unclear: expected 25 to 110 mph.");
    if (draft.ev !== undefined && (draft.ev < 20 || draft.ev > 130))
      unresolved.add("exit velocity");
    if (!draft.pitchType && context.settings.pitchMode === "ONE") {
      draft.pitchType = context.settings.pitchType;
    }
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
      (context.settings.mode === "GAME" || context.state.situationKnown) &&
      Object.keys(draft.runnerOutcomes??{}).length > 0 &&
      !draft.result
    )
      unresolved.add("batter result");
  }
  remaining = remaining
    .replace(
      /\b(?:miles? (?:per|an?) hour|and|to|at|mph|a|the|was|now|then|threw|throws|throw|pitch|velo|velocity|on the tag)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
  if (/^(?:he|she) made an?$/.test(remaining) && draft.result === "Reached on Error") {
    unresolved.add("Identify the fielder who made the error and confirm the batter result.");
    remaining = "";
  } else if (/^runner advanced$/.test(remaining)) {
    unresolved.delete("pitch result");
    unresolved.add("Specify which runner advanced and the destination base.");
    remaining = "";
  } else if (remaining === "it like or" && unresolved.has("Pitch velocity unclear: multiple numbers were spoken.")) {
    remaining = "";
  }
  if (remaining) unresolved.add(`Couldn't interpret "${remaining.slice(0,150)}".`);
  let inferredRunnerChanges: string[] = [];
  if (context.domain === "live-bp" && !correction && !unresolved.size) {
    try {
      const built = buildBpPitch(context.settings, context.state, draft);
      inferredRunnerChanges = Object.entries(built.context.inferredRunnerOutcomes ?? {}).map(([from,to]) => `${from}B to ${to === "score" ? "home" : `${to}B`} (Practice default)`);
    } catch (e) {
      unresolved.add(e instanceof Error ? e.message : "event");
    }
  }
  const unresolvedFields = [...unresolved];
  const ignoredFields: string[] = [];
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
    inferredRunnerChanges,
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
    "inferredRunnerChanges",
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
  if (i.inferredRunnerChanges !== undefined && (!Array.isArray(i.inferredRunnerChanges) || i.inferredRunnerChanges.length > 3 || i.inferredRunnerChanges.some(v=>!text(v,100)))) throw new Error("Invalid runner inference.");
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
    "contactQuality",
    "result",
    "position",
    "defenderId",
    "defenseResult",
    "errorType",
    "throwResult",
    "runnerOutcomes",
    "runnerMovements",
    "runnerReasons",
    "fieldingSequence",
    "jobSuccess",
  ]);
  const enums: Record<string, readonly string[]> = {
    outcome: ["", ...Object.values(results)],
    pitchType: Object.values(VOICE_PITCH_ALIASES),
    battedBall: Object.values(VOICE_CONTACT_ALIASES),
    contactQuality: Object.values(VOICE_QUALITY),
    result: Object.values(batterResults),
    position: BP_POSITIONS,
    defenseResult: Object.values(defenseResults),
    errorType: ["Fielding", "Throwing", "Decision"],
    throwResult: Object.values(throwResults),
  };
  if(d.defenderId!==undefined&&!text(d.defenderId,100))throw new Error('Invalid Voice defender.');
  if(d.fieldingSequence !== undefined && (!Array.isArray(d.fieldingSequence)||d.fieldingSequence.length>20||d.fieldingSequence.some(p=>!BP_POSITIONS.includes(p))))throw new Error("Invalid Voice fielding sequence.");
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
  if (d.runnerReasons !== undefined) {
    const reasons = object(d.runnerReasons, ['1','2','3']);
    if (Object.values(reasons).some(v=>v!=='On throwing error' && v!=='Other' && v!=='Tag up')) throw new Error('Invalid Voice runner reason.');
  }
  if (d.runnerMovements !== undefined) {
    if (!Array.isArray(d.runnerMovements) || d.runnerMovements.length > 12) throw new Error('Invalid Voice runner movements.');
    for (const step of d.runnerMovements) {
      const move=object(step,['runnerBase','from','to']);
      if (![1,2,3].includes(Number(move.runnerBase)) || typeof move.runnerBase !== 'number' || !['1','2','3'].includes(String(move.from)) || !['1','2','3','score','out'].includes(String(move.to))) throw new Error('Invalid Voice runner movement.');
    }
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
  const text=correctedVoiceText(intent.transcript);
  const simplePitch=!intent.draft.battedBall&&!intent.draft.result&&!intent.draft.position&&!intent.draft.runnerOutcomes
    &&['Whiff','Foul','Ball','Called Strike'].includes(intent.draft.outcome)
    &&text.split(' ').length<=14&&!/\b(?:or|not|maybe|actually|no|sorry)\b/.test(text);
  // Complete deterministic short commands may rely on authoritative identities/program.
  // Numbers need stronger acoustic evidence than a lone result; rich narration retains the strict gate.
  const simpleContact=!!intent.draft.battedBall && !intent.draft.position && !intent.draft.runnerOutcomes
    && text.split(' ').length<=18 && !/\b(?:or|not|maybe|actually|no|sorry)\b/.test(text);
  const simpleDefense=!!intent.draft.battedBall && !!intent.draft.position && !!intent.draft.defenseResult
    && !intent.draft.runnerOutcomes && !intent.draft.runnerMovements?.length && (intent.draft.fieldingSequence?.length??0)<=1
    && text.split(' ').length<=24 && !/\b(?:or|not|maybe|actually|no|sorry)\b/.test(text);
  const threshold=simplePitch?(intent.draft.velocity!==undefined?0.85:0.8):simpleContact||simpleDefense?0.9:0.97;
  return (
    !intent.correction &&
    intent.ignoredFields.length === 0 &&
    intent.unresolvedFields.length === 0 &&
    intent.confidence.transcription !== null &&
    intent.confidence.transcription >= threshold &&
    intent.confidence.interpretation === 1 &&
    intent.confidence.identity === 1 &&
    intent.confidence.critical === 1
  );
}

import type { AppData, HittingEvent, ID, PitchEvent, PitchType } from "../../types.ts";
import type { AnalyticsSource } from "../analyticsQuery.ts";
import { findTrustedKnowledge, type BaseballKnowledgeItem, type BaseballKnowledgeProvider, EMPTY_BASEBALL_KNOWLEDGE_PROVIDER } from "./knowledge.ts";

export type DiagnosisConfidence = "low" | "moderate" | "high";
export type DiagnosisStatus = "insufficient" | "limited" | "qualified";
export type HittingDiagnosisSignal = "recognition_decision" | "in_zone_contact" | "contact_quality" | "taking_strikes" | "location_specific" | "no_single_signal";
export type PitchingDiagnosisSignal = "strike_command" | "arm_side_miss" | "velocity_consistency" | "location_quality" | "no_single_signal";

export interface DevelopmentDiagnosisRequest {
  domain: "hitting" | "pitching";
  playerId: ID;
  source: AnalyticsSource;
  pitchType?: PitchType;
}

export interface DevelopmentDiagnosisResult {
  domain: "hitting" | "pitching";
  playerId: ID;
  playerName: string;
  pitchType?: PitchType;
  status: DiagnosisStatus;
  confidence: DiagnosisConfidence;
  signal: HittingDiagnosisSignal | PitchingDiagnosisSignal;
  trackedEvents: number;
  whatISee: string;
  dataPoints: string[];
  focus: string;
  practiceIdea: string;
  watchNext: string;
  knowledgeItems: BaseballKnowledgeItem[];
  evidence: Array<{ id: string; title: string; summary: string }>;
}

const DIAGNOSIS_MINIMUM_SAMPLE = 8;
const DIAGNOSIS_QUALIFIED_SAMPLE = 12;

export function diagnosePlayerDevelopment(
  data: AppData,
  request: DevelopmentDiagnosisRequest,
  knowledgeProvider: BaseballKnowledgeProvider = EMPTY_BASEBALL_KNOWLEDGE_PROVIDER,
): DevelopmentDiagnosisResult {
  const player = data.players.find((item) => item.id === request.playerId);
  const playerName = player?.name ?? "This player";
  if (request.domain === "pitching") {
    return diagnosePitching(data, request, playerName, knowledgeProvider);
  }
  return diagnoseHitting(data, request, playerName, knowledgeProvider);
}

function diagnoseHitting(
  data: AppData,
  request: DevelopmentDiagnosisRequest,
  playerName: string,
  knowledgeProvider: BaseballKnowledgeProvider,
): DevelopmentDiagnosisResult {
  const sourceEvents = data.hittingEvents.filter((event) => event.hitterId === request.playerId && isSourceEvent(data, event, request.source));
  const events = request.pitchType ? sourceEvents.filter((event) => event.pitchType === request.pitchType) : sourceEvents;
  const trackedEvents = events.length;
  const knowledgeItems = findTrustedKnowledge(knowledgeProvider, {
    query: `${request.pitchType ?? "hitting"} recognition decision timing contact quality approach practice`,
    category: "Hitting",
    limit: 2,
  });
  const evidence = diagnosisEvidence(playerName, request, trackedEvents, knowledgeItems);
  const confidence = confidenceFor(trackedEvents);
  if (trackedEvents < DIAGNOSIS_MINIMUM_SAMPLE) {
    return {
      domain: "hitting",
      playerId: request.playerId,
      playerName,
      pitchType: request.pitchType,
      status: "insufficient",
      confidence: "low",
      signal: "no_single_signal",
      trackedEvents,
      whatISee: `We only have ${trackedEvents} tracked ${request.pitchType?.toLowerCase() ?? "hitting"} reps for ${playerName}, so I would not call this a real weakness yet.`,
      dataPoints: [`${trackedEvents} tracked ${request.pitchType?.toLowerCase() ?? "hitting"} reps`],
      focus: "Collect a larger, consistently tagged sample before making a strong diagnosis.",
      practiceIdea: knowledgeItems.length ? "Keep the next round focused on the same pitch type and record location plus outcome." : "Track pitch type, location, action, and contact result in the next round.",
      watchNext: `Track the next 20–30 ${request.pitchType?.toLowerCase() ?? "pitches"} and look for a repeatable signal.`,
      knowledgeItems,
      evidence,
    };
  }

  const swings = events.filter((event) => event.action !== "Took pitch");
  const contacts = swings.filter((event) => event.action === "Foul" || event.action === "Ball in play");
  const located = events.filter((event) => event.pitchLocation);
  const zonePitches = located.filter((event) => isZone(event.pitchLocation));
  const zoneSwings = zonePitches.filter((event) => event.action !== "Took pitch");
  const zoneContacts = zoneSwings.filter((event) => event.action === "Foul" || event.action === "Ball in play");
  const outOfZonePitches = located.filter((event) => !isZone(event.pitchLocation));
  const outOfZoneSwings = outOfZonePitches.filter((event) => event.action !== "Took pitch");
  const inZoneTakeRate = rate(zonePitches.filter((event) => event.action === "Took pitch").length, zonePitches.length);
  const chaseRate = rate(outOfZoneSwings.length, outOfZonePitches.length);
  const inZoneContactRate = rate(zoneContacts.length, zoneSwings.length);
  const contactRate = rate(contacts.length, swings.length);
  const bip = events.filter((event) => event.action === "Ball in play");
  const hardRate = rate(bip.filter((event) => event.contactQuality === "Hard" || event.contactQuality === "Barrel").length, bip.length);
  const groundRate = rate(bip.filter((event) => event.contactResult === "Ground ball").length, bip.length);
  const pullRate = rate(bip.filter((event) => event.direction === "Pull" || event.direction === "Pull-center").length, bip.length);
  const downAway = events.filter((event) => event.pitchLocation && locationRegion(event.pitchLocation, data.players.find((item) => item.id === request.playerId)?.bats) === "down_and_away");
  const downAwayContactRate = rate(downAway.filter((event) => event.action === "Foul" || event.action === "Ball in play").length, downAway.filter((event) => event.action !== "Took pitch").length);
  const avgEv = average(events.map((event) => event.exitVelocityMph).filter(isNumber));

  let signal: HittingDiagnosisSignal = "no_single_signal";
  let whatISee = `${playerName}'s tracked ${request.pitchType?.toLowerCase() ?? "hitting"} sample does not show one dominant weakness yet.`;
  let focus = "Keep the same tracking fields consistent and compare the next sample to this baseline.";
  let practiceIdea = knowledgeItems.length ? "Use a constrained round that keeps the pitch type and decision target consistent." : "Track the same pitch type, location, action, and contact result in the next round.";
  if (chaseRate !== undefined && inZoneContactRate !== undefined && chaseRate >= 35 && inZoneContactRate >= 70) {
    signal = "recognition_decision";
    whatISee = `${playerName} is making enough contact when ${request.pitchType?.toLowerCase() ?? "these pitches"} are in the zone, but is chasing too many below the zone.`;
    focus = "Recognition and take decisions, especially on pitches below the zone.";
    practiceIdea = knowledgeItems.length ? "Use a recognition round where anything below the bottom third is an automatic take." : practiceIdea;
  } else if (inZoneContactRate !== undefined && inZoneContactRate < 65 && zoneSwings.length >= DIAGNOSIS_MINIMUM_SAMPLE) {
    signal = "in_zone_contact";
    whatISee = `${playerName}'s bigger issue looks like making contact with ${request.pitchType?.toLowerCase() ?? "pitches"} that are already in the zone, not chasing.`;
    focus = "Seeing the pitch earlier, timing, and barrel accuracy against strikes.";
    practiceIdea = knowledgeItems.length ? "Use a strike-only round with an early tracking cue and a goal of staying through the ball." : practiceIdea;
  } else if (hardRate !== undefined && groundRate !== undefined && pullRate !== undefined && hardRate < 35 && groundRate >= 50 && pullRate >= 50) {
    signal = "contact_quality";
    whatISee = `${playerName} is getting the bat to ${request.pitchType?.toLowerCase() ?? "the ball"}, but contact quality is light and ground-ball heavy.`;
    focus = "Contact quality, timing, and direction rather than simply swinging harder.";
    practiceIdea = knowledgeItems.length ? "Use a quality-contact round with a line-drive or middle/opposite-field constraint." : practiceIdea;
  } else if (inZoneTakeRate !== undefined && inZoneTakeRate >= 40 && zonePitches.length >= DIAGNOSIS_MINIMUM_SAMPLE) {
    signal = "taking_strikes";
    whatISee = `${playerName} is taking a high share of tracked in-zone ${request.pitchType?.toLowerCase() ?? "pitches"}, which can create avoidable strikes.`;
    focus = "Decision timing and being ready to attack hittable strikes early in the count.";
  } else if (downAwayContactRate !== undefined && contactRate !== undefined && downAway.length >= DIAGNOSIS_MINIMUM_SAMPLE && downAwayContactRate < contactRate - 15) {
    signal = "location_specific";
    whatISee = `${playerName}'s contact drops on down-and-away ${request.pitchType?.toLowerCase() ?? "pitches"} compared with the overall tracked sample.`;
    focus = "Location-specific recognition and contact quality down and away.";
  }

  const dataPoints = [
    `${trackedEvents} tracked ${request.pitchType?.toLowerCase() ?? "hitting"} reps`,
    contactRate === undefined ? "Overall Contact % unavailable" : `${Math.round(contactRate)}% overall Contact`,
    inZoneContactRate === undefined ? "In-zone Contact unavailable" : `${Math.round(inZoneContactRate)}% in-zone Contact`,
    chaseRate === undefined ? "Chase rate unavailable" : `${Math.round(chaseRate)}% chase on tracked out-of-zone pitches`,
    hardRate === undefined ? "Hard Contact unavailable" : `${Math.round(hardRate)}% Hard Contact`,
    avgEv === undefined ? "Avg EV unavailable" : `${avgEv.toFixed(1)} Avg EV`,
  ].slice(0, 6);
  return {
    domain: "hitting",
    playerId: request.playerId,
    playerName,
    pitchType: request.pitchType,
    status: trackedEvents >= DIAGNOSIS_QUALIFIED_SAMPLE ? "qualified" : "limited",
    confidence,
    signal,
    trackedEvents,
    whatISee,
    dataPoints,
    focus,
    practiceIdea,
    watchNext: `Track the next 20–30 ${request.pitchType?.toLowerCase() ?? "pitches"} and see whether the target signal improves without losing in-zone Contact.`,
    knowledgeItems,
    evidence,
  };
}

function diagnosePitching(
  data: AppData,
  request: DevelopmentDiagnosisRequest,
  playerName: string,
  knowledgeProvider: BaseballKnowledgeProvider,
): DevelopmentDiagnosisResult {
  const sourceEvents = data.pitchEvents.filter((event) => event.pitcherId === request.playerId && isPitchSourceEvent(data, event, request.source));
  const events = request.pitchType ? sourceEvents.filter((event) => event.pitchType === request.pitchType) : sourceEvents;
  const trackedEvents = events.length;
  const knowledgeItems = findTrustedKnowledge(knowledgeProvider, {
    query: `${request.pitchType ?? "pitching"} command control location strike throwing velocity`,
    category: "Pitching",
    limit: 2,
  });
  const evidence = diagnosisEvidence(playerName, request, trackedEvents, knowledgeItems);
  if (trackedEvents < 18) {
    return {
      domain: "pitching",
      playerId: request.playerId,
      playerName,
      pitchType: request.pitchType,
      status: "insufficient",
      confidence: "low",
      signal: "no_single_signal",
      trackedEvents,
      whatISee: `We only have ${trackedEvents} tracked ${request.pitchType?.toLowerCase() ?? "pitching"} pitches for ${playerName}, so I would not call this a real weakness yet.`,
      dataPoints: [`${trackedEvents} tracked ${request.pitchType?.toLowerCase() ?? "pitching"} pitches`],
      focus: "Collect a larger sample with pitch type, location, outcome, and velocity recorded.",
      practiceIdea: "Repeat the same pitch in a bounded bullpen segment and keep the target and result fields consistent.",
      watchNext: `Track the next 20–30 ${request.pitchType?.toLowerCase() ?? "pitches"} before changing the plan.`,
      knowledgeItems,
      evidence,
    };
  }
  const strikeRate = rate(events.filter((event) => event.isStrike).length, events.length) ?? 0;
  const velocities = events.map((event) => event.velocity).filter(isNumber);
  const misses = events.filter((event) => event.missedIntendedLocation && event.location && event.intendedTarget);
  const armSideMisses = misses.filter((event) => (event.location?.x ?? 0) > (event.intendedTarget?.x ?? 0)).length;
  const gloveSideMisses = misses.filter((event) => (event.location?.x ?? 0) < (event.intendedTarget?.x ?? 0)).length;
  const avgVelocity = average(velocities);
  let signal: PitchingDiagnosisSignal = "no_single_signal";
  let whatISee = `${playerName}'s tracked ${request.pitchType?.toLowerCase() ?? "pitching"} sample does not show one dominant weakness yet.`;
  let focus = "Keep the same tracking fields consistent and compare the next session to this baseline.";
  if (strikeRate < 60) {
    signal = "strike_command";
    whatISee = `${playerName}'s main issue looks like strike command: only ${Math.round(strikeRate)}% of tracked ${request.pitchType?.toLowerCase() ?? "pitches"} were strikes.`;
    focus = "Location consistency and finishing the pitch in the intended target window.";
  } else if (misses.length >= 4 && armSideMisses > gloveSideMisses) {
    signal = "arm_side_miss";
    whatISee = `${playerName} is finding strikes often enough, but the tracked misses lean arm-side.`;
    focus = "Repeatable arm-side location and a consistent finish, without assuming a mechanical cause.";
  } else if (velocities.length >= 6 && avgVelocity !== undefined && Math.max(...velocities) - Math.min(...velocities) >= 8) {
    signal = "velocity_consistency";
    whatISee = `${playerName}'s ${request.pitchType?.toLowerCase() ?? "pitch"} velocity has a wide tracked spread in this sample.`;
    focus = "Repeatable intent and velocity while keeping the pitch in its intended location.";
  }
  const dataPoints = [
    `${trackedEvents} tracked ${request.pitchType?.toLowerCase() ?? "pitching"} pitches`,
    `${Math.round(strikeRate)}% Strike`,
    misses.length ? `${armSideMisses} arm-side / ${gloveSideMisses} glove-side target misses` : "Target-miss direction unavailable",
    avgVelocity === undefined ? "Velocity unavailable" : `${avgVelocity.toFixed(1)} average velocity`,
  ];
  return {
    domain: "pitching",
    playerId: request.playerId,
    playerName,
    pitchType: request.pitchType,
    status: trackedEvents >= 36 ? "qualified" : "limited",
    confidence: confidenceFor(trackedEvents),
    signal,
    trackedEvents,
    whatISee,
    dataPoints,
    focus,
    practiceIdea: knowledgeItems.length ? "Use a short, target-specific bullpen block and record strike, location, and miss direction on every pitch." : "Track the same pitch, target, outcome, and velocity fields in the next bullpen.",
    watchNext: `Track the next 20–30 ${request.pitchType?.toLowerCase() ?? "pitches"} and compare strike rate, miss direction, and velocity spread.`,
    knowledgeItems,
    evidence,
  };
}

function diagnosisEvidence(playerName: string, request: DevelopmentDiagnosisRequest, trackedEvents: number, knowledgeItems: BaseballKnowledgeItem[]) {
  return [
    { id: `diagnosis:${request.domain}:${request.playerId}`, title: "Player development diagnosis", summary: `${playerName} · ${request.pitchType ?? "all tracked events"} · ${trackedEvents} events · ${request.source}` },
    ...knowledgeItems.slice(0, 2).map((item) => ({ id: item.id, title: `Baseball Knowledge · ${item.title}`, summary: [item.source, item.version, item.status].filter(Boolean).join(" · ") })),
  ];
}

function confidenceFor(sample: number): DiagnosisConfidence {
  if (sample < DIAGNOSIS_MINIMUM_SAMPLE) return "low";
  if (sample < 24) return "moderate";
  return "high";
}

function isSourceEvent(data: AppData, event: HittingEvent, source: AnalyticsSource): boolean {
  if (source === "games") return false;
  const session = data.hittingSessions.find((item) => item.id === event.sessionId);
  const live = Boolean(event.isLiveBp || session?.type === "Live BP");
  if (source === "practice") return !live;
  if (source === "live-bp") return live;
  return true;
}

function isPitchSourceEvent(data: AppData, event: PitchEvent, source: AnalyticsSource): boolean {
  if (source === "games") return false;
  const session = data.pitchingSessions.find((item) => item.id === event.sessionId);
  const live = session?.type === "Live BP";
  if (source === "practice") return !live;
  if (source === "live-bp") return live;
  return true;
}

function isZone(point?: { x: number; y: number }): boolean {
  return Boolean(point && point.x >= 0.22 && point.x <= 0.78 && point.y >= 0.18 && point.y <= 0.82);
}

function locationRegion(point: { x: number; y: number }, bats?: "R" | "L" | "S") {
  const vertical = point.y > 0.66 ? "down" : point.y < 0.34 ? "up" : "middle";
  const horizontal = bats === "L"
    ? point.x > 0.66 ? "in" : point.x < 0.34 ? "away" : "middle"
    : point.x < 0.34 ? "in" : point.x > 0.66 ? "away" : "middle";
  return `${vertical}_and_${horizontal}`;
}

function rate(numerator: number, denominator: number): number | undefined {
  return denominator ? (numerator / denominator) * 100 : undefined;
}

function average(values: number[]): number | undefined {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
}

function isNumber(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

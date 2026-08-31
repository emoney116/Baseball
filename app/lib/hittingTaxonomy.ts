import type {
  BattedBallType,
  HittingContactQuality,
  HittingEvent,
  HittingPitchTrackingMode,
  HittingSession,
  PitchType,
} from "../types";

export type PracticeHittingResultOption = {
  id: string;
  label: string;
  action: HittingEvent["action"];
  contactResult?: BattedBallType;
  contactQuality?: HittingContactQuality;
};

export const PRACTICE_HITTING_RESULT_OPTIONS: PracticeHittingResultOption[] = [
  { id: "miss", label: "Miss", action: "Miss" },
  { id: "foul", label: "Foul", action: "Foul" },
  { id: "ground-ball", label: "Ground Ball", action: "Ball in play", contactResult: "Ground ball", contactQuality: "Weak" },
  { id: "hard-ground-ball", label: "Hard Ground Ball", action: "Ball in play", contactResult: "Ground ball", contactQuality: "Hard" },
  { id: "line-drive", label: "Line Drive", action: "Ball in play", contactResult: "Line drive", contactQuality: "Hard" },
  { id: "fly-ball", label: "Fly Ball", action: "Ball in play", contactResult: "Fly ball", contactQuality: "Solid" },
  { id: "hard-fly-ball", label: "Hard Fly Ball", action: "Ball in play", contactResult: "Fly ball", contactQuality: "Hard" },
  { id: "pop-up", label: "Pop Up", action: "Ball in play", contactResult: "Pop up", contactQuality: "Weak" },
];

export function isPracticeHittingPitchTypeAvailable(station: HittingSession["type"]) {
  return station === "Machine" || station === "Coach BP" || station === "Hack Attack - FB" || station === "Hack Attack - CB";
}

export function defaultPracticeHittingPitchMode(station: HittingSession["type"]): HittingPitchTrackingMode {
  return isPracticeHittingPitchTypeAvailable(station) ? "ONE" : "OFF";
}

export function resolvePracticeHittingPitchMode(
  station: HittingSession["type"],
  session?: Pick<HittingSession, "pitchTrackingMode">,
  fallback?: HittingPitchTrackingMode,
): HittingPitchTrackingMode {
  if (!isPracticeHittingPitchTypeAvailable(station)) return "OFF";
  return session?.pitchTrackingMode ?? fallback ?? defaultPracticeHittingPitchMode(station);
}

export function resolvePracticeHittingPitchType(
  session?: Pick<HittingSession, "defaultPitchType" | "machinePitchType">,
  fallback?: PitchType,
): PitchType | undefined {
  return session?.defaultPitchType ?? session?.machinePitchType ?? fallback;
}

export function pitchModeLabel(mode: HittingPitchTrackingMode) {
  if (mode === "ONE") return "One Pitch";
  if (mode === "MULTI") return "Multi-Pitch";
  return "Off";
}

export function isPracticeHardContactEvent(event: Pick<HittingEvent, "action" | "contactQuality">) {
  return event.action === "Ball in play" && (event.contactQuality === "Hard" || event.contactQuality === "Barrel");
}

export function practiceHittingResultLabel(
  event: Pick<HittingEvent, "action" | "contactResult" | "contactQuality">,
) {
  if (event.action === "Miss" || event.action === "Foul" || event.action === "Took pitch" || event.action === "Swing") return event.action;
  const option = PRACTICE_HITTING_RESULT_OPTIONS.find((item) => (
    item.action === event.action
    && item.contactResult === event.contactResult
    && item.contactQuality === event.contactQuality
  ));
  if (option) return option.label;
  if (event.contactResult === "Ground ball") return isPracticeHardContactEvent(event) ? "Hard Ground Ball" : "Ground Ball";
  if (event.contactResult === "Line drive") return "Line Drive";
  if (event.contactResult === "Fly ball") return isPracticeHardContactEvent(event) ? "Hard Fly Ball" : "Fly Ball";
  if (event.contactResult === "Pop up") return "Pop Up";
  return "Ball in play";
}

import {
  validateBpState,
  withBpRunners,
  type BpSettings,
  type BpState,
} from "./liveBp.ts";

export const BP_RUNNER_REASONS = [
  "Stolen base",
  "Wild pitch",
  "Passed ball",
  "Defensive indifference",
  "On throw",
  "On error",
  "Tag up",
  "Other",
] as const;
export type BpRunnerMove = {
  from: number;
  to: number;
  reason: (typeof BP_RUNNER_REASONS)[number];
};
export function buildBpRunnerMove(
  settings: BpSettings,
  state: BpState,
  move: BpRunnerMove,
) {
  validateBpState(state);
  if (
    settings.mode !== "GAME" ||
    !move ||
    !state.runners.includes(move.from) ||
    !Number.isInteger(move.to) ||
    move.to <= move.from ||
    move.to > 4 ||
    state.runners.includes(move.to) ||
    !BP_RUNNER_REASONS.includes(move.reason)
  )
    throw new Error(
      "Choose an occupied base, an empty destination, and a movement reason.",
    );
  const next = withBpRunners(
    state,
    state.runners.filter((b) => b !== move.from),
  );
  if (move.to < 4) {
    next.runners = [...next.runners, move.to].sort();
    if (state.runnerIds?.[move.from])
      next.runnerIds = {
        ...next.runnerIds,
        [move.to]: state.runnerIds[move.from],
      };
  }
  return {
    stateBefore: state,
    stateAfter: next,
    movement: {
      ...move,
      runnerId: state.runnerIds?.[move.from] ?? null,
      pitcherId: settings.source === "PLAYER" ? settings.pitcherId : null,
      source: settings.source,
      coachName: settings.coachName ?? null,
    },
  };
}

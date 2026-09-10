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
  "Pickoff attempt",
  "Picked off",
  "Caught stealing",
  "Pinch runner",
] as const;
export type BpRunnerMove = {
  from: number;
  to: number;
  reason: (typeof BP_RUNNER_REASONS)[number];
  outcome?: "safe" | "out";
  replacementRunnerId?: string;
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
    move.to < move.from ||
    move.to > 4 ||
    (move.to !== move.from && state.runners.includes(move.to)) ||
    (move.outcome !== undefined && !["safe", "out"].includes(move.outcome)) ||
    (move.replacementRunnerId !== undefined &&
      (!/^[0-9a-f-]{36}$/i.test(move.replacementRunnerId) ||
        move.reason !== "Pinch runner" ||
        move.to !== move.from ||
        move.outcome === "out" ||
        Object.entries(state.runnerIds ?? {}).some(
          ([base, id]) =>
            Number(base) !== move.from && id === move.replacementRunnerId,
        ))) ||
    (move.reason === "Pinch runner" && !move.replacementRunnerId) ||
    (["Picked off", "Caught stealing"].includes(move.reason) &&
      move.outcome !== "out") ||
    !BP_RUNNER_REASONS.includes(move.reason)
  )
    throw new Error(
      "Choose an occupied base, an empty destination, and a movement reason.",
    );
  const next = withBpRunners(
    state,
    state.runners.filter((b) => b !== move.from),
  );
  if (move.outcome === "out") {
    next.outs++;
    if (next.outs >= 3) {
      next.outs = 0;
      next.runners = [];
      next.runnerIds = {};
      next.balls = 0;
      next.strikes = 0;
      next.pa++;
    }
  } else if (move.to < 4) {
    next.runners = [...next.runners, move.to].sort();
    if (move.replacementRunnerId || state.runnerIds?.[move.from])
      next.runnerIds = {
        ...next.runnerIds,
        [move.to]: move.replacementRunnerId ?? state.runnerIds?.[move.from],
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

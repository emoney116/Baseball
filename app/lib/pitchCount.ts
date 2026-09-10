import type { CountState } from "../types.ts";

// Shared pitch-count progression; callers own PA completion and runner effects.
export function advancePitchCount(
  count: CountState,
  outcome: string,
): CountState {
  return {
    balls: count.balls + (outcome === "Ball" ? 1 : 0),
    strikes:
      count.strikes +
      (["Called Strike", "Swinging Strike", "Whiff"].includes(outcome) ||
      (outcome === "Foul" && count.strikes < 2)
        ? 1
        : 0),
  };
}

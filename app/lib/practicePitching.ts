import type { PitchEvent } from "../types.ts";

const terminal = new Set(["Single", "Double", "Triple", "Home Run", "Walk", "HBP", "Strikeout", "Out", "Sac Fly", "Sac Bunt", "Reached on Error", "Fielders Choice"]);
export const PRACTICE_PITCHING_METRICS = ["inningsPitched", "whip", "battersFaced", "pitcherStrikeouts", "hitsAllowed", "homeRunsAllowed", "walksAllowed", "hitBatters", "opponentAvg", "opponentObp", "opponentSlg", "opponentOps", "opponentBabip", "strikeoutPctAllowed", "walkPctAllowed", "strikeoutMinusWalkPct", "strikeoutToWalk", "strikeoutsPerNine", "walksPerNine", "hitsPerNine", "homeRunsPerNine", "pitchesPerInning", "pitchesPerBatterFaced", "pitchesPerOut"];

export function practicePitching(events: readonly PitchEvent[]) {
  const unique = [...new Map(events.map(event => [event.id, event])).values()];
  const completed = unique.filter(event => event.liveBpContext?.thrower === "PLAYER" && terminal.has(event.liveBpContext.result));
  const count = (result: string) => completed.filter(event => event.liveBpContext!.result === result).length;
  const hits = count("Single") + count("Double") + count("Triple") + count("Home Run");
  const walks = count("Walk"), hitByPitch = count("HBP"), sacrificeFlies = count("Sac Fly");
  const atBats = completed.length - walks - hitByPitch - sacrificeFlies - count("Sac Bunt");
  const knownOuts = unique.length > 0 && unique.every(event => {
    const c = event.liveBpContext;
    return c?.thrower === "PLAYER" && (c.mode === "GAME" || c.before.situationKnown === true) && [c.before.outs, c.after.outs].every(value => Number.isInteger(value) && value >= 0 && value <= 3);
  });
  const outs = knownOuts ? unique.reduce((sum, event) => {
    const c = event.liveBpContext!;
    return sum + (c.after.outs >= c.before.outs ? c.after.outs - c.before.outs : 3 - c.before.outs + c.after.outs);
  }, 0) : undefined;
  return { battersFaced: completed.length, hits, walks, hitByPitch, sacrificeFlies, atBats,
    outs,
    strikeouts: count("Strikeout"), homeRuns: count("Home Run"),
    totalBases: count("Single") + 2 * count("Double") + 3 * count("Triple") + 4 * count("Home Run") };
}

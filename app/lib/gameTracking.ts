import type {
  Game,
  GameBallInPlayOutcome,
  GameBase,
  GamePitchOutcome,
  GameRunnerAction,
  GameRunnerMovement,
  GameScoredPlay,
  GameStateSnapshot,
  ID,
} from "../types";

const OUTCOMES_THAT_END_PA = new Set<GameBallInPlayOutcome>([
  "Single",
  "Double",
  "Triple",
  "Home Run",
  "Ground Out",
  "Fly Out",
  "Line Out",
  "Pop Out",
  "Error",
  "Fielder's Choice",
  "Sac Fly",
  "Sac Bunt",
  "Double Play",
]);

export function snapshotGame(game: Game): GameStateSnapshot {
  return {
    inning: game.inning,
    half: game.half,
    outs: game.outs,
    balls: game.balls,
    strikes: game.strikes,
    runners: { ...game.runners },
    metrolinaScore: game.metrolinaScore,
    opponentScore: game.opponentScore,
    currentBatterId: game.currentBatterId,
  };
}

export function restoreGameSnapshot(game: Game, snapshot: GameStateSnapshot): Game {
  return { ...game, ...snapshot, runners: { ...snapshot.runners }, updatedAt: new Date().toISOString() };
}

export function isMetrolinaBatting(game: Game) {
  if (game.homeAway === "Away") return game.half === "Top";
  if (game.homeAway === "Home") return game.half === "Bottom";
  return game.half === "Bottom";
}

export function applyTrackedPitch(game: Game, outcome: GamePitchOutcome, ballInPlayOutcome?: GameBallInPlayOutcome): Game {
  let next: Game = { ...game, runners: { ...game.runners } };
  let balls = game.balls;
  let strikes = game.strikes;

  if (outcome === "Ball") balls += 1;
  if (outcome === "Called Strike" || outcome === "Swinging Strike") strikes += 1;
  if (outcome === "Foul" && strikes < 2) strikes += 1;

  if (outcome === "HBP") return finishPlateAppearance(forceRunnerToFirst(next));
  if (balls >= 4) return finishPlateAppearance(forceRunnerToFirst({ ...next, balls }));
  if (strikes >= 3) return finishPlateAppearance({ ...next, strikes, outs: next.outs + 1 });
  if (outcome === "In Play" && ballInPlayOutcome && OUTCOMES_THAT_END_PA.has(ballInPlayOutcome)) {
    next = applyBallInPlay(next, ballInPlayOutcome);
    return finishPlateAppearance(next);
  }

  return { ...next, balls, strikes, updatedAt: new Date().toISOString() };
}

export function applyScoredPlay(game: Game, play: GameScoredPlay): Game {
  const errors = validateScoredPlay(game, play);
  if (errors.length) throw new Error(errors.join(" "));

  const next: Game = { ...game, runners: { ...game.runners } };
  let outsAdded = 0;
  let runsAdded = 0;

  for (const movement of play.movements) {
    if (movement.from !== "batter") delete next.runners[movement.from];
  }

  for (const movement of play.movements) {
    if (movement.result === "out" || movement.to === "out") {
      outsAdded += 1;
      continue;
    }
    if (movement.to === "home") {
      runsAdded += 1;
      continue;
    }
    if (movement.to === "hold") {
      if (movement.from !== "batter") next.runners[movement.from] = movement.runnerId;
      continue;
    }
    next.runners[movement.to] = movement.runnerId;
  }

  const scored = addRuns({ ...next, outs: next.outs + outsAdded }, runsAdded);
  return finishPlateAppearance(scored);
}

export function validateScoredPlay(game: Game, play: GameScoredPlay): string[] {
  const errors: string[] = [];
  const expected = new Map<GameRunnerMovement["from"], ID>();
  if (game.currentBatterId) expected.set("batter", game.currentBatterId);
  for (const base of ["first", "second", "third"] as const) {
    const runnerId = game.runners[base];
    if (runnerId) expected.set(base, runnerId);
  }

  for (const [origin, runnerId] of expected) {
    const matches = play.movements.filter((movement) => movement.from === origin && movement.runnerId === runnerId);
    if (matches.length !== 1) errors.push(`${origin === "batter" ? "Batter" : `Runner on ${origin}`} needs one outcome.`);
  }

  const occupied = play.movements
    .map((movement) => movement.to === "hold" ? movement.from : movement.to)
    .filter((destination): destination is GameBase => ["first", "second", "third"].includes(destination));
  if (new Set(occupied).size !== occupied.length) errors.push("Two runners cannot finish on the same base.");
  if (play.outcome === "Fielder's Choice" && !play.movements.some((movement) => movement.result === "out" || movement.to === "out")) {
    errors.push("A fielder's choice must record a runner out.");
  }
  if ((play.outcome === "Sac Fly" || play.outcome === "Sac Bunt") && game.outs >= 2) {
    errors.push("A sacrifice cannot be recorded with two outs.");
  }
  if (game.outs + play.movements.filter((movement) => movement.result === "out" || movement.to === "out").length > 3) {
    errors.push("The play records more than three outs in the half inning.");
  }
  return errors;
}

export function suggestedPlayMovements(game: Game, outcome: GameBallInPlayOutcome): GameRunnerMovement[] {
  const movements: GameRunnerMovement[] = [];
  const addRunner = (runnerId: ID | undefined, from: GameRunnerMovement["from"], to: GameRunnerMovement["to"], reason: GameRunnerMovement["reason"] = "On hit") => {
    if (!runnerId) return;
    movements.push({ runnerId, from, to, result: to === "out" ? "out" : to === "hold" ? "held" : "safe", reason });
  };

  const bases = game.runners;
  if (outcome === "Home Run") {
    addRunner(bases.third, "third", "home");
    addRunner(bases.second, "second", "home");
    addRunner(bases.first, "first", "home");
    addRunner(game.currentBatterId, "batter", "home", "Batter result");
    return movements;
  }

  if (outcome === "Fielder's Choice") {
    const forcedOut = bases.first
      ? (bases.second ? (bases.third ? "third" : "second") : "first")
      : undefined;
    addRunner(bases.third, "third", forcedOut === "third" ? "out" : "hold", forcedOut === "third" ? "Fielder's choice" : "Other");
    addRunner(bases.second, "second", forcedOut === "second" ? "out" : "hold", forcedOut === "second" ? "Fielder's choice" : "Other");
    addRunner(bases.first, "first", forcedOut === "first" ? "out" : "hold", forcedOut === "first" ? "Fielder's choice" : "Other");
    addRunner(game.currentBatterId, "batter", "first", "Batter result");
    return movements;
  }

  const batterDestination: GameRunnerMovement["to"] = outcome === "Triple" ? "third"
    : outcome === "Double" ? "second"
      : ["Single", "Error", "Fielder's Choice"].includes(outcome) ? "first"
        : "out";
  addRunner(bases.third, "third", outcome === "Sac Fly" ? "home" : "hold", outcome === "Sac Fly" ? "Tag up" : "Other");
  addRunner(bases.second, "second", outcome === "Single" || outcome === "Double" || outcome === "Triple" ? "home" : "hold");
  addRunner(bases.first, "first", outcome === "Double" ? "third" : outcome === "Single" || outcome === "Error" ? "second" : "hold");
  addRunner(game.currentBatterId, "batter", batterDestination, "Batter result");
  return movements;
}

export function applyRunnerAction(game: Game, action: GameRunnerAction, base?: GameBase): Game {
  let next: Game = { ...game, runners: { ...game.runners } };
  if (action === "Wild Pitch" || action === "Passed Ball") {
    next = advanceAllRunners(next);
    return finalizeOuts(next);
  }
  if (!base) return next;
  const runnerId = next.runners[base];
  if (!runnerId) return next;

  if (action === "Caught Stealing" || action === "Pickoff") {
    delete next.runners[base];
    return finalizeOuts({ ...next, outs: next.outs + 1 });
  }
  if (action === "Run Scored") {
    delete next.runners[base];
    return addRuns(next, 1);
  }
  return moveRunnerOneBase(next, base, runnerId);
}

export function moveRunnerToDestination(game: Game, from: GameBase, to: GameBase | "home"): Game {
  const next: Game = { ...game, runners: { ...game.runners } };
  const runnerId = next.runners[from];
  if (!runnerId || from === to) return next;
  if (to === "home") {
    delete next.runners[from];
    return addRuns(next, 1);
  }
  if (next.runners[to]) return next;
  delete next.runners[from];
  next.runners[to] = runnerId;
  return { ...next, updatedAt: new Date().toISOString() };
}

export function applyGameAdjustment(game: Game, field: "metrolinaScore" | "opponentScore" | "outs", delta: number): Game {
  const next = { ...game, [field]: Math.max(0, Number(game[field]) + delta), updatedAt: new Date().toISOString() };
  return field === "outs" ? finalizeOuts(next) : next;
}

function applyBallInPlay(game: Game, outcome: GameBallInPlayOutcome): Game {
  const batterId = game.currentBatterId;
  if (outcome === "Home Run") {
    const runs = occupiedBaseCount(game) + (batterId ? 1 : 0);
    return addRuns({ ...game, runners: {} }, runs);
  }
  if (outcome === "Triple") {
    const runs = occupiedBaseCount(game);
    return addRuns({ ...game, runners: batterId ? { third: batterId } : {} }, runs);
  }
  if (outcome === "Double") {
    let next = addRuns(game, Number(Boolean(game.runners.second)) + Number(Boolean(game.runners.third)));
    next = { ...next, runners: {} };
    if (game.runners.first) next.runners.third = game.runners.first;
    if (batterId) next.runners.second = batterId;
    return next;
  }
  if (outcome === "Single" || outcome === "Error") {
    let next = addRuns(game, Number(Boolean(game.runners.second)) + Number(Boolean(game.runners.third)));
    next = { ...next, runners: {} };
    if (game.runners.first) next.runners.second = game.runners.first;
    if (batterId) next.runners.first = batterId;
    return next;
  }
  if (outcome === "Sac Fly") {
    let next = { ...game, runners: { ...game.runners }, outs: game.outs + 1 };
    if (next.runners.third) {
      delete next.runners.third;
      next = addRuns(next, 1);
    }
    return next;
  }
  if (outcome === "Sac Bunt") return { ...advanceAllRunners(game), outs: game.outs + 1 };
  if (outcome === "Double Play") {
    const runners = { ...game.runners };
    if (runners.first) delete runners.first;
    else if (runners.second) delete runners.second;
    else if (runners.third) delete runners.third;
    return { ...game, runners, outs: game.outs + 2 };
  }
  if (outcome === "Fielder's Choice") {
    const runners = { ...game.runners };
    if (runners.third) delete runners.third;
    else if (runners.second) delete runners.second;
    else if (runners.first) delete runners.first;
    if (batterId) runners.first = batterId;
    return { ...game, runners, outs: game.outs + 1 };
  }
  return { ...game, outs: game.outs + 1 };
}

function forceRunnerToFirst(game: Game): Game {
  const runners = { ...game.runners };
  let next = { ...game, runners };
  if (runners.first && runners.second && runners.third) {
    next = addRuns(next, 1);
    delete runners.third;
  }
  if (runners.first && runners.second) runners.third = runners.second;
  if (runners.first) runners.second = runners.first;
  if (game.currentBatterId) runners.first = game.currentBatterId;
  return next;
}

function advanceAllRunners(game: Game): Game {
  const runners: Game["runners"] = {};
  let next = { ...game, runners };
  if (game.runners.third) next = addRuns(next, 1);
  if (game.runners.second) runners.third = game.runners.second;
  if (game.runners.first) runners.second = game.runners.first;
  return next;
}

function moveRunnerOneBase(game: Game, base: GameBase, runnerId: ID): Game {
  const runners = { ...game.runners };
  delete runners[base];
  if (base === "third") return addRuns({ ...game, runners }, 1);
  if (base === "second") runners.third = runnerId;
  if (base === "first") runners.second = runnerId;
  return { ...game, runners };
}

function finishPlateAppearance(game: Game): Game {
  const next = {
    ...game,
    balls: 0,
    strikes: 0,
    currentBatterId: nextBatter(game),
    activePlateAppearanceId: undefined,
    plateAppearanceNumber: (game.plateAppearanceNumber ?? 1) + 1,
    pitchNumberInPlateAppearance: 0,
    updatedAt: new Date().toISOString(),
  };
  return finalizeOuts(next);
}

function finalizeOuts(game: Game): Game {
  if (game.outs < 3) return { ...game, updatedAt: new Date().toISOString() };
  return {
    ...game,
    half: game.half === "Top" ? "Bottom" : "Top",
    inning: game.half === "Bottom" ? game.inning + 1 : game.inning,
    outs: 0,
    balls: 0,
    strikes: 0,
    runners: {},
    updatedAt: new Date().toISOString(),
  };
}

function addRuns(game: Game, runs: number): Game {
  if (runs <= 0) return game;
  return isMetrolinaBatting(game)
    ? { ...game, metrolinaScore: game.metrolinaScore + runs }
    : { ...game, opponentScore: game.opponentScore + runs };
}

function occupiedBaseCount(game: Game) {
  return Object.values(game.runners).filter(Boolean).length;
}

function nextBatter(game: Game): ID | undefined {
  if (!game.lineup.length) return game.currentBatterId;
  const index = game.lineup.findIndex((playerId) => playerId === game.currentBatterId);
  return game.lineup[(index + 1) % game.lineup.length] ?? game.lineup[0];
}

import { RUNNER_H, RUNNER_W, TILE, VIEW_W } from "./constants";
import { collectCredits, createCredits, type CreditEvent, type Credits } from "./credits";
import {
  fellInPit,
  returnToSafeGround,
  START_HEALTH,
  updateSafeGround,
  type HealthEvent,
  type SafeGround,
} from "./health";
import { levelWidth, parseLevel, type Level } from "./level";
import { startRecovery, tickRecovery } from "./recovery";
import { createRunner, stepRunner, type Runner, type RunnerEvent } from "./runner";
import { derivePhysics, type Physics, type Settings } from "./settings";

/** Best time and most Credits remembered for a Level. Used by later tickets. */
export interface LevelRecord {
  bestTime: number;
  mostCredits: number;
}

/** Keys down this tick, plus edge flags for presses that happened since the last tick. */
export interface Input {
  left: boolean;
  right: boolean;
  jump: boolean;
  jumpPressed: boolean;
  /** Enter was pressed since the last tick (start / confirm). Optional: absent means not pressed. */
  startPressed?: boolean;
  /** P or Esc was pressed since the last tick. Optional: absent means not pressed. */
  pausePressed?: boolean;
}

export type GameEvent =
  | RunnerEvent
  | CreditEvent
  | HealthEvent
  | { type: "level-failed" }
  | { type: "level-restarted" }
  | { type: "level-complete"; time: number; collected: number; total: number }
  | { type: "paused" }
  | { type: "resumed" };

export interface Camera {
  /** Left edge of the view in Level pixels. */
  x: number;
}

export interface Game {
  readonly level: Level;
  readonly physics: Physics;
  readonly previousRecord: LevelRecord | undefined;
  readonly runner: Runner;
  readonly camera: Camera;
  readonly credits: Credits;
  readonly health: number;
  /** Last ground the Runner stood on fully with both feet; a Pit fall returns them here. */
  readonly safeGround: SafeGround;
  /** Recovery time left, s; 0 when not in Recovery. See recovery.ts. */
  readonly recovery: number;
  /** "failed": Level Failed, "SYSTEM FAILURE" shows and the world is frozen until the restart. */
  readonly phase: Phase;
  /** Time left before a Failed Level restarts, s. */
  readonly failedTimer: number;
  /** Seconds of play this run. Starts with the Level and runs only while playing. */
  readonly time: number;
}

/**
 * Where the game is in its flow. Only "playing" moves the world and the timer.
 * title → playing ⇄ paused; playing → failed → playing (restart); playing → complete (Level Complete).
 */
export type Phase = "title" | "playing" | "paused" | "failed" | "complete";

/** How long "SYSTEM FAILURE" shows before the Level restarts, s. */
export const FAILED_SECONDS = 2;

export function createGame(levelText: string, settings: Settings, previousRecord?: LevelRecord): Game {
  return freshRun(parseLevel(levelText), derivePhysics(settings), previousRecord, "title");
}

/** The Level as it is at the beginning: used for the first start and every restart. */
function freshRun(level: Level, physics: Physics, previousRecord: LevelRecord | undefined, phase: Phase = "playing"): Game {
  const { col, row } = level.start;
  const runner = createRunner(col * TILE + (TILE - RUNNER_W) / 2, (row + 1) * TILE - RUNNER_H);
  return {
    level,
    physics,
    previousRecord,
    runner,
    camera: follow(level, runner),
    credits: createCredits(level),
    health: START_HEALTH,
    safeGround: { x: runner.x, y: runner.y },
    recovery: 0,
    phase,
    failedTimer: 0,
    time: 0,
  };
}

type StepResult = { game: Game; events: GameEvent[] };

export function step(game: Game, input: Input, dt: number): StepResult {
  switch (game.phase) {
    case "title":
      // The tick that starts the Level only changes phase; the world starts moving on the next tick.
      return { game: input.startPressed ? { ...game, phase: "playing" } : game, events: [] };
    case "failed":
      return stepFailed(game, dt);
    case "complete":
      // Level Complete: the world and the timer stay frozen until Enter plays again.
      return input.startPressed ? restart(game) : { game, events: [] };
    case "paused":
      // Nothing moves while paused; the pause key resumes.
      return input.pausePressed ? { game: { ...game, phase: "playing" }, events: [{ type: "resumed" }] } : { game, events: [] };
    case "playing":
      if (input.pausePressed) return { game: { ...game, phase: "paused" }, events: [{ type: "paused" }] };
      return play(game, input, dt);
  }
}

/** One tick of play: Runner, Credits, Pits, camera and timer. */
function play(game: Game, input: Input, dt: number): StepResult {
  const events: GameEvent[] = [];
  const moved = stepRunner(game.runner, input, game.physics, game.level, dt);
  const runner = moved.runner;
  const collected = collectCredits(game.credits, runner);
  events.push(...moved.events, ...collected.events);
  let next: Game = {
    ...game,
    time: game.time + dt,
    runner,
    credits: collected.credits,
    recovery: tickRecovery(game.recovery, dt),
    safeGround: updateSafeGround(game.level, runner, game.safeGround),
  };
  // A Pit fall always costs Health, even in Recovery: the Runner has to be put back somewhere.
  if (fellInPit(next.level, next.runner)) {
    next = loseHealth({ ...next, runner: returnToSafeGround(next.runner, next.safeGround) });
    events.push({ type: "pit-fall", health: next.health });
    if (next.phase === "failed") events.push({ type: "level-failed" });
  }
  if (next.phase === "playing" && touchesExit(next.level, next.runner)) {
    next = { ...next, phase: "complete" };
    events.push({ type: "level-complete", time: next.time, collected: next.credits.collected, total: next.credits.total });
  }
  return { game: { ...next, camera: follow(next.level, next.runner) }, events };
}

/** The Runner overlaps the Exit tile. */
function touchesExit(level: Level, runner: Runner): boolean {
  if (!level.exit) return false;
  const x = level.exit.col * TILE;
  const y = level.exit.row * TILE;
  return runner.x < x + TILE && x < runner.x + RUNNER_W && runner.y < y + TILE && y < runner.y + RUNNER_H;
}

/** −1 Health and start Recovery; at 0 Health the Level is Failed. Shared by Pit falls and (later) Hits. */
function loseHealth(game: Game): Game {
  const health = Math.max(0, game.health - 1);
  if (health > 0) return { ...game, health, recovery: startRecovery() };
  return { ...game, health, recovery: 0, phase: "failed", failedTimer: FAILED_SECONDS };
}

/** Level Failed: the world is frozen; when the timer runs out the Level restarts from the beginning. */
function stepFailed(game: Game, dt: number): StepResult {
  const failedTimer = game.failedTimer - dt;
  if (failedTimer > 1e-9) return { game: { ...game, failedTimer }, events: [] };
  return restart(game);
}

/** Back to the beginning of the Level and straight into play: after Level Failed and on play again after Level Complete. */
function restart(game: Game): StepResult {
  return { game: freshRun(game.level, game.physics, game.previousRecord), events: [{ type: "level-restarted" }] };
}

/** Centre the Runner horizontally, never showing past the Level's edges. A Level narrower than the view is centred. */
function follow(level: Level, runner: Runner): Camera {
  const width = levelWidth(level);
  if (width <= VIEW_W) return { x: (width - VIEW_W) / 2 };
  const x = runner.x + RUNNER_W / 2 - VIEW_W / 2;
  return { x: Math.min(Math.max(x, 0), width - VIEW_W) };
}

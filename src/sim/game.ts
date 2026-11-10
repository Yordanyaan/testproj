import { RUNNER_H, RUNNER_W, TILE, VIEW_W } from "./constants";
import { findContacts, knockback, KNOCKBACK_STUN, stompBounce, type CombatEvent } from "./combat";
import { collectCredits, createCredits, type CreditEvent, type Credits } from "./credits";
import { createEnemies, moveEnemies, type Enemy } from "./enemies";
import {
  fellInPit,
  returnToSafeGround,
  START_HEALTH,
  updateSafeGround,
  type HealthEvent,
  type SafeGround,
} from "./health";
import { levelWidth, parseLevel, type Level } from "./level";
import { inRecovery, startRecovery, tickRecovery } from "./recovery";
import { createRunner, stepRunner, type Runner, type RunnerEvent } from "./runner";
import { derivePhysics, type Physics, type Settings } from "./settings";

import { compareWithRecord, type LevelRecord, type NewRecord } from "./record";

export type { LevelRecord, NewRecord } from "./record";

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
  | CombatEvent
  | { type: "level-failed" }
  | { type: "level-restarted" }
  | {
      type: "level-complete";
      time: number;
      collected: number;
      total: number;
      /** Which parts of this run beat the previous Record (both, with no previous Record). */
      newRecord: NewRecord;
      /** The Record from now on: the better of the previous Record and this run, part by part. */
      record: LevelRecord;
    }
  | { type: "paused" }
  | { type: "resumed" };

export interface Camera {
  /** Left edge of the view in Level pixels. */
  x: number;
}

export interface Game {
  readonly level: Level;
  readonly physics: Physics;
  /** The Record: the previous one during play, updated with this run once the Level is complete. */
  readonly record: LevelRecord | undefined;
  /** What this run beat on Level Complete; undefined until then. */
  readonly newRecord: NewRecord | undefined;
  readonly runner: Runner;
  readonly camera: Camera;
  readonly credits: Credits;
  /** Enemies not defeated yet this run. */
  readonly enemies: readonly Enemy[];
  readonly health: number;
  /** Last ground the Runner stood on fully with both feet; a Pit fall returns them here. */
  readonly safeGround: SafeGround;
  /** Recovery time left, s; 0 when not in Recovery. See recovery.ts. */
  readonly recovery: number;
  /** Time left of a Hit's knockback stun, when input is ignored, s; 0 when not stunned. */
  readonly stun: number;
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
function freshRun(level: Level, physics: Physics, record: LevelRecord | undefined, phase: Phase = "playing"): Game {
  const { col, row } = level.start;
  const runner = createRunner(col * TILE + (TILE - RUNNER_W) / 2, (row + 1) * TILE - RUNNER_H);
  return {
    level,
    physics,
    record,
    newRecord: undefined,
    runner,
    camera: follow(level, runner),
    credits: createCredits(level),
    enemies: createEnemies(level),
    health: START_HEALTH,
    safeGround: { x: runner.x, y: runner.y },
    recovery: 0,
    stun: 0,
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
  const enemiesMoved = moveEnemies(game.enemies, game.level, dt);
  const stunned = game.stun > 0;
  const moved = stepRunner(game.runner, input, game.physics, game.level, dt, stunned);
  let runner = moved.runner;
  events.push(...moved.events);

  // Stomps first; any other touch is a Hit unless the Runner is in Recovery.
  const contacts = findContacts(enemiesMoved, game.runner, runner);
  if (contacts.stomped.length > 0) {
    runner = stompBounce(runner, contacts.stomped, input.jump && !stunned, game.physics);
    events.push({ type: "stomp" });
  }

  const collected = collectCredits(game.credits, runner);
  events.push(...collected.events);
  let next: Game = {
    ...game,
    time: game.time + dt,
    runner,
    credits: collected.credits,
    enemies: contacts.enemies,
    recovery: tickRecovery(game.recovery, dt),
    stun: tickRecovery(game.stun, dt),
    safeGround: updateSafeGround(game.level, runner, game.safeGround),
  };
  if (contacts.stomped.length === 0 && contacts.touched && !inRecovery(next)) {
    const runner = knockback(next.runner, contacts.touched, next.physics);
    next = loseHealth({ ...next, runner, stun: KNOCKBACK_STUN });
    events.push({ type: "hit", health: next.health });
    if (next.phase === "failed") {
      events.push({ type: "level-failed" });
      return { game: { ...next, camera: follow(next.level, next.runner) }, events };
    }
  }
  // A Pit fall is a Hit: it always puts the Runner back, but during Recovery it costs nothing.
  if (fellInPit(next.level, next.runner)) {
    next = { ...next, runner: returnToSafeGround(next.runner, next.safeGround) };
    if (!inRecovery(next)) next = loseHealth(next);
    events.push({ type: "pit-fall", health: next.health });
    if (next.phase === "failed") events.push({ type: "level-failed" });
  }
  if (next.phase === "playing" && touchesExit(next.level, next.runner)) {
    const { newRecord, record } = compareWithRecord(next.record, next.time, next.credits.collected);
    next = { ...next, phase: "complete", record, newRecord };
    events.push({
      type: "level-complete",
      time: next.time,
      collected: next.credits.collected,
      total: next.credits.total,
      newRecord,
      record,
    });
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

/** −1 Health and start Recovery; at 0 Health the Level is Failed. Shared by Pit falls and Enemy Hits. */
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
  return { game: freshRun(game.level, game.physics, game.record), events: [{ type: "level-restarted" }] };
}

/** Centre the Runner horizontally, never showing past the Level's edges. A Level narrower than the view is centred. */
function follow(level: Level, runner: Runner): Camera {
  const width = levelWidth(level);
  if (width <= VIEW_W) return { x: (width - VIEW_W) / 2 };
  const x = runner.x + RUNNER_W / 2 - VIEW_W / 2;
  return { x: Math.min(Math.max(x, 0), width - VIEW_W) };
}

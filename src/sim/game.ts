import { RUNNER_H, RUNNER_W, TILE, VIEW_W } from "./constants";
import { levelWidth, parseLevel, type Level } from "./level";
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
}

export type GameEvent = RunnerEvent;

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
}

export function createGame(levelText: string, settings: Settings, previousRecord?: LevelRecord): Game {
  const level = parseLevel(levelText);
  const { col, row } = level.start;
  const runner = createRunner(col * TILE + (TILE - RUNNER_W) / 2, (row + 1) * TILE - RUNNER_H);
  return { level, physics: derivePhysics(settings), previousRecord, runner, camera: follow(level, runner) };
}

export function step(game: Game, input: Input, dt: number): { game: Game; events: GameEvent[] } {
  const { runner, events } = stepRunner(game.runner, input, game.physics, game.level, dt);
  return { game: { ...game, runner, camera: follow(game.level, runner) }, events };
}

/** Centre the Runner horizontally, never showing past the Level's edges. A Level narrower than the view is centred. */
function follow(level: Level, runner: Runner): Camera {
  const width = levelWidth(level);
  if (width <= VIEW_W) return { x: (width - VIEW_W) / 2 };
  const x = runner.x + RUNNER_W / 2 - VIEW_W / 2;
  return { x: Math.min(Math.max(x, 0), width - VIEW_W) };
}

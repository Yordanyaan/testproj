// Health, Pits and last solid ground. Pure: no DOM, no globals.
import { RUNNER_H, RUNNER_W, TILE } from "./constants";
import { isSolid, levelHeight, type Level } from "./level";
import type { Runner } from "./runner";

export const START_HEALTH = 3;
/** How far below the Level's bottom the Runner's top must be before it counts as a Pit fall, px. */
export const PIT_MARGIN = 48;

export type HealthEvent = { type: "pit-fall"; health: number };

/** Where the Runner last stood with ground fully solid under both feet (top-left, px). */
export interface SafeGround {
  x: number;
  y: number;
}

/** True once the Runner has fallen below the Level by the margin. */
export function fellInPit(level: Level, runner: Runner): boolean {
  return runner.y > levelHeight(level) + PIT_MARGIN;
}

/** Remember the Runner's spot when standing with solid ground under both feet; otherwise keep the old one. */
export function updateSafeGround(level: Level, runner: Runner, safe: SafeGround): SafeGround {
  if (!runner.grounded) return safe;
  const row = Math.round((runner.y + RUNNER_H) / TILE);
  const leftFoot = Math.floor(runner.x / TILE);
  const rightFoot = Math.floor((runner.x + RUNNER_W - 0.01) / TILE);
  if (isSolid(level, leftFoot, row) && isSolid(level, rightFoot, row)) return { x: runner.x, y: runner.y };
  return safe;
}

/** Put the Runner back on the last solid ground, standing still. */
export function returnToSafeGround(runner: Runner, safe: SafeGround): Runner {
  return { ...runner, x: safe.x, y: safe.y, vx: 0, vy: 0, grounded: true, coyote: 0, buffer: 0 };
}

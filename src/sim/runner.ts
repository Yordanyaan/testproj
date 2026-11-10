// Runner movement and tile collisions, lifted from the movement prototype's
// RunnerPhysics (branch prototype/movement-feel). Pure: no DOM, no globals.
import { RUNNER_H, RUNNER_W, TILE } from "./constants";
import { isSolid, type Level } from "./level";
import type { Physics } from "./settings";

export interface Runner {
  x: number; // left edge, px
  y: number; // top edge, px
  vx: number; // px/s
  vy: number; // px/s, positive is down
  grounded: boolean;
  facing: 1 | -1;
  /** Late-jump grace left, s. */
  coyote: number;
  /** Early-jump memory left, s. */
  buffer: number;
}

export interface RunnerInput {
  left: boolean;
  right: boolean;
  jump: boolean;
  jumpPressed: boolean;
}

export type RunnerEvent = { type: "jump" } | { type: "land" };

export function createRunner(x: number, y: number): Runner {
  return { x, y, vx: 0, vy: 0, grounded: false, facing: 1, coyote: 0, buffer: 0 };
}

function approach(value: number, target: number, amount: number): number {
  return value < target ? Math.min(value + amount, target) : Math.max(value - amount, target);
}

function resolveX(s: Runner, level: Level): void {
  const top = Math.floor(s.y / TILE);
  const bottom = Math.floor((s.y + RUNNER_H - 0.01) / TILE);
  if (s.vx > 0) {
    const col = Math.floor((s.x + RUNNER_W - 0.01) / TILE);
    for (let r = top; r <= bottom; r++)
      if (isSolid(level, col, r)) {
        s.x = col * TILE - RUNNER_W;
        s.vx = 0;
        return;
      }
  } else if (s.vx < 0) {
    const col = Math.floor(s.x / TILE);
    for (let r = top; r <= bottom; r++)
      if (isSolid(level, col, r)) {
        s.x = (col + 1) * TILE;
        s.vx = 0;
        return;
      }
  }
}

/** Returns true when the Runner landed on something this tick. */
function resolveY(s: Runner, level: Level): boolean {
  const left = Math.floor(s.x / TILE);
  const right = Math.floor((s.x + RUNNER_W - 0.01) / TILE);
  if (s.vy > 0) {
    const row = Math.floor((s.y + RUNNER_H - 0.01) / TILE);
    for (let c = left; c <= right; c++)
      if (isSolid(level, c, row)) {
        s.y = row * TILE - RUNNER_H;
        s.vy = 0;
        return true;
      }
  } else if (s.vy < 0) {
    const row = Math.floor(s.y / TILE);
    for (let c = left; c <= right; c++)
      if (isSolid(level, c, row)) {
        s.y = (row + 1) * TILE;
        s.vy = 0;
        return false;
      }
  }
  return false;
}

export function stepRunner(
  prev: Runner,
  input: RunnerInput,
  P: Physics,
  level: Level,
  dt: number,
): { runner: Runner; events: RunnerEvent[] } {
  const s: Runner = { ...prev };
  const events: RunnerEvent[] = [];

  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir !== 0) s.facing = dir > 0 ? 1 : -1;

  s.buffer = input.jumpPressed ? P.earlyJumpGrace : Math.max(0, s.buffer - dt);
  s.coyote = s.grounded ? P.lateJumpGrace : Math.max(0, s.coyote - dt);

  // Horizontal: speed up toward the target speed, faster when turning around.
  let rate = dir !== 0 ? P.accel : P.decel;
  if (dir !== 0 && s.vx !== 0 && Math.sign(s.vx) !== dir) rate = P.accel + P.decel;
  if (!s.grounded) rate *= P.airControl;
  s.vx = approach(s.vx, dir * P.topSpeed, rate * dt);

  // Jump, with early-jump memory and late-jump grace.
  const wantsJump = input.jumpPressed || s.buffer > 0;
  if (wantsJump && (s.grounded || s.coyote > 0)) {
    s.vy = -P.jumpVelocity;
    s.buffer = 0;
    s.coyote = 0;
    s.grounded = false;
    events.push({ type: "jump" });
  }

  // Gravity: heavier when falling, heavier still when Space is released while rising.
  let g = P.gravity;
  if (s.vy > 0) g *= P.fallGravity;
  else if (s.vy < 0 && !input.jump) g *= P.releaseGravity;
  s.vy = Math.min(s.vy + g * dt, P.maxFall);

  s.x += s.vx * dt;
  resolveX(s, level);
  s.y += s.vy * dt;
  s.grounded = resolveY(s, level);
  if (s.grounded && !prev.grounded) events.push({ type: "land" });

  return { runner: s, events };
}

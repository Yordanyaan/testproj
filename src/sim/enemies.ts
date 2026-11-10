// Enemies: placed by the Level grid, moved each tick by their kind's rule.
// Pure: no DOM, no globals.
import { TILE } from "./constants";
import { isSolid, type EnemyPlacement, type Level } from "./level";

/** Patrol Bot size, px. */
export const PATROL_BOT_W = 14;
export const PATROL_BOT_H = 14;
/** Patrol Bot walking speed, px/s (2 tiles/s). */
const PATROL_BOT_SPEED = 2 * TILE;

/** What every Enemy kind has: a touch box (top-left, px). Stomp and Hit only look at this. */
export interface EnemyBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface PatrolBot extends EnemyBox {
  readonly kind: "patrol-bot";
  /** Walking direction. */
  readonly dir: 1 | -1;
}

/** Add more kinds (Hover Drone) to this union; each brings its own movement in `moveEnemy`. */
export type Enemy = PatrolBot;

function createEnemy(p: EnemyPlacement): Enemy {
  switch (p.kind) {
    case "patrol-bot":
      return {
        kind: "patrol-bot",
        x: p.col * TILE + (TILE - PATROL_BOT_W) / 2,
        y: (p.row + 1) * TILE - PATROL_BOT_H,
        w: PATROL_BOT_W,
        h: PATROL_BOT_H,
        dir: -1,
      };
  }
}

/** The Enemies as they are at the beginning of a run. */
export function createEnemies(level: Level): readonly Enemy[] {
  return level.enemies.map(createEnemy);
}

/** Move every Enemy by one tick, each by its kind's rule. */
export function moveEnemies(enemies: readonly Enemy[], level: Level, dt: number): readonly Enemy[] {
  return enemies.map((e) => moveEnemy(e, level, dt));
}

function moveEnemy(enemy: Enemy, level: Level, dt: number): Enemy {
  switch (enemy.kind) {
    case "patrol-bot":
      return patrol(enemy, level, dt);
  }
}

/** Walk along the ground; turn back on reaching a wall or the edge of the ground. */
function patrol(bot: PatrolBot, level: Level, dt: number): PatrolBot {
  const x = bot.x + bot.dir * PATROL_BOT_SPEED * dt;
  const row = Math.floor((bot.y + bot.h - 0.01) / TILE);
  const front = bot.dir > 0 ? Math.floor((x + bot.w - 0.01) / TILE) : Math.floor(x / TILE);
  if (isSolid(level, front, row) || !isSolid(level, front, row + 1)) {
    const stop = bot.dir > 0 ? front * TILE - bot.w : (front + 1) * TILE;
    return { ...bot, x: stop, dir: bot.dir > 0 ? -1 : 1 };
  }
  return { ...bot, x };
}

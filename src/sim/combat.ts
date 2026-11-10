// Stomp and Hit: what happens when the Runner touches an Enemy. Works on any Enemy kind
// through its touch box (EnemyBox), so every kind shares one rule. Pure: no DOM, no globals.
import { RUNNER_H, RUNNER_W } from "./constants";
import type { Enemy, EnemyBox } from "./enemies";
import type { Runner } from "./runner";
import type { Physics } from "./settings";

export type CombatEvent = { type: "stomp" } | { type: "hit"; health: number };

/** How long input is ignored at the start of a Hit's Recovery, so the knockback is visible, s. */
export const KNOCKBACK_STUN = 0.2;
/** The small hop of a Hit's knockback, as a share of the jump velocity. */
const KNOCKBACK_HOP = 0.35;

export interface Contacts {
  /** Enemies left after the Stomps. */
  enemies: readonly Enemy[];
  /** Enemies Stomped this tick. */
  stomped: readonly Enemy[];
  /** The first Enemy the Runner touched without Stomping it, if any. */
  touched: EnemyBox | null;
}

const overlaps = (r: Runner, e: EnemyBox) =>
  r.x < e.x + e.w && e.x < r.x + RUNNER_W && r.y < e.y + e.h && e.y < r.y + RUNNER_H;

/**
 * Sort this tick's contacts into Stomps and other touches.
 * Stomp rule: the Runner is moving down and their feet *before this tick* were at or above the Enemy's vertical middle.
 */
export function findContacts(enemies: readonly Enemy[], before: Runner, runner: Runner): Contacts {
  const stomped: Enemy[] = [];
  const left: Enemy[] = [];
  let touched: EnemyBox | null = null;
  for (const e of enemies) {
    if (!overlaps(runner, e)) {
      left.push(e);
    } else if (runner.vy > 0 && before.y + RUNNER_H <= e.y + e.h / 2) {
      stomped.push(e);
    } else {
      left.push(e);
      touched ??= e;
    }
  }
  return { enemies: left, stomped, touched };
}

/** Knock the Runner away from the Enemy that Hit them, with a small hop. */
export function knockback(runner: Runner, from: EnemyBox, P: Physics): Runner {
  const away = runner.x + RUNNER_W / 2 < from.x + from.w / 2 ? -1 : 1;
  return {
    ...runner,
    vx: away * P.knockback,
    vy: -P.jumpVelocity * KNOCKBACK_HOP,
    grounded: false,
    coyote: 0,
  };
}

/** Bounce up off the Stomped Enemies: higher with Space held. */
export function stompBounce(runner: Runner, stomped: readonly EnemyBox[], jumpHeld: boolean, P: Physics): Runner {
  const top = Math.min(...stomped.map((e) => e.y));
  return {
    ...runner,
    y: top - RUNNER_H,
    vy: -(jumpHeld ? P.stompHeld : P.stompTap),
    grounded: false,
    coyote: 0,
  };
}

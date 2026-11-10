// Recovery: the short period after a Hit or Pit fall when the Runner blinks and can't take another Hit.
// Pure: no DOM, no globals. The Hit ticket reuses startRecovery / inRecovery.
import type { Game } from "./game";

export const RECOVERY_SECONDS = 1;
/** Blink rate while in Recovery: on/off phases per second. */
const BLINK_PHASES_PER_SECOND = 12;

/** Recovery time left after a Hit or Pit fall, s. */
export const startRecovery = (): number => RECOVERY_SECONDS;

/** Count Recovery down by one tick, snapping float dust to 0. */
export function tickRecovery(recovery: number, dt: number): number {
  const left = recovery - dt;
  return left > 1e-9 ? left : 0;
}

/** True while the Runner is in Recovery and can't take another Hit. */
export const inRecovery = (game: Pick<Game, "recovery">): boolean => game.recovery > 0;

/** Whether the Runner is drawn this tick: blinks on and off during Recovery. */
export function runnerVisible(game: Pick<Game, "recovery">): boolean {
  if (!inRecovery(game)) return true;
  return Math.floor(game.recovery * BLINK_PHASES_PER_SECOND) % 2 === 1;
}

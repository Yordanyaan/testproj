// Credits: collectibles placed by `C` in the Level grid, collected by touch. Pure: no DOM, no globals.
import { CREDIT_SIZE, RUNNER_H, RUNNER_W, TILE } from "./constants";
import type { Level } from "./level";
import type { Runner } from "./runner";

/** A Credit still in the Level: its CREDIT_SIZE square's top-left corner, in Level pixels. */
export interface Credit {
  readonly x: number;
  readonly y: number;
}

export interface Credits {
  /** How many Credits the Level holds. */
  readonly total: number;
  /** How many the Runner has collected this run. */
  readonly collected: number;
  /** Credits not collected yet. */
  readonly remaining: readonly Credit[];
}

export type CreditEvent = { type: "credit-collected"; collected: number; total: number };

export function createCredits(level: Level): Credits {
  const inset = (TILE - CREDIT_SIZE) / 2;
  const remaining = level.credits.map(({ col, row }) => ({ x: col * TILE + inset, y: row * TILE + inset }));
  return { total: remaining.length, collected: 0, remaining };
}

/** Collect every remaining Credit the Runner overlaps. A collected Credit is gone, so it counts once. */
export function collectCredits(credits: Credits, runner: Runner): { credits: Credits; events: CreditEvent[] } {
  const touched = (c: Credit) =>
    runner.x < c.x + CREDIT_SIZE && c.x < runner.x + RUNNER_W && runner.y < c.y + CREDIT_SIZE && c.y < runner.y + RUNNER_H;
  if (!credits.remaining.some(touched)) return { credits, events: [] };

  const events: CreditEvent[] = [];
  let collected = credits.collected;
  const remaining = credits.remaining.filter((c) => {
    if (!touched(c)) return true;
    collected++;
    events.push({ type: "credit-collected", collected, total: credits.total });
    return false;
  });
  return { credits: { ...credits, collected, remaining }, events };
}

// Test support: helpers for simulation tests. Goes only through the public seam (createGame/step).
import { createGame, step, type Game, type LevelRecord } from "./game";
import { DT } from "./constants";
import type { Settings } from "./settings";

/** A game past the title screen: created, then Enter pressed once. The Level is ready to play, with the timer at 0. */
export function startedGame(levelText: string, settings: Settings, previousRecord?: LevelRecord): Game {
  const title = createGame(levelText, settings, previousRecord);
  return step(title, { left: false, right: false, jump: false, jumpPressed: false, startPressed: true }, DT).game;
}

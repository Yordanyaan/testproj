// The game simulation's public interface. Everything outside src/sim goes through here.
export { createGame, step, type Game, type GameEvent, type Input, type LevelRecord } from "./game";
export { DEFAULT_SETTINGS, type Settings } from "./settings";
export { DT, TILE, RUNNER_W, RUNNER_H, VIEW_W, VIEW_H, CREDIT_SIZE } from "./constants";
export type { Credit, Credits } from "./credits";
export { isSolid, type Level } from "./level";

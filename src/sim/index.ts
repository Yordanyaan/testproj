// The game simulation's public interface. Everything outside src/sim goes through here.
export {
  createGame,
  step,
  FAILED_SECONDS,
  type Game,
  type GameEvent,
  type Input,
  type LevelRecord,
  type NewRecord,
  type Phase,
} from "./game";
export { START_HEALTH } from "./health";
export { DEFAULT_SETTINGS, type Settings } from "./settings";
export { DT, TILE, RUNNER_W, RUNNER_H, VIEW_W, VIEW_H, CREDIT_SIZE } from "./constants";
export type { Credit, Credits } from "./credits";
export { isSolid, type Level } from "./level";
export { inRecovery, runnerVisible } from "./recovery";

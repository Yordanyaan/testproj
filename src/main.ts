// Entry point: wires the pure simulation to the thin browser adapters.
import { createGame, DEFAULT_SETTINGS, step } from "./sim";
import { createKeyboard } from "./adapters/keyboard";
import { createRenderer } from "./adapters/renderer";
import { startLoop } from "./adapters/loop";
import { TEST_LEVEL } from "./levels/test-level";

const canvas = document.querySelector<HTMLCanvasElement>("#game");
if (!canvas) throw new Error("Missing #game canvas");

const keyboard = createKeyboard(window);
const renderer = createRenderer(canvas);
let game = createGame(TEST_LEVEL, DEFAULT_SETTINGS);

startLoop(
  (dt) => {
    game = step(game, keyboard.read(), dt).game;
  },
  () => renderer.draw(game),
);

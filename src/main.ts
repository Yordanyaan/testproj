// Entry point: wires the pure simulation to the thin browser adapters.
import { createGame, DEFAULT_SETTINGS, step } from "./sim";
import { createKeyboard } from "./adapters/keyboard";
import { createRenderer } from "./adapters/renderer";
import { startLoop } from "./adapters/loop";
import { createRecordStore } from "./adapters/record-store";
import { createAudio } from "./adapters/audio";
import { TEST_LEVEL } from "./levels/test-level";

const canvas = document.querySelector<HTMLCanvasElement>("#game");
if (!canvas) throw new Error("Missing #game canvas");

const keyboard = createKeyboard(window);
const renderer = createRenderer(canvas);
const records = createRecordStore();
const audio = createAudio(window);
let game = createGame(TEST_LEVEL, DEFAULT_SETTINGS, records.load());

startLoop(
  (dt) => {
    const result = step(game, keyboard.read(), dt);
    game = result.game;
    audio.play(result.events);
    for (const event of result.events) {
      if (event.type === "level-complete" && (event.newRecord.time || event.newRecord.credits)) records.save(event.record);
    }
  },
  () => renderer.draw(game),
);

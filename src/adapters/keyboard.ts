// Thin keyboard adapter: maps arrow keys / A / D, Space, Enter and P / Esc to simulation Input.
import type { Input } from "../sim";

type Key = "left" | "right" | "jump" | "start" | "pause";

const KEYMAP: Record<string, Key> = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  Space: "jump",
  Enter: "start",
  NumpadEnter: "start",
  KeyP: "pause",
  Escape: "pause",
};

export interface Keyboard {
  /** Input for one simulation tick. Press flags are cleared once read. */
  read(): Input;
}

export function createKeyboard(target: Window): Keyboard {
  const down = new Set<Key>();
  const pressed = new Set<Key>();

  target.addEventListener("keydown", (e) => {
    const key = KEYMAP[e.code];
    if (!key) return;
    e.preventDefault();
    if (e.repeat) return;
    pressed.add(key);
    down.add(key);
  });
  target.addEventListener("keyup", (e) => {
    const key = KEYMAP[e.code];
    if (key) down.delete(key);
  });
  target.addEventListener("blur", () => down.clear());

  return {
    read() {
      const input: Input = {
        left: down.has("left"),
        right: down.has("right"),
        jump: down.has("jump"),
        jumpPressed: pressed.has("jump"),
        startPressed: pressed.has("start"),
        pausePressed: pressed.has("pause"),
      };
      pressed.clear();
      return input;
    },
  };
}

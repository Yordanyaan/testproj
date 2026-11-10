// Thin keyboard adapter: maps arrow keys / A / D and Space to simulation Input.
import type { Input } from "../sim";

type Key = "left" | "right" | "jump";

const KEYMAP: Record<string, Key> = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  Space: "jump",
};

export interface Keyboard {
  /** Input for one simulation tick. Press flags are cleared once read. */
  read(): Input;
}

export function createKeyboard(target: Window): Keyboard {
  const down = new Set<Key>();
  let jumpPressed = false;

  target.addEventListener("keydown", (e) => {
    const key = KEYMAP[e.code];
    if (!key) return;
    e.preventDefault();
    if (e.repeat) return;
    if (key === "jump") jumpPressed = true;
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
        jumpPressed,
      };
      jumpPressed = false;
      return input;
    },
  };
}

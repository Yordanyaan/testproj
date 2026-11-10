import { describe, expect, it } from "vitest";
import { soundFor } from "./sound-cues";

describe("soundFor", () => {
  it("plays the jump sound for a jump", () => {
    expect(soundFor({ type: "jump" })).toBe("jump");
  });

  it("plays the credit sound when a Credit is collected", () => {
    expect(soundFor({ type: "credit-collected", collected: 1, total: 3 })).toBe("credit");
  });

  it("plays the stomp sound for a Stomp", () => {
    expect(soundFor({ type: "stomp" })).toBe("stomp");
  });

  it("plays the hit sound for a Hit", () => {
    expect(soundFor({ type: "hit", health: 2 })).toBe("hit");
  });

  it("stays silent for events without a sound", () => {
    expect(soundFor({ type: "land" })).toBeUndefined();
    expect(soundFor({ type: "paused" })).toBeUndefined();
  });
});

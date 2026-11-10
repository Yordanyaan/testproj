import { describe, expect, it } from "vitest";
import { DT, DEFAULT_SETTINGS, step, type Game, type GameEvent, type Input, type LevelRecord } from "./index";
import { startedGame as createGame } from "./testing";

const IDLE: Input = { left: false, right: false, jump: false, jumpPressed: false };

/** Step with `input` until Level Complete (or fail after 5 s). */
function runToExit(game: Game, input: Partial<Input> = { right: true }) {
  for (let i = 0; i < 600; i++) {
    const r = step(game, { ...IDLE, ...input }, DT);
    game = r.game;
    const complete = r.events.find((e) => e.type === "level-complete");
    if (complete) return { game, complete: complete as Extract<GameEvent, { type: "level-complete" }> };
  }
  throw new Error("no level-complete within 5 s");
}

/** Start, two Credits on the way, one up high out of reach, then the Exit. A run right takes a little over a second and collects 2 of 3. */
const TO_EXIT = [
  "....C.........",
  "..............",
  "..............",
  ".S..C..C....E.",
  "##############",
].join("\n");

/** What a plain run right scores on TO_EXIT, measured without a Record. */
const plainRun = () => runToExit(createGame(TO_EXIT, DEFAULT_SETTINGS)).complete;

describe("Record", () => {
  it("with no previous Record, completing the Level is a new Record for both time and Credits", () => {
    const complete = plainRun();
    expect(complete.newRecord).toEqual({ time: true, credits: true });
    expect(complete.record).toEqual({ bestTime: complete.time, mostCredits: 2 });
  });

  const completeWith = (previous: LevelRecord) => runToExit(createGame(TO_EXIT, DEFAULT_SETTINGS, previous)).complete;

  it("a better time beats the Record's time only; the Record keeps its Credits", () => {
    const { time } = plainRun();
    const complete = completeWith({ bestTime: time + 1, mostCredits: 3 });
    expect(complete.newRecord).toEqual({ time: true, credits: false });
    expect(complete.record).toEqual({ bestTime: time, mostCredits: 3 });
  });

  it("more Credits beat the Record's Credits only; the Record keeps its time", () => {
    const { time } = plainRun();
    const complete = completeWith({ bestTime: time - 0.5, mostCredits: 1 });
    expect(complete.newRecord).toEqual({ time: false, credits: true });
    expect(complete.record).toEqual({ bestTime: time - 0.5, mostCredits: 2 });
  });

  it("a slower run with fewer Credits is no new Record, and the Record stays as it was", () => {
    const { time } = plainRun();
    const complete = completeWith({ bestTime: time - 0.5, mostCredits: 3 });
    expect(complete.newRecord).toEqual({ time: false, credits: false });
    expect(complete.record).toEqual({ bestTime: time - 0.5, mostCredits: 3 });
  });

  it("a faster run with more Credits beats both", () => {
    const { time } = plainRun();
    const complete = completeWith({ bestTime: time + 1, mostCredits: 0 });
    expect(complete.newRecord).toEqual({ time: true, credits: true });
    expect(complete.record).toEqual({ bestTime: time, mostCredits: 2 });
  });

  it("the Level Complete screen has the Record and what was new", () => {
    const { game, complete } = runToExit(createGame(TO_EXIT, DEFAULT_SETTINGS, { bestTime: 99, mostCredits: 3 }));
    expect(game.record).toEqual({ bestTime: complete.time, mostCredits: 3 });
    expect(game.newRecord).toEqual({ time: true, credits: false });
  });

  it("before the Level is complete the Record is the previous one and nothing is new", () => {
    const game = createGame(TO_EXIT, DEFAULT_SETTINGS, { bestTime: 99, mostCredits: 3 });
    expect(game.record).toEqual({ bestTime: 99, mostCredits: 3 });
    expect(game.newRecord).toBeUndefined();
  });

  it("playing again is measured against the Record just set", () => {
    const first = runToExit(createGame(TO_EXIT, DEFAULT_SETTINGS));
    const again = step(first.game, { ...IDLE, startPressed: true }, DT).game;
    expect(again.newRecord).toBeUndefined();
    // Same run again: equal, so no new Record this time.
    const second = runToExit(again).complete;
    expect(second.newRecord).toEqual({ time: false, credits: false });
    expect(second.record).toEqual(first.complete.record);
  });

  it("equalling the Record is not beating it", () => {
    const { time } = plainRun();
    const complete = completeWith({ bestTime: time, mostCredits: 2 });
    expect(complete.newRecord).toEqual({ time: false, credits: false });
  });
});

import { describe, expect, it } from "vitest";
import { createGame, step, DT, DEFAULT_SETTINGS, type Game, type Input, type GameEvent, type LevelRecord } from "./index";

const IDLE: Input = { left: false, right: false, jump: false, jumpPressed: false };
const ENTER: Partial<Input> = { startPressed: true };
const PAUSE: Partial<Input> = { pausePressed: true };

function run(game: Game, ticks: number, input: Partial<Input> = {}) {
  const events: GameEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    const r = step(game, { ...IDLE, ...input }, DT);
    game = r.game;
    events.push(...r.events);
  }
  return { game, events };
}

const once = (game: Game, input: Partial<Input>) => run(game, 1, input);
const secs = (s: number) => Math.round(s * 120);

/** A flat corridor: Start on the left, nothing in the way. */
const CORRIDOR = ["..............", ".S............", "##############"].join("\n");

describe("Title screen", () => {
  it("a new game starts on the title screen, where the Runner doesn't move and no time passes", () => {
    const game = createGame(CORRIDOR, DEFAULT_SETTINGS);
    expect(game.phase).toBe("title");
    const { game: after, events } = run(game, secs(1), { right: true });
    expect(after.phase).toBe("title");
    expect(after.runner).toEqual(game.runner);
    expect(after.time).toBe(0);
    expect(events).toEqual([]);
  });

  it("Enter starts the Level: the Runner moves and the timer runs", () => {
    const started = once(createGame(CORRIDOR, DEFAULT_SETTINGS), ENTER).game;
    expect(started.phase).toBe("playing");
    const { game } = run(started, secs(1), { right: true });
    expect(game.runner.x).toBeGreaterThan(started.runner.x);
    expect(game.time).toBeCloseTo(1, 5);
  });
});

describe("Pause", () => {
  const playing = () => run(once(createGame(CORRIDOR, DEFAULT_SETTINGS), ENTER).game, secs(0.5), { right: true }).game;

  it("P or Esc pauses: a paused event, and the timer and Runner stop while paused", () => {
    const before = playing();
    const { game: paused, events } = once(before, PAUSE);
    expect(paused.phase).toBe("paused");
    expect(events).toEqual([{ type: "paused" }]);
    const { game: later, events: quiet } = run(paused, secs(2), { right: true, jump: true, jumpPressed: true });
    expect(quiet).toEqual([]);
    expect(later.time).toBe(before.time);
    expect(later.runner).toEqual(before.runner);
  });

  it("pressing it again resumes, and the timer carries on from where it stopped", () => {
    const before = playing();
    const paused = run(once(before, PAUSE).game, secs(2)).game;
    const { game: resumed, events } = once(paused, PAUSE);
    expect(resumed.phase).toBe("playing");
    expect(events).toEqual([{ type: "resumed" }]);
    const { game } = run(resumed, secs(1), { right: true });
    expect(game.time).toBeCloseTo(before.time + 1, 5);
    expect(game.runner.x).toBeGreaterThan(before.runner.x);
  });

  it("a paused game ignores Enter", () => {
    const paused = once(playing(), PAUSE).game;
    expect(once(paused, ENTER).game.phase).toBe("paused");
  });

  it("the title screen can't be paused", () => {
    const { game, events } = once(createGame(CORRIDOR, DEFAULT_SETTINGS), PAUSE);
    expect(game.phase).toBe("title");
    expect(events).toEqual([]);
  });
});

/** Step with `input` until an event of `type` happens (or fail after `maxSecs`). */
function runUntil(game: Game, type: GameEvent["type"], input: Partial<Input> = {}, maxSecs = 5) {
  const events: GameEvent[] = [];
  for (let i = 0; i < secs(maxSecs); i++) {
    const r = step(game, { ...IDLE, ...input }, DT);
    game = r.game;
    events.push(...r.events);
    if (r.events.some((e) => e.type === type)) return { game, events };
  }
  throw new Error(`no ${type} event within ${maxSecs} s`);
}

/** Start, two Credits on the way, one up high out of reach, then the Exit. */
const TO_EXIT = [
  "....C.........",
  "..............",
  "..............",
  ".S..C..C....E.",
  "##############",
].join("\n");

describe("Exit and Level Complete", () => {
  const start = (record?: LevelRecord) => once(createGame(TO_EXIT, DEFAULT_SETTINGS, record), ENTER).game;

  it("reaching the Exit gives Level Complete with the time and the Credits collected out of the total", () => {
    const { game, events } = runUntil(start(), "level-complete", { right: true });
    expect(game.phase).toBe("complete");
    const complete = events.find((e) => e.type === "level-complete");
    // The Record fields of this event are covered in record.test.ts.
    expect(complete).toMatchObject({ type: "level-complete", time: game.time, collected: 2, total: 3 });
    // About 11 tiles at up to 9 tiles/s: a little over a second.
    expect(game.time).toBeGreaterThan(1);
    expect(game.time).toBeLessThan(2);
  });

  it("the Runner only completes the Level by touching the Exit", () => {
    const { game, events } = run(start(), secs(0.5), { right: true });
    expect(game.phase).toBe("playing");
    expect(events.map((e) => e.type)).not.toContain("level-complete");
  });

  it("the timer stops at the Exit and the world is frozen on the Level Complete screen", () => {
    const done = runUntil(start(), "level-complete", { right: true }).game;
    const { game, events } = run(done, secs(2), { left: true, jump: true, jumpPressed: true, pausePressed: true });
    expect(events).toEqual([]);
    expect(game.time).toBe(done.time);
    expect(game.runner).toEqual(done.runner);
    expect(game.phase).toBe("complete");
  });

  it("Enter on the Level Complete screen plays again from a fresh start, straight into play", () => {
    const done = runUntil(start(), "level-complete", { right: true }).game;
    const { game: again, events } = once(done, ENTER);
    expect(events).toEqual([{ type: "level-restarted" }]);
    // Runner at Start, every Credit back, timer at 0, playing (no title screen in between), keeping the Record just set.
    expect(again).toEqual(start(done.record));
    const { game } = run(again, secs(0.5), { right: true });
    expect(game.time).toBeCloseTo(0.5, 5);
  });

  it("a Level without an Exit can't be completed", () => {
    const { events } = run(once(createGame(CORRIDOR, DEFAULT_SETTINGS), ENTER).game, secs(3), { right: true });
    expect(events.map((e) => e.type)).not.toContain("level-complete");
  });
});

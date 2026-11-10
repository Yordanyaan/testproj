import { describe, expect, it } from "vitest";
import { createGame, step, DT, TILE, DEFAULT_SETTINGS, type Game, type Input, type GameEvent } from "./index";
import { TEST_LEVEL } from "../levels/test-level";

// Runner size from the spec: 12×24 px.
const RUNNER_W = 12;
const RUNNER_H = 24;
const IDLE: Input = { left: false, right: false, jump: false, jumpPressed: false };

/** Run `ticks` fixed steps with the same input; collect every event. */
function run(game: Game, ticks: number, input: Partial<Input> = {}) {
  const events: GameEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    const r = step(game, { ...IDLE, ...input }, DT);
    game = r.game;
    events.push(...r.events);
  }
  return { game, events };
}

const secs = (s: number) => Math.round(s * 120);
const feet = (g: Game) => g.runner.y + RUNNER_H;

describe("Level and Start", () => {
  it("places the Runner at Start, standing on the ground below it", () => {
    const level = [
      "......",
      "..S...",
      "######",
    ].join("\n");
    let game = createGame(level, DEFAULT_SETTINGS);
    ({ game } = run(game, 10));
    expect(game.runner.grounded).toBe(true);
    expect(feet(game)).toBe(2 * TILE);
    expect(game.runner.x).toBeGreaterThanOrEqual(2 * TILE);
    expect(game.runner.x).toBeLessThan(3 * TILE);
  });

  it("below the bottom row is open: with no ground, the Runner falls out of the Level", () => {
    const level = ["......", "..S...", "##...."].join("\n");
    let game = createGame(level, DEFAULT_SETTINGS);
    const events: GameEvent[] = [];
    while (game.runner.y <= 3 * TILE) {
      const r = step(game, IDLE, DT);
      game = r.game;
      events.push(...r.events);
    }
    expect(game.runner.grounded).toBe(false);
    expect(events).toEqual([]);
  });

  it("the shipped test Level loads and the Runner lands on its ground", () => {
    const { game, events } = run(createGame(TEST_LEVEL, DEFAULT_SETTINGS), secs(0.5));
    expect(game.runner.grounded).toBe(true);
    expect(events.map((e) => e.type)).toEqual(["land"]);
  });

  it("rejects a Level without a Start", () => {
    expect(() => createGame(["....", "####"].join("\n"), DEFAULT_SETTINGS)).toThrow(/Start/);
  });
});

/** Open room 10 tiles tall: plenty of headroom. Floor top is at row 10. */
const ROOM = [
  "........",
  "........",
  "........",
  "........",
  "........",
  "........",
  "........",
  "........",
  "........",
  "...S....",
  "########",
].join("\n");

/** Settle on the floor, then jump: hold Space for `holdTicks`, release, and track the highest feet point. */
function jumpAndMeasure(level: string, holdTicks: number) {
  let { game } = run(createGame(level, DEFAULT_SETTINGS), 5);
  const floor = feet(game);
  let highest = floor;
  const events: GameEvent[] = [];
  for (let i = 0; i < secs(2); i++) {
    const held = i < holdTicks;
    const r = step(game, { ...IDLE, jump: held, jumpPressed: i === 0 }, DT);
    game = r.game;
    events.push(...r.events);
    highest = Math.min(highest, feet(game));
  }
  return { game, events, heightTiles: (floor - highest) / TILE };
}

describe("Jumping", () => {
  it("holding Space jumps about 4.2 tiles high", () => {
    const { heightTiles, events } = jumpAndMeasure(ROOM, secs(2));
    expect(heightTiles).toBeGreaterThan(4.1);
    expect(heightTiles).toBeLessThan(4.3);
    expect(events.map((e) => e.type)).toEqual(["jump", "land"]);
  });

  it("tapping Space gives a much smaller hop", () => {
    const { heightTiles, events } = jumpAndMeasure(ROOM, 1);
    expect(heightTiles).toBeGreaterThan(0.5);
    expect(heightTiles).toBeLessThan(4.2 / 2);
    expect(events.map((e) => e.type)).toEqual(["jump", "land"]);
  });
});

describe("Jump grace windows", () => {
  /** A ledge with lower ground beyond it. */
  const LEDGE = [
    "..............",
    "..............",
    "..............",
    ".S............",
    "#####.........",
    "#####.........",
    "#####.........",
    "##############",
  ].join("\n");

  /** Run right off the ledge, then press jump `ticksAfter` ticks after leaving the ground. */
  function jumpAfterLeavingLedge(ticksAfter: number) {
    let { game } = run(createGame(LEDGE, DEFAULT_SETTINGS), 5);
    while (game.runner.grounded) game = step(game, { ...IDLE, right: true }, DT).game;
    ({ game } = run(game, ticksAfter - 1, { right: true }));
    return step(game, { ...IDLE, right: true, jump: true, jumpPressed: true }, DT).events;
  }

  it("late-jump grace: a jump 0.08 s after leaving a ledge still happens", () => {
    expect(jumpAfterLeavingLedge(secs(0.08)).map((e) => e.type)).toContain("jump");
  });

  it("late-jump grace: a jump 0.12 s after leaving a ledge does not", () => {
    expect(jumpAfterLeavingLedge(secs(0.12)).map((e) => e.type)).not.toContain("jump");
  });

  /** The Runner starts in the air, five tiles above the floor. */
  const DROP = ["...S....", "........", "........", "........", "........", "........", "########"].join("\n");

  /** Fall, pressing jump `ticksBefore` ticks before the landing tick; report what happens just after. */
  function jumpBeforeLanding(ticksBefore: number) {
    const start = createGame(DROP, DEFAULT_SETTINGS);
    let landingTick = 0;
    for (let g = start; !g.runner.grounded; landingTick++) g = step(g, IDLE, DT).game;
    let game = start;
    const events: GameEvent[] = [];
    for (let i = 0; i < landingTick + secs(0.05); i++) {
      const pressed = i === landingTick - ticksBefore;
      const r = step(game, { ...IDLE, jump: pressed, jumpPressed: pressed }, DT);
      game = r.game;
      events.push(...r.events);
    }
    return events.map((e) => e.type);
  }

  it("early-jump memory: a jump pressed 0.08 s before landing happens on landing", () => {
    expect(jumpBeforeLanding(secs(0.08))).toEqual(["land", "jump"]);
  });

  it("early-jump memory: a jump pressed 0.12 s before landing is forgotten", () => {
    expect(jumpBeforeLanding(secs(0.12))).toEqual(["land"]);
  });
});

describe("Solid tiles", () => {
  it("walls block the Runner", () => {
    const level = ["......#.", "..S...#.", "########"].join("\n");
    const { game } = run(createGame(level, DEFAULT_SETTINGS), secs(1), { right: true });
    expect(game.runner.x + RUNNER_W).toBe(6 * TILE);
    expect(game.runner.vx).toBe(0);
  });

  it("the Level's left and right edges are solid", () => {
    const level = ["....", ".S..", "####"].join("\n");
    let { game } = run(createGame(level, DEFAULT_SETTINGS), secs(1), { left: true });
    expect(game.runner.x).toBe(0);
    ({ game } = run(game, secs(1), { right: true }));
    expect(game.runner.x + RUNNER_W).toBe(4 * TILE);
  });

  it("a ceiling stops the Runner rising", () => {
    // The ceiling's underside is 3 tiles above the floor; the Runner is 1.5 tiles tall.
    const level = ["######", "......", "......", "..S...", "######"].join("\n");
    let { game } = run(createGame(level, DEFAULT_SETTINGS), 5);
    let highestTop = game.runner.y;
    for (let i = 0; i < secs(1); i++) {
      game = step(game, { ...IDLE, jump: true, jumpPressed: i === 0 }, DT).game;
      highestTop = Math.min(highestTop, game.runner.y);
    }
    expect(highestTop).toBe(1 * TILE);
    expect(game.runner.grounded).toBe(true);
  });

  it("the Runner jumps onto a platform and stands on it", () => {
    const level = [
      "..........",
      "..........",
      "..........",
      "..........",
      "..........",
      "..........",
      ".....#####",
      "..........",
      ".S........",
      "##########",
    ].join("\n");
    let { game } = run(createGame(level, DEFAULT_SETTINGS), 10);
    const events: GameEvent[] = [];
    for (let i = 0; i < secs(1.5); i++) {
      const r = step(game, { ...IDLE, right: true, jump: true, jumpPressed: i === 0 }, DT);
      game = r.game;
      events.push(...r.events);
    }
    expect(game.runner.grounded).toBe(true);
    expect(feet(game)).toBe(6 * TILE);
    expect(events.map((e) => e.type)).toEqual(["jump", "land"]);
  });
});

describe("Camera", () => {
  // 100 tiles = 1600 px wide; the view is 640 px (40 tiles).
  const WIDE = [".".repeat(100), ".S" + ".".repeat(98), "#".repeat(100)].join("\n");

  it("does not scroll past the left edge at the Start", () => {
    const { game } = run(createGame(WIDE, DEFAULT_SETTINGS), 5);
    expect(game.camera.x).toBe(0);
  });

  it("follows the Runner sideways, keeping them centred", () => {
    let { game } = run(createGame(WIDE, DEFAULT_SETTINGS), 5);
    while (game.runner.x < 50 * TILE) game = step(game, { ...IDLE, right: true }, DT).game;
    const runnerCentre = game.runner.x + RUNNER_W / 2;
    expect(game.camera.x).toBeCloseTo(runnerCentre - 320, 5);
  });

  it("does not scroll past the right edge", () => {
    const { game } = run(createGame(WIDE, DEFAULT_SETTINGS), secs(15), { right: true });
    expect(game.runner.x + RUNNER_W).toBe(1600);
    expect(game.camera.x).toBe(1600 - 640);
  });
});

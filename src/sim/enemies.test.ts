import { describe, expect, it } from "vitest";
import {
  createGame,
  step,
  DT,
  TILE,
  RUNNER_H,
  DEFAULT_SETTINGS,
  inRecovery,
  type Game,
  type GameEvent,
  type Input,
} from "./index";

const IDLE: Input = { left: false, right: false, jump: false, jumpPressed: false };
const secs = (s: number) => Math.round(s * 120);

function run(game: Game, ticks: number, input: Partial<Input> = {}) {
  const events: GameEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    const r = step(game, { ...IDLE, ...input }, DT);
    game = r.game;
    events.push(...r.events);
  }
  return { game, events };
}

describe("Patrol Bots", () => {
  it("`P` in the Level grid places a Patrol Bot standing on the ground of its tile", () => {
    const level = ["S.....P...", "##########"].join("\n");
    const game = createGame(level, DEFAULT_SETTINGS);
    expect(game.enemies).toHaveLength(1);
    const bot = game.enemies[0];
    expect(bot.kind).toBe("patrol-bot");
    expect(bot.y + bot.h).toBe(1 * TILE);
    expect(bot.x).toBeGreaterThanOrEqual(6 * TILE);
    expect(bot.x + bot.w).toBeLessThanOrEqual(7 * TILE);
  });

  /** Where the first Enemy goes over `seconds`: its leftmost x and rightmost right edge, and every y. */
  function patrolRange(level: string, seconds: number) {
    let game = createGame(level, DEFAULT_SETTINGS);
    let minX = Infinity;
    let maxRight = -Infinity;
    const ys = new Set<number>();
    for (let i = 0; i < secs(seconds); i++) {
      game = step(game, IDLE, DT).game;
      const bot = game.enemies[0];
      minX = Math.min(minX, bot.x);
      maxRight = Math.max(maxRight, bot.x + bot.w);
      ys.add(bot.y);
    }
    return { minX, maxRight, ys: [...ys] };
  }

  it("walks back and forth between two walls, turning at each", () => {
    // Walls at columns 1 and 8: the bot has columns 2–7 (x 32 to 128) to walk in.
    const level = [
      "S#.....P#.",
      "##########",
    ].join("\n");
    const { minX, maxRight, ys } = patrolRange(level, 12);
    expect(minX).toBeGreaterThanOrEqual(2 * TILE);
    expect(minX).toBeLessThan(2 * TILE + 2);
    expect(maxRight).toBeLessThanOrEqual(8 * TILE);
    expect(maxRight).toBeGreaterThan(8 * TILE - 2);
    expect(ys).toEqual([TILE - 14]);
  });

  it("walks back and forth on a floating platform, turning at both edges instead of walking off", () => {
    // Platform at columns 3–7 (x 48 to 128), open air on both sides.
    const level = [
      "S.....P....",
      "...#####...",
      "...........",
      "##.........",
    ].join("\n");
    const { minX, maxRight, ys } = patrolRange(level, 12);
    expect(minX).toBeGreaterThanOrEqual(3 * TILE);
    expect(minX).toBeLessThan(3 * TILE + 2);
    expect(maxRight).toBeLessThanOrEqual(8 * TILE);
    expect(maxRight).toBeGreaterThan(8 * TILE - 2);
    expect(ys).toEqual([TILE - 14]);
  });
});

/** Run until an event of `type` happens (or give up after `maxSecs`). */
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

/**
 * The Runner starts in the air and drops straight onto a Patrol Bot that is boxed into its one tile (row 4).
 * Open sky above, so bounces are never cut short by a ceiling.
 */
const DROP_ON_BOT = [
  "...",
  ".S.",
  "...",
  "...",
  "#P#",
  "###",
].join("\n");

describe("Stomp", () => {
  it("landing on a Patrol Bot from above defeats it: it disappears and a stomp event fires", () => {
    const { game, events } = runUntil(createGame(DROP_ON_BOT, DEFAULT_SETTINGS), "stomp");
    expect(events.map((e) => e.type)).toEqual(["stomp"]);
    expect(game.enemies).toEqual([]);
    expect(game.health).toBe(3);
    expect(game.runner.vy).toBeLessThan(0);
  });

  /** How high the Runner rises after the Stomp, in tiles. */
  function bounceHeight(input: Partial<Input>) {
    let { game } = runUntil(createGame(DROP_ON_BOT, DEFAULT_SETTINGS), "stomp", input);
    const from = game.runner.y;
    let top = from;
    while (game.runner.vy < 0) {
      game = step(game, { ...IDLE, ...input }, DT).game;
      top = Math.min(top, game.runner.y);
    }
    return (from - top) / TILE;
  }

  it("bounces the Runner about 5.5 tiles with Space held", () => {
    expect(bounceHeight({ jump: true })).toBeCloseTo(5.5, 0);
  });

  it("bounces the Runner about 2 tiles without Space", () => {
    expect(bounceHeight({})).toBeCloseTo(2, 0);
  });

  /** The bot in DROP_ON_BOT, with the Runner placed so their feet are at `feet` px and moving at `vy` px/s. */
  function runnerAt(feet: number, vy: number): Game {
    const game = createGame(DROP_ON_BOT, DEFAULT_SETTINGS);
    return { ...game, runner: { ...game.runner, y: feet - RUNNER_H, vy, grounded: false } };
  }
  const botMiddle = (game: Game) => game.enemies[0].y + game.enemies[0].h / 2;

  it("corner case: falling with the feet exactly at the Enemy's middle before the tick is still a Stomp", () => {
    const game = createGame(DROP_ON_BOT, DEFAULT_SETTINGS);
    const { events } = step(runnerAt(botMiddle(game), 60), IDLE, DT);
    expect(events.map((e) => e.type)).toEqual(["stomp"]);
  });

  it("corner case: falling with the feet just below the Enemy's middle is a Hit", () => {
    const game = createGame(DROP_ON_BOT, DEFAULT_SETTINGS);
    const { events } = step(runnerAt(botMiddle(game) + 0.5, 60), IDLE, DT);
    expect(events.map((e) => e.type)).toEqual(["hit"]);
  });

  it("contact while moving up (from below) is a Hit, even with the feet above the Enemy's middle", () => {
    const game = createGame(DROP_ON_BOT, DEFAULT_SETTINGS);
    const { events } = step(runnerAt(botMiddle(game) - 2, -100), IDLE, DT);
    expect(events.map((e) => e.type)).toEqual(["hit"]);
  });
});

/** Flat ground; the Runner on the left, a Patrol Bot walking towards them, a wall at the far right. */
const FLAT = ["S........P#", "###########"].join("\n");

describe("Hit", () => {
  it("walking into a Patrol Bot from the side is a Hit: −1 Health, Recovery, and a hit event", () => {
    const { game, events } = runUntil(createGame(FLAT, DEFAULT_SETTINGS), "hit", { right: true });
    expect(events.filter((e) => e.type === "hit")).toEqual([{ type: "hit", health: 2 }]);
    expect(game.health).toBe(2);
    expect(inRecovery(game)).toBe(true);
    expect(game.enemies).toHaveLength(1); // a Hit does not defeat the Enemy
  });

  it("knocks the Runner away from the Enemy at 6 tiles/s with a small hop", () => {
    const { game } = runUntil(createGame(FLAT, DEFAULT_SETTINGS), "hit", { right: true });
    expect(game.runner.vx).toBeCloseTo(-6 * TILE);
    expect(game.runner.vy).toBeLessThan(0);
    expect(game.runner.grounded).toBe(false);
  });

  it("knocks the Runner the other way when the Enemy is on their left", () => {
    const level = ["#P........S", "###########"].join("\n");
    const { game } = runUntil(createGame(level, DEFAULT_SETTINGS), "hit", { left: true });
    expect(game.runner.vx).toBeCloseTo(6 * TILE);
  });

  it("ignores input for the first 0.2 s so the knockback plays out, then steering works again", () => {
    let { game } = runUntil(createGame(FLAT, DEFAULT_SETTINGS), "hit", { right: true });
    const pushy = { right: true, jump: true, jumpPressed: true };
    const events: GameEvent[] = [];
    for (let i = 0; i < secs(0.19); i++) {
      const r = step(game, { ...IDLE, ...pushy }, DT);
      expect(r.game.runner.x).toBeLessThanOrEqual(game.runner.x);
      events.push(...r.events);
      game = r.game;
    }
    expect(events.map((e) => e.type)).not.toContain("jump");
    const before = game.runner.x;
    game = run(game, secs(0.2), { right: true }).game;
    expect(game.runner.x).toBeGreaterThan(before);
  });
});

describe("Recovery and Level Failed from Hits", () => {
  // A short stretch, so the Patrol Bot keeps coming back to the Runner pressed against the right wall.
  const SHORT = ["S...P#", "######"].join("\n");

  it("no Hit can land during Recovery: pushing on into the Patrol Bot costs nothing for 1 s", () => {
    const hit = runUntil(createGame(SHORT, DEFAULT_SETTINGS), "hit", { right: true }).game;
    const { game, events } = run(hit, secs(0.95), { right: true });
    expect(events.map((e) => e.type)).not.toContain("hit");
    expect(game.health).toBe(2);
  });

  it("once Recovery is over, the next touch is a Hit again", () => {
    const hit = runUntil(createGame(SHORT, DEFAULT_SETTINGS), "hit", { right: true }).game;
    const { game } = runUntil(hit, "hit", { right: true });
    expect(game.health).toBe(1);
  });

  it("the third Hit brings Health to 0 and the Level is Failed", () => {
    const { game, events } = runUntil(createGame(SHORT, DEFAULT_SETTINGS), "level-failed", { right: true }, 10);
    expect(events.filter((e) => e.type === "hit")).toEqual([
      { type: "hit", health: 2 },
      { type: "hit", health: 1 },
      { type: "hit", health: 0 },
    ]);
    expect(game.phase).toBe("failed");
  });

  it("a Stomped Patrol Bot comes back when the Level restarts", () => {
    // Drop onto a bot on a one-tile platform, then walk off into the Pit until the Level is Failed.
    const level = [
      ".S...",
      ".....",
      ".P...",
      ".#...",
      ".....",
    ].join("\n");
    let { game } = runUntil(createGame(level, DEFAULT_SETTINGS), "stomp");
    expect(game.enemies).toEqual([]);
    game = runUntil(game, "land").game;
    game = runUntil(game, "level-failed", { right: true }, 20).game;
    game = runUntil(game, "level-restarted").game;
    expect(game.enemies).toHaveLength(1);
    expect(game).toEqual(createGame(level, DEFAULT_SETTINGS));
  });
});

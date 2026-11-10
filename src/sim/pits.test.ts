import { describe, expect, it } from "vitest";
import {
  createGame,
  step,
  inRecovery,
  runnerVisible,
  DT,
  TILE,
  RUNNER_W,
  DEFAULT_SETTINGS,
  type Game,
  type Input,
  type GameEvent,
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

/** Step with `input` until an event of `type` happens (or give up after `maxSecs`). */
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

/** A platform from column 0 to 5 (ending at x = 96 px) with a Pit to its right. */
const LEDGE = [
  "..........",
  "..........",
  ".S........",
  "######....",
].join("\n");

describe("Pits", () => {
  it("the Runner starts with 3 Health", () => {
    expect(createGame(LEDGE, DEFAULT_SETTINGS).health).toBe(3);
  });

  it("falling below the Level is a Pit fall: −1 Health and a pit-fall event", () => {
    const { game, events } = runUntil(createGame(LEDGE, DEFAULT_SETTINGS), "pit-fall", { right: true });
    expect(events.map((e) => e.type)).toEqual(["land", "pit-fall"]);
    expect(game.health).toBe(2);
  });
});

describe("Recovery", () => {
  it("is not active at the start", () => {
    const game = createGame(LEDGE, DEFAULT_SETTINGS);
    expect(inRecovery(game)).toBe(false);
    expect(runnerVisible(game)).toBe(true);
  });

  it("starts with a Pit fall and lasts 1 s", () => {
    const fell = runUntil(createGame(LEDGE, DEFAULT_SETTINGS), "pit-fall", { right: true }).game;
    expect(inRecovery(fell)).toBe(true);
    expect(inRecovery(run(fell, secs(0.98)).game)).toBe(true);
    expect(inRecovery(run(fell, secs(1.02)).game)).toBe(false);
  });

  it("the Runner blinks during Recovery and is steadily visible after it", () => {
    let game = runUntil(createGame(LEDGE, DEFAULT_SETTINGS), "pit-fall", { right: true }).game;
    const during = new Set<boolean>();
    for (let i = 0; i < secs(0.98); i++) {
      game = step(game, IDLE, DT).game;
      during.add(runnerVisible(game));
    }
    expect([...during].sort()).toEqual([false, true]);
    game = run(game, secs(0.05)).game;
    for (let i = 0; i < secs(0.5); i++) {
      game = step(game, IDLE, DT).game;
      expect(runnerVisible(game)).toBe(true);
    }
  });

  it("a Pit fall during Recovery puts the Runner back but costs no Health and does not restart Recovery", () => {
    // No ground under the Start: the Runner falls straight into the Pit, again and again (each fall well under 1 s).
    const level = ["..S..", ".....", "....."].join("\n");
    let { game } = runUntil(createGame(level, DEFAULT_SETTINGS), "pit-fall");
    const start = createGame(level, DEFAULT_SETTINGS).runner;
    const recoveryBefore = game.recovery;
    const r = runUntil(game, "pit-fall");
    game = r.game;
    expect(r.events).toEqual([{ type: "pit-fall", health: 2 }]);
    expect(game.health).toBe(2);
    expect(game.runner.x).toBe(start.x);
    expect(game.runner.y).toBe(start.y);
    expect(inRecovery(game)).toBe(true);
    expect(game.recovery).toBeLessThan(recoveryBefore);
  });

  it("the first Pit fall after Recovery is over costs Health again", () => {
    const level = ["..S..", ".....", "....."].join("\n");
    const { events } = runUntil(createGame(level, DEFAULT_SETTINGS), "level-failed", {}, 10);
    const healths = events.flatMap((e) => (e.type === "pit-fall" ? [e.health] : []));
    expect(healths[0]).toBe(2);
    expect(healths.at(-1)).toBe(0);
    expect(healths.length).toBeGreaterThan(3); // some falls landed during Recovery and were free
  });
});

describe("Level Failed", () => {
  // No ground under the Start: every fall is a Pit fall.
  const FALLING = ["..S..", ".....", "....."].join("\n");

  /** Keep falling until the Level is Failed. Falls during Recovery are free, so it takes more than three. */
  const failLevel = () => runUntil(createGame(FALLING, DEFAULT_SETTINGS), "level-failed", {}, 10);

  it("the third Pit fall that costs Health brings it to 0 and the Level is Failed", () => {
    const { game, events } = failLevel();
    const healths = events.flatMap((e) => (e.type === "pit-fall" ? [e.health] : []));
    expect([...new Set(healths)]).toEqual([2, 1, 0]);
    expect(events.slice(-2)).toEqual([{ type: "pit-fall", health: 0 }, { type: "level-failed" }]);
    expect(game.health).toBe(0);
    expect(game.phase).toBe("failed");
  });

  it("while Failed, the Runner is frozen and nothing happens for a moment", () => {
    const failed = failLevel().game;
    const { game, events } = run(failed, secs(1), { right: true, jump: true, jumpPressed: true });
    expect(events).toEqual([]);
    expect(game.phase).toBe("failed");
    expect(game.runner).toEqual(failed.runner);
  });

  it("shortly after, the Level restarts from the beginning with everything reset", () => {
    let game = failLevel().game;
    const events: GameEvent[] = [];
    let ticks = 0;
    while (game.phase === "failed" && ticks < secs(5)) {
      const r = step(game, IDLE, DT);
      game = r.game;
      events.push(...r.events);
      ticks++;
    }
    expect(ticks).toBeLessThan(secs(3));
    expect(events.map((e) => e.type)).toEqual(["level-restarted"]);
    expect(game.phase).toBe("playing");
    expect(game.health).toBe(3);
    expect(inRecovery(game)).toBe(false);
    // Everything else (Runner, last solid ground, camera, ...) is as on a fresh start.
    expect(game).toEqual(createGame(FALLING, DEFAULT_SETTINGS));
  });

  it("a restarted Level is reset after a run that went further (Runner back at the Start)", () => {
    let game = createGame(LEDGE, DEFAULT_SETTINGS);
    game = runUntil(game, "level-failed", { right: true }, 10).game;
    game = runUntil(game, "level-restarted").game;
    expect(game).toEqual(createGame(LEDGE, DEFAULT_SETTINGS));
  });

  it("Credits collected before the Level was Failed are back after the restart", () => {
    const level = ["..........", ".S.C.C....", "######...."].join("\n");
    let { game, events } = runUntil(createGame(level, DEFAULT_SETTINGS), "level-failed", { right: true }, 10);
    expect(events.filter((e) => e.type === "credit-collected")).toHaveLength(2);
    expect(game.phase).toBe("failed");
    game = runUntil(game, "level-restarted").game;
    expect(game.credits.collected).toBe(0);
    expect(game.credits.remaining).toHaveLength(2);
  });
});

describe("Last solid ground", () => {
  const feet = (g: Game) => g.runner.y + 24;

  it("after a Pit fall the Runner is back on the last ground fully under both feet, not past the edge", () => {
    // Running right at top speed: the edge of the platform is at x = 96 px.
    const { game } = runUntil(createGame(LEDGE, DEFAULT_SETTINGS), "pit-fall", { right: true });
    expect(feet(game)).toBe(3 * TILE);
    expect(game.runner.x + RUNNER_W).toBeLessThanOrEqual(6 * TILE);
    expect(game.runner.x + RUNNER_W).toBeGreaterThan(6 * TILE - 4); // the last ground, not the Start
    expect(game.runner.vx).toBe(0);
    expect(game.runner.vy).toBe(0);
  });

  it("standing still after being put back, the Runner stays on the ground and does not fall again", () => {
    let { game } = runUntil(createGame(LEDGE, DEFAULT_SETTINGS), "pit-fall", { right: true });
    const after = run(game, secs(1));
    game = after.game;
    expect(game.runner.grounded).toBe(true);
    expect(after.events.map((e) => e.type)).not.toContain("pit-fall");
    expect(game.health).toBe(2);
  });

  it("ground with one foot over the edge does not count: walking slowly off still returns fully on the platform", () => {
    // Nudge right in short taps so the Runner creeps over the edge.
    let game = run(createGame(LEDGE, DEFAULT_SETTINGS), secs(0.3)).game;
    const events: GameEvent[] = [];
    for (let i = 0; i < 400 && !events.some((e) => e.type === "pit-fall"); i++) {
      const r = run(game, 2, { right: true });
      events.push(...r.events);
      const rest = run(r.game, secs(0.1));
      events.push(...rest.events);
      game = rest.game;
    }
    expect(events.map((e) => e.type)).toContain("pit-fall");
    expect(game.runner.x).toBeGreaterThanOrEqual(0);
    expect(game.runner.x + RUNNER_W).toBeLessThanOrEqual(6 * TILE + 0.01); // collision tolerance
    expect(feet(game)).toBe(3 * TILE);
  });

  it("the last solid ground moves on with the Runner to a later platform", () => {
    // Platform A (row 1, cols 0–3), lower platform B (row 2, cols 4–7, edge at x = 128 px), then a Pit.
    const level = [
      ".S..........",
      "####........",
      "....####....",
    ].join("\n");
    const { game } = runUntil(createGame(level, DEFAULT_SETTINGS), "pit-fall", { right: true });
    expect(feet(game)).toBe(2 * TILE);
    expect(game.runner.x).toBeGreaterThanOrEqual(4 * TILE);
    expect(game.runner.x + RUNNER_W).toBeLessThanOrEqual(8 * TILE);
  });
});

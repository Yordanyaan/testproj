import { describe, expect, it } from "vitest";
import { createGame, step, DT, DEFAULT_SETTINGS, type Game, type Input, type GameEvent } from "./index";

const IDLE: Input = { left: false, right: false, jump: false, jumpPressed: false };

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

describe("Credits", () => {
  it("the total is counted from the Level's C tiles, and none are collected at the start", () => {
    const level = ["C.....C.", "..S...C.", "########"].join("\n");
    const game = createGame(level, DEFAULT_SETTINGS);
    expect(game.credits.total).toBe(3);
    expect(game.credits.collected).toBe(0);
  });

  it("touching a Credit collects it: it disappears, the counter goes up, and an event is emitted", () => {
    // The Credit sits at Runner height, five tiles to the right of the Start.
    const level = ["..........", ".S....C...", "##########"].join("\n");
    let game = createGame(level, DEFAULT_SETTINGS);
    expect(game.credits.remaining).toHaveLength(1);
    const { game: after, events } = run(game, secs(1), { right: true });
    expect(after.credits.collected).toBe(1);
    expect(after.credits.remaining).toEqual([]);
    expect(events.filter((e) => e.type === "credit-collected")).toEqual([
      { type: "credit-collected", collected: 1, total: 1 },
    ]);
  });

  it("each Credit counts only once, even when the Runner passes its spot again", () => {
    const level = ["..........", ".S...C....", "##########"].join("\n");
    let { game, events } = run(createGame(level, DEFAULT_SETTINGS), secs(1), { right: true });
    const back = run(game, secs(1), { left: true });
    const again = run(back.game, secs(1), { right: true });
    const all = [...events, ...back.events, ...again.events];
    expect(all.filter((e) => e.type === "credit-collected")).toHaveLength(1);
    expect(again.game.credits.collected).toBe(1);
  });

  it("collecting several Credits counts each one up to the total", () => {
    const level = ["............", ".S..C.C..C..", "############"].join("\n");
    const { game, events } = run(createGame(level, DEFAULT_SETTINGS), secs(2), { right: true });
    expect(events.filter((e) => e.type === "credit-collected")).toEqual([
      { type: "credit-collected", collected: 1, total: 3 },
      { type: "credit-collected", collected: 2, total: 3 },
      { type: "credit-collected", collected: 3, total: 3 },
    ]);
    expect(game.credits).toMatchObject({ collected: 3, total: 3, remaining: [] });
  });

  it("a Credit out of reach is not collected", () => {
    // The Credit floats high above the floor; the Runner only walks underneath it.
    const level = ["......C...", "..........", "..........", "..........", ".S........", "##########"].join("\n");
    const { game, events } = run(createGame(level, DEFAULT_SETTINGS), secs(1), { right: true });
    expect(game.credits.collected).toBe(0);
    expect(game.credits.remaining).toHaveLength(1);
    expect(events.map((e) => e.type)).not.toContain("credit-collected");
  });
});

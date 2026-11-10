import { TILE } from "./constants";

/** A parsed Level: a solid/empty tile grid plus the Start tile. */
export interface Level {
  cols: number;
  rows: number;
  /** solid[row][col] */
  solid: readonly (readonly boolean[])[];
  start: { col: number; row: number };
  /** Tiles holding a Credit (`C`), in reading order. */
  credits: readonly { col: number; row: number }[];
}

/**
 * Parse a Level text grid, one character per tile.
 * `#` solid; `S` Start; `C` Credit (an empty tile holding a Credit); anything else (`.`, space, not-yet-supported things) is empty.
 * Rows shorter than the widest row are padded with empty tiles.
 */
export function parseLevel(text: string): Level {
  const lines = text.replace(/\r/g, "").split("\n");
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
  const rows = lines.length;
  const cols = Math.max(0, ...lines.map((l) => l.length));
  let start: Level["start"] | null = null;
  const credits: { col: number; row: number }[] = [];
  const solid = lines.map((line, row) => {
    const out: boolean[] = [];
    for (let col = 0; col < cols; col++) {
      const ch = line[col] ?? ".";
      if (ch === "S") {
        if (start) throw new Error("Level has more than one Start (S)");
        start = { col, row };
      }
      if (ch === "C") credits.push({ col, row });
      out.push(ch === "#");
    }
    return out;
  });
  if (!start) throw new Error("Level has no Start (S)");
  return { cols, rows, solid, start, credits };
}

/** Left and right of the Level are solid; above and below (Pits) are open. */
export function isSolid(level: Level, col: number, row: number): boolean {
  if (col < 0 || col >= level.cols) return true;
  if (row < 0 || row >= level.rows) return false;
  return level.solid[row][col];
}

export const levelWidth = (level: Level) => level.cols * TILE;
export const levelHeight = (level: Level) => level.rows * TILE;

// Thin renderer: draws game state with simple shapes at 640×360.
// Kept separate from the rules so code-drawn shapes can later be swapped for sprites.
import { isSolid, RUNNER_H, RUNNER_W, TILE, VIEW_H, VIEW_W, type Game } from "../sim";

const COLORS = {
  sky: "#120a1f",
  tile: "#2a1840",
  tileEdge: "#ff2fa8",
  runner: "#1b1b2e",
  visor: "#38f3ff",
};

export interface Renderer {
  draw(game: Game): void;
}

/** Set up a 640×360 canvas scaled to fit the window (crisp pixels via CSS; black bars from the page background). */
export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas not supported");

  const fit = () => {
    const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
    canvas.style.width = `${Math.floor(VIEW_W * scale)}px`;
    canvas.style.height = `${Math.floor(VIEW_H * scale)}px`;
  };
  window.addEventListener("resize", fit);
  fit();

  return {
    draw(game) {
      const { level, runner, camera } = game;
      // The Level's bottom sits on the bottom of the view.
      const offsetY = VIEW_H - level.rows * TILE;
      const camX = Math.round(camera.x);

      ctx.fillStyle = COLORS.sky;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);

      ctx.save();
      ctx.translate(-camX, offsetY);

      const firstCol = Math.max(0, Math.floor(camX / TILE));
      const lastCol = Math.min(level.cols - 1, Math.floor((camX + VIEW_W) / TILE));
      for (let row = 0; row < level.rows; row++) {
        for (let col = firstCol; col <= lastCol; col++) {
          if (!isSolid(level, col, row)) continue;
          const x = col * TILE;
          const y = row * TILE;
          ctx.fillStyle = COLORS.tile;
          ctx.fillRect(x, y, TILE, TILE);
          if (!isSolid(level, col, row - 1)) {
            ctx.fillStyle = COLORS.tileEdge;
            ctx.fillRect(x, y, TILE, 2);
          }
        }
      }

      const rx = Math.round(runner.x);
      const ry = Math.round(runner.y);
      ctx.fillStyle = COLORS.runner;
      ctx.fillRect(rx, ry, RUNNER_W, RUNNER_H);
      ctx.fillStyle = COLORS.visor;
      ctx.fillRect(runner.facing > 0 ? rx + 6 : rx, ry + 5, 6, 3);

      ctx.restore();
    },
  };
}

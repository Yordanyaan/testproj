// Thin renderer: draws game state with simple shapes at 640×360.
// Kept separate from the rules so code-drawn shapes can later be swapped for sprites.
import {
  isSolid,
  runnerVisible,
  RUNNER_H,
  RUNNER_W,
  START_HEALTH,
  TILE,
  VIEW_H,
  VIEW_W,
  type Game,
} from "../sim";

const COLORS = {
  sky: "#120a1f",
  tile: "#2a1840",
  tileEdge: "#ff2fa8",
  runner: "#1b1b2e",
  visor: "#38f3ff",
  health: "#38f3ff",
  healthLost: "#2a2a44",
  failure: "#ff2fa8",
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

      if (runnerVisible(game)) {
        const rx = Math.round(runner.x);
        const ry = Math.round(runner.y);
        ctx.fillStyle = COLORS.runner;
        ctx.fillRect(rx, ry, RUNNER_W, RUNNER_H);
        ctx.fillStyle = COLORS.visor;
        ctx.fillRect(runner.facing > 0 ? rx + 6 : rx, ry + 5, 6, 3);
      }

      ctx.restore();

      drawHealth(ctx, game.health);
      if (game.phase === "failed") drawSystemFailure(ctx);
    },
  };
}

/** Health as neon bars at the top left: lit for each Health left, dim for each lost. */
function drawHealth(ctx: CanvasRenderingContext2D, health: number): void {
  for (let i = 0; i < START_HEALTH; i++) {
    const lit = i < health;
    const x = 12 + i * 18;
    ctx.fillStyle = lit ? COLORS.health : COLORS.healthLost;
    ctx.shadowColor = COLORS.health;
    ctx.shadowBlur = lit ? 8 : 0;
    ctx.fillRect(x, 12, 14, 6);
  }
  ctx.shadowBlur = 0;
}

function drawSystemFailure(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.font = "bold 32px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = COLORS.failure;
  ctx.shadowBlur = 12;
  ctx.fillStyle = COLORS.failure;
  ctx.fillText("SYSTEM FAILURE", VIEW_W / 2, VIEW_H / 2);
  ctx.shadowBlur = 0;
}

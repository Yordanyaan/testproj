// Thin renderer: draws game state with simple shapes at 640×360.
// Kept separate from the rules so code-drawn shapes can later be swapped for sprites.
import {
  CREDIT_SIZE,
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
  credit: "#ffe14d",
  hudText: "#38f3ff",
  health: "#38f3ff",
  healthLost: "#2a2a44",
  failure: "#ff2fa8",
  exit: "#ff2fa8",
  overlayTitle: "#ff2fa8",
  overlayText: "#38f3ff",
};

/** A time as m:ss.cc. */
function formatTime(seconds: number): string {
  const cs = Math.floor(seconds * 100);
  const m = Math.floor(cs / 6000);
  const s = Math.floor((cs % 6000) / 100);
  return `${m}:${String(s).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
}

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

      // Exit: a glowing pink neon doorway, two tiles tall, standing on the Exit tile.
      if (level.exit) {
        const x = level.exit.col * TILE + 2;
        const bottom = (level.exit.row + 1) * TILE;
        ctx.strokeStyle = COLORS.exit;
        ctx.shadowColor = COLORS.exit;
        ctx.shadowBlur = 10;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, bottom - 2 * TILE, TILE - 4, 2 * TILE);
        ctx.shadowBlur = 0;
      }

      // Credits: a glowing yellow diamond in each Credit's touch box.
      ctx.fillStyle = COLORS.credit;
      for (const c of game.credits.remaining) {
        if (c.x + CREDIT_SIZE < camX || c.x > camX + VIEW_W) continue;
        const half = CREDIT_SIZE / 2;
        ctx.beginPath();
        ctx.moveTo(c.x + half, c.y);
        ctx.lineTo(c.x + CREDIT_SIZE, c.y + half);
        ctx.lineTo(c.x + half, c.y + CREDIT_SIZE);
        ctx.lineTo(c.x, c.y + half);
        ctx.closePath();
        ctx.fill();
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

      // HUD: Credits collected / total, top middle.
      ctx.fillStyle = COLORS.hudText;
      ctx.font = "bold 14px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(`CREDITS ${game.credits.collected} / ${game.credits.total}`, VIEW_W / 2, 8);

      // Timer, top right.
      ctx.textAlign = "right";
      ctx.fillText(formatTime(game.time), VIEW_W - 12, 8);

      switch (game.phase) {
        case "failed":
          drawSystemFailure(ctx);
          break;
        case "title":
          drawOverlay(ctx, "CYBERPUNK PLATFORMER", ["Press Enter to start"]);
          break;
        case "paused":
          drawOverlay(ctx, "Paused", ["P or Esc to resume"]);
          break;
        case "complete":
          drawOverlay(ctx, "LEVEL COMPLETE", [
            `Credits ${game.credits.collected} / ${game.credits.total}${game.newRecord?.credits ? "  NEW RECORD!" : ""}`,
            `Time ${formatTime(game.time)}${game.newRecord?.time ? "  NEW RECORD!" : ""}`,
            game.record
              ? `Record: ${formatTime(game.record.bestTime)}, ${game.record.mostCredits} Credits`
              : "",
            "Press Enter to play again",
          ]);
          break;
      }
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

/** A dimmed screen with a glowing heading and lines of text under it. */
function drawOverlay(ctx: CanvasRenderingContext2D, heading: string, lines: string[]): void {
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const top = VIEW_H / 2 - (lines.length * 22) / 2 - 12;
  ctx.font = "bold 32px monospace";
  ctx.shadowColor = COLORS.overlayTitle;
  ctx.shadowBlur = 12;
  ctx.fillStyle = COLORS.overlayTitle;
  ctx.fillText(heading, VIEW_W / 2, top);
  ctx.shadowBlur = 0;
  ctx.font = "bold 16px monospace";
  ctx.fillStyle = COLORS.overlayText;
  lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, top + 40 + i * 22));
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

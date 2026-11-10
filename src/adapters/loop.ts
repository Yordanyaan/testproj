// Thin game loop: a fixed-step accumulator driven by requestAnimationFrame.
import { DT } from "../sim";

const MAX_FRAME = 0.1; // s; avoids a spiral of catch-up after a stall or a hidden tab

export function startLoop(tick: (dt: number) => void, draw: () => void): void {
  let acc = 0;
  let last = performance.now();
  const frame = (now: number) => {
    acc += Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    while (acc >= DT) {
      tick(DT);
      acc -= DT;
    }
    draw();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

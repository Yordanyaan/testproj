import { TILE } from "./constants";

/** Designer-facing movement settings, in tiles and seconds (approved prototype Defaults). */
export interface Settings {
  topSpeed: number; // tiles/s
  timeToTopSpeed: number; // s
  timeToStop: number; // s
  airControl: number; // steering multiplier in the air
  jumpHeight: number; // tiles, Space held
  timeToApex: number; // s
  fallGravity: number; // × gravity when falling
  releaseGravity: number; // × gravity when rising with Space released (short hop)
  maxFallSpeed: number; // tiles/s
  lateJumpGrace: number; // s
  earlyJumpGrace: number; // s
  stompBounceHeld: number; // tiles
  stompBounceTap: number; // tiles
  knockback: number; // tiles/s
}

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  topSpeed: 9,
  timeToTopSpeed: 0.15,
  timeToStop: 0.1,
  airControl: 0.8,
  jumpHeight: 4.2,
  timeToApex: 0.38,
  fallGravity: 1.6,
  releaseGravity: 3.0,
  maxFallSpeed: 22,
  lateJumpGrace: 0.1,
  earlyJumpGrace: 0.1,
  stompBounceHeld: 5.5,
  stompBounceTap: 2.0,
  knockback: 6,
});

/** Physics values in pixels and seconds, derived from Settings. */
export interface Physics {
  topSpeed: number;
  accel: number;
  decel: number;
  airControl: number;
  gravity: number;
  jumpVelocity: number;
  fallGravity: number;
  releaseGravity: number;
  maxFall: number;
  lateJumpGrace: number;
  earlyJumpGrace: number;
  stompHeld: number;
  stompTap: number;
  knockback: number;
}

export function derivePhysics(p: Settings): Physics {
  const h = p.jumpHeight * TILE;
  const t = Math.max(p.timeToApex, 0.05);
  const gravity = (2 * h) / (t * t);
  const speed = p.topSpeed * TILE;
  return {
    topSpeed: speed,
    accel: speed / Math.max(p.timeToTopSpeed, 0.001),
    decel: speed / Math.max(p.timeToStop, 0.001),
    airControl: p.airControl,
    gravity,
    jumpVelocity: (2 * h) / t,
    fallGravity: p.fallGravity,
    releaseGravity: p.releaseGravity,
    maxFall: p.maxFallSpeed * TILE,
    lateJumpGrace: p.lateJumpGrace,
    earlyJumpGrace: p.earlyJumpGrace,
    stompHeld: Math.sqrt(2 * gravity * p.stompBounceHeld * TILE),
    stompTap: Math.sqrt(2 * gravity * p.releaseGravity * p.stompBounceTap * TILE),
    knockback: p.knockback * TILE,
  };
}

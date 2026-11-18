// Tuning of the drawn flame (render/flame): the owner's PixiJS demo numbers (docs/plans/flame-fx-reference),
// scaled to our world, where the stream reaches FLAME_RANGE (300 px) instead of the demo's ~580 px.
// Looks only: damage, range and burn rules live in systems/flameConstants.ts.

import { FLAME_HALF_ANGLE } from '../../systems/flameConstants';

export type FlameQuality = 'high' | 'medium' | 'low';

/** Our world against the demo's: sprite sizes, forces and the turbulence pattern follow it. */
export const SCALE = 0.55;

/** The stream: what one flamethrower sprays per second at full power and how the flame moves. */
export const STREAM = {
    flameRate: 1000,      // flame cores per second (demo: 900 × density 1.6)
    jetRate: 270,         // white-blue streaks at the nozzle per second
    sparkRate: 36,        // sparks per second
    smokeRate: 100,       // smoke clouds per second
    pilotRate: 18,        // pilot-light flickers per second, also while not firing
    speed: 700,           // px/s a core leaves the nozzle with: the faint tail ends at ~FLAME_RANGE (flameSim.test)
    life: 0.62,           // s, mean life of a core
    spread: FLAME_HALF_ANGLE, // full opening of the spray cone; turbulence widens it to the damage cone
    lift: 130 * SCALE,    // px/s² hot flame rises with
    turbulence: 1,        // strength of the curling noise
    drag: 1.5,            // share of speed lost per second
    softness: 1,          // alpha of one core
    stretch: 1,           // how much an old core stretches upward
    fadeIn: 9,            // 1/s, how fast the stream comes to full power
    fadeOut: 4,           // 1/s, how fast it dies after the trigger is let go
} as const;

/** Splash fire left where the stream hits a wall, floor or crate, and the fire on a burning fighter. */
export const PATCH = {
    stick: 0.55 * 0.12,   // chance one flame core hitting a surface lights or feeds splash fire there
    burnTime: 1.2,        // s splash fire keeps burning after the last feed (owner: short, it does not hurt)
    radius: 48 * SCALE,   // px, half-width of a fresh splash fire
    intensity: 1.1,
    height: 1.15,         // flame height factor
    tongues: 9,           // tongue flames per fire
    maxTongues: 12,
    bodyFade: 0.3,        // s a burning fighter's fire takes to die out
    markLife: 8,          // s a soot mark takes to fade away
} as const;

/** Light sprites around one stream. */
export const GLOW = {
    strength: 1,
    nozzle: 120 * SCALE,  // px, glow diameter at the nozzle...
    nozzleFlicker: 50 * SCALE, // ...plus up to this much as it flickers
    front: 300 * SCALE,   // px, glow diameter at the middle of the flame...
    frontFlicker: 120 * SCALE,
    pilot: 30 * SCALE,    // px, the pilot light's glow
} as const;

/** Fixed pools: when one is full, new particles are skipped, never allocated. */
export const POOL = { fire: 2400, jet: 300, spark: 400, smoke: 300, patches: 24, marks: 24, streams: 16 } as const;

/** Share of each pool (and of each stream's rate) a quality tier may use. */
export const QUALITY_SHARE: Record<FlameQuality, number> = { high: 1, medium: 0.68, low: 0.34 };

/** Longest frame step the flame simulates; a longer pause counts as this much. */
export const MAX_DT = 0.05;

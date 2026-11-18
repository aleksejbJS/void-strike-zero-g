// The puffs that make up a blast and the trails, as specs for PuffSprites: the flash, the fireball, the simple smoke
// used where there is no blast grid, one rocket-trail puff, the nozzle glow and one debris-trail puff. Pure: every
// call returns fresh specs from Math.random(). Visual only.

import type { PuffSpec } from './puffSprites';
import {
    DEBRIS, DEBRIS_RAMP, FIRE, FIRE_PUFFS, FIRE_RAMP, FLASH, FLASH_RAMP, MAX_FIRE_SCALE, MIN_SCALE, NOZZLE, NOZZLE_RAMP,
    SIMPLE_SMOKE, SIMPLE_SMOKE_PUFFS, SIMPLE_SMOKE_RAMP, TRAIL, TRAIL_RAMP,
} from './blastTuning';

const between = (r: readonly [number, number]): number => r[0] + Math.random() * (r[1] - r[0]);
const around = (spread: number): number => (Math.random() * 2 - 1) * spread;

/** The scale a blast is drawn at (MIN_SCALE at least; a non-finite scale counts as 1). */
export const blastScale = (scale: number): number => (Number.isFinite(scale) ? Math.max(MIN_SCALE, scale) : 1);

/** A short burst of warm light at (x, y). */
export const flashPuff = (x: number, y: number, k: number): PuffSpec => ({
    x, y, vx: 0, vy: 0, ttl: FLASH.ttl, size0: FLASH.size0 * k, size1: FLASH.size1 * k, alpha: FLASH.alpha,
    drag: 0, rise: 0, ramp: FLASH_RAMP, fadeIn: 0.02,
});

/** The fireball: flame puffs flung out from (x, y), slowing, rising and cooling from white through orange to dark red. */
export const fireballPuffs = (x: number, y: number, k: number): PuffSpec[] => {
    const n = Math.round(FIRE_PUFFS * Math.min(MAX_FIRE_SCALE, k)), out: PuffSpec[] = [];
    for (let i = 0; i < n; i++) {
        const a = Math.random() * 2 * Math.PI, speed = between(FIRE.speed) * Math.sqrt(k), off = Math.random() * FIRE.spread * k;
        out.push({
            x: x + Math.cos(a) * off, y: y + Math.sin(a) * off,
            vx: Math.cos(a) * speed, vy: Math.sin(a) * speed * 0.8 - FIRE.lift,
            ttl: between(FIRE.ttl), size0: between(FIRE.size0) * k, size1: between(FIRE.size1) * k, alpha: between(FIRE.alpha),
            drag: FIRE.drag, rise: FIRE.rise, ramp: FIRE_RAMP, fadeIn: 0.04,
        });
    }
    return out;
};

/** Dark smoke puffs rising from (x, y), for a blast that has no smoke grid. */
export const simpleSmokePuffs = (x: number, y: number, k: number): PuffSpec[] => {
    const out: PuffSpec[] = [];
    for (let i = 0; i < SIMPLE_SMOKE_PUFFS; i++) {
        out.push({
            x: x + around(SIMPLE_SMOKE.spread) * k, y: y + around(SIMPLE_SMOKE.spread) * k * 0.6, vx: around(20), vy: -20 - Math.random() * 30,
            ttl: between(SIMPLE_SMOKE.ttl), size0: between(SIMPLE_SMOKE.size0) * k, size1: between(SIMPLE_SMOKE.size1) * k,
            alpha: SIMPLE_SMOKE.alpha, drag: SIMPLE_SMOKE.drag, rise: SIMPLE_SMOKE.rise, ramp: SIMPLE_SMOKE_RAMP, fadeIn: 0.1,
        });
    }
    return out;
};

/** One puff of a rocket's trail at (x, y); `vx` is the rocket's speed along x (the puff keeps a hint of it, backward). */
export const trailPuff = (x: number, y: number, vx: number): PuffSpec => ({
    x: x + around(TRAIL.jitter), y: y + around(TRAIL.jitter), vx: around(TRAIL.drift) - vx * TRAIL.back, vy: around(TRAIL.drift),
    ttl: between(TRAIL.ttl), size0: between(TRAIL.size0), size1: between(TRAIL.size1), alpha: TRAIL.alpha,
    drag: TRAIL.drag, rise: TRAIL.rise, ramp: TRAIL_RAMP, fadeIn: 0.08,
});

/** The hot glow at a rocket's nozzle, one per frame: it lives about a frame, so it follows the rocket. */
export const nozzlePuff = (x: number, y: number): PuffSpec => ({
    x, y, vx: 0, vy: 0, ttl: NOZZLE.ttl, size0: NOZZLE.size0, size1: NOZZLE.size1, alpha: NOZZLE.alpha,
    drag: 0, rise: 0, ramp: NOZZLE_RAMP, fadeIn: 0.01,
});

/** One puff of a flying chunk's thin dark trail. */
export const debrisPuff = (x: number, y: number): PuffSpec => ({
    x, y, vx: 0, vy: 0, ttl: between(DEBRIS.ttl), size0: between(DEBRIS.size0), size1: between(DEBRIS.size1),
    alpha: DEBRIS.alpha, drag: DEBRIS.drag, rise: DEBRIS.rise, ramp: DEBRIS_RAMP, fadeIn: 0.08,
});

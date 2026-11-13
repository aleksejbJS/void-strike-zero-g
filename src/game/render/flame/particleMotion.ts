// How each kind of flame particle moves and looks over its life (after the owner's demo): flame cores curl in
// noise, rise and stretch; nozzle streaks fly straight; sparks fall and bounce; smoke drifts up and spreads.
// Pure: it writes the records' sprite fields (w, h, angle, tint, alpha), the Pixi side only copies them.

import type { FlameParticle, ParticlePool } from './particlePool';
import { FlameColors, LUT_STEPS, RAMP_STEPS, lutIndex } from './flamePalettes';
import { POOL, SCALE, STREAM } from './flameTuning';

export interface Surface { x: number; y: number; w: number; h: number }
interface Hit { nx: number; ny: number; d: number }

/** Sums of mid-life core positions per stream slot: each stream's glow sits at the middle of its flame. */
export class FrontSums {
    readonly x = new Float64Array(POOL.streams);
    readonly y = new Float64Array(POOL.streams);
    readonly n = new Uint32Array(POOL.streams);
    reset(): void { this.x.fill(0); this.y.fill(0); this.n.fill(0); }
}

export interface MotionEnv {
    dt: number;
    time: number;
    colors: FlameColors;
    surfaces: readonly Surface[];
    fronts: FrontSums;
    /** A flame core hit a surface at (x, y) whose outward normal is (nx, ny). */
    splash(x: number, y: number, nx: number, ny: number): void;
}

const NOISE = 1 / SCALE; // our world is smaller than the demo's, so the curls are tighter
const SPARK_GRAVITY = 620 * SCALE;
const SMOKE_RISE = 26 * SCALE;

/** The demo's smooth pseudo-noise: a few crossed sine waves drifting with time. */
export const curl = (x: number, y: number, t: number): number =>
    Math.sin(x * 0.011 + t * 1.7) * Math.cos(y * 0.017 - t * 1.1) + Math.sin((x + y) * 0.006 + t * 0.7);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, t: number) => {
    const k = Math.min(1, Math.max(0, (t - a) / (b - a)));
    return k * k * (3 - 2 * k);
};

/** A point inside `b` gets out fastest through the nearest face: that face's outward normal and the depth. */
export const surfaceHit = (x: number, y: number, b: Surface): Hit | null => {
    if (x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h) return null;
    const dl = x - b.x, dr = b.x + b.w - x, dt = y - b.y, db = b.y + b.h - y;
    const d = Math.min(dl, dr, dt, db);
    if (d === dt) return { nx: 0, ny: -1, d };
    if (d === dl) return { nx: -1, ny: 0, d };
    if (d === dr) return { nx: 1, ny: 0, d };
    return { nx: 0, ny: 1, d };
};

const firstHit = (x: number, y: number, surfaces: readonly Surface[]): Hit | null => {
    for (const s of surfaces) {
        const hit = surfaceHit(x, y, s);
        if (hit) return hit;
    }
    return null;
};

/** Distance (px) between the points checked along one frame's flight. */
const SWEEP_STEP = 6;

/**
 * Fly `p` by its velocity for `step` s, checking the way every SWEEP_STEP px so a fast particle cannot jump a thin
 * platform on a slow frame. On a hit it stops at the first point inside and the hit is returned.
 */
const fly = (p: FlameParticle, step: number, surfaces: readonly Surface[]): Hit | null => {
    const x0 = p.x, y0 = p.y, dx = p.vx * step, dy = p.vy * step;
    p.x += dx; p.y += dy;
    if (surfaces.length === 0) return null;
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / SWEEP_STEP));
    for (let i = 1; i <= n; i++) {
        const x = x0 + (dx * i) / n, y = y0 + (dy * i) / n;
        const hit = firstHit(x, y, surfaces);
        if (hit) { p.x = x; p.y = y; return hit; }
    }
    return null;
};

/** This frame's flight time: the frame plus what is owed from the frame it was born in. */
const flight = (p: FlameParticle, dt: number): number => {
    const step = dt + p.lead;
    p.lead = 0;
    return step;
};

/** Age a particle; true (and the particle killed) when its life is over. */
const expired = (pool: ParticlePool, p: FlameParticle, dt: number): boolean => {
    p.age += dt;
    if (p.age < p.ttl) return false;
    pool.kill(p);
    return true;
};

export const moveFire = (pool: ParticlePool, env: MotionEnv): void => {
    const { dt, time: T, colors, fronts } = env;
    const drag = Math.max(0, 1 - STREAM.drag * dt);
    for (const p of pool.items) {
        if (!p.alive || expired(pool, p, dt)) continue;
        const t = p.age / p.ttl;
        const tb = STREAM.turbulence * (0.15 + t * t * 1.7) * 150 * SCALE * dt;
        const nx = p.x * NOISE, ny = p.y * NOISE;
        p.vx += curl(ny * 1.3, nx * 0.7, T * 1.2 + p.seed) * tb;
        p.vy += curl(nx * 0.9 + p.seed * 37, ny * 1.1, T * 1.05) * tb;
        p.vy -= STREAM.lift * (1 - t * 0.55) * dt;
        p.vx *= drag; p.vy *= drag;
        const hit = fly(p, flight(p, dt), env.surfaces);
        if (hit) {
            // Pushed out of the wall, bounced off and slowed: the flame spreads along what it hit
            p.x += hit.nx * (hit.d + 2); p.y += hit.ny * (hit.d + 2);
            const vn = p.vx * hit.nx + p.vy * hit.ny;
            if (vn < 0) { p.vx -= hit.nx * vn * 1.2; p.vy -= hit.ny * vn * 1.2; }
            p.vx *= 0.5; p.vy *= 0.5; p.age += dt * 0.8;
            // Only the stream lights new fire: flames rising from fire already burning do not feed themselves
            if (p.owner >= 0) env.splash(p.x - hit.nx * 2, p.y - hit.ny * 2, hit.nx, hit.ny);
        }
        // Young cores stretch along their flight; older ones turn upright, swell and stretch upward
        const size = lerp(p.s0, p.s1, 0.34 + 0.66 * (1 - (1 - Math.min(1, t * 2)) ** 2));
        const mv = smooth(0.16, 0.44, t);
        const va = Math.atan2(p.vy, p.vx);
        let d = Math.sin(T * 3.1 + p.seed) * 0.22 - va;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        p.angle = va + d * mv;
        p.w = size * (1 + 1.5 * (1 - mv)) * (1 - 0.2 * mv);
        p.h = size * (1 + 0.95 * mv * STREAM.stretch);
        p.tint = colors.ramp[lutIndex(t * 0.8 + p.tOff, RAMP_STEPS)];
        p.alpha = Math.min(1, t / 0.06) * (1 - t) ** 1.7 * 0.34 * STREAM.softness * p.soft;
        if (p.owner >= 0 && t > 0.25 && t < 0.85) {
            fronts.x[p.owner] += p.x; fronts.y[p.owner] += p.y; fronts.n[p.owner]++;
        }
    }
};

export const moveJet = (pool: ParticlePool, env: MotionEnv): void => {
    const { dt, colors } = env;
    for (const p of pool.items) {
        if (!p.alive || expired(pool, p, dt)) continue;
        const t = p.age / p.ttl;
        if (p.pilot) p.vy -= 60 * SCALE * dt;
        if (fly(p, flight(p, dt), env.surfaces)) { pool.kill(p); continue; }
        p.w = p.s0 * (p.pilot ? 1 : 2.4);
        p.h = p.s0;
        p.angle = Math.atan2(p.vy, p.vx);
        p.tint = (p.pilot ? colors.pilot : colors.jet)[lutIndex(t, LUT_STEPS)];
        p.alpha = (p.pilot ? 0.6 : 0.8) * (1 - t);
    }
};

export const moveSparks = (pool: ParticlePool, env: MotionEnv): void => {
    const { dt, colors } = env;
    const drag = Math.max(0, 1 - 0.5 * dt);
    for (const p of pool.items) {
        if (!p.alive || expired(pool, p, dt)) continue;
        const t = p.age / p.ttl;
        p.vy += SPARK_GRAVITY * dt;
        p.vx *= drag; p.vy *= drag;
        const hit = fly(p, flight(p, dt), env.surfaces);
        if (hit) {
            // A spark bounces off the top of a floor at most twice and dies against anything else
            if (hit.ny !== -1 || p.vy <= 0 || ++p.bounces > 2) { pool.kill(p); continue; }
            p.y -= hit.d + 2;
            p.vy *= -0.42; p.vx *= 0.72;
        }
        const size = p.s0 * (1 - t * 0.45);
        p.w = size * 3.4;
        p.h = size;
        p.angle = Math.atan2(p.vy, p.vx);
        p.tint = colors.spark[lutIndex(t, LUT_STEPS)];
        p.alpha = (1 - t) ** 1.15 * 0.95;
    }
};

export const moveSmoke = (pool: ParticlePool, env: MotionEnv): void => {
    const { dt, time: T, colors } = env;
    for (const p of pool.items) {
        if (!p.alive || expired(pool, p, dt)) continue;
        const t = p.age / p.ttl;
        p.vy -= SMOKE_RISE * dt;
        p.vx += curl(p.y * NOISE, p.x * NOISE, T * 0.6 + p.seed) * STREAM.turbulence * 36 * SCALE * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.w = p.h = lerp(p.s0, p.s1, 1 - (1 - t) ** 2);
        p.angle = p.rot;
        p.tint = colors.smoke[lutIndex(t, LUT_STEPS)];
        p.alpha = p.aMax * Math.min(1, t / 0.22) * (1 - t) ** 1.5;
    }
};

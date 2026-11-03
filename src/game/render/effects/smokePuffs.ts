// The shape of one smoke cloud on screen, as circles in drawing order (bottom first):
//   haze   a wide translucent disc that softens the edge
//   puffs  grey lumps around the rim, laid out from the cloud id so a cloud keeps its shape
//          across frames and clients, each drifting a few pixels
//   core   an opaque disc in the middle that hides whatever stands behind it
//   swirl  lighter wisps over the core so the middle does not read as a flat disc
// During the last 2 s of its life the whole cloud shrinks with the hiding area
// (smokeRadiusAt) and thins out. Pure geometry: SmokeView draws the circles.

import { SmokeCloud } from '../../../types';
import { smokeRadiusAt } from '../../systems/smoke';

export type SmokeCircle = { x: number; y: number; r: number; color: number; alpha: number };

const HAZE_SHARE = 1.12, HAZE_ALPHA = 0.25, HAZE_COLOR = 0x9ca3af;
const RIM_PUFFS = 10;
const PUFF_DIST = [0.5, 0.12] as const;   // [min, extra] share of the radius from the centre
const PUFF_SIZE = [0.4, 0.1] as const;    // [min, extra] share of the radius; reach 0.9–1.12 R
const PUFF_ALPHA = 0.85;
const PUFF_GREYS = [0x9ca3af, 0x8b929c, 0xa8aeb8, 0x7c838f];
const CORE_SHARE = 0.75, CORE_ALPHA = 0.95, CORE_COLOR = 0x8f96a1;
const SWIRLS = 4, SWIRL_SIZE = 0.25, SWIRL_ALPHA = 0.45, SWIRL_COLOR = 0xc3c8d0;
const DRIFT_PX = 5;                       // how far a puff wanders from its spot
const DRIFT_RAD_PER_MS = (2 * Math.PI) / 4000; // one slow wander every ~4 s
const BREATHE = 0.04;                     // puff radius swells and shrinks by this share

/** Live size share (1 → 0 over the fade) and opacity of a cloud. */
export const cloudFade = (cloud: SmokeCloud, now: number): { scale: number; alpha: number } => {
    const scale = cloud.radius > 0 ? smokeRadiusAt(cloud, now) / cloud.radius : 0;
    return { scale, alpha: Math.sqrt(scale) }; // thins slower than it shrinks, so it does not just blink out
};

// FNV-1a hash of the id seeds a small PRNG (mulberry32): the same id always gives the same layout
const seededRandom = (id: string): (() => number) => {
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
    return () => {
        h = (h + 0x6d2b79f5) | 0;
        let t = Math.imul(h ^ (h >>> 15), 1 | h);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

/** Circles to draw for `cloud` at `now`, in world coordinates; empty once it has faded away. */
export const cloudCircles = (cloud: SmokeCloud, now: number): SmokeCircle[] => {
    const { scale, alpha } = cloudFade(cloud, now);
    if (scale <= 0) return [];
    const rand = seededRandom(cloud.id);
    const R = cloud.radius * scale;
    const { x: cx, y: cy } = cloud.pos;
    const out: SmokeCircle[] = [{ x: cx, y: cy, r: R * HAZE_SHARE, color: HAZE_COLOR, alpha: HAZE_ALPHA * alpha }];

    // A wisp at (angle, dist) from the centre, wandering by up to DRIFT_PX on its own phase
    const wisp = (angle: number, dist: number, r: number, color: number, a: number): SmokeCircle => {
        const phase = rand() * 2 * Math.PI;
        const t = now * DRIFT_RAD_PER_MS + phase;
        return {
            x: cx + Math.cos(angle) * dist + Math.sin(t) * DRIFT_PX * scale,
            y: cy + Math.sin(angle) * dist + Math.cos(t * 0.8) * DRIFT_PX * scale,
            r: r * (1 + BREATHE * Math.sin(t * 1.3)),
            color,
            alpha: a * alpha,
        };
    };

    for (let i = 0; i < RIM_PUFFS; i++) {
        const angle = ((i + rand() * 0.6) * 2 * Math.PI) / RIM_PUFFS;
        const dist = R * (PUFF_DIST[0] + PUFF_DIST[1] * rand());
        const r = R * (PUFF_SIZE[0] + PUFF_SIZE[1] * rand());
        out.push(wisp(angle, dist, r, PUFF_GREYS[i % PUFF_GREYS.length], PUFF_ALPHA));
    }
    out.push({ x: cx, y: cy, r: R * CORE_SHARE, color: CORE_COLOR, alpha: CORE_ALPHA * alpha });
    for (let i = 0; i < SWIRLS; i++) {
        out.push(wisp(rand() * 2 * Math.PI, R * 0.3 * rand(), R * SWIRL_SIZE, SWIRL_COLOR, SWIRL_ALPHA));
    }
    return out;
};

// A hurt robot shorts out: once a period, a short burst of sparks flashes at one of its joints.
// Drawn on the robot itself (Graphics, rig space), so it needs no game particles and shows everywhere.
import type { Graphics } from 'pixi.js';
import type { Vector2 } from '../../../types';

export const PERIOD_MS = 700;   // one burst per period
export const BURST_MS = 160;    // how long a burst lasts
const CORE = 0xfff4c2, HOT = 0xffd36b, GLOW = 0xffb347;

export interface SparkBurst { at: Vector2; progress: number; seed: number }

const hash = (seed: number, i: number): number => {
    let h = (seed * 2654435761 + i * 40503) | 0;
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    return ((h ^ (h >>> 13)) >>> 0) / 4294967295;
};

/** The burst showing at `timeMs`, or null between bursts. The same seed and time give the same burst. */
export const hurtBurst = (anchors: readonly Vector2[], seed: number, timeMs: number): SparkBurst | null => {
    if (!anchors.length) return null;
    const period = Math.floor(timeMs / PERIOD_MS);
    const start = period * PERIOD_MS + hash(seed, period) * (PERIOD_MS - BURST_MS);
    const progress = (timeMs - start) / BURST_MS;
    if (progress < 0 || progress >= 1) return null;
    const at = anchors[Math.min(anchors.length - 1, Math.floor(hash(seed, period + 1000) * anchors.length))];
    return { at, progress, seed: seed + period };
};

/** Rays shooting out and shrinking over the burst, with a fading glow; hides the layer between bursts. */
export const drawHurtSparks = (g: Graphics, burst: SparkBurst | null): void => {
    g.clear();
    g.visible = !!burst;
    if (!burst) return;
    const fade = 1 - burst.progress, { x, y } = burst.at;
    g.circle(x, y, 4.2 * fade + 1).fill({ color: GLOW, alpha: 0.4 * fade });
    for (let i = 0; i < 8; i++) {
        const angle = hash(burst.seed, i) * Math.PI * 2;
        const reach = (2.5 + hash(burst.seed, i + 10) * 4.5) * (0.5 + burst.progress);
        const tip = { x: x + Math.cos(angle) * reach, y: y + Math.sin(angle) * reach };
        const tail = { x: x + Math.cos(angle) * reach * 0.45, y: y + Math.sin(angle) * reach * 0.45 };
        g.moveTo(tail.x, tail.y).lineTo(tip.x, tip.y).stroke({ width: 0.85, color: HOT, alpha: fade, cap: 'round' });
        g.moveTo(tail.x, tail.y).lineTo((tail.x + tip.x) / 2, (tail.y + tip.y) / 2).stroke({ width: 0.45, color: CORE, alpha: fade, cap: 'round' });
    }
    g.circle(x, y, 1.1 * fade + 0.3).fill({ color: CORE, alpha: fade });
};

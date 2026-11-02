// Line helpers for the tails: a smooth curve through a chain of points, its normals and its outlined stroke.
// Pure geometry plus one stroke helper; the tail shapes themselves live in tails.ts.

import { Graphics } from 'pixi.js';
import { Vector2 } from '../../../../types';
import { OUTLINE, OUTLINE_W, WHITE } from '../fighterPaint';

const SAMPLES = 4;  // points per curve piece: enough to look round at any zoom the game uses
const LIGHT = { alpha: 0.22, width: 0.3, side: 0.28 }; // the same light line as on the limbs

const mid = (a: Vector2, b: Vector2): Vector2 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/**
 * A smooth line through a chain: quadratic curves that use the inner points as control points and run through
 * the middles of the segments. Starts at the first point and ends at the last one.
 */
export const smoothLine = (pts: Vector2[]): Vector2[] => {
    if (pts.length < 3) return pts.slice();
    const out: Vector2[] = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
        const from = i === 1 ? pts[0] : mid(pts[i - 1], pts[i]);
        const to = i === pts.length - 2 ? pts[i + 1] : mid(pts[i], pts[i + 1]);
        for (let s = 1; s <= SAMPLES; s++) {
            const t = s / SAMPLES, u = 1 - t;
            out.push({
                x: u * u * from.x + 2 * u * t * pts[i].x + t * t * to.x,
                y: u * u * from.y + 2 * u * t * pts[i].y + t * t * to.y,
            });
        }
    }
    return out;
};

/** Unit normal at point i on the side that is up while the line runs back (−x) from its root. */
export const upperNormal = (line: Vector2[], i: number): Vector2 => {
    const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    return { x: -dy / len, y: dx / len };
};

/** The line moved sideways by `offset(i)` along its upper normal (negative = the lower side). */
export const sideLine = (line: Vector2[], offset: (i: number) => number): Vector2[] =>
    line.map((p, i) => {
        const n = upperNormal(line, i), k = offset(i);
        return { x: p.x + n.x * k, y: p.y + n.y * k };
    });

const trace = (g: Graphics, line: Vector2[]) => {
    g.moveTo(line[0].x, line[0].y);
    for (let i = 1; i < line.length; i++) g.lineTo(line[i].x, line[i].y);
    return g;
};

/** A round-ended outlined stroke along a line (outline underneath, so the fill keeps its full width). */
export const outlinedLine = (g: Graphics, line: Vector2[], width: number, color: number) => {
    trace(g, line).stroke({ width: width + OUTLINE_W, color: OUTLINE, cap: 'round', join: 'round' });
    trace(g, line).stroke({ width, color, cap: 'round', join: 'round' });
};

/** A plain stroke along part of a line (a tip band, a light line). */
export const strokeLine = (g: Graphics, line: Vector2[], width: number, color: number, alpha = 1) => {
    if (line.length < 2) return;
    trace(g, line).stroke({ width, color, alpha, cap: 'round', join: 'round' });
};

/** The thin light line along the upper side of a stroked tail, like the light line on a limb. */
export const lineLight = (g: Graphics, line: Vector2[], width: number) => {
    const from = Math.floor(line.length * 0.08), to = Math.ceil(line.length * 0.85);
    strokeLine(g, sideLine(line, () => width * LIGHT.side).slice(from, to), width * LIGHT.width, WHITE, LIGHT.alpha);
};

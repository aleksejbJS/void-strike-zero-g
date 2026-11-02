// Clipping polygons and segments to a convex polygon, so a visor never sticks out of a faceted helmet.

import { Vector2 } from '../../../../types';
import { clipPoly } from '../fighterDetails';

/** One test per edge of a convex polygon: <= 0 on the inside, either winding. */
const edgeTests = (clip: Vector2[]): ((v: Vector2) => number)[] => {
    const c = clip.reduce((m, p) => ({ x: m.x + p.x / clip.length, y: m.y + p.y / clip.length }), { x: 0, y: 0 });
    return clip.map((p, i) => {
        const q = clip[(i + 1) % clip.length];
        const side = (v: Vector2) => (q.x - p.x) * (v.y - p.y) - (q.y - p.y) * (v.x - p.x);
        const inside = Math.sign(side(c)) || 1;
        return (v: Vector2) => -inside * side(v);
    });
};

/** The part of a polygon inside a convex clip polygon. */
export const clipToConvex = (poly: Vector2[], clip: Vector2[]): Vector2[] =>
    edgeTests(clip).reduce((pts, f) => (pts.length ? clipPoly(pts, f) : pts), poly);

/** The part of a segment inside a convex clip polygon, or null when it lies outside. */
export const clipSegment = (a: Vector2, b: Vector2, clip: Vector2[]): [Vector2, Vector2] | null => {
    let t0 = 0, t1 = 1;
    for (const f of edgeTests(clip)) {
        const fa = f(a), fb = f(b);
        if (fa > 0 && fb > 0) return null;
        if (fa > 0) t0 = Math.max(t0, fa / (fa - fb));
        else if (fb > 0) t1 = Math.min(t1, fa / (fa - fb));
    }
    if (t0 >= t1) return null;
    const at = (t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    return [at(t0), at(t1)];
};

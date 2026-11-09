import type { XY } from './artTypes';

const EPSILON = 1e-7;
const cross = (a: XY, b: XY, c: XY) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

/** Ear clipping preserves concave source cutouts and the original vertex/UV indices. */
export const triangulatePolygon = (points: readonly XY[]): Uint32Array => {
    if (points.length < 3 || points.some(p => p.some(n => !Number.isFinite(n)))) {
        throw new Error('Character cutout needs at least three finite points');
    }
    const area = points.reduce((sum, p, i) => {
        const q = points[(i + 1) % points.length];
        return sum + p[0] * q[1] - q[0] * p[1];
    }, 0);
    if (Math.abs(area) < EPSILON) throw new Error('Character cutout has zero area');
    const direction = Math.sign(area);
    const remaining = points.map((_, i) => i);
    const triangles: number[] = [];
    while (remaining.length > 3) {
        let clipped = false;
        for (let i = 0; i < remaining.length; i++) {
            const a = remaining[(i + remaining.length - 1) % remaining.length];
            const b = remaining[i], c = remaining[(i + 1) % remaining.length];
            if (cross(points[a], points[b], points[c]) * direction <= EPSILON) continue;
            const occupied = remaining.some(index => {
                if (index === a || index === b || index === c) return false;
                const p = points[index];
                return cross(points[a], points[b], p) * direction >= -EPSILON
                    && cross(points[b], points[c], p) * direction >= -EPSILON
                    && cross(points[c], points[a], p) * direction >= -EPSILON;
            });
            if (occupied) continue;
            triangles.push(a, b, c);
            remaining.splice(i, 1);
            clipped = true;
            break;
        }
        if (!clipped) throw new Error('Character cutout is self-intersecting or degenerate');
    }
    triangles.push(...remaining);
    return new Uint32Array(triangles);
};

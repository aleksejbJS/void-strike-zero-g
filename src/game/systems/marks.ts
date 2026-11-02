// Scorch marks left on walls by sparks and explosions (pure logic, no rendering).
// Drawing code reads liveMarks() and fades each mark itself:
// alpha = 0.6 * (1 - age / MARK_LIFE_MS).

import { Platform, Vector2 } from '../../types';

export interface Mark { x: number; y: number; r: number; bornAt: number }

export const MARK_LIFE_MS = 4000;
export const MARK_CAP = 50;

const MIN_RADIUS = 2;
const MAX_RADIUS = 3.5;

// Oldest first. Module-level on purpose: marks are cosmetic, not game state.
let marks: Mark[] = [];

// Inclusive on purpose: a railgun hit is computed on the platform boundary, so a
// strict test would lose or keep it depending on floating-point rounding.
const contains = (p: Platform, x: number, y: number) =>
    x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h;

/** Snap a point inside a platform onto its nearest edge, keeping the other coordinate. */
const projectToNearestEdge = (p: Platform, x: number, y: number): Vector2 => {
    const edges: { dist: number; point: Vector2 }[] = [
        { dist: x - p.x, point: { x: p.x, y } },
        { dist: p.x + p.w - x, point: { x: p.x + p.w, y } },
        { dist: y - p.y, point: { x, y: p.y } },
        { dist: p.y + p.h - y, point: { x, y: p.y + p.h } },
    ];
    return edges.reduce((best, e) => (e.dist < best.dist ? e : best)).point;
};

/** Where a mark goes for an impact at (x, y), or null if no platform touches that point. */
export const placeMark = (platforms: Platform[], x: number, y: number): Vector2 | null => {
    const hit = platforms.find(p => contains(p, x, y));
    return hit ? projectToNearestEdge(hit, x, y) : null;
};

/**
 * The closest point on any platform's boundary to (x, y), if it lies within `maxDist`;
 * otherwise null. A point inside a platform is projected onto its nearest edge.
 */
export const placeMarkNear = (platforms: Platform[], x: number, y: number, maxDist: number): Vector2 | null => {
    let best: Vector2 | null = null;
    let bestDist = maxDist;
    for (const p of platforms) {
        const cx = Math.min(p.x + p.w, Math.max(p.x, x));
        const cy = Math.min(p.y + p.h, Math.max(p.y, y));
        const at = projectToNearestEdge(p, cx, cy); // a clamped outside point is already on the boundary
        const dist = Math.hypot(at.x - x, at.y - y);
        if (dist <= bestDist) { best = at; bestDist = dist; }
    }
    return best;
};

const push = (at: Vector2, r: number, now: number): void => {
    marks.push({ x: at.x, y: at.y, r, bornAt: now });
    if (marks.length > MARK_CAP) marks = marks.slice(marks.length - MARK_CAP);
};

/** Leave a spark-sized mark for an impact at (x, y); does nothing when the impact is in open space. */
export const addMark = (platforms: Platform[], x: number, y: number, now: number = Date.now()): void => {
    const at = placeMark(platforms, x, y);
    if (at) push(at, MIN_RADIUS + Math.random() * (MAX_RADIUS - MIN_RADIUS), now);
};

/** Leave a mark of radius `r` on the nearest platform surface within `maxDist` of (x, y), if any. */
export const addMarkAt = (
    platforms: Platform[], x: number, y: number, r: number, maxDist: number, now: number = Date.now(),
): void => {
    const at = placeMarkNear(platforms, x, y, maxDist);
    if (at) push(at, r, now);
};

/** Marks younger than MARK_LIFE_MS; older ones are forgotten. */
export const liveMarks = (now: number): Mark[] => {
    marks = marks.filter(m => now - m.bornAt < MARK_LIFE_MS);
    return marks;
};

export const clearMarks = (): void => {
    marks = [];
};

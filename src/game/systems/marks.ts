// Scorch marks left on walls by sparks (pure logic, no rendering).
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

/** Leave a mark for an impact at (x, y); does nothing when the impact is in open space. */
export const addMark = (platforms: Platform[], x: number, y: number, now: number = Date.now()): void => {
    const at = placeMark(platforms, x, y);
    if (!at) return;
    marks.push({ x: at.x, y: at.y, r: MIN_RADIUS + Math.random() * (MAX_RADIUS - MIN_RADIUS), bornAt: now });
    if (marks.length > MARK_CAP) marks = marks.slice(marks.length - MARK_CAP);
};

/** Marks younger than MARK_LIFE_MS; older ones are forgotten. */
export const liveMarks = (now: number): Mark[] => {
    marks = marks.filter(m => now - m.bornAt < MARK_LIFE_MS);
    return marks;
};

export const clearMarks = (): void => {
    marks = [];
};

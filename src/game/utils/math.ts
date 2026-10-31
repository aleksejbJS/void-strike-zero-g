import { Vector2, Platform } from '../../types';

export const distance = (a: Vector2, b: Vector2) => Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));

export const normalize = (v: Vector2) => {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  return len === 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
};

export const dot = (a: Vector2, b: Vector2) => a.x * b.x + a.y * b.y;

export const checkPointInRect = (p: Vector2, r: Platform | { x: number; y: number; w: number; h: number }) => {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
};

export const checkRectOverlap = (
  r1: { x: number; y: number; w: number; h: number },
  r2: { x: number; y: number; w: number; h: number }
) => {
  return !(r1.x + r1.w <= r2.x || r2.x + r2.w <= r1.x || r1.y + r1.h <= r2.y || r2.y + r2.h <= r1.y);
};

// Liang–Barsky segment-vs-rect clip. Returns the entry fraction t in [0, 1]
// along a→b where the segment first touches the rect, or null if it misses.
export const segmentRectEntry = (
  a: Vector2,
  b: Vector2,
  r: { x: number; y: number; w: number; h: number }
): number | null => {
  const p = [- (b.x - a.x), b.x - a.x, - (b.y - a.y), b.y - a.y];
  const q = [a.x - r.x, r.x + r.w - a.x, a.y - r.y, r.y + r.h - a.y];
  let t0 = 0;
  let t1 = 1;

  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return null; // Parallel and outside
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return null;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return null;
        if (t < t1) t1 = t;
      }
    }
  }
  return t0;
};

// Segment-vs-rect test to avoid tunneling for fast projectiles
export const segmentIntersectsRect = (
  a: Vector2,
  b: Vector2,
  r: { x: number; y: number; w: number; h: number }
) => segmentRectEntry(a, b, r) !== null;

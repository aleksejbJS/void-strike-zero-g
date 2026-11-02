// One physics tick of a corpse: verlet motion, link relaxation with joint limits, platform collision.
// Pure math on the corpse data; runs on the client only, at the fixed 120 ticks/s.

import { GRAVITY } from '../../../constants';
import { Platform, Vector2 } from '../../../types';
import { Corpse, CorpseLink, CorpsePoint } from './corpseBody';

/** Share of the velocity kept per tick in the air. */
const DAMPING = 0.995;
/** Relaxation passes per tick: more passes = stiffer links. */
const PASSES = 8;
/** On a platform top a point keeps this share of its horizontal speed (ground friction)... */
const GROUND_KEEP_X = 0.75;
/** ...and bounces back with this share of the speed it hit a surface with... */
const BOUNCE = 0.25;
/** ...unless it hit slower than this (units per tick): then it stops, so a lying body comes to rest. */
const BOUNCE_MIN = 1;
/** Two points closer than this count as touching, so a link never divides by zero. */
const MIN_DIST = 0.001;
/**
 * A point already inside a platform when the tick starts (a corpse born inside a wall) is not
 * pushed out at once, which would fling it and everything linked to it: it creeps out by at
 * most this many units per tick instead.
 */
const CREEP = 1;
/**
 * Fastest a point may move per tick: under half the thinnest map platform (20 units), a safety net
 * so a falling corpse (terminal speed would be about 72) never skips through a platform in one tick.
 */
const MAX_SPEED = 9;

type Side = 'left' | 'right' | 'top' | 'bottom';

/** How deep a point is inside a platform and through which side it gets out fastest; null if outside. */
const nearestSide = (p: CorpsePoint, r: Platform): { side: Side; depth: number } | null => {
    const left = p.x - r.x, right = r.x + r.w - p.x, top = p.y - r.y, bottom = r.y + r.h - p.y;
    if (left <= 0 || right <= 0 || top <= 0 || bottom <= 0) return null;
    const depth = Math.min(left, right, top, bottom);
    const side = depth === top ? 'top' : depth === bottom ? 'bottom' : depth === left ? 'left' : 'right';
    return { side, depth };
};

/**
 * The side a point came in through, judged from where it was when the tick began. Null if it was
 * already inside then. Coming in diagonally, it entered through the side whose line it crossed
 * last: before that crossing it was still beside the platform, not in it.
 */
const entrySide = (from: Vector2, p: CorpsePoint, r: Platform): Side | null => {
    const sideX: Side | null = from.x <= r.x ? 'left' : from.x >= r.x + r.w ? 'right' : null;
    const sideY: Side | null = from.y <= r.y ? 'top' : from.y >= r.y + r.h ? 'bottom' : null;
    if (!sideX || !sideY) return sideX ?? sideY;
    const tx = ((sideX === 'left' ? r.x : r.x + r.w) - from.x) / (p.x - from.x);
    const ty = ((sideY === 'top' ? r.y : r.y + r.h) - from.y) / (p.y - from.y);
    return tx > ty ? sideX : sideY;
};

/** New velocity into a surface, given the velocity into it before the hit (positive = moving in). */
const afterHit = (into: number): number => {
    if (into <= 0) return into; // already leaving: keep it
    return into > BOUNCE_MIN ? -into * BOUNCE : 0;
};

/** A point pushed back onto a platform top: `impact` if it hit faster than BOUNCE_MIN, else `rest`. */
type TopContact = 'rest' | 'impact' | null;

/**
 * Push a point that entered a platform this tick back out through the side it came in by (so a
 * fast fall never comes out under a thin platform).
 */
const collide = (p: CorpsePoint, from: Vector2, r: Platform): TopContact => {
    const hit = nearestSide(p, r);
    if (!hit) return null;
    const side = entrySide(from, p, r) ?? hit.side;
    // Velocity from before the push: being pushed out must not fling the point
    const vx = p.x - p.px, vy = p.y - p.py;
    if (side === 'top') {
        p.y = r.y;
        p.py = p.y - afterHit(vy);
        p.px = p.x - vx * GROUND_KEEP_X;
        return vy > BOUNCE_MIN ? 'impact' : 'rest';
    }
    if (side === 'bottom') {
        p.y = r.y + r.h;
        p.py = p.y + afterHit(-vy);
        p.px = p.x - vx;
    } else if (side === 'left') {
        p.x = r.x;
        p.px = p.x - afterHit(vx);
        p.py = p.y - vy;
    } else {
        p.x = r.x + r.w;
        p.px = p.x + afterHit(-vx);
        p.py = p.y - vy;
    }
    return null;
};

/**
 * A point that touched a platform top this tick and now rises slower than one tick of gravity is
 * only propped up a little by its links, not thrown: it rests, so drop that rise. Without this a
 * lying body keeps a small false speed and never reads as at rest.
 */
const settle = (p: CorpsePoint): void => {
    const vy = p.y - p.py;
    if (vy < 0 && vy > -GRAVITY) p.py = p.y;
};

/** Move an embedded point toward the nearest side, its previous position along, so it gains no speed. */
const creepOut = (p: CorpsePoint, r: Platform): void => {
    const hit = nearestSide(p, r);
    if (!hit) return;
    const step = Math.min(hit.depth, CREEP);
    const dx = hit.side === 'left' ? -step : hit.side === 'right' ? step : 0;
    const dy = hit.side === 'top' ? -step : hit.side === 'bottom' ? step : 0;
    p.x += dx; p.px += dx;
    p.y += dy; p.py += dy;
};

/**
 * Bring a link back to its length. A joint limit (`min`) only pushes apart, and when one end hit a
 * platform top hard this tick (`braced`) the other end takes all of the vertical push (the ground
 * holds its end up): otherwise the ground undoes half of every push and a knee folds past its limit
 * for several ticks after a hard landing. The horizontal push stays shared (the ground gives no
 * sideways support), and resting contacts are not braced, so a lying body does not jitter.
 */
const relax = (c: Corpse, link: CorpseLink, braced: ReadonlySet<CorpsePoint>): void => {
    const a = c.points[link.a], b = c.points[link.b];
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.max(Math.hypot(dx, dy), MIN_DIST);
    if (link.min && d >= link.len) return;
    const pinA = link.min && braced.has(a), pinB = link.min && braced.has(b);
    const shareA = pinA === pinB ? 0.5 : pinA ? 0 : 1;
    const k = (d - link.len) / d;
    a.x += dx * k * 0.5; a.y += dy * k * shareA;
    b.x -= dx * k * 0.5; b.y -= dy * k * (1 - shareA);
};

/** One 120 Hz tick. */
export const stepCorpse = (c: Corpse, platforms: Platform[]): void => {
    const points = Object.values(c.points);
    // The platform each point is stuck in since an earlier tick (it creeps out of that one)
    const stuck = points.map(p => platforms.find(r => nearestSide(p, r) !== null));
    const from = points.map(p => ({ x: p.x, y: p.y }));
    points.forEach((p, i) => {
        let vx = (p.x - p.px) * DAMPING, vy = (p.y - p.py) * DAMPING;
        const speed = Math.hypot(vx, vy);
        if (speed > MAX_SPEED) { vx *= MAX_SPEED / speed; vy *= MAX_SPEED / speed; }
        p.px = p.x; p.py = p.y;
        p.x += vx; p.y += vy + GRAVITY;
        const embedded = stuck[i];
        if (embedded) creepOut(p, embedded);
    });
    const landed = new Set<CorpsePoint>();
    const braced = new Set<CorpsePoint>();
    for (let pass = 0; pass < PASSES; pass++) {
        for (const link of c.links) relax(c, link, braced);
        points.forEach((p, i) => {
            for (const r of platforms) {
                if (r === stuck[i]) continue;
                const contact = collide(p, from[i], r);
                if (contact) landed.add(p);
                if (contact === 'impact') braced.add(p);
            }
        });
    }
    for (const p of landed) settle(p);
    c.age++;
};

/** The fastest point's speed in units per tick (for rest checks). */
export const speedOf = (c: Corpse): number => {
    let max = 0;
    for (const p of Object.values(c.points)) max = Math.max(max, Math.hypot(p.x - p.px, p.y - p.py));
    return max;
};

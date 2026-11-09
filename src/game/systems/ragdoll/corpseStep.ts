// One physics tick of a corpse: verlet motion, link relaxation with joint limits, platform collision.
// Pure math on the corpse data; runs on the client only, at the fixed 120 ticks/s.

import { GRAVITY, PHYSICS_TICK_RATE } from '../../../constants';
import { Platform, Vector2 } from '../../../types';
import { Corpse, CorpseLink, CorpsePoint, CorpsePointId } from './corpseBody';
import { collideCorpsePoint, creepCorpsePoint, nearestCorpseContact } from './corpseContact';
import { corpseContactRadii } from './corpseRadii';

/**
 * Corpse gravity in units per tick²: the rate living fighters really fall at. GRAVITY is added each tick
 * to an entity velocity that is per 60 Hz frame (Matter's base step), so it moves them by half of it.
 */
export const CORPSE_GRAVITY = GRAVITY * 60 / PHYSICS_TICK_RATE;
/** Share of the velocity kept per tick in the air. */
const DAMPING = 0.995;
/** Relaxation passes per tick: more passes = stiffer links. */
const PASSES = 8;
/** Two points closer than this count as touching, so a link never divides by zero. */
const MIN_DIST = 0.001;
/**
 * Fastest a point may move per tick: under half the thinnest map platform (20 units), a safety net
 * so a falling corpse (terminal speed would be about 36) never skips through a platform in one tick.
 */
export const MAX_SPEED = 9;

/**
 * A point that touched a platform top this tick and now rises slower than one tick of gravity is
 * only propped up a little by its links, not thrown: it rests, so drop that rise. Without this a
 * lying body keeps a small false speed and never reads as at rest.
 */
const settle = (p: CorpsePoint): void => {
    const vy = p.y - p.py;
    if (vy < 0 && vy > -CORPSE_GRAVITY) p.py = p.y;
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

// Broad phase: no point gets farther than this beyond the corpse's box in a tick (a capped move plus
// a tick of gravity, then creeping out of a wall and being pulled by its links, with room to spare)
const REACH = MAX_SPEED + CORPSE_GRAVITY + 40;

/** The platforms this corpse can touch this tick, in their original order (so `find` picks the same one). */
const nearPlatforms = (points: CorpsePoint[], platforms: Platform[]): Platform[] => {
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (const p of points) {
        left = Math.min(left, p.x); right = Math.max(right, p.x);
        top = Math.min(top, p.y); bottom = Math.max(bottom, p.y);
    }
    return platforms.filter(r => r.x < right + REACH && r.x + r.w > left - REACH && r.y < bottom + REACH && r.y + r.h > top - REACH);
};

/** One 120 Hz tick, colliding only with the platforms near the corpse. */
export const stepCorpse = (c: Corpse, platforms: Platform[]): void =>
    stepCorpseAmong(c, nearPlatforms(Object.values(c.points), platforms));

/** One 120 Hz tick against every platform in `platforms` (no broad phase: stepCorpse picks them). */
export const stepCorpseAmong = (c: Corpse, platforms: Platform[]): void => {
    const ids = Object.keys(c.points) as CorpsePointId[];
    const points = ids.map(id => c.points[id]), radii = corpseContactRadii(c);
    // The platform each point is stuck in since an earlier tick (it creeps out of that one)
    // Only centers already inside the real platform need slow escape. The painted halo is normal
    // contact; skipping it during link relaxation would let a resting joint keep sinking.
    const stuck = points.map(p => platforms.find(r => nearestCorpseContact(p, r) !== null));
    const from = points.map(p => ({ x: p.x, y: p.y }));
    points.forEach((p, i) => {
        if (radii || p.supported !== undefined) p.supported = false;
        let vx = (p.x - p.px) * DAMPING, vy = (p.y - p.py) * DAMPING;
        const speed = Math.hypot(vx, vy);
        if (speed > MAX_SPEED) { vx *= MAX_SPEED / speed; vy *= MAX_SPEED / speed; }
        p.px = p.x; p.py = p.y;
        p.x += vx; p.y += vy + CORPSE_GRAVITY;
        const embedded = stuck[i];
        if (embedded) creepCorpsePoint(p, embedded, radii?.[ids[i]] ?? 0);
    });
    const landed = new Set<CorpsePoint>();
    const braced = new Set<CorpsePoint>();
    for (let pass = 0; pass < PASSES; pass++) {
        for (const link of c.links) relax(c, link, braced);
        points.forEach((p, i) => {
            for (const r of platforms) {
                if (r === stuck[i]) continue;
                const contact = collideCorpsePoint(p, from[i], r, radii?.[ids[i]] ?? 0);
                if (contact) { landed.add(p); if (radii) p.supported = true; }
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

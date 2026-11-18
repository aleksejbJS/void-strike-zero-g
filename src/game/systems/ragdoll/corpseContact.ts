// Contact math for a point with optional illustrated-body thickness, without allocating expanded platforms.
import type { Platform, Vector2 } from '../../../types';
import type { CorpsePoint } from './corpseBody';

const GROUND_KEEP_X = 0.75, BOUNCE = 0.25, BOUNCE_MIN = 1, CREEP = 1;
type Side = 'left' | 'right' | 'top' | 'bottom';
type TopContact = 'rest' | 'impact' | null;

export const nearestCorpseContact = (p: CorpsePoint, r: Platform, radius = 0): { side: Side; depth: number } | null => {
    const left = p.x - r.x + radius, right = r.x + r.w + radius - p.x;
    const top = p.y - r.y + radius, bottom = r.y + r.h + radius - p.y;
    if (left <= 0 || right <= 0 || top <= 0 || bottom <= 0) return null;
    const depth = Math.min(left, right, top, bottom);
    return { side: depth === top ? 'top' : depth === bottom ? 'bottom' : depth === left ? 'left' : 'right', depth };
};

/** Entering diagonally uses the last crossed expanded boundary, so fast bodies stay on the near side. */
const entrySide = (from: Vector2, p: CorpsePoint, r: Platform, radius: number): Side | null => {
    const left = r.x - radius, right = r.x + r.w + radius, top = r.y - radius, bottom = r.y + r.h + radius;
    const sideX: Side | null = from.x <= left ? 'left' : from.x >= right ? 'right' : null;
    const sideY: Side | null = from.y <= top ? 'top' : from.y >= bottom ? 'bottom' : null;
    if (!sideX || !sideY) return sideX ?? sideY;
    const tx = ((sideX === 'left' ? left : right) - from.x) / (p.x - from.x);
    const ty = ((sideY === 'top' ? top : bottom) - from.y) / (p.y - from.y);
    return tx > ty ? sideX : sideY;
};

const afterHit = (into: number): number => into <= 0 ? into : into > BOUNCE_MIN ? -into * BOUNCE : 0;

/** Position correction preserves incoming velocity; it never becomes an extra launch impulse. */
export const collideCorpsePoint = (p: CorpsePoint, from: Vector2, r: Platform, radius = 0): TopContact => {
    const hit = nearestCorpseContact(p, r, radius);
    if (!hit) return null;
    const side = entrySide(from, p, r, radius) ?? hit.side;
    const vx = p.x - p.px, vy = p.y - p.py;
    if (side === 'top') {
        p.y = r.y - radius; p.py = p.y - afterHit(vy); p.px = p.x - vx * GROUND_KEEP_X;
        return vy > BOUNCE_MIN ? 'impact' : 'rest';
    }
    if (side === 'bottom') {
        p.y = r.y + r.h + radius; p.py = p.y + afterHit(-vy); p.px = p.x - vx;
    } else if (side === 'left') {
        p.x = r.x - radius; p.px = p.x - afterHit(vx); p.py = p.y - vy;
    } else {
        p.x = r.x + r.w + radius; p.px = p.x + afterHit(-vx); p.py = p.y - vy;
    }
    return null;
};

/** Existing penetration leaves by at most one unit a tick, carrying its previous position along. */
export const creepCorpsePoint = (p: CorpsePoint, r: Platform, radius = 0): void => {
    const hit = nearestCorpseContact(p, r, radius);
    if (!hit) return;
    const step = Math.min(hit.depth, CREEP);
    const dx = hit.side === 'left' ? -step : hit.side === 'right' ? step : 0;
    const dy = hit.side === 'top' ? -step : hit.side === 'bottom' ? step : 0;
    p.x += dx; p.px += dx; p.y += dy; p.py += dy;
    // An illustrated surface born deep in a wall must not keep accelerating farther into it
    // while the deliberately slow escape runs. Preserve tangential and outward motion.
    if (radius > 0) {
        if ((hit.side === 'top' && p.y > p.py) || (hit.side === 'bottom' && p.y < p.py)) p.py = p.y;
        if ((hit.side === 'left' && p.x > p.px) || (hit.side === 'right' && p.x < p.px)) p.px = p.x;
    }
};

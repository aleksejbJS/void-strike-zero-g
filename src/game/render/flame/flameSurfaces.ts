// What the drawn flame can hit this frame: platforms and intact cover inside the box around every live flame
// particle and every nozzle (the simulation's flame stops at the same things, flameReach.ts).

import type { GameState } from '../../../types';
import { coverRect, intactCover } from '../../cover/coverGeometry';
import type { FlameOrders } from './flameOrders';
import type { FlamePools } from './flameStream';
import type { Surface } from './particleMotion';

/** Room around each point: the farthest a particle flies in one frame, and then some. */
const PAD = 80;

const overlaps = (s: Surface, x0: number, y0: number, x1: number, y1: number) =>
    s.x <= x1 && s.x + s.w >= x0 && s.y <= y1 && s.y + s.h >= y0;

/** Fill `out` with the surfaces near the flame and return it; empty when nothing burns. */
export const nearbySurfaces = (
    world: Pick<GameState, 'platforms' | 'cover'>, pools: FlamePools, orders: FlameOrders, out: Surface[],
): Surface[] => {
    out.length = 0;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const grow = (x: number, y: number) => {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
    };
    for (const o of orders.streams.values()) grow(o.x, o.y);
    for (const pool of [pools.fire, pools.jet, pools.spark]) {
        if (pool.count === 0) continue;
        for (const p of pool.items) if (p.alive) grow(p.x, p.y);
    }
    if (x0 === Infinity) return out;
    x0 -= PAD; y0 -= PAD; x1 += PAD; y1 += PAD;
    for (const plat of world.platforms) if (overlaps(plat, x0, y0, x1, y1)) out.push(plat);
    for (const c of intactCover(world)) {
        const r = coverRect(c);
        if (overlaps(r, x0, y0, x1, y1)) out.push(r);
    }
    return out;
};

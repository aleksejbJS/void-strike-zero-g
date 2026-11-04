// An explosive barrel going off: a blast that hurts everyone in reach, credited to whoever broke the barrel

import type { GameState } from '../../types';
import { createExplosion } from '../systems/explosion';
import { BARREL_DAMAGE, BARREL_RADIUS, COVER_SPECS, Cover } from './coverTypes';

/**
 * A lit barrel's fuse ran out: put it out (a barrel goes off once) and blow it up from its middle. The blast hurts
 * every fighter in reach, teammates and the breaker included, and is credited to the fighter who broke the barrel
 * (`creditId`, handed down a chain). A neighbouring barrel it breaks gets that same fighter as credit, and goes
 * off after the chain delay: its fuse is set on the tick's clock `now`.
 */
export const explodeBarrel = (state: GameState, barrel: Cover, now: number): void => {
    barrel.fuseAt = undefined;
    const centre = { x: barrel.pos.x, y: barrel.pos.y - COVER_SPECS.barrel.h / 2 };
    createExplosion(state, centre, barrel.creditId ?? '', BARREL_RADIUS, undefined, undefined, { barrel: true, damage: BARREL_DAMAGE, now });
};

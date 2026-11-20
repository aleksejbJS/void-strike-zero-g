// Map hazards share the barrel blast and carry the breaker through a chain reaction.

import type { GameState } from '../../types';
import { createExplosion } from '../systems/explosion';
import { BARREL_DAMAGE, BARREL_RADIUS, COVER_SPECS, Cover, isExplosiveCover } from './coverTypes';

export const explodeCover = (state: GameState, cover: Cover, now: number): void => {
    cover.fuseAt = undefined;
    if (!isExplosiveCover(cover.kind)) return;
    const centre = { x: cover.pos.x, y: cover.pos.y - COVER_SPECS[cover.kind].h / 2 };
    createExplosion(state, centre, cover.creditId ?? '', BARREL_RADIUS, undefined, undefined, {
        barrel: true, explosiveCover: cover.kind, damage: BARREL_DAMAGE, now,
    });
};

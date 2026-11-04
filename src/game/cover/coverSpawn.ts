// Spawn safety net: a fighter that (re)spawns inside cover is put on top of it

import type { Entity, GameState } from '../../types';
import { checkRectOverlap } from '../utils/math';
import { coverRect, intactCover } from './coverGeometry';

/**
 * Random spawn points can land inside a crate. Place the fighter's feet on the top of any intact
 * piece its rect overlaps (x unchanged); repeats for neighbouring pieces at other heights.
 */
export const liftOutOfCover = (state: Pick<GameState, 'cover'>, fighter: Pick<Entity, 'pos' | 'width' | 'height'>): void => {
    const pieces = intactCover(state).map(coverRect);
    // Each lift ends on a piece's top and only a piece that reaches higher can overlap again, so this ends
    for (let i = 0; i < pieces.length; i++) {
        const body = { x: fighter.pos.x - fighter.width / 2, y: fighter.pos.y - fighter.height, w: fighter.width, h: fighter.height };
        const hit = pieces.find(r => checkRectOverlap(body, r));
        if (!hit) return;
        fighter.pos.y = hit.y;
    }
};

// Cover geometry: rects, damage stage and line-of-sight / blast / beam queries over intact cover

import type { GameState, Vector2 } from '../../types';
import { segmentRectEntry } from '../utils/math';
import { COVER_SPECS, Cover, CoverStage } from './coverTypes';

export interface Rect { x: number; y: number; w: number; h: number }

/** World rect of a piece: pos is (centerX, bottomY), the rect is top-left based. */
export const coverRect = (c: Cover): Rect => {
    const { w, h } = COVER_SPECS[c.kind];
    return { x: c.pos.x - w / 2, y: c.pos.y - h, w, h };
};

/** A piece with hp left is solid; at 0 it is gone until it returns. */
export const isIntact = (c: Cover): boolean => c.hp > 0;

/** Damage stage from the share of hp left: above 66% 0, above 33% 1, anything left 2, none 3. */
export const coverStage = (c: Cover): CoverStage => {
    if (!isIntact(c)) return 3;
    const max = COVER_SPECS[c.kind].hp;
    if (c.hp > max * 0.66) return 0;
    if (c.hp > max * 0.33) return 1;
    return 2;
};

/** The solid pieces of a state (a state without cover has none). */
export const intactCover = (state: Pick<GameState, 'cover'>): Cover[] => (state.cover ?? []).filter(isIntact);

/** Nearest intact piece the segment a-b crosses (optionally only those passing `filter`), with the entry fraction t. */
export const firstCoverOnSegment = (
    state: Pick<GameState, 'cover'>,
    a: Vector2,
    b: Vector2,
    filter?: (c: Cover) => boolean,
): { cover: Cover; t: number } | null => {
    let best: { cover: Cover; t: number } | null = null;
    for (const cover of intactCover(state)) {
        if (filter && !filter(cover)) continue;
        const t = segmentRectEntry(a, b, coverRect(cover));
        if (t !== null && (!best || t < best.t)) best = { cover, t };
    }
    return best;
};

/** True when an intact piece that blocks sight (everything except glass) stands between a and b. */
export const sightBlocks = (state: Pick<GameState, 'cover'>, a: Vector2, b: Vector2): boolean =>
    firstCoverOnSegment(state, a, b, c => COVER_SPECS[c.kind].blocksSight) !== null;

/** True when a platform or any intact piece (glass included) stands between a and b; `exceptId` is the blast's own barrel. */
export const blastBlocks = (state: Pick<GameState, 'cover' | 'platforms'>, a: Vector2, b: Vector2, exceptId?: string): boolean =>
    state.platforms.some(p => segmentRectEntry(a, b, p) !== null) ||
    firstCoverOnSegment(state, a, b, c => c.id !== exceptId) !== null;

// Per-tick cover upkeep: lit barrels go off, broken pieces come back, a reset puts everything back

import type { GameState } from '../../types';
import { checkRectOverlap } from '../utils/math';
import { COVER_RETRY_MS, COVER_SPECS, Cover } from './coverTypes';
import { coverRect } from './coverGeometry';
import { emitCoverEvent } from './coverDamage';

/** True when a living fighter stands where the piece would come back (a corpse does not block). */
const blockedByFighter = (state: GameState, cover: Cover): boolean => {
    const spot = coverRect(cover);
    return state.players.some(p => !p.dead
        && checkRectOverlap({ x: p.pos.x - p.width / 2, y: p.pos.y - p.height, w: p.width, h: p.height }, spot));
};

/** A lit barrel's fuse has run out. Task 5 replaces this body with explodeBarrel; for now it only puts the fuse out. */
const detonateBarrel = (_state: GameState, cover: Cover): void => {
    cover.fuseAt = undefined;
};

const restorePiece = (cover: Cover): void => {
    cover.hp = COVER_SPECS[cover.kind].hp;
    cover.returnsAt = undefined;
    cover.fuseAt = undefined;
    cover.creditId = undefined;
};

/** Run once per physics tick: due fuses go off, then due pieces return unless a live fighter is in the way (retry shortly). */
export const tickCover = (state: GameState, now: number): void => {
    for (const cover of state.cover ?? []) {
        if (cover.fuseAt !== undefined && cover.fuseAt <= now) detonateBarrel(state, cover);
        if (cover.returnsAt === undefined || cover.returnsAt > now) continue;
        if (blockedByFighter(state, cover)) {
            cover.returnsAt = now + COVER_RETRY_MS;
            continue;
        }
        restorePiece(cover);
        emitCoverEvent(cover, 'restore');
    }
};

/** Match/round reset: every piece whole again, nothing pending (no returns, no fuses, no credit). Silent. */
export const restoreAllCover = (state: GameState): void => {
    for (const cover of state.cover ?? []) restorePiece(cover);
};

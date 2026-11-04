// Damage to cover: lowers hp, breaks a piece at zero, lights a broken barrel's fuse

import type { GameState } from '../../types';
import { gameEvents } from '../systems/events';
import type { CoverAction } from '../systems/events';
import { BARREL_CHAIN_MS, COVER_RETURN_MS, COVER_SPECS, Cover } from './coverTypes';
import { isIntact } from './coverGeometry';

/** Tell every client what happened to a piece, for its effect (COVER) and its sound. */
export const emitCoverEvent = (cover: Cover, action: CoverAction): void => {
    const { h } = COVER_SPECS[cover.kind];
    gameEvents.emit({ type: 'COVER', action, kind: cover.kind, x: cover.pos.x, y: cover.pos.y - h / 2 });
    if (action !== 'restore') gameEvents.emit({ type: 'SOUND', sound: 'cover', subtype: `${cover.kind}:${action}` });
};

/**
 * Hurt a piece (the caller has already applied the ×3 explosive multiplier). Broken or gone pieces ignore it.
 * A piece reaching 0 hp is due back after COVER_RETURN_MS; a barrel also gets lit: a shot sets it off at once,
 * a blast from a neighbouring barrel after BARREL_CHAIN_MS. `creditId` is who gets the blame for that blast;
 * the first breaker keeps it because damage on a broken piece does nothing.
 */
export const damageCover = (
    _state: GameState, cover: Cover, amount: number, creditId: string, now: number, viaBlast = false,
): void => {
    if (!isIntact(cover) || amount <= 0) return;
    cover.hp = Math.max(0, cover.hp - amount);
    if (isIntact(cover)) {
        emitCoverEvent(cover, 'hit');
        return;
    }
    cover.returnsAt = now + COVER_RETURN_MS;
    if (cover.kind === 'barrel') {
        cover.fuseAt = now + (viaBlast ? BARREL_CHAIN_MS : 0);
        cover.creditId = creditId;
    }
    emitCoverEvent(cover, 'break');
};

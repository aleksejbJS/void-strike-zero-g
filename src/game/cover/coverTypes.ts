// Destructible cover: kinds, fixed specs, state shapes and tuning constants

import type { Vector2 } from '../../types';

export type CoverKind = 'wood' | 'metal' | 'glass' | 'barrel';

export interface CoverSpec {
    w: number;
    h: number;
    hp: number;
    /** Blocks line of sight (bots read this; glass is see-through). */
    blocksSight: boolean;
    /** Stops a railgun beam instead of letting it pierce. */
    stopsRail: boolean;
}

export const COVER_SPECS: Record<CoverKind, CoverSpec> = {
    wood: { w: 50, h: 46, hp: 150, blocksSight: true, stopsRail: false },
    metal: { w: 50, h: 46, hp: 500, blocksSight: true, stopsRail: true },
    glass: { w: 16, h: 90, hp: 60, blocksSight: false, stopsRail: false },
    barrel: { w: 32, h: 46, hp: 80, blocksSight: true, stopsRail: true },
};

/** True for a kind this build knows (a newer host may send kinds an older client has no spec or look for). */
export const isKnownCoverKind = (kind: string): kind is CoverKind => Object.prototype.hasOwnProperty.call(COVER_SPECS, kind);

/** One piece of cover. `pos` follows the game convention: (centerX, bottomY). */
export interface Cover {
    id: string;
    kind: CoverKind;
    pos: Vector2;
    hp: number;
    /** When a destroyed piece comes back (ms timestamp); set only while it is gone. */
    returnsAt?: number;
    /** When a lit barrel detonates (ms timestamp). */
    fuseAt?: number;
    /** Who gets credit for what this piece's destruction does (a barrel blast). */
    creditId?: string;
}

/** The part of a Cover that changes during a match (what snapshots carry). */
export interface CoverStatus {
    id: string;
    hp: number;
    returnsAt?: number;
}

/** Damage stage: 0 = intact, 1 = cracked, 2 = badly damaged, 3 = destroyed. */
export type CoverStage = 0 | 1 | 2 | 3;

/** Explosions hurt cover this many times harder than their normal damage. */
export const COVER_EXPLOSIVE_MULT = 3;
/** A destroyed piece returns after this long. */
export const COVER_RETURN_MS = 35000;
/** The returning piece shows as a hologram this long before it is solid. */
export const COVER_WARN_MS = 2000;
/** A return blocked by a fighter is retried after this long. */
export const COVER_RETRY_MS = 500;
/** Barrel blast: reach (px) and damage, full damage to everyone inside. */
export const BARREL_RADIUS = 170;
export const BARREL_DAMAGE = 90;
/** Delay before a barrel caught in another blast goes off. */
export const BARREL_CHAIN_MS = 150;
/** What the kill feed shows as the weapon of a barrel kill (a barrel is no WeaponType). */
export const BARREL_KILL_NAME = 'Barrel';

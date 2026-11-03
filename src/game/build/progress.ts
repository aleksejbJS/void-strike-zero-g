// Fighter XP kept in localStorage. Storage may be missing (server) or throw (private mode),
// so every access is guarded and failures fall back to zero XP with a warning.

import { UnlockItem, levelForXp, unlockedBetween } from './unlocks';

export const XP_KEY = 'fighterXp';
export const MATCH_XP = 20;
export const WIN_XP = 30;

export interface Reward { gained: number; levelBefore: number; levelAfter: number; unlocked: UnlockItem[] }

const storage = (): Storage => {
    if (typeof localStorage === 'undefined') throw new Error('localStorage is not available');
    return localStorage;
};

export function loadXp(): number {
    try {
        const saved = storage().getItem(XP_KEY);
        if (saved === null) return 0;
        const xp = Number(saved);
        if (!Number.isFinite(xp) || xp < 0) throw new Error(`invalid XP value "${saved}"`);
        return Math.floor(xp);
    } catch (err) {
        console.warn(`Could not read "${XP_KEY}" from storage, using 0 XP:`, err);
        return 0;
    }
}

/** Overwrite the saved XP (a match adds to it; an account sync sets the merged total). */
export const setXp = (xp: number): void => {
    try {
        storage().setItem(XP_KEY, String(xp));
    } catch (err) {
        console.warn(`Could not save "${XP_KEY}" to storage:`, err);
    }
};

/** Add the XP for a finished match and report what the player gained. */
export function addMatchXp(won: boolean): Reward {
    const before = loadXp();
    const gained = MATCH_XP + (won ? WIN_XP : 0);
    setXp(before + gained);
    const levelBefore = levelForXp(before);
    const levelAfter = levelForXp(before + gained);
    return { gained, levelBefore, levelAfter, unlocked: unlockedBetween(levelBefore, levelAfter) };
}

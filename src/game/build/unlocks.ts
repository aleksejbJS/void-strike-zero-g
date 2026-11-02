// Which parts a fighter level opens. Pure data and rules, no storage or UI imports.
// Item k (1-based) of the order opens at level k + 1; everything not listed is free from level 1.

import { DEFAULT_BUILD, FighterBuild, SLOTS, Slot } from './buildParts';

export interface UnlockItem { slot: Slot; id: string; source: 'level'; level: number }

export const XP_PER_LEVEL = 50;

// Parts every fighter owns from the start.
export const FREE_PARTS: Record<Slot, readonly string[]> = {
    helmet: ['round', 'box'],
    visor: ['strip'],
    ears: ['none', 'cat', 'antennae'],
    tail: ['none', 'cat', 'tentacle'],
    jetpack: ['pack'],
    flame: ['fire'],
    pattern: ['none', 'band'],
    badge: ['none'],
};

// The order the parts open in, from the fighter builder spec.
const ORDER: ReadonlyArray<readonly [Slot, string]> = [
    ['ears', 'wolf'], ['visor', 'glass'], ['tail', 'lizard'], ['flame', 'blue'], ['pattern', 'stripes'],
    ['jetpack', 'tanks'], ['ears', 'horns'], ['visor', 'slit'], ['helmet', 'dome'], ['pattern', 'hazard'],
    ['flame', 'green'], ['ears', 'bunny'], ['jetpack', 'rocket'], ['badge', 'chevron'], ['visor', 't'],
    ['pattern', 'camo'], ['ears', 'round'], ['flame', 'purple'], ['tail', 'mech'], ['helmet', 'angular'],
    ['jetpack', 'wings'], ['badge', 'number'], ['ears', 'ram'], ['visor', 'eyes'], ['pattern', 'split'],
    ['ears', 'lamp'], ['flame', 'white'], ['jetpack', 'scrap'], ['badge', 'emblem'], ['ears', 'crest'],
];

export const UNLOCK_ORDER: UnlockItem[] = ORDER.map(([slot, id], index) => ({
    slot, id, source: 'level', level: index + 2,
}));

const LEVEL_BY_PART = new Map(UNLOCK_ORDER.map(item => [`${item.slot}:${item.id}`, item.level]));

/** Level for a total XP amount: 1 + floor(xp / 50). Bad input counts as no XP. */
export const levelForXp = (xp: number): number =>
    1 + Math.floor((Number.isFinite(xp) ? Math.max(0, xp) : 0) / XP_PER_LEVEL);

/** Level at which a part opens; free parts (and ids not in the order) are available from level 1. */
export const unlockLevel = (slot: Slot, id: string): number => LEVEL_BY_PART.get(`${slot}:${id}`) ?? 1;

export const isUnlocked = (slot: Slot, id: string, level: number): boolean => unlockLevel(slot, id) <= level;

/** Parts opened by going from `fromLevel` to `toLevel` (excludes the old level, includes the new one). */
export const unlockedBetween = (fromLevel: number, toLevel: number): UnlockItem[] =>
    UNLOCK_ORDER.filter(item => item.level > fromLevel && item.level <= toLevel);

/** Copy of the build where every part still locked at `level` is replaced by the default part of its slot. */
export const enforceUnlocks = (build: FighterBuild, level: number): FighterBuild => {
    const result: FighterBuild = { ...build };
    for (const slot of Object.keys(SLOTS) as Slot[]) {
        if (!isUnlocked(slot, build[slot], level)) (result[slot] as string) = DEFAULT_BUILD[slot];
    }
    return result;
};

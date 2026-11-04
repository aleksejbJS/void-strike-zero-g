// Armor rules shared by every damage path. Armor below 1 counts as none: the HUD rounds it to 0,
// so a leftover sliver must not quietly absorb damage or save a fighter from the railgun.

import { Entity } from '../../types';

const ARMOR_ABSORB = 0.66; // share of each hit the armor takes while it lasts
const MIN_ARMOR = 1;       // anything less is cleared to 0

/** True when the fighter has armor the HUD shows (1 or more). */
export const hasArmor = (e: Entity): boolean => e.armor >= MIN_ARMOR;

/** Drop a leftover below 1 to 0, so the HUD, the wound rule and the damage maths agree. */
export const clearArmorSliver = (e: Entity): void => {
    if (e.armor < MIN_ARMOR) e.armor = 0;
};

/** Let the armor take its share of `dmg`; returns the damage that goes through to health. */
export const absorbArmor = (e: Entity, dmg: number): number => {
    const absorb = hasArmor(e) ? Math.min(e.armor, dmg * ARMOR_ABSORB) : 0;
    e.armor -= absorb;
    clearArmorSliver(e);
    return dmg - absorb;
};

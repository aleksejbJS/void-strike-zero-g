// The railgun wound: a beam through armor burns it and tears a leg off instead of killing
// (spec 2026-11-03-railgun-wound). Pure rules on the entity; combat.ts decides when to use them.

import { Entity, WeaponType } from '../../types';
import { WOUND_HEALTH } from '../../constants';
import type { DamageSource } from './deathKind';

/** A railgun hit on a fighter with any armor wounds; without armor (also a wounded one) it kills as before. */
export const shouldWound = (target: Entity, source: DamageSource): boolean =>
    source.weapon === WeaponType.RAILGUN && target.armor > 0 && !source.bleed;

/**
 * Burn all armor, cap health at WOUND_HEALTH (never heals) and credit the bleed to `attackerId`;
 * a fighter who is already wounded keeps one leg and gets the newest shooter. Returns the health lost.
 */
export const inflictWound = (target: Entity, attackerId: string): number => {
    const lost = Math.max(0, target.health - WOUND_HEALTH);
    target.armor = 0;
    target.health -= lost;
    target.wound = { by: attackerId };
    return lost;
};

/** A medkit (or a new life) gives the leg back and stops the bleeding. */
export const healWound = (p: Entity): void => {
    p.wound = undefined;
};

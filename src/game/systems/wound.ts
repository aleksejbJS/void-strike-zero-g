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

/**
 * Who gets the frag when `target` dies. A wounded fighter belongs to the railgun shooter: bleeding out,
 * or dying with no other player as the killer (own splash, a fall, the Hunger zone), credits the shooter
 * with the Railgun, not the gun they hold now. Anyone else's kill, and the shooter's own other-weapon
 * kill, stays as it was.
 */
export const killCredit = (target: Entity, attackerId: string, source: DamageSource): { attackerId: string; weapon?: WeaponType } => {
    if (!target.wound) return { attackerId };
    const noOtherKiller = source.bleed || attackerId === '' || attackerId === target.id;
    return noOtherKiller ? { attackerId: target.wound.by, weapon: WeaponType.RAILGUN } : { attackerId };
};

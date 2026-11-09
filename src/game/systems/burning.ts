// Burning: a fighter hit by the flame stream burns for BURN_MS after the last hit and loses BURN_DAMAGE every
// BURN_TICK_MS (spec 2026-11-07-flamethrower). Own module like bleeding.ts: applyDamage (combat.ts) calls extinguish.
// combat.ts and this file import each other: only use the other's exports inside functions, never at load time.

import type { Entity, GameState } from '../../types';
import { WeaponType } from '../../types';
import { applyDamage } from './combat';
import { BURN_DAMAGE, BURN_MS, BURN_TICK_MS } from './flameConstants';

/** True while the fire lasts. */
export const isBurning = (p: Pick<Entity, 'burnUntil'>, now: number): boolean =>
    p.burnUntil !== undefined && now < p.burnUntil;

/**
 * Sets the target on fire, or restarts the 5 s of a fire already burning (it never stacks). The newest arsonist
 * takes the credit. A refresh keeps the tick schedule, so a fighter held in the flame never skips or doubles a tick.
 */
export const igniteBurn = (target: Entity, by: string, now: number): void => {
    const wasBurning = isBurning(target, now);
    target.burnUntil = now + BURN_MS;
    target.burnBy = by;
    if (!wasBurning) target.burnTickAt = now + BURN_TICK_MS;
};

/** Puts the fire out: a death does it, and so does a new life. */
export const extinguish = (p: Entity): void => {
    p.burnUntil = undefined;
    p.burnTickAt = undefined;
    p.burnBy = undefined;
};

/**
 * Burn damage for every living burning fighter: one tick per BURN_TICK_MS until the fire ends (10 HP over a full burn).
 * Ticks a stalled loop missed are made up in one call, so the total stays exact. Plain health loss (no armor, knockback
 * or damage number); a burn death is credited to the arsonist inside applyDamage.
 * Paused once the Hunger round is decided, like bleeding.
 */
export const tickBurning = (state: GameState, now: number): void => {
    if (state.hungerRoundEndsAt) return;
    for (const p of state.players) {
        if (p.dead || p.burnUntil === undefined) continue;
        // The arsonist is never the victim here: self-damage would halve the burn (SELF_DAMAGE_MULT)
        while (!p.dead && p.burnTickAt !== undefined && now >= p.burnTickAt && p.burnTickAt <= p.burnUntil) {
            p.burnTickAt += BURN_TICK_MS;
            applyDamage(state, p, p.burnBy ?? '', BURN_DAMAGE, { x: 0, y: 0 }, 0, { weapon: WeaponType.FLAMETHROWER, burn: true });
        }
        if (!p.dead && now >= p.burnUntil) extinguish(p);
    }
};

// Bleeding: a wounded fighter loses BLEED_HP_PER_S health every second until a medkit
// (spec 2026-11-03-railgun-wound). Its own module: applyDamage (combat.ts) already imports wound.ts.

import { GameState } from '../../types';
import { BLEED_HP_PER_S, PHYSICS_TICK_RATE } from '../../constants';
import { applyDamage } from './combat';

/**
 * One tick of bleeding for every living wounded fighter. Plain health loss (no armor, knockback or
 * damage number); a bleed-out death is credited to the railgun shooter inside applyDamage.
 * Paused once the Hunger round is decided, so a wounded winner never bleeds out on the victory screen
 * (updatePhysics already stops before this at match end).
 */
export const tickBleeding = (state: GameState): void => {
    if (state.hungerRoundEndsAt) return;
    for (const p of state.players) {
        if (p.dead || !p.wound) continue;
        // Attacker is the shooter, never the victim: self-damage would halve the bleed (SELF_DAMAGE_MULT)
        applyDamage(state, p, p.wound.by, BLEED_HP_PER_S / PHYSICS_TICK_RATE, { x: 0, y: 0 }, 0, { bleed: true });
    }
};

// A fighter under spawn protection flickers half-transparent, so everyone sees it can't be hurt yet.

import { Entity } from '../../types';
import { spawnShieldLeft } from '../systems/spawnShield';

const BLINK_MS = 120;   // one phase of the flicker
const ALPHA_DIM = 0.35;
const ALPHA_BRIGHT = 0.85;

/** The fighter's opacity this frame: flickering while shielded, solid otherwise. */
export const spawnShieldAlpha = (p: Pick<Entity, 'spawnShieldUntil'>, now: number): number => {
    if (spawnShieldLeft(p, now) <= 0) return 1;
    return Math.floor(now / BLINK_MS) % 2 === 0 ? ALPHA_DIM : ALPHA_BRIGHT;
};

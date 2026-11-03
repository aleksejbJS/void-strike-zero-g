// The health number on the HUD (the real value keeps its fraction: bleeding takes 1/120 HP per tick).

import { Entity } from '../../types';

/**
 * Whole points. A bleeding fighter is rounded up, so the last half second of a bleed does not read 0
 * while the fighter is still alive.
 */
export const hudHealth = (p: Pick<Entity, 'health' | 'wound'>): number =>
    p.wound ? Math.ceil(p.health) : Math.round(p.health);

// Blood that drips from the stump of a one-legged fighter: a drop every DRIP_MS, however often it is asked for.
// Each fighter keeps its own clock, so two bleeding fighters never take drops from each other.

import { GameState } from '../../../types';
import { createParticles } from '../../systems/effectSpawn';
import { sparksAt } from '../../systems/robotDamage';

export const DRIP_MS = 150;
const DRIP_COLOR = '#dc2626';
const DRIFT = 0.3;   // sideways speed of a drop, either way

export class BleedDrips {
    private lastAt = -Infinity;

    /** One drop at (x, y) unless one fell less than DRIP_MS ago. A clock that steps back starts a new count. */
    spawn(state: GameState, x: number, y: number, now: number, color = DRIP_COLOR): void {
        if (now >= this.lastAt && now - this.lastAt < DRIP_MS) return;
        this.lastAt = now;
        createParticles(state, x, y, 1, color, 'blood', { vel: { x: (Math.random() - 0.5) * 2 * DRIFT, y: 0 } });
    }
}

/** A robot stump's cables short out now and then: a small burst every 0.6-1.2 s (never twice in one window). */
export class StumpSparks {
    private nextAt = -Infinity;

    spawn(state: GameState, x: number, y: number, now: number): void {
        if (now < this.nextAt) return;
        this.nextAt = now + 600 + Math.random() * 600;
        sparksAt(state, x, y, 4);
    }
}

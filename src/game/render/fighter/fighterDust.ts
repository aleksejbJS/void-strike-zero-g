// Dust a fighter kicks up: a small puff at the planted foot of each running step and a burst on landing.
// Each fighter keeps the particles it spawned and never has more than DUST_CAP of them alive.

import { GameState, Particle } from '../../../types';
import { createParticles } from '../../systems/effectSpawn';

export const DUST_CAP = 12;
const DUST_COLOR = '#beb4a0';
const STEP_PUSH = { x: 0.8, y: -0.3 };   // x is applied against the running direction
const LANDING_PUFFS_PER_SIDE = 3;
const LANDING_SPEED_X = 2.2;
const LANDING_LIFT = { min: 0.2, max: 0.8 }; // upward speed

export class DustBudget {
    private live: Particle[] = [];

    /** One small puff at the front foot, blown back against the running direction (dir is 1 or -1). */
    spawnStep(state: GameState, x: number, y: number, dir: number): void {
        this.spawn(state, x, y, 1, () => ({ x: -dir * STEP_PUSH.x, y: STEP_PUSH.y }));
    }

    /** Six puffs thrown out to both sides of the feet. */
    spawnLanding(state: GameState, x: number, y: number): void {
        const sides = [-1, 1];
        for (const side of sides) {
            this.spawn(state, x, y, LANDING_PUFFS_PER_SIDE, () => ({
                x: side * LANDING_SPEED_X,
                y: -(LANDING_LIFT.min + Math.random() * (LANDING_LIFT.max - LANDING_LIFT.min)),
            }));
        }
    }

    /** Adds up to `count` puffs, as many as the cap leaves room for. */
    private spawn(state: GameState, x: number, y: number, count: number, velocity: () => { x: number; y: number }) {
        // A puff is alive while it fades in this state; a replaced state (new match) drops them all
        this.live = this.live.filter(p => p.life > 0 && state.particles.includes(p));
        const room = Math.min(count, DUST_CAP - this.live.length);
        for (let i = 0; i < room; i++) {
            this.live.push(...createParticles(state, x, y, 1, DUST_COLOR, 'dust', { vel: velocity() }));
        }
    }
}

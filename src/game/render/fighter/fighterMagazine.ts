// The empty magazine that drops out of the gun when a reload starts. Cosmetic only: the
// simulation just sets the weapon's reload timer, every client sees it and drops its own magazine.

import { GameState, Vector2, Weapon } from '../../../types';
import { createParticles } from '../../systems/effectSpawn';

const MAG_DECAY = 0.006;          // life lost per tick: ~1.4 s at 120 ticks/s, long enough to land and lie
const MAG_FLING = { x: 0.6, y: -1.2 }; // a small toss backwards and up, then gravity takes it
const MAG_SIZE = 5;

export class MagazineDrop {
    // null = not looked yet: a fighter first seen mid-reload drops nothing
    private seen: { type: string; reloading: boolean } | null = null;

    /**
     * Call once per frame with the held weapon. Drops a magazine at `at` (world position of the
     * gun's grip) when the weapon goes from not reloading to reloading. A changed weapon only
     * resets the memory: switching back to a gun that is reloading in the background drops nothing.
     * Reload timers jitter by a few ms between snapshots online, so only the start counts, not the value.
     */
    update(game: GameState, weapon: Weapon, at: Vector2, facing: number): boolean {
        const reloading = weapon.reloadEndsAt !== undefined;
        const started = this.seen !== null && this.seen.type === weapon.type && !this.seen.reloading && reloading;
        this.seen = { type: weapon.type, reloading };
        if (!started) return false;
        createParticles(game, at.x, at.y, 1, '#2b3038', 'magazine', {
            vel: { x: -facing * MAG_FLING.x, y: MAG_FLING.y },
            decay: MAG_DECAY,
            size: MAG_SIZE,
        });
        return true;
    }
}

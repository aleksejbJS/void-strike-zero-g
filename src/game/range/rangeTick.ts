// One step of the test range (#range): the reset key, endless ammo and fuel, the delayed return of killed dummies
// and the armour toggle. Run once per fixed step AFTER syncGameState and BEFORE updatePhysics: syncGameState
// overwrites player.pos from the physics body, so a revive written before it would be lost. It only changes
// GameState; the physics engine picks positions and dead/alive state up after updatePhysics (syncFromGameState).

import type { Entity, GameState } from '../../types';
import { DUMMY_RETURN_MS } from './rangeState';
import type { RangeState } from './rangeState';
import { dummyArmor, resetRange, reviveDummy } from './rangeReset';

// The armour setting the living dummies were last set to. Armour is only refilled when K changes it (or a
// dummy returns), so the damage it soaks stays visible. A new range starts unarmoured, like its dummies.
const appliedArmor = new WeakMap<RangeState, boolean>();

const refillLocal = (local: Entity | undefined): void => {
    if (!local) return;
    for (const weapon of local.inventory) weapon.ammo = weapon.maxAmmo;
    local.jetpackFuel = local.maxFuel;
};

/** A dead dummy is held out of the normal respawn (it would go to the player spawn) until its 3 s are up. */
const tickDeadDummy = (state: GameState, range: RangeState, d: Entity, now: number): void => {
    const diedAt = range.diedAt[d.id];
    if (diedAt === undefined) {
        range.diedAt[d.id] = now;
        d.respawnTimer = Number.MAX_SAFE_INTEGER;
    } else if (now - diedAt >= DUMMY_RETURN_MS) {
        reviveDummy(state, d, now);
    }
};

const syncArmor = (state: GameState, range: RangeState): void => {
    if ((appliedArmor.get(range) ?? false) === range.armored) return;
    appliedArmor.set(range, range.armored);
    for (const d of state.players) {
        if (d.dummy && !d.dead) d.armor = dummyArmor(d, range);
    }
};

export const tickRange = (state: GameState, localId: string, now: number): void => {
    const range = state.range;
    if (!range) return;
    if (range.resetRequested) {
        resetRange(state, now);
        range.resetRequested = false;
    }
    refillLocal(state.players.find(p => p.id === localId));
    for (const d of state.players) {
        if (d.dummy && d.dead) tickDeadDummy(state, range, d, now);
    }
    syncArmor(state, range);
};

// Putting the test range back as it was: a dummy stands up on its own spot (the 3 s return and R) and R
// also mends the cover and clears the shots and effects in the air. Everything is changed in place, so
// the physics engine keeps the bodies it already has for the players and the cover.

import type { Entity, GameState } from '../../types';
import { liftOutOfCover } from '../cover/coverSpawn';
import { restoreAllCover } from '../cover/coverTick';
import { extinguish } from '../systems/burning';
import { clearMarks } from '../systems/marks';
import { DUMMY_SPOTS } from './rangeMap';
import type { RangeState } from './rangeState';

/** The armour a dummy has when it is set or comes back: full when the K toggle is on, none otherwise. */
export const dummyArmor = (d: Entity, range: RangeState | undefined): number => (range?.armored ? d.maxArmor : 0);

/** Stands `d` up alive on a fresh copy of its own spot: full health, armour by the toggle, still, no wound or fire. */
export const reviveDummy = (state: GameState, d: Entity, _now: number): void => {
    const spot = DUMMY_SPOTS.find(s => s.skinId === d.skinId);
    if (!spot) throw new Error(`Range dummy has no spot: ${d.id}`);
    d.dead = false;
    d.respawnTimer = 0;
    d.pos = { ...spot.pos };
    d.vel = { x: 0, y: 0 };
    d.health = d.maxHealth;
    d.armor = dummyArmor(d, state.range);
    d.wound = undefined;
    extinguish(d);
    if (state.range) delete state.range.diedAt[d.id];
};

/**
 * R: every cover piece whole, every dummy back on its spot (dead or alive), the local fighter out and at full
 * health (standing on top of a piece that came back under their feet, otherwise where they were), and no shots,
 * beams, smoke, sparks, decals, scorch marks, corpses, lit tanks or damage numbers left.
 */
export const resetRange = (state: GameState, now: number): void => {
    restoreAllCover(state);
    for (const p of state.players) {
        if (p.dummy) {
            reviveDummy(state, p, now);
        } else { // the range holds only the local fighter besides the dummies
            extinguish(p);
            p.health = p.maxHealth;
            liftOutOfCover(state, p); // after restoreAllCover: it must see the pieces that came back
        }
    }
    state.projectiles.length = 0;
    state.beams.length = 0;
    if (state.smokes) state.smokes.length = 0;
    state.particles.length = 0;
    state.decals.length = 0;
    clearMarks(); // scorch marks live in a module-level list, not in the state
    state.corpses.length = 0;
    if (state.litTanks) state.litTanks.length = 0;
    state.floatingTexts.length = 0;
};

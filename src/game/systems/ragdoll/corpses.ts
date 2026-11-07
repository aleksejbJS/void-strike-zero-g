// The corpses lying in the world: adding one per death, stepping them, and the cap on how many.
// Display side only: each client builds its own corpses from DEATH events, the server never does.

import { GameState, WeaponType } from '../../../types';
import type { DeathEvent, LimbEvent } from '../events';
import { isDeathKind } from '../deathKind';
import { Corpse, createCorpse } from './corpseBody';
import { stepCorpse } from './corpseStep';
import { launchCorpse, launchLimb } from './corpseLaunch';
import { corpseTankFire } from './corpseTank';

/** At most this many bodies lie before the oldest one starts fading (torn legs do not count). */
export const MAX_CORPSES = 12;

const STILL = { x: 0, y: 0 };

const WEAPON_TYPES: ReadonlySet<unknown> = new Set(Object.values(WeaponType));

/** The held weapon if it is one we know; a host may send anything (a number would break drawing every frame). */
const knownWeapon = (weapon: unknown): WeaponType | undefined =>
    WEAPON_TYPES.has(weapon) ? weapon as WeaponType : undefined;

/** Start the corpse's fade now (it keeps its usual fade length); one already fading is left alone. */
const fadeNow = (c: Corpse) => {
    if (c.fadeAt <= c.age) return;
    const fade = c.removeAt - c.fadeAt;
    c.fadeAt = c.age;
    c.removeAt = Math.min(c.removeAt, c.age + fade);
};

/**
 * Only bodies that are not fading yet count toward the cap: when it is reached, the oldest starts to fade.
 * A torn leg (`only`) is no body: it neither counts nor makes room, so it never takes a body's place.
 */
const makeRoom = (state: GameState) => {
    const lying = state.corpses.filter(c => !c.only && c.fadeAt > c.age);
    if (lying.length >= MAX_CORPSES) fadeNow(lying[0]);
};

/**
 * A corpse for a DEATH event, launched by its kind. Older hosts send no kind and no vel, a newer or
 * hostile host may send a kind we do not know: those fall, still. An unknown weapon is dropped, and
 * only a real boolean says it had lost a leg, and only a string names a lit fuel tank on its back.
 */
export const addCorpse = (state: GameState, e: DeathEvent): Corpse => {
    makeRoom(state);
    const oneLeg = typeof e.oneLeg === 'boolean' ? e.oneLeg : undefined;
    const corpse = createCorpse({ ...e, kind: isDeathKind(e.kind) ? e.kind : 'fall', weapon: knownWeapon(e.weapon), oneLeg });
    // A host may send anything: only a real boolean says shot or splash
    launchCorpse(corpse, e.from, e.vel ?? STILL, typeof e.blast === 'boolean' ? e.blast : undefined);
    if (typeof e.tank === 'string') corpse.tankId = e.tank;
    state.corpses.push(corpse);
    return corpse;
};

/** A leg torn off a wounded fighter, as a corpse of its own that is only the back leg, thrown along the beam from `e.from`. */
export const addLimb = (state: GameState, e: LimbEvent): Corpse => {
    const leg = createCorpse({ x: e.x, y: e.y, facing: e.facing, kind: 'gib', parts: e.parts });
    leg.only = 'leg-back';
    launchLimb(leg, e.from, e.vel ?? STILL);
    state.corpses.push(leg);
    return leg;
};

/** One physics tick for every corpse (a lit tank on one burns); corpses whose time is up are removed. */
export const updateCorpses = (state: GameState): void => {
    for (const c of state.corpses) stepCorpse(c, state.platforms);
    corpseTankFire(state);
    state.corpses = state.corpses.filter(c => c.age < c.removeAt);
};

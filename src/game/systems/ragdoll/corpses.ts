// The corpses lying in the world: adding one per death, stepping them, and the cap on how many.
// Display side only: each client builds its own corpses from DEATH events, the server never does.

import { GameState } from '../../../types';
import type { DeathEvent } from '../events';
import { isDeathKind } from '../deathKind';
import { Corpse, createCorpse } from './corpseBody';
import { stepCorpse } from './corpseStep';
import { launchCorpse } from './corpseLaunch';

/** At most this many corpses lie before the oldest one starts fading. */
export const MAX_CORPSES = 12;

const STILL = { x: 0, y: 0 };

/** Start the corpse's fade now (it keeps its usual fade length); one already fading is left alone. */
const fadeNow = (c: Corpse) => {
    if (c.fadeAt <= c.age) return;
    const fade = c.removeAt - c.fadeAt;
    c.fadeAt = c.age;
    c.removeAt = Math.min(c.removeAt, c.age + fade);
};

/**
 * A corpse for a DEATH event, launched by its kind. Older hosts send no kind and no vel, a newer or
 * hostile host may send a kind we do not know: those fall, still.
 */
export const addCorpse = (state: GameState, e: DeathEvent): Corpse => {
    // Only corpses that are not fading yet count toward the cap
    const lying = state.corpses.filter(c => c.fadeAt > c.age);
    if (lying.length >= MAX_CORPSES) fadeNow(lying[0]);
    const corpse = createCorpse({ ...e, kind: isDeathKind(e.kind) ? e.kind : 'fall' });
    // A host may send anything: only a real boolean says shot or splash
    launchCorpse(corpse, e.from, e.vel ?? STILL, typeof e.blast === 'boolean' ? e.blast : undefined);
    state.corpses.push(corpse);
    return corpse;
};

/** One physics tick for every corpse; corpses whose time is up are removed. */
export const updateCorpses = (state: GameState): void => {
    for (const c of state.corpses) stepCorpse(c, state.platforms);
    state.corpses = state.corpses.filter(c => c.age < c.removeAt);
};

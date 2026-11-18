// The test range's (#range) part of the offline game: GameCanvas calls these thin hooks from its level setup, its
// fixed step and its key handler. Every hook does nothing outside GameMode.RANGE, so no other mode runs range code.
// One RangeLoop lives as long as the GameCanvas; `setup` starts a new range session on it.

import { GameMode } from '../../types';
import type { GameState } from '../../types';
import { pinRangeCamera } from './rangeCamera';
import { applyRangeKey } from './rangeKeys';
import { createReadoutMemory, rebaseReadout, trackRangeDamage } from './rangeReadout';
import type { ReadoutMemory } from './rangeReadout';
import { setupRange } from './rangeSetup';
import type { RangeState } from './rangeState';
import { tickRange } from './rangeTick';

/** The range settings of `state`, or undefined when it is not a range. */
const rangeOf = (state: GameState): RangeState | undefined =>
    (state.mode === GameMode.RANGE ? state.range : undefined);

export class RangeLoop {
    private memory: ReadoutMemory = createReadoutMemory();

    /** The damage log the on-world readout draws from. */
    get readout(): ReadoutMemory {
        return this.memory;
    }

    /**
     * Level setup, after the local fighter is added and before the physics bodies are made (the dummies need theirs).
     * Returns the legend's copy of the new settings, or null when the match is not a range.
     */
    setup(state: GameState, localId: string): RangeState | null {
        if (state.mode !== GameMode.RANGE) return null;
        const local = state.players.find(p => p.id === localId);
        if (!local) throw new Error(`Test range has no local fighter: ${localId}`);
        setupRange(state, local);
        this.memory = createReadoutMemory();
        return { ...state.range! };
    }

    /** Fixed step, after syncGameState and before updatePhysics: reset, refills, dummies' return, armour. */
    beforePhysics(state: GameState, localId: string, now: number): void {
        const range = rangeOf(state);
        if (!range) return;
        const resetting = range.resetRequested;
        tickRange(state, localId, now);
        if (resetting) this.memory = createReadoutMemory(); // R also clears the "last 3 s" totals
        rebaseReadout(this.memory, state); // what tickRange changed is no damage
    }

    /** Fixed step, right after updatePhysics: the camera stays on the room, and this step's damage is logged. */
    afterPhysics(state: GameState, now: number): void {
        if (!rangeOf(state)) return;
        pinRangeCamera(state);
        trackRangeDamage(this.memory, state, now);
    }

    /** A key press: a range key (not a held-down repeat) changes the settings and returns the legend's new copy. */
    key(code: string, repeat: boolean, state: GameState): RangeState | null {
        const range = rangeOf(state);
        if (!range || repeat || !applyRangeKey(code, range)) return null;
        return { ...range };
    }
}

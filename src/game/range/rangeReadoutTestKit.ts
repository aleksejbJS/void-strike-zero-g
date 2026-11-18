// Shared helpers for the readout tests: a range with a memory that has already seen it whole, and a real hit on a dummy

import { vi } from 'vitest';
import type { Entity } from '../../types';
import { applyDamage } from '../systems/combat';
import type { DamageSource } from '../systems/deathKind';
import { LOCAL_ID, rangeFixture } from './rangeTestKit';
import type { RangeFixture } from './rangeTestKit';
import { createReadoutMemory, trackRangeDamage } from './rangeReadout';
import type { ReadoutMemory } from './rangeReadout';

/** The test clock's start; tests set it with vi.setSystemTime(T) because applyDamage reads Date.now(). */
export const T = 1_000_000;

export interface ReadoutSession extends RangeFixture {
    memory: ReadoutMemory;
    dummy: Entity; // the first dummy, the one the hits go to
}

/** A started range plus a memory with the baseline of a fresh session (no damage logged yet). */
export const readoutSession = (): ReadoutSession => {
    const fx = rangeFixture();
    const memory = createReadoutMemory();
    trackRangeDamage(memory, fx.state, T);
    return { ...fx, memory, dummy: fx.dummies[0] };
};

/** A real hit on the session's dummy at `at`, then the tracker's step. */
export const hitDummy = (s: ReadoutSession, amount: number, at: number, source: DamageSource = {}): void => {
    vi.setSystemTime(at);
    applyDamage(s.state, s.dummy, LOCAL_ID, amount, { x: 0, y: 0 }, 0, source);
    trackRangeDamage(s.memory, s.state, at);
};

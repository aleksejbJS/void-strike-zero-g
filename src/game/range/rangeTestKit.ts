// Shared helpers for the range tests: a started range (player, dummies, cover, platforms) and one physics tick

import { GameMode, MapId, Team } from '../../types';
import type { Entity, GameState } from '../../types';
import { createMockPlayer, createMockState } from '../../test/mocks';
import { getPlatforms } from '../data/level';
import { getCoverLayout } from '../cover/coverLayout';
import { updatePhysics } from '../systems/physics';
import { RANGE_SPAWN } from './rangeMap';
import { setupRange } from './rangeSetup';
import type { RangeState } from './rangeState';

export const LOCAL_ID = 'player';

/** Where the normal respawn would put a fighter: nowhere near any dummy spot. */
export const NORMAL_SPAWN = { x: 77, y: 77 };

export interface RangeFixture {
    state: GameState;
    local: Entity;
    range: RangeState;
    dummies: Entity[];
}

/** A range as GameCanvas builds it: the room's platforms and cover, the local fighter, five dummies. */
export const rangeFixture = (): RangeFixture => {
    const state = createMockState(GameMode.RANGE);
    state.platforms = getPlatforms(GameMode.RANGE);
    state.cover = getCoverLayout(GameMode.RANGE, MapId.DEFAULT);
    const local = Object.assign(createMockPlayer(LOCAL_ID, Team.NONE), { pos: { ...RANGE_SPAWN } });
    state.players.push(local);
    setupRange(state, local);
    return { state, local, range: state.range as RangeState, dummies: state.players.filter(p => p.dummy) };
};

/** One simulation tick; the clock is Date.now(), so tests set it with vi.setSystemTime. */
export const physicsTick = (state: GameState): void =>
    updatePhysics(state, {}, { x: 0, y: 0 }, false, false, 800, 600, () => NORMAL_SPAWN, LOCAL_ID);

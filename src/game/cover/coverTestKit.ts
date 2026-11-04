// Shared helpers for the cover-hit tests: a state with cover and one physics tick

import { GameMode } from '../../types';
import type { GameState } from '../../types';
import { createMockState } from '../../test/mocks';
import { updatePhysics } from '../systems/physics';
import { COVER_SPECS, Cover, CoverKind } from './coverTypes';

/** A full-hp piece; `x` is its centre, `bottomY` its feet line (the game's pos convention). */
export const piece = (id: string, kind: CoverKind, x: number, bottomY: number, hp: number = COVER_SPECS[kind].hp): Cover =>
    ({ id, kind, pos: { x, y: bottomY }, hp });

/** A Deathmatch state holding the given cover and no fighters. */
export const stateWithCover = (...cover: Cover[]): GameState =>
    Object.assign(createMockState(GameMode.DEATHMATCH), { cover });

/** One simulation tick (projectiles fly, cover upkeep runs). */
export const tick = (state: GameState): void =>
    updatePhysics(state, {}, { x: 0, y: 0 }, false, false, 800, 600, () => ({ x: 0, y: 0 }), 'nobody');

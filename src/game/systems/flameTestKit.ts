// Shared helpers for the flame stream tests: an arena with a flamethrower fighter and enemies to burn

import { GameMode, Team, WeaponType } from '../../types';
import type { Entity, GameState } from '../../types';
import { createMockState, createMockPlayer } from '../../test/mocks';
import { fireFlame } from './flamethrower';

/** A fixed clock for cover timers. */
export const NOW = 1_000_000;
/** A standing fighter at (0, 0) fires from 50 px up. */
export const MUZZLE_Y = -50;
export const ORIGIN = { x: 0, y: MUZZLE_Y };
export const RIGHT = { x: 1, y: 0 };

/** A Deathmatch state with a flamethrower fighter at (0, 0), already in `state.players`. */
export const arena = (team = Team.NONE): { state: GameState; shooter: Entity } => {
    const state = createMockState(GameMode.DEATHMATCH);
    const shooter = createMockPlayer('shooter', team, WeaponType.FLAMETHROWER);
    state.players.push(shooter);
    return { state, shooter };
};

/** An enemy standing at x with its feet at y (the hitbox is 30 x 72, so y = 0 puts the aim line inside it). */
export const enemyAt = (state: GameState, id: string, x: number, y = 0, team = Team.NONE): Entity => {
    const e = createMockPlayer(id, team);
    e.pos = { x, y };
    state.players.push(e);
    return e;
};

/** One tick of the stream from the shooter's muzzle. */
export const spray = (state: GameState, shooter: Entity, dir = RIGHT): void => fireFlame(state, shooter, ORIGIN, dir, NOW);

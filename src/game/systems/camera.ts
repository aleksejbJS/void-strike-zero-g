// Camera follow with smoothing

import { Entity, GameMode, GameState } from '../../types';

const HEAD_OFFSET_Y = 50;

/**
 * Who the camera follows: our own player; in Hunger Games a spectator follows
 * their bet target, then the winner, then anyone still alive.
 */
export const pickCameraTarget = (state: GameState, localId: string): Entity | undefined => {
    const local = state.players.find(p => p.id === localId) ?? state.players[0];
    if (state.mode !== GameMode.HUNGER_GAMES) return local;

    const alive = (id?: string | null) => state.players.find(p => p.id === id && !p.dead);
    return alive(state.betSpectateId)
        ?? state.players.find(p => p.id === state.hungerWinnerId)
        ?? (local && !local.dead ? local : undefined)
        ?? state.players.find(p => !p.dead)
        ?? local;
};

/** Smoothly move the camera toward `target` (feet position, offset to roughly head height). */
export const followCamera = (state: GameState, target: Entity | undefined) => {
    if (!target) return;
    const smoothing = state.mode === GameMode.HUNGER_GAMES ? 0.2 : 0.12;
    state.camera.x += (target.pos.x - state.camera.x) * smoothing;
    state.camera.y += (target.pos.y - HEAD_OFFSET_Y - state.camera.y) * smoothing;
};

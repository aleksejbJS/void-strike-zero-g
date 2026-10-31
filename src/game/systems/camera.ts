// Camera follow with smoothing

import { Entity, GameMode, GameState } from '../../types';

const HEAD_OFFSET_Y = 50;

/** Smoothly move the camera toward `target` (feet position, offset to roughly head height). */
export const followCamera = (state: GameState, target: Entity | undefined) => {
    if (!target) return;
    const smoothing = state.mode === GameMode.HUNGER_GAMES ? 0.2 : 0.12;
    state.camera.x += (target.pos.x - state.camera.x) * smoothing;
    state.camera.y += (target.pos.y - HEAD_OFFSET_Y - state.camera.y) * smoothing;
};

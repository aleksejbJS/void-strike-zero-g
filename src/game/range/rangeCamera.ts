// The test range (#range) has a fixed camera: the whole room is always in view, whoever moves.

import type { GameState } from '../../types';
import { RANGE_CAMERA } from './rangeMap';

/** Puts the camera on the room centre (zoom untouched). Run after updatePhysics, whose camera follow it undoes. */
export const pinRangeCamera = (state: GameState): void => {
    state.camera.x = RANGE_CAMERA.x;
    state.camera.y = RANGE_CAMERA.y;
};

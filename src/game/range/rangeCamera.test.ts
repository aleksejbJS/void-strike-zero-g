import { describe, it, expect } from 'vitest';
import { GameMode } from '../../types';
import { createMockState } from '../../test/mocks';
import { pinRangeCamera } from './rangeCamera';
import { RANGE_CAMERA } from './rangeMap';

describe('pinRangeCamera', () => {
    it('puts the camera on the room centre and keeps the zoom', () => {
        const state = createMockState(GameMode.RANGE);
        state.camera = { x: 123, y: -45, zoom: 1.5 };
        pinRangeCamera(state);
        expect(state.camera).toEqual({ x: RANGE_CAMERA.x, y: RANGE_CAMERA.y, zoom: 1.5 });
    });

    it('never shares RANGE_CAMERA: moving the camera later leaves the constant alone', () => {
        const state = createMockState(GameMode.RANGE);
        pinRangeCamera(state);
        state.camera.x += 500;
        expect(RANGE_CAMERA).toEqual({ x: 750, y: 400 });
    });
});

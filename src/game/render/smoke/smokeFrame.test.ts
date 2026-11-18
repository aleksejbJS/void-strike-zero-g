import { describe, it, expect } from 'vitest';
import { smokeFrameOf } from './smokeFrame';
import { stateOf } from './cloudField.testkit';

const at = (x: number, y: number) => stateOf({ camera: { x, y, zoom: 1 } });

describe('smokeFrameOf', () => {
    it('puts the view box around the camera, the size of the virtual screen', () => {
        const frame = smokeFrameOf(null, at(1000, 500), null, { w: 1600, h: 900 }, 'high');
        expect(frame.view).toEqual({ x: 200, y: 50, w: 1600, h: 900 });
        expect(frame.quality).toBe('high');
    });

    it('follows a smaller or larger screen and a moved camera', () => {
        const frame = smokeFrameOf(null, at(0, 0), null, { w: 800, h: 450 }, 'low');
        expect(frame.view).toEqual({ x: -400, y: -225, w: 800, h: 450 });
        smokeFrameOf(frame, at(300, 100), null, { w: 2000, h: 900 }, 'medium');
        expect(frame.view).toEqual({ x: -700, y: -350, w: 2000, h: 900 });
        expect(frame.quality).toBe('medium');
    });

    it('reuses the frame it is given and carries the state and the flame view', () => {
        const first = at(0, 0), second = at(10, 10);
        const flame = { streams: () => [], soot: () => [] };
        const frame = smokeFrameOf(null, first, null, { w: 100, h: 100 }, 'high');
        const view = frame.view;
        const again = smokeFrameOf(frame, second, flame, { w: 100, h: 100 }, 'high');
        expect(again).toBe(frame);
        expect(again.view).toBe(view);
        expect(again.state).toBe(second);
        expect(again.flame).toBe(flame);
    });
});

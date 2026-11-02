import { describe, expect, it } from 'vitest';
import { MIN_ZOOM, screenToWorld, toView, VIEW_HEIGHT, VIEW_WIDTH, viewportOf } from './viewport';

describe('viewportOf', () => {
    it.each([[1280, 720], [1920, 1080], [2560, 1440], [3840, 2160]])('shows the same 16:9 slice on a %ix%i window', (w, h) => {
        const v = viewportOf(w, h);
        expect(v.w).toBeCloseTo(VIEW_WIDTH);
        expect(v.h).toBeCloseTo(VIEW_HEIGHT);
        expect(v.zoom).toBeCloseTo(w / VIEW_WIDTH);
    });

    it('shows extra width on an ultra-wide window instead of cutting the height', () => {
        const v = viewportOf(3440, 1440);
        expect(v.h).toBeCloseTo(VIEW_HEIGHT);
        expect(v.w).toBeGreaterThan(VIEW_WIDTH);
    });

    it('shows extra height on a tall window instead of cutting the width', () => {
        const v = viewportOf(1600, 1200);
        expect(v.w).toBeCloseTo(VIEW_WIDTH);
        expect(v.h).toBeGreaterThan(VIEW_HEIGHT);
    });

    it('never zooms out below the floor on a phone', () => {
        const v = viewportOf(844, 390);
        expect(v.zoom).toBe(MIN_ZOOM);
        expect(v.w).toBeCloseTo(844 / MIN_ZOOM);
    });

    it('falls back to 1:1 before the canvas has a size', () => {
        expect(viewportOf(0, 0)).toEqual({ zoom: 1, w: 0, h: 0 });
    });
});

describe('screenToWorld', () => {
    it('puts the window centre on the camera at any zoom', () => {
        for (const [w, h] of [[1280, 720], [2560, 1440], [844, 390]]) {
            const v = viewportOf(w, h);
            const p = screenToWorld({ x: w / 2, y: h / 2 }, { x: 500, y: -200 }, v);
            expect(p.x).toBeCloseTo(500);
            expect(p.y).toBeCloseTo(-200);
        }
    });

    it('maps the window corner to the corner of the visible world', () => {
        const v = viewportOf(2560, 1440);
        const p = screenToWorld({ x: 0, y: 0 }, { x: 0, y: 0 }, v);
        expect(p.x).toBeCloseTo(-VIEW_WIDTH / 2);
        expect(p.y).toBeCloseTo(-VIEW_HEIGHT / 2);
    });

    it('agrees with toView plus the old 1:1 formula on the virtual screen', () => {
        const v = viewportOf(1920, 1080);
        const camera = { x: 120, y: 40 };
        const m = toView({ x: 300, y: 900 }, v);
        expect(screenToWorld({ x: 300, y: 900 }, camera, v)).toEqual({ x: m.x - v.w / 2 + camera.x, y: m.y - v.h / 2 + camera.y });
    });
});

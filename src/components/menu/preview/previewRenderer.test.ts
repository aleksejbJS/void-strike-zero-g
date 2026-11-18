import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { Container, Mesh, type Application } from 'pixi.js';
import type { GameState } from '../../../types';
import { SmokeView } from '../../../game/render/effects/smokeView';
import { frameOf, stateOf } from '../../../game/render/smoke/cloudField.testkit';
import { createPreviewRenderer } from './previewRenderer';

// The map look and the match renderer are replaced: this test is about what the preview frees when it is torn down
const calls: string[] = [];
let realSmoke = false;      // true: syncVisuals makes a real SmokeView (and warms it up) instead of a fake that only records clear()
vi.mock('../../../game/render/scene/mapLook', () => ({
    createMapLook: () => ({ redraw: () => {}, update: () => {}, destroy: () => { calls.push('look.destroy'); } }),
}));
vi.mock('../../../game/systems/renderer', () => ({
    drawZoneOverlay: () => {},
    // What the real syncVisuals does on a frame: it makes the effect views the preview must free
    syncVisuals: (_view: unknown, _world: unknown, gameLayer: Container, _decal: unknown, _ui: unknown, _state: unknown, cache: Record<string, unknown>) => {
        if (realSmoke) {
            const smoke = cache.smokeView ??= new SmokeView(gameLayer) as SmokeView;
            (smoke as SmokeView).sync([], 1000, null, frameOf(stateOf(), undefined, 'high'));
        } else {
            cache.smokeView ??= { clear: () => { calls.push('smokeView.clear'); } };
        }
        cache.flameFx ??= { clear: () => { calls.push('flameFx.clear'); } };
    },
}));

const meshesIn = (c: Container): Mesh[] => c.children.flatMap(k => (k instanceof Mesh ? [k] : meshesIn(k as Container)));
const state = { players: [], hungerZone: null } as unknown as GameState;

describe('createPreviewRenderer', () => {
    // Pixi probes the shader precision through a canvas context; jsdom has none and logs a "not implemented" error
    beforeAll(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
    afterAll(() => { vi.restoreAllMocks(); });
    beforeEach(() => { calls.length = 0; realSmoke = false; });
    const appOf = () => ({ stage: new Container(), screen: { width: 620, height: 340 } }) as unknown as Application;

    it('destroy frees the smoke and the flame views, before the map look goes', () => {
        const renderer = createPreviewRenderer(appOf(), state, {}, 'You');
        renderer.draw(state, null);                      // one frame is enough to make the views (reduced motion draws only one)
        renderer.destroy();
        expect(calls).toContain('smokeView.clear');
        expect(calls).toContain('flameFx.clear');
        expect(calls.indexOf('smokeView.clear')).toBeLessThan(calls.indexOf('look.destroy'));
        expect(calls.indexOf('flameFx.clear')).toBeLessThan(calls.indexOf('look.destroy'));
    });

    it('a preview torn down after one frame frees the smoke warm-up quads (shader and geometry), which the stage does not', () => {
        realSmoke = true;
        const app = appOf(), renderer = createPreviewRenderer(app, state, {}, 'You');
        renderer.draw(state, null);                      // the first frame builds the warm-up quads; only the second frees them
        const warm = meshesIn(app.stage.children[0] as Container);
        expect(warm.length).toBe(2);
        const shaders = warm.map(m => m.shader!), geometries = warm.map(m => m.geometry);
        renderer.destroy();
        for (const shader of shaders) expect(shader._destroyed).toBe(true);
        for (const geometry of geometries) expect(geometry.attributes).toBeNull();
    });

    it('destroy before any frame has nothing to free and does not throw', () => {
        const renderer = createPreviewRenderer(appOf(), state, {}, 'You');
        expect(() => renderer.destroy()).not.toThrow();
        expect(calls).toEqual(['look.destroy']);
    });
});

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { Container, Mesh, Shader } from 'pixi.js';
import { AirGrid } from '../smoke/airGrid';
import { frameOf, stateOf } from '../smoke/cloudField.testkit';
import { SmokeView } from './smokeView';

const cloud = { id: 'smoke_1', pos: { x: 0, y: 0 }, radius: 110, bornAt: 0, endsAt: 10_000 };

/** Every Mesh under `c`, at any depth. */
const meshesIn = (c: Container): Mesh[] => c.children.flatMap(k => (k instanceof Mesh ? [k] : meshesIn(k as Container)));

describe('SmokeView warm-up', () => {
    // Pixi probes the shader precision through a canvas context; jsdom has none and logs a "not implemented" error
    beforeAll(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
    afterAll(() => { vi.restoreAllMocks(); });
    const spies: { mockRestore: () => void }[] = [];
    const made: SmokeView[] = [];
    const makeView = (layer: Container) => { const v = new SmokeView(layer); made.push(v); return v; };
    afterEach(() => {
        for (const v of made.splice(0)) v.clear();
        for (const s of spies.splice(0)) s.mockRestore();
    });

    it('on the first frame, before any smoke, builds and steps a cloud and a plume and draws their quads far away for one frame', () => {
        const from = vi.spyOn(Shader, 'from'), step = vi.spyOn(AirGrid.prototype, 'step');
        spies.push(from, step);
        const layer = new Container(), smoke = makeView(layer);
        smoke.sync([], 1000, null, frameOf(stateOf(), undefined, 'high'));
        expect(from).toHaveBeenCalledTimes(2);                                   // the cloud's quad and the plume's
        expect(step).toHaveBeenCalled();
        const warm = meshesIn(layer);
        expect(warm.length).toBe(2);
        for (const mesh of warm) {
            expect(mesh.visible).toBe(true);
            expect(Math.max(...mesh.geometry.positions)).toBeLessThan(-10_000);    // nowhere near a map
        }
        smoke.sync([], 1008, null, frameOf(stateOf(), undefined, 'high'));
        for (const mesh of warm) expect(mesh.destroyed).toBe(true);
        expect(meshesIn(layer).length).toBe(0);
        smoke.sync([], 1017, null, frameOf(stateOf(), undefined, 'high'));
        expect(from).toHaveBeenCalledTimes(2);                                   // once per view
    });

    it('warms no plume on a quality without plumes, and nothing without a frame', () => {
        const from = vi.spyOn(Shader, 'from');
        spies.push(from);
        const low = makeView(new Container());
        low.sync([], 1000, null, frameOf(stateOf(), undefined, 'low'));
        expect(from).toHaveBeenCalledTimes(1);
        const preview = makeView(new Container());
        preview.sync([], 1000, null);
        expect(from).toHaveBeenCalledTimes(1);
    });

    it('a shader that fails in the warm-up switches to circles at once, logging once', () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        const from = vi.spyOn(Shader, 'from').mockImplementation(() => { throw new Error('no WebGL'); });
        spies.push(error, from);
        const layer = new Container(), smoke = makeView(layer);
        smoke.sync([], 1000, null, frameOf());
        smoke.sync([cloud], 1017, null, frameOf());
        expect(error).toHaveBeenCalledTimes(1);
        expect(error.mock.calls[0][0]).toBe('Smoke shader failed, drawing simple clouds:');
        expect(from).toHaveBeenCalledTimes(1);
        expect(meshesIn(layer).length).toBe(0);
    });

    it('clear frees the warm quads of a view cleared on its first frame', () => {
        const layer = new Container(), smoke = makeView(layer);
        smoke.sync([], 1000, null, frameOf());
        const warm = meshesIn(layer);
        expect(warm.length).toBe(1);
        smoke.clear();
        expect(warm[0].destroyed).toBe(true);
        expect(layer.children.length).toBe(0);
    });
});

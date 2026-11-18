import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { Container, type Mesh } from 'pixi.js';
import type { GameState } from '../../../types';
import { AirGrid } from './airGrid';
import { CloudField } from './cloudField';
import { STEP_HZ } from './smokeTuning';
import type { Cover } from '../../cover/coverTypes';
import { FRAME_MS, T0, VIEW, cloud, frameOf, runFrames, stateOf, stepCount, watchGrids } from './cloudField.testkit';

describe('CloudField', () => {
    // Pixi probes the shader precision through a canvas context; jsdom has none and logs a "not implemented" error
    beforeAll(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
    afterAll(() => { vi.restoreAllMocks(); });
    const fields: CloudField[] = [];
    const watchers: { restore: () => void }[] = [];
    const makeField = () => { const f = new CloudField(); fields.push(f); return f; };
    afterEach(() => {
        for (const f of fields.splice(0)) f.destroy();
        for (const w of watchers.splice(0)) w.restore();
    });
    const watch = () => { const w = watchGrids(); watchers.push(w); return w; };

    it('makes one quad per cloud and destroys it when the cloud goes', () => {
        const field = makeField();
        const a = cloud('a', 600, 450), b = cloud('b', 900, 450);
        field.sync([a, b], T0, frameOf());
        expect(field.layer.children.length).toBe(2);
        const meshOfB = field.layer.children[1] as Mesh;
        field.sync([a], T0 + FRAME_MS, frameOf());
        expect(field.layer.children.length).toBe(1);
        expect(meshOfB.destroyed).toBe(true);
        expect(field.gridOf('b')).toBeUndefined();
        field.sync([], T0 + 2 * FRAME_MS, frameOf());
        expect(field.layer.children.length).toBe(0);
        expect(field.gridOf('a')).toBeUndefined();
    });

    it('destroy frees every quad and the layer', () => {
        const field = makeField();
        field.sync([cloud('a', 600, 450)], T0, frameOf());
        const mesh = field.layer.children[0] as Mesh;
        field.destroy();
        expect(mesh.destroyed).toBe(true);
        expect(field.layer.destroyed).toBe(true);
        expect(() => field.sync([cloud('a', 600, 450)], T0, frameOf())).not.toThrow();
        expect(field.layer.destroyed).toBe(true);
    });

    it('destroy frees every quad even when the stage destroyed the layer first', () => {
        const field = makeField(), stage = new Container();
        stage.addChild(field.layer);
        field.sync([cloud('a', 600, 450), cloud('b', 900, 450)], T0, frameOf());
        const meshes = [...field.layer.children] as Mesh[];
        const shaders = meshes.map(m => m.shader!), textures = meshes.map(m => m.shader!.resources.uField as { destroyed: boolean });
        stage.destroy({ children: true, texture: false });          // what destroyApp does to the game screen
        expect(() => field.destroy()).not.toThrow();
        for (const shader of shaders) expect(shader._destroyed).toBe(true);
        for (const source of textures) expect(source.destroyed).toBe(true);
        expect(() => field.destroy()).not.toThrow();
        expect(() => field.sync([cloud('a', 600, 450)], T0 + FRAME_MS, frameOf())).not.toThrow();
    });

    it('builds a 1.5 x radius grid box around the centre, sized by the quality', () => {
        const field = makeField();
        field.sync([cloud('a', 600, 450)], T0, frameOf(stateOf(), VIEW, 'medium'));
        const g = field.gridOf('a')!;
        expect([g.x0, g.y0, g.size, g.n]).toEqual([435, 285, 330, 32]);
    });

    it('fills a cloud first seen after its burst, and leaves a newborn one to grow', () => {
        const field = makeField();
        field.sync([cloud('old', 600, 450, 0), cloud('new', 1000, 450, T0)], T0, frameOf());
        expect(field.gridOf('old')!.mass()).toBeGreaterThan(50);
        expect(field.gridOf('new')!.mass()).toBe(0);
    });

    it('does not step clouds outside the view and its 200 px margin', () => {
        const w = watch(), field = makeField();
        const edge = VIEW.x + VIEW.w + 200 + 165;                     // box left edge exactly at the margin
        const out = cloud('out', edge + 10, 450), inside = cloud('in', edge - 10, 450);
        field.sync([out, inside], T0, frameOf());
        const massBefore = field.gridOf('out')!.mass();
        runFrames(field, [out, inside], 30, frameOf(), T0);
        expect(stepCount(w.steps, field.gridOf('out'))).toBe(0);
        expect(field.gridOf('out')!.mass()).toBe(massBefore);
        expect(stepCount(w.steps, field.gridOf('in'))).toBe(30);
        expect((field.layer.children[0] as Mesh).visible).toBe(false);
        expect((field.layer.children[1] as Mesh).visible).toBe(true);
    });

    it('steps only the four clouds nearest the view centre at full rate, the rest every second frame', () => {
        const w = watch(), field = makeField();
        const smokes = [0, 1, 2, 3, 4, 5].map(i => cloud(`c${i}`, 800 + 100 * i, 450)).reverse();   // listed farthest first
        field.sync(smokes, T0, frameOf());
        runFrames(field, smokes, 10, frameOf(), T0);
        const counts = [0, 1, 2, 3, 4, 5].map(i => stepCount(w.steps, field.gridOf(`c${i}`)));
        expect(counts).toEqual([10, 10, 10, 10, 5, 5]);
    });

    it('steps a half-rate cloud once per two step periods, with a double step', () => {
        const w = watch(), field = makeField();
        const smokes = [0, 1, 2, 3, 4].map(i => cloud(`c${i}`, 800 + 100 * i, 450));
        field.sync(smokes, T0, frameOf());
        runFrames(field, smokes, 10, frameOf(), T0);
        const half = w.steps.get(field.gridOf('c4')!)!, full = w.steps.get(field.gridOf('c0')!)!;
        expect(half.length).toBe(5);
        for (const dt of half) expect(dt).toBeCloseTo(2 / STEP_HZ, 9);
        for (const dt of full) expect(dt).toBeCloseTo(1 / STEP_HZ, 9);
    });

    it('caps catch-up at three steps after a long gap', () => {
        const w = watch(), field = makeField();
        const smokes = [cloud('a', 800, 450, 0, 60_000)];
        field.sync(smokes, T0, frameOf());
        field.sync(smokes, T0 + 10_000, frameOf());
        expect(stepCount(w.steps, field.gridOf('a'))).toBe(3);
        field.sync(smokes, T0 + 10_000 + FRAME_MS, frameOf());
        expect(stepCount(w.steps, field.gridOf('a'))).toBe(4);              // the lost time is gone, not owed
    });

    it('steps every cloud at full rate, with no stirs and no culling, when there is no frame', () => {
        const w = watch(), field = makeField();
        const smokes = [0, 1, 2, 3, 4, 5].map(i => cloud(`c${i}`, 100 + 3000 * i, 450));      // all far from any view
        field.sync(smokes, T0, null);
        runFrames(field, smokes, 10, null, T0);
        for (let i = 0; i < 6; i++) expect(stepCount(w.steps, field.gridOf(`c${i}`))).toBe(10);
        for (const calls of w.stirs.values()) expect(calls.length).toBe(10 * 5);     // the clouds' own churn stirs, 5 a step: nothing else
        expect(field.layer.children.every(m => m.visible)).toBe(true);
    });

    it('does nothing and keeps the layer empty while there are no clouds', () => {
        const w = watch(), field = makeField();
        runFrames(field, [], 20, frameOf(), T0);
        expect(field.layer.children.length).toBe(0);
        expect(w.steps.size).toBe(0);
    });
});

describe('CloudField solids', () => {
    beforeAll(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
    afterAll(() => { vi.restoreAllMocks(); });

    const crate = (hp: number): Cover => ({ id: 'crate_1', kind: 'wood', pos: { x: 800, y: 473 }, hp });   // 50 x 46, centred on (800, 450)
    const cellAt = (g: AirGrid, x: number, y: number) => Math.floor((x - g.x0) / g.cell) + Math.floor((y - g.y0) / g.cell) * g.n;

    it('refreshes the solids when cover breaks or comes back', () => {
        const field = new CloudField();
        const smokes = [cloud('a', 800, 450)], state = stateOf({ cover: [crate(150)] });
        field.sync(smokes, T0, frameOf(state));
        const g = field.gridOf('a')!, k = cellAt(g, 800, 450);
        expect(g.solid[k]).toBe(1);
        state.cover![0].hp = 0;
        field.sync(smokes, T0 + FRAME_MS, frameOf(state));
        expect(g.solid[k]).toBe(0);
        state.cover![0].hp = 150;
        field.sync(smokes, T0 + 2 * FRAME_MS, frameOf(state));
        expect(g.solid[k]).toBe(1);
        field.destroy();
    });

    it('marks platforms inside the box and ignores pieces of cover outside it', () => {
        const field = new CloudField();
        const platforms = [{ x: 700, y: 500, w: 200, h: 20 }, { x: 5000, y: 500, w: 200, h: 20 }];
        const far: Cover = { id: 'far', kind: 'metal', pos: { x: 4000, y: 450 }, hp: 500 };
        field.sync([cloud('a', 800, 450)], T0, frameOf(stateOf({ platforms: platforms as unknown as GameState['platforms'], cover: [far] })));
        const g = field.gridOf('a')!;
        expect(g.solid[cellAt(g, 800, 510)]).toBe(1);
        expect(g.solid.reduce((n, s) => n + s, 0)).toBeLessThan(60);   // the one platform's few cells, not the far one
        field.destroy();
    });

    it('re-marks only when the intact cover in the box changes', () => {
        const field = new CloudField();
        const mark = vi.spyOn(AirGrid.prototype, 'markSolids');
        const smokes = [cloud('a', 800, 450)], state = stateOf({ cover: [crate(150)] });
        field.sync(smokes, T0, frameOf(state));
        runFrames(field, smokes, 10, frameOf(state), T0);
        expect(mark).toHaveBeenCalledTimes(1);
        state.cover![0].hp = 0;
        runFrames(field, smokes, 1, frameOf(state), T0 + 10 * FRAME_MS);
        expect(mark).toHaveBeenCalledTimes(2);
        mark.mockRestore();
        field.destroy();
    });
});

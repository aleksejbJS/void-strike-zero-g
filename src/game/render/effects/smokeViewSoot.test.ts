import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { Container, type Mesh } from 'pixi.js';
import { SootPlumes } from '../smoke/sootPlumes';
import { SmokeStirs } from '../smoke/smokeStirs';
import { cloud as makeCloud, runner, stateOf, watchGrids } from '../smoke/cloudField.testkit';
import { type Point, airOf, sootFrame, sootTotal } from '../smoke/sootPlumes.testkit';
import { SmokeView } from './smokeView';

const T0 = 5000;
const FRAME = 1000 / 60;
const a = makeCloud('a', 800, 450);
const flame = (x = 800, y = 500): Point[] => [{ x, y }];
const plumesOf = (view: SmokeView) => (view as unknown as { plumes: SootPlumes | null }).plumes;
const gfxOf = (view: SmokeView) => (view as unknown as { gfx: Container }).gfx;

// The view gives the soot plumes the same stirs as the clouds, from one collect per frame, and keeps them going after the flame
describe('SmokeView soot plumes', () => {
    beforeAll(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
    afterAll(() => { vi.restoreAllMocks(); });
    const cleanups: (() => void)[] = [];
    const makeView = (layer = new Container()) => { const v = new SmokeView(layer); cleanups.push(() => v.clear()); return v; };
    const spy = <T extends { mockRestore: () => void }>(s: T): T => { cleanups.push(() => s.mockRestore()); return s; };
    afterEach(() => { for (const c of cleanups.splice(0).reverse()) c(); });

    it('makes a plume from the flame\'s soot with no cloud at all, and collects once per frame for it', () => {
        const view = makeView(), collect = spy(vi.spyOn(SmokeStirs.prototype, 'collect'));
        const frame = sootFrame(flame());
        for (let i = 0; i < 10; i++) view.sync([], T0 + i * FRAME, null, frame);
        expect(plumesOf(view)!.count).toBe(1);
        expect(collect).toHaveBeenCalledTimes(10);
    });

    it('collects nothing, and makes nothing, while there is no cloud, no plume and no soot', () => {
        const view = makeView(), collect = spy(vi.spyOn(SmokeStirs.prototype, 'collect'));
        const soot = vi.fn(() => []), frame = { ...sootFrame([]), flame: { ...airOf([]), soot } };
        for (let i = 0; i < 10; i++) view.sync([], T0 + i * FRAME, null, frame);
        expect(collect).not.toHaveBeenCalled();
        expect(soot).not.toHaveBeenCalled();
        expect(plumesOf(view)).toBeNull();
    });

    it('makes no plume on low quality, and collects nothing for soot there', () => {
        const view = makeView(), collect = spy(vi.spyOn(SmokeStirs.prototype, 'collect'));
        for (let i = 0; i < 10; i++) view.sync([], T0 + i * FRAME, null, sootFrame(flame(), 'low'));
        expect(plumesOf(view)).toBeNull();
        expect(collect).not.toHaveBeenCalled();
    });

    it('keeps collecting for a plume after the flame is out, and stops once the plume is gone', () => {
        const view = makeView(), collect = spy(vi.spyOn(SmokeStirs.prototype, 'collect'));
        const pts = flame(), frame = sootFrame(pts);
        let now = T0;
        for (let i = 0; i < 60; i++) { now += FRAME; view.sync([], now, null, frame); }
        pts.length = 0;
        const before = collect.mock.calls.length;
        for (let i = 0; i < 60; i++) { now += FRAME; view.sync([], now, null, frame); }
        expect(plumesOf(view)!.count).toBe(1);
        expect(collect.mock.calls.length).toBe(before + 60);                // every frame while the plume lives
        for (let i = 0; i < 600 && plumesOf(view)!.count > 0; i++) { now += FRAME; view.sync([], now, null, frame); }
        expect(plumesOf(view)!.count).toBe(0);
        const done = collect.mock.calls.length;
        for (let i = 0; i < 10; i++) { now += FRAME; view.sync([], now, null, frame); }
        expect(collect.mock.calls.length).toBe(done);
    });

    it('shares one collect per frame between a cloud and a plume, and hands both the same stirs', () => {
        const w = watchGrids();
        cleanups.push(w.restore);
        const view = makeView(), collect = spy(vi.spyOn(SmokeStirs.prototype, 'collect'));
        const state = stateOf({ players: [runner(800, 476)] });          // a fighter on the run: one stir of reach 26 at (800, 450)
        const frame = sootFrame(flame(800, 480), 'high', state);
        for (let i = 0; i < 6; i++) view.sync([a], T0 + i * FRAME, null, frame);
        expect(collect).toHaveBeenCalledTimes(6);
        const grids = [...w.stirs].filter(([, calls]) => calls.some(c => c.st.r === 26)).map(([g]) => g);
        expect(grids.length).toBe(2);                                      // the cloud's grid and the plume's
    });

    it('draws the plumes under the clouds and the clouds under the outline', () => {
        const layer = new Container(), view = makeView(layer);
        const frame = sootFrame(flame());
        for (let i = 0; i < 3; i++) view.sync([a], T0 + i * FRAME, { x: 800, y: 500, w: 20, h: 50 }, frame);
        const kids = layer.children, top = kids.length - 1;
        expect(kids[top]).toBe(gfxOf(view));
        expect(kids[top - 1]).toBe((view as unknown as { field: { layer: Container } }).field.layer);
        expect(kids[top - 2]).toBe(plumesOf(view)!.layer);
    });

    it('lays down the same soot per second at 30 and at 120 frames per second, from the feed\'s frame time', () => {
        const totals = [1000 / 30, 1000 / 120].map(ms => {
            const view = makeView(), frame = sootFrame(flame());
            for (let i = 0; i < Math.round(400 / ms); i++) view.sync([], T0 + i * ms, null, frame);
            return sootTotal(plumesOf(view)!.gridAt(0)!);
        });
        expect(totals[0]).toBeGreaterThan(0);
        expect(totals[1] / totals[0]).toBeGreaterThan(0.85);
        expect(totals[1] / totals[0]).toBeLessThan(1.15);
    });

    it('clear frees the plumes, also after the stage was destroyed first, as the game screen does', () => {
        const stage = new Container(), layer = new Container();
        stage.addChild(layer);
        const view = makeView(layer);
        for (let i = 0; i < 3; i++) view.sync([a], T0 + i * FRAME, null, sootFrame(flame(300), 'high'));
        const plumes = plumesOf(view)!;
        const meshes = [...plumes.layer.children] as Mesh[];
        const shaders = meshes.map(m => m.shader!);
        expect(meshes.length).toBe(1);
        stage.destroy({ children: true, texture: false });
        expect(() => view.clear()).not.toThrow();
        for (const shader of shaders) expect(shader._destroyed).toBe(true);
        expect(plumesOf(view)).toBeNull();
        expect(() => view.sync([a], T0 + 100, null, sootFrame(flame()))).not.toThrow();
    });

    it('a failing plume path logs once, draws no soot from then on, and leaves the clouds alone', () => {
        const error = spy(vi.spyOn(console, 'error').mockImplementation(() => {}));
        const sync = spy(vi.spyOn(SootPlumes.prototype, 'sync').mockImplementation(() => { throw new Error('boom'); }));
        const layer = new Container(), view = makeView(layer);
        const frame = sootFrame(flame());
        for (let i = 0; i < 5; i++) view.sync([a], T0 + i * FRAME, null, frame);
        expect(error).toHaveBeenCalledTimes(1);
        expect(error.mock.calls[0][0]).toBe('Soot plumes failed, the flame draws no soot:');
        expect(sync).toHaveBeenCalledTimes(1);                              // not retried every frame
        expect(plumesOf(view)).toBeNull();
        const field = (view as unknown as { field: { layer: Container } | null }).field;
        expect(field?.layer.children.length).toBe(1);                        // the cloud is still a shader quad
        expect(layer.children).toEqual([field!.layer, gfxOf(view)]);
    });
});

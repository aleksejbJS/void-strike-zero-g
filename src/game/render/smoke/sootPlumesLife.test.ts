import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { Container, type Mesh } from 'pixi.js';
import type { GameState } from '../../../types';
import type { Cover } from '../../cover/coverTypes';
import type { AirGrid, Stir } from './airGrid';
import { SootPlumes, sootWanted } from './sootPlumes';
import { FRAME_MS, T0, stateOf, stepCount, watchGrids } from './cloudField.testkit';
import { type Point, airOf, runFrames, sootFrame } from './sootPlumes.testkit';

describe('SootPlumes in the world', () => {
    beforeAll(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
    afterAll(() => { vi.restoreAllMocks(); });
    const made: SootPlumes[] = [];
    const watchers: { restore: () => void }[] = [];
    const make = () => { const p = new SootPlumes(); made.push(p); return p; };
    const watch = () => { const w = watchGrids(); watchers.push(w); return w; };
    afterEach(() => {
        for (const p of made.splice(0)) p.destroy();
        for (const w of watchers.splice(0)) w.restore();
    });
    const at = (x: number, y = 500): Point => ({ x, y });
    const cellAt = (g: AirGrid, x: number, y: number) => Math.floor((x - g.x0) / g.cell) + Math.floor((y - g.y0) / g.cell) * g.n;

    it('holds no soot in the strip the shader fades out: a point there makes its own plume', () => {
        const plumes = make();
        runFrames(plumes, sootFrame([at(800)]), 1, T0);                        // box x 710..890, its faded strip from 865
        runFrames(plumes, sootFrame([at(800), at(880)]), 1, T0);
        expect(plumes.count).toBe(2);
    });

    it('steps the three plumes nearest the view centre every frame, the others every second frame', () => {
        const w = watch(), plumes = make();
        const pts = [300, 600, 900, 1200].map(x => at(x, 450));               // view centre is (800, 450)
        const frame = sootFrame(pts);
        runFrames(plumes, frame, 1, T0);
        const end = runFrames(plumes, frame, 10, T0 + FRAME_MS);
        expect(end).toBeGreaterThan(T0);
        const counts = [0, 1, 2, 3].map(i => stepCount(w.steps, plumes.gridAt(i)));
        expect(counts.filter(n => n === 10).length).toBe(3);
        expect(counts.filter(n => n === 5).length).toBe(1);                   // the one farthest from the centre (300)
        expect(counts[0]).toBe(5);
    });

    it('does not step plumes outside the view and its margin, hides them, and frees them after a second', () => {
        const w = watch(), plumes = make(), pts = [at(800)];
        const frame = sootFrame(pts);
        let now = runFrames(plumes, frame, 10, T0);
        const grid = plumes.gridAt(0)!, mesh = plumes.layer.children[0] as Mesh;
        const steps = stepCount(w.steps, grid);
        frame.view = { x: 5000, y: 0, w: 1600, h: 900 };                      // the camera went far away
        now = runFrames(plumes, frame, 30, now);
        expect(stepCount(w.steps, grid)).toBe(steps);
        expect(mesh.visible).toBe(false);
        expect(plumes.count).toBe(1);
        now = runFrames(plumes, frame, 40, now);                              // asleep for more than a second now
        expect(plumes.count).toBe(0);
        expect(mesh.destroyed).toBe(true);
    });

    it('wakes a plume that comes back in view within a second', () => {
        const w = watch(), plumes = make(), frame = sootFrame([at(800)]);
        let now = runFrames(plumes, frame, 10, T0);
        const grid = plumes.gridAt(0)!, mesh = plumes.layer.children[0] as Mesh;
        const view = frame.view;
        frame.view = { x: 5000, y: 0, w: 1600, h: 900 };
        now = runFrames(plumes, frame, 20, now);
        frame.view = view;
        const steps = stepCount(w.steps, grid);
        now = runFrames(plumes, frame, 10, now);
        expect(plumes.count).toBe(1);
        expect(mesh.visible).toBe(true);
        expect(stepCount(w.steps, grid)).toBe(steps + 10);
    });

    it('applies each stir that reaches a plume once, for the time it carries, and none that miss it', () => {
        const w = watch(), plumes = make(), frame = sootFrame([at(800)]);
        runFrames(plumes, frame, 2, T0);
        const grid = plumes.gridAt(0)!;
        const near: Stir = { x: 800, y: 500, r: 40, vx: 100, vy: 0, rate: 10, dt: 0.004 };
        const far: Stir = { x: 3000, y: 500, r: 40, vx: 100, vy: 0, rate: 10, dt: 0.004 };
        let now = T0 + 2 * FRAME_MS;
        for (let i = 0; i < 3; i++) { now += FRAME_MS; plumes.sync(now, frame, [near, far], 0.0166); }
        const pushes = w.stirs.get(grid)!.filter(c => c.st.rate === 10);
        expect(pushes.length).toBe(3);                                         // one per frame, each applied once
        for (const c of pushes) { expect(c.st).toBe(near); expect(c.dt).toBe(0.004); }
    });

    it('marks the platforms and the intact cover in its box, and follows the cover when it breaks', () => {
        const platforms = [{ x: 700, y: 530, w: 200, h: 20 }];
        const crate: Cover = { id: 'crate_1', kind: 'wood', pos: { x: 840, y: 548 }, hp: 150 };        // 50 x 46: x 815..865, y 502..548
        const state = stateOf({ platforms: platforms as unknown as GameState['platforms'], cover: [crate] });
        const plumes = make(), pts = [at(800)];
        let now = runFrames(plumes, sootFrame(pts, 'high', state), 3, T0);
        const g = plumes.gridAt(0)!;
        expect(g.solid[cellAt(g, 800, 540)]).toBe(1);
        expect(g.solid[cellAt(g, 840, 525)]).toBe(1);
        crate.hp = 0;
        now = runFrames(plumes, sootFrame(pts, 'high', state), 3, now);
        expect(g.solid[cellAt(g, 840, 525)]).toBe(0);
        expect(g.solid[cellAt(g, 800, 540)]).toBe(1);
    });

    it('does nothing, and does not even list the soot, while the flame has none and no plume lives', () => {
        const soot = vi.fn(() => []);
        const plumes = make(), frame = { ...sootFrame([]), flame: { ...airOf([]), soot } };
        runFrames(plumes, frame, 20, T0);
        expect(soot).not.toHaveBeenCalled();
        expect(plumes.count).toBe(0);
        expect(plumes.layer.children.length).toBe(0);
    });

    it('keeps no plume without a frame', () => {
        const plumes = make();
        runFrames(plumes, sootFrame([at(800)]), 3, T0);
        expect(plumes.count).toBe(1);
        plumes.sync(T0 + 100, null);
        expect(plumes.count).toBe(0);
        expect(plumes.layer.children.length).toBe(0);
    });

    it('destroy frees every quad and the layer, and ignores a sync after that', () => {
        const plumes = make();
        runFrames(plumes, sootFrame([at(300), at(900)]), 2, T0);
        const mesh = plumes.layer.children[0] as Mesh;
        plumes.destroy();
        expect(mesh.destroyed).toBe(true);
        expect(plumes.layer.destroyed).toBe(true);
        expect(() => plumes.sync(T0 + 100, sootFrame([at(300)]))).not.toThrow();
        expect(plumes.layer.children.length).toBe(0);
    });

    it('destroy frees every quad even when the stage destroyed the layer first', () => {
        const plumes = make(), stage = new Container();
        stage.addChild(plumes.layer);
        runFrames(plumes, sootFrame([at(300), at(900)]), 2, T0);
        const meshes = [...plumes.layer.children] as Mesh[];
        const shaders = meshes.map(m => m.shader!), sources = meshes.map(m => m.shader!.resources.uField as { destroyed: boolean });
        stage.destroy({ children: true, texture: false });                     // what destroyApp does to the game screen
        expect(() => plumes.destroy()).not.toThrow();
        for (const shader of shaders) expect(shader._destroyed).toBe(true);
        for (const source of sources) expect(source.destroyed).toBe(true);
        expect(() => plumes.destroy()).not.toThrow();
    });
});

describe('sootWanted', () => {
    it('is true only for a frame whose flame has soot, on a quality that makes plumes', () => {
        expect(sootWanted(null)).toBe(false);
        expect(sootWanted(sootFrame([{ x: 1, y: 1 }]))).toBe(true);
        expect(sootWanted(sootFrame([]))).toBe(false);
        expect(sootWanted(sootFrame([{ x: 1, y: 1 }], 'medium'))).toBe(true);
        expect(sootWanted(sootFrame([{ x: 1, y: 1 }], 'low'))).toBe(false);
        expect(sootWanted({ ...sootFrame([{ x: 1, y: 1 }]), flame: null })).toBe(false);
    });
});

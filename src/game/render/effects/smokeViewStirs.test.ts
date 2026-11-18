import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { Container } from 'pixi.js';
import type { Stir } from '../smoke/airGrid';
import { SmokeStirs } from '../smoke/smokeStirs';
import { cloud as makeCloud, frameOf, runner, stateOf, watchGrids } from '../smoke/cloudField.testkit';
import { projectile } from '../smoke/smokeStirs.testkit';
import { SmokeView } from './smokeView';

const T0 = 5000;
const a = makeCloud('a', 800, 450), b = makeCloud('b', 900, 450), far = makeCloud('far', 9000, 450);
const shotAt = (x: number) => frameOf(stateOf({ projectiles: [projectile('r1', x, 450, 10, 0)] }));

// The view owns the stir feed: one collect per rendered frame, shared by every cloud, none while there is no smoke
describe('SmokeView stirs', () => {
    beforeAll(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
    afterAll(() => { vi.restoreAllMocks(); });
    const cleanups: (() => void)[] = [];
    const makeView = () => { const v = new SmokeView(new Container()); cleanups.push(() => v.clear()); return v; };
    const spyCollect = () => { const s = vi.spyOn(SmokeStirs.prototype, 'collect'); cleanups.push(() => s.mockRestore()); return s; };
    afterEach(() => { for (const c of cleanups.splice(0)) c(); });
    const silhouette = null;

    it('collects the stirs once per frame, however many clouds, in view or not', () => {
        const view = makeView(), collect = spyCollect();
        for (let i = 0; i < 10; i++) view.sync([a, b, far], T0 + i * 17, silhouette, frameOf());
        expect(collect).toHaveBeenCalledTimes(10);
        for (let i = 10; i < 13; i++) view.sync([far], T0 + i * 17, silhouette, frameOf());      // only an off-view cloud left
        expect(collect).toHaveBeenCalledTimes(13);
    });

    it('does not collect while there is no smoke, or no frame', () => {
        const view = makeView(), collect = spyCollect();
        for (let i = 0; i < 5; i++) view.sync([], T0 + i * 17, silhouette, frameOf());
        for (let i = 5; i < 10; i++) view.sync([a], T0 + i * 17, silhouette, null);
        expect(collect).not.toHaveBeenCalled();
    });

    it('hands the collected stirs to the clouds', () => {
        const w = watchGrids();
        cleanups.push(w.restore);
        const view = makeView();
        view.sync([a], T0, silhouette, frameOf());
        const state = stateOf({ players: [runner(800, 476)] });
        for (let i = 1; i <= 3; i++) view.sync([a], T0 + i * 17, silhouette, frameOf(state));
        const calls = [...w.stirs.values()].flat().filter(c => c.st.r === 26);
        expect(calls.length).toBe(3);
    });

    it('forgets what it followed when the clouds were gone, so old positions do not make a long chain', () => {
        const view = makeView(), collect = spyCollect();
        view.sync([a], T0, silhouette, shotAt(100));
        view.sync([], T0 + 17, silhouette, shotAt(2000));
        view.sync([a], T0 + 33, silhouette, shotAt(5100));
        expect(collect).toHaveBeenCalledTimes(2);                          // not while no cloud existed
        const last = collect.mock.calls[collect.mock.calls.length - 1][2] as Stir[];
        expect(last.length).toBe(2);                                       // one tick back (5090 -> 5100), not 100 -> 5100
    });

    it('also forgets what it followed across frames that had no frame to collect from', () => {
        const view = makeView(), collect = spyCollect();
        view.sync([a], T0, silhouette, shotAt(100));
        view.sync([a], T0 + 17, silhouette, null);
        view.sync([a], T0 + 33, silhouette, shotAt(5100));
        expect((collect.mock.calls[collect.mock.calls.length - 1][2] as Stir[]).length).toBe(2);
    });
});

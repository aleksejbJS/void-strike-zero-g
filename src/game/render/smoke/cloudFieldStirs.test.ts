import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import type { Mesh } from 'pixi.js';
import { CloudField } from './cloudField';
import { SmokeQuad } from './smokeQuad';
import type { Stir } from './airGrid';
import { FRAME_MS, T0, VIEW, cloud, frameOf, runFrames, runner, stateOf, syncFed, watchGrids } from './cloudField.testkit';

describe('CloudField stirs, drawing and waking', () => {
    beforeAll(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
    afterAll(() => { vi.restoreAllMocks(); });
    const fields: CloudField[] = [];
    const cleanups: (() => void)[] = [];
    const makeField = () => { const f = new CloudField(); fields.push(f); return f; };
    afterEach(() => {
        for (const f of fields.splice(0)) f.destroy();
        for (const c of cleanups.splice(0)) c();
    });
    const watch = () => { const w = watchGrids(); cleanups.push(w.restore); return w; };
    const spyOn = <T extends object, K extends keyof T>(obj: T, key: K) => {
        const spy = vi.spyOn(obj as never, key as never) as unknown as ReturnType<typeof vi.fn>;
        cleanups.push(() => spy.mockRestore());
        return spy;
    };
    const reach26 = (calls: { st: Stir; dt: number }[] | undefined) => (calls ?? []).filter(c => c.st.r === 26);

    it('applies each queued stir once, with the time it carries and not the step\'s: a half-rate cloud gets two frames\' worth', () => {
        const w = watch(), field = makeField();
        const smokes = [0, 1, 2, 3, 4].map(i => cloud(`c${i}`, 800, 450));      // the same spot: the fifth is the half-rate one
        syncFed(field, smokes, T0, frameOf());
        runFrames(field, smokes, 10, frameOf(stateOf({ players: [runner(800, 476)] })), T0);
        const full = reach26(w.stirs.get(field.gridOf('c0')!)), half = reach26(w.stirs.get(field.gridOf('c4')!));
        expect(full.length).toBe(10);
        expect(half.length).toBe(10);
        for (const c of [...full, ...half]) expect(c.dt).toBeCloseTo(1 / 60, 9);       // the frame's time, though the half-rate step lasts 2/60
        expect(new Set(full.map(c => c.st)).size).toBe(10);                             // each stir object went to a grid once only
    });

    it('a stir carries at most 0.1 s of a long frame', () => {
        const w = watch(), field = makeField(), smokes = [cloud('a', 800, 450)];
        syncFed(field, smokes, T0, frameOf());
        syncFed(field, smokes, T0 + 2000, frameOf(stateOf({ players: [runner(800, 476)] })));
        expect(reach26(w.stirs.get(field.gridOf('a')!)).map(c => c.dt)).toEqual([0.1]);
    });

    it('applies the queue on the first catch-up step only', () => {
        const w = watch(), field = makeField(), smokes = [cloud('a', 800, 450)];
        syncFed(field, smokes, T0, frameOf());
        syncFed(field, smokes, T0 + 100, frameOf(stateOf({ players: [runner(800, 476)] })));   // 100 ms: three steps
        expect(w.steps.get(field.gridOf('a')!)!.length).toBe(3);
        expect(reach26(w.stirs.get(field.gridOf('a')!)).length).toBe(1);
    });

    it('drops the stirs of a cloud out of view instead of saving them up', () => {
        const w = watch(), field = makeField(), smokes = [cloud('a', 5000, 450)];
        const state = stateOf({ players: [runner(5000, 476)] });
        syncFed(field, smokes, T0, frameOf(state));
        runFrames(field, smokes, 10, frameOf(state), T0);                          // the runner is in its box, the box out of view
        expect(reach26(w.stirs.get(field.gridOf('a')!)).length).toBe(0);
        runFrames(field, smokes, 1, frameOf(state, { ...VIEW, x: 4300 }), T0 + 10 * FRAME_MS);
        expect(reach26(w.stirs.get(field.gridOf('a')!)).length).toBe(1);           // this frame's stir, not eleven
    });

    it('does not keep stirs a half-rate cloud was waiting to apply when it goes out of view', () => {
        const w = watch(), field = makeField();
        const smokes = [0, 1, 2, 3, 4].map(i => cloud(`c${i}`, 800, 450));      // the fifth is the half-rate one
        const busy = frameOf(stateOf({ players: [runner(800, 476)] })), away = frameOf(stateOf({ players: [runner(800, 476)] }), { ...VIEW, x: 10_000 });
        syncFed(field, smokes, T0, frameOf());
        let t = runFrames(field, smokes, 1, busy, T0);                           // queued, no step due yet
        t = runFrames(field, smokes, 1, away, t);                                // asleep: the queue goes
        runFrames(field, smokes, 2, busy, t);                                    // back: its first step comes with the second frame
        expect(reach26(w.stirs.get(field.gridOf('c4')!)).length).toBe(2);
    });

    it('uploads every visible cloud each frame with the time in seconds and the fade, and skips those out of view', () => {
        const field = makeField(), upload = spyOn(SmokeQuad.prototype, 'upload');
        const now = 2_500_000, born = now - 1000;
        const smokes = [cloud('a', 800, 450, born), cloud('b', 900, 450, born, now + 1000), cloud('far', 9000, 450, born)];
        syncFed(field, smokes, now, frameOf());
        upload.mockClear();
        runFrames(field, smokes, 4, frameOf(), now);
        const calls = upload.mock.calls as [number, number][];
        expect(calls.length).toBe(8);                                              // two visible clouds, four frames
        for (const [time] of calls) { expect(time).toBeGreaterThanOrEqual(500); expect(time).toBeLessThan(501); }   // (now % 1e6) / 1000
        const fades = calls.map(c => c[1]).sort((x, y) => x - y);
        expect(fades.slice(4)).toEqual([1, 1, 1, 1]);                              // `a` is full size: min(1, 1 x 1.2)
        for (const f of fades.slice(0, 4)) expect(f).toBeCloseTo(0.84, 1);        // `b` is about half size: sqrt(0.5) x 1.2
    });

    it('hides a cloud whose time is up without uploading it', () => {
        const field = makeField(), upload = spyOn(SmokeQuad.prototype, 'upload');
        const smokes = [cloud('a', 800, 450, 0, T0 + 50)];
        syncFed(field, smokes, T0, frameOf());
        upload.mockClear();
        syncFed(field, smokes, T0 + 100, frameOf());
        expect((field.layer.children[0] as Mesh).visible).toBe(false);
        expect(upload).not.toHaveBeenCalled();
    });

    it('fills a cloud as a settled one when it comes back after being out of view for over a second', () => {
        const field = makeField(), smokes = [cloud('a', 800, 450)], away = { ...VIEW, x: 10_000 };
        syncFed(field, smokes, T0, frameOf());
        const g = field.gridOf('a')!, settled = g.mass();
        g.d.fill(0);
        let t = runFrames(field, smokes, 1, frameOf(stateOf(), away), T0);
        t = runFrames(field, smokes, 1, frameOf(stateOf(), away), t + 3000);
        runFrames(field, smokes, 1, frameOf(), t);
        expect(g.mass()).toBeGreaterThan(settled * 0.9);
    });

    it('does not refill a cloud that was out of view for under a second', () => {
        const field = makeField(), smokes = [cloud('a', 800, 450)], away = { ...VIEW, x: 10_000 };
        syncFed(field, smokes, T0, frameOf());
        const g = field.gridOf('a')!, settled = g.mass();
        for (let k = 0; k < g.d.length; k++) g.d[k] *= 0.2;                  // thinned (an empty grid would be filled: see cloudFieldWake)
        const t = runFrames(field, smokes, 10, frameOf(stateOf(), away), T0);
        runFrames(field, smokes, 1, frameOf(), t);
        expect(g.mass()).toBeLessThan(settled * 0.3);
    });
});

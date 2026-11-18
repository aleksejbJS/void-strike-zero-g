import { describe, it, expect, vi } from 'vitest';
import { StirFeed } from './stirFeed';
import { SmokeStirs } from './smokeStirs';
import { IMPULSE_DT, MAX_STIR_FRAME_DT } from './smokeTuning';
import { fighter, frame, projectile } from './smokeStirs.testkit';

const shot = (x: number) => frame({ projectiles: [projectile('r1', x, 450, 10, 0)] });
const runner = frame({ players: [fighter(5, 0)] });

describe('StirFeed', () => {
    it('returns the frame\'s stirs, in a list that it reuses', () => {
        const feed = new StirFeed();
        const a = feed.collect(shot(100), null, 1000);
        expect(a.length).toBe(2);                                          // a rocket's one tick (10 px) as two points
        const b = feed.collect(shot(110), null, 1017);
        expect(b).toBe(a);
        expect(b.length).toBe(1);                                          // 7 px apart across frames: 104 only
    });

    it('measures the frame time between calls, and assumes 60 Hz for the first', () => {
        const feed = new StirFeed();
        expect(feed.collect(runner, null, 1000)[0].dt).toBeCloseTo(IMPULSE_DT, 12);
        expect(feed.collect(runner, null, 1008)[0].dt).toBeCloseTo(0.008, 12);
        expect(feed.collect(runner, null, 1025)[0].dt).toBeCloseTo(0.017, 12);
    });

    it('tells the frame time of the last collect, as the stirs carry it', () => {
        const feed = new StirFeed();
        expect(feed.frameDt).toBeCloseTo(IMPULSE_DT, 12);
        feed.collect(runner, null, 1000);
        expect(feed.frameDt).toBeCloseTo(IMPULSE_DT, 12);                  // the first frame has none to measure
        feed.collect(runner, null, 1008);
        expect(feed.frameDt).toBeCloseTo(0.008, 12);
        feed.collect(runner, null, 1008 + 5000);
        expect(feed.frameDt).toBe(MAX_STIR_FRAME_DT);                      // a pause counts as no more than this
        feed.idle();
        expect(feed.frameDt).toBeCloseTo(IMPULSE_DT, 12);
    });

    it('follows a projectile from frame to frame', () => {
        const feed = new StirFeed();
        feed.collect(shot(100), null, 1000);
        expect(feed.collect(shot(150), null, 1017).length).toBe(7);        // 100 -> 150, one stir every 7 px from 104 (90, 97 came before)
    });

    it('forgets what it followed after an idle frame, so old positions do not make a long chain', () => {
        const feed = new StirFeed();
        feed.collect(shot(100), null, 1000);
        expect(feed.idle().length).toBe(0);
        expect(feed.collect(shot(5100), null, 1033).length).toBe(2);       // one tick back (5090 -> 5100), not 100 -> 5100
    });

    it('measures no frame time across an idle frame', () => {
        const feed = new StirFeed();
        feed.collect(runner, null, 1000);
        feed.idle();
        expect(feed.collect(runner, null, 6000)[0].dt).toBeCloseTo(IMPULSE_DT, 12);
    });

    it('an idle feed gives an empty list and empties the one it gave before', () => {
        const feed = new StirFeed();
        const stirs = feed.collect(runner, null, 1000);
        expect(stirs.length).toBe(1);
        expect(feed.idle()).toEqual([]);
        expect(stirs.length).toBe(0);
    });

    it('collects once per call', () => {
        const feed = new StirFeed(), collect = vi.spyOn(SmokeStirs.prototype, 'collect');
        feed.collect(runner, null, 1000);
        feed.collect(runner, null, 1017);
        feed.idle();
        feed.idle();
        expect(collect).toHaveBeenCalledTimes(2);
        collect.mockRestore();
    });
});

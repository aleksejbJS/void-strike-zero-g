import { describe, it, expect, vi } from 'vitest';
import { ATTEMPT_MS, GuestRejoin, REJOIN_WINDOW_MS, RETRY_GAP_MS } from './guestRejoin';

describe('GuestRejoin', () => {
    it('dials at once, retries a failed attempt after a short gap, and a silent one after ATTEMPT_MS', () => {
        const dial = vi.fn();
        const r = new GuestRejoin(dial);
        expect(r.active).toBe(false);
        r.start(0);
        expect(r.active).toBe(true);
        expect(dial).toHaveBeenCalledTimes(1);
        r.failed(1_000);
        expect(r.tick(1_000 + RETRY_GAP_MS - 1)).toBe('trying');
        expect(dial).toHaveBeenCalledTimes(1);
        r.tick(1_000 + RETRY_GAP_MS);
        expect(dial).toHaveBeenCalledTimes(2);
        r.tick(1_000 + RETRY_GAP_MS + ATTEMPT_MS - 1);
        expect(dial).toHaveBeenCalledTimes(2);
        r.tick(1_000 + RETRY_GAP_MS + ATTEMPT_MS);
        expect(dial).toHaveBeenCalledTimes(3);
    });

    it('gives up once the 60 s window is over', () => {
        const r = new GuestRejoin(vi.fn());
        r.start(0);
        expect(r.tick(REJOIN_WINDOW_MS - 1)).toBe('trying');
        expect(r.tick(REJOIN_WINDOW_MS)).toBe('gave-up');
        expect(r.active).toBe(false);
    });

    it('back in: no more attempts, and a later loss gets a fresh window', () => {
        const dial = vi.fn();
        const r = new GuestRejoin(dial);
        r.start(0);
        r.done();
        expect(r.active).toBe(false);
        expect(r.tick(100_000)).toBe('idle');
        r.start(100_000);
        expect(r.tick(100_000 + REJOIN_WINDOW_MS - 1)).toBe('trying');
        expect(dial).toHaveBeenCalledTimes(3); // the first window's dial, the second's, and one silent retry
    });

    it('a second start while trying changes nothing', () => {
        const dial = vi.fn();
        const r = new GuestRejoin(dial);
        r.start(0);
        r.start(10_000);
        expect(dial).toHaveBeenCalledTimes(1);
        expect(r.tick(REJOIN_WINDOW_MS)).toBe('gave-up');
    });
});

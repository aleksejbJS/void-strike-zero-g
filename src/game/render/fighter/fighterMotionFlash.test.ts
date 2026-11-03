import { describe, it, expect } from 'vitest';
import { FighterMotion } from './fighterMotion';

describe('FighterMotion hit flash', () => {
    it('flashes for 80 ms after a health drop and not after a gain', () => {
        const m = new FighterMotion();
        expect(m.observe(0, 100, 0).hitFlash).toBe(0);
        expect(m.observe(0, 80, 16).hitFlash).toBe(1);
        expect(m.observe(0, 80, 60).hitFlash).toBe(1);
        expect(m.observe(0, 80, 100).hitFlash).toBe(0);
        expect(m.observe(0, 100, 116).hitFlash).toBe(0);
    });

    it('does not flash for bleeding, however long it lasts', () => {
        // 120 physics ticks per second: 1/120 HP per frame offline; 1/30 HP per snapshot online
        for (const [step, frameMs] of [[1 / 120, 1000 / 120], [1 / 30, 1000 / 30]]) {
            const m = new FighterMotion();
            for (let i = 0; i < 600; i++) expect(m.observe(0, 100 - i * step, i * frameMs).hitFlash).toBe(0);
        }
    });

    it('still flashes for a real hit on a bleeding fighter', () => {
        const m = new FighterMotion();
        m.observe(0, 10, 0);
        expect(m.observe(0, 10 - 1 / 120, 8).hitFlash).toBe(0);
        expect(m.observe(0, 4, 16).hitFlash).toBe(1);
        expect(m.observe(0, 4 - 1 / 120, 24).hitFlash).toBe(1); // bleeding does not cut the flash short
        expect(m.observe(0, 4 - 2 / 120, 100).hitFlash).toBe(0);
    });
});

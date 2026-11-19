import { describe, it, expect } from 'vitest';
import { FighterFlip, FLIP_MS } from './fighterFlip';

describe('FighterFlip', () => {
    it('lasts 0.4 s', () => {
        expect(FLIP_MS).toBe(400);
    });

    it('never starts on the first look (a fighter first seen with its air jump used)', () => {
        const flip = new FighterFlip();
        expect(flip.observe(1, 1000)).toBe(0);
        expect(flip.observe(1, 1100)).toBe(0);
    });

    it('turns once forward when the air jump is used', () => {
        const flip = new FighterFlip();
        flip.observe(0, 900);
        expect(flip.observe(1, 1000)).toBe(0);
        expect(flip.observe(1, 1200)).toBeCloseTo(Math.PI);
        expect(flip.observe(1, 1300)).toBeCloseTo(1.5 * Math.PI);
        expect(flip.observe(1, 1400)).toBe(0);
        expect(flip.observe(1, 1600)).toBe(0);
    });

    it('turns the other way for a flip to the left', () => {
        const flip = new FighterFlip();
        flip.observe(undefined, 900);
        flip.observe(-1, 1000);
        expect(flip.observe(-1, 1200)).toBeCloseTo(-Math.PI);
    });

    it('stands upright at once when the fighter lands mid-turn', () => {
        const flip = new FighterFlip();
        flip.observe(0, 900);
        flip.observe(1, 1000);
        expect(flip.observe(0, 1100)).toBe(0);
        expect(flip.observe(0, 1200)).toBe(0);
    });

    it('a clock stepping back gives no turn', () => {
        const flip = new FighterFlip();
        flip.observe(0, 900);
        flip.observe(1, 1000);
        expect(flip.observe(1, 950)).toBe(0);
    });

    it('a new airtime flips again', () => {
        const flip = new FighterFlip();
        flip.observe(0, 0);
        flip.observe(1, 100);
        flip.observe(0, 1000);
        flip.observe(1, 1100);
        expect(flip.observe(1, 1300)).toBeCloseTo(Math.PI);
    });
});

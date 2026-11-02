import { describe, expect, it } from 'vitest';
import { digitSegments } from './segmentDigits';

const inRightDigit = ([a, b]: [{ x: number }, { x: number }]) => a.x > 0.5 && b.x > 0.5;

describe('digitSegments', () => {
    it('7 is shown as "07": six segments for the 0, top and both right ones for the 7', () => {
        const segments = digitSegments(7);
        expect(segments).toHaveLength(9);
        const seven = segments.filter(inRightDigit);
        expect(seven).toHaveLength(3);
        expect(seven.filter(([a, b]) => a.y === 0 && b.y === 0)).toHaveLength(1);    // top
        expect(seven.filter(([a, b]) => a.x === 1 && b.x === 1)).toHaveLength(2);    // both right
    });

    it('88 lights all fourteen segments', () => {
        expect(digitSegments(88)).toHaveLength(14);
    });

    it('every segment lies in the unit box', () => {
        for (let n = 0; n <= 99; n++) {
            for (const p of digitSegments(n).flat()) {
                expect(p.x).toBeGreaterThanOrEqual(0);
                expect(p.x).toBeLessThanOrEqual(1);
                expect(p.y).toBeGreaterThanOrEqual(0);
                expect(p.y).toBeLessThanOrEqual(1);
            }
        }
    });

    it('turns any number into a whole number from 0 to 99', () => {
        expect(digitSegments(-3)).toEqual(digitSegments(0));
        expect(digitSegments(120)).toEqual(digitSegments(99));
        expect(digitSegments(Number.NaN)).toEqual(digitSegments(0));
        expect(digitSegments(7.8)).toEqual(digitSegments(7));
    });
});

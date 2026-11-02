import { describe, it, expect } from 'vitest';
import { addShake, explosionShake, MAX_SHAKE, SHAKE_RANGE } from './screenShake';

describe('explosionShake', () => {
    it('is strongest on top of the player and fades with distance', () => {
        const at = (d: number) => explosionShake({ x: d, y: 0 }, { x: 0, y: 0 });
        expect(at(0)).toBe(MAX_SHAKE);
        expect(at(200)).toBeLessThan(at(0));
        expect(at(600)).toBeLessThan(at(200));
        expect(at(SHAKE_RANGE)).toBe(0);
        expect(at(5000)).toBe(0);
    });

    it('needs a living local player to shake', () => {
        expect(explosionShake({ x: 0, y: 0 }, undefined)).toBe(0);
    });

    it('a smaller blast shakes less', () => {
        expect(explosionShake({ x: 0, y: 0 }, { x: 0, y: 0 }, 0.85)).toBeLessThan(MAX_SHAKE);
    });

    it('a far blast does not cut a strong shake short', () => {
        expect(addShake(10, 2)).toBe(10);
        expect(addShake(2, 10)).toBe(10);
    });
});

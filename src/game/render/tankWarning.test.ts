import { describe, expect, it } from 'vitest';
import { Graphics } from 'pixi.js';
import { drawTankWarning, fuseBurnt, warningLit } from './tankWarning';
import { TANK_FUSE_MS } from '../systems/flameConstants';

const NOW = 50_000;

/** How many times the warning switches on over one tenth of the fuse starting at `from` (0..1). */
const blinksIn = (from: number) => {
    let blinks = 0, was = warningLit(from);
    for (let k = from; k < from + 0.1; k += 0.0005) {
        const lit = warningLit(k);
        if (lit && !was) blinks++;
        was = lit;
    }
    return blinks;
};

describe('the lit tank warning', () => {
    it('knows how much of the fuse has burnt, and nothing without a lit tank', () => {
        expect(fuseBurnt({}, NOW)).toBeUndefined();
        expect(fuseBurnt({ tankFuseAt: NaN }, NOW)).toBeUndefined();
        expect(fuseBurnt({ tankFuseAt: NOW + TANK_FUSE_MS }, NOW)).toBe(0);
        expect(fuseBurnt({ tankFuseAt: NOW + TANK_FUSE_MS / 2 }, NOW)).toBeCloseTo(0.5);
        expect(fuseBurnt({ tankFuseAt: NOW - 100 }, NOW)).toBe(1);
    });

    it('blinks faster as the blast nears', () => {
        expect(blinksIn(0.85)).toBeGreaterThan(blinksIn(0.05) * 2);
    });

    it('draws only while the tank is lit', () => {
        const g = new Graphics();
        drawTankWarning(g, { height: 72 }, NOW);
        expect(g.bounds.width > 0).toBe(false); // empty bounds
        drawTankWarning(g, { height: 72, tankFuseAt: NOW + 1000 }, NOW);
        expect(g.bounds.width).toBeGreaterThan(0);
        expect(g.bounds.maxY).toBeLessThan(-72); // above the head
        g.destroy({ context: true });
    });
});

import { describe, expect, it } from 'vitest';
import { Graphics } from 'pixi.js';
import { BURST_MS, PERIOD_MS, drawHurtSparks, hurtBurst } from './robotHurtSparks';

const anchors = [{ x: 0, y: -20 }, { x: 3, y: -15 }, { x: -2, y: -10 }];

describe('hurt robot sparks', () => {
    it('flashes one short burst per period at one of the robot\'s anchors, and nothing in between', () => {
        let bursts = 0, quiet = 0;
        for (let t = 0; t < PERIOD_MS * 20; t += 10) {
            const burst = hurtBurst(anchors, 42, t);
            if (!burst) { quiet++; continue; }
            bursts++;
            expect(anchors).toContainEqual(burst.at);
            expect(burst.progress).toBeGreaterThanOrEqual(0);
            expect(burst.progress).toBeLessThan(1);
        }
        // Each period shows a burst of BURST_MS out of PERIOD_MS
        expect(bursts * 10).toBeGreaterThanOrEqual(20 * BURST_MS * 0.9);
        expect(bursts * 10).toBeLessThanOrEqual(20 * BURST_MS * 1.1);
        expect(quiet).toBeGreaterThan(bursts);
    });

    it('is the same for the same seed and time, and moves around between periods', () => {
        expect(hurtBurst(anchors, 7, 1234)).toEqual(hurtBurst(anchors, 7, 1234));
        const places = new Set<string>();
        for (let k = 0; k < 30; k++) {
            for (let t = k * PERIOD_MS; t < (k + 1) * PERIOD_MS; t += 5) {
                const b = hurtBurst(anchors, 7, t);
                if (b) { places.add(`${b.at.x},${b.at.y}`); break; }
            }
        }
        expect(places.size).toBeGreaterThan(1);
    });

    it('draws a burst and hides the layer when there is none', () => {
        const g = new Graphics();
        drawHurtSparks(g, { at: { x: 1, y: 2 }, progress: 0.3, seed: 1 });
        expect(g.visible).toBe(true);
        drawHurtSparks(g, null);
        expect(g.visible).toBe(false);
        g.destroy({ context: true });
    });
});

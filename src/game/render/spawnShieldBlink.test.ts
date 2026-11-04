import { describe, it, expect } from 'vitest';
import { spawnShieldAlpha } from './spawnShieldBlink';

describe('spawn shield blink', () => {
    it('is solid without a shield', () => {
        expect(spawnShieldAlpha({}, 1000)).toBe(1);
        expect(spawnShieldAlpha({ spawnShieldUntil: 900 }, 1000)).toBe(1); // ran out
    });

    it('flickers between two see-through levels while shielded', () => {
        const p = { spawnShieldUntil: 3000 };
        const levels = new Set([0, 120, 240, 360].map(t => spawnShieldAlpha(p, 1200 + t)));
        expect(levels.size).toBe(2);
        levels.forEach(a => expect(a).toBeLessThan(1));
    });
});

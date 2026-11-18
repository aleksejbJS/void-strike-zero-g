import { describe, it, expect } from 'vitest';
import { blastScale, debrisPuff, fireballPuffs, flashPuff, simpleSmokePuffs, trailPuff } from './blastLooks';
import { FIRE, FIRE_PUFFS, MAX_FIRE_SCALE, MIN_SCALE, SIMPLE_SMOKE_PUFFS } from './blastTuning';
import type { PuffSpec } from './puffSprites';

const finite = (p: PuffSpec) => [p.x, p.y, p.vx, p.vy, p.ttl, p.size0, p.size1, p.alpha, p.drag, p.rise, p.fadeIn].every(Number.isFinite);

describe('blast looks', () => {
    it('blastScale keeps small blasts visible and treats nonsense as a rocket', () => {
        expect(blastScale(0.1)).toBe(MIN_SCALE);
        expect(blastScale(1.3)).toBe(1.3);
        expect(blastScale(Number.NaN)).toBe(1);
    });

    it('the fireball grows with the blast, up to a cap', () => {
        expect(fireballPuffs(0, 0, 1)).toHaveLength(FIRE_PUFFS);
        expect(fireballPuffs(0, 0, 0.5).length).toBeLessThan(FIRE_PUFFS);
        expect(fireballPuffs(0, 0, 5)).toHaveLength(Math.round(FIRE_PUFFS * MAX_FIRE_SCALE));
    });

    it('fireball puffs start near the blast, fly out and grow', () => {
        for (const p of fireballPuffs(100, 200, 1)) {
            expect(finite(p)).toBe(true);
            expect(Math.hypot(p.x - 100, p.y - 200)).toBeLessThanOrEqual(FIRE.spread + 1e-9);
            expect(p.size1).toBeGreaterThan(p.size0);
            expect(p.ramp.length).toBeGreaterThan(1);
        }
    });

    it('a bigger blast has a bigger flash', () => {
        expect(flashPuff(0, 0, 1.5).size0).toBeGreaterThan(flashPuff(0, 0, 1).size0);
    });

    it('the simple smoke rises and grows', () => {
        const puffs = simpleSmokePuffs(0, 0, 1);
        expect(puffs).toHaveLength(SIMPLE_SMOKE_PUFFS);
        for (const p of puffs) {
            expect(finite(p)).toBe(true);
            expect(p.vy).toBeLessThan(0);
            expect(p.size1).toBeGreaterThan(p.size0);
        }
    });

    it('trail and debris puffs are sane and sit where they are asked', () => {
        const t = trailPuff(10, 20), d = debrisPuff(10, 20);
        for (const p of [t, d]) expect(finite(p)).toBe(true);
        expect(Math.abs(t.x - 10)).toBeLessThan(2);
        expect(d).toMatchObject({ x: 10, y: 20 });
        expect(t.size1).toBeGreaterThan(t.size0);
    });
});

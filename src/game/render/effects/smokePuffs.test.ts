import { describe, it, expect } from 'vitest';
import { SmokeCloud } from '../../../types';
import { SMOKE_FADE_MS } from '../../systems/smoke';
import { cloudCircles, cloudFade } from './smokePuffs';

const R = 110;
const cloud = (id = 'smoke_1'): SmokeCloud => ({ id, pos: { x: 500, y: 300 }, radius: R, bornAt: 0, endsAt: 10_000 });
const reach = (circles: ReturnType<typeof cloudCircles>, c: SmokeCloud) =>
    Math.max(...circles.map(k => Math.hypot(k.x - c.pos.x, k.y - c.pos.y) + k.r));

describe('cloudFade', () => {
    it('is full size and opacity until the fade starts', () => {
        expect(cloudFade(cloud(), 0)).toEqual({ scale: 1, alpha: 1 });
        expect(cloudFade(cloud(), 10_000 - SMOKE_FADE_MS)).toEqual({ scale: 1, alpha: 1 });
    });

    it('shrinks and thins out over the last 2 s, gone at the end', () => {
        const mid = cloudFade(cloud(), 10_000 - SMOKE_FADE_MS / 2);
        expect(mid.scale).toBeCloseTo(0.5);
        expect(mid.alpha).toBeGreaterThan(0);
        expect(mid.alpha).toBeLessThan(1);
        expect(cloudFade(cloud(), 10_000)).toEqual({ scale: 0, alpha: 0 });
    });
});

describe('cloudCircles', () => {
    it('has an opaque core of 0.75 × the radius at the cloud centre', () => {
        const core = cloudCircles(cloud(), 1000).find(k => k.alpha >= 0.95);
        expect(core).toMatchObject({ x: 500, y: 300, r: R * 0.75 });
    });

    it('covers the whole hiding area with puffs, without spilling far beyond it', () => {
        const c = cloud();
        const solid = cloudCircles(c, 1000).filter(k => k.alpha >= 0.8);
        expect(reach(solid, c)).toBeGreaterThanOrEqual(R);
        expect(reach(cloudCircles(c, 1000), c)).toBeLessThan(R * 1.3);
    });

    it('lays out the same puffs for the same cloud and a different layout for another one', () => {
        expect(cloudCircles(cloud(), 1234)).toEqual(cloudCircles(cloud(), 1234));
        expect(cloudCircles(cloud('smoke_2'), 1234)).not.toEqual(cloudCircles(cloud(), 1234));
    });

    it('drifts gently over time', () => {
        const a = cloudCircles(cloud(), 1000);
        const b = cloudCircles(cloud(), 1500);
        expect(b).not.toEqual(a);
        a.forEach((k, i) => expect(Math.hypot(b[i].x - k.x, b[i].y - k.y)).toBeLessThan(15));
    });

    it('scales the whole cloud down during the fade and draws nothing once it is gone', () => {
        const c = cloud();
        const half = cloudCircles(c, 10_000 - SMOKE_FADE_MS / 2);
        expect(reach(half, c)).toBeLessThan(R * 0.7);
        expect(cloudCircles(c, 10_000)).toEqual([]);
    });
});

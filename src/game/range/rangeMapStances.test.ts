import { describe, it, expect } from 'vitest';
import { segmentIntersectsRect } from '../utils/math';
import { DUMMY_SPOTS, RANGE_COVER } from './rangeMap';
import { LEDGES, SHOOTER, coverRect, dummyHitRect, grown } from './rangeMapTestKit';
import type { DummySpot, DummyStance, PlatformDef } from './rangeMapTestKit';

// The C key turns every dummy crouching, then prone, so the hit boxes get lower. A shot from the spawn must still
// reach each dummy's box (aimed at its centre) without passing another dummy, a cover piece or a ledge.
const SLACK = 10; // every line clears what it passes by this much, so a slightly off aim still lands

const ownLedge = (spot: DummySpot): PlatformDef => {
    const own = LEDGES.filter(p => p.y === spot.pos.y && spot.pos.x >= p.x && spot.pos.x <= p.x + p.w);
    expect(own, `${spot.skinId} has no ledge of its own`).toHaveLength(1);
    return own[0];
};

const centreOf = (spot: DummySpot, stance: DummyStance) => {
    const r = dummyHitRect(spot, stance);
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
};

describe.each<DummyStance>(['crouch', 'prone'])('a %s dummy', stance => {
    it.each(DUMMY_SPOTS.map(s => [s.skinId, s] as const))('%s: the line from the spawn to the centre of its hit box is clear', (_id, target) => {
        const centre = centreOf(target, stance);
        const line = (rect: Parameters<typeof grown>[0]) => segmentIntersectsRect(SHOOTER, centre, grown(rect, SLACK));

        for (const other of DUMMY_SPOTS.filter(o => o !== target)) {
            expect(line(dummyHitRect(other, stance)), `${other.skinId} stands in the line to ${target.skinId}`).toBe(false);
        }
        for (const entry of RANGE_COVER) {
            expect(line(coverRect(entry)), `${entry[0]} blocks ${target.skinId}`).toBe(false);
        }
        const mine = ownLedge(target);
        for (const ledge of LEDGES.filter(l => l !== mine)) {
            expect(line(ledge), `a ledge blocks ${target.skinId}`).toBe(false);
        }
        // The target's own ledge top may be grazed (the box stands on it); nothing below it may be crossed
        const body = { x: mine.x, y: mine.y + 1, w: mine.w, h: mine.h - 1 };
        expect(segmentIntersectsRect(SHOOTER, centre, body), `the line to ${target.skinId} enters its own ledge`).toBe(false);
    });

    it('has every dummy box lower than its standing one, the box the aim point is derived from', () => {
        for (const spot of DUMMY_SPOTS) {
            expect(dummyHitRect(spot, stance).h, spot.skinId).toBeLessThan(dummyHitRect(spot, 'stand').h);
        }
    });
});

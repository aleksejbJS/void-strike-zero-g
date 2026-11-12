import { describe, it, expect } from 'vitest';
import { WeaponType } from '../../../types';
import { Corpse, CorpsePointId, createCorpse } from './corpseBody';
import { activeHinges, bendHinges, hingeBend, HINGES } from './corpseHinge';
import { launchCorpse, launchLimb } from './corpseLaunch';
import { stepCorpse } from './corpseStep';

const corpse = (facing: 1 | -1 = 1, weapon?: WeaponType) =>
    createCorpse({ x: 0, y: 500, facing, kind: 'fall', weapon });

/** Signed bend angle of a hinge in degrees: positive = the allowed way. */
const bendDeg = (c: Corpse, [a, b, d, way]: typeof HINGES[number]) => {
    const A = c.points[a], B = c.points[b], D = c.points[d];
    const ux = B.x - A.x, uy = B.y - A.y, vx = D.x - B.x, vy = D.y - B.y;
    return Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy) * 180 / Math.PI * way * c.facing;
};

/** Move a hinge's joint `amount` off the line between its ends, to the side it must not bend to. */
const bendWrong = (c: Corpse, hinge: typeof HINGES[number], amount: number) => {
    const A = c.points[hinge[0]], B = c.points[hinge[1]], D = c.points[hinge[2]];
    const ex = D.x - A.x, ey = D.y - A.y, len = Math.hypot(ex, ey);
    const mid = { x: (A.x + D.x) / 2, y: (A.y + D.y) / 2 };
    for (const side of [1, -1]) {
        B.x = B.px = mid.x - ey / len * amount * side;
        B.y = B.py = mid.y + ex / len * amount * side;
        if (hingeBend(c, hinge) < 0) return;
    }
};

const hyperextendFrontKnee = (c: Corpse) => bendWrong(c, HINGES[0], 8);

/** Turn the whole body by `angle` around its hip (keeps every velocity at zero). */
const rotate = (c: Corpse, angle: number) => {
    const { x: cx, y: cy } = c.points.hip;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    for (const p of Object.values(c.points)) {
        const dx = p.x - cx, dy = p.y - cy;
        p.x = p.px = cx + dx * cos - dy * sin;
        p.y = p.py = cy + dx * sin + dy * cos;
    }
};

const snapshot = (c: Corpse) => Object.fromEntries(Object.entries(c.points).map(([id, p]) => [id, { x: p.x, y: p.y }]));

describe('corpse hinges', () => {
    it('a fresh corpse already bends every knee and elbow the allowed way, so nothing moves', () => {
        for (const weapon of Object.values(WeaponType)) {
            for (const facing of [1, -1] as const) {
                const c = corpse(facing, weapon);
                for (const h of HINGES) expect(hingeBend(c, h)).toBeGreaterThan(0);
                const before = snapshot(c);
                bendHinges(c, activeHinges(c));
                expect(snapshot(c)).toEqual(before);
            }
        }
    });

    it('straightens a knee bent backwards, facing either way', () => {
        for (const facing of [1, -1] as const) {
            const c = corpse(facing);
            hyperextendFrontKnee(c);
            expect(bendDeg(c, HINGES[0])).toBeLessThan(-10);
            bendHinges(c, activeHinges(c));
            expect(bendDeg(c, HINGES[0])).toBeGreaterThanOrEqual(-1e-6);
        }
    });

    it('straightens an elbow bent the wrong way', () => {
        const c = corpse();
        bendWrong(c, HINGES[2], 6);
        expect(bendDeg(c, HINGES[2])).toBeLessThan(-10);
        bendHinges(c, activeHinges(c));
        expect(bendDeg(c, HINGES[2])).toBeGreaterThanOrEqual(-1e-6);
    });

    it('works the same for a body turned upside down', () => {
        const c = corpse();
        hyperextendFrontKnee(c);
        rotate(c, Math.PI * 0.8);
        expect(bendDeg(c, HINGES[0])).toBeLessThan(-10);
        bendHinges(c, activeHinges(c));
        expect(bendDeg(c, HINGES[0])).toBeGreaterThanOrEqual(-1e-6);
    });

    it('adds no speed to the body: the joint and its two ends move in opposite shares', () => {
        const c = corpse();
        hyperextendFrontKnee(c);
        const before = snapshot(c);
        bendHinges(c, activeHinges(c));
        let sx = 0, sy = 0;
        for (const id of Object.keys(before) as CorpsePointId[]) {
            sx += c.points[id].x - before[id].x;
            sy += c.points[id].y - before[id].y;
        }
        expect(Math.abs(sx)).toBeLessThan(1e-9);
        expect(Math.abs(sy)).toBeLessThan(1e-9);
    });

    it('skips a hinge whose bone was torn off', () => {
        const gib = createCorpse({ x: 0, y: 500, facing: 1, kind: 'gib' });
        launchCorpse(gib, undefined, { x: 0, y: 0 });
        const hinges = activeHinges(gib).map(h => h[1]);
        expect(hinges).not.toContain('knF');
        expect(hinges).not.toContain('knB');
        expect(hinges).toContain('elF'); // a torn-off arm is still an arm

        const leg = createCorpse({ x: 0, y: 500, facing: 1, kind: 'gib' });
        launchLimb(leg, undefined, { x: 0, y: 0 });
        expect(activeHinges(leg).map(h => h[1])).not.toContain('knB');
    });

    it('keeps joints from ending a tick bent backwards through real kills', () => {
        const platforms = [
            { id: 'f', x: -2000, y: 500, w: 4000, h: 40, color: '' },
            { id: 'w', x: 300, y: 200, w: 30, h: 300, color: '' },
        ];
        let worst = 0;
        for (const kind of ['fall', 'thrown', 'cut'] as const) {
            for (let i = 0; i < 40; i++) {
                const facing = i % 2 ? 1 : -1;
                const c = createCorpse({ x: (i % 5) * 40, y: 500, facing, kind });
                launchCorpse(c, { x: (i % 5) * 40 - facing * (10 + (i % 7) * 30), y: 470 - (i % 3) * 20 }, { x: (i % 9) - 4, y: -(i % 4) }, i % 3 === 0);
                const hinges = activeHinges(c);
                for (let t = 0; t < 300; t++) {
                    stepCorpse(c, platforms);
                    for (const h of hinges) worst = Math.min(worst, bendDeg(c, h));
                }
            }
        }
        // Platform contacts run after the hinges in a pass and may tip a joint a little past straight
        expect(worst).toBeGreaterThan(-5);
    });
});

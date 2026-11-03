import { describe, expect, it } from 'vitest';
import { Vector2, WeaponType } from '../../../types';
import type { DeathEvent } from '../../systems/events';
import { Corpse, createCorpse } from '../../systems/ragdoll/corpseBody';
import { FighterPose, RIG_SCALE, solvePose } from '../fighter/fighterPose';
import { gripPoints } from '../fighter/weaponGrips';
import { cutLegsOf, piecesOf, poseFromCorpse } from './corpsePose';

const death = (extra: Partial<DeathEvent> = {}): DeathEvent => ({
    type: 'DEATH', x: 100, y: 500, color: '#fff', height: 72, vel: { x: 0, y: 0 }, facing: 1,
    weapon: WeaponType.MACHINE_GUN, ...extra,
});

// The idle pose createCorpse starts from (same grip: machine gun, fallback aspect)
const idle = solvePose({ state: 'idle', aim: 0, t: 0, phase: 0, moveDir: 1, recoil: 0, grip: gripPoints(WeaponType.MACHINE_GUN, 0.23) });

/** Every joint of a pose relative to its hip. */
const joints = (p: FighterPose): Record<string, Vector2> => {
    const rel = (q: Vector2) => ({ x: q.x - p.hip.x, y: q.y - p.hip.y });
    return {
        head: rel(p.head), shoulderFront: rel(p.shoulderFront), shoulderBack: rel(p.shoulderBack),
        elF: rel(p.frontArm.joint), haF: rel(p.frontArm.end), elB: rel(p.backArm.joint), haB: rel(p.backArm.end),
        knF: rel(p.frontLeg.joint), anF: rel(p.frontLeg.end), knB: rel(p.backLeg.joint), anB: rel(p.backLeg.end),
    };
};

/** Turn every point of the corpse by `angle` around its hip. */
const turned = (c: Corpse, angle: number): Corpse => {
    const hip = { ...c.points.hip };
    const cos = Math.cos(angle), sin = Math.sin(angle);
    for (const p of Object.values(c.points)) {
        const dx = p.x - hip.x, dy = p.y - hip.y;
        p.x = p.px = hip.x + dx * cos - dy * sin;
        p.y = p.py = hip.y + dx * sin + dy * cos;
    }
    return c;
};

describe('poseFromCorpse', () => {
    it('a fresh corpse poses like the idle fighter', () => {
        for (const facing of [1, -1] as const) {
            const c = createCorpse(death({ facing }));
            const { pose, origin } = poseFromCorpse(c);
            expect(origin).toEqual({ x: c.points.hip.x, y: c.points.hip.y });
            expect(pose.hip).toEqual({ x: 0, y: 0 });
            expect(pose.lift).toBe(0);
            expect(Math.abs(pose.lean - idle.lean)).toBeLessThan(0.02);
            const got = joints(pose), want = joints(idle);
            for (const id of Object.keys(want)) {
                expect(Math.hypot(got[id].x - want[id].x, got[id].y - want[id].y), `${id} facing ${facing}`).toBeLessThan(0.5);
            }
            expect(Math.abs(pose.headTilt - idle.headTilt)).toBeLessThan(0.05);
        }
    });

    it('a corpse lying on its back has lean near ±π/2', () => {
        for (const facing of [1, -1] as const) {
            for (const angle of [Math.PI / 2, -Math.PI / 2]) {
                const { pose } = poseFromCorpse(turned(createCorpse(death({ facing })), angle));
                expect(Math.abs(Math.abs(pose.lean) - Math.PI / 2)).toBeLessThan(0.1);
            }
        }
    });

    it('the head turns with the body', () => {
        const { pose } = poseFromCorpse(turned(createCorpse(death()), Math.PI / 2));
        expect(Math.abs(pose.headTilt - pose.lean)).toBeLessThan(0.1);
    });
});

describe('piecesOf', () => {
    it('a whole body has no pieces', () => {
        expect(piecesOf(createCorpse(death({ kind: 'fall' })))).toEqual([]);
        expect(piecesOf(createCorpse(death({ kind: 'thrown' })))).toEqual([]);
    });

    it('a gib has head, torso, two arms and two legs', () => {
        const parts = piecesOf(createCorpse(death({ kind: 'gib' }))).map(p => p.part);
        expect(parts.sort()).toEqual(['arm-back', 'arm-front', 'head', 'leg-back', 'leg-front', 'torso']);
    });

    it('a cut has the upper half and the legs', () => {
        const parts = piecesOf(createCorpse(death({ kind: 'cut' }))).map(p => p.part);
        expect(parts.sort()).toEqual(['legs', 'upper']);
    });

    it('pieces sit on their points and stand upright on a fresh corpse', () => {
        for (const facing of [1, -1] as const) {
            const c = createCorpse(death({ kind: 'gib', facing }));
            const byPart = Object.fromEntries(piecesOf(c).map(p => [p.part, p]));
            expect(byPart.head.at).toEqual({ x: c.points.head.x, y: c.points.head.y });
            expect(byPart['arm-front'].at).toEqual({ x: c.points.elF.x, y: c.points.elF.y });
            expect(byPart['leg-back'].at).toEqual({ x: c.points.knB.x, y: c.points.knB.y });
            // The torso's middle is halfway up the spine
            expect(byPart.torso.at.y).toBeCloseTo((c.points.hip.y + c.points.neck.y) / 2, 5);
            expect(Math.abs(byPart.torso.rotation)).toBeLessThan(0.1);
            expect(Math.abs(byPart.head.rotation)).toBeLessThan(0.1);
        }
        for (const facing of [1, -1] as const) {
            const c = createCorpse(death({ kind: 'cut', facing }));
            for (const piece of piecesOf(c)) expect(Math.abs(piece.rotation), piece.part).toBeLessThan(0.1);
        }
    });

    it('a piece turns the way its points turn, on either facing', () => {
        for (const facing of [1, -1] as const) {
            const c = turned(createCorpse(death({ kind: 'gib', facing })), 0.5);
            const torso = piecesOf(c).find(p => p.part === 'torso')!;
            // Pixi rotation is clockwise-positive in world space (y down), whatever the facing
            expect(torso.rotation).toBeCloseTo(0.5 + facing * poseFromCorpse(createCorpse(death({ facing }))).pose.lean, 1);
        }
    });

    it('cut legs bend with their points: standing at death, kneeling when they fold', () => {
        for (const facing of [1, -1] as const) {
            const fresh = cutLegsOf(createCorpse(death({ kind: 'cut', facing })));
            const idleJoints = joints(idle);
            for (const id of ['knF', 'anF', 'knB', 'anB'] as const) {
                expect(fresh[id].x).toBeCloseTo(idleJoints[id].x, 5);
                expect(fresh[id].y).toBeCloseTo(idleJoints[id].y, 5);
            }
            // Folded under the hip: knees down on the floor, shins flat behind. The piece turned by its
            // rotation (and mirrored with the facing) puts every knee and ankle back on its point.
            const c = createCorpse(death({ kind: 'cut', facing }));
            const { hip } = c.points;
            c.points.knF = { x: hip.x + facing * 4, y: hip.y + 16, px: 0, py: 0 };
            c.points.knB = { x: hip.x - facing * 2, y: hip.y + 16, px: 0, py: 0 };
            c.points.anF = { x: hip.x - facing * 14, y: hip.y + 17, px: 0, py: 0 };
            c.points.anB = { x: hip.x - facing * 19, y: hip.y + 17, px: 0, py: 0 };
            const legs = piecesOf(c).find(p => p.part === 'legs')!;
            const inPiece = cutLegsOf(c);
            const cos = Math.cos(legs.rotation), sin = Math.sin(legs.rotation);
            for (const id of ['knF', 'anF', 'knB', 'anB'] as const) {
                const local = { x: inPiece[id].x * facing * RIG_SCALE, y: inPiece[id].y * RIG_SCALE };
                expect(legs.at.x + local.x * cos - local.y * sin).toBeCloseTo(c.points[id].x, 5);
                expect(legs.at.y + local.x * sin + local.y * cos).toBeCloseTo(c.points[id].y, 5);
            }
        }
    });
});

describe('piecesOf one-legged and torn-leg corpses', () => {
    const partsOf = (c: Corpse) => piecesOf(c).map(p => p.part).sort();

    it('a torn leg (only: leg-back) is exactly that one piece, where the knee lies', () => {
        const c = createCorpse(death({ kind: 'gib' }));
        c.only = 'leg-back';
        expect(partsOf(c)).toEqual(['leg-back']);
        expect(piecesOf(c)[0].at).toEqual({ x: c.points.knB.x, y: c.points.knB.y });
    });

    it('a gib of a one-legged fighter has no back leg', () => {
        const c = createCorpse(death({ kind: 'gib', oneLeg: true }));
        expect(partsOf(c)).toEqual(['arm-back', 'arm-front', 'head', 'leg-front', 'torso']);
    });

    it('a corpse with both legs keeps both', () => {
        expect(partsOf(createCorpse(death({ kind: 'gib', oneLeg: false })))).toContain('leg-back');
    });

    it('a cut and a whole body of a one-legged fighter still have their usual pieces', () => {
        expect(partsOf(createCorpse(death({ kind: 'cut', oneLeg: true })))).toEqual(['legs', 'upper']);
        expect(piecesOf(createCorpse(death({ kind: 'fall', oneLeg: true })))).toEqual([]);
    });
});

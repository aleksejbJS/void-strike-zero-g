import { describe, expect, it } from 'vitest';
import { WeaponType } from '../../../types';
import { DEFAULT_BUILD } from '../../build/buildParts';
import { createCorpse } from '../../systems/ragdoll/corpseBody';
import { solvePose } from '../fighter/fighterPose';
import { gripPoints } from '../fighter/weaponGrips';
import { cableCurves, CABLE_COLORS } from './robotCables';
import { corpseSockets, liveSockets, type Socket } from './robotSockets';
import { RUNTIME_BODY_ART } from './runtimeDefinitions';
import { corpseRigTargets } from './corpseTargets';

const socket: Socket = { at: { x: 2, y: -30 }, dir: { x: 0, y: 1 }, radius: 3, kind: 'hip' };
const robot = RUNTIME_BODY_ART.robot;
const corpse = (kind: 'gib' | 'cut' | 'fall', only?: 'leg-back') => {
    const c = createCorpse({ x: 100, y: 500, kind, facing: 1,
        parts: { head: '#fff', torso: '#fff', arm: '#fff', leg: '#fff', build: { ...DEFAULT_BUILD, body: 'robot' } } });
    if (only) c.only = only;
    return c;
};
const unit = (v: { x: number; y: number }) => { const l = Math.hypot(v.x, v.y); return { x: v.x / l, y: v.y / l }; };

describe('robot socket cables', () => {
    it('draws five coloured cables 4 to 9 rig units long, all leaving the socket outward', () => {
        for (const time of [0, 0.7, 3.1]) {
            const cables = cableCurves(socket, 11, time, { x: 4, y: -2 });
            expect(cables.map(c => c.color)).toEqual([...CABLE_COLORS]);
            for (const c of cables) {
                const length = Math.hypot(c.to.x - c.from.x, c.to.y - c.from.y);
                expect(length).toBeGreaterThanOrEqual(4 - 1e-9);
                expect(length).toBeLessThanOrEqual(9 + 1e-9);
                const out = unit({ x: c.to.x - c.from.x, y: c.to.y - c.from.y });
                expect(out.x * socket.dir.x + out.y * socket.dir.y).toBeGreaterThan(0);
            }
        }
    });

    it('keeps one bundle\'s look for one seed and time, and differs between seeds', () => {
        expect(cableCurves(socket, 5, 1.2, { x: 0, y: 0 })).toEqual(cableCurves(socket, 5, 1.2, { x: 0, y: 0 }));
        expect(cableCurves(socket, 5, 1.2, { x: 0, y: 0 })).not.toEqual(cableCurves(socket, 6, 1.2, { x: 0, y: 0 }));
    });
});

describe('robot sockets per tear', () => {
    it('opens the back hip of a live one-legged robot, pointing down its missing leg', () => {
        const pose = solvePose({ state: 'idle', body: 'robot', aim: 0, t: 0, phase: 0, moveDir: 1, recoil: 0,
            grip: gripPoints(WeaponType.MACHINE_GUN, 0.23) });
        expect(liveSockets(robot, pose, false)).toEqual([]);
        const [hip, ...rest] = liveSockets(robot, pose, true);
        expect(rest).toEqual([]);
        expect(hip.kind).toBe('hip');
        expect(hip.dir.y).toBeGreaterThan(0.5);
    });

    it('opens ten sockets on a gib: neck, shoulders and hips on the body and on every torn piece', () => {
        const c = corpse('gib');
        const kinds = corpseSockets(robot, c, corpseRigTargets(robot, c)).map(s => s.kind).sort();
        expect(kinds).toEqual(['hip', 'hip', 'hip', 'hip', 'neck', 'neck', 'shoulder', 'shoulder', 'shoulder', 'shoulder']);
    });

    it('puts the body-side shoulder and hip sockets where the torn pieces were attached', () => {
        const c = corpse('gib'), targets = corpseRigTargets(robot, c);
        const sockets = corpseSockets(robot, c, targets);
        const near = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
        const shoulders = sockets.filter(s => s.kind === 'shoulder').map(s => s.at);
        expect(Math.min(...shoulders.map(at => near(at, targets.upperArmFront!.start)))).toBeLessThan(0.5);
        expect(Math.min(...sockets.filter(s => s.kind === 'neck').map(s => near(s.at, targets.torso!.end!)))).toBeLessThan(1e-9);
    });

    it('opens the waist on both halves of a cut, the hip end of a torn-off leg, and nothing on a whole body', () => {
        const cut = corpse('cut');
        expect(corpseSockets(robot, cut, corpseRigTargets(robot, cut)).map(s => s.kind)).toEqual(['waist', 'waist']);
        const leg = corpse('gib', 'leg-back');
        expect(corpseSockets(robot, leg, corpseRigTargets(robot, leg)).map(s => s.kind)).toEqual(['hip']);
        const whole = corpse('fall');
        expect(corpseSockets(robot, whole, corpseRigTargets(robot, whole))).toEqual([]);
    });
});

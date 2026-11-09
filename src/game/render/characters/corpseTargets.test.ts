import { describe, expect, it } from 'vitest';
import { createCorpse, Corpse, CorpsePointId } from '../../systems/ragdoll/corpseBody';
import { RIG_SCALE } from '../fighter/fighterPose';
import { BODY_ART } from './definitions';
import { corpseRigTargets } from './corpseTargets';

const make = (kind: 'gib' | 'cut' = 'gib', facing: 1 | -1 = 1) => createCorpse({ x: 100, y: 500, kind, facing });
const set = (c: Corpse, id: CorpsePointId, x: number, y: number) => {
    c.points[id].x = c.points.hip.x + x * RIG_SCALE * c.facing;
    c.points[id].y = c.points.hip.y + y * RIG_SCALE;
};

describe('illustrated corpse bone targets', () => {
    it('reconstructs detached thigh from its own shin, independently of the torso', () => {
        const c = make();
        set(c, 'knF', 60, 70); set(c, 'anF', 72, 70);
        const targets = corpseRigTargets(BODY_ART.human, c);
        expect(targets.thighFront?.start.x).toBeCloseTo(45.5);
        expect(targets.thighFront?.start.y).toBeCloseTo(70);
        expect(targets.thighFront?.end?.x).toBeCloseTo(60);
        expect(targets.shinFront?.end?.x).toBeCloseTo(72);
    });

    it('binds torn arms to their independent shoulder, elbow and hand points', () => {
        const c = make();
        set(c, 'shB', 80, 20); set(c, 'elB', 90, 20); set(c, 'haB', 90, 29);
        const targets = corpseRigTargets(BODY_ART.robot, c);
        expect(targets.upperArmBack?.start.x).toBeCloseTo(80); expect(targets.upperArmBack?.start.y).toBeCloseTo(20);
        expect(targets.upperArmBack?.end?.x).toBeCloseTo(90); expect(targets.upperArmBack?.end?.y).toBeCloseTo(20);
        expect(targets.forearmBack?.start.x).toBeCloseTo(90); expect(targets.forearmBack?.end?.y).toBeCloseTo(29);
        expect(targets.handBack?.start.x).toBeCloseTo(90); expect(targets.handBack?.start.y).toBeCloseTo(29);
    });

    it('uses independent cut frames so separated halves never stretch across the gap', () => {
        const c = make('cut');
        c.points.neck.x += 200; c.points.neck.y -= 100;
        c.points.head.x += 200; c.points.head.y -= 100;
        const targets = corpseRigTargets(BODY_ART.cat, c);
        const torso = targets.torso!, pelvis = targets.pelvis!;
        expect(torso.end!.x).toBeCloseTo((c.points.neck.x - c.points.hip.x) / RIG_SCALE);
        expect(torso.end!.y).toBeCloseTo((c.points.neck.y - c.points.hip.y) / RIG_SCALE);
        expect(Math.hypot(torso.end!.x - torso.start.x, torso.end!.y - torso.start.y)).toBeCloseTo(19);
        expect(Math.hypot(pelvis.end!.x, pelvis.end!.y)).toBeCloseTo(19);
        expect(pelvis.start).toEqual({ x: 0, y: 0 });
        expect(Math.abs(torso.start.x)).toBeGreaterThan(150);
        expect(targets.tail?.start).toEqual({ x: 0, y: 0 });
    });

    it('draws exactly the requested detached leg and keeps absent back legs hidden', () => {
        const c = make(); c.only = 'leg-back';
        expect(Object.keys(corpseRigTargets(BODY_ART.toxic, c)).sort()).toEqual(['footBack', 'shinBack', 'thighBack']);
        c.only = undefined; c.oneLeg = true;
        const gib = corpseRigTargets(BODY_ART.toxic, c);
        expect(gib.thighBack).toBeUndefined(); expect(gib.shinBack).toBeUndefined(); expect(gib.footBack).toBeUndefined();
        c.kind = 'cut';
        const cut = corpseRigTargets(BODY_ART.toxic, c);
        expect(cut.thighBack).toBeUndefined(); expect(cut.thighFront).toBeDefined();
    });

    it('converts world head roll through the mirrored root without following the neck', () => {
        const c = make('gib', -1);
        expect(corpseRigTargets(BODY_ART['human-female'], c, 2).head?.rotation).toBe(-2);
    });

    it('keeps a collapsed detached shin finite', () => {
        const c = make(); set(c, 'knF', 20, 30); set(c, 'anF', 20, 30);
        const target = corpseRigTargets(BODY_ART.human, c).thighFront!;
        expect(target.start.x).toBeCloseTo(20); expect(target.start.y).toBeCloseTo(15.5);
    });

    it('keeps an explicitly detached leg complete even when its donor has lost that leg', () => {
        const c = make(); c.only = 'leg-back'; c.oneLeg = true;
        const targets = corpseRigTargets(BODY_ART.human, c);
        expect(targets.shinBack?.visible).not.toBe(false);
        expect(targets.footBack?.visible).not.toBe(false);
    });

    it.each(Object.values(BODY_ART))('keeps $id cut thighs in the lower frame when the upper half tumbles away', definition => {
        const c = make('cut');
        const before = corpseRigTargets(definition, c), pivot = { ...c.points.neck };
        for (const id of ['neck', 'head', 'shF', 'elF', 'haF', 'shB', 'elB', 'haB'] as const) {
            const point = c.points[id], dx = point.x - pivot.x, dy = point.y - pivot.y;
            point.x = pivot.x + 250 - dy; point.y = pivot.y - 120 + dx;
        }
        const after = corpseRigTargets(definition, c);
        for (const id of ['thighFront', 'thighBack', 'shinFront', 'shinBack', 'footFront', 'footBack'] as const) {
            expect(after[id]).toEqual(before[id]);
        }
        for (const id of ['upperArmFront', 'forearmFront', 'upperArmBack', 'forearmBack', 'torso'] as const) {
            const a = before[id]!, b = after[id]!;
            expect(Math.hypot(b.end!.x - b.start.x, b.end!.y - b.start.y))
                .toBeCloseTo(Math.hypot(a.end!.x - a.start.x, a.end!.y - a.start.y));
        }
        expect(after.head!.start.x).not.toBeCloseTo(before.head!.start.x);
    });
});

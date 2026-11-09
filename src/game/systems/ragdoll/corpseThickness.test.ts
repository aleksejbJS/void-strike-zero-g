// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Platform } from '../../../types';
import { BODY_IDS, type BodyId } from '../../build/bodyTypes';
import { DEFAULT_BUILD } from '../../build/buildParts';
import { BODY_ART } from '../../render/characters/definitions';
import { RIG_SCALE } from '../../render/fighter/fighterPose';
import { createCorpse, type Corpse, type CorpsePointId } from './corpseBody';
import { CORPSE_GRAVITY, speedOf, stepCorpse } from './corpseStep';

const TOP = 500;
const floor: Platform = { id: 'floor', x: -1000, y: TOP, w: 3000, h: 40, color: '#000' };
const make = (body?: BodyId): Corpse => createCorpse({ x: 300, y: TOP - 70, facing: 1, kind: 'fall',
    parts: { head: '#ffffff', torso: '#ffffff', arm: '#ffffff', leg: '#ffffff', build: { ...DEFAULT_BUILD, body } } });
const headRadius = (body: BodyId) => {
    const art = BODY_ART[body], head = art.parts.head!;
    const radius = Math.max(...head.polygon.map(([x, y]) => Math.hypot(x - head.origin[0], y - head.origin[1])));
    return radius * 19 / Math.hypot(art.neck[0] - art.hip[0], art.neck[1] - art.hip[1]) * RIG_SCALE;
};
const thickness: Record<CorpsePointId, number> = { hip: 5, neck: 5.5, head: 0, shF: 3.5, shB: 3.5,
    elF: 3, elB: 3, haF: 2.75, haB: 2.75, knF: 3.25, knB: 3.25, anF: 3, anB: 3, gunA: 0, gunB: 0 };

describe('illustrated corpse thickness at platforms', () => {
    it.each(BODY_IDS)('keeps the complete %s head circle and body joints above a floor after falling', body => {
        const c = make(body);
        for (const p of Object.values(c.points)) p.px -= 1;
        for (let tick = 0; tick < 480; tick++) stepCorpse(c, [floor]);
        for (const id of Object.keys(c.points) as CorpsePointId[]) {
            const radius = id === 'head' ? headRadius(body) : thickness[id] * RIG_SCALE;
            expect(c.points[id].y + radius, `${body}/${id}`).toBeLessThanOrEqual(TOP + 0.5);
        }
        expect(speedOf(c), body).toBeLessThan(0.05);
    });

    it.each(BODY_IDS)('creeps an embedded %s head out without turning the thickness push into velocity', body => {
        const c = make(body); c.links = [];
        const head = c.points.head; head.y = head.py = TOP + 1;
        const before = head.y;
        stepCorpse(c, [floor]);
        expect(Math.abs(head.y - before)).toBeLessThanOrEqual(1 + CORPSE_GRAVITY);
        expect(Math.hypot(head.x - head.px, head.y - head.py)).toBeLessThanOrEqual(CORPSE_GRAVITY + 1e-8);
        for (let tick = 0; tick < 100; tick++) stepCorpse(c, [floor]);
        expect(head.y + headRadius(body)).toBeLessThanOrEqual(TOP + 1e-8);
    });

    it.each(BODY_IDS)('lands %s thickness on the top of a thin platform after a fast fall', body => {
        const c = make(body), thin = { ...floor, h: 10 };
        for (const point of Object.values(c.points)) { point.y -= 300; point.py = point.y - 9; }
        for (let tick = 0; tick < 480; tick++) stepCorpse(c, [thin]);
        expect(c.points.head.y + headRadius(body)).toBeLessThanOrEqual(TOP + 0.5);
        expect(c.points.hip.y + 5 * RIG_SCALE).toBeLessThanOrEqual(TOP + 0.5);
        expect(speedOf(c)).toBeLessThan(0.05);
    });

    it('retains zero-radius legacy contact for a build without a body', () => {
        const c = make(); c.links = [];
        for (let tick = 0; tick < 180; tick++) stepCorpse(c, [floor]);
        expect(c.points.head.y).toBeCloseTo(TOP, 8);
        expect(c.points.anF.y).toBeCloseTo(TOP, 8);
        expect(speedOf(c)).toBeLessThan(0.05);
        for (const point of Object.values(c.points)) expect(point.supported).toBeUndefined();
    });

    it('retains legacy contact for an unrecognized body received after corpse creation', () => {
        const c = make(); c.links = []; c.colors!.build!.body = 'invalid' as BodyId;
        for (let tick = 0; tick < 180; tick++) stepCorpse(c, [floor]);
        expect(c.points.head.y).toBeCloseTo(TOP, 8);
    });
});

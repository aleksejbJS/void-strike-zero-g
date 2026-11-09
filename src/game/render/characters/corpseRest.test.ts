import { describe, expect, it } from 'vitest';
import { BODY_IDS } from '../../build/bodyTypes';
import { DEFAULT_BUILD } from '../../build/buildParts';
import { createCorpse } from '../../systems/ragdoll/corpseBody';
import { piecesOf } from '../ragdoll/corpsePose';

// Source heads and knee spacing differ from the procedural fighter's neutral offsets.
describe('illustrated corpse rest frames', () => {
    it.each(BODY_IDS)('preserves %s torso lean at death and follows each cut half world turn', body => {
        for (const facing of [1, -1] as const) {
            const c = createCorpse({ x: 100, y: 500, kind: 'cut', facing,
                parts: { head: '#ffffff', torso: '#ffffff', arm: '#ffffff', leg: '#ffffff', build: { ...DEFAULT_BUILD, body } } });
            const lean = Math.atan2(c.points.neck.x - c.points.hip.x, c.points.hip.y - c.points.neck.y);
            for (const piece of piecesOf(c)) expect(piece.rotation).toBeCloseTo(piece.part === 'upper' ? lean : 0, 10);
            const origin = { ...c.points.hip }, turn = 0.8;
            for (const point of Object.values(c.points)) {
                const dx = point.x - origin.x, dy = point.y - origin.y;
                point.x = origin.x + dx * Math.cos(turn) - dy * Math.sin(turn);
                point.y = origin.y + dx * Math.sin(turn) + dy * Math.cos(turn);
            }
            for (const piece of piecesOf(c)) expect(piece.rotation).toBeCloseTo(turn + (piece.part === 'upper' ? lean : 0), 10);
        }
    });

    it.each(BODY_IDS)('starts %s detached head at its source artwork rest angle', body => {
        const c = createCorpse({ x: 100, y: 500, kind: 'gib', facing: 1,
            parts: { head: '#ffffff', torso: '#ffffff', arm: '#ffffff', leg: '#ffffff', build: { ...DEFAULT_BUILD, body } } });
        const lean = Math.atan2(c.points.neck.x - c.points.hip.x, c.points.hip.y - c.points.neck.y);
        expect(piecesOf(c).find(piece => piece.part === 'head')?.rotation).toBeCloseTo(lean, 10);
    });
});

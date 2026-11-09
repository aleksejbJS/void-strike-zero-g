// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Platform } from '../../../types';
import { BODY_IDS, type BodyId } from '../../build/bodyTypes';
import { DEFAULT_BUILD } from '../../build/buildParts';
import { createCorpse } from '../../systems/ragdoll/corpseBody';
import { stepCorpse } from '../../systems/ragdoll/corpseStep';
import { RIG_SCALE } from '../fighter/fighterPose';
import { IDLE_PARTS } from '../fighter/parts/partMotionFrame';
import { poseFromCorpse } from '../ragdoll/corpsePose';
import { RUNTIME_BODY_ART } from './runtimeDefinitions';
import { liveRigTargets } from './rigTargets';
import { corpseRigTargets } from './corpseTargets';
import { paintedBottom } from './paintedSurfaceTestKit';

const floor: Platform = { id: 'floor', x: -1000, y: 0, w: 3000, h: 40, color: '#000' };
const make = (body: BodyId) => createCorpse({ x: 300, y: -70, facing: 1, kind: 'fall',
    parts: { head: '#ffffff', torso: '#ffffff', arm: '#ffffff', leg: '#ffffff', build: { ...DEFAULT_BUILD, body } } });

describe('painted corpse support', () => {
    it.each(BODY_IDS)('rests the complete %s boot on support even when its shin lies horizontally', body => {
        const c = make(body); c.links = [];
        for (const [knee, ankle, x] of [['knF', 'anF', 320], ['knB', 'anB', 360]] as const) {
            c.points[knee].x = c.points[knee].px = x - 10;
            c.points[knee].y = c.points[knee].py = -3 * RIG_SCALE;
            c.points[ankle].x = c.points[ankle].px = x;
            c.points[ankle].y = c.points[ankle].py = -3 * RIG_SCALE;
        }
        stepCorpse(c, [floor]);
        const { pose, origin } = poseFromCorpse(c), definition = RUNTIME_BODY_ART[body];
        const targets = liveRigTargets(definition, pose, IDLE_PARTS, false, 0, true);
        for (const [part, ankle, leg] of [['footFront', 'anF', 'frontLeg'], ['footBack', 'anB', 'backLeg']] as const) {
            expect(c.points[ankle].supported).toBe(true);
            expect(targets[part]!.start).toEqual(pose[leg].end);
            expect(origin.y + paintedBottom(definition, part, targets[part]) * RIG_SCALE).toBeLessThanOrEqual(0.07);
        }
        stepCorpse(c, []);
        expect(c.points.anF.supported).toBe(false);
        expect(c.points.anB.supported).toBe(false);
        const airborne = poseFromCorpse(c).pose;
        expect(liveRigTargets(definition, airborne, IDLE_PARTS, false, 0, true).footFront!.rotation).not.toBe(0);
    });

    it('folds the original Cat tail above support after a whole fall, leaving its free-air rest shape intact', () => {
        const c = make('cat'); c.links = [];
        c.points.hip.y = c.points.hip.py = -5 * RIG_SCALE;
        const definition = RUNTIME_BODY_ART.cat;
        const free = liveRigTargets(definition, poseFromCorpse(c).pose, IDLE_PARTS, false, 0, true);
        expect(free.tail!.rotation).not.toBe(Math.PI / 2);
        stepCorpse(c, [floor]);
        const { pose, origin } = poseFromCorpse(c), resting = liveRigTargets(definition, pose, IDLE_PARTS, false, 0, true);
        expect(resting.tail!.rotation).toBe(Math.PI / 2);
        expect(origin.y + paintedBottom(definition, 'tail', resting.tail) * RIG_SCALE).toBeLessThanOrEqual(0.07);
    });

    it('uses the torso contact for a gib tail and lower-half contact for a cut tail', () => {
        const c = make('cat'); c.kind = 'gib'; c.points.anF.supported = true;
        expect(corpseRigTargets(RUNTIME_BODY_ART.cat, c).tail!.rotation).not.toBe(Math.PI / 2);
        c.points.hip.supported = true;
        expect(corpseRigTargets(RUNTIME_BODY_ART.cat, c).tail!.rotation).toBe(Math.PI / 2);
        c.kind = 'cut'; c.points.hip.supported = false; c.points.anF.supported = false; c.points.head.supported = true;
        expect(corpseRigTargets(RUNTIME_BODY_ART.cat, c).tail!.rotation).not.toBe(Math.PI / 2);
        c.points.knB.supported = true;
        expect(corpseRigTargets(RUNTIME_BODY_ART.cat, c).tail!.rotation).toBe(Math.PI / 2);
    });
});

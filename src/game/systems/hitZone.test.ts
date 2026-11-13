// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { Team, WeaponType } from '../../types';
import { createMockPlayer } from '../../test/mocks';
import { BODY_IDS, BodyId } from '../build/bodyTypes';
import { solvePose, RIG_SCALE, FighterState } from '../render/fighter/fighterPose';
import { gripPoints } from '../render/fighter/weaponGrips';
import { IDLE_PARTS } from '../render/fighter/parts/partMotionFrame';
import { RUNTIME_BODY_ART } from '../render/characters/runtimeDefinitions';
import { liveRigTargets } from '../render/characters/rigTargets';
import { selectHumanArt } from '../render/characters/humanArtSelector';
import { paintedTop } from '../render/characters/paintedSurfaceTestKit';
import { CROUCH_HEIGHT, PRONE_HEIGHT, STANDING_HEIGHT } from './stance';
import { DRAWN_TOP, hitRect } from './hitZone';

const STANCE_STATES: Record<'stand' | 'crouch' | 'prone', readonly FighterState[]> = {
    stand: ['idle', 'walk', 'run', 'fly', 'fall'], crouch: ['crouch'], prone: ['prone'],
};

/** Highest opaque point of the drawing above the feet (tail left out), over aims, weapons and steps. */
const measuredTop = (body: BodyId, states: readonly FighterState[]): number => {
    let top = Infinity;
    for (const state of states)
        for (const weapon of [WeaponType.MACHINE_GUN, WeaponType.RAILGUN, WeaponType.CHAINSAW])
            for (const aim of [-1.2, -0.6, 0, 0.6, 1.2])
                for (const phase of [0, 1.6, 3.1, 4.7]) {
                    const pose = solvePose({ state, aim, t: phase, phase, moveDir: 1, recoil: 0, grip: gripPoints(weapon, 0.23), body });
                    const definition = selectHumanArt(RUNTIME_BODY_ART[body], state, 'normal');
                    const targets = liveRigTargets(definition, pose, IDLE_PARTS);
                    for (const [id, target] of Object.entries(targets)) {
                        if (id !== 'tail') top = Math.min(top, paintedTop(definition, id as keyof typeof targets, target));
                    }
                }
    return -top * RIG_SCALE;
};

const fighter = (body: BodyId | undefined, stance: 'stand' | 'crouch' | 'prone' = 'stand') => {
    const p = createMockPlayer('p', Team.NONE);
    p.pos = { x: 100, y: 500 };
    p.build = body ? { ...p.build!, body } : undefined;
    if (!body) p.skinId = 'classic';
    p.isCrouching = stance === 'crouch';
    p.isProne = stance === 'prone';
    p.height = stance === 'prone' ? PRONE_HEIGHT : stance === 'crouch' ? CROUCH_HEIGHT : STANDING_HEIGHT;
    return p;
};

describe('hit zone heights follow the pictures', () => {
    it.each(BODY_IDS)('%s: the table reaches the top of the drawing in every stance, and not much higher', body => {
        for (const stance of ['stand', 'crouch', 'prone'] as const) {
            const measured = measuredTop(body, STANCE_STATES[stance]);
            expect(DRAWN_TOP[body][stance], `${body}/${stance}`).toBeGreaterThanOrEqual(measured);
            expect(DRAWN_TOP[body][stance] - measured, `${body}/${stance}`).toBeLessThan(1.5);
        }
    });
});

describe('hitRect', () => {
    it('raises the top of the box to the cat drawing, keeping the feet and the width', () => {
        const r = hitRect(fighter('cat'));
        expect(r).toEqual({ x: 85, y: 500 - DRAWN_TOP.cat.stand, w: 30, h: DRAWN_TOP.cat.stand });
        expect(hitRect(fighter('cat', 'crouch')).y).toBe(500 - DRAWN_TOP.cat.crouch);
        expect(hitRect(fighter('cat', 'prone')).y).toBe(500 - DRAWN_TOP.cat.prone);
    });

    it('covers the cat face: a point at eye height (85 above the feet) is inside', () => {
        const r = hitRect(fighter('cat'));
        expect(500 - 85).toBeGreaterThan(r.y);
    });

    it('finds the body of a fighter that has only a preset skin', () => {
        const p = fighter(undefined);
        p.skinId = 'base-cat';
        expect(hitRect(p).h).toBe(DRAWN_TOP.cat.stand);
    });

    it('keeps the plain box for a fighter without an illustrated body', () => {
        expect(hitRect(fighter(undefined))).toEqual({ x: 85, y: 428, w: 30, h: 72 });
    });

    it('is never shorter than the movement box', () => {
        for (const body of BODY_IDS) for (const stance of ['stand', 'crouch', 'prone'] as const) {
            const p = fighter(body, stance);
            expect(hitRect(p).h).toBeGreaterThanOrEqual(p.height);
        }
    });
});

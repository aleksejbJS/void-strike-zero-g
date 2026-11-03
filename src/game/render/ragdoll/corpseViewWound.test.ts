import { describe, expect, it, vi } from 'vitest';
import { Texture } from 'pixi.js';
import { GameMode, WeaponType } from '../../../types';
import { createMockState } from '../../../test/mocks';
import type { DeathEvent, LimbEvent } from '../../systems/events';
import { createCorpse } from '../../systems/ragdoll/corpseBody';
import { addLimb } from '../../systems/ragdoll/corpses';
import { DEFAULT_BUILD } from '../../build/buildParts';
import { createCorpseView, destroyCorpseView, updateCorpseView } from './corpseView';
import { TORN } from './tornFlesh';

// jsdom has no 2D canvas to bake the glow texture; nothing here depends on it
vi.mock('../effects/glowTextures', () => ({ glowTexture: () => Texture.WHITE, stripTexture: () => Texture.WHITE }));

const BACK_BOOT = 0x1b1f25;
const FRONT_BOOT = 0x252a32;

const death = (extra: Partial<DeathEvent> = {}): DeathEvent => ({
    type: 'DEATH', x: 100, y: 500, color: '#fff', height: 72, vel: { x: 0, y: 0 }, facing: 1,
    weapon: WeaponType.MACHINE_GUN,
    parts: { head: '#aa3322', torso: '#3366aa', arm: '#22aa66', leg: '#475569', build: DEFAULT_BUILD },
    ...extra,
});

/** The colour of every recorded instruction of a Graphics: which boots and how much torn flesh it shows. */
const colorsOf = (g: { context: { instructions: unknown[] } }) =>
    (g.context.instructions as { data: { style?: { color?: number } } }[]).map(i => i.data.style?.color);

describe('the view of a torn-off leg', () => {
    const state = createMockState(GameMode.DEATHMATCH);
    const event: LimbEvent = { type: 'LIMB', x: 100, y: 500, facing: 1, vel: { x: 0, y: 0 }, from: { x: 0, y: 460 },
        parts: { head: '#aa3322', torso: '#3366aa', arm: '#22aa66', leg: '#475569', build: DEFAULT_BUILD } };

    it('draws one leg piece and nothing else: no head, torso, arms or gun', () => {
        const leg = addLimb(state, event);
        const v = createCorpseView(leg, {});
        expect(v.pieces!.map(g => g.label)).toEqual(['corpse-leg-back']);
        expect(v.fighter).toBeUndefined();
        expect(v.head).toBeUndefined();
        expect(v.gun.visible).toBe(false);
        expect(colorsOf(v.pieces![0])).toContain(TORN); // torn at the hip
        updateCorpseView(v, leg);
        expect(v.pieces![0].position.x).toBeCloseTo(leg.points.knB.x, 5);
        expect(v.pieces![0].position.y).toBeCloseTo(leg.points.knB.y, 5);
        destroyCorpseView(v);
    });
});

describe('the view of a one-legged corpse', () => {
    it('a whole body has no back leg and a bloody stump instead', () => {
        for (const kind of ['fall', 'thrown'] as const) {
            const whole = createCorpse(death({ kind }));
            const wounded = createCorpse(death({ kind, oneLeg: true }));
            const [a, b] = [createCorpseView(whole, {}), createCorpseView(wounded, {})];
            expect(colorsOf(a.fighter!.body), kind).toContain(BACK_BOOT);
            expect(colorsOf(a.fighter!.body), kind).not.toContain(TORN);
            expect(colorsOf(b.fighter!.body), kind).not.toContain(BACK_BOOT);
            expect(colorsOf(b.fighter!.body), kind).toContain(FRONT_BOOT);
            expect(colorsOf(b.fighter!.body), kind).toContain(TORN);
            destroyCorpseView(a);
            destroyCorpseView(b);
        }
    });

    it('cut legs have only the front leg, also after they move', () => {
        const whole = createCorpse(death({ kind: 'cut' }));
        const wounded = createCorpse(death({ kind: 'cut', oneLeg: true }));
        const [a, b] = [createCorpseView(whole, {}), createCorpseView(wounded, {})];
        const legsOf = (v: typeof a) => v.pieces!.find(g => g.label === 'corpse-legs')!;
        expect(colorsOf(legsOf(a))).toContain(BACK_BOOT);
        expect(colorsOf(legsOf(b))).not.toContain(BACK_BOOT);
        expect(colorsOf(legsOf(b))).toContain(FRONT_BOOT);
        wounded.points.knF.y += 5; // the legs move: they are drawn again, still without the back leg
        wounded.points.anF.y += 5;
        updateCorpseView(b, wounded);
        expect(colorsOf(legsOf(b))).not.toContain(BACK_BOOT);
        expect(colorsOf(legsOf(b))).toContain(FRONT_BOOT);
        destroyCorpseView(a);
        destroyCorpseView(b);
    });

    it('a gib has no back leg piece', () => {
        const c = createCorpse(death({ kind: 'gib', oneLeg: true }));
        const v = createCorpseView(c, {});
        expect(v.pieces!.map(g => g.label)).not.toContain('corpse-leg-back');
        expect(v.pieces!.map(g => g.label)).toContain('corpse-leg-front');
        expect(v.pieces).toHaveLength(5);
        destroyCorpseView(v);
    });
});

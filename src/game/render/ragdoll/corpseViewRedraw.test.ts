import { describe, expect, it, vi } from 'vitest';
import { Texture } from 'pixi.js';
import { GameMode, WeaponType } from '../../../types';
import { createMockState } from '../../../test/mocks';
import type { DeathEvent } from '../../systems/events';
import { createCorpse } from '../../systems/ragdoll/corpseBody';
import { addCorpse } from '../../systems/ragdoll/corpses';
import { heldWeaponKey } from '../fighter/fighterAnimator';
import { createCorpseView, destroyCorpseView, updateCorpseView } from './corpseView';

// jsdom has no 2D canvas to bake the glow texture; nothing here depends on it
vi.mock('../effects/glowTextures', () => ({ glowTexture: () => Texture.WHITE, stripTexture: () => Texture.WHITE }));

const death = (extra: Partial<DeathEvent> = {}): DeathEvent => ({
    type: 'DEATH', x: 100, y: 500, color: '#fff', height: 72, vel: { x: 0, y: 0 }, facing: 1,
    weapon: WeaponType.MACHINE_GUN, ...extra,
});

describe('corpse view redraws', () => {
    it('a body lying still is not redrawn, but keeps fading', () => {
        const c = createCorpse(death());
        const v = createCorpseView(c, {});
        const body = v.fighter!.body;
        // A mark that a redraw would clear away
        body.rect(0, 0, 1, 1).fill(0xffffff);
        const marked = body.context.instructions.length;
        c.age = c.fadeAt + 60;
        updateCorpseView(v, c);
        expect(body.context.instructions.length).toBe(marked);
        expect(v.root.alpha).toBeCloseTo(0.5, 5);
        // It moves again: drawn anew
        c.points.hip.x += 2;
        updateCorpseView(v, c);
        expect(body.context.instructions.length).toBe(marked - 1);
        destroyCorpseView(v);
    });

    it('a body creeping a little at a time is redrawn once the creep adds up', () => {
        const c = createCorpse(death());
        const v = createCorpseView(c, {});
        const body = v.fighter!.body;
        body.rect(0, 0, 1, 1).fill(0xffffff);
        const marked = body.context.instructions.length;
        for (let i = 0; i < 20; i++) {
            c.points.head.x += 0.01;
            updateCorpseView(v, c);
        }
        expect(body.context.instructions.length).toBe(marked - 1);
        destroyCorpseView(v);
    });

    it('a weapon that is not a weapon type from a host draws without throwing', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const c = addCorpse(state, { ...death(), weapon: 42 } as unknown as DeathEvent);
        const textures = { [heldWeaponKey(WeaponType.MACHINE_GUN)]: Texture.WHITE };
        const v = createCorpseView(c, textures);
        expect(() => updateCorpseView(v, c)).not.toThrow();
        expect(v.gun.visible).toBe(false);
        destroyCorpseView(v);
    });
});

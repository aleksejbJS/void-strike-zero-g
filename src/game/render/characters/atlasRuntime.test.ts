import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Assets, Texture } from 'pixi.js';
import { WeaponType } from '../../../types';
import { DEFAULT_BUILD } from '../../build/buildParts';
import { createCorpse } from '../../systems/ragdoll/corpseBody';
import { createFighterView, type FighterFrame, type FighterView } from '../fighter/fighterView';
import { solvePose } from '../fighter/fighterPose';
import { gripPoints } from '../fighter/weaponGrips';
import { IDLE_PARTS } from '../fighter/parts/partMotionFrame';
import { BODY_ART } from './definitions';
import { RUNTIME_BODY_ART } from './runtimeDefinitions';
import { bodyAtlasTexture, bodyPictureTexture, bodyTexture, loadBodyTextures, resetBodyTextures } from './textures';
import { syncFighterArt } from './fighterArt';
import { createCorpseArt, type CorpseArt } from './corpseArt';
import { destroyArtRig } from './rigView';
import { selectHumanArt } from './humanArtSelector';

vi.mock('../effects/glowTextures', () => ({ glowTexture: () => Texture.WHITE, stripTexture: () => Texture.WHITE }));

const declared = { ...RUNTIME_BODY_ART }, allocated: Texture[] = [], views: FighterView[] = [], corpses: CorpseArt[] = [];
const makeTexture = () => {
    const texture = new Texture({ source: Texture.WHITE.source }); allocated.push(texture);
    return texture as unknown as Record<string, unknown>;
};
const frame = (): FighterFrame => {
    const grip = gripPoints(WeaponType.MACHINE_GUN, 0.23);
    return { pose: solvePose({ body: 'human', state: 'idle', aim: 0, t: 0, phase: 0, moveDir: 1, recoil: 0, grip }),
        look: { head: 0xffffff, torso: 0xffffff, arm: 0xffffff, leg: 0xffffff, jet: 0xffffff, visor: 0xffffff, pattern: 0xffffff,
            build: { ...DEFAULT_BUILD, body: 'human', helmet: 'none', visor: 'none' } },
        facing: 1, grip, weaponType: WeaponType.MACHINE_GUN, flame: false, flicker: 0, parts: IDLE_PARTS, muzzleFlash: 0 };
};
const live = () => { const view = createFighterView(); views.push(view); return view; };
const corpse = () => {
    const art = createCorpseArt(createCorpse({ x: 100, y: 500, kind: 'gib', facing: 1,
        parts: { head: '#ffffff', torso: '#ffffff', arm: '#ffffff', leg: '#ffffff', build: frame().look.build } }));
    if (art) corpses.push(art);
    return art;
};

beforeEach(() => {
    resetBodyTextures(); Object.assign(RUNTIME_BODY_ART, BODY_ART); RUNTIME_BODY_ART.human = declared.human;
});
afterEach(() => {
    for (const view of views.splice(0)) view.root.destroy({ children: true });
    for (const art of corpses.splice(0)) { destroyArtRig(art.rig); art.root.destroy({ children: true }); }
    resetBodyTextures(); Object.assign(RUNTIME_BODY_ART, declared); vi.restoreAllMocks();
    for (const texture of allocated.splice(0)) if (!texture.destroyed) texture.destroy();
});

describe('runtime atlas selection', () => {
    it('shares the limb atlas while living and dead Human heads use their own pictures', async () => {
        vi.spyOn(Assets, 'load').mockImplementation(async () => makeTexture());
        await loadBodyTextures();
        const view = live(); expect(syncFighterArt(view, frame())).toBe(true);
        const art = corpse()!;
        expect(view.illustrated!.definition).toBe(declared.human);
        expect(view.illustrated!.meshes.head!.texture).toBe(bodyTexture('human'));
        const dead = selectHumanArt(declared.human, undefined, 'dead');
        expect(art.rig.definition).toBe(dead);
        expect(art.rig.meshes.head!.texture).toBe(bodyPictureTexture(dead.parts.head!.image!.imagePath));
        for (const rig of [view.illustrated!, art.rig]) {
            expect(rig.meshes.thighFront!.texture).toBe(bodyAtlasTexture('human'));
        }
    });

    it('keeps the original cutouts after an atlas failure and upgrades a living rig after a successful retry', async () => {
        let fail = true;
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(Assets, 'load').mockImplementation(async url => {
            if (String(url).includes('articulated-v2') && fail) throw new Error('Atlas unavailable');
            return makeTexture();
        });
        await loadBodyTextures();
        const view = live(); expect(syncFighterArt(view, frame())).toBe(true);
        expect(view.illustrated!.definition).toBe(BODY_ART.human);
        expect(corpse()!.rig.definition).toBe(selectHumanArt(BODY_ART.human, undefined, 'dead'));
        const oldLimb = view.illustrated!.meshes.thighFront!, original = bodyTexture('human')!;
        fail = false; await loadBodyTextures();
        expect(syncFighterArt(view, frame())).toBe(true);
        expect(view.illustrated!.definition).toBe(declared.human);
        expect(oldLimb.destroyed).toBe(true); expect(original.destroyed).toBe(false);
        expect(corpse()!.rig.meshes.thighFront!.texture).toBe(bodyAtlasTexture('human'));
    });
});

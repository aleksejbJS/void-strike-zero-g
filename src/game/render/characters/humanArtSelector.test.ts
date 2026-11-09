import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Assets, Texture } from 'pixi.js';
import { WeaponType } from '../../../types';
import { DEFAULT_BUILD } from '../../build/buildParts';
import { createCorpse } from '../../systems/ragdoll/corpseBody';
import { createCorpseView, destroyCorpseView, type CorpseView } from '../ragdoll/corpseView';
import { createFighterView, type FighterFrame, type FighterView } from '../fighter/fighterView';
import { solvePose, type FighterState } from '../fighter/fighterPose';
import { gripPoints } from '../fighter/weaponGrips';
import { IDLE_PARTS } from '../fighter/parts/partMotionFrame';
import { RUNTIME_BODY_ART } from './runtimeDefinitions';
import { BODY_ART } from './definitions';
import { bodyPictureTexture, loadBodyTextures, resetBodyTextures } from './textures';
import { selectHumanArt } from './humanArtSelector';
import { syncFighterArt } from './fighterArt';

const pilot = vi.hoisted(() => {
    const picture = (name: string) => ({ imagePath: `/pilot-${name}.png`, size: [512, 512] as const });
    const part = (name: string, x: number) => ({
        image: picture(name), origin: [x, 20] as const, channel: 'none' as const, pixelScale: 0.04,
        polygon: [[x - 10, 10], [x + 10, 10], [x + 10, 50], [x - 10, 50]] as const,
    });
    const front = { ...part('crouch', 50), axisEnd: [50, 40] as const };
    const back = { ...part('crouch-far', 100), axisEnd: [100, 40] as const };
    return { front, back, hurt: part('faces', 150), dead: part('faces', 200), wound: part('faces', 300),
        prone: { ...part('prone', 250), axisEnd: [250, 40] as const },
        pictures: ['crouch', 'crouch-far', 'prone', 'faces'].map(picture) };
});
vi.mock('./data/humanPoseVariants', () => ({
    HUMAN_PICTURES: pilot.pictures, HUMAN_POSE_PARTS: {
        crouch: { upperArmFront: pilot.front, upperArmBack: pilot.back }, prone: { upperArmFront: pilot.prone },
    }, HUMAN_EXPRESSIONS: { hurt: pilot.hurt, dead: pilot.dead }, HUMAN_WOUNDS: { leg: pilot.wound },
}));
vi.mock('../effects/glowTextures', () => ({ glowTexture: () => Texture.WHITE, stripTexture: () => Texture.WHITE }));

const allocated: Texture[] = [], views: FighterView[] = [], corpses: CorpseView[] = [];
let failedPaths = new Set<string>();
const grip = gripPoints(WeaponType.MACHINE_GUN, 0.23);
const frame = (state: FighterState = 'idle', extra: Partial<FighterFrame> = {}): FighterFrame => ({
    pose: solvePose({ state, body: 'human', aim: 0, t: 0, phase: 0, moveDir: 1, recoil: 0, grip }),
    look: { head: 0xffffff, torso: 0xffffff, arm: 0xffffff, leg: 0xffffff, jet: 0xffffff, visor: 0xffffff, pattern: 0xffffff,
        build: { ...DEFAULT_BUILD, body: 'human', helmet: 'none', visor: 'none' } },
    grip, facing: 1, weaponType: WeaponType.MACHINE_GUN, flame: false, flicker: 0, parts: IDLE_PARTS, muzzleFlash: 0, ...extra,
});
const live = () => { const view = createFighterView(); views.push(view); return view; };

beforeEach(() => {
    resetBodyTextures(); failedPaths = new Set();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Assets, 'load').mockImplementation(async url => {
        if ([...failedPaths].some(path => String(url).endsWith(path))) throw new Error('Pilot picture unavailable');
        const texture = new Texture({ source: Texture.WHITE.source }); allocated.push(texture);
        return texture as unknown as Record<string, unknown>;
    });
});
afterEach(() => {
    for (const view of views.splice(0)) view.root.destroy({ children: true, context: true });
    for (const corpse of corpses.splice(0)) destroyCorpseView(corpse);
    resetBodyTextures(); vi.restoreAllMocks();
    for (const texture of allocated.splice(0)) if (!texture.destroyed) texture.destroy();
});

describe('Human pose and expression selection', () => {
    it('keeps normal/missing pictures and the other four bodies on their existing definitions', async () => {
        const base = RUNTIME_BODY_ART.human;
        expect(selectHumanArt(base, 'crouch', 'hurt')).toBe(base);
        await loadBodyTextures();
        expect(selectHumanArt(base, 'run', 'normal')).toBe(base);
        for (const body of ['human-female', 'robot', 'toxic', 'cat'] as const) {
            expect(selectHumanArt(RUNTIME_BODY_ART[body], 'prone', 'dead')).toBe(RUNTIME_BODY_ART[body]);
        }
    });

    it('merges distinct near/far pose parts and a pain face while retaining source anatomy', async () => {
        await loadBodyTextures();
        const base = RUNTIME_BODY_ART.human, before = structuredClone(base);
        const selected = selectHumanArt(base, 'crouch', 'hurt');
        expect(selected).not.toBe(base);
        expect(selected.parts.upperArmFront).toBe(pilot.front);
        expect(selected.parts.upperArmBack).toBe(pilot.back);
        expect(selected.parts.head).toBe(pilot.hurt);
        expect(selected.parts.footFront).toBe(base.parts.footFront);
        expect(selected.anatomy).toBe(base.anatomy);
        expect(base).toEqual(before);
        for (let index = 0; index < 100; index++) expect(selectHumanArt(base, 'crouch', 'hurt')).toBe(selected);
        expect(selectHumanArt(base, 'prone', 'dead').parts.head).toBe(pilot.dead);
        expect(selectHumanArt(BODY_ART.human, 'crouch').anatomy).toBe(BODY_ART.human);
    });

    it('waits for the complete pose picture set and upgrades after only the failed picture retries', async () => {
        failedPaths.add('/pilot-crouch-far.png');
        await loadBodyTextures();
        const base = RUNTIME_BODY_ART.human;
        expect(selectHumanArt(base, 'crouch')).toBe(base);
        const hurt = selectHumanArt(base, 'crouch', 'hurt');
        expect(hurt.parts.upperArmFront).toBe(base.parts.upperArmFront);
        expect(hurt.parts.head).toBe(pilot.hurt);
        failedPaths.clear(); await loadBodyTextures();
        const ready = selectHumanArt(base, 'crouch', 'hurt');
        expect(ready.parts.upperArmFront).toBe(pilot.front);
        expect(ready.parts.upperArmBack).toBe(pilot.back);
        expect(ready).not.toBe(hurt);
        bodyPictureTexture('/pilot-crouch-far.png')!.destroy();
        expect(selectHumanArt(base, 'crouch', 'hurt')).toBe(hurt);
    });
});

describe('Human fighter art transitions', () => {
    it('reuses a selected rig every frame and frees its meshes only at a pose/expression transition', async () => {
        await loadBodyTextures(); const view = live();
        expect(syncFighterArt(view, frame('crouch'))).toBe(true);
        const rig = view.illustrated!, arm = rig.meshes.upperArmFront!, buffers = [...arm.geometry.buffers];
        expect(arm.texture).toBe(bodyPictureTexture('/pilot-crouch.png'));
        for (let index = 0; index < 100; index++) {
            expect(syncFighterArt(view, frame('crouch'))).toBe(true);
            expect(view.illustrated).toBe(rig);
        }
        expect(syncFighterArt(view, frame('prone', { expression: 'hurt' }))).toBe(true);
        expect(arm.destroyed).toBe(true); expect(buffers.every(buffer => buffer.destroyed)).toBe(true);
        expect(view.illustrated!.meshes.head!.texture).toBe(bodyPictureTexture('/pilot-faces.png'));
        expect(view.illustrated!.definition.parts.head).toBe(pilot.hurt);
    });

    it('uses the dead Human face for intact weaponless corpses instead of the living head', async () => {
        await loadBodyTextures();
        const corpse = createCorpseView(createCorpse({ x: 100, y: 500, kind: 'fall', facing: 1,
            parts: { head: '#ffffff', torso: '#ffffff', arm: '#ffffff', leg: '#ffffff', build: frame().look.build } }), {});
        corpses.push(corpse);
        expect(corpse.fighter!.illustrated!.definition.parts.head).toBe(pilot.dead);
        expect(corpse.fighter!.illustrated!.meshes.head!.texture).toBe(bodyPictureTexture('/pilot-faces.png'));
        const view = live();
        expect(syncFighterArt(view, frame('idle', { oneLeg: true }))).toBe(true);
        expect(view.illustrated!.definition.parts.head).toBe(pilot.hurt);
        expect(syncFighterArt(view, frame('idle', { expression: 'hurt', weaponless: true }))).toBe(true);
        expect(view.illustrated!.definition.parts.head).toBe(pilot.dead);
    });

    it('keeps a painted living stump attached across poses and frees it on a body change', async () => {
        await loadBodyTextures(); const view = live();
        syncFighterArt(view, frame('crouch', { oneLeg: true }));
        expect(view.humanWounds).toBeDefined();
        const wounds = view.humanWounds!, cap = wounds.meshes.hipBack!, buffers = [...cap.geometry.buffers];
        expect(cap.visible).toBe(true); expect(cap.tint).toBe(0xffffff);
        expect(cap.texture).toBe(bodyPictureTexture('/pilot-faces.png'));
        const firstY = cap.position.y;
        syncFighterArt(view, frame('prone', { oneLeg: true }));
        expect(view.humanWounds).toBe(wounds); expect(cap.position.y).not.toBe(firstY);
        const robot = frame(); robot.look = { ...robot.look, build: { ...robot.look.build, body: 'robot' } };
        syncFighterArt(view, robot);
        expect(view.humanWounds).toBeUndefined(); expect(cap.destroyed).toBe(true);
        expect(buffers.every(buffer => buffer.destroyed)).toBe(true);
        expect(bodyPictureTexture('/pilot-faces.png')!.destroyed).toBe(false);
    });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Assets, Texture } from 'pixi.js';
import { WeaponType } from '../../../types';
import { BODY_PALETTES } from '../../build/characterBases';
import { DEFAULT_BUILD } from '../../build/buildParts';
import { createCorpse } from '../../systems/ragdoll/corpseBody';
import { createFighterView, type FighterFrame, type FighterView } from '../fighter/fighterView';
import { solvePose } from '../fighter/fighterPose';
import { gripPoints } from '../fighter/weaponGrips';
import { IDLE_PARTS } from '../fighter/parts/partMotionFrame';
import type { FighterLook } from '../fighter/fighterLook';
import { RUNTIME_BODY_ART } from './runtimeDefinitions';
import { createArtRig, destroyArtRig, updateArtRig, type ArtRig } from './rigView';
import { liveRigTargets } from './rigTargets';
import { corpseRigTargets } from './corpseTargets';
import { loadBodyTextures, resetBodyTextures } from './textures';
import { syncFighterArt } from './fighterArt';

vi.mock('../effects/glowTextures', () => ({ glowTexture: () => Texture.WHITE, stripTexture: () => Texture.WHITE }));

const grip = gripPoints(WeaponType.MACHINE_GUN, 0.23);
const pose = solvePose({ state: 'idle', body: 'robot', aim: 0.2, t: 0, phase: 0, moveDir: 1, recoil: 0, grip });
const cream = BODY_PALETTES.robot.arm;
const look = (arm = cream): FighterLook => ({ head: cream, torso: cream, arm, leg: cream, jet: 0xffffff, visor: 0xffffff,
    pattern: 0xffffff, build: { ...DEFAULT_BUILD, body: 'robot', helmet: 'none', visor: 'none' } });
const rigs: ArtRig[] = [], views: FighterView[] = [];
const robotRig = () => { const rig = createArtRig(RUNTIME_BODY_ART.robot, Texture.WHITE, Texture.WHITE); rigs.push(rig); return rig; };

beforeEach(() => { resetBodyTextures(); });
afterEach(() => {
    vi.restoreAllMocks();
    for (const rig of rigs.splice(0)) destroyArtRig(rig);
    for (const view of views.splice(0)) view.root.destroy({ children: true });
    resetBodyTextures();
});

describe('3D-kit paint layer', () => {
    it('draws a tinted paint mesh under each painted part and never tints the fixed picture', () => {
        const rig = robotRig();
        updateArtRig(rig, liveRigTargets(rig.definition, pose, IDLE_PARTS), look());
        const paint = rig.paint.forearmFront!, fixed = rig.meshes.forearmFront!;
        expect(paint.parent).toBe(fixed.parent);
        expect(paint.parent!.getChildIndex(paint)).toBeLessThan(fixed.parent!.getChildIndex(fixed));
        expect(paint.tint).toBe(cream); // tinted even at the palette default: the paint pixels are neutral
        expect(fixed.tint).toBe(0xffffff);
        expect(paint.position.x).toBe(fixed.position.x);
        expect(paint.rotation).toBe(fixed.rotation);
        updateArtRig(rig, liveRigTargets(rig.definition, pose, IDLE_PARTS), look(0x3b82f6));
        expect(paint.tint).toBe(0x3b82f6);
        expect(fixed.tint).toBe(0xffffff);
    });

    it('hides a part\'s paint together with the part (a helmet hides the painted head)', () => {
        const rig = robotRig(), targets = liveRigTargets(rig.definition, pose, IDLE_PARTS);
        updateArtRig(rig, targets, look());
        expect(rig.paint.head!.visible).toBe(true);
        updateArtRig(rig, targets, look(), true);
        expect(rig.meshes.head!.visible).toBe(false);
        expect(rig.paint.head!.visible).toBe(false);
    });

    it('creates no paint mesh for a part without paint pixels', () => {
        expect(robotRig().paint.thighFront).toBeUndefined();
    });
});

describe('3D-kit hands', () => {
    it('grips the weapon while armed: palms under the weapon, fingers over it, no open hands', () => {
        const rig = robotRig(), targets = liveRigTargets(rig.definition, pose, IDLE_PARTS);
        updateArtRig(rig, targets, look());
        expect(rig.meshes.palmFront!.visible && rig.meshes.handFrontGrip!.visible).toBe(true);
        expect(rig.meshes.palmBack!.visible && rig.meshes.handBackGrip!.visible).toBe(true);
        expect(rig.meshes.handFront!.visible || rig.meshes.handBack!.visible).toBe(false);
        expect(rig.meshes.palmFront!.parent).toBe(rig.under);
        expect(rig.meshes.handFrontGrip!.parent).toBe(rig.front);
        expect(targets.handFrontGrip).toEqual({ start: pose.frontArm.end, rotation: pose.gunAngle });
        expect(targets.palmBack).toEqual({ start: pose.backArm.end, rotation: pose.gunAngle });
    });

    it('opens empty hands and keeps every hand pose out of corpses', () => {
        const rig = robotRig();
        updateArtRig(rig, liveRigTargets(rig.definition, pose, IDLE_PARTS, false, 0, true), look());
        expect(rig.meshes.handFront!.visible && rig.meshes.handBack!.visible).toBe(true);
        expect(rig.meshes.palmFront!.visible || rig.meshes.handFrontGrip!.visible).toBe(false);
        const corpse = createCorpse({ x: 0, y: 0, facing: 1, kind: 'fall',
            parts: { head: '#fff', torso: '#fff', arm: '#fff', leg: '#fff', build: { ...DEFAULT_BUILD, body: 'robot' } } });
        const keys = Object.keys(corpseRigTargets(RUNTIME_BODY_ART.robot, corpse));
        expect(keys.filter(key => key.startsWith('palm') || key.endsWith('Grip'))).toEqual([]);
    });

    it('slots the palms just under the weapon picture in a live fighter, facing either way, even with no weapon picture', async () => {
        vi.spyOn(Assets, 'load').mockImplementation(async () => new Texture({ source: Texture.WHITE.source }) as never);
        await loadBodyTextures();
        for (const facing of [1, -1] as const) {
            const view = createFighterView(); views.push(view);
            const frame: FighterFrame = { pose, look: look(), grip, facing, weaponType: WeaponType.MACHINE_GUN, weapon: undefined,
                flame: false, flicker: 0, parts: IDLE_PARTS, muzzleFlash: 0 };
            expect(syncFighterArt(view, frame)).toBe(true);
            const rig = view.illustrated!;
            expect(view.root.getChildIndex(rig.under)).toBe(view.root.getChildIndex(view.weapon) - 1);
            expect(rig.meshes.handFrontGrip!.visible).toBe(true);
        }
    });
});

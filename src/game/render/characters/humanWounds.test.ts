import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Assets, Texture } from 'pixi.js';
import { DEFAULT_BUILD } from '../../build/buildParts';
import { createCorpse } from '../../systems/ragdoll/corpseBody';
import { RIG_SCALE, solvePose } from '../fighter/fighterPose';
import { WeaponType } from '../../../types';
import { gripPoints } from '../fighter/weaponGrips';
import { createCorpseView, destroyCorpseView, updateCorpseView, type CorpseView } from '../ragdoll/corpseView';
import { corpseRigTargets } from './corpseTargets';
import { bodyPictureTexture, loadBodyTextures, resetBodyTextures } from './textures';
import { createHumanWounds, destroyHumanWounds, humanLiveWoundTargets, updateHumanWounds } from './humanWounds';
import { RUNTIME_BODY_ART } from './runtimeDefinitions';
import { paintedBottom } from './paintedSurfaceTestKit';

const pilot = vi.hoisted(() => {
    const image = { imagePath: '/pilot-human-damage.png', size: [128, 128] as const };
    const part = (x: number, channel: 'head' | 'none' = 'none') => ({ image, channel, pixelScale: 0.1,
        origin: [x + 8, 8] as const, polygon: [[x, 0], [x + 16, 0], [x + 16, 16], [x, 16]] as const });
    return { image, dead: part(0, 'head'), arm: part(16), leg: part(32), neck: part(48), waist: part(64) };
});
vi.mock('./data/humanPoseVariants', () => ({ HUMAN_PICTURES: [pilot.image], HUMAN_POSE_PARTS: {},
    HUMAN_EXPRESSIONS: { dead: pilot.dead }, HUMAN_WOUNDS: { arm: pilot.arm, leg: pilot.leg, neck: pilot.neck, waist: pilot.waist } }));
vi.mock('../effects/glowTextures', () => ({ glowTexture: () => Texture.WHITE, stripTexture: () => Texture.WHITE }));

const views: CorpseView[] = [], textures: Texture[] = [];
let missing = false;
beforeEach(async () => {
    missing = false; resetBodyTextures();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Assets, 'load').mockImplementation(async url => {
        if (missing && String(url).includes('pilot-human-damage')) throw new Error('Damage picture unavailable');
        const texture = new Texture({ source: Texture.WHITE.source }); textures.push(texture);
        return texture as unknown as Record<string, unknown>;
    });
    await loadBodyTextures();
});
afterEach(() => {
    for (const view of views.splice(0)) destroyCorpseView(view);
    resetBodyTextures(); vi.restoreAllMocks();
    for (const texture of textures.splice(0)) if (!texture.destroyed) texture.destroy();
});
const make = (kind: 'gib' | 'cut' = 'gib', body: 'human' | 'robot' = 'human', facing: 1 | -1 = 1) => createCorpse({ x: 100, y: 500, kind, facing,
    parts: { head: '#123456', torso: '#345678', arm: '#56789a', leg: '#789abc',
        build: { ...DEFAULT_BUILD, body, helmet: 'none', visor: 'none', ears: 'none', tail: 'none' } } });
const viewOf = (c: ReturnType<typeof make>) => { const view = createCorpseView(c, {}); views.push(view); return view; };

describe('Human painted severed ends', () => {
    it.each(['gib', 'cut'] as const)('uses dead face pixels for a %s Human', kind => {
        const art = viewOf(make(kind)).illustrated!;
        expect(art.rig.definition.parts.head).toBe(pilot.dead);
        expect(art.rig.meshes.head!.texture).toBe(bodyPictureTexture(pilot.image.imagePath));
    });

    it('places detached arm and leg caps on their actual free joint ends, with their bone rotation', () => {
        const c = make(), art = viewOf(c).illustrated!;
        c.points.shF.x += 50; c.points.elF.x += 50; c.points.haF.x += 50;
        c.points.knF.x += 70; c.points.anF.x += 70;
        updateCorpseView(views[0], c);
        const targets = corpseRigTargets(art.rig.definition, c);
        for (const [cap, part] of [['armFront', 'upperArmFront'], ['legFront', 'thighFront']] as const) {
            const mesh = art.wounds!.meshes[cap]!, target = targets[part]!;
            expect(mesh.position.x).toBeCloseTo(target.start.x); expect(mesh.position.y).toBeCloseTo(target.start.y);
            expect(mesh.rotation).toBeCloseTo(Math.atan2(target.end!.y - target.start.y, target.end!.x - target.start.x) - Math.PI / 2);
            expect(mesh.tint).toBe(0xffffff);
        }
    });

    it.each([1, -1] as const)('keeps painted cuts on their world-space free ends when facing %s', facing => {
        const c = make('gib', 'human', facing), art = viewOf(c).illustrated!;
        const arm = art.wounds!.meshes.armFront!, leg = art.wounds!.meshes.legFront!;
        expect(art.root.position.x + arm.position.x * art.root.scale.x).toBeCloseTo(c.points.shF.x);
        expect(art.root.position.y + arm.position.y * art.root.scale.y).toBeCloseTo(c.points.shF.y);
        const knee = c.points.knF, ankle = c.points.anF, length = Math.hypot(ankle.x - knee.x, ankle.y - knee.y);
        expect(art.root.position.x + leg.position.x * art.root.scale.x).toBeCloseTo(knee.x - (ankle.x - knee.x) / length * 14.5 * RIG_SCALE);
        expect(art.root.position.y + leg.position.y * art.root.scale.y).toBeCloseTo(knee.y - (ankle.y - knee.y) / length * 14.5 * RIG_SCALE);
    });

    it('rolls the head neck cap with the detached dead head instead of its former torso', () => {
        const c = make(), view = viewOf(c), art = view.illustrated!, cap = art.wounds!.meshes.headNeck!;
        const previous = cap.rotation, position = cap.position.clone();
        c.points.head.x += 12; updateCorpseView(view, c);
        expect(cap.rotation).toBeGreaterThan(previous);
        expect(cap.rotation - art.rig.meshes.head!.rotation).toBeCloseTo(Math.PI);
        expect(Math.hypot(cap.position.x - position.x, cap.position.y - position.y)).toBeGreaterThan(1);
        const anatomy = art.rig.definition.anatomy!, head = anatomy.parts.head!, mesh = art.rig.meshes.head!;
        const offset = Math.hypot(anatomy.neck[0] - head.origin[0], anatomy.neck[1] - head.origin[1]) * 19
            / Math.hypot(anatomy.neck[0] - anatomy.hip[0], anatomy.neck[1] - anatomy.hip[1]);
        expect(Math.hypot(cap.position.x - mesh.position.x, cap.position.y - mesh.position.y)).toBeCloseTo(offset);
    });

    it('shows both sides of every severed joint on a complete Human gib', () => {
        const art = viewOf(make()).illustrated!;
        expect(Object.entries(art.wounds!.meshes).filter(([, mesh]) => mesh!.visible).map(([id]) => id).sort()).toEqual([
            'armBack', 'armFront', 'headNeck', 'hipBack', 'hipFront', 'legBack', 'legFront', 'shoulderBack', 'shoulderFront', 'torsoNeck',
        ]);
    });

    it('shows only the detached leg cap on an isolated limb', () => {
        const c = make(); c.only = 'leg-back';
        const art = viewOf(c).illustrated!;
        expect(Object.entries(art.wounds!.meshes).filter(([, mesh]) => mesh!.visible).map(([id]) => id)).toEqual(['legBack']);
    });

    it.each([1, -1] as const)('binds waist caps to actual painted edges on independent frames facing %s', facing => {
        const c = make('cut', 'human', facing), view = viewOf(c), art = view.illustrated!;
        c.points.neck.x += 180; c.points.head.x += 180; updateCorpseView(view, c);
        const targets = corpseRigTargets(art.rig.definition, c);
        const visible = Object.entries(art.wounds!.meshes).filter(([, mesh]) => mesh!.visible).map(([id]) => id).sort();
        expect(visible).toEqual(['waistLower', 'waistUpper']);
        const neutral = { start: { x: 0, y: 0 }, end: { x: 0, y: -19 } };
        const upperEdge = paintedBottom(RUNTIME_BODY_ART.human, 'torso', neutral);
        const lowerEdge = -paintedBottom(RUNTIME_BODY_ART.human, 'pelvis', { ...neutral, end: { x: 0, y: 19 } });
        for (const [cap, part] of [['waistUpper', 'torso'], ['waistLower', 'pelvis']] as const) {
            const mesh = art.wounds!.meshes[cap]!, target = targets[part]!;
            const dx = target.end!.x - target.start.x, dy = target.end!.y - target.start.y, length = Math.hypot(dx, dy);
            const mx = mesh.position.x - target.start.x, my = mesh.position.y - target.start.y;
            const capHeight = (mx * dx + my * dy) / length;
            expect(Math.abs(capHeight + (part === 'torso' ? upperEdge : lowerEdge))).toBeLessThanOrEqual(1);
            expect((mx * dy - my * dx) / length).toBeCloseTo(0);
        }
        expect(Math.abs(art.wounds!.meshes.waistUpper!.position.x - art.wounds!.meshes.waistLower!.position.x)).toBeGreaterThan(100);
    });

    it('keeps the missing-leg body wound distinct from an absent detached leg', () => {
        const c = make(); c.oneLeg = true;
        const art = viewOf(c).illustrated!;
        expect(art.wounds!.meshes.hipBack!.visible).toBe(true);
        expect(art.wounds!.meshes.legBack!.visible).toBe(false);
    });

    it('keeps blood geometry and shared textures while moving and disposes only its own meshes', () => {
        const c = make(), view = viewOf(c), cap = view.illustrated!.wounds!.meshes.legFront!;
        const geometry = cap.geometry, buffers = [...geometry.buffers], picture = cap.texture;
        c.points.anF.x += RIG_SCALE; updateCorpseView(view, c);
        expect(view.illustrated!.wounds!.meshes.legFront!.geometry).toBe(geometry);
        destroyCorpseView(view);
        expect(buffers.every(buffer => buffer.destroyed)).toBe(true);
        expect(picture.destroyed).toBe(false);
    });

    it('keeps non-Human bodies unchanged and missing damage pictures on the normal corpse fallback', async () => {
        expect(viewOf(make('gib', 'robot')).illustrated!.wounds).toBeUndefined();
        missing = true; resetBodyTextures(); await loadBodyTextures();
        const art = viewOf(make()).illustrated!;
        expect(art.rig.definition.parts.head).not.toBe(pilot.dead);
        expect(art.wounds).toBeUndefined();
    });

    it('lets the living one-leg renderer use the painted body stump and preserves its palette', () => {
        const definition = RUNTIME_BODY_ART.human;
        const wounds = createHumanWounds(definition, bodyPictureTexture, ['hipBack'])!;
        const pose = solvePose({ body: 'human', state: 'crouch', aim: 0, t: 0, phase: 0, moveDir: 1, recoil: 0,
            grip: gripPoints(WeaponType.MACHINE_GUN, 0.23) });
        updateHumanWounds(wounds, humanLiveWoundTargets(definition, pose, true));
        expect(wounds.meshes.hipBack!.visible).toBe(true);
        expect(wounds.meshes.hipBack!.tint).toBe(0xffffff);
        updateHumanWounds(wounds, humanLiveWoundTargets(definition, pose, false));
        expect(wounds.meshes.hipBack!.visible).toBe(false);
        destroyHumanWounds(wounds);
        expect(bodyPictureTexture(pilot.image.imagePath)!.destroyed).toBe(false);
    });
});

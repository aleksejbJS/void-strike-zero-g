import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Assets, Texture } from 'pixi.js';
import { BODY_IDS } from '../../build/bodyTypes';
import { DEFAULT_BUILD, JETPACKS } from '../../build/buildParts';
import { createCorpse } from '../../systems/ragdoll/corpseBody';
import { createCorpseView, destroyCorpseView, updateCorpseView } from '../ragdoll/corpseView';
import { heldWeaponKey } from '../fighter/fighterAnimator';
import { WeaponType } from '../../../types';
import { loadBodyTextures, resetBodyTextures } from './textures';

vi.mock('../effects/glowTextures', () => ({ glowTexture: () => Texture.WHITE, stripTexture: () => Texture.WHITE }));

beforeEach(async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    resetBodyTextures();
    // Pixi's last overload describes a bundle, while our loader requests one texture.
    vi.spyOn(Assets, 'load').mockResolvedValue(Texture.WHITE as unknown as Record<string, unknown>);
    await loadBodyTextures();
});
afterEach(() => { vi.restoreAllMocks(); resetBodyTextures(); });

const make = (body = 'human' as typeof BODY_IDS[number], kind: 'gib' | 'cut' | 'fall' = 'gib', facing: 1 | -1 = 1) => createCorpse({
    x: 100, y: 500, kind, facing, weapon: WeaponType.MACHINE_GUN,
    parts: { head: '#112233', torso: '#445566', arm: '#778899', leg: '#aabbcc',
        build: { ...DEFAULT_BUILD, body, helmet: 'none', visor: 'none', ears: 'none', tail: 'none' } },
});

describe('illustrated corpse rendering', () => {
    it.each(BODY_IDS)('keeps %s artwork on every detached anatomy part', body => {
        const c = make(body), v = createCorpseView(c, {});
        expect(v.illustrated?.rig.definition.id).toBe(body);
        expect(v.pieces).toBeUndefined();
        for (const mesh of Object.values(v.illustrated!.rig.meshes)) {
            expect(mesh!.texture).toBe(Texture.WHITE);
            expect(mesh!.visible).toBe(true);
        }
        const rig = v.illustrated!.rig;
        if (body === 'human') {
            // Custom skin tint remains active while the head filter preserves crimson blood.
            expect(rig.meshes.head!.tint).toBe(0xffffff);
            expect(rig.bloodTint?.headTint).toBe(0x112233);
            const tint = rig.bloodTint!.resources.headTintUniforms.uniforms.uHeadTint;
            expect(tint[0]).toBeCloseTo(17 / 255); expect(tint[1]).toBeCloseTo(34 / 255); expect(tint[2]).toBeCloseTo(51 / 255);
        } else expect(rig.meshes.head!.tint).toBe(0x112233);
        destroyCorpseView(v);
    });

    it('uses exactly three meshes for an isolated leg and none of the head equipment', () => {
        const c = make('cat'); c.only = 'leg-back';
        const v = createCorpseView(c, {});
        const visible = Object.entries(v.illustrated!.rig.meshes).filter(([, mesh]) => mesh!.visible).map(([id]) => id).sort();
        expect(visible).toEqual(['footBack', 'shinBack', 'thighBack']);
        expect(v.illustrated!.rig.overlay.visible).toBe(false);
        destroyCorpseView(v);
    });

    it('rolls its detached illustrated head with travel and retains the roll while still', () => {
        const c = make('robot'); c.facing = -1;
        const v = createCorpseView(c, {}), head = v.illustrated!.rig.meshes.head!;
        const initial = head.rotation;
        c.points.head.x += 10;
        updateCorpseView(v, c);
        const rolled = head.rotation;
        expect(rolled).toBeLessThan(initial);
        updateCorpseView(v, c);
        expect(head.rotation).toBe(rolled);
        destroyCorpseView(v);
    });

    it('preserves selected head equipment on a cut half', () => {
        const c = make('human-female', 'cut');
        c.colors!.build = { ...c.colors!.build!, helmet: 'angular', visor: 'slit', ears: 'cat' };
        const v = createCorpseView(c, {});
        expect(v.illustrated!.rig.meshes.head!.visible).toBe(false);
        expect(v.illustrated!.rig.overlay.context.instructions.length).toBeGreaterThan(0);
        expect(v.illustrated!.rig.overlay.visible).toBe(true);
        destroyCorpseView(v);
    });

    it('keeps gun placement, fade and shared source texture through corpse disposal', () => {
        const c = make('toxic'), gun = new Texture({ source: Texture.WHITE.source });
        const v = createCorpseView(c, { [heldWeaponKey(WeaponType.MACHINE_GUN)]: gun });
        const mesh = v.illustrated!.rig.meshes.head!, buffers = [...mesh.geometry.buffers];
        c.age = (c.fadeAt + c.removeAt) / 2; updateCorpseView(v, c);
        expect(v.root.alpha).toBeCloseTo(0.5);
        expect(v.gun.texture).toBe(gun); expect(v.gun.visible).toBe(true);
        expect(v.gun.position.x).toBe(c.points.gunA.x);
        destroyCorpseView(v);
        expect(mesh.destroyed).toBe(true);
        expect(buffers.every(buffer => buffer.destroyed)).toBe(true);
        expect(Texture.WHITE.destroyed).toBe(false); expect(gun.destroyed).toBe(false);
    });

    it('lets whole falls use the existing illustrated fighter path', () => {
        const v = createCorpseView(make('cat', 'fall'), {});
        expect(v.illustrated).toBeUndefined();
        expect(v.fighter!.illustrated?.definition.id).toBe('cat');
        destroyCorpseView(v);
    });

    it('reuses meshes without redrawing a still corpse, then follows moving joints', () => {
        const c = make('cat', 'cut'), v = createCorpseView(c, {});
        const rig = v.illustrated!.rig, head = rig.meshes.head!, initial = head.position.x;
        rig.overlay.rect(0, 0, 1, 1).fill(0xffffff);
        const marked = rig.overlay.context.instructions.length;
        updateCorpseView(v, c);
        expect(rig.overlay.context.instructions.length).toBe(marked);
        c.points.head.x += 10;
        updateCorpseView(v, c);
        expect(head.position.x).toBeGreaterThan(initial);
        expect(v.illustrated!.rig.meshes.head).toBe(head);
        expect(rig.overlay.context.instructions.length).toBe(marked - 1);
        destroyCorpseView(v);
    });

    it('falls back to the existing drawing when a body picture is unavailable', () => {
        resetBodyTextures();
        const v = createCorpseView(make('human'), {});
        expect(v.illustrated).toBeUndefined(); expect(v.pieces).toHaveLength(6);
        destroyCorpseView(v);
    });

    it('keeps selected torso paint, badge and tail attached to the correct severed half', () => {
        const c = make('human', 'cut');
        c.colors!.build = { ...c.colors!.build!, pattern: 'stripes', badge: 'number', badgeNumber: 42, tail: 'mech' };
        const v = createCorpseView(c, {}), art = v.illustrated!;
        expect(art.upperPaint.context.instructions.length).toBeGreaterThan(0);
        expect(art.lowerPaint.context.instructions.length).toBeGreaterThan(0);
        expect(art.badge.context.instructions.length).toBeGreaterThan(0);
        expect(art.tail.context.instructions.length).toBeGreaterThan(0);
        const lowerBefore = art.lowerPaint.position.clone(), tailBefore = art.tail.position.clone();
        const upperBefore = art.upperPaint.position.clone(), badgeBefore = art.badge.position.clone();
        c.points.neck.x += 100; c.points.head.x += 100;
        updateCorpseView(v, c);
        expect(art.lowerPaint.position).toMatchObject(lowerBefore);
        expect(art.tail.position).toMatchObject(tailBefore);
        expect(art.upperPaint.position.x).toBeGreaterThan(upperBefore.x + 80);
        expect(art.badge.position.x).toBeGreaterThan(badgeBefore.x + 80);
        expect(art.upperPaint.mask).toBeTruthy(); expect(art.lowerPaint.mask).toBeTruthy();
        destroyCorpseView(v);
    });

    it('draws no selected torso decorations on an isolated limb', () => {
        const c = make('cat'); c.only = 'leg-back';
        c.colors!.build = { ...c.colors!.build!, pattern: 'hazard', badge: 'chevron', tail: 'cat' };
        const v = createCorpseView(c, {}), art = v.illustrated!;
        for (const layer of [art.upperPaint, art.lowerPaint, art.badge, art.tail, art.jetpack]) expect(layer.visible).toBe(false);
        destroyCorpseView(v);
    });

    it.each(JETPACKS)('retains the selected %s jetpack behind torn torso art', jetpack => {
        const c = make('robot'); c.colors!.jet = '#123456';
        c.colors!.build = { ...c.colors!.build!, jetpack };
        const v = createCorpseView(c, {}), art = v.illustrated!;
        expect(art.jetpack.visible).toBe(true);
        const instructions = art.jetpack.context.instructions as { data: { style?: { color?: number } } }[];
        expect(instructions.some(instruction => instruction.data.style?.color === 0x123456)).toBe(true);
        expect(art.root.getChildIndex(art.jetpack)).toBeLessThan(art.root.getChildIndex(art.rig.body));
        destroyCorpseView(v);
    });

    it('rotates the jetpack with the cut upper half in both facing directions', () => {
        for (const facing of [1, -1] as const) {
            const c = make('human', 'cut', facing), v = createCorpseView(c, {}), pack = v.illustrated!.jetpack;
            const before = pack.rotation, pivot = { ...c.points.neck };
            for (const id of ['neck', 'head', 'shF', 'elF', 'haF', 'shB', 'elB', 'haB'] as const) {
                const point = c.points[id], dx = point.x - pivot.x, dy = point.y - pivot.y;
                point.x = pivot.x + 60 - dy; point.y = pivot.y + dx;
            }
            updateCorpseView(v, c);
            const delta = pack.rotation - before;
            expect(Math.atan2(Math.sin(delta), Math.cos(delta))).toBeCloseTo(facing * Math.PI / 2);
            expect(pack.getLocalBounds().maxX).toBeLessThan(0);
            expect(pack.getLocalBounds().minY).toBeLessThan(-15);
            destroyCorpseView(v);
        }
    });
});

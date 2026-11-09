import { describe, expect, it, vi } from 'vitest';
import { Container, Texture } from 'pixi.js';
import { WeaponType } from '../../../types';
import type { DeathEvent } from '../../systems/events';
import { Corpse, createCorpse } from '../../systems/ragdoll/corpseBody';
import { DEFAULT_BUILD } from '../../build/buildParts';
import { FighterLook } from '../fighter/fighterLook';
import { solvePose } from '../fighter/fighterPose';
import { gripPoints } from '../fighter/weaponGrips';
import { IDLE_PARTS } from '../fighter/parts/partMotionFrame';
import { createFighterView, drawFighter, FighterView } from '../fighter/fighterView';
import { heldWeaponKey } from '../fighter/fighterAnimator';
import { TANK_COLOR } from '../fighter/fuelTankBack';
import { createCorpseView, CorpseView, destroyCorpseView, syncCorpseViews, updateCorpseView } from './corpseView';

// jsdom has no 2D canvas to bake the glow texture; nothing here depends on it
vi.mock('../effects/glowTextures', () => ({ glowTexture: () => Texture.WHITE, stripTexture: () => Texture.WHITE }));

const death = (extra: Partial<DeathEvent> = {}): DeathEvent => ({
    type: 'DEATH', x: 100, y: 500, color: '#fff', height: 72, vel: { x: 0, y: 0 }, facing: 1,
    weapon: WeaponType.MACHINE_GUN,
    parts: { head: '#aa3322', torso: '#3366aa', arm: '#22aa66', leg: '#475569', build: DEFAULT_BUILD },
    ...extra,
});

const grip = gripPoints(WeaponType.MACHINE_GUN, 55 / 240);
const look: FighterLook = {
    head: 0x9ca3af, torso: 0x334455, arm: 0x556677, leg: 0x475569, jet: 0xfbbf24,
    visor: 0x38bdf8, pattern: 0xe5e7eb, build: DEFAULT_BUILD,
};

/** The front layer of an idle fighter drawn without a weapon picture; `weaponless` hides any weapon. */
const frontWithoutPicture = (weaponless: boolean) => {
    const view = createFighterView();
    drawFighter(view, {
        pose: solvePose({ state: 'idle', aim: 0, t: 0, phase: 0, moveDir: 1, recoil: 0, grip }),
        look, facing: 1, grip, weaponType: WeaponType.MACHINE_GUN, flame: false, flicker: 0, parts: IDLE_PARTS,
        muzzleFlash: 0, weaponless,
    });
    const count = view.front.context.instructions.length;
    return { view, count };
};

const destroyAll = (...views: FighterView[]) => views.forEach(v => v.root.destroy({ children: true, context: true }));

describe('drawFighter weaponless', () => {
    it('weaponless frame shows no weapon', () => {
        const armed = frontWithoutPicture(false);
        const bare = frontWithoutPicture(true);
        // The fallback gun is one polygon (poly + fill = one fill instruction) drawn before the hands
        expect(bare.count).toBe(armed.count - 1);
        expect(bare.view.weapon.visible).toBe(false);

        const withPicture = createFighterView();
        drawFighter(withPicture, {
            pose: solvePose({ state: 'idle', aim: 0, t: 0, phase: 0, moveDir: 1, recoil: 0, grip }),
            look, facing: 1, grip, weapon: Texture.WHITE, weaponType: WeaponType.MACHINE_GUN, flame: false, flicker: 0,
            parts: IDLE_PARTS, muzzleFlash: 0, weaponless: true,
        });
        expect(withPicture.weapon.visible).toBe(false);
        destroyAll(armed.view, bare.view, withPicture);
    });
});

const viewOf = (kind: DeathEvent['kind'], textures: Record<string, Texture | undefined> = {}) => {
    const c = createCorpse(death({ kind }));
    return { c, v: createCorpseView(c, textures) };
};

describe('corpse views', () => {
    it('gib draws six pieces, cut draws two', () => {
        const gib = viewOf('gib');
        const cut = viewOf('cut');
        expect(gib.v.pieces).toHaveLength(6);
        expect(gib.v.fighter).toBeUndefined();
        expect(cut.v.pieces).toHaveLength(2);
        expect(cut.v.fighter).toBeUndefined();
        for (const g of [...gib.v.pieces!, ...cut.v.pieces!]) expect(g.context.instructions.length).toBeGreaterThan(0);
        destroyCorpseView(gib.v);
        destroyCorpseView(cut.v);
    });

    it('a whole body is one fighter at the hip, without its weapon in the hands', () => {
        for (const kind of ['fall', 'thrown'] as const) {
            const { c, v } = viewOf(kind);
            expect(v.pieces).toBeUndefined();
            updateCorpseView(v, c);
            expect(v.fighter!.root.position.x).toBeCloseTo(c.points.hip.x, 5);
            expect(v.fighter!.root.position.y).toBeCloseTo(c.points.hip.y, 5);
            expect(v.fighter!.weapon.visible).toBe(false);
            expect(v.fighter!.body.context.instructions.length).toBeGreaterThan(0);
            destroyCorpseView(v);
        }
    });

    it('a corpse with a lit tank wears it, whatever gun it dropped (its jet never comes from nothing)', () => {
        const tankColorIn = (tankId?: string) => {
            const c = Object.assign(createCorpse(death({ kind: 'fall', weapon: WeaponType.SHOTGUN })), { tankId });
            const v = createCorpseView(c, {});
            updateCorpseView(v, c);
            const colors = (v.fighter!.body.context.instructions as unknown as { data: { style?: { color?: number } } }[]).map(i => i.data.style?.color);
            destroyCorpseView(v);
            return colors.includes(TANK_COLOR);
        };
        expect(tankColorIn('tank_1')).toBe(true);
        expect(tankColorIn(undefined)).toBe(false);
    });

    it('a missing colour set draws with the default build', () => {
        const c = createCorpse(death({ parts: undefined }));
        const v = createCorpseView(c, {});
        expect(() => updateCorpseView(v, c)).not.toThrow();
        destroyCorpseView(v);
    });

    it('the dropped gun spans gunA to gunB with the held-weapon picture', () => {
        const picture = new Texture({ source: Texture.WHITE.source });
        const { c, v } = viewOf('fall', { [heldWeaponKey(WeaponType.MACHINE_GUN)]: picture });
        c.points.gunB.x += 3; // the gun has turned a little
        updateCorpseView(v, c);
        const { gunA, gunB } = c.points;
        expect(v.gun.visible).toBe(true);
        expect(v.gun.texture).toBe(picture);
        expect(v.gun.position.x).toBeCloseTo(gunA.x, 5);
        expect(v.gun.position.y).toBeCloseTo(gunA.y, 5);
        expect(v.gun.rotation).toBeCloseTo(Math.atan2(gunB.y - gunA.y, gunB.x - gunA.x), 5);
        expect(Math.abs(v.gun.scale.x) * picture.width).toBeCloseTo(Math.hypot(gunB.x - gunA.x, gunB.y - gunA.y), 3);
        destroyCorpseView(v);
    });

    it('without a weapon picture no gun is drawn', () => {
        const { c, v } = viewOf('fall');
        updateCorpseView(v, c);
        expect(v.gun.visible).toBe(false);
        destroyCorpseView(v);
    });

    it('stays solid until fadeAt, then fades to nothing at removeAt', () => {
        const { c, v } = viewOf('fall');
        const alphaAt = (age: number) => { c.age = age; updateCorpseView(v, c); return v.root.alpha; };
        expect(alphaAt(0)).toBe(1);
        expect(alphaAt(c.fadeAt)).toBe(1);
        expect(alphaAt((c.fadeAt + c.removeAt) / 2)).toBeCloseTo(0.5, 5);
        expect(alphaAt(c.removeAt)).toBe(0);
        destroyCorpseView(v);
    });

    it('a torn-off head keeps its own turn when the torso moves', () => {
        const { c, v } = viewOf('gib');
        const head = v.pieces!.find(g => g.label === 'corpse-head')!;
        const before = head.rotation;
        // The torso tumbles a full radian around the hip; the head point stays where it is
        const hip = { ...c.points.hip };
        for (const id of ['neck', 'shF', 'elF', 'haF', 'shB', 'elB', 'haB', 'knF', 'anF', 'knB', 'anB'] as const) {
            const p = c.points[id], dx = p.x - hip.x, dy = p.y - hip.y;
            p.x = hip.x + dx * Math.cos(1) - dy * Math.sin(1);
            p.y = hip.y + dx * Math.sin(1) + dy * Math.cos(1);
        }
        updateCorpseView(v, c);
        expect(head.rotation).toBe(before);
        destroyCorpseView(v);
    });

    it('a torn-off head rolls while it moves and stops when it is still', () => {
        const { c, v } = viewOf('gib');
        const head = v.pieces!.find(g => g.label === 'corpse-head')!;
        const start = head.rotation;
        c.points.head.x += 10; // rolling right turns it clockwise
        updateCorpseView(v, c);
        const rolled = head.rotation;
        expect(rolled).toBeGreaterThan(start);
        updateCorpseView(v, c);
        updateCorpseView(v, c);
        expect(head.rotation).toBe(rolled);
        c.points.head.x -= 10; // and back
        updateCorpseView(v, c);
        expect(head.rotation).toBeCloseTo(start, 10);
        destroyCorpseView(v);
    });

    it('views of removed corpses are destroyed', () => {
        const layer = new Container();
        const cache: { corpses?: Map<string, CorpseView> } = {};
        const corpse: Corpse = createCorpse(death({ kind: 'gib' }));
        syncCorpseViews(layer, [corpse], cache, {});
        expect(cache.corpses!.size).toBe(1);
        const view = cache.corpses!.get(corpse.id)!;
        expect(view.root.parent).toBe(layer);
        syncCorpseViews(layer, [corpse], cache, {});
        expect(cache.corpses!.get(corpse.id)).toBe(view); // one view per corpse, kept while it lies

        syncCorpseViews(layer, [], cache, {});
        expect(view.root.destroyed).toBe(true);
        expect(cache.corpses!.size).toBe(0);
        expect(layer.children).toHaveLength(0);
        layer.destroy({ children: true });
    });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Assets, Texture } from 'pixi.js';
import { WeaponType } from '../../../types';
import { DEFAULT_BUILD } from '../../build/buildParts';
import { BODY_PALETTES } from '../../build/characterBases';
import { createCorpse } from '../../systems/ragdoll/corpseBody';
import { createCorpseView, destroyCorpseView } from '../ragdoll/corpseView';
import { createFighterView, drawFighter, type FighterFrame, type FighterView } from '../fighter/fighterView';
import { solvePose } from '../fighter/fighterPose';
import { gripPoints } from '../fighter/weaponGrips';
import { IDLE_PARTS } from '../fighter/parts/partMotionFrame';
import { loadBodyTextures, resetBodyTextures } from './textures';
import { PERIOD_MS } from './robotHurtSparks';

vi.mock('../effects/glowTextures', () => ({ glowTexture: () => Texture.WHITE, stripTexture: () => Texture.WHITE }));

const grip = gripPoints(WeaponType.MACHINE_GUN, 0.23), cream = BODY_PALETTES.robot.arm;
const frame = (oneLeg: boolean): FighterFrame => ({
    pose: solvePose({ state: 'idle', body: 'robot', aim: 0, t: 0, phase: 0, moveDir: 1, recoil: 0, grip }),
    look: { head: cream, torso: cream, arm: cream, leg: cream, jet: 0xffffff, visor: 0xffffff, pattern: 0xffffff,
        build: { ...DEFAULT_BUILD, body: 'robot', helmet: 'none', visor: 'none' } },
    grip, facing: 1, weaponType: WeaponType.MACHINE_GUN, flame: false, flicker: 0, parts: IDLE_PARTS, muzzleFlash: 0, oneLeg,
});
const corpse = (kind: 'gib' | 'cut') => createCorpse({ x: 100, y: 500, kind, facing: 1, weapon: WeaponType.MACHINE_GUN,
    parts: { head: '#fff', torso: '#fff', arm: '#fff', leg: '#fff', build: { ...DEFAULT_BUILD, body: 'robot' } } });
const views: FighterView[] = [];

beforeEach(async () => {
    resetBodyTextures();
    vi.spyOn(Assets, 'load').mockImplementation(async () => new Texture({ source: Texture.WHITE.source }) as never);
    await loadBodyTextures();
});
afterEach(() => { vi.restoreAllMocks(); for (const v of views.splice(0)) if (!v.root.destroyed) v.root.destroy({ children: true }); resetBodyTextures(); });

const visibleFlanges = (root: { children: { visible: boolean; label?: string }[] }) =>
    root.children.filter(child => child.visible && child.label === 'robot-flange').length;

describe('robot wounds', () => {
    it('opens a torn hip with cables on a one-legged robot instead of the blood stump', () => {
        const view = createFighterView(); views.push(view);
        drawFighter(view, frame(true));
        expect(view.robotWounds).toBeDefined();
        expect(visibleFlanges(view.robotWounds!.root)).toBe(1);
        expect(view.robotWounds!.cables.visible).toBe(true);
        const wounds = view.robotWounds;
        drawFighter(view, frame(true));
        expect(view.robotWounds).toBe(wounds); // kept between frames, not rebuilt
        drawFighter(view, frame(false));
        expect(visibleFlanges(view.robotWounds!.root)).toBe(0);
        expect(view.robotWounds!.cables.visible).toBe(false);
    });

    it('flashes sparks over a hurt robot at least once a period, and never over a healthy one', () => {
        const view = createFighterView(); views.push(view);
        const seen = (expression: 'hurt' | 'normal') => {
            let visible = 0;
            // Exactly one whole period: its burst always falls inside it, whatever the random seed
            for (let t = 0; t < PERIOD_MS; t += 10) {
                vi.spyOn(performance, 'now').mockReturnValue(PERIOD_MS * 15 + t);
                drawFighter(view, { ...frame(false), expression });
                if (view.robotWounds!.sparks.visible) visible++;
            }
            return visible;
        };
        expect(seen('hurt')).toBeGreaterThan(0);
        expect(seen('normal')).toBe(0);
        expect(view.root.children.at(-1)).toBe(view.robotWounds!.sparks); // over the arms and the weapon
    });

    it('opens ten sockets on a gibbed robot and two on a cut one, and destroys them with the corpse', () => {
        for (const [kind, count] of [['gib', 10], ['cut', 2]] as const) {
            const v = createCorpseView(corpse(kind), {});
            const wounds = v.illustrated!.robotWounds!;
            expect(visibleFlanges(wounds.root)).toBe(count);
            const flange = wounds.root.children.find(child => child.label === 'robot-flange')!;
            destroyCorpseView(v);
            expect(flange.destroyed).toBe(true);
            expect(wounds.sparks.destroyed).toBe(true); // a corpse never sparks, but owns the layer
        }
    });
});

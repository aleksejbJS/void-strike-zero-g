import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Container } from 'pixi.js';
import { WeaponType, type GameState, type Particle, type Projectile } from '../../../types';
import { frameOf, stateOf, VIEW } from '../smoke/cloudField.testkit';
import type { SmokeFrame } from '../smoke/cloudField';
import type { SmokeQuality } from '../smoke/smokeTuning';
import { BlastFx } from './blastFx';
import { BlastCloud } from './blastCloud';
import { BlastView } from './blastView';
import { BLAST_LIFE_S, DEBRIS_UNTIL_LIFE, FIRE_PUFFS, MAX_BLAST_GRIDS, SIMPLE_SMOKE_PUFFS, TRAIL_STEP } from './blastTuning';

// The flame textures are drawn on canvases, which jsdom does not have: stand-ins (or a failure, when asked)
const tex = vi.hoisted(() => ({ made: null as null | Record<string, unknown>, fail: false }));
vi.mock('../flame/flameTextures', async () => {
    const { Texture: T } = await import('pixi.js');
    return {
        flameTextures: () => {
            if (tex.fail) throw new Error('no canvas');
            return (tex.made ??= Object.fromEntries(['flame', 'smoke', 'core', 'ember', 'glow', 'pool', 'tongue'].map(k => [k, new T({})])));
        },
    };
});

afterEach(() => { tex.fail = false; vi.restoreAllMocks(); });

const ring = (id: string, x = 400, y = 400, size = 12): Particle =>
    ({ id, pos: { x, y }, vel: { x: 0, y: 0 }, life: 1, decay: 0.017, color: '#fff', size, type: 'ring' });
const debris = (id: string, x: number, life = 1): Particle =>
    ({ id, pos: { x, y: 300 }, vel: { x: 5, y: 0 }, life, decay: 0.01, color: '#333', size: 3, type: 'debris' });
const rocket = (x: number): Projectile =>
    ({ id: 'rk', pos: { x, y: 200 }, vel: { x: 12, y: 0 }, type: WeaponType.ROCKET_LAUNCHER }) as unknown as Projectile;

const frame = (over: Partial<GameState>, quality: SmokeQuality = 'high'): SmokeFrame => frameOf(stateOf(over), VIEW, quality);
/** Live puffs per layer: trail and simple smoke, fireball, flash. */
const shown = (c: Container) => c.children.filter(k => k.visible).length;
const layers = (fx: BlastFx) => {
    const [smoke, , fire, flash] = fx.layer.children as Container[];
    return { smoke: shown(smoke), fire: shown(fire), flash: shown(flash) };
};

describe('BlastFx', () => {
    it('a fresh blast makes a flash, a fireball and one smoke grid, once', () => {
        const fx = new BlastFx(), f = frame({ particles: [ring('a')] });
        fx.sync(1000, f, [], true);
        fx.sync(1016, f, [], true);
        expect(layers(fx)).toMatchObject({ flash: 1, fire: FIRE_PUFFS });
        expect(fx.grids).toBe(1);
        fx.destroy();
    });

    it('without grids (low quality, no shader) the blast smoke is simple puffs', () => {
        const fx = new BlastFx();
        fx.sync(1000, frame({ particles: [ring('a')] }, 'low'), [], false);
        expect(fx.grids).toBe(0);
        expect(layers(fx).smoke).toBe(SIMPLE_SMOKE_PUFFS);
        fx.destroy();
    });

    it('past MAX_BLAST_GRIDS, more blasts get the simple puffs', () => {
        const fx = new BlastFx();
        const rings = Array.from({ length: MAX_BLAST_GRIDS + 2 }, (_, i) => ring(`r${i}`, 200 + i * 150));
        fx.sync(1000, frame({ particles: rings }), [], true);
        expect(fx.grids).toBe(MAX_BLAST_GRIDS);
        expect(layers(fx).smoke).toBe(2 * SIMPLE_SMOKE_PUFFS);
        fx.destroy();
    });

    it('a rocket leaves trail puffs along its path and a glow at its nozzle', () => {
        const fx = new BlastFx();
        fx.sync(1000, frame({ projectiles: [rocket(100)] }), [], true);
        fx.sync(1016, frame({ projectiles: [rocket(100 + 10 * TRAIL_STEP)] }), [], true);
        expect(layers(fx).smoke).toBe(11);
        expect(layers(fx).fire).toBeGreaterThanOrEqual(1);
        fx.destroy();
    });

    it('debris trails while it flies fast, not once it is nearly gone', () => {
        const fx = new BlastFx();
        fx.sync(1000, frame({ particles: [debris('d', 0), debris('e', 0, DEBRIS_UNTIL_LIFE / 2)] }), [], true);
        fx.sync(1016, frame({ particles: [debris('d', 70), debris('e', 70, DEBRIS_UNTIL_LIFE / 2)] }), [], true);
        expect(layers(fx).smoke).toBe(11);                 // 'd': one at first sight, then one every 7 px; 'e': none
        fx.destroy();
    });

    it('a grid out of view does not step and is hidden; a spent grid is freed', () => {
        const fx = new BlastFx();
        fx.sync(1000, frame({ particles: [ring('a', 400, 400)] }), [], true);
        const advance = vi.spyOn(BlastCloud.prototype, 'advance');
        fx.sync(1016, { ...frame({}), view: { x: 5000, y: 5000, w: 800, h: 600 } }, [], true);
        expect(advance).not.toHaveBeenCalled();
        fx.sync(1000 + BLAST_LIFE_S * 1000 + 50, frame({}), [], true);
        expect(fx.grids).toBe(0);
        fx.destroy();
        fx.destroy();
    });
});

describe('BlastView', () => {
    it('is made only once there is something to draw', () => {
        const view = new BlastView();
        expect(view.sync(1000, frame({}), [], true)).toBe(false);
        expect(view.layer).toBeNull();
        expect(view.sync(1016, frame({ particles: [ring('a')] }), [], true)).toBe(true);
        expect(view.layer).not.toBeNull();
        expect(view.hasGrids).toBe(true);
        expect(view.sync(1032, frame({ particles: [ring('a')] }), [], true)).toBe(false);
        view.destroy();
    });

    it('a failing grid logs once, frees the grids, and later blasts get simple puffs', () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(BlastCloud.prototype, 'advance').mockImplementation(() => { throw new Error('gpu'); });
        const view = new BlastView();
        view.sync(1000, frame({ particles: [ring('a')] }), [], true);
        view.sync(1016, frame({ particles: [ring('a')] }), [], true);
        expect(error).toHaveBeenCalledTimes(1);
        expect(view.hasGrids).toBe(false);
        view.sync(1032, frame({ particles: [ring('b')] }), [], true);
        expect(view.hasGrids).toBe(false);
        expect(error).toHaveBeenCalledTimes(1);
        expect(view.layer).not.toBeNull();
        view.destroy();
    });

    it('a failure of the blasts themselves logs once and draws no blasts from then on', () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        tex.fail = true;
        const view = new BlastView();
        expect(view.sync(1000, frame({ particles: [ring('a')] }), [], true)).toBe(false);
        tex.fail = false;
        view.sync(1016, frame({ particles: [ring('b')] }), [], true);
        expect(error).toHaveBeenCalledTimes(1);
        expect(view.layer).toBeNull();
    });
});

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { stateOf } from '../smoke/cloudField.testkit';
import { debris, frame, layers, ring, rocket } from './blast.testkit';
import { BlastFx } from './blastFx';
import { BlastCloud } from './blastCloud';
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

// Pixi probes a 2D canvas when it builds a shader; jsdom has none
beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
afterEach(() => { tex.fail = false; vi.restoreAllMocks(); });

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
        expect(layers(fx).nozzle).toBe(1);
        fx.destroy();
    });

    it('the nozzle glow is one sprite per rocket at any frame rate, and goes with the rocket', () => {
        for (const ms of [1000 / 60, 1000 / 144]) {
            const fx = new BlastFx();
            for (let i = 0; i < 20; i++) fx.sync(1000 + i * ms, frame({ projectiles: [rocket(100 + i * 10)] }), [], true);
            expect(layers(fx).nozzle).toBe(1);
            fx.sync(1000 + 21 * ms, frame({}), [], true);
            expect(layers(fx).nozzle).toBe(0);
            fx.destroy();
        }
    });

    it('a rocket out of view leaves no trail and no glow', () => {
        const fx = new BlastFx(), far = (x: number) => ({ ...rocket(x), pos: { x, y: 5000 } });
        fx.sync(1000, frame({ projectiles: [far(100)] }), [], true);
        fx.sync(1016, frame({ projectiles: [far(160)] }), [], true);
        expect(layers(fx)).toMatchObject({ smoke: 0, nozzle: 0 });
        fx.destroy();
    });

    it('grids switched off (shader lost, low quality) free the live grids', () => {
        const fx = new BlastFx();
        fx.sync(1000, frame({ particles: [ring('a')] }), [], true);
        expect(fx.grids).toBe(1);
        fx.sync(1016, frame({ particles: [ring('a')] }), [], false);
        expect(fx.grids).toBe(0);
        fx.destroy();
    });

    it('with every slot taken, a grid out of view gives way to a blast in view', () => {
        const fx = new BlastFx();
        const away = Array.from({ length: MAX_BLAST_GRIDS }, (_, i) => ring(`f${i}`, 400 + i * 100, 400));
        fx.sync(1000, frame({ particles: away }), [], true);
        const moved = { ...frame({}), view: { x: 3000, y: 0, w: 1600, h: 900 } };
        fx.sync(1016, moved, [], true);                                 // the first grids are now out of view, asleep
        fx.sync(1032, { ...moved, state: stateOf({ particles: [ring('near', 3500, 400)] }) }, [], true);
        expect(fx.grids).toBe(MAX_BLAST_GRIDS);
        expect(layers(fx).smoke).toBe(0);                               // the new blast got a grid, not the puffs
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

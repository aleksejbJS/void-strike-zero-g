import { describe, it, expect, vi } from 'vitest';
import { Container, Sprite, Texture } from 'pixi.js';
import { FlameFx } from './flameFx';
import { FlameOrders } from './flameOrders';
import type { FlameQuality } from './flameTuning';

// The shared flame textures are drawn on canvases, which jsdom does not have: stand-ins, one distinct texture each
const tex = vi.hoisted(() => ({ made: null as null | Record<string, unknown> }));
vi.mock('./flameTextures', async () => {
    const { Texture: T } = await import('pixi.js');
    return {
        flameTextures: () => (tex.made ??= Object.fromEntries(
            ['flame', 'smoke', 'core', 'ember', 'glow', 'pool', 'tongue'].map(k => [k, new T({})]))),
    };
});

const world = { platforms: [], cover: [] };

/** Run a flame fx for 1.2 s with one stream firing, then return it with the layer it draws into. */
function sprayed(quality: FlameQuality) {
    const layer = new Container(), decals = new Container(), fx = new FlameFx(layer, decals, quality);
    const orders = new FlameOrders();
    for (let i = 0; i < 144; i++) {
        orders.stream('a', { x: 100, y: 400, angle: 0, firing: true });
        fx.update(1000 + i * (1000 / 120), orders, world);
    }
    return { fx, layer };
}

const smokeSprites = (layer: Container): number => {
    const smoke = (tex.made as { smoke: Texture }).smoke;
    let n = 0;
    const walk = (c: Container): void => {
        for (const kid of c.children) {
            if (kid instanceof Sprite && kid.texture === smoke && kid.visible) n++;
            if (kid instanceof Container) walk(kid);
        }
    };
    walk(layer);
    return n;
};

describe('FlameFx smoke', () => {
    it.each(['high', 'medium'] as FlameQuality[])('draws no smoke sprites on %s, but keeps simulating the smoke that feeds the soot plumes', (quality) => {
        const { fx, layer } = sprayed(quality);
        expect(fx.air().hasSoot()).toBe(true);
        expect([...fx.air().soot()].length).toBeGreaterThan(10);
        expect(smokeSprites(layer)).toBe(0);
        fx.clear();
    });

    it('still draws the smoke sprites on low (match tiles have no plumes)', () => {
        const { fx, layer } = sprayed('low');
        expect(fx.air().hasSoot()).toBe(true);
        expect(smokeSprites(layer)).toBeGreaterThan(5);
        fx.clear();
    });

    it('clear works on every quality, with or without a smoke layer in the tree', () => {
        for (const quality of ['high', 'medium', 'low'] as FlameQuality[]) {
            const { fx } = sprayed(quality);
            expect(() => fx.clear()).not.toThrow();
            expect(() => fx.clear()).not.toThrow();
        }
    });
});

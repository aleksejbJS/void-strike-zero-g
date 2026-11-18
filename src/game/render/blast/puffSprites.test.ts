import { describe, it, expect } from 'vitest';
import { Sprite, Texture } from 'pixi.js';
import { PuffSprites, puffFade, rampAt, type PuffSpec } from './puffSprites';

const spec = (over: Partial<PuffSpec> = {}): PuffSpec => ({
    x: 0, y: 0, vx: 100, vy: 0, ttl: 1, size0: 10, size1: 30, alpha: 0.8, drag: 0, rise: 0, ramp: [0xffffff, 0x000000], fadeIn: 0.1, ...over,
});

const visible = (pool: PuffSprites) => pool.layer.children.filter(c => c.visible).length;

describe('rampAt and puffFade', () => {
    it('walks the ramp from its first colour to its last', () => {
        expect(rampAt([0xff0000, 0x0000ff], 0)).toBe(0xff0000);
        expect(rampAt([0xff0000, 0x0000ff], 1)).toBe(0x0000ff);
        expect(rampAt([0x000000, 0xffffff, 0x000000], 0.5)).toBe(0xffffff);
        expect(rampAt([0x123456], 0.7)).toBe(0x123456);
    });

    it('fades in, then out, and is 0 outside the life', () => {
        expect(puffFade(0, 0.1)).toBe(0);
        expect(puffFade(0.1, 0.1)).toBeCloseTo(1);
        expect(puffFade(0.55, 0.1)).toBeGreaterThan(0.3);
        expect(puffFade(1, 0.1)).toBe(0);
    });
});

describe('PuffSprites', () => {
    it('a puff moves, grows and dies at the end of its life', () => {
        const pool = new PuffSprites(Texture.WHITE, false, 10);
        pool.add(spec());
        pool.update(0.5);
        const s = pool.layer.children[0] as Sprite;
        expect(s.visible).toBe(true);
        expect(s.position.x).toBeCloseTo(50);
        expect(s.width).toBeGreaterThan(10);
        pool.update(0.6);
        expect(pool.live).toBe(0);
        expect(s.visible).toBe(false);
    });

    it('reuses the sprites of dead puffs', () => {
        const pool = new PuffSprites(Texture.WHITE, true, 10);
        for (let i = 0; i < 3; i++) pool.add(spec({ ttl: 0.1 }));
        pool.update(0.2);
        for (let i = 0; i < 3; i++) pool.add(spec());
        expect(pool.layer.children).toHaveLength(3);
        expect(pool.live).toBe(3);
    });

    it('when full, a new puff takes the oldest one\'s place', () => {
        const pool = new PuffSprites(Texture.WHITE, false, 2);
        pool.add(spec({ x: 1 }));
        pool.add(spec({ x: 2 }));
        pool.add(spec({ x: 3, vx: 0 }));
        pool.update(0.01);
        expect(pool.live).toBe(2);
        expect(pool.layer.children.map(c => Math.round(c.position.x))).toEqual([3, 3]);
    });

    it('skips a puff with no life or no place', () => {
        const pool = new PuffSprites(Texture.WHITE, false, 4);
        pool.add(spec({ ttl: 0 }));
        pool.add(spec({ x: Number.NaN }));
        expect(pool.live).toBe(0);
    });

    it('clear hides everything; destroy frees the layer', () => {
        const pool = new PuffSprites(Texture.WHITE, false, 4);
        pool.add(spec());
        pool.update(0.1);
        pool.clear();
        expect(visible(pool)).toBe(0);
        pool.destroy();
        expect(pool.layer.destroyed).toBe(true);
    });
});

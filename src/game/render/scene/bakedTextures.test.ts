import { describe, expect, it, vi } from 'vitest';

const made: { destroy: ReturnType<typeof vi.fn> }[] = [];
vi.mock('pixi.js', () => ({
    Texture: {
        from: () => {
            const t = { destroy: vi.fn() };
            made.push(t);
            return t;
        },
    },
}));

const { bakeScene, bakedTexture } = await import('./bakedTextures');
const canvas = {} as HTMLCanvasElement;

describe('bakeScene', () => {
    it("frees only its own scene's textures", () => {
        made.length = 0;
        const menu = bakeScene(() => bakedTexture(canvas));
        const match = bakeScene(() => [bakedTexture(canvas), bakedTexture(canvas)]);

        menu.textures.release();

        expect(menu.result.destroy).toHaveBeenCalledTimes(1);
        match.result.forEach(t => expect(t.destroy).not.toHaveBeenCalled());
    });

    it('frees what a failed build baked and rethrows', () => {
        made.length = 0;
        expect(() => bakeScene(() => {
            bakedTexture(canvas);
            throw new Error('broken theme');
        })).toThrow('broken theme');
        expect(made[0].destroy).toHaveBeenCalledTimes(1);
    });

    it('refuses to bake outside a scene build', () => {
        expect(() => bakedTexture(canvas)).toThrow(/outside bakeScene/);
    });
});

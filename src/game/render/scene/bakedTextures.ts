// GPU textures made from baked canvases. They bypass Pixi's texture cache (a cached texture
// would be handed out again after the scene destroyed it) and are freed with the scene that
// baked them. Two scenes can be alive at once (the menu's mode preview and the match canvas
// overlap at match start), so each scene owns its own textures: freeing one never touches
// the other's.

import { Texture } from 'pixi.js';

/** Textures baked by one scene. */
export interface BakedTextures {
    release(): void;
}

let owner: Texture[] | null = null;

/** Bakes a canvas into a texture owned by the scene being built (see bakeScene). */
export const bakedTexture = (canvas: HTMLCanvasElement) => {
    if (!owner) throw new Error('bakedTexture() called outside bakeScene(): the texture would never be freed');
    const texture = Texture.from(canvas, true);
    owner.push(texture);
    return texture;
};

/** Runs a synchronous scene build; every texture it bakes is freed by the returned release(). */
export const bakeScene = <T>(build: () => T): { result: T; textures: BakedTextures } => {
    const outer = owner;
    const mine: Texture[] = [];
    owner = mine;
    try {
        const result = build();
        return {
            result,
            textures: {
                release() {
                    mine.forEach(t => t.destroy(true));
                    mine.length = 0;
                },
            },
        };
    } catch (err) {
        // A half-built scene still owns what it baked so far
        mine.forEach(t => t.destroy(true));
        throw err;
    } finally {
        owner = outer;
    }
};

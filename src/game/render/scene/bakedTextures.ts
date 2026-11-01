// GPU textures made from baked canvases. They bypass Pixi's texture cache (a cached texture
// would be handed out again after the scene destroyed it) and are all freed with the scene.

import { Texture } from 'pixi.js';

let owned: Texture[] = [];

export const bakedTexture = (canvas: HTMLCanvasElement) => {
    const texture = Texture.from(canvas, true);
    owned.push(texture);
    return texture;
};

export const releaseBakedTextures = () => {
    owned.forEach(t => t.destroy(true));
    owned = [];
};

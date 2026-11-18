import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Assets, Texture } from 'pixi.js';
import { assetUrl } from '../../../assetUrl';
import { BODY_ART } from './definitions';
import { RUNTIME_BODY_ART } from './runtimeDefinitions';
import { HUMAN_PICTURES, type HumanPicture } from './data/humanPoseVariants';
import { bodyPictureTexture, bodyTexture, loadBodyTextures, resetBodyTextures } from './textures';

const declared = { ...RUNTIME_BODY_ART }, pictures = HUMAN_PICTURES as HumanPicture[];
const declaredPictures = [...pictures], allocated: Texture[] = [];
const makeTexture = () => {
    const texture = new Texture({ source: Texture.WHITE.source }); allocated.push(texture);
    return texture as unknown as Record<string, unknown>;
};
beforeEach(() => {
    resetBodyTextures(); Object.assign(RUNTIME_BODY_ART, BODY_ART);
    pictures.splice(0, pictures.length, { imagePath: '/human-prone.png', size: [200, 100] },
        { imagePath: '/human-damage.png', size: [400, 200] });
});
afterEach(() => {
    vi.restoreAllMocks(); resetBodyTextures(); Object.assign(RUNTIME_BODY_ART, declared);
    pictures.splice(0, pictures.length, ...declaredPictures);
    for (const texture of allocated.splice(0)) if (!texture.destroyed) texture.destroy();
});

describe('shared pose and damage pictures', () => {
    it('loads declared extra pictures once in the shared batch and resets lookups without destroying borrowed textures', async () => {
        const load = vi.spyOn(Assets, 'load').mockImplementation(async () => makeTexture());
        const first = loadBodyTextures(), second = loadBodyTextures();
        expect(first).toBe(second);
        expect(load).toHaveBeenCalledTimes(7);
        await first;
        expect(load).toHaveBeenCalledWith(assetUrl('/human-prone.png'));
        expect(load).toHaveBeenCalledWith(assetUrl('/human-damage.png'));
        const borrowed = bodyPictureTexture('/human-damage.png')!;
        expect(borrowed).toBeDefined();
        expect(bodyPictureTexture('/undeclared.png')).toBeUndefined();
        await loadBodyTextures(); expect(load).toHaveBeenCalledTimes(7);
        resetBodyTextures();
        expect(bodyPictureTexture('/human-damage.png')).toBeUndefined();
        expect(borrowed.destroyed).toBe(false);
    });

    it('keeps base and successful extra pictures after one fails, then retries only that picture', async () => {
        const failure = new Error('Damage picture unavailable'); let fail = true;
        const load = vi.spyOn(Assets, 'load').mockImplementation(async url => {
            if (String(url) === assetUrl('/human-damage.png') && fail) { fail = false; throw failure; }
            return makeTexture();
        });
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        await loadBodyTextures();
        expect(load).toHaveBeenCalledTimes(7);
        expect(bodyPictureTexture('/human-damage.png')).toBeUndefined();
        const original = bodyTexture('human'), prone = bodyPictureTexture('/human-prone.png');
        expect(original).toBeDefined(); expect(prone).toBeDefined();
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('/human-damage.png'), failure);
        await loadBodyTextures();
        expect(load).toHaveBeenCalledTimes(8); expect(load.mock.calls[7][0]).toBe(assetUrl('/human-damage.png'));
        expect(bodyPictureTexture('/human-damage.png')).toBeDefined();
        expect(bodyTexture('human')).toBe(original); expect(bodyPictureTexture('/human-prone.png')).toBe(prone);
    });

    it('reloads only a destroyed extra picture', async () => {
        const load = vi.spyOn(Assets, 'load').mockImplementation(async () => makeTexture());
        await loadBodyTextures();
        const previous = bodyPictureTexture('/human-prone.png')!; previous.destroy();
        expect(bodyPictureTexture('/human-prone.png')).toBeUndefined();
        await loadBodyTextures();
        expect(load).toHaveBeenCalledTimes(8); expect(load.mock.calls[7][0]).toBe(assetUrl('/human-prone.png'));
        expect(bodyPictureTexture('/human-prone.png')).not.toBe(previous);
    });
});

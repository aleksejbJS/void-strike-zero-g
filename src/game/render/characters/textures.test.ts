import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Assets, Texture } from 'pixi.js';
import { assetUrl } from '../../../assetUrl';
import { BODY_IDS } from '../../build/bodyTypes';
import { bodyAtlasTexture, bodyTexture, loadBodyTextures, resetBodyTextures } from './textures';
import { BODY_ART } from './definitions';
import { RUNTIME_BODY_ART } from './runtimeDefinitions';
import { HUMAN_PICTURES, type HumanPicture } from './data/humanPoseVariants';

const allocated: Texture[] = [];
const makeTexture = () => {
    const texture = new Texture({ source: Texture.WHITE.source });
    allocated.push(texture);
    return texture;
};
const asLoadResult = (texture: Texture) => texture as unknown as Record<string, unknown>;
const imageUrl = (id: string) => assetUrl(`assets/characters/atompunk/${id}.png`);

const declared = { ...RUNTIME_BODY_ART };
const pictures = HUMAN_PICTURES as HumanPicture[], declaredPictures = [...pictures];
beforeEach(() => {
    resetBodyTextures();
    Object.assign(RUNTIME_BODY_ART, BODY_ART);
    pictures.splice(0);
});
afterEach(() => {
    vi.restoreAllMocks();
    resetBodyTextures();
    Object.assign(RUNTIME_BODY_ART, declared);
    pictures.splice(0, pictures.length, ...declaredPictures);
    for (const texture of allocated.splice(0)) if (!texture.destroyed) texture.destroy();
});

describe('shared illustrated texture registry', () => {
    it('loads only declared atlases and shares their textures without owning their destruction', async () => {
        RUNTIME_BODY_ART.human = { ...BODY_ART.human, atlas: { imagePath: '/atlas-human.png', size: [200, 100] } };
        const load = vi.spyOn(Assets, 'load').mockImplementation(async () => asLoadResult(makeTexture()));
        await loadBodyTextures();
        expect(load).toHaveBeenCalledWith(assetUrl('/atlas-human.png'));
        expect(load).toHaveBeenCalledTimes(6);
        const borrowed = bodyAtlasTexture('human')!;
        expect(borrowed).toBeDefined();
        expect(bodyAtlasTexture('robot')).toBeUndefined();
        await loadBodyTextures();
        expect(load).toHaveBeenCalledTimes(6);
        resetBodyTextures();
        expect(bodyAtlasTexture('human')).toBeUndefined();
        expect(borrowed.destroyed).toBe(false);
    });

    it('retains the original source after an atlas failure and retries only that atlas', async () => {
        RUNTIME_BODY_ART.human = { ...BODY_ART.human, atlas: { imagePath: '/atlas-human.png', size: [200, 100] } };
        const failure = new Error('Atlas temporarily unavailable');
        let failed = false;
        const load = vi.spyOn(Assets, 'load').mockImplementation(async url => {
            if (String(url) === assetUrl('/atlas-human.png') && !failed) { failed = true; throw failure; }
            return asLoadResult(makeTexture());
        });
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        await loadBodyTextures();
        expect(load).toHaveBeenCalledWith(assetUrl('/atlas-human.png'));
        const original = bodyTexture('human');
        expect(original).toBeDefined();
        expect(bodyAtlasTexture('human')).toBeUndefined();
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('atlas'), failure);
        await loadBodyTextures();
        expect(load).toHaveBeenCalledTimes(7);
        expect(load.mock.calls[6][0]).toBe(assetUrl('/atlas-human.png'));
        expect(bodyAtlasTexture('human')).toBeDefined();
        expect(bodyTexture('human')).toBe(original);
    });

    it('shares an in-flight batch and publishes each texture once it finishes', async () => {
        const pending = new Map<string, (texture: Record<string, unknown>) => void>();
        const load = vi.spyOn(Assets, 'load').mockImplementation(url => new Promise(resolve => {
            pending.set(String(url), resolve);
        }));
        const first = loadBodyTextures(), second = loadBodyTextures();
        expect(first).toBe(second);
        expect(load).toHaveBeenCalledTimes(5);
        expect(BODY_IDS.map(bodyTexture)).toEqual([undefined, undefined, undefined, undefined, undefined]);
        const expected = BODY_IDS.map(id => {
            const texture = makeTexture();
            pending.get(imageUrl(id))!(asLoadResult(texture));
            return texture;
        });
        await Promise.all([first, second]);
        expect(BODY_IDS.map(bodyTexture)).toEqual(expected);
        await loadBodyTextures();
        expect(load).toHaveBeenCalledTimes(5);
    });

    it('keeps successful pictures available and retries only the failed picture', async () => {
        const failure = new Error('Robot image temporarily unavailable');
        let failed = false;
        const load = vi.spyOn(Assets, 'load').mockImplementation(async url => {
            if (String(url) === imageUrl('robot') && !failed) { failed = true; throw failure; }
            return asLoadResult(makeTexture());
        });
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        await loadBodyTextures();
        const retained = BODY_IDS.filter(id => id !== 'robot').map(bodyTexture);
        expect(retained.every(texture => texture && !texture.destroyed)).toBe(true);
        expect(bodyTexture('robot')).toBeUndefined();
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('"robot"'), failure);
        await loadBodyTextures();
        expect(load).toHaveBeenCalledTimes(6);
        expect(load.mock.calls[5][0]).toBe(imageUrl('robot'));
        expect(bodyTexture('robot')?.destroyed).toBe(false);
        expect(BODY_IDS.filter(id => id !== 'robot').map(bodyTexture)).toEqual(retained);
    });

    it('clears lookups without destroying textures already shared with a view', async () => {
        vi.spyOn(Assets, 'load').mockImplementation(async () => asLoadResult(makeTexture()));
        await loadBodyTextures();
        const borrowed = BODY_IDS.map(id => bodyTexture(id)!);
        const sources = borrowed.map(texture => texture.source);
        resetBodyTextures();
        expect(BODY_IDS.every(id => bodyTexture(id) === undefined)).toBe(true);
        expect(borrowed.every(texture => !texture.destroyed)).toBe(true);
        expect(borrowed.map(texture => texture.source)).toEqual(sources);
        expect(Texture.WHITE.destroyed).toBe(false);
    });

    it('rejects destroyed cached pictures and reloads only their body', async () => {
        const load = vi.spyOn(Assets, 'load').mockImplementation(async () => asLoadResult(makeTexture()));
        await loadBodyTextures();
        const previous = bodyTexture('cat')!;
        previous.destroy();
        expect(bodyTexture('cat')).toBeUndefined();
        await loadBodyTextures();
        expect(load).toHaveBeenCalledTimes(6);
        expect(load.mock.calls[5][0]).toBe(imageUrl('cat'));
        expect(bodyTexture('cat')).not.toBe(previous);
        expect(bodyTexture('cat')?.destroyed).toBe(false);
    });
});

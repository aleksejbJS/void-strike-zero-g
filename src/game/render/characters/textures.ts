// Body pictures are shared by every articulated mesh; a failed picture keeps the legacy fallback.
import { Assets, Texture } from 'pixi.js';
import { assetUrl } from '../../../assetUrl';
import { BODY_IDS, BodyId } from '../../build/bodyTypes';
import { BODY_ART } from './definitions';
import { RUNTIME_BODY_ART } from './runtimeDefinitions';
import { HUMAN_PICTURES } from './data/humanPoseVariants';

const pictures = new Map<BodyId, Texture>();
const atlases = new Map<BodyId, Texture>();
const extraPictures = new Map<string, Texture>();
let loading: Promise<void> | null = null;

const liveTexture = <K>(registry: Map<K, Texture>, id: K): Texture | undefined => {
    const texture = registry.get(id);
    return texture && !texture.destroyed ? texture : undefined;
};

export const bodyTexture = (id: BodyId): Texture | undefined => liveTexture(pictures, id);
export const bodyAtlasTexture = (id: BodyId): Texture | undefined => liveTexture(atlases, id);
export const bodyPictureTexture = (imagePath: string): Texture | undefined => liveTexture(extraPictures, imagePath);

const readPicture = async (imagePath: string): Promise<Texture> => {
    const texture = await Assets.load<Texture>(assetUrl(imagePath));
    if (!texture || texture.destroyed || texture.width <= 0 || texture.height <= 0) throw new Error('Empty character texture');
    return texture;
};

const loadPicture = async (id: BodyId, imagePath: string, atlas = false): Promise<void> => {
    const registry = atlas ? atlases : pictures;
    if (liveTexture(registry, id)) return;
    try {
        const texture = await readPicture(imagePath);
        registry.set(id, texture);
    } catch (error) {
        console.warn(`Character ${atlas ? 'atlas' : 'artwork'} "${id}" could not load; keeping its existing drawing:`, error);
    }
};

const loadExtraPicture = async (imagePath: string): Promise<void> => {
    if (bodyPictureTexture(imagePath)) return;
    try {
        extraPictures.set(imagePath, await readPicture(imagePath));
    } catch (error) {
        console.warn(`Character picture "${imagePath}" could not load; keeping its existing drawing:`, error);
    }
};

export const loadBodyTextures = (): Promise<void> => {
    const bodiesReady = BODY_IDS.every(id => bodyTexture(id) && (!RUNTIME_BODY_ART[id].atlas || bodyAtlasTexture(id)));
    if (bodiesReady && HUMAN_PICTURES.every(picture => bodyPictureTexture(picture.imagePath))) return Promise.resolve();
    loading ??= Promise.all([...BODY_IDS.flatMap(id => {
        const tasks = [loadPicture(id, BODY_ART[id].imagePath)];
        const atlas = RUNTIME_BODY_ART[id].atlas;
        if (atlas) tasks.push(loadPicture(id, atlas.imagePath, true));
        return tasks;
    }), ...HUMAN_PICTURES.map(picture => loadExtraPicture(picture.imagePath))]).then(() => {}).finally(() => { loading = null; });
    return loading;
};

/** Assets owns the shared textures; resetting this registry never destroys another view's picture. */
export const resetBodyTextures = (): void => { pictures.clear(); atlases.clear(); extraPictures.clear(); loading = null; };

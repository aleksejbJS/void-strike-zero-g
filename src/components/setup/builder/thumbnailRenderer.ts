// One offscreen Pixi Application shared by every part tile. Created on first use, kept while any tile
// list is on screen, destroyed a moment after the last one leaves (so switching tabs reuses it).

import { Application, Rectangle, Texture } from 'pixi.js';
import { WeaponType } from '../../../types';
import { FighterBuild, Slot } from '../../../game/build/buildParts';
import { SetupColors } from '../../../game/render/fighter/fighterLook';
import { heldWeaponKey } from '../../../game/render/fighter/fighterAnimator';
import { generateAssets } from '../../../game/systems/assets';
import { thumbnailBuilds } from './partThumbnails';
import { THUMB_SIZE, thumbnailArt } from './thumbnailArt';

interface Shared { app: Application; weapon: Texture | undefined }

const RELEASE_DELAY_MS = 1000;
const PIXEL_RATIO = 2; // sharp on high-density screens
const FRAME = new Rectangle(0, 0, THUMB_SIZE, THUMB_SIZE);

let shared: Promise<Shared> | null = null;
let users = 0;
let releaseTimer: ReturnType<typeof setTimeout> | undefined;

const create = async (): Promise<Shared> => {
    const app = new Application();
    try {
        const [textures] = await Promise.all([
            generateAssets(),
            app.init({ width: THUMB_SIZE, height: THUMB_SIZE, backgroundAlpha: 0, antialias: true, autoStart: false }),
        ]);
        app.ticker.stop(); // nothing animates; pictures are rendered on demand
        return { app, weapon: textures[heldWeaponKey(WeaponType.MACHINE_GUN)] };
    } catch (err) {
        shared = null; // let a later tile list try again
        throw err;
    }
};

/** Never `destroy(true)`: that releases Pixi's page-wide pools under the live game renderer. */
const destroyShared = (pending: Promise<Shared>) => {
    pending
        .then(({ app }) => app.destroy({ removeView: true }, { children: true, context: true }))
        .catch(err => console.warn('Part thumbnails: renderer was never ready, nothing to destroy', err));
};

/** Call when a tile list mounts; pair with releaseThumbnails on unmount. */
export const acquireThumbnails = () => {
    users++;
    clearTimeout(releaseTimer);
};

export const releaseThumbnails = () => {
    users = Math.max(0, users - 1);
    if (users > 0) return;
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(() => {
        if (users > 0 || !shared) return;
        destroyShared(shared);
        shared = null;
    }, RELEASE_DELAY_MS);
};

/** Picture of every option of `slot` on top of `base`, as data URLs keyed by part id. Rejects if Pixi fails. */
export const renderThumbnails = async (slot: Slot, base: FighterBuild, colors: SetupColors): Promise<Record<string, string>> => {
    shared ??= create();
    const { app, weapon } = await shared;
    const out: Record<string, string> = {};
    for (const { id, build } of thumbnailBuilds(slot, base)) {
        const art = thumbnailArt(slot, build, colors, weapon);
        let pending: Promise<string>;
        try {
            // Pixels are read synchronously; only the PNG encoding is awaited, so the art can go right away
            pending = app.renderer.extract.base64({ target: art, frame: FRAME, resolution: PIXEL_RATIO });
        } finally {
            art.destroy({ children: true, context: true });
        }
        out[id] = await pending;
    }
    return out;
};

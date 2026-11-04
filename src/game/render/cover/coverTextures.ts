// The baked pictures of cover: one canvas per kind × damage stage × resolution, drawn once at screen
// resolution with a grain overlay and a soft cast shadow on the wall behind, then kept as a Pixi
// texture. Textures bypass Pixi's cache (Texture.from(canvas, true)) so they can be freed for real. They are
// shared by every CoverView on the page (game screen, watch tiles): each view retains them while it lives and
// the last one to release frees them. Baking is lazy, so only the kinds and stages that show up cost anything.

import { Texture } from 'pixi.js';
import { makeCanvas, overlayNoise } from '../scene/canvasKit';
import { COVER_SPECS, CoverKind, CoverStage } from '../../cover/coverTypes';
import { drawBarrel } from './barrelArt';
import { Ctx } from './coverArtKit';
import { drawGlass } from './glassArt';
import { drawMetal } from './metalArt';
import { drawWood } from './woodArt';

/** A baked picture; the anchor is where the piece's feet centre sits in it (0..1, like Sprite.anchor). */
export interface CoverTexture { texture: Texture; anchorX: number; anchorY: number }

const DRAW: Record<CoverKind, (c: Ctx, cx: number, fy: number, stage: CoverStage, seed: number) => void> = {
    wood: drawWood, metal: drawMetal, glass: drawGlass, barrel: drawBarrel,
};
/** One look per kind: every crate of a kind shows the same picture at the same stage. */
const SEED: Record<CoverKind, number> = { wood: 3, metal: 5, glass: 7, barrel: 9 };

// Room around the piece (world units) for its cast shadow, dust and smoke
const PAD_X = 66;
const PAD_TOP = 58;
const PAD_BOTTOM = 10;
const SHADOW = { offsetX: 7, offsetY: -3, blur: 5 };

const MIN_RES = 1;
const MAX_RES = 3;

const cache = new Map<string, CoverTexture>();
let users = 0;

/** Pixels per world unit to bake at for a view scaled by `zoom`: zoom × the screen's pixel ratio, in half steps, 1 to 3. */
export const coverResolution = (zoom: number): number => {
    const ratio = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
    const wanted = Math.ceil(zoom * ratio * 2) / 2; // half steps: a window being resized does not rebake every frame
    return Math.min(MAX_RES, Math.max(MIN_RES, Number.isFinite(wanted) ? wanted : MIN_RES));
};

const bake = (kind: CoverKind, stage: CoverStage, res: number): CoverTexture => {
    const { w, h } = COVER_SPECS[kind], seed = SEED[kind];
    const width = w + PAD_X * 2, height = h + PAD_TOP + PAD_BOTTOM;
    const art = makeCanvas(width, height, res);
    art.ctx.translate(PAD_X + w / 2, PAD_TOP + h);
    DRAW[kind](art.ctx, 0, 0, stage, seed);
    const glass = kind === 'glass';
    overlayNoise(art.ctx, glass ? 40 : 10, 31 + seed, glass ? 0.12 : 0.35);
    // The shadow is cast by drawing onto a second canvas; whole pieces cast it, the remains do not
    const out = makeCanvas(width, height);
    out.canvas.width = art.canvas.width;
    out.canvas.height = art.canvas.height;
    out.ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (stage < 3) {
        out.ctx.shadowColor = glass ? 'rgba(0,0,0,.22)' : 'rgba(0,0,0,.5)';
        out.ctx.shadowBlur = SHADOW.blur * res;
        out.ctx.shadowOffsetX = SHADOW.offsetX * res;
        out.ctx.shadowOffsetY = SHADOW.offsetY * res;
    }
    out.ctx.drawImage(art.canvas, 0, 0);
    return { texture: Texture.from(out.canvas, true), anchorX: (PAD_X + w / 2) / width, anchorY: (PAD_TOP + h) / height };
};

/**
 * The picture of a piece of cover at a damage stage (3 = its remains), baked on first use. Drawn at
 * 1/res of its pixel size it measures (w + 132) × (h + 68) world units; anchor it on the piece's feet.
 */
export const coverTexture = (kind: CoverKind, stage: CoverStage, res: number): CoverTexture => {
    const key = `${kind}:${stage}:${res}`;
    let baked = cache.get(key);
    if (!baked) {
        baked = bake(kind, stage, res);
        cache.set(key, baked);
    }
    return baked;
};

/** Free every baked picture and forget the views that retained them (tests; teardown uses release). */
export const destroyCoverTextures = (): void => {
    for (const { texture } of cache.values()) texture.destroy(true);
    cache.clear();
    users = 0;
};

/** A view starts using the baked pictures: they stay alive until every view that retained them has released. */
export const retainCoverTextures = (): void => {
    users++;
};

/** A view is done with the pictures; the last release frees them (the next view bakes again). */
export const releaseCoverTextures = (): void => {
    users = Math.max(0, users - 1);
    if (users === 0) destroyCoverTextures();
};

import { Container, Graphics, Sprite } from 'pixi.js';
import type { Platform, Vector2 } from '../../../types';
import { LAST_STOP_MATERIALS, LAST_STOP_ART_HEIGHT, LAST_STOP_WIDTH } from '../../data/lastStop/layout';
import type { MapScene } from './themedScene';
import { makeCanvas } from './canvasKit';
import { bakedTexture, bakeScene, BakedTextures } from './bakedTextures';
import { loadLastStopArt } from './lastStop/artAssets';
import { paintLastStopWorld } from './lastStop/paintWorld';

const TILE_WIDTH = 1200;

export const createLastStopScene = (world: Container, backdropIndex: number, platforms: Platform[]): MapScene => {
    const backdrop = new Container({ label: 'last-stop-backdrop' });
    const base = new Graphics().rect(0, 0, LAST_STOP_WIDTH, LAST_STOP_ART_HEIGHT).fill(0x453746);
    backdrop.addChild(base);
    world.addChildAt(backdrop, backdropIndex);

    for (const p of platforms) {
        if (p.color === LAST_STOP_MATERIALS.boundary) continue;
        base.rect(p.x, p.y, p.w, p.h).fill(p.color);
    }

    let textures: BakedTextures | undefined;
    let disposed = false;
    loadLastStopArt().then(art => {
        if (disposed) return;
        const baked = bakeScene(() => {
            const tiles: Sprite[] = [];
            for (let left = 0; left < LAST_STOP_WIDTH; left += TILE_WIDTH) {
                const { canvas, ctx } = makeCanvas(Math.min(TILE_WIDTH, LAST_STOP_WIDTH - left), LAST_STOP_ART_HEIGHT);
                ctx.translate(-left, 0);
                paintLastStopWorld(ctx, art, platforms);
                const sprite = new Sprite(bakedTexture(canvas));
                sprite.x = left;
                tiles.push(sprite);
            }
            return tiles;
        });
        textures = baked.textures;
        backdrop.addChild(...baked.result);
        base.visible = false;
    }).catch((error: unknown) => {
        if (!disposed) console.error('Could not draw the Last Stop artwork. Showing the map surfaces.', error);
    });

    return {
        adPlaces: [],
        layerOrigin: () => ({ x: 0, y: 0 }),
        midSolidsIn: () => [],
        update: () => {},
        destroy() {
            disposed = true;
            backdrop.destroy({ children: true });
            textures?.release();
        },
    };
};

export const clampLastStopCamera = (camera: Vector2, view: { w: number; h: number }) => {
    const halfX = Math.min(view.w, LAST_STOP_WIDTH) / 2;
    const halfY = Math.min(view.h, LAST_STOP_ART_HEIGHT) / 2;
    camera.x = Math.max(halfX, Math.min(LAST_STOP_WIDTH - halfX, camera.x));
    camera.y = Math.max(halfY, Math.min(LAST_STOP_ART_HEIGHT - halfY, camera.y));
};

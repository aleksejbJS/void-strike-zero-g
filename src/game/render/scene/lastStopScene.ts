import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { assetUrl } from '../../../assetUrl';
import type { Platform, Vector2 } from '../../../types';
import { LAST_STOP_MATERIALS, LAST_STOP_PLATE_HEIGHT, LAST_STOP_WIDTH } from '../../data/lastStop/layout';
import type { MapScene } from './themedScene';

export const lastStopArtUrl = assetUrl('assets/maps/last-stop.webp');

const edgeTint = (platform: Platform): number => {
    if (platform.color === LAST_STOP_MATERIALS.steel) return 0xe6b152;
    if (platform.color === LAST_STOP_MATERIALS.roof) return 0xcf8452;
    return 0xbc9168;
};

// Shared borders between adjacent pieces are buried in the scenery.
const exposedTop = (platform: Platform, platforms: Platform[]): [number, number][] => {
    const blockers = platforms.filter(other => other.y < platform.y && other.y + other.h >= platform.y);
    let runs: [number, number][] = [[platform.x, platform.x + platform.w]];
    for (const blocker of blockers) {
        const left = blocker.x;
        const right = blocker.x + blocker.w;
        runs = runs.flatMap(([start, end]): [number, number][] => {
            if (left >= end || right <= start) return [[start, end]];
            const remaining: [number, number][] = [];
            if (left > start) remaining.push([start, left]);
            if (right < end) remaining.push([right, end]);
            return remaining;
        });
    }
    return runs;
};

export const createLastStopScene = (
    world: Container, backdropIndex: number, platformHost: Container, platforms: Platform[],
): MapScene => {
    const backdrop = new Container({ label: 'last-stop-backdrop' });
    const base = new Graphics().rect(0, 0, LAST_STOP_WIDTH, LAST_STOP_PLATE_HEIGHT).fill(0x44302e);
    const edges = new Graphics();
    backdrop.addChild(base);
    world.addChildAt(backdrop, backdropIndex);
    platformHost.addChild(edges);

    for (const p of platforms) {
        if (p.color === LAST_STOP_MATERIALS.boundary) continue;
        base.rect(p.x, p.y, p.w, p.h).fill(p.color);
        edges.rect(p.x, p.y, p.w, p.h).fill({ color: p.color, alpha: 0.1 });
        for (const [left, right] of exposedTop(p, platforms)) {
            edges.moveTo(left, p.y + 2).lineTo(right, p.y + 2)
                .stroke({ color: edgeTint(p), width: 4, alpha: 0.75 });
        }
    }

    const image = new Image();
    let texture: Texture | undefined;
    image.onload = () => {
        try {
            texture = Texture.from(image, true);
            const plate = new Sprite(texture);
            plate.tint = 0xf1e6dc;
            plate.width = LAST_STOP_WIDTH;
            plate.height = LAST_STOP_PLATE_HEIGHT;
            backdrop.addChild(plate);
        } catch (error) {
            console.error('Could not draw the Last Stop map. Showing collision surfaces.', error);
        }
    };
    image.onerror = () => console.error('Could not load the Last Stop map. Showing collision surfaces.');
    image.src = lastStopArtUrl;

    return {
        adPlaces: [],
        layerOrigin: () => ({ x: 0, y: 0 }),
        midSolidsIn: () => [],
        update: () => {},
        destroy() {
            image.onload = null;
            image.onerror = null;
            backdrop.destroy({ children: true });
            edges.destroy();
            texture?.destroy(true);
        },
    };
};

export const clampLastStopCamera = (camera: Vector2, view: { w: number; h: number }) => {
    const halfX = Math.min(view.w, LAST_STOP_WIDTH) / 2;
    const halfY = Math.min(view.h, LAST_STOP_PLATE_HEIGHT) / 2;
    camera.x = Math.max(halfX, Math.min(LAST_STOP_WIDTH - halfX, camera.x));
    camera.y = Math.max(halfY, Math.min(LAST_STOP_PLATE_HEIGHT - halfY, camera.y));
};

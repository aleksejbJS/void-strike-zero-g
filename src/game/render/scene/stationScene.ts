// The station map look: parallax backdrop (stars, planet, hull wall with windows, girders),
// baked platform art, lamps and beacons, in-world ad places and a vignette with grain.
// Built once per map; update() runs every frame and only moves and animates things.

import { Container, Sprite, TilingSprite } from 'pixi.js';
import { Platform, Vector2 } from '../../../types';
import { bakeContainer, bakeMidTile, bakePlanet, bakeStarTile, bakeWallTile } from './stationBackdrop';
import { bakePlatform } from './stationPlatforms';
import { buildBeacons, buildLamps, buildPostFx, updateBeacons, updateLamps } from './stationLights';
import { AdLayer, BACKDROP_CONTAINERS, LAYER_DEPTH, STATION_AD_PLACES } from './adPlaces';
import { AdPlaceView, buildAdPlace, updateAdPlace } from './adFrames';
import { bakedTexture, releaseBakedTextures } from './bakedTextures';

const STAR_DEPTH = 0.08;
const PLANET_DEPTH = 0.05;
const PLANET_AT = { x: 520, y: -380 };

export interface SceneHosts {
    stage: Container;        // screen-space root (app.stage)
    world: Container;        // camera-space container
    platformHost: Container; // inside world, behind the fighters
}

export interface MapScene {
    update(camera: Vector2, now: number, screenW: number, screenH: number): void;
    destroy(): void;
    adPlaces: AdPlaceView[];
    /** Screen position of a parallax layer's origin for the current camera (used by the ad overlay). */
    layerOrigin(layer: AdLayer, camera: Vector2, screenW: number, screenH: number): Vector2;
}

const tiling = (canvas: HTMLCanvasElement) => new TilingSprite({ texture: bakedTexture(canvas), width: 1, height: 1 });

const deckRes = (p: Platform) => (p.h < 100 && p.w <= 1200 ? Math.min(window.devicePixelRatio || 1, 2) : 1);

export const createStationScene = (hosts: SceneHosts, platforms: Platform[]): MapScene => {
    // Backdrop, behind the camera-space world
    const backdrop = new Container();
    const stars = tiling(bakeStarTile());
    const planet = new Sprite(bakedTexture(bakePlanet()));
    const wall = tiling(bakeWallTile());
    const wallDecor = new Container();
    const mid = tiling(bakeMidTile());
    const midDecor = new Container();
    backdrop.addChild(stars, planet, wall, wallDecor, mid, midDecor);
    hosts.stage.addChildAt(backdrop, 0);

    // Background cargo next to the ad sticker, and a second stack further along
    BACKDROP_CONTAINERS.forEach(([x, y, w, h, color, label]) => {
        const s = new Sprite(bakedTexture(bakeContainer(w, h, color, label)));
        s.position.set(x, y);
        midDecor.addChild(s);
    });
    const beacons = buildBeacons(midDecor, [[717, 150], [1837, 150]]);

    const adPlaces = STATION_AD_PLACES.map(buildAdPlace);
    adPlaces.forEach(v => (v.place.layer === 'wall' ? wallDecor : midDecor).addChild(v.root));

    // Platform art and lamps, in world space
    const art = new Container();
    platforms.forEach((p, i) => {
        const res = deckRes(p);
        bakePlatform(p, 40 + i * 9, res).forEach(piece => {
            const s = new Sprite(bakedTexture(piece.canvas));
            s.position.set(piece.x, piece.y);
            s.scale.set(1 / res);
            art.addChild(s);
        });
    });
    const lampLayer = new Container();
    const lamps = buildLamps(platforms, lampLayer);
    hosts.platformHost.addChild(art, lampLayer);

    const post = buildPostFx();
    hosts.stage.addChildAt(post.root, hosts.stage.getChildIndex(hosts.world) + 1);

    let lastW = 0, lastH = 0;
    const layerOrigin = (layer: AdLayer, camera: Vector2, w: number, h: number) => {
        const k = LAYER_DEPTH[layer];
        return { x: w / 2 - camera.x * k, y: h / 2 - camera.y * k };
    };

    return {
        adPlaces,
        layerOrigin,
        update(camera, now, w, h) {
            if (w !== lastW || h !== lastH) {
                [stars, wall, mid].forEach(t => { t.width = w; t.height = h; });
                post.resize(w, h);
                lastW = w; lastH = h;
            }
            const t = now / 1000;
            stars.tilePosition.set(w / 2 - camera.x * STAR_DEPTH, h / 2 - camera.y * STAR_DEPTH);
            planet.position.set(w / 2 - camera.x * PLANET_DEPTH + PLANET_AT.x, h / 2 - camera.y * PLANET_DEPTH + PLANET_AT.y);
            const wo = layerOrigin('wall', camera, w, h), mo = layerOrigin('mid', camera, w, h);
            wall.tilePosition.set(wo.x, wo.y); wallDecor.position.set(wo.x, wo.y);
            mid.tilePosition.set(mo.x, mo.y); midDecor.position.set(mo.x, mo.y);
            updateLamps(lamps, t);
            updateBeacons(beacons, t);
            adPlaces.forEach(v => updateAdPlace(v, now));
            post.update(t);
        },
        destroy() {
            [backdrop, post.root, art, lampLayer].forEach(c => { c.parent?.removeChild(c); c.destroy({ children: true }); });
            releaseBakedTextures();
        },
    };
};

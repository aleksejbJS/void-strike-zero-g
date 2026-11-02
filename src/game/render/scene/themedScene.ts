// A themed map look: parallax backdrop (far tile, hero object, back wall, mid layer with decor),
// baked platform art, lights, in-world ad places, vignette and grain. The theme (station, mine,
// arena) supplies the art; this builds it once per map and update() only moves and animates.

import { Container, Sprite, TilingSprite } from 'pixi.js';
import { Platform, Vector2 } from '../../../types';
import { buildBeacons, buildLamps, buildPostFx, buildSpotlights, updateBeacons, updateLamps, updateSpotlights } from './stationLights';
import { AdLayer, LAYER_DEPTH, Rect, tiledRectsIn } from './adPlaces';
import { AdPlaceView, buildAdPlace, updateAdPlace } from './adFrames';
import { bakedTexture, bakeScene } from './bakedTextures';
import { SceneTheme } from './sceneTheme';

const FAR_DEPTH = 0.08;
const HERO_DEPTH = 0.05;

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
    /** Mid-layer girders and pipes in front of a wall place, in screen space. */
    midSolidsIn(target: Rect, camera: Vector2, screenW: number, screenH: number): Rect[];
}

const tiling = (canvas: HTMLCanvasElement) => new TilingSprite({ texture: bakedTexture(canvas), width: 1, height: 1 });

const deckRes = (p: Platform) => (p.h < 100 && p.w <= 1200 ? Math.min(window.devicePixelRatio || 1, 2) : 1);

export interface SceneOptions {
    /** Build the theme's in-world ad places (off for the menu's mode preview). */
    ads?: boolean;
}

export const createThemedScene = (hosts: SceneHosts, platforms: Platform[], theme: SceneTheme, options: SceneOptions = {}): MapScene => {
    const { result, textures } = bakeScene(() => buildThemedScene(hosts, platforms, theme, options.ads ?? true));
    return {
        ...result,
        destroy() {
            result.destroy();
            textures.release();
        },
    };
};

const buildThemedScene = (hosts: SceneHosts, platforms: Platform[], theme: SceneTheme, withAds: boolean): MapScene => {
    // Backdrop, behind the camera-space world
    const backdrop = new Container();
    const far = tiling(theme.far());
    const hero = theme.hero ? new Sprite(bakedTexture(theme.hero.bake())) : null;
    const wall = tiling(theme.wall());
    const wallDecor = new Container();
    const mid = tiling(theme.mid());
    const midDecor = new Container();
    backdrop.addChild(far, ...(hero ? [hero] : []), wall, wallDecor, mid, midDecor);
    hosts.stage.addChildAt(backdrop, 0);

    theme.decor.forEach(d => {
        const s = new Sprite(bakedTexture(d.bake()));
        s.position.set(d.x, d.y);
        (d.layer === 'wall' ? wallDecor : midDecor).addChild(s);
    });
    const beacons = buildBeacons(midDecor, theme.beacons ?? []);
    const spotlights = buildSpotlights(midDecor, theme.spotlights ?? []);

    const adPlaces = withAds ? theme.adPlaces.map(buildAdPlace) : [];
    adPlaces.forEach(v => (v.place.layer === 'wall' ? wallDecor : midDecor).addChild(v.root));

    // Platform art and lamps, in world space
    const art = new Container();
    platforms.forEach((p, i) => {
        const res = deckRes(p);
        theme.platform(p, 40 + i * 9, res).forEach(piece => {
            const s = new Sprite(bakedTexture(piece.canvas));
            s.position.set(piece.x, piece.y);
            s.scale.set(1 / res);
            art.addChild(s);
        });
    });
    const lampLayer = new Container();
    const lamps = theme.lamps ? buildLamps(platforms, lampLayer, theme.lamps.color) : [];
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
        midSolidsIn: (target, camera, w, h) => (theme.midOccluders ? tiledRectsIn(theme.midOccluders, layerOrigin('mid', camera, w, h), target) : []),
        update(camera, now, w, h) {
            if (w !== lastW || h !== lastH) {
                [far, wall, mid].forEach(t => { t.width = w; t.height = h; });
                post.resize(w, h);
                lastW = w; lastH = h;
            }
            const t = now / 1000;
            far.tilePosition.set(w / 2 - camera.x * FAR_DEPTH, h / 2 - camera.y * FAR_DEPTH);
            if (hero && theme.hero) hero.position.set(w / 2 - camera.x * HERO_DEPTH + theme.hero.at.x, h / 2 - camera.y * HERO_DEPTH + theme.hero.at.y);
            const wo = layerOrigin('wall', camera, w, h), mo = layerOrigin('mid', camera, w, h);
            wall.tilePosition.set(wo.x, wo.y); wallDecor.position.set(wo.x, wo.y);
            mid.tilePosition.set(mo.x, mo.y); midDecor.position.set(mo.x, mo.y);
            updateLamps(lamps, t);
            updateBeacons(beacons, t);
            updateSpotlights(spotlights, t);
            adPlaces.forEach(v => updateAdPlace(v, now));
            post.update(t);
        },
        destroy() {
            [backdrop, post.root, art, lampLayer].forEach(c => { c.parent?.removeChild(c); c.destroy({ children: true }); });
        },
    };
};

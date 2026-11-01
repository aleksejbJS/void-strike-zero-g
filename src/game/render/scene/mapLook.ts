// Picks how a map is drawn: the station scene, or the old flat look for maps that do not
// have their own theme yet (Tunnels, Hunger Games arena).

import { Container, Graphics } from 'pixi.js';
import { GameMode, GameState, MapId, Vector2 } from '../../../types';
import { drawBackground, drawStaticMap } from '../../systems/renderer';
import { createStationScene, MapScene, SceneHosts } from './stationScene';

export type MapTheme = 'station' | 'legacy';

export const themeFor = (mode: GameMode, map: MapId): MapTheme =>
    mode === GameMode.HUNGER_GAMES || map === MapId.TUNNELS ? 'legacy' : 'station';

interface LegacyLayers {
    platformLayer: Graphics;
    backgroundLayer: Graphics;
    cache: unknown;
}

export interface MapLook {
    /** Rebuild for the state's map (new match, new round, joined a server). */
    redraw(state: GameState, screenW: number, screenH: number): void;
    /** Item/tile textures finished loading: the old look draws tunnel tiles with them. */
    texturesReady(state: GameState): void;
    update(camera: Vector2, now: number, screenW: number, screenH: number): void;
    readonly scene: MapScene | null;
    destroy(): void;
}

export const createMapLook = (hosts: Omit<SceneHosts, 'platformHost'>, world: Container, legacy: LegacyLayers): MapLook => {
    // Station platform art sits right above the old platform layer, behind the fighters
    const platformHost = new Container();
    world.addChildAt(platformHost, world.getChildIndex(legacy.platformLayer) + 1);
    let scene: MapScene | null = null;

    const drawLegacy = (state: GameState, w: number, h: number) => {
        drawStaticMap(legacy.platformLayer, state.platforms, state.currentMap, legacy.cache);
        drawBackground(legacy.backgroundLayer, w, h);
    };

    return {
        get scene() { return scene; },
        redraw(state, w, h) {
            scene?.destroy();
            scene = null;
            legacy.platformLayer.clear();
            legacy.backgroundLayer.clear();
            if (themeFor(state.mode, state.currentMap) === 'station') {
                scene = createStationScene({ ...hosts, platformHost }, state.platforms);
                scene.update(state.camera, Date.now(), w, h);
            } else {
                drawLegacy(state, w, h);
            }
        },
        texturesReady(state) {
            if (!scene) drawStaticMap(legacy.platformLayer, state.platforms, state.currentMap, legacy.cache);
        },
        update(camera, now, w, h) {
            scene?.update(camera, now, w, h);
        },
        destroy() {
            scene?.destroy();
            scene = null;
            platformHost.parent?.removeChild(platformHost);
            platformHost.destroy({ children: true });
        },
    };
};

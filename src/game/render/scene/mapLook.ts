// Picks how a map is drawn: the station (default map), the asteroid mine (Tunnels), the
// show arena (Hunger Games) or The Pit (tournament duels).

import { Container, Graphics } from 'pixi.js';
import { GameMode, GameState, MapId, Vector2 } from '../../../types';
import { drawBackground, drawStaticMap } from '../../systems/renderer';
import { createThemedScene, MapScene, SceneHosts, SceneOptions } from './themedScene';
import { SceneTheme } from './sceneTheme';
import { stationTheme } from './themes/stationTheme';
import { mineTheme } from './themes/mineTheme';
import { arenaTheme } from './themes/arenaTheme';
import { pitTheme } from './themes/pitTheme';

export type MapTheme = 'station' | 'mine' | 'arena' | 'pit';

export const themeFor = (mode: GameMode, map: MapId): MapTheme =>
    mode === GameMode.DUEL ? 'pit' : mode === GameMode.HUNGER_GAMES ? 'arena' : map === MapId.TUNNELS ? 'mine' : 'station';

const THEMES: Record<MapTheme, () => SceneTheme> = { station: stationTheme, mine: mineTheme, arena: arenaTheme, pit: pitTheme };

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

export const createMapLook = (
    hosts: Omit<SceneHosts, 'platformHost'>, world: Container, legacy: LegacyLayers,
    onRedraw: (scene: MapScene | null) => void = () => {},
    sceneOptions: SceneOptions = {},
): MapLook => {
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
            try {
                scene = createThemedScene({ ...hosts, platformHost }, state.platforms, THEMES[themeFor(state.mode, state.currentMap)](), sceneOptions);
                scene.update(state.camera, Date.now(), w, h);
            } catch (err) {
                // Never leave the player without a map: fall back to the plain look
                console.error('Map art failed to build, using the plain look:', err);
                scene?.destroy();
                scene = null;
                drawLegacy(state, w, h);
            }
            onRedraw(scene);
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

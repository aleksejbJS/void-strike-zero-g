// Connects ads to the game: loads ads.json once, puts the banner overlay on the current
// map scene (if it has ad places) and feeds it the camera and the fight every frame.

import { GameState } from '../../types';
import { AdConfig, loadAdConfig } from './adConfig';
import { AdOverlay, createAdOverlay } from './adOverlay';
import { ScreenRect } from './adVisibility';
import { MapScene } from '../render/scene/themedScene';
import { setHouseHidden } from '../render/scene/adFrames';
import { AdPlace } from '../render/scene/adPlaces';

const FIGHTER_BOX = { w: 44, h: 80 };
const SHOT_BOX = 24;

/** Fighters and shots on screen: the banner behind them steps back so the fight stays readable. */
export const fightBlockers = (state: GameState, screenW: number, screenH: number): ScreenRect[] => {
    const ox = screenW / 2 - state.camera.x, oy = screenH / 2 - state.camera.y;
    const fighters = state.players.filter(p => !p.dead).map(p => ({ x: p.pos.x - FIGHTER_BOX.w / 2 + ox, y: p.pos.y - FIGHTER_BOX.h + oy, w: FIGHTER_BOX.w, h: FIGHTER_BOX.h }));
    const shots = state.projectiles.map(p => ({ x: p.pos.x - SHOT_BOX / 2 + ox, y: p.pos.y - SHOT_BOX / 2 + oy, w: SHOT_BOX, h: SHOT_BOX }));
    return [...fighters, ...shots];
};

/** Platforms in screen space: they stand in front of every ad place. */
export const solidRects = (state: GameState, screenW: number, screenH: number): ScreenRect[] => {
    const ox = screenW / 2 - state.camera.x, oy = screenH / 2 - state.camera.y;
    return state.platforms.map(p => ({ x: p.x + ox, y: p.y + oy, w: p.w, h: p.h }));
};

export interface AdsController {
    attach(scene: MapScene | null): void;
    /** `screenW`/`screenH`: the virtual screen (render/viewport); `zoom` scales it to the window. */
    update(state: GameState, now: number, screenW: number, screenH: number, zoom?: number): void;
    destroy(): void;
}

export const createAdsController = (host: HTMLElement, configUrl: string): AdsController => {
    let config: AdConfig | null = null;
    let scene: MapScene | null = null;
    let overlay: AdOverlay | null = null;
    let destroyed = false;

    const rebuild = () => {
        overlay?.destroy();
        overlay = config && scene && scene.adPlaces.length > 0
            ? createAdOverlay(host, scene.adPlaces.map(v => v.place), config)
            : null;
    };

    loadAdConfig(configUrl).then(c => {
        if (destroyed) return;
        config = c;
        rebuild();
    });

    return {
        attach(next) { scene = next; rebuild(); },
        update(state, now, w, h, zoom = 1) {
            if (!overlay || !scene) return;
            const platforms = solidRects(state, w, h);
            const current = scene;
            const solidsFor = (place: AdPlace, rect: ScreenRect) =>
                place.layer === 'wall' ? [...platforms, ...current.midSolidsIn(rect, state.camera, w, h)] : platforms;
            const showing = overlay.update(state.camera, fightBlockers(state, w, h), solidsFor, now, w, h, zoom);
            scene.adPlaces.forEach(v => setHouseHidden(v, showing.has(v.place.id)));
        },
        destroy() {
            destroyed = true;
            overlay?.destroy();
            overlay = null;
        },
    };
};

// One watched match drawn into its own Pixi canvas inside `host`: the same layers, map look and
// fighters as the game screen, but nobody's HUD or cursor, no scorch marks (marks.ts is one
// page-wide list, the game screen's) and in-world ads only while switched on. Its fighters are
// animated with its own memory (matchViewCache), never shared with other tiles or the game screen.

import { Application, Container, Graphics, Texture } from 'pixi.js';
import { GameMode, GameState, MapId } from '../../../types';
import { generateAssets } from '../../systems/assets';
import { drawZoneOverlay, syncVisuals } from '../../systems/renderer';
import { createMapLook } from '../scene/mapLook';
import { setHouseHidden } from '../scene/adFrames';
import { createAdsController, AdsController } from '../../ads/adsController';
import { destroyApp } from '../pixiApp';
import { viewportOf } from '../viewport';
import { destroyCoverTextures } from '../cover/coverTextures';
import { newVisualCache } from './matchViewCache';

export interface MatchView {
    render(state: GameState, now: number): void;
    setAdsEnabled(on: boolean): void;
    destroy(): void;
}

// A spectator controls no fighter: this id matches nobody, so no HUD is fed and every fighter
// aims where the host says; syncVisuals still wants a pointer, so it gets one off-screen.
const NO_LOCAL_ID = '';
const NO_MOUSE = { x: -1000, y: -1000 };

const adsConfigUrl = () => new URL('ads.json', document.baseURI).href;

export const createMatchView = async (host: HTMLElement): Promise<MatchView> => {
    const app = new Application();
    // No ticker: the tile's own frame loop calls render(), which draws the frame
    await app.init({ resizeTo: host, backgroundColor: 0x020617, antialias: true, autoDensity: true, autoStart: false });
    let textures: Record<string, Texture>;
    try {
        textures = await generateAssets(); // shared cache: never destroyed here
    } catch (err) {
        destroyApp(app);
        throw err;
    }
    host.appendChild(app.canvas);
    // resizeTo only follows window resizes; a tile also grows and shrinks on its own (expand)
    const resizeWatch = new ResizeObserver(() => app.resize());
    resizeWatch.observe(host);

    // Layers, as on the game screen: viewRoot is scaled so every tile shows the same slice of the map
    const viewRoot = new Container();
    app.stage.addChild(viewRoot);
    const world = new Container();
    viewRoot.addChild(world);
    const backgroundLayer = new Graphics();
    const decalLayer = new Container();
    const zoneLayer = new Graphics();
    const platformLayer = new Graphics();
    const gameLayer = new Container();
    world.addChild(backgroundLayer, decalLayer, zoneLayer, platformLayer, gameLayer);
    const uiLayer = new Container();
    uiLayer.visible = false; // only syncVisuals' cursor lands here, and a spectator has none
    app.stage.addChild(uiLayer);

    const cache = newVisualCache(textures);
    const shakeRef = { current: 0 }; // nothing shakes a spectator's screen
    let ads: AdsController | null = null;
    const look = createMapLook({ stage: viewRoot, world }, world, { platformLayer, backgroundLayer, cache }, scene => ads?.attach(scene));
    let drawn: { platforms: GameState['platforms']; mode: GameMode; map: MapId } | null = null;
    let destroyed = false;

    const redrawIfNewMap = (state: GameState, w: number, h: number) => {
        if (state.platforms.length === 0) return; // the host has not sent the map yet
        if (drawn && drawn.platforms === state.platforms && drawn.mode === state.mode && drawn.map === state.currentMap) return;
        drawn = { platforms: state.platforms, mode: state.mode, map: state.currentMap };
        look.redraw(state, w, h);
    };

    // Ads that went away leave their house posters hidden: show those again
    const showHousePosters = () => look.scene?.adPlaces.forEach(v => setHouseHidden(v, false));

    return {
        render(state, now) {
            if (destroyed) return;
            const view = viewportOf(app.screen.width, app.screen.height);
            viewRoot.scale.set(view.zoom);
            redrawIfNewMap(state, view.w, view.h);
            if (state.mode === GameMode.HUNGER_GAMES) drawZoneOverlay(zoneLayer, state.hungerZone, now);
            else zoneLayer.clear();
            syncVisuals(view, world, gameLayer, decalLayer, uiLayer, state, cache, shakeRef, NO_MOUSE, null, null, null, null, null, NO_LOCAL_ID);
            look.update(state.camera, now, view.w, view.h);
            ads?.update(state, now, view.w, view.h, view.zoom);
            app.render();
        },
        setAdsEnabled(on) {
            if (destroyed || on === !!ads) return;
            if (on) {
                ads = createAdsController(host, adsConfigUrl());
                ads.attach(look.scene);
            } else {
                ads?.destroy();
                ads = null;
                showHousePosters();
            }
        },
        destroy() {
            if (destroyed) return;
            destroyed = true;
            resizeWatch.disconnect();
            ads?.destroy();
            ads = null;
            look.destroy(); // frees the baked map textures before the app goes away
            // Its fighters' animation memory is its own (cache.animator): nothing page-wide to forget
            cache.projectileView?.clear();
            cache.particleView?.clear();
            cache.beamView?.clear();
            cache.smokeView?.clear();
            cache.coverView?.clear();
            destroyCoverTextures(); // baked pictures are page-wide; a view still showing one rebakes it on its next frame
            destroyApp(app); // never app.destroy(true): other canvases share Pixi's batch pool
        },
    };
};

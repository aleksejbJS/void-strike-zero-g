// The one Pixi application behind every mode preview, kept for the whole page life: clicking
// through modes swaps the scene on its stage instead of creating a WebGL context per click
// (slow, and browsers drop the oldest contexts past ~16). The ticker stops while no preview
// is on screen. Renderers that do get destroyed rely on batchPoolFix (see pixiApp).

import { Application } from 'pixi.js';
import { STAGE_H, STAGE_W } from './previewWorld';

let shared: Promise<Application> | null = null;

const create = async () => {
    const app = new Application();
    await app.init({
        width: STAGE_W, height: STAGE_H, backgroundColor: 0x0b0e12, antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true, autoStart: false,
    });
    app.canvas.style.width = '100%';
    app.canvas.style.height = '100%';
    return app;
};

/** The preview application; created on first use. A failed start is retried next time. */
export const previewApp = (): Promise<Application> => {
    shared ??= create().catch(err => {
        shared = null;
        throw err;
    });
    return shared;
};

/** Empties the stage for the next scene: display objects and their drawings go, textures stay. */
export const clearPreviewStage = (app: Application) => {
    app.stage.removeChildren().forEach(c => c.destroy({ children: true, context: true }));
};

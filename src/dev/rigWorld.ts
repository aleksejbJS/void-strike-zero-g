// Standalone motion inspection; no game state or saved settings are modified.
import { Application, Container, Graphics } from 'pixi.js';
import { PHYSICS_TICK_RATE } from '../constants';
import { generateAssets } from '../game/systems/assets';
import { FixedStepper } from '../game/systems/fixedStep';
import { destroyApp } from '../game/render/pixiApp';
import { createDemoActors, drawDemoActor, RIG_GROUND, RIG_HEIGHT, RIG_WIDTH, RIG_ZOOM } from './rigActors';
import { clearDemoCorpses, createDemoCorpses, DemoCorpse, stepDemoCorpses } from './rigCorpses';

export type RigDemoMode = 'source' | 'idle' | 'run' | 'jump' | 'fly' | 'crouch' | 'prone' | 'hurt' | 'fall-body' | 'gib' | 'cut' | 'limb';
export interface RigWorld { mode: (mode: RigDemoMode) => void; turn: () => void; pause: () => boolean; destroy: () => void }

export const mountRigWorld = async (host: HTMLElement): Promise<RigWorld> => {
    const app = new Application();
    await app.init({ width: RIG_WIDTH, height: RIG_HEIGHT, backgroundColor: 0x11171c, antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true, autoStart: false });
    try {
        const textures = await generateAssets();
        const humanOnly = new URLSearchParams(window.location.search).get('body') === 'human';
        const zoom = humanOnly ? 4.8 : RIG_ZOOM;
        const world = new Container();
        world.scale.set(zoom);
        world.position.y = RIG_GROUND * (RIG_ZOOM - zoom);
        app.stage.addChild(world);
        const ground = [{ id: 'inspection-ground', x: -500, y: RIG_GROUND, w: 1500, h: 100, color: '#283139' }];
        const floor = new Graphics();
        floor.rect(-500, RIG_GROUND, 1500, 100).fill(0x283139);
        floor.moveTo(-500, RIG_GROUND).lineTo(1000, RIG_GROUND).stroke({ width: 1, color: 0xb88e4b });
        world.addChild(floor);
        const actors = createDemoActors(world, humanOnly, zoom);
        let mode: RigDemoMode = 'source', facing: 1 | -1 = 1, paused = false, time = 0;
        const corpses: DemoCorpse[] = [], stepper = new FixedStepper();
        const reset = () => {
            clearDemoCorpses(corpses);
            time = 0;
            if (['fall-body', 'gib', 'cut', 'limb'].includes(mode)) {
                corpses.push(...createDemoCorpses(actors, mode, facing, world, textures));
            }
        };
        const tick = () => {
            if (!paused) stepper.advance(app.ticker.deltaMS, () => {
                time += 1 / PHYSICS_TICK_RATE;
                stepDemoCorpses(corpses, ground);
            });
            const detached = ['fall-body', 'gib', 'cut'].includes(mode);
            for (const actor of actors) {
                actor.root.visible = !detached;
                drawDemoActor(actor, mode === 'limb' ? 'idle' : mode, time, facing, textures, mode === 'limb');
            }
            host.dataset.mode = mode;
            host.dataset.time = String(time);
        };
        app.ticker.add(tick);
        host.replaceChildren(app.canvas);
        app.ticker.start();
        return {
            mode: next => { mode = next; reset(); },
            turn: () => { facing = facing === 1 ? -1 : 1; reset(); },
            pause: () => (paused = !paused),
            destroy: () => { clearDemoCorpses(corpses); destroyApp(app); },
        };
    } catch (error) {
        destroyApp(app);
        throw error;
    }
};

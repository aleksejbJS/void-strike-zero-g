// The smoke's one-time costs, paid on the first frame of a game view instead of the frame the first smoke round
// bursts or the flame first leaves soot: the browser compiling the smoke shader (on the first draw of a quad), Pixi
// building the shader's program data, and the JavaScript engine compiling and optimising the air solver (its first
// steps run several times slower). SmokeWarmup builds a throwaway cloud and soot plume far outside any map, stirs and
// steps them, and keeps their quads drawn for one frame; the caller destroys it on the next frame. Visual only.

import { Container } from 'pixi.js';
import type { SmokeCloud } from '../../../types';
import { SMOKE_RADIUS } from '../../systems/smoke';
import type { Stir } from './airGrid';
import { CloudEntry } from './cloudEntry';
import { SootPlume } from './sootPlume';
import type { SolidSource } from './solidTracker';
import { GRID_N, IMPULSE_DT, PLUME_CAP, STEP_HZ, type SmokeQuality } from './smokeTuning';

const FAR = -100_000;                           // world px: the warm quads sit far outside any map, so nothing shows
const WARM_STEPS = 8;                           // steps the first warm-up of the page runs: enough for the engine to optimise the solver
const STEP_MS = 1000 / STEP_HZ;
const NO_SOLIDS: SolidSource = { platforms: [], cover: [] };

// What the game throws at the air: a shot, a blast and a flame, each taking a different branch of AirGrid.stir
const WARM_STIRS: readonly Stir[] = [
    { x: FAR - 40, y: FAR, r: 10, vx: 480, vy: 0, rate: 40, carve: 15, dt: IMPULSE_DT },
    { x: FAR, y: FAR, r: 70, vx: 950, vy: 0, radial: true, rate: 60, heat: 55, carve: 40, dt: IMPULSE_DT },
    { x: FAR + 30, y: FAR + 10, r: 30, vx: 520, vy: -40, rate: 27, heat: 30, soot: 7, carve: 9, dt: IMPULSE_DT },
];

let pageWarm = false;                           // the engine has optimised the solver already: later warm-ups only draw

export class SmokeWarmup {
    readonly layer = new Container();
    private readonly cloud: CloudEntry;
    private readonly plume: SootPlume | null;
    private destroyed = false;

    /** Build, stir, step and draw a cloud (and a plume, on a quality that has them) of the given quality at `now` (ms). */
    constructor(quality: SmokeQuality, now: number) {
        const smoke: SmokeCloud = { id: 'smoke-warmup', pos: { x: FAR, y: FAR }, radius: SMOKE_RADIUS, bornAt: now - 1000, endsAt: now + 60_000 };
        const n = GRID_N[quality], steps = pageWarm ? 1 : WARM_STEPS;
        pageWarm = true;
        this.cloud = new CloudEntry(smoke, n, now, NO_SOLIDS);
        try {
            this.plume = PLUME_CAP[quality] > 0 ? new SootPlume(FAR, FAR, Math.ceil(n / 2), now, NO_SOLIDS) : null;
        } catch (err) {
            this.cloud.destroy();                   // the caller reports the error; nothing built is left behind
            throw err;
        }
        for (let k = 1; k <= steps; k++) {
            const at = now + k * STEP_MS;
            this.cloud.queueStirs(WARM_STIRS);
            this.cloud.advance(at, true, NO_SOLIDS);
            this.plume?.add(FAR, FAR, IMPULSE_DT, at);
            this.plume?.queueStirs(WARM_STIRS);
            this.plume?.advance(at, true, NO_SOLIDS);
        }
        this.cloud.show(now);
        this.plume?.show(now);
        this.layer.addChild(this.cloud.quad.mesh);
        if (this.plume) this.layer.addChild(this.plume.quad.mesh);
    }

    /** Free the quads and the layer. Safe to call twice. */
    destroy(): void {
        if (this.destroyed) return;
        this.destroyed = true;
        this.cloud.destroy();
        this.plume?.destroy();
        this.layer.parent?.removeChild(this.layer);
        if (!this.layer.destroyed) this.layer.destroy();
    }
}

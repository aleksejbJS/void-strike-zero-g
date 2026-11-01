// Draws GameState.beams (railgun shots): three additive strokes per beam, a hot white core
// inside a light-blue sheath inside a wide blue glow, all thinning and fading with the beam's
// life. Beams are few and last a fraction of a second, so one Graphics repainted each frame
// serves them all.

import { Container, Graphics } from 'pixi.js';
import { Beam } from '../../../types';
import { keepOnTop } from '../effects/keepOnTop';

// Drawn widest first so the core ends up on top: [colour, width at full life, alpha at full life]
const STROKES: ReadonlyArray<readonly [number, number, number]> = [
    [0x38bdf8, 18, 0.25],
    [0x7dd3fc, 7, 0.7],
    [0xffffff, 2.5, 1],
];

const MIN_WIDTH_SHARE = 0.2; // a fading beam never gets thinner than this share of its full width

const drawBeam = (g: Graphics, b: Beam) => {
    const life = Math.max(0, Math.min(1, b.life));
    for (const [color, width, alpha] of STROKES) {
        g.moveTo(b.start.x, b.start.y)
            .lineTo(b.end.x, b.end.y)
            .stroke({ width: width * (MIN_WIDTH_SHARE + (1 - MIN_WIDTH_SHARE) * life), color, alpha: alpha * life, cap: 'round' });
    }
};

export class BeamView {
    private readonly gfx = new Graphics();
    private drawn = false;

    constructor(private readonly layer: Container) {
        this.gfx.blendMode = 'add';
        this.raise();
    }

    /** Show exactly the given beams. */
    sync(beams: readonly Beam[]): void {
        this.raise();
        if (!beams.length && !this.drawn) return;
        this.gfx.clear();
        for (const b of beams) drawBeam(this.gfx, b);
        this.drawn = beams.length > 0;
    }

    /** Destroy the Graphics; the view is not usable afterwards. */
    clear(): void {
        this.gfx.parent?.removeChild(this.gfx);
        if (!this.gfx.destroyed) this.gfx.destroy();
    }

    // Later additions to the layer (ragdolls, fighters) would otherwise cover the beam
    private raise(): void {
        keepOnTop(this.layer, [this.gfx]);
    }
}

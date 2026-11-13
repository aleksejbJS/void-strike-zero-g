// Light around each flamethrower: a flickering glow at the nozzle, a big one over the middle of the flame
// while it sprays, and the faint pilot light's glow while the weapon is held.

import { Container, Sprite, Texture } from 'pixi.js';
import type { FlameStream } from './flameStream';
import type { FlameColors } from './flamePalettes';
import { GLOW, SCALE } from './flameTuning';
import { applyDraw, destroyLayer, flameSprite } from './spriteKit';

interface GlowSet { nozzle: Sprite; front: Sprite; pilot: Sprite }

export class FlameGlows {
    readonly layer = new Container();
    private readonly sets: (GlowSet | undefined)[] = [];

    constructor(private readonly tex: Texture) {}

    sync(streams: Iterable<FlameStream>, time: number, colors: FlameColors): void {
        const used = new Set<number>();
        const fl = 0.6 + 0.4 * Math.sin(time * 37 + Math.sin(time * 23) * 2.3);
        for (const s of streams) {
            used.add(s.slot);
            const set = this.sets[s.slot] ??= this.makeSet();
            const ca = Math.cos(s.angle), sa = Math.sin(s.angle), pw = s.power, k = GLOW.strength;
            const nozzle = GLOW.nozzle + GLOW.nozzleFlicker * fl;
            applyDraw(set.nozzle, { x: s.x + ca * 14 * SCALE, y: s.y + sa * 14 * SCALE, angle: 0, w: nozzle, h: nozzle, tint: colors.glow, alpha: 0.42 * pw * k }, pw > 0.02);
            const front = GLOW.front + GLOW.frontFlicker * fl;
            const frontAlpha = (0.24 + 0.12 * fl) * pw * k * (s.frontLive ? 1 : 0.4);
            applyDraw(set.front, { x: s.front.x, y: s.front.y, angle: 0, w: front, h: front, tint: colors.glow, alpha: frontAlpha }, pw > 0.02);
            const pilotAlpha = 0.09 + 0.04 * Math.sin(time * 17);
            applyDraw(set.pilot, { x: s.x + ca * 6 * SCALE, y: s.y + sa * 6 * SCALE, angle: 0, w: GLOW.pilot, h: GLOW.pilot, tint: colors.pilotGlow, alpha: pilotAlpha }, s.held);
        }
        this.sets.forEach((set, slot) => {
            if (!set || used.has(slot)) return;
            set.nozzle.visible = set.front.visible = set.pilot.visible = false;
        });
    }

    destroy(): void {
        destroyLayer(this.layer);
        this.sets.length = 0;
    }

    private makeSet(): GlowSet {
        return {
            nozzle: flameSprite(this.layer, this.tex, true),
            front: flameSprite(this.layer, this.tex, true),
            pilot: flameSprite(this.layer, this.tex, true),
        };
    }
}

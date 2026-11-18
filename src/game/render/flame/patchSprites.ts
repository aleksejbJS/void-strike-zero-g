// Sprites of the fires burning in place (splash fire, burning fighters) and of the soot they leave.
// Fire beds, masses and light sit in one layer, the tongue flames in the one above it; soot goes into
// its own layer, which FlameFx puts under the fighters.

import { Container, Sprite } from 'pixi.js';
import type { FirePatches } from './firePatches';
import type { ScorchMarks } from './scorchMarks';
import type { FlameColors } from './flamePalettes';
import type { FlameTextures } from './flameTextures';
import { hidePatchDraws, layoutPatch, newPatchDraws, PatchDraws } from './patchLayout';
import { applyDraw, destroyLayer, flameSprite } from './spriteKit';

interface PatchSet {
    draws: PatchDraws;
    bed: Sprite; lowGlow: Sprite; highGlow: Sprite; mass: Sprite; mass2: Sprite;
    tongues: { outer: Sprite; inner: Sprite }[];
}

const SOOT = 0x0a0806;

export class PatchSprites {
    readonly patchLayer = new Container();
    readonly tongueLayer = new Container();
    readonly markLayer = new Container();
    private readonly sets: (PatchSet | undefined)[] = [];
    private readonly marks: (Sprite | undefined)[] = [];

    constructor(private readonly patches: FirePatches, private readonly soot: ScorchMarks, private readonly tex: FlameTextures) {}

    sync(time: number, colors: FlameColors): void {
        this.patches.items.forEach((q, i) => {
            let set = this.sets[i];
            if (!q.active && !set) return;
            set ??= this.sets[i] = this.makeSet();
            if (q.active) layoutPatch(q, time, colors, set.draws);
            else hidePatchDraws(set.draws);
            const d = set.draws;
            applyDraw(set.lowGlow, d.lowGlow, d.lowGlow.visible);
            applyDraw(set.bed, d.bed, d.bed.visible);
            applyDraw(set.mass, d.mass, d.mass.visible);
            applyDraw(set.mass2, d.mass2, d.mass2.visible);
            applyDraw(set.highGlow, d.highGlow, d.highGlow.visible);
            set.tongues.forEach((t, k) => {
                applyDraw(t.outer, d.tongues[k].outer, d.tongues[k].outer.visible);
                applyDraw(t.inner, d.tongues[k].inner, d.tongues[k].inner.visible);
            });
        });
        this.soot.items.forEach((m, i) => {
            let s = this.marks[i];
            if (!m.active && !s) return;
            s ??= this.marks[i] = flameSprite(this.markLayer, this.tex.pool, false);
            applyDraw(s, { x: m.x, y: m.y, angle: 0, w: m.w, h: m.h, tint: SOOT, alpha: m.alpha }, m.active);
        });
    }

    destroy(): void {
        destroyLayer(this.patchLayer);
        destroyLayer(this.tongueLayer);
        destroyLayer(this.markLayer);
        this.sets.length = 0;
        this.marks.length = 0;
    }

    private makeSet(): PatchSet {
        const { glow, pool, flame, tongue } = this.tex;
        const L = this.patchLayer;
        const draws = newPatchDraws();
        return {
            draws,
            lowGlow: flameSprite(L, glow, true),
            bed: flameSprite(L, pool, true),
            mass: flameSprite(L, flame, true, 1),
            mass2: flameSprite(L, flame, true, 1),
            highGlow: flameSprite(L, glow, true),
            tongues: draws.tongues.map(() => ({
                outer: flameSprite(this.tongueLayer, tongue, true, 1),
                inner: flameSprite(this.tongueLayer, tongue, true, 1),
            })),
        };
    }
}

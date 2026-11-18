// On-world readout of the test range (#range): a health and armour bar over every living dummy, an hp bar over every
// intact piece of cover, the "last 3 s" damage total above them and, with H, an outline of each dummy's hit zone.
// World space, like the F3 bot-path layer: one Graphics redrawn every frame and one pooled Text per target.

import { Container, Graphics, Text } from 'pixi.js';
import { COVER_SPECS } from '../../cover/coverTypes';
import { recentDamage } from '../../range/rangeReadout';
import type { ReadoutMemory } from '../../range/rangeReadout';
import { hitRect } from '../../systems/hitZone';
import type { GameState } from '../../../types';

const HEALTH_COLOR = 0x4ade80;
const ARMOUR_COLOR = 0x38bdf8;
const BAR_TRACK_COLOR = 0x0f172a;
const BAR_TRACK_ALPHA = 0.7;
const OUTLINE_COLOR = 0xf1f5f9;
const TOTAL_TEXT_COLOR = '#facc15'; // the same yellow as the cover damage numbers

const BAR_W = 40;
const BAR_H = 4;
const BAR_GAP = 2;        // between the armour bar and the health bar, and between the top bar and the total
const DUMMY_LIFT = 12;    // the health bar ends this far above the top of the hit zone
const COVER_LIFT = 4;     // the cover bar ends this far above the top of the piece
const OUTLINE_WIDTH = 1;

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/** A bar with its left edge at `x`, top at `y`; the fill is the share `fraction` of the track. */
const drawBar = (g: Graphics, x: number, y: number, fraction: number, color: number): void => {
    g.rect(x, y, BAR_W, BAR_H).fill({ color: BAR_TRACK_COLOR, alpha: BAR_TRACK_ALPHA });
    const w = BAR_W * clamp01(fraction);
    if (w > 0) g.rect(x, y, w, BAR_H).fill(color);
};

const createTotalText = (id: string): Text => {
    const text = new Text({
        text: '',
        style: { fontFamily: 'Arial', fontSize: 14, fontWeight: 'bold', fill: TOTAL_TEXT_COLOR, stroke: { color: 0x000000, width: 3 } },
    });
    text.label = id;
    text.anchor.set(0.5, 1); // centred over its target, resting on the given line
    text.visible = false;
    return text;
};

export class RangeOverlay {
    private readonly gfx = new Graphics();
    private readonly texts = new Map<string, Text>();

    constructor(private readonly layer: Container) {
        layer.addChild(this.gfx);
    }

    /** Redraws everything for this frame; `now` is the clock the readout memory was written with. */
    sync(state: GameState, memory: ReadoutMemory, now: number): void {
        const g = this.gfx;
        g.clear();
        const seen = new Set<string>();
        const outlines = state.range?.showHitZones ?? false;
        for (const d of state.players) {
            if (!d.dummy || d.dead) continue;
            const r = hitRect(d);
            const x = d.pos.x - BAR_W / 2;
            const healthY = r.y - DUMMY_LIFT - BAR_H;
            const armourY = healthY - BAR_GAP - BAR_H;
            drawBar(g, x, healthY, d.health / d.maxHealth, HEALTH_COLOR);
            if (d.armor > 0) drawBar(g, x, armourY, d.armor / d.maxArmor, ARMOUR_COLOR);
            // The total rests above the armour bar's place whether or not it is drawn, so it never jumps
            this.showTotal(d.id, d.pos.x, armourY - BAR_GAP, recentDamage(memory, d.id, now), seen);
            if (outlines) g.rect(r.x, r.y, r.w, r.h).stroke({ width: OUTLINE_WIDTH, color: OUTLINE_COLOR });
        }
        for (const c of state.cover ?? []) {
            if (c.hp <= 0) continue;
            const barY = c.pos.y - COVER_SPECS[c.kind].h - COVER_LIFT - BAR_H; // pos is the bottom edge
            drawBar(g, c.pos.x - BAR_W / 2, barY, c.hp / COVER_SPECS[c.kind].hp, HEALTH_COLOR);
            this.showTotal(c.id, c.pos.x, barY - BAR_GAP, recentDamage(memory, c.id, now), seen);
        }
        for (const [id, text] of this.texts) {
            if (!seen.has(id)) text.visible = false; // its target is dead, destroyed or gone
        }
    }

    /** Puts the total on its target's text (made on first sight), or hides the text when there is nothing to show. */
    private showTotal(id: string, x: number, bottom: number, total: number, seen: Set<string>): void {
        seen.add(id);
        let text = this.texts.get(id);
        if (!text) {
            text = createTotalText(id);
            this.texts.set(id, text);
            this.layer.addChild(text);
        }
        text.visible = total > 0;
        if (total > 0) {
            text.text = String(total);
            text.position.set(x, bottom);
        }
    }

    destroy(): void {
        for (const text of this.texts.values()) text.destroy({ children: true, style: true });
        this.texts.clear();
        this.gfx.destroy({ children: true, context: true });
    }
}

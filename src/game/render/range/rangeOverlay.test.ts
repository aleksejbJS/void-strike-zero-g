import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Container, Graphics, Text } from 'pixi.js';
import { COVER_SPECS } from '../../cover/coverTypes';
import { trackRangeDamage } from '../../range/rangeReadout';
import { hitDummy, readoutSession, T } from '../../range/rangeReadoutTestKit';
import type { ReadoutSession } from '../../range/rangeReadoutTestKit';
import { hitRect } from '../../systems/hitZone';
import { RangeOverlay } from './rangeOverlay';

interface Rect { x: number; y: number; w: number; h: number }
interface PathStep { action: string; data: number[] }
interface DrawStep { action: string; data: { path: { instructions: PathStep[] } } }

/** Every rectangle drawn with `action` ('fill' or 'stroke'), in drawing order. */
const rects = (g: Graphics, action: 'fill' | 'stroke'): Rect[] =>
    (g.context.instructions as unknown as DrawStep[])
        .filter(step => step.action === action)
        .flatMap(step => step.data.path.instructions.filter(p => p.action === 'rect'))
        .map(({ data: [x, y, w, h] }) => ({ x, y, w, h }));

interface Setup { layer: Container; overlay: RangeOverlay; s: ReadoutSession; g: Graphics }

const setup = (): Setup => {
    const layer = new Container();
    const overlay = new RangeOverlay(layer);
    const g = layer.children.find((c): c is Graphics => c instanceof Graphics) as Graphics;
    return { layer, overlay, s: readoutSession(), g };
};

const texts = (layer: Container): Text[] => layer.children.filter((c): c is Text => c instanceof Text);
const shown = (layer: Container): Text[] => texts(layer).filter(t => t.visible);

describe('RangeOverlay', () => {
    beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(T); });
    afterEach(() => { vi.useRealTimers(); });

    describe('hit zones', () => {
        it('draws no outline while showHitZones is off', () => {
            const { overlay, s, g } = setup();
            overlay.sync(s.state, s.memory, T);
            expect(rects(g, 'stroke')).toEqual([]);
        });

        it('draws one outline per living dummy, equal to its hit rectangle', () => {
            const { overlay, s, g } = setup();
            s.range.showHitZones = true;
            s.dummies[1].dead = true;
            overlay.sync(s.state, s.memory, T);
            const alive = s.dummies.filter(d => !d.dead);
            expect(rects(g, 'stroke')).toEqual(alive.map(hitRect));
            expect(alive).toHaveLength(s.dummies.length - 1);
        });

        it('uses a 1 px line', () => {
            const { overlay, s, g } = setup();
            s.range.showHitZones = true;
            overlay.sync(s.state, s.memory, T);
            const strokes = (g.context.instructions as unknown as { action: string; data: { style: { width: number } } }[])
                .filter(step => step.action === 'stroke');
            expect(strokes.length).toBeGreaterThan(0);
            expect(strokes.every(step => step.data.style.width === 1)).toBe(true);
        });
    });

    describe('health and armour bars', () => {
        it('puts a 40 x 4 health bar over the hit zone, centred on the dummy, filled by health', () => {
            const { overlay, s, g } = setup();
            const d = s.dummy;
            d.health = 25;
            overlay.sync(s.state, s.memory, T);
            const r = hitRect(d);
            const bars = rects(g, 'fill').filter(b => b.w === 40 && b.x === d.pos.x - 20);
            // Track, then the fill: the track is the full bar, 4 px tall, ending above the hit zone's top edge
            expect(bars[0].h).toBe(4);
            expect(bars[0].y + bars[0].h).toBeLessThanOrEqual(r.y - 12);
            expect(bars[0].y + bars[0].h).toBeGreaterThan(r.y - 20);
            const fill = rects(g, 'fill').find(b => b.x === d.pos.x - 20 && b.y === bars[0].y && b.w === 10);
            expect(fill).toBeDefined();
        });

        it('shows an armour bar above the health bar only while armour is left', () => {
            const { overlay, s, g } = setup();
            const d = s.dummy;
            d.health = 50; // a full health bar would draw its fill as wide as its track
            const barsOf = () => rects(g, 'fill').filter(b => b.x === d.pos.x - 20 && b.w === 40);
            overlay.sync(s.state, s.memory, T);
            expect(barsOf()).toHaveLength(1);
            d.armor = 50;
            overlay.sync(s.state, s.memory, T);
            const [health, armour] = barsOf();
            expect(armour.y + armour.h).toBeLessThanOrEqual(health.y);
            expect(rects(g, 'fill').some(b => b.x === d.pos.x - 20 && b.y === armour.y && b.w === 20)).toBe(true);
            d.armor = 0;
            overlay.sync(s.state, s.memory, T);
            expect(barsOf()).toHaveLength(1);
        });

        it('draws nothing for a dead dummy', () => {
            const { overlay, s, g } = setup();
            for (const d of s.dummies) d.dead = true;
            s.state.cover = [];
            overlay.sync(s.state, s.memory, T);
            expect(rects(g, 'fill')).toEqual([]);
        });
    });

    describe('damage total', () => {
        it('hides the text of a dummy that took no damage in the last 3 s', () => {
            const { layer, overlay, s } = setup();
            overlay.sync(s.state, s.memory, T);
            const own = texts(layer).find(t => t.label === s.dummy.id);
            expect(own).toBeDefined();
            expect(own?.visible).toBe(false);
            expect(shown(layer)).toEqual([]);
        });

        it('shows the 3 s total above the bars, then hides the same text again when the hits are old', () => {
            const { layer, overlay, s, g } = setup();
            hitDummy(s, 20, T + 100);
            hitDummy(s, 10, T + 200);
            overlay.sync(s.state, s.memory, T + 300);
            const text = shown(layer)[0];
            expect(shown(layer)).toHaveLength(1);
            expect(text.label).toBe(s.dummy.id);
            expect(text.text).toBe('30');
            const topBar = Math.min(...rects(g, 'fill').filter(b => b.x === s.dummy.pos.x - 20).map(b => b.y));
            expect(text.y).toBeLessThanOrEqual(topBar);
            expect(text.x).toBe(s.dummy.pos.x);
            overlay.sync(s.state, s.memory, T + 4000);
            expect(shown(layer)).toEqual([]);
            expect(texts(layer).filter(t => t.label === s.dummy.id)).toEqual([text]);
        });

        it('hides the text when its dummy is dead, and reuses it after the dummy returns', () => {
            const { layer, overlay, s } = setup();
            hitDummy(s, 20, T + 100);
            overlay.sync(s.state, s.memory, T + 200);
            const text = shown(layer)[0];
            s.dummy.dead = true;
            overlay.sync(s.state, s.memory, T + 300);
            expect(shown(layer)).toEqual([]);
            s.dummy.dead = false;
            overlay.sync(s.state, s.memory, T + 400);
            expect(shown(layer)).toEqual([text]);
        });

        it('creates each text once, however many frames are synced', () => {
            const { layer, overlay, s } = setup();
            overlay.sync(s.state, s.memory, T);
            const first = texts(layer);
            overlay.sync(s.state, s.memory, T + 16);
            overlay.sync(s.state, s.memory, T + 32);
            expect(texts(layer)).toEqual(first);
        });
    });

    describe('cover', () => {
        it('draws an hp bar over each intact piece and none for a destroyed one', () => {
            const { overlay, s, g } = setup();
            s.state.players = s.state.players.filter(p => !p.dummy);
            const [first, second] = s.state.cover!;
            second.hp = 0;
            first.hp = COVER_SPECS[first.kind].hp / 2;
            overlay.sync(s.state, s.memory, T);
            const topOf = (c: typeof first) => c.pos.y - COVER_SPECS[c.kind].h;
            const barOver = (c: typeof first) => rects(g, 'fill').filter(b => b.x === c.pos.x - 20 && b.y < topOf(c) && b.y >= topOf(c) - 12);
            expect(barOver(first).length).toBeGreaterThanOrEqual(2); // track and fill
            expect(barOver(second)).toEqual([]);
            expect(rects(g, 'fill').some(b => b.x === first.pos.x - 20 && b.w === 20)).toBe(true);
        });

        it('shows the 3 s total of a piece of cover, and not for a piece without damage', () => {
            const { layer, overlay, s } = setup();
            const piece = s.state.cover![0];
            piece.hp -= 40;
            trackRangeDamage(s.memory, s.state, T + 100);
            overlay.sync(s.state, s.memory, T + 200);
            const visible = shown(layer);
            expect(visible).toHaveLength(1);
            expect(visible[0].label).toBe(piece.id);
            expect(visible[0].text).toBe('40');
            expect(visible[0].y).toBeLessThan(piece.pos.y - COVER_SPECS[piece.kind].h);
        });
    });

    describe('destroy', () => {
        it('removes everything it added to the layer', () => {
            const { layer, overlay, s } = setup();
            hitDummy(s, 20, T + 100);
            s.range.showHitZones = true;
            overlay.sync(s.state, s.memory, T + 200);
            expect(layer.children.length).toBeGreaterThan(1);
            overlay.destroy();
            expect(layer.children).toHaveLength(0);
        });
    });
});

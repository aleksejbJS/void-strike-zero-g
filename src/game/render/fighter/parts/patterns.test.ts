import { describe, expect, it } from 'vitest';
import { Graphics } from 'pixi.js';
import { BADGES, DEFAULT_BUILD, EMBLEMS, FighterBuild, PATTERNS } from '../../../build/buildParts';
import { Vector2 } from '../../../../types';
import { FighterLook } from '../fighterLook';
import { drawPattern, patternShapes } from './patterns';
import { drawBadge } from './badges';

const lookWith = (parts: Partial<FighterBuild>): FighterLook => ({
    head: 0x9ca3af, torso: 0x6b7280, arm: 0x6b7280, leg: 0x475569, jet: 0xfbbf24,
    visor: 0x7fd3ff, pattern: 0x22c55e, build: { ...DEFAULT_BUILD, ...parts },
});

const AT = (x: number, y: number): Vector2 => ({ x, y });
const P = AT;

/** Instruction count and bounds of a drawing. */
const measure = (draw: (g: Graphics) => void) => {
    const g = new Graphics();
    draw(g);
    const n = g.context.instructions.length;
    const { minX, maxX, minY, maxY } = g.bounds;
    g.destroy({ children: true, context: true });
    return { n, minX, maxX, minY, maxY };
};

// The torso outline in the torso frame (before the body width), as drawTorso draws it
const TORSO = [P(-6.2, 0.5), P(6.2, 0.5), P(7.6, -19.5), P(-6.6, -20)];
const EPS = 1e-6;

/** Inside (or on the edge of) the convex torso outline. */
const insideTorso = (p: Vector2) => TORSO.every((a, i) => {
    const b = TORSO[(i + 1) % TORSO.length];
    return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) <= EPS; // clockwise on screen: inside is on the right
});

describe('drawPattern', () => {
    it('none draws nothing', () => {
        expect(patternShapes('none')).toEqual([]);
        expect(measure(g => drawPattern(g, AT, lookWith({ pattern: 'none' }))).n).toBe(0);
    });

    it('every other pattern draws', () => {
        for (const pattern of PATTERNS.filter(p => p !== 'none')) {
            expect(measure(g => drawPattern(g, AT, lookWith({ pattern }))).n, pattern).toBeGreaterThan(0);
        }
    });

    it("band is today's robot chest band", () => {
        expect(patternShapes('band')).toEqual([[P(-6.4, -12), P(7, -12.2), P(7.1, -9), P(-6.3, -8.8)]]);
    });

    it('every pattern stays inside the torso quad', () => {
        for (const pattern of PATTERNS) {
            for (const p of patternShapes(pattern).flat()) {
                expect(p.x, pattern).toBeGreaterThanOrEqual(-6.6 - EPS);
                expect(p.x, pattern).toBeLessThanOrEqual(7.6 + EPS);
                expect(p.y, pattern).toBeGreaterThanOrEqual(-20 - EPS);
                expect(p.y, pattern).toBeLessThanOrEqual(0.5 + EPS);
            }
        }
    });

    it('painted patterns follow the slanted torso outline', () => {
        for (const pattern of PATTERNS.filter(p => p !== 'band')) {
            for (const p of patternShapes(pattern).flat()) expect(insideTorso(p), `${pattern} ${p.x},${p.y}`).toBe(true);
        }
    });

    it('draws the paint and the raised band on separate layers', () => {
        const band = lookWith({ pattern: 'band' }), camo = lookWith({ pattern: 'camo' });
        expect(measure(g => drawPattern(g, AT, band, 'paint')).n).toBe(0);
        expect(measure(g => drawPattern(g, AT, band, 'plate')).n).toBeGreaterThan(0);
        expect(measure(g => drawPattern(g, AT, camo, 'plate')).n).toBe(0);
        expect(measure(g => drawPattern(g, AT, camo, 'paint')).n).toBeGreaterThan(0);
    });
});

describe('drawBadge', () => {
    it('none draws nothing', () => {
        expect(measure(g => drawBadge(g, AT, lookWith({ badge: 'none' }))).n).toBe(0);
    });

    const VARIANTS: Partial<FighterBuild>[] = [
        ...BADGES.filter(b => b !== 'none' && b !== 'emblem').map(badge => ({ badge })),
        ...EMBLEMS.map(emblem => ({ badge: 'emblem' as const, emblem })),
        ...[0, 7, 42, 88, 99].map(badgeNumber => ({ badge: 'number' as const, badgeNumber })),
    ];

    it('every badge stays on the shoulder pad', () => {
        for (const parts of VARIANTS) {
            for (const mirrored of [false, true]) {
                const m = measure(g => drawBadge(g, AT, lookWith(parts), mirrored));
                const name = JSON.stringify(parts) + (mirrored ? ' mirrored' : '');
                expect(m.n, name).toBeGreaterThan(0);
                expect(m.minX, name).toBeGreaterThanOrEqual(1);
                expect(m.maxX, name).toBeLessThanOrEqual(8.5);
                expect(m.minY, name).toBeGreaterThanOrEqual(-21);
                expect(m.maxY, name).toBeLessThanOrEqual(-15.5);
            }
        }
    });

    it('shows the chosen number and emblem', () => {
        const count = (parts: Partial<FighterBuild>) => measure(g => drawBadge(g, AT, lookWith(parts))).n;
        expect(count({ badge: 'number', badgeNumber: 7 })).toBeLessThan(count({ badge: 'number', badgeNumber: 88 }));
        expect(count({ badge: 'emblem', emblem: 'skull' })).not.toBe(count({ badge: 'emblem', emblem: 'star' }));
    });
});

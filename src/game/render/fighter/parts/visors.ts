// Visor shapes for every helmet. On the robot box a visor is a solid glowing panel in the visor colour;
// on the round, dome and angular helmets it is dark glass with a glow line or glow dots in that colour.

import { Graphics } from 'pixi.js';
import { Vector2 } from '../../../../types';
import { HelmetId, VisorId } from '../../../build/buildParts';
import { HEAD_K, HEAD_R, ROBOT_HEAD_K } from '../fighterStyle';
import { VISOR, WHITE, flat } from '../fighterPaint';
import { drawVisor as drawStripGlass, ellipsePoints, glassSheen, roundRectPoints, visorSheen } from '../fighterDetails';
import { ANGULAR, visorSpace } from './headSpace';
import { clipSegment, clipToConvex } from './convexClip';

type Segment = [Vector2, Vector2];

/** Glass windows, glow dots and glow lines (lineW in rig units on a full-size head). */
interface VisorShape { glass: Vector2[][]; dots: Vector2[][]; lines: Segment[]; lineW: number }

const P = (x: number, y: number): Vector2 => ({ x, y });
const circle = (x: number, y: number, r: number) => ellipsePoints(x, y, r, r, 0, 16);

/** Big glass whose front edge follows the head outline. */
const fullGlass = (): Vector2[] => {
    const R = 7.25, from = -0.65, to = 0.6, steps = 8;
    const arc = Array.from({ length: steps + 1 }, (_, i) => {
        const a = from + (to - from) * i / steps;
        return P(R * Math.cos(a), R * Math.sin(a));
    });
    return [P(0.4, -4.4), ...arc, P(0.4, 4), P(-0.4, 3.2), P(-0.4, -3.6)];
};

/** Dark-glass visors in design units (head radius 7 around the origin, face towards +x). */
const GLASS: Record<VisorId, VisorShape> = {
    none: { glass: [], dots: [], lines: [], lineW: 0 },
    strip: { glass: [roundRectPoints(1, -3, 7.4, 5.4, 2.4)], dots: [], lines: [[P(2.6, -1.8), P(7, -1.8)]], lineW: 1 },
    glass: { glass: [fullGlass()], dots: [], lines: [[P(1.4, -3.1), P(5.4, -3.1)]], lineW: 1 },
    slit: { glass: [roundRectPoints(0.6, -1.5, 7.8, 1.9, 0.9)], dots: [], lines: [[P(1.6, -0.55), P(7.4, -0.55)]], lineW: 0.9 },
    t: {
        glass: [[P(0.6, -3.2), P(8.4, -3.2), P(8.4, -1.2), P(5.6, -1.2), P(5.6, 3.2), P(3.6, 3.2), P(3.6, -1.2), P(0.6, -1.2)]],
        dots: [], lines: [[P(1.6, -2.2), P(7.4, -2.2)]], lineW: 0.9,
    },
    eyes: { glass: [circle(2.6, -1.3, 1.9), circle(6.3, -1.3, 1.6)], dots: [circle(3.1, -1.8, 0.75), circle(6.7, -1.75, 0.65)], lines: [], lineW: 0 },
};

/** The angular helmet's strip is a slanted plate set into its front facet. */
const ANGULAR_STRIP: VisorShape = {
    glass: [[P(0.3, -3.1), P(7.6, -3.5), P(7.6, 1.3), P(1.2, 1.8)]], dots: [], lines: [[P(1.9, -2.1), P(6.4, -2.4)]], lineW: 1,
};

const ANGULAR_INNER = ANGULAR.map(p => P(p.x * 0.85, p.y * 0.85)); // glow lines stop short of the angular edge

/** Glowing panels on the robot box in box units (scaled by ROBOT_HEAD_K); dark sockets go under the smaller ones. */
const BOX: Record<VisorId, { panels: Vector2[][]; sockets: Vector2[][] }> = {
    none: { panels: [], sockets: [] },
    strip: { panels: [], sockets: [] }, // drawn as today's panel, see drawBoxVisor
    glass: { panels: [roundRectPoints(-2, -4.2, 9, 8, 1.6)], sockets: [] },
    slit: { panels: [roundRectPoints(-0.4, -1.4, 7.4, 1.6, 0.8)], sockets: [roundRectPoints(-1, -2, 8, 2.8, 1.2)] },
    t: {
        panels: [[P(-0.6, -3.4), P(7, -3.4), P(7, -1.8), P(4.4, -1.8), P(4.4, 3), P(2.8, 3), P(2.8, -1.8), P(-0.6, -1.8)]],
        sockets: [[P(-1.2, -4), P(7, -4), P(7, -1.2), P(5, -1.2), P(5, 3.6), P(2.2, 3.6), P(2.2, -1.2), P(-1.2, -1.2)]],
    },
    eyes: { panels: [circle(1.6, -1.2, 1.7), circle(5.2, -1.2, 1.4)], sockets: [circle(1.6, -1.2, 2.4), circle(5.2, -1.2, 2.1)] },
};

const drawBoxVisor = (g: Graphics, visor: VisorId, color: number) => {
    const k = ROBOT_HEAD_K;
    if (visor === 'strip') { // today's robot visor
        g.roundRect(-1 * k, -3 * k, 8 * k, 4.5 * k, 1.5 * k).fill(color);
        visorSheen(g, -1 * k, -3 * k, 8 * k, 4.5 * k, 1.5 * k);
        return;
    }
    const scale = (pts: Vector2[]) => pts.map(p => P(p.x * k, p.y * k));
    const { panels, sockets } = BOX[visor];
    sockets.forEach(s => g.poly(flat(scale(s))).fill(VISOR));
    panels.forEach(s => {
        g.poly(flat(scale(s))).fill(color);
        glassSheen(g, scale(s));
    });
    if (visor === 'eyes') panels.forEach(s => {
        const c = scale(s).reduce((m, p) => P(m.x + p.x / s.length, m.y + p.y / s.length), P(0, 0));
        g.circle(c.x - 0.7, c.y - 0.7, 0.55).fill({ color: WHITE, alpha: 0.8 });
    });
};

/** A visor shaped for its helmet, around the head's origin. */
export const drawVisor = (g: Graphics, visor: VisorId, helmet: HelmetId, color: number) => {
    if (visor === 'none') return;
    if (helmet === 'box') { drawBoxVisor(g, visor, color); return; }
    if (helmet === 'round' && visor === 'strip') { // today's human visor, unchanged
        drawStripGlass(g, HEAD_R);
        g.moveTo(2.6 * HEAD_K, -1.8 * HEAD_K).lineTo(7 * HEAD_K, -1.8 * HEAD_K).stroke({ width: 1, color, cap: 'round' });
        return;
    }
    const { at, u } = visorSpace(helmet);
    const shape = helmet === 'angular' && visor === 'strip' ? ANGULAR_STRIP : GLASS[visor] ?? GLASS.strip; // unknown ids: last guard, builds are sanitized upstream
    const map = (pts: Vector2[]) => pts.map(p => at(p.x, p.y));
    const fit = (pts: Vector2[]) => helmet === 'angular' ? clipToConvex(map(pts), ANGULAR) : map(pts);
    shape.glass.map(fit).forEach(s => {
        g.poly(flat(s)).fill(VISOR);
        glassSheen(g, s);
    });
    shape.dots.map(fit).forEach(s => g.poly(flat(s)).fill(color));
    shape.lines.forEach(([a, b]) => {
        const seg = helmet === 'angular' ? clipSegment(at(a.x, a.y), at(b.x, b.y), ANGULAR_INNER) : [at(a.x, a.y), at(b.x, b.y)];
        if (seg) g.moveTo(seg[0].x, seg[0].y).lineTo(seg[1].x, seg[1].y).stroke({ width: shape.lineW * u, color, cap: 'round' });
    });
};

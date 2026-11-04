// Drawing helpers the cover art adds on top of scene/canvasKit.ts (seeded noise, stencil, overlays).
// Light comes from the upper left, like the station windows: lit top/left edges, dark bottom/right.
// The small variants of canvasKit's bolts, hazard paint and glow live here under their own names:
// a 50 px crate needs rivets under 1 px, narrower chevrons and a glow that is not always additive.

import { DISPLAY_FONT, noise, rnd, stencil } from '../scene/canvasKit';

export type Ctx = CanvasRenderingContext2D;
export type Pt = [number, number];
export type Rand = ReturnType<typeof rnd>;
type Stops = ReadonlyArray<readonly [number, string]>;

export const HAZARD = '#FFC21A';

export const lin = (c: Ctx, x0: number, y0: number, x1: number, y1: number, stops: Stops) => {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([at, color]) => g.addColorStop(at, color));
    return g;
};

export const poly = (c: Ctx, pts: readonly Pt[]) => {
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
};

/** A ragged ring of n points between radii r0 and r1 (squashed vertically by sy): holes and torn edges. */
export const jaggedPts = (cx: number, cy: number, n: number, r0: number, r1: number, R: Rand, sy = 0.9): Pt[] =>
    Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2, r = r0 + R() * (r1 - r0);
        return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * sy];
    });

/** A soft blob (radial fade to nothing), optionally squashed vertically; shadows, smoke, heat. */
export const softGlow = (c: Ctx, x: number, y: number, r: number, color: string, sy = 1, mode?: GlobalCompositeOperation) => {
    c.save();
    if (mode) c.globalCompositeOperation = mode;
    c.translate(x, y);
    c.scale(1, sy);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
    c.restore();
};

/** The dark pool of contact shadow under an object standing on the floor. */
export const contact = (c: Ctx, cx: number, fy: number, rx: number) => softGlow(c, cx, fy, rx, 'rgba(0,0,0,.7)', 0.16);

/** Grain: noise squeezed along one axis (wood fibres, brushed steel). */
export const streaks = (c: Ctx, x: number, y: number, w: number, h: number, seed: number, alpha: number, vertical = false, mode: GlobalCompositeOperation = 'overlay') => {
    const n = vertical ? noise(Math.ceil(w * 3), 10, 3, seed, 2) : noise(10, Math.ceil(h * 3), 3, seed, 2);
    c.save();
    c.beginPath(); c.rect(x, y, w, h); c.clip();
    c.globalCompositeOperation = mode;
    c.globalAlpha = alpha;
    c.drawImage(n, x, y, w, h);
    c.restore();
};

export const bevel = (c: Ctx, x: number, y: number, w: number, h: number, lit = 'rgba(255,255,255,.28)', dark = 'rgba(0,0,0,.45)', t = 1) => {
    c.fillStyle = lit; c.fillRect(x, y, w, t); c.fillRect(x, y, t, h);
    c.fillStyle = dark; c.fillRect(x, y + h - t, w, t); c.fillRect(x + w - t, y, t, h);
};

/** A row of rivets (radius r, with a lit speck). */
export const rivets = (c: Ctx, x0: number, x1: number, y: number, step: number, r = 1.3) => {
    for (let x = x0; x < x1; x += step) {
        c.fillStyle = 'rgba(0,0,0,0.55)'; c.beginPath(); c.arc(x + 0.6, y + 0.6, r + 0.4, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(190,205,220,0.6)'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.7)'; c.fillRect(x - r * 0.5, y - r * 0.5, r * 0.5, r * 0.5);
    }
};

/** Hazard chevrons with chipped paint; `step` is the stripe pitch. */
export const hazardStripe = (c: Ctx, x: number, y: number, w: number, h: number, seed: number, step = 16) => {
    const R = rnd(seed);
    c.save();
    c.beginPath(); c.rect(x, y, w, h); c.clip();
    c.fillStyle = '#16181b'; c.fillRect(x, y, w, h);
    c.fillStyle = '#d9a514';
    for (let i = x - 30; i < x + w + 30; i += step) {
        c.beginPath(); c.moveTo(i, y + h); c.lineTo(i + h, y); c.lineTo(i + h + step / 2.3, y); c.lineTo(i + step / 2.3, y + h); c.fill();
    }
    c.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < w / 5; i++) {
        c.fillStyle = `rgba(40,42,46,${0.5 + R() * 0.5})`;
        c.fillRect(x + R() * w, y + R() * h, 0.6 + R() * 3, 0.6 + R() * 1.6);
    }
    c.restore();
};

/** Stencilled lettering centred on x (canvasKit's stencil starts at x). */
export const stencilCentered = (c: Ctx, text: string, cx: number, y: number, size: number, color: string, alpha: number) => {
    c.save();
    c.font = `900 ${size}px ${DISPLAY_FONT}`;
    const width = Math.ceil(c.measureText(text).width) + 4;
    c.restore();
    stencil(c, text, cx - width / 2, y, size, color, alpha);
};

/** A crack that follows the grain (mostly sideways), with a lit lower lip so it reads as a split. */
export const split = (c: Ctx, x: number, y: number, len: number, R: Rand, spread = 0.35, dark = 'rgba(20,10,4,.95)', lip = 'rgba(235,190,130,.55)') => {
    const pts: Pt[] = [[x, y]];
    let a = (R() < 0.5 ? 0 : Math.PI) + (R() - 0.5) * spread, px = x, py = y;
    for (let k = 0; k < 4; k++) {
        a += (R() - 0.5) * spread;
        const s = (len / 4) * (0.6 + R() * 0.8);
        px += Math.cos(a) * s; py += Math.sin(a) * s;
        pts.push([px, py]);
    }
    const path = (dy: number) => {
        c.beginPath();
        pts.forEach(([qx, qy], i) => (i ? c.lineTo(qx, qy + dy) : c.moveTo(qx, qy + dy)));
        c.stroke();
    };
    c.lineWidth = 0.7; c.strokeStyle = lip; path(0.7);
    c.lineWidth = 1; c.strokeStyle = dark; path(0);
};

/** Cracks fanning out from an impact point, each with a dark edge and a bright core. */
export const radialCracks = (c: Ctx, x: number, y: number, n: number, len: number, R: Rand, colorA: string, colorB: string) => {
    for (let b = 0; b < n; b++) {
        let a = (b / n) * Math.PI * 2 + R() * 0.5, px = x, py = y;
        const pts: Pt[] = [[px, py]];
        for (let k = 0; k < 3; k++) {
            a += (R() - 0.5) * 0.7;
            const s = (len / 3) * (0.6 + R() * 0.8);
            px += Math.cos(a) * s; py += Math.sin(a) * s;
            pts.push([px, py]);
        }
        ([[colorA, 1.1, 0.5], [colorB, 0.7, 0]] as const).forEach(([color, width, d]) => {
            c.strokeStyle = color; c.lineWidth = width;
            c.beginPath();
            pts.forEach(([qx, qy], i) => (i ? c.lineTo(qx + d, qy + d) : c.moveTo(qx + d, qy + d)));
            c.stroke();
        });
    }
};

/** A dent in sheet metal: dark hollow, shadow arc on the lit side, highlight on the far lip. */
export const dent = (c: Ctx, dx: number, dy: number, r: number) => {
    c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.ellipse(dx, dy, r, r * 0.78, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 1; c.beginPath(); c.arc(dx, dy, r * 0.9, Math.PI * 0.95, Math.PI * 1.7); c.stroke();
    c.strokeStyle = 'rgba(235,242,250,.55)'; c.lineWidth = 0.9; c.beginPath(); c.arc(dx, dy, r * 0.85, Math.PI * -0.05, Math.PI * 0.7); c.stroke();
};

// How each particle kind looks. Pure drawing: every function repaints one pooled display
// object from the particle's current life, so nothing here keeps state between frames.

import { Graphics, Sprite } from 'pixi.js';
import { Particle, ParticleKind } from '../../../types';

type SpriteKind = 'flash' | 'fireball' | 'flame';
type GraphicKind = Exclude<ParticleKind, SpriteKind>;
type GraphicDrawer = (g: Graphics, p: Particle) => void;

const TAIL = 1.6;                  // streak length in ticks of travel
const SPARK_COLOR = 0xfff1b8;      // yellow-white
const EMBER_HOT = 0xfbbf24;        // orange at birth
const EMBER_COOL = 0xdc2626;       // red as it dies
const BRASS = 0xd9a520;
const BRASS_SHINE = 0xfff0b0;
const DUST_COLOR = 0xbeb4a0;
const MAG_BODY = 0x2b3038;         // gunmetal box
const MAG_EDGE = 0x8a9099;
const DEBRIS_TAIL = 2.6;           // debris streaks are longer than sparks: they read as flung chunks
const FLAME_COOL = 0x9f1d0b;       // a hot flame darkens toward this deep red as it dies
const FLAME_ALPHA = 0.6;           // overlapping flames add up to a white-hot core
const FLAME_GROWTH = 0.9;          // a flame swells by this share of its size over its life

export const isSpriteKind = (kind: ParticleKind | undefined): kind is SpriteKind =>
    kind === 'flash' || kind === 'fireball' || kind === 'flame';

/** Linear blend of two 0xRRGGBB colours; t = 1 gives `hot`, t = 0 gives `cool`. */
const mix = (cool: number, hot: number, t: number): number => {
    const k = Math.max(0, Math.min(1, t));
    const ch = (shift: number) => {
        const a = (cool >> shift) & 0xff, b = (hot >> shift) & 0xff;
        return Math.round(a + (b - a) * k) << shift;
    };
    return ch(16) | ch(8) | ch(0);
};

// A line from the particle back along its velocity, so fast ones leave a streak
const streak = (g: Graphics, p: Particle, width: number, color: number) => {
    const tx = -p.vel.x * TAIL, ty = -p.vel.y * TAIL;
    if (Math.hypot(tx, ty) < 0.5) {
        g.circle(0, 0, width / 2).fill({ color, alpha: p.life });
        return;
    }
    g.moveTo(0, 0).lineTo(tx, ty).stroke({ width, color, alpha: p.life, cap: 'round' });
};

const softCircle = (radius: (p: Particle) => number, color: (p: Particle) => number | string, alpha: (p: Particle) => number): GraphicDrawer =>
    (g, p) => { g.circle(0, 0, radius(p)).fill({ color: color(p), alpha: alpha(p) }); };

const smoke = (alpha: number) => softCircle(p => p.size * (1 + (1 - p.life) * 1.6), p => p.color, p => alpha * p.life);

const DRAWERS: Record<GraphicKind, GraphicDrawer> = {
    spark: (g, p) => streak(g, p, 1.5, SPARK_COLOR),
    ember: (g, p) => streak(g, p, p.size * 0.6, mix(EMBER_COOL, EMBER_HOT, p.life)),
    // Jetpack sparks (size 2–4) stay 2 px dots; the bigger flamethrower flames are drawn at half their size
    fire: (g, p) => { g.circle(0, 0, Math.max(2, p.size / 2)).fill({ color: p.color, alpha: p.life }); },
    smoke: smoke(0.35),
    puff: smoke(0.25),
    soot: softCircle(p => p.size * (1 + (1 - p.life) * 1.3), p => p.color, p => 0.7 * Math.min(1, p.life * 1.5)),
    debris: (g, p) => {
        // A glowing chunk that cools from ember orange to its own dark colour over the first half of its life
        const color = mix(Number.parseInt(p.color.slice(1), 16), EMBER_HOT, (p.life - 0.5) * 2);
        g.moveTo(0, 0).lineTo(-p.vel.x * DEBRIS_TAIL, -p.vel.y * DEBRIS_TAIL).stroke({ width: p.size * 0.7, color, alpha: p.life, cap: 'round' });
        g.circle(0, 0, p.size * 0.6).fill({ color, alpha: p.life });
    },
    blood: softCircle(p => p.size, p => p.color, () => 1),
    dust: softCircle(p => p.size * (1 + (1 - p.life) * 0.5), () => DUST_COLOR, p => 0.45 * p.life),
    shell: (g, p) => {
        g.rotation = p.rotation ?? 0;
        g.rect(-2, -1, 4, 2).fill({ color: BRASS, alpha: p.life });
        g.moveTo(-2, -0.5).lineTo(2, -0.5).stroke({ width: 1, color: BRASS_SHINE, alpha: p.life * 0.8 });
    },
    magazine: (g, p) => {
        // A small gunmetal box with a brass round peeking out of the top; solid until it fades at the end
        const alpha = Math.min(1, p.life * 4);
        g.rotation = p.rotation ?? 0;
        g.rect(-2.5, -4.5, 5, 9).fill({ color: MAG_BODY, alpha }).stroke({ width: 1, color: MAG_EDGE, alpha });
        g.rect(-1.5, -6, 3, 1.5).fill({ color: BRASS, alpha });
    },
    ring: (g, p) => {
        const t = 1 - p.life;
        g.circle(0, 0, p.size + t * 70).stroke({ width: 2 + t * 3, color: p.color, alpha: 0.6 * p.life });
    },
};

// Kinds that glow instead of just being coloured
const ADDITIVE: ReadonlySet<ParticleKind> = new Set(['spark', 'ember', 'fire', 'ring']);

/** Repaint a Graphics-backed particle (everything except flash and fireball). */
export const drawGraphic = (g: Graphics, p: Particle) => {
    // An untyped particle behaves like a spark; sprite kinds never reach this function
    const kind: GraphicKind = p.type === undefined || isSpriteKind(p.type) ? 'spark' : p.type;
    g.clear();
    g.position.set(p.pos.x, p.pos.y);
    g.rotation = 0;
    g.blendMode = ADDITIVE.has(kind) ? 'add' : 'normal';
    DRAWERS[kind](g, p);
};

/** A hot flame (the flamethrower's stream, a lit tank's jet): swells, cools toward deep red and fades. */
const drawFlame = (s: Sprite, p: Particle) => {
    s.position.set(p.pos.x, p.pos.y);
    s.tint = mix(FLAME_COOL, Number.parseInt(p.color.slice(1), 16), Math.sqrt(Math.max(0, p.life)));
    s.alpha = FLAME_ALPHA * Math.min(1, p.life * 2.5);
    s.width = s.height = 2 * p.size * (0.6 + FLAME_GROWTH * (1 - p.life));
};

/** Reposition and rescale a glow sprite: flash is a white burst, fireball a growing orange ball, flame a hot flame. */
export const drawSprite = (s: Sprite, p: Particle) => {
    if (p.type === 'flame') return drawFlame(s, p);
    const fireball = p.type === 'fireball';
    const radius = fireball ? p.size + (1 - p.life) * 34 : p.size;
    s.position.set(p.pos.x, p.pos.y);
    s.tint = p.color;
    // The fireball stays at full strength through the first third of its life, then fades to 0
    s.alpha = fireball ? Math.min(1, p.life * 1.6) : p.life;
    s.width = s.height = 2 * radius;
};

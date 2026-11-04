// What a piece of cover looks like when it is hit, breaks or comes back (display side, from COVER events):
// wood chips and dust, metal sparks and hot chunks, glass shards, a barrel's sparks. Colours are the
// materials' from the cover art. A barrel's break adds nothing here: its blast brings its own effects.

import type { GameState } from '../../types';
import { COVER_SPECS, CoverKind } from '../cover/coverTypes';
import type { CoverEvent } from './events';
import { createParticles } from './effectSpawn';

const between = (min: number, max: number) => min + Math.random() * (max - min);
/** A whole number from min to max, both included. */
const count = (min: number, max: number) => Math.floor(between(min, max + 1));
const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];
const each = (n: number, spawn: () => void) => { for (let i = 0; i < n; i++) spawn(); };

const WOOD = ['#a8733e', '#9b6735', '#b27d46'];
const SPLINTER = '#e2b27c';
const WOOD_DUST = '#aa8c69';
const STEEL = ['#59636f', '#7b8694', '#8d98a6'];
const STEEL_SMOKE = '#787c82';
const GLASS = ['#afe8ff', '#cdf3ff'];
const HOLOGRAM = '#ffc21a'; // hazard yellow, like the hologram
const STILL = { x: 0, y: 0 };

// Pieces that fall and lie around for a moment last about this long (decay is life lost per tick)
const LYING_DECAY = [0.004, 0.007] as const;

/** A random point on the piece (the event carries its middle). */
const onPiece = (kind: CoverKind, x: number, y: number) => {
    const { w, h } = COVER_SPECS[kind];
    return { x: x + between(-w / 2, w / 2), y: y + between(-h / 2, h / 2) };
};

/**
 * Bits that fall and land: wood chips, glass shards. The blood particle is the one kind that has gravity,
 * lands on platforms and keeps its own colour.
 */
const fragments = (state: GameState, kind: CoverKind, x: number, y: number, n: number, colors: readonly string[], size: readonly [number, number], speed: number) =>
    each(n, () => {
        const at = onPiece(kind, x, y);
        createParticles(state, at.x, at.y, 1, pick(colors), 'blood', {
            size: between(size[0], size[1]), decay: between(...LYING_DECAY),
            vel: { x: between(-speed, speed), y: -between(0.4, 1.1) * speed },
        });
    });

const sparks = (state: GameState, kind: CoverKind, x: number, y: number, n: number) => {
    createParticles(state, x, y, 1, '#ffd36b', 'flash', { size: 14, decay: 0.12, vel: STILL });
    each(n, () => {
        const at = onPiece(kind, x, y), angle = between(0, Math.PI * 2), speed = between(1, 6);
        createParticles(state, at.x, at.y, 1, '#ffd36b', 'spark', { vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed } });
    });
};

const cloud = (state: GameState, kind: CoverKind, x: number, y: number, n: number, color: string, size: readonly [number, number]) =>
    each(n, () => {
        const at = onPiece(kind, x, y);
        createParticles(state, at.x, at.y, 1, color, 'smoke', { size: between(size[0], size[1]), vel: { x: between(-0.4, 0.4), y: between(-0.7, -0.2) } });
    });

type Recipe = (state: GameState, x: number, y: number) => void;

const LOOKS: Record<CoverKind, { hit: Recipe; break: Recipe }> = {
    wood: {
        hit: (s, x, y) => fragments(s, 'wood', x, y, count(3, 5), WOOD, [1.5, 2.5], 2.5),
        break: (s, x, y) => {
            fragments(s, 'wood', x, y, 14, WOOD, [2.5, 4], 4);
            fragments(s, 'wood', x, y, 6, [SPLINTER], [1.5, 2.5], 3);
            cloud(s, 'wood', x, y, 5, WOOD_DUST, [8, 14]);
            each(5, () => createParticles(s, x + between(-25, 25), y + between(-10, 20), 1, WOOD_DUST, 'dust'));
        },
    },
    metal: {
        hit: (s, x, y) => sparks(s, 'metal', x, y, 6),
        break: (s, x, y) => {
            sparks(s, 'metal', x, y, 14);
            each(8, () => {
                const at = onPiece('metal', x, y), angle = between(-Math.PI, 0) + between(-0.5, 0.5), speed = between(2.5, 6);
                createParticles(s, at.x, at.y, 1, pick(STEEL), 'debris', { size: between(2.5, 4), vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed } });
            });
            cloud(s, 'metal', x, y, 3, STEEL_SMOKE, [8, 13]);
        },
    },
    glass: {
        hit: (s, x, y) => fragments(s, 'glass', x, y, count(3, 5), GLASS, [1.2, 2], 2),
        break: (s, x, y) => {
            fragments(s, 'glass', x, y, 26, GLASS, [1.5, 3.2], 4);
            each(6, () => { const at = onPiece('glass', x, y); createParticles(s, at.x, at.y, 1, '#ffffff', 'spark', { vel: { x: between(-2, 2), y: between(-3, 0) } }); });
        },
    },
    barrel: {
        hit: (s, x, y) => sparks(s, 'barrel', x, y, 5),
        break: () => { /* the blast has its own effect */ },
    },
};

/** Turn one COVER event into particles. A piece coming back flashes in the hologram's yellow. */
export const applyCoverEvent = (state: GameState, e: CoverEvent): void => {
    if (e.action === 'restore') {
        createParticles(state, e.x, e.y, 1, HOLOGRAM, 'flash', { size: 36, decay: 0.08, vel: STILL });
        return;
    }
    LOOKS[e.kind][e.action](state, e.x, e.y);
};

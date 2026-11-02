// What an explosion is made of (display side): a lumpy fireball of several billows, a flash and a
// shockwave ring, hot debris flung out in all directions trailing smoke, embers, and a smoke cloud
// that hangs for about a second and a half. `scale` 1 is a rocket; everything grows with it.

import { GameState } from '../../types';
import { createParticles } from './effectSpawn';

const between = (min: number, max: number) => min + Math.random() * (max - min);
const each = (n: number, spawn: () => void) => { for (let i = 0; i < n; i++) spawn(); };
const STILL = { x: 0, y: 0 };

export const BILLOWS = 3;         // fireballs around the core: the ball reads as lumpy, not a disc
export const DEBRIS = 10;         // glowing chunks with smoke trails (the spiky silhouette)
export const EMBERS = 10;
export const SOOT_CLOUD = 7;      // smoky, slow, long-lived
export const LIGHT_SMOKE = 3;

const BILLOW_COLORS = ['#fb923c', '#fbbf24', '#ea580c'];
// Our maps are dark: pure black smoke would vanish, so soot is a warm smoky grey
const SOOT_COLORS = ['#6b625a', '#5b534c', '#7a7068'];
const TRAIL_COLOR = '#8a8178';
const DEBRIS_COLOR = '#3a3330'; // what a chunk cools down to; it starts glowing (particleDraw)

/** A random direction biased upward (blasts mostly throw things up and sideways). */
const flingDir = () => {
    const angle = between(-Math.PI, 0) + between(-0.5, 0.5);
    return { x: Math.cos(angle), y: Math.sin(angle) };
};

export const explosionBurst = (state: GameState, x: number, y: number, scale = 1) => {
    const k = Math.max(0.3, scale);
    createParticles(state, x, y, 1, '#ffffff', 'flash', { size: 52 * k, vel: STILL });
    createParticles(state, x, y, 1, '#f97316', 'fireball', { size: 16 * k, vel: STILL });
    each(BILLOWS, () => {
        const ox = between(-24, 24) * k, oy = between(-20, 8) * k;
        createParticles(state, x + ox, y + oy, 1, BILLOW_COLORS[Math.floor(Math.random() * BILLOW_COLORS.length)], 'fireball',
            { size: between(10, 15) * k, decay: between(0.017, 0.026), vel: STILL });
    });
    createParticles(state, x, y, 1, '#fdba74', 'ring', { size: 12 * k, vel: STILL });
    each(DEBRIS, () => {
        const d = flingDir(), speed = between(5, 9.5) * Math.sqrt(k);
        createParticles(state, x, y, 1, DEBRIS_COLOR, 'debris', { size: between(2.5, 4) * k, vel: { x: d.x * speed, y: d.y * speed } });
    });
    each(EMBERS, () => createParticles(state, x, y, 1, '#fbbf24', 'ember', {
        vel: { x: between(-6, 6), y: between(-7, 1) },
    }));
    each(SOOT_CLOUD, () => createParticles(state, x + between(-10, 10) * k, y + between(-10, 4) * k, 1,
        SOOT_COLORS[Math.floor(Math.random() * SOOT_COLORS.length)], 'soot',
        { size: between(10, 18) * k, vel: { x: between(-0.5, 0.5), y: between(-0.7, -0.2) } }));
    each(LIGHT_SMOKE, () => createParticles(state, x, y, 1, '#9ca3af', 'smoke', {
        size: between(6, 12) * k, vel: { x: between(-0.6, 0.6), y: between(-0.9, -0.3) },
    }));
};

// Debris drops a soot puff now and then while it still flies fast: the trails behind the chunks
const TRAIL_UNTIL_LIFE = 0.35;
const TRAIL_CHANCE = 0.4;

/** Called for each debris particle every tick (particles.ts). */
export const debrisTrail = (state: GameState, x: number, y: number, life: number, size: number) => {
    if (life < TRAIL_UNTIL_LIFE || Math.random() >= TRAIL_CHANCE) return;
    createParticles(state, x, y, 1, TRAIL_COLOR, 'soot', { size: size * between(1.2, 1.7), decay: between(0.025, 0.04), vel: STILL }); // big enough to overlap: a line, not beads
};

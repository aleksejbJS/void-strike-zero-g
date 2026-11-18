// What an explosion leaves in the game state (display side): a 'ring' particle that marks the blast for the renderer,
// hot debris flung out in all directions, and embers. The flash, the fireball, the smoke and the trails are drawn by
// the renderer from the ring and the debris (render/blast). `scale` 1 is a rocket; everything grows with it.

import { GameState } from '../../types';
import { createParticles } from './effectSpawn';

const between = (min: number, max: number) => min + Math.random() * (max - min);
const each = (n: number, spawn: () => void) => { for (let i = 0; i < n; i++) spawn(); };
const STILL = { x: 0, y: 0 };

export const DEBRIS = 10;         // glowing chunks; the renderer draws their smoke trails (the spiky silhouette)
export const EMBERS = 10;

const DEBRIS_COLOR = '#3a3330'; // what a chunk cools down to; it starts glowing (particleDraw)

/** A random direction biased upward (blasts mostly throw things up and sideways). */
const flingDir = () => {
    const angle = between(-Math.PI, 0) + between(-0.5, 0.5);
    return { x: Math.cos(angle), y: Math.sin(angle) };
};

export const explosionBurst = (state: GameState, x: number, y: number, scale = 1) => {
    const k = Math.max(0.3, scale);
    // The ring is a marker, not drawn: its size tells the renderer the blast's scale (12 for a rocket)
    createParticles(state, x, y, 1, '#fdba74', 'ring', { size: 12 * k, vel: STILL });
    each(DEBRIS, () => {
        const d = flingDir(), speed = between(5, 9.5) * Math.sqrt(k);
        createParticles(state, x, y, 1, DEBRIS_COLOR, 'debris', { size: between(2.5, 4) * k, vel: { x: d.x * speed, y: d.y * speed } });
    });
    each(EMBERS, () => createParticles(state, x, y, 1, '#fbbf24', 'ember', {
        vel: { x: between(-6, 6), y: between(-7, 1) },
    }));
};

// Flame particles shared by burning fighters (render/fighter/fighterFire.ts) and burning corpses
// (ragdoll/corpseTank.ts): one capped flame, and one burst of a lit fuel tank's jet.
// Pure state writes, no Pixi: corpses are imported by the simulation's module graph (server and worker host).

import { GameState, Vector2 } from '../../types';
import { createParticles } from './effectSpawn';

/** With this many live particles (a big fight full of blasts), no new fire is added. */
const FIRE_CAP = 1200;

/** The tank's jet: hotter (blue-white), bigger and faster than body flames. */
const TANK_COUNT = 3;
const TANK_COLORS = ['#ffffff', '#e0f2fe', '#bae6fd', '#7dd3fc', '#38bdf8', '#60a5fa'];
const TANK_SPREAD = 0.25;   // radians either side of the jet's way

const between = (min: number, max: number) => min + Math.random() * (max - min);
const pick = (colors: string[]) => colors[Math.floor(Math.random() * colors.length)];

/** One 'fire' particle in one of `colors`, unless the scene is already full of particles. */
export const addFlame = (state: GameState, at: Vector2, colors: string[], vel: Vector2, size: number, decay?: number): void => {
    if (state.particles.length >= FIRE_CAP) return;
    createParticles(state, at.x, at.y, 1, pick(colors), 'fire', { vel, size, ...(decay !== undefined && { decay }) });
};

/** One burst of a lit tank's jet from (x, y) along `angle` (radians). */
export const spawnTankJet = (state: GameState, x: number, y: number, angle: number): void => {
    for (let i = 0; i < TANK_COUNT; i++) {
        const a = angle + between(-TANK_SPREAD, TANK_SPREAD), v = between(5, 8);
        addFlame(state, { x, y }, TANK_COLORS, { x: Math.cos(a) * v, y: Math.sin(a) * v }, between(7, 12), between(0.045, 0.06));
    }
};

// Flame particles of the fuel tank, shared by fighters (render/fighter/fighterFire.ts), corpses (ragdoll/corpseTank.ts)
// and tank blasts (effects.ts): a hot flame (glow sprite), one burst of a lit tank's jet and the ball of burning fuel
// a tank throws when it blows. The flamethrower's stream and burning fighters are drawn by render/flame instead.
// Pure state writes, no Pixi: corpses are imported by the simulation's module graph (server and worker host).

import { GameState, Vector2 } from '../../types';
import { createParticles } from './effectSpawn';

/**
 * Hot flames (a lit tank's jet, burning fuel) are still added up to this many live particles, so a scene full of
 * blasts never starves them. They are bounded anyway: each jet spawns a fixed number per second and its flames live
 * a fraction of a second.
 */
export const HOT_FLAME_CAP = 2400;

/** A lit tank's jet: a roaring white-hot to orange tongue from the back, unlike the orange licks of a burning body. */
export const TANK_JET_RATE = 320; // flames per second
const TANK_COLORS = ['#ffffff', '#fffbe6', '#fff1b8', '#ffe27a', '#ffc04d', '#ff9b38']; // from the valve outward
const TANK_JET_LEN = 85;    // px the tongue reaches
const TANK_SPREAD = 0.14;   // radians either side of the jet's way at the valve; it widens outward
const TANK_LIFE_TICKS = 22;
/** Start speed per px of travel for a flame that slows by 0.9 a tick (particles.ts) over TANK_LIFE_TICKS. */
const TANK_SPEED_PER_PX = (1 - 0.9) / (1 - 0.9 ** TANK_LIFE_TICKS);
/** Most of a corpse's or fighter's speed the jet keeps, so it trails from the tank instead of being left behind. */
const DRIFT = 0.5;

const between = (min: number, max: number) => min + Math.random() * (max - min);
const pick = (colors: string[]) => colors[Math.floor(Math.random() * colors.length)];

/** One hot 'flame' glow sprite of glow radius `size`; only HOT_FLAME_CAP stops it. */
export const addHotFlame = (state: GameState, at: Vector2, color: string, vel: Vector2, size: number, decay: number): void => {
    if (state.particles.length >= HOT_FLAME_CAP) return;
    createParticles(state, at.x, at.y, 1, color, 'flame', { vel, size, decay });
};

/**
 * `count` flames of a lit tank's jet from (x, y) along `angle` (radians). Each is born somewhere along the
 * tongue and hops on toward its tip, so the tongue is one continuous flame, not puffs piling up at its end.
 * `carrier`: the speed (px per tick) of the body wearing the tank; half of it goes into the flames.
 */
export const spawnTankJet = (state: GameState, x: number, y: number, angle: number, count: number, carrier: Vector2 = { x: 0, y: 0 }): void => {
    for (let i = 0; i < count; i++) {
        const s = Math.random(); // how far out along the tongue: hotter and narrower near the valve
        const a = angle + between(-1, 1) * TANK_SPREAD * (0.5 + s);
        const born = s ** 1.4 * TANK_JET_LEN * 0.65;
        const v = TANK_JET_LEN * 0.35 * (0.6 + 0.6 * s) * TANK_SPEED_PER_PX * between(0.85, 1.1);
        const at = { x: x + Math.cos(a) * born, y: y + Math.sin(a) * born };
        const vel = { x: Math.cos(a) * v + carrier.x * DRIFT, y: Math.sin(a) * v + carrier.y * DRIFT };
        const color = TANK_COLORS[Math.min(TANK_COLORS.length - 1, Math.floor((s + Math.random() * 0.2) * TANK_COLORS.length))];
        addHotFlame(state, at, color, vel, (7 + 11 * s) * between(0.85, 1.15), 1 / TANK_LIFE_TICKS);
    }
};

/** A pulse of light at a lit tank: a bright orange flash sprite. */
export const tankFlash = (state: GameState, x: number, y: number): void => {
    if (state.particles.length >= HOT_FLAME_CAP) return;
    createParticles(state, x, y, 1, '#ff9a3c', 'flash', { size: between(20, 28), decay: 0.06, vel: { x: 0, y: 0 } });
};

/** A tank's blast throws its burning fuel: a ball of hot flames flying out in every direction, over the explosion. */
const FUEL_FLAMES = 46;
const FUEL_COLORS = ['#fff1b8', '#ffd166', '#ffa63d', '#ff7a1a', '#f2461c'];

export const fuelFireball = (state: GameState, x: number, y: number): void => {
    createParticles(state, x, y, 1, '#ffe2a8', 'flash', { size: 80, decay: 0.05, vel: { x: 0, y: 0 } });
    for (let i = 0; i < FUEL_FLAMES; i++) {
        const a = Math.random() * Math.PI * 2, v = between(3.5, 11);
        const vel = { x: Math.cos(a) * v, y: Math.sin(a) * v - 1.2 }; // burning fuel climbs as it flies
        addHotFlame(state, { x, y }, pick(FUEL_COLORS), vel, between(12, 24), between(0.018, 0.03));
    }
};

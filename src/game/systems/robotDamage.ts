// Robots do not bleed: they spark and leak dark oil. Shared by the simulation (hit effects) and the client
// (death, torn leg and stump particles), which tells a robot by its build or its preset.
import type { Entity, GameState } from '../../types';
import type { FighterBuild } from '../build/buildParts';
import { presetBuild } from '../build/buildPresets';
import { createParticles } from './effectSpawn';

export const ROBOT_OIL = '#1d1712';
export const ROBOT_SPARK = '#ffd36b';
export const OIL_DECAL = 0x16110c;

export const isRobotBuild = (build?: FighterBuild): boolean => build?.body === 'robot';

/** A stored build wins; without one the fighter wears its preset. */
export const isRobotEntity = (e: Pick<Entity, 'build' | 'skinId'>): boolean => isRobotBuild(e.build ?? presetBuild(e.skinId));

const between = (a: number, b: number) => a + Math.random() * (b - a);

/** Oil drops thrown up and sideways, like blood droplets; with `awayX` (-1 or 1) they all fly to that side. */
export const oilAt = (state: GameState, x: number, y: number, count: number, awayX?: number): void => {
    for (let i = 0; i < count; i++) {
        const vx = awayX ? awayX * between(0, 3) : between(-3, 3);
        createParticles(state, x, y, 1, ROBOT_OIL, 'blood', { vel: { x: vx, y: between(-4, 0) } });
    }
};

/** A burst of hot sparks in every direction. */
export const sparksAt = (state: GameState, x: number, y: number, count: number): void => {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2, speed = between(1, 5);
        createParticles(state, x, y, 1, ROBOT_SPARK, 'spark', { vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed } });
    }
};

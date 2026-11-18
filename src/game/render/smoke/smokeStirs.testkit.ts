// Shared helpers for the SmokeStirs tests: game-state pieces and a state the collector can read.

import type { FlameAir } from './flameAir';
import type { Stir } from './airGrid';
import { Beam, Entity, GameState, Particle, Projectile, WeaponType } from '../../../types';

export const projectile = (id: string, x: number, y: number, vx: number, vy: number, type = WeaponType.ROCKET_LAUNCHER): Projectile =>
    ({ id, ownerId: 'a', pos: { x, y }, vel: { x: vx, y: vy }, type, radius: 4, active: true });
export const ring = (id: string, x: number, y: number, size = 12): Particle =>
    ({ id, pos: { x, y }, vel: { x: 0, y: 0 }, life: 1, decay: 0.05, color: '#fff', size, type: 'ring' });
export const beam = (id: string, sx: number, sy: number, ex: number, ey: number): Beam =>
    ({ id, start: { x: sx, y: sy }, end: { x: ex, y: ey }, color: '#0ff', life: 1, width: 4 });
export const fighter = (vx: number, vy: number, dead = false): Entity =>
    ({ id: 'p1', pos: { x: 100, y: 400 }, vel: { x: vx, y: vy }, width: 20, height: 60, dead } as Entity);

/** The parts of a game state the collector reads. */
export const frame = (f: Partial<Pick<GameState, 'projectiles' | 'particles' | 'beams' | 'players'>> = {}): GameState =>
    ({ projectiles: [], particles: [], beams: [], players: [], ...f }) as unknown as GameState;

export const flameWith = (streams: { x: number; y: number; angle: number; firing: boolean; power: number }[]): FlameAir => ({
    streams: () => streams,
    soot: () => [],
});

export const gaps = (out: Stir[]) => out.slice(1).map((s, i) => Math.hypot(s.x - out[i].x, s.y - out[i].y));

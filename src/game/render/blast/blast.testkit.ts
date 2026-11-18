// Shared helpers for the render/blast tests: rings, debris and rockets in a frame, and counts of the sprites shown.
// Each test file mocks '../flame/flameTextures' itself (jsdom has no canvas).

import type { Container } from 'pixi.js';
import { WeaponType, type GameState, type Particle, type Projectile } from '../../../types';
import { frameOf, stateOf, VIEW } from '../smoke/cloudField.testkit';
import type { SmokeFrame } from '../smoke/cloudField';
import type { SmokeQuality } from '../smoke/smokeTuning';
import type { BlastFx } from './blastFx';

export const ring = (id: string, x = 400, y = 400, size = 12): Particle =>
    ({ id, pos: { x, y }, vel: { x: 0, y: 0 }, life: 1, decay: 0.017, color: '#fff', size, type: 'ring' });
export const debris = (id: string, x: number, life = 1): Particle =>
    ({ id, pos: { x, y: 300 }, vel: { x: 5, y: 0 }, life, decay: 0.01, color: '#333', size: 3, type: 'debris' });
export const rocket = (x: number): Projectile =>
    ({ id: 'rk', pos: { x, y: 200 }, vel: { x: 12, y: 0 }, type: WeaponType.ROCKET_LAUNCHER }) as unknown as Projectile;

export const frame = (over: Partial<GameState>, quality: SmokeQuality = 'high'): SmokeFrame => frameOf(stateOf(over), VIEW, quality);
/** Live sprites per layer: trail and simple smoke, fireball, nozzle glows, flash. */
export const shown = (c: Container) => c.children.filter(k => k.visible).length;
export const layers = (fx: BlastFx) => {
    const [smoke, , fire, nozzle, flash] = fx.layer.children as Container[];
    return { smoke: shown(smoke), fire: shown(fire), nozzle: shown(nozzle), flash: shown(flash) };
};


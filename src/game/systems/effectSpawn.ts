// Low-level cosmetic spawners: particles written into GameState.
// Only display code calls these (via effects.ts) — the simulation emits events instead.

import { GameState, Particle, ParticleKind } from '../../types';
import { nextId } from '../utils/id';

// --- Particles ---

// Above this many live particles, the costly soft kinds (smoke, puff, dust) are not spawned
export const PARTICLE_BUDGET = 500;
const BUDGETED_KINDS: ReadonlySet<ParticleKind> = new Set(['smoke', 'puff', 'dust', 'soot']);

const between = (min: number, max: number) => min + Math.random() * (max - min);

// Decay is life lost per physics tick (120/s); a range is picked uniformly
const decayFor = (type: ParticleKind): number => {
    switch (type) {
        case 'flash': return 0.1;
        case 'fireball': return 0.015;
        case 'ring': return 0.017;
        case 'smoke': return 0.009;
        case 'soot': return 0.007;
        case 'debris': return between(0.013, 0.018);
        case 'puff': return 0.024;
        case 'dust': return 0.014;
        case 'ember': return between(0.010, 0.017);
        case 'spark': return between(0.014, 0.028);
        case 'blood': return between(0.012, 0.021);
        default: return between(0.02, 0.05); // fire, shell
    }
};

const sizeFor = (type: ParticleKind): number => {
    switch (type) {
        case 'smoke': return between(5, 15);
        case 'soot': return between(10, 18);
        case 'debris': return 3;
        case 'shell': return 3;
        case 'ember': return between(2, 4);
        case 'dust': return between(2, 3.5);
        case 'blood': return between(1.5, 2.5);
        default: return between(2, 4);
    }
};

export type ParticleOverrides = Partial<Pick<Particle, 'decay' | 'size' | 'vel'>>;

export const createParticles = (
    state: GameState, x: number, y: number, count: number, color: string,
    type: ParticleKind = 'spark', overrides: ParticleOverrides = {}
): Particle[] => {
    const added: Particle[] = [];
    if (BUDGETED_KINDS.has(type) && state.particles.length > PARTICLE_BUDGET) return added;
    for (let i = 0; i < count; i++) {
        const particle: Particle = {
            id: nextId('pt_'),
            pos: { x, y },
            // Copied so particles sharing one override never share a mutable vector
            vel: overrides.vel ? { ...overrides.vel } : {
                x: (Math.random() - 0.5) * (type === 'shell' ? 4 : 10),
                y: (Math.random() - 0.5) * (type === 'shell' ? 4 : 10)
            },
            life: 1.0,
            decay: overrides.decay ?? decayFor(type),
            color,
            size: overrides.size ?? sizeFor(type),
            type,
            rotation: Math.random() * Math.PI * 2
        };
        state.particles.push(particle);
        added.push(particle);
    }
    return added;
};

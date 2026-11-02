// Low-level cosmetic spawners: particles and ragdolls written into GameState.
// Only display code calls these (via effects.ts) — the simulation emits events instead.

import { GameState, Entity, RagdollPart, Particle, ParticleKind } from '../../types';
import type { RagdollColors } from './events';
import { nextId } from '../utils/id';

// --- Ragdoll ---

export const createRagdoll = (state: GameState, entity: Pick<Entity, 'pos' | 'height' | 'color'>, colors?: RagdollColors) => {
    const randomForce = () => (Math.random() - 0.5) * 10;
    const c = colors ?? { head: entity.color, torso: entity.color, arm: entity.color, leg: entity.color };
    const parts: RagdollPart[] = [
        {
            id: nextId('rag_'), type: 'head',
            pos: { x: entity.pos.x, y: entity.pos.y - entity.height + 5 },
            vel: { x: randomForce(), y: -Math.random() * 8 },
            rotation: 0, angularVel: (Math.random() - 0.5) * 0.3,
            life: 5, color: c.head, build: c.build, isGrounded: false
        },
        {
            id: nextId('rag_'), type: 'torso',
            pos: { x: entity.pos.x, y: entity.pos.y - entity.height / 2 },
            vel: { x: randomForce() * 0.5, y: -Math.random() * 5 },
            rotation: 0, angularVel: (Math.random() - 0.5) * 0.2,
            life: 5, color: c.torso, build: c.build, isGrounded: false
        },
        {
            id: nextId('rag_'), type: 'arm-left',
            pos: { x: entity.pos.x - 10, y: entity.pos.y - entity.height / 2 },
            vel: { x: -Math.random() * 8, y: -Math.random() * 6 },
            rotation: 0, angularVel: (Math.random() - 0.5) * 0.5,
            life: 4, color: c.arm, build: c.build, isGrounded: false
        },
        {
            id: nextId('rag_'), type: 'arm-right',
            pos: { x: entity.pos.x + 10, y: entity.pos.y - entity.height / 2 },
            vel: { x: Math.random() * 8, y: -Math.random() * 6 },
            rotation: 0, angularVel: (Math.random() - 0.5) * 0.5,
            life: 4, color: c.arm, build: c.build, isGrounded: false
        },
        {
            id: nextId('rag_'), type: 'leg-left',
            pos: { x: entity.pos.x - 5, y: entity.pos.y - 10 },
            vel: { x: -Math.random() * 5, y: -Math.random() * 4 },
            rotation: 0, angularVel: (Math.random() - 0.5) * 0.4,
            life: 4.5, color: c.leg, build: c.build, isGrounded: false
        },
        {
            id: nextId('rag_'), type: 'leg-right',
            pos: { x: entity.pos.x + 5, y: entity.pos.y - 10 },
            vel: { x: Math.random() * 5, y: -Math.random() * 4 },
            rotation: 0, angularVel: (Math.random() - 0.5) * 0.4,
            life: 4.5, color: c.leg, build: c.build, isGrounded: false
        }
    ];

    state.ragdollParts.push(...parts);
};

// --- Particles ---

// Above this many live particles, the costly soft kinds (smoke, puff, dust) are not spawned
export const PARTICLE_BUDGET = 500;
const BUDGETED_KINDS: ReadonlySet<ParticleKind> = new Set(['smoke', 'puff', 'dust']);

const between = (min: number, max: number) => min + Math.random() * (max - min);

// Decay is life lost per physics tick (120/s); a range is picked uniformly
const decayFor = (type: ParticleKind): number => {
    switch (type) {
        case 'flash': return 0.1;
        case 'fireball': return 0.015;
        case 'ring': return 0.017;
        case 'smoke': return 0.009;
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

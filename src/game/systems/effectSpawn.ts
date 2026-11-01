// Low-level cosmetic spawners: particles and ragdolls written into GameState.
// Only display code calls these (via effects.ts) — the simulation emits events instead.

import { GameState, Entity, RagdollPart } from '../../types';
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
            life: 5, color: c.head, isGrounded: false
        },
        {
            id: nextId('rag_'), type: 'torso',
            pos: { x: entity.pos.x, y: entity.pos.y - entity.height / 2 },
            vel: { x: randomForce() * 0.5, y: -Math.random() * 5 },
            rotation: 0, angularVel: (Math.random() - 0.5) * 0.2,
            life: 5, color: c.torso, isGrounded: false
        },
        {
            id: nextId('rag_'), type: 'arm-left',
            pos: { x: entity.pos.x - 10, y: entity.pos.y - entity.height / 2 },
            vel: { x: -Math.random() * 8, y: -Math.random() * 6 },
            rotation: 0, angularVel: (Math.random() - 0.5) * 0.5,
            life: 4, color: c.arm, isGrounded: false
        },
        {
            id: nextId('rag_'), type: 'arm-right',
            pos: { x: entity.pos.x + 10, y: entity.pos.y - entity.height / 2 },
            vel: { x: Math.random() * 8, y: -Math.random() * 6 },
            rotation: 0, angularVel: (Math.random() - 0.5) * 0.5,
            life: 4, color: c.arm, isGrounded: false
        },
        {
            id: nextId('rag_'), type: 'leg-left',
            pos: { x: entity.pos.x - 5, y: entity.pos.y - 10 },
            vel: { x: -Math.random() * 5, y: -Math.random() * 4 },
            rotation: 0, angularVel: (Math.random() - 0.5) * 0.4,
            life: 4.5, color: c.leg, isGrounded: false
        },
        {
            id: nextId('rag_'), type: 'leg-right',
            pos: { x: entity.pos.x + 5, y: entity.pos.y - 10 },
            vel: { x: Math.random() * 5, y: -Math.random() * 4 },
            rotation: 0, angularVel: (Math.random() - 0.5) * 0.4,
            life: 4.5, color: c.leg, isGrounded: false
        }
    ];

    state.ragdollParts.push(...parts);
};

// --- Particles ---

export const createParticles = (state: GameState, x: number, y: number, count: number, color: string, type: 'blood' | 'spark' | 'smoke' | 'fire' | 'shell' = 'spark') => {
    for (let i = 0; i < count; i++) {
        state.particles.push({
            id: nextId('pt_'),
            pos: { x, y },
            vel: {
                x: (Math.random() - 0.5) * (type === 'shell' ? 4 : 10),
                y: (Math.random() - 0.5) * (type === 'shell' ? 4 : 10)
            },
            life: 1.0,
            decay: 0.02 + Math.random() * 0.03,
            color,
            size: type === 'smoke' ? 5 + Math.random() * 10 : (type === 'shell' ? 3 : 2 + Math.random() * 2),
            type,
            rotation: Math.random() * Math.PI * 2
        });
    }
};

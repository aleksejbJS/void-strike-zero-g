// Cosmetic effects as events (multiplayer phase 2, decision E1).
// The simulation only announces effects ("explosion here", "25 damage there").
// Whoever displays the game turns events into particles with applyEffectEvent,
// so offline play and every online client look the same.

import { Entity, GameState, Projectile, WeaponType } from '../../types';
import { gameEvents, GameEvent, EffectKind } from './events';
import { nextId } from '../utils/id';
import { createParticles, createRagdoll } from './effectSpawn';
import { addMark, addMarkAt } from './marks';
import { FLAME_PALETTE } from '../render/fighter/parts/flamePalette';

// --- Emitters (called by the simulation) ---

export const emitEffect = (effect: EffectKind, x: number, y: number, color?: string, count?: number) =>
    gameEvents.emit({ type: 'EFFECT', effect, x, y, color, count });

export const emitDamage = (x: number, y: number, amount: number) =>
    gameEvents.emit({ type: 'DAMAGE', x, y, amount: Math.round(amount) });

export const emitDeath = (e: Entity) =>
    gameEvents.emit({
        type: 'DEATH', x: e.pos.x, y: e.pos.y, color: e.color, height: e.height,
        parts: {
            head: e.headColor || e.color,
            torso: e.torsoColor || e.color,
            arm: e.armColor || e.color,
            leg: e.legColor || '#475569',
        },
    });

export const emitText = (x: number, y: number, text: string, color: string) =>
    gameEvents.emit({ type: 'FLOAT_TEXT', x, y, text, color });

// --- Display side ---

const floatText = (state: GameState, x: number, y: number, text: string, color: string) =>
    state.floatingTexts.push({ id: nextId('ft_'), pos: { x, y }, text, color, life: 1, velY: 1 });

// --- Compositions: what each announced effect is made of ---

const between = (min: number, max: number) => min + Math.random() * (max - min);

/** Run `spawn` once per particle, so each one rolls its own velocity and size. */
const each = (n: number, spawn: () => void) => { for (let i = 0; i < n; i++) spawn(); };

const STILL = { x: 0, y: 0 };

const SCORCH_RADIUS = 18;

// Flash, fireball and ring are stationary; the view grows them over their life
const explosionAt = (state: GameState, x: number, y: number) => {
    // The impact point sits just outside the wall; a blast in mid-air leaves nothing
    addMarkAt(state.platforms, x, y, SCORCH_RADIUS, SCORCH_RADIUS);
    createParticles(state, x, y, 1, '#ffffff', 'flash', { size: 40, vel: STILL });
    createParticles(state, x, y, 1, '#f97316', 'fireball', { size: 12, vel: STILL });
    createParticles(state, x, y, 1, '#fdba74', 'ring', { size: 10, vel: STILL });
    each(14, () => createParticles(state, x, y, 1, '#fbbf24', 'ember', {
        vel: { x: between(-5, 5), y: between(-6, 1) },
    }));
    each(6, () => createParticles(state, x, y, 1, '#9ca3af', 'smoke', {
        size: between(6, 12), vel: { x: between(-0.6, 0.6), y: between(-0.9, -0.3) },
    }));
};

const sparkAt = (state: GameState, x: number, y: number, color: string, count: number) => {
    createParticles(state, x, y, 1, color, 'flash', { size: 16, decay: 0.07, vel: STILL });
    each(count, () => {
        const angle = Math.random() * Math.PI * 2;
        const speed = between(1, 6);
        createParticles(state, x, y, 1, color, 'spark', { vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed } });
    });
};

const bloodAt = (state: GameState, x: number, y: number, count: number, color: string) =>
    each(count, () => createParticles(state, x, y, 1, color, 'blood', { vel: { x: between(-3, 3), y: between(-4, 0) } }));

/** Turn one event into particles/decals/ragdolls/texts. Non-effect events are ignored. */
export const applyEffectEvent = (state: GameState, e: GameEvent) => {
    switch (e.type) {
        case 'EFFECT':
            switch (e.effect) {
                case 'explosion':
                    explosionAt(state, e.x, e.y);
                    break;
                case 'blood':
                    bloodAt(state, e.x, e.y, e.count ?? 6, e.color ?? '#ef4444');
                    break;
                case 'spark':
                    sparkAt(state, e.x, e.y, e.color ?? '#ffffff', e.count ?? 8);
                    addMark(state.platforms, e.x, e.y);
                    break;
                case 'respawn':
                    createParticles(state, e.x, e.y, 20, '#ffffff', 'spark');
                    break;
                case 'shell':
                    state.particles.push({
                        id: nextId('pt_'), pos: { x: e.x, y: e.y },
                        vel: { x: (Math.random() - 0.5) * 4, y: -2 - Math.random() * 2 },
                        life: 1, decay: 0.05, color: '#fbbf24', size: 3, type: 'shell', rotation: Math.random() * Math.PI
                    });
                    break;
            }
            break;
        case 'DAMAGE':
            floatText(state, e.x, e.y, String(e.amount), '#ef4444');
            break;
        case 'DEATH':
            bloodAt(state, e.x, e.y, 40, e.color);
            state.decals.push({
                id: nextId('dc_'), pos: { x: e.x, y: e.y + 20 },
                rotation: Math.random() * Math.PI * 2, scale: 1 + Math.random(), color: 0x7f1d1d, alpha: 0.8
            });
            createRagdoll(state, { pos: { x: e.x, y: e.y }, height: e.height, color: e.color }, e.parts);
            break;
        case 'FLOAT_TEXT':
            floatText(state, e.x, e.y, e.text, e.color);
            break;
    }
};

// --- Continuous trails (too frequent for events; derived from state every tick) ---

/** Jetpack flame behind a flying entity. `thrustX` tilts it opposite to sideways thrust. */
export const jetpackTrail = (state: GameState, p: Entity, thrustX = 0, intense = false) => {
    if (Math.random() >= 0.5) return;
    const color = FLAME_PALETTE[p.build?.flame ?? 'fire'].particle;
    createParticles(state, p.pos.x - thrustX * 30, p.pos.y + 18, intense ? 2 : 1, color, 'fire');
};

// Smoke leaves a rocket from its tail, so the puffs do not cover the drawn hull
const ROCKET_TAIL = 10;

/** Smoke behind rockets: small puffs born at the tail, 10 px back along the flight direction. */
export const projectileTrail = (state: GameState, proj: Projectile) => {
    if (proj.type !== WeaponType.ROCKET_LAUNCHER || Math.random() >= 0.5) return;
    const speed = Math.hypot(proj.vel.x, proj.vel.y) || 1; // a rocket at rest has no heading: spawn on it
    const x = proj.pos.x - (proj.vel.x / speed) * ROCKET_TAIL;
    const y = proj.pos.y - (proj.vel.y / speed) * ROCKET_TAIL;
    createParticles(state, x, y, 1, '#9ca3af', 'smoke', { size: 3 + Math.random() * 2 });
};

// Cosmetic effects as events (multiplayer phase 2, decision E1).
// The simulation only announces effects ("explosion here", "25 damage there").
// Whoever displays the game turns events into particles with applyEffectEvent,
// so offline play and every online client look the same.

import { Entity, GameState, Projectile, Vector2, WeaponType } from '../../types';
import { gameEvents, GameEvent, DeathEvent, EffectKind, LimbEvent, RagdollColors } from './events';
import type { DeathKind } from './deathKind';
import { nextId } from '../utils/id';
import { createParticles } from './effectSpawn';
import { addCorpse, addLimb } from './ragdoll/corpses';
import { pushCorpses } from './ragdoll/corpsePush';
import { explosionBurst } from './explosionFx';
import { addMark, addMarkAt } from './marks';
import { flameColors } from '../render/fighter/parts/flamePalette';
import { sanitizeBuild } from '../build/sanitizeBuild';
import { presetBuild } from '../build/buildPresets';
import { insideSmoke } from './smoke';
import { applyCoverEvent } from './coverEffects';

// The blast without its scorch mark (marks are page-wide: the menu preview must not leave any)
export { explosionBurst };

// --- Emitters (called by the simulation) ---

export const emitEffect = (effect: EffectKind, x: number, y: number, color?: string, count?: number) =>
    gameEvents.emit({ type: 'EFFECT', effect, x, y, color, count });

export const emitDamage = (x: number, y: number, amount: number) =>
    gameEvents.emit({ type: 'DAMAGE', x, y, amount: Math.round(amount) });

export const emitDeath = (e: Entity, kind: DeathKind = 'fall', from?: Vector2, blast = false, tank?: string) =>
    gameEvents.emit(deathEvent(e, kind, from, blast, tank));

/**
 * The DEATH event for an entity: where it fell, how it died, how it moved and the colours of its corpse.
 * `blast`: an explosion's splash killed it; always sent, false for a shot and every other cause
 * (only events from older hosts lack it). `oneLeg`: it was wounded, so its corpse has no second leg to lose.
 * `tank`: the id of the lit fuel tank the corpse carries (only set when there is one).
 */
export const deathEvent = (e: Entity, kind: DeathKind = 'fall', from?: Vector2, blast = false, tank?: string): DeathEvent => ({
    type: 'DEATH', x: e.pos.x, y: e.pos.y, color: e.color, height: e.height,
    kind, from: from && { ...from }, vel: { ...e.vel }, facing: e.facingRight ? 1 : -1, weapon: e.weapon.type, blast,
    oneLeg: !!e.wound, parts: ragdollColors(e), ...(tank !== undefined && { tank }),
});

/** The colours (and build) of the body parts that fly off a fighter: its corpse and its torn-off leg. */
export const ragdollColors = (e: Entity): RagdollColors => ({
    head: e.headColor || e.color,
    torso: e.torsoColor || e.color,
    arm: e.armColor || e.color,
    leg: e.legColor || '#475569',
    jet: e.jetpackColor,
    build: e.build ?? presetBuild(e.skinId),
});

/** A fighter survived a railgun beam but lost a leg: the leg flies off (see LimbEvent). */
export const emitLimb = (e: Entity, from?: Vector2) =>
    gameEvents.emit({
        type: 'LIMB', x: e.pos.x, y: e.pos.y, facing: e.facingRight ? 1 : -1, vel: { ...e.vel },
        from: from && { ...from }, parts: ragdollColors(e),
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

/** Droplets when a leg is torn off (a death throws 40); the blood is plain red, there is no victim colour to tint it. */
const LIMB_BLOOD = 24;
const LIMB_BLOOD_COLOR = '#ef4444';

const explosionAt = (state: GameState, x: number, y: number, scale?: number) => {
    // The impact point sits just outside the wall; a blast in mid-air leaves nothing
    addMarkAt(state.platforms, x, y, SCORCH_RADIUS, SCORCH_RADIUS);
    explosionBurst(state, x, y, scale);
};

const sparkAt = (state: GameState, x: number, y: number, color: string, count: number) => {
    createParticles(state, x, y, 1, color, 'flash', { size: 16, decay: 0.07, vel: STILL });
    each(count, () => {
        const angle = Math.random() * Math.PI * 2;
        const speed = between(1, 6);
        createParticles(state, x, y, 1, color, 'spark', { vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed } });
    });
};

/** Droplets thrown up and sideways; with `awayX` (-1 or 1) they all fly to that side. */
const bloodAt = (state: GameState, x: number, y: number, count: number, color: string, awayX?: number) =>
    each(count, () => {
        const vx = awayX ? awayX * between(0, 3) : between(-3, 3);
        createParticles(state, x, y, 1, color, 'blood', { vel: { x: vx, y: between(-4, 0) } });
    });

/** -1 or 1: the side away from the hit, or undefined when it came from straight above/below or is unknown. */
const sideAway = (x: number, from?: Vector2) => (from && from.x !== x ? Math.sign(x - from.x) : undefined);

/** The colours come from the host and so does the build: unknown part ids would throw while drawing. */
const safeParts = (parts?: RagdollColors) => parts && { ...parts, build: parts.build && sanitizeBuild(parts.build) };

/** Turn one event into particles/decals/corpses/texts. Non-effect events are ignored. */
export const applyEffectEvent = (state: GameState, e: GameEvent) => {
    switch (e.type) {
        case 'EFFECT':
            switch (e.effect) {
                case 'explosion':
                    explosionAt(state, e.x, e.y, e.size);
                    pushCorpses(state.corpses, e.x, e.y, e.size);
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
            bloodAt(state, e.x, e.y, 40, e.color, sideAway(e.x, e.from));
            state.decals.push({
                id: nextId('dc_'), pos: { x: e.x, y: e.y + 20 },
                rotation: Math.random() * Math.PI * 2, scale: 1 + Math.random(), color: 0x7f1d1d, alpha: 0.8
            });
            addCorpse(state, { ...e, parts: safeParts(e.parts) });
            break;
        case 'LIMB': {
            const leg = addLimb(state, { ...e, parts: safeParts(e.parts) });
            const hip = leg.points.hip; // the leg starts where the fighter stands: the wound is at its hip
            bloodAt(state, hip.x, hip.y, LIMB_BLOOD, LIMB_BLOOD_COLOR, sideAway(e.x, e.from));
            break;
        }
        case 'FLOAT_TEXT':
            floatText(state, e.x, e.y, e.text, e.color);
            break;
        case 'COVER':
            applyCoverEvent(state, e);
            break;
    }
};

// --- Continuous trails (too frequent for events; derived from state every tick) ---

/** Jetpack flame behind a flying entity. `thrustX` tilts it opposite to sideways thrust. None for a fighter hidden in smoke. */
export const jetpackTrail = (state: GameState, p: Entity, thrustX = 0, intense = false, now = Date.now()) => {
    if (Math.random() >= 0.5) return;
    if (insideSmoke(state, { x: p.pos.x, y: p.pos.y - p.height / 2 }, now)) return; // the trail would give them away
    const color = flameColors(p.build?.flame ?? 'fire').particle;
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

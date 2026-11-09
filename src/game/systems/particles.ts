// Handling update logic for particles, decals and floating texts (corpses: ragdoll/corpses.ts)
// Extracted from physics.ts main loop

import { GameState, Particle, ParticleKind } from '../../types';
import { GRAVITY } from '../../constants';
import { debrisTrail } from './explosionFx';

// Kinds that never move: the renderer animates them by life alone
const FADE_ONLY: ReadonlySet<ParticleKind | undefined> = new Set(['flash', 'fireball', 'ring', 'puff']);

// Upward pull on a hot flame, px per tick per tick
const FLAME_RISE = 0.035;

// Bodies standing on a platform overlap its top by a sub-pixel slop; droplets born at their feet count as above it
const LANDING_SLOP = 2;

// Stops a falling droplet that crossed the top of a platform (give or take the slop) during this tick
const landOnPlatform = (state: GameState, p: Particle, prevY: number) => {
    for (const plat of state.platforms) {
        if (p.pos.x > plat.x && p.pos.x < plat.x + plat.w && prevY <= plat.y + LANDING_SLOP && p.pos.y >= plat.y) {
            p.vel.x = 0;
            p.vel.y = 0;
            p.pos.y = plat.y;
            return;
        }
    }
};

const bounceShell = (state: GameState, p: Particle) => {
    p.vel.y += GRAVITY;
    p.rotation = (p.rotation || 0) + p.vel.x * 0.1;
    state.platforms.forEach(plat => {
        if (p.pos.y > plat.y && p.pos.y < plat.y + plat.h && p.pos.x > plat.x && p.pos.x < plat.x + plat.w) {
            if (Math.abs(p.vel.y) > 1) {
                p.vel.y *= -0.5;
                p.pos.y = plat.y;
            } else {
                p.vel.y = 0;
                p.vel.x *= 0.8;
            }
        }
    });
};

// Moves one particle by its velocity, then applies the forces of its kind
const stepParticle = (state: GameState, p: Particle) => {
    const prevY = p.pos.y;
    p.pos.x += p.vel.x;
    p.pos.y += p.vel.y;
    switch (p.type) {
        case 'shell':
        case 'magazine': // an ejected magazine tumbles and bounces like a big casing
            bounceShell(state, p);
            break;
        case 'spark':
        case 'ember':
            p.vel.y += GRAVITY * 0.6;
            p.vel.x *= 0.96;
            p.vel.y *= 0.96;
            break;
        case 'blood':
            p.vel.y += GRAVITY;
            landOnPlatform(state, p, prevY);
            break;
        case 'debris':
            // Heavy chunks: fall, slow down a little, leave soot behind
            p.vel.y += GRAVITY * 0.45;
            p.vel.x *= 0.985;
            p.vel.y *= 0.985;
            debrisTrail(state, p.pos.x, p.pos.y, p.life, p.size);
            break;
        case 'soot':
            p.vel.x *= 0.97;
            p.vel.y = Math.min(0, p.vel.y * 0.985);
            break;
        case 'smoke':
            p.vel.y -= 0.02;
            p.vel.x *= 0.98;
            p.vel.y = Math.min(0, p.vel.y * 0.98);
            break;
        case 'dust':
            p.vel.x *= 0.94;
            p.vel.y *= 0.94;
            break;
        case 'flame':
            // A hot flame slows like fire and rises a little, so a long stream curls up at its end
            p.vel.x *= 0.9;
            p.vel.y = p.vel.y * 0.9 - FLAME_RISE;
            break;
        default: // fire and untyped
            if (p.type !== 'fire') p.vel.y += GRAVITY * 0.1;
            p.vel.x *= 0.9;
            p.vel.y *= 0.9;
    }
};

export const updateParticles = (state: GameState) => {
    state.particles.forEach(p => {
        if (!FADE_ONLY.has(p.type)) stepParticle(state, p);
        p.life -= p.decay;
    });
    state.particles = state.particles.filter(p => p.life > 0);
};

export const updateFloatingTexts = (state: GameState) => {
    state.floatingTexts.forEach(t => { t.pos.y -= t.velY; t.life -= 0.02; });
    state.floatingTexts = state.floatingTexts.filter(t => t.life > 0);
};

export const updateDecals = (state: GameState, now: number) => {
    // Remove corpses older than 10 seconds
    const corpseLifetime = 10000;
    state.decals = state.decals.filter(d => {
        if ((d as any).isCorpse && d.createdAt) {
            return (now - d.createdAt) < corpseLifetime;
        }
        return true;
    });
    // Limit total decals to prevent memory issues
    if (state.decals.length > 50) state.decals.shift();
};

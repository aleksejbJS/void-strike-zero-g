// Handling update logic for particles, decals, floating texts, and ragdoll parts
// Extracted from physics.ts main loop

import { GameState, Particle, ParticleKind } from '../../types';
import { GRAVITY } from '../../constants';

// Kinds that never move: the renderer animates them by life alone
const FADE_ONLY: ReadonlySet<ParticleKind | undefined> = new Set(['flash', 'fireball', 'ring', 'puff']);

// Stops a falling droplet that crossed the top of a platform during this tick
const landOnPlatform = (state: GameState, p: Particle, prevY: number) => {
    for (const plat of state.platforms) {
        if (p.pos.x > plat.x && p.pos.x < plat.x + plat.w && prevY <= plat.y && p.pos.y >= plat.y) {
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
        case 'smoke':
            p.vel.y -= 0.02;
            p.vel.x *= 0.98;
            p.vel.y = Math.min(0, p.vel.y * 0.98);
            break;
        case 'dust':
            p.vel.x *= 0.94;
            p.vel.y *= 0.94;
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

export const updateRagdolls = (state: GameState) => {
    state.ragdollParts.forEach(part => {
        // Apply gravity
        part.vel.y += GRAVITY;

        // Apply velocity
        part.pos.x += part.vel.x;
        part.pos.y += part.vel.y;

        // Apply rotation
        part.rotation += part.angularVel;

        // Ground collision
        part.isGrounded = false;
        state.platforms.forEach(plat => {
            if (part.pos.y > plat.y && part.pos.y < plat.y + plat.h &&
                part.pos.x > plat.x && part.pos.x < plat.x + plat.w) {
                if (part.vel.y > 0) {
                    part.pos.y = plat.y;
                    part.vel.y *= -0.3; // Bounce
                    part.vel.x *= 0.8; // Friction
                    part.angularVel *= 0.7; // Slow rotation
                    part.isGrounded = true;

                    // Stop if moving too slow
                    if (Math.abs(part.vel.y) < 0.5) part.vel.y = 0;
                    if (Math.abs(part.vel.x) < 0.1) part.vel.x = 0;
                    if (Math.abs(part.angularVel) < 0.02) part.angularVel = 0;
                }
            }
        });

        // Air resistance
        if (!part.isGrounded) {
            part.vel.x *= 0.98;
            part.angularVel *= 0.98;
        }

        // Fade out
        part.life -= 0.02;
    });

    // Remove dead ragdoll parts
    state.ragdollParts = state.ragdollParts.filter(p => p.life > 0);
};

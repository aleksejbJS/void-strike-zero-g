// Handling update logic for particles, decals, floating texts, and ragdoll parts
// Extracted from physics.ts main loop

import { GameState } from '../../types';
import { GRAVITY } from '../../constants';

export const updateParticles = (state: GameState) => {
    state.particles.forEach(p => {
        p.pos.x += p.vel.x;
        p.pos.y += p.vel.y;
        if (p.type === 'shell') {
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
        } else {
            if (p.type !== 'fire') p.vel.y += GRAVITY * 0.1;
            p.vel.x *= 0.9;
            p.vel.y *= 0.9;
        }
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

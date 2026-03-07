// Pendulum grapple physics — rope constraint with swing mechanics
// Replaces the old constant-pull grapple from physics.ts

import { Entity, Vector2 } from '../../types';
import { distance, normalize, dot } from '../utils/math';
import {
    HOOK_REEL_SPEED,
    HOOK_EXTEND_SPEED,
    HOOK_RELEASE_BOOST,
    HOOK_MIN_LENGTH,
    HOOK_RANGE,
} from '../../constants';

export interface GrappleInput {
    wantsReel: boolean;    // W key while hooked
    wantsExtend: boolean;  // S key while hooked
}

/**
 * Apply pendulum grapple constraint to a player.
 * Call AFTER gravity and inputs are applied, BEFORE friction/speed limits.
 * Modifies player.pos, player.vel, and player.grapple.length in place.
 */
export const applyGrapplePhysics = (p: Entity, input: GrappleInput): void => {
    if (!p.grapple.active) return;

    const hookPos = p.grapple.pos;

    // Reel in / extend rope
    if (input.wantsReel) {
        p.grapple.length = Math.max(HOOK_MIN_LENGTH, p.grapple.length - HOOK_REEL_SPEED);
    }
    if (input.wantsExtend) {
        p.grapple.length = Math.min(HOOK_RANGE, p.grapple.length + HOOK_EXTEND_SPEED);
    }

    // Rope constraint: if player is beyond rope length, pull them back
    const dist = distance(p.pos, hookPos);
    if (dist <= p.grapple.length) return; // Slack — no constraint needed

    // Direction from player toward hook point
    const dir = normalize({ x: hookPos.x - p.pos.x, y: hookPos.y - p.pos.y });

    // Snap position to rope length
    const overshoot = dist - p.grapple.length;
    p.pos.x += dir.x * overshoot;
    p.pos.y += dir.y * overshoot;

    // Remove the radial (outward) component of velocity, keep tangential
    const radialVel = dot(p.vel, dir);
    if (radialVel < 0) {
        // Moving away from hook — remove that component
        p.vel.x -= dir.x * radialVel;
        p.vel.y -= dir.y * radialVel;
    }
};

/**
 * Apply velocity boost when releasing the grapple.
 * Call once at the moment the player releases the hook button.
 */
export const applyGrappleRelease = (p: Entity): void => {
    const speed = Math.sqrt(p.vel.x * p.vel.x + p.vel.y * p.vel.y);
    if (speed > 0.5) {
        // Boost in current movement direction
        const dir = normalize(p.vel);
        p.vel.x = dir.x * speed * HOOK_RELEASE_BOOST;
        p.vel.y = dir.y * speed * HOOK_RELEASE_BOOST;
    }
};

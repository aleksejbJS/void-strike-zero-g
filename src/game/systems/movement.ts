// Force Pipeline — unified movement system (Soldat-Core)
// Manages all forces per player per tick in strict order:
// 1. Gravity  2. Inputs  3. Jetpack  4. Grapple  5. Friction  6. Speed limits

import { Entity, GameState } from '../../types';
import {
    GRAVITY,
    MOVE_SPEED,
    CROUCH_SPEED,
    PRONE_SPEED,
    GROUND_FRICTION,
    AIR_RESISTANCE,
    AIR_STRAFE_FORCE,
    SOFT_SPEED_CAP,
    HARD_SPEED_CAP,
    SPEED_DECAY_ABOVE_CAP,
    JETPACK_FORCE_UP,
    JETPACK_FORCE_SIDE,
    JETPACK_FORCE_DOWN,
    JETPACK_BOOST_MULT,
    JETPACK_CONSUMPTION,
    JETPACK_RECHARGE,
    JETPACK_SIDE_FUEL_MULT,
} from '../../constants';
import { applyGrapplePhysics, GrappleInput } from './grapple';
import { jetpackTrail } from './effects';

export interface MovementInput {
    inputX: number;       // -1, 0, or 1
    isFlying: boolean;    // wants to use jetpack
    wantsJump: boolean;   // W or Space held
    wantsDown: boolean;   // S held while flying
    wantsReel: boolean;   // W held while grapple active
    wantsExtend: boolean; // S held while grapple active
}

/**
 * Apply all movement forces to a single entity.
 * Call once per tick per player/bot, BEFORE syncing to Matter.js.
 * Optionally pass GameState to emit jetpack particles.
 */
export const applyMovement = (p: Entity, input: MovementInput, state?: GameState): void => {
    // --- 1. Gravity ---
    if (!p.isGrounded) {
        p.vel.y += GRAVITY;
    } else if (p.vel.y <= 0) {
        // Maintain platform contact: tiny downward vel keeps Matter.js collision
        // active when engine gravity=0 (prevents float-drift from solver precision)
        p.vel.y = 0.1;
    }

    // --- 2. Player/Bot horizontal input ---
    if (p.isGrounded) {
        const speed = p.isProne ? PRONE_SPEED : p.isCrouching ? CROUCH_SPEED : MOVE_SPEED;
        p.vel.x += input.inputX * speed;
    } else if (!input.isFlying) {
        // Air strafe — weak control without jetpack
        p.vel.x += input.inputX * AIR_STRAFE_FORCE;
    }

    // --- 3. Jetpack — directional thrust ---
    // Flag travels in snapshots so other clients can draw this player's flame
    p.jetpackOn = input.isFlying && p.jetpackFuel > 0;
    if (p.jetpackOn) {
        let thrustX = 0;
        let thrustY = JETPACK_FORCE_UP;
        let fuelMult = 1.0;

        if (input.inputX !== 0) {
            // Diagonal thrust: up + side
            thrustX = input.inputX * JETPACK_FORCE_SIDE;
            fuelMult = JETPACK_SIDE_FUEL_MULT;
        }
        if (input.wantsDown) {
            // Fast descent
            thrustY = JETPACK_FORCE_DOWN;
        } else if (input.wantsJump && input.inputX === 0) {
            // Pure vertical boost (W + Space, no A/D)
            thrustY = JETPACK_FORCE_UP * JETPACK_BOOST_MULT;
        }

        p.vel.x += thrustX;
        p.vel.y += thrustY;
        p.jetpackFuel = Math.max(0, p.jetpackFuel - JETPACK_CONSUMPTION * fuelMult);

        // Visual: jetpack particles opposite to thrust direction
        if (state) jetpackTrail(state, p, thrustX, fuelMult >= 1);
    }

    // Fuel recharge — ONLY on ground (Soldat-style)
    if (p.isGrounded && !input.isFlying) {
        p.jetpackFuel = Math.min(p.maxFuel, p.jetpackFuel + JETPACK_RECHARGE);
    }

    // --- 4. Grapple (pendulum constraint) ---
    if (p.grapple.active) {
        const grappleInput: GrappleInput = {
            wantsReel: input.wantsReel,
            wantsExtend: input.wantsExtend,
        };
        applyGrapplePhysics(p, grappleInput);
    }

    // --- 5. Friction ---
    if (p.isGrounded) {
        p.vel.x *= GROUND_FRICTION;
    } else {
        p.vel.x *= AIR_RESISTANCE;
    }

    // --- 6. Speed limits (soft cap + hard cap) ---
    const speed = Math.abs(p.vel.x);
    if (speed > SOFT_SPEED_CAP) {
        p.vel.x *= SPEED_DECAY_ABOVE_CAP;
    }
    p.vel.x = Math.max(-HARD_SPEED_CAP, Math.min(HARD_SPEED_CAP, p.vel.x));

    // Vertical limits
    p.vel.y = Math.max(-HARD_SPEED_CAP, Math.min(HARD_SPEED_CAP, p.vel.y));
};

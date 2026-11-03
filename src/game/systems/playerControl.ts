// Player control: turns one tick of input into movement for one entity.
// Shared by the authoritative simulation (physics.ts) and client-side prediction,
// so the server and the predicting client move a player exactly the same way.

import { Entity, GameMode, GameState, Vector2 } from '../../types';
import { HOOK_RANGE, WALK_INPUT } from '../../constants';
import { distance, normalize } from '../utils/math';
import { castRay } from './combat';
import { applyMovement, MovementInput } from './movement';
import { applyGrappleRelease } from './grapple';
import { trackHookUse } from './achievements';

const STANDING_HEIGHT = 72;
const CROUCH_HEIGHT = 45;
const MAP_CEILING_Y = -500;
const HTF_CARRIER_SLOWDOWN = 0.85;

export interface PlayerControls {
    inputX: number;     // -1..1: ±1 runs, ±WALK_INPUT walks
    wantsJump: boolean; // W or Space
    wantsDown: boolean; // S
    isFlying: boolean;  // jetpack thrust this tick
}

export const NO_KEYS: Record<string, boolean> = Object.freeze({}) as Record<string, boolean>;

export const readControls = (p: Entity, keys: Record<string, boolean>): PlayerControls => {
    const wantsJump = !!(keys['Space'] || keys['KeyW']);
    const wantsDown = !!keys['KeyS'];
    let inputX = 0;
    if (keys['KeyA']) inputX -= 1;
    if (keys['KeyD']) inputX += 1;
    // Touch play: a half-pushed move stick walks. Only on the ground: flying and air strafe stay full
    if (keys['Walk'] && p.isGrounded) inputX *= WALK_INPUT;
    return { inputX, wantsJump, wantsDown, isFlying: wantsJump && p.jetpackFuel > 0 };
};

/** Shoulder-to-aim angle, stored on the entity so other clients can render where it points. */
export const updateAim = (p: Entity, aim: Vector2) => {
    p.aim = Math.atan2(aim.y - (p.pos.y - 50), aim.x - p.pos.x);
};

/** Attach the hook on press, release it (with boost) on button up. */
export const updateGrapple = (state: GameState, p: Entity, hookPressed: boolean, aim: Vector2) => {
    if (hookPressed && !p.grapple.active) {
        const dir = normalize({ x: aim.x - p.pos.x, y: aim.y - p.pos.y });
        const hit = castRay(state, { x: p.pos.x, y: p.pos.y }, dir, HOOK_RANGE);
        if (hit) {
            p.grapple.active = true;
            p.grapple.pos = hit;
            p.grapple.length = distance(p.pos, hit);
            if (p.type === 'player') trackHookUse();
        }
    } else if (!hookPressed && p.grapple.active) {
        applyGrappleRelease(p);
        p.grapple.active = false;
    } else if (!hookPressed) {
        p.grapple.active = false;
    }
};

/**
 * Crouch height + Force Pipeline + mode/map limits.
 * Pass `particleState` to emit jetpack particles (omit on the server: they are cosmetic).
 */
export const applyPlayerMovement = (state: GameState, p: Entity, controls: PlayerControls, particleState?: GameState) => {
    if (p.type === 'player') {
        p.isCrouching = controls.wantsDown;
        p.height = p.isCrouching ? CROUCH_HEIGHT : STANDING_HEIGHT;
    }

    const movInput: MovementInput = {
        inputX: controls.inputX,
        isFlying: controls.isFlying,
        wantsJump: controls.wantsJump,
        wantsDown: controls.wantsDown,
        wantsReel: controls.wantsJump && p.grapple.active,
        wantsExtend: controls.wantsDown && p.grapple.active,
    };
    applyMovement(p, movInput, particleState);

    if (state.mode === GameMode.HOLD_THE_FLAG && p.hasFlag === p.team) {
        p.vel.x *= HTF_CARRIER_SLOWDOWN;
    }

    // Top boundary of the map
    if (p.pos.y < MAP_CEILING_Y) {
        p.pos.y = MAP_CEILING_Y;
        if (p.vel.y < 0) p.vel.y = 0;
    }
};

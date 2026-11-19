// Jump (spec 2026-11-19-jump): a fresh press on the ground jumps, one more press in the air is the double
// jump. Neither burns fuel. Part of the Force Pipeline, so the server, the P2P host and client prediction
// jump the same way. The flip of the double jump is drawn by each client from `airJump`.

import { Entity } from '../../types';
import { AIR_JUMP_SPEED, HARD_SPEED_CAP, JUMP_SPEED } from '../../constants';

export interface JumpInput {
    jumpPress: boolean; // the Jump key went down this tick
    inputX: number;     // A/D: the flip goes the way the fighter moves
    facing: -1 | 1;     // ...or the way it faces when it does not move
}

/** No jumping on the hook (W reels in) or on one leg (a wounded fighter only hops). */
const canJump = (p: Entity) => !p.grapple.active && !p.wound;

export function applyJump(p: Entity, input: JumpInput): void {
    if (p.isGrounded && !p.jumpRise) p.airJump = 0;
    if (p.jumpRise && p.vel.y >= -HARD_SPEED_CAP) p.jumpRise = false;
    if (!input.jumpPress || !canJump(p)) return;
    if (p.isGrounded && !p.jumpRise) {
        p.vel.y = -JUMP_SPEED;
        p.jumpRise = true;
    } else if (!p.airJump) {
        p.vel.y = -AIR_JUMP_SPEED;
        p.jumpRise = true;
        p.airJump = (Math.sign(input.inputX) || input.facing) as -1 | 1;
    }
}

/** How fast the fighter may rise: a jump starts faster than the cap the jetpack and rocket jumps keep. */
export const upwardCap = (p: Entity): number => (p.jumpRise ? Math.max(JUMP_SPEED, AIR_JUMP_SPEED) : HARD_SPEED_CAP);

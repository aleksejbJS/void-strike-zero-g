// Per-fighter liveliness read from what is drawn: landing squash, hit flash and the running head bob.
// Pure maths (no Pixi). Landings are found from the history of the feet height, not from isGrounded,
// so remote fighters (drawn slightly in the past) and the predicted local fighter behave the same way.

import { PHYSICS_TICK_RATE } from '../../../constants';
import { FighterState } from './fighterPose';

const FRAME_60_S = 1 / 60;           // fall speed is measured in px per 1/60 s
const MIN_DT_S = 1 / 240;            // keeps two frames drawn at the same instant from exploding the speed
const FALL_SPEED = 3;                // faster than this counts as a real fall
const REST_SPEED = 0.5;              // slower than this after a fall means the feet have stopped
const TELEPORT_PX = 60;              // a jump this big in one frame is a respawn or a zone reset
// Frames come at their own pace while the simulation ticks at a fixed rate, so a frame less than this
// after the last one can show the very same position without the fighter having stopped
const NO_TICK_MS = 1.5 * 1000 / PHYSICS_TICK_RATE;
const FAST_FRAMES_FOR_LANDING = 2;
const SQUASH_MS = 180;
const FLASH_MS = 80;
const HEAD_BOB_AMPLITUDE = 0.05;
export const HOP_PX = 4;            // how high a one-legged fighter springs off the ground on each hop

export interface MotionFrame {
    landed: boolean;  // true for exactly one frame per landing
    squash: number;   // 1 at the landing, easing to 0
    hitFlash: number; // 1 while the fighter is flashing after losing health
}

export class FighterMotion {
    private lastY: number | null = null;
    private lastTime = 0;
    private fastFrames = 0; // consecutive frames of falling fast
    private slowFrames = 0; // frames still moving, but slowly, since the last fast one
    private landedAt = -Infinity;
    private lastHealth: number | null = null;
    private hitAt = -Infinity;

    observe(feetY: number, health: number, nowMs: number): MotionFrame {
        const landed = this.trackFeet(feetY, nowMs);
        if (landed) this.landedAt = nowMs;
        if (this.lastHealth !== null && health < this.lastHealth) this.hitAt = nowMs;
        this.lastHealth = health;
        return {
            landed,
            squash: Math.min(1, Math.max(0, 1 - (nowMs - this.landedAt) / SQUASH_MS)), // clamped: a clock stepping back must not flip the fighter
            hitFlash: nowMs - this.hitAt < FLASH_MS ? 1 : 0,
        };
    }

    /** Follows the feet height; true on the frame a real fall ends. */
    private trackFeet(feetY: number, nowMs: number): boolean {
        if (this.lastY === null) return this.restart(feetY, nowMs);
        const dy = feetY - this.lastY;
        if (Math.abs(dy) > TELEPORT_PX) return this.restart(feetY, nowMs);
        const elapsed = nowMs - this.lastTime;
        // Identical position a moment after the last frame: the simulation has not ticked, so nothing is known yet
        if (dy === 0 && elapsed < NO_TICK_MS) return false;

        const speed = dy / (Math.max(MIN_DT_S, elapsed / 1000) / FRAME_60_S);
        this.lastY = feetY;
        this.lastTime = nowMs;
        return this.followFall(speed);
    }

    /** Counts fast frames of a fall; true on the frame it ends. */
    private followFall(speed: number): boolean {
        if (speed > FALL_SPEED) {
            this.fastFrames = Math.min(this.fastFrames + 1, FAST_FRAMES_FOR_LANDING);
            this.slowFrames = 0;
            return false;
        }
        if (speed >= REST_SPEED) {
            // Still moving slowly: the last short step into the floor, or just a slow descent.
            // One such frame may sit between the fall and the stop; more means the fall has faded out.
            if (++this.slowFrames > 1) this.fastFrames = 0;
            return false;
        }
        const landed = this.fastFrames >= FAST_FRAMES_FOR_LANDING;
        this.fastFrames = this.slowFrames = 0;
        return landed;
    }

    /** Forget the fall history and take this position as the new start. Never a landing. */
    private restart(feetY: number, nowMs: number): false {
        this.lastY = feetY;
        this.lastTime = nowMs;
        this.fastFrames = this.slowFrames = 0;
        return false;
    }
}

/** Head tilt added to the pose while running; twice per stride, like a nod on each step. */
export const headBob = (state: FighterState, phase: number): number =>
    state === 'run' ? Math.sin(2 * phase) * HEAD_BOB_AMPLITUDE
        : state === 'walk' ? Math.sin(2 * phase) * HEAD_BOB_AMPLITUDE * 0.4 : 0;

/**
 * How far (screen px) a one-legged fighter is lifted off the ground. It follows the foot lift of the step
 * (the arc is the half of the cycle the foot is up), so the leg tucks as the body rises and lands with it.
 * Only upright, moving fighters hop: a crawl, a crouch and the air have their own poses.
 */
export const hopLift = (state: FighterState, phase: number, moveDir: number): number =>
    state === 'walk' || state === 'run' ? HOP_PX * Math.max(0, Math.cos(phase) * moveDir) : 0;

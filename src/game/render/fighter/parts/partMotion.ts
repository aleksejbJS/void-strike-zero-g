// Spring-driven motion of the moving parts (tail, floppy ears, lamp, wings). Pure maths, no Pixi.
// Each value chases a target set by the fighter's velocity and state through a critically damped spring,
// so the parts lag, swing and settle instead of snapping. Local space: +x is the way the fighter faces,
// y grows downward.

import { Vector2 } from '../../../../types';
import { FighterState } from '../fighterPose';
import { PartMotionFrame } from './partMotionFrame';

const SPRING_K = 60;             // stiffness of tail and ears; damping is critical: c = 2 * sqrt(k)
const WING_K = 150;              // wings snap open and shut faster than the tail follows
const MAX_STEP_S = 1 / 120;      // the spring is stepped in slices no longer than this, so a frame hitch stays calm
const FULL_SPEED = 300;          // px/s, about the soft speed cap: the tail is fully bent back at this speed
const FULL_FALL = 600;           // px/s of vertical speed that lifts the tail all the way
const VERTICAL_DEADZONE = 60;    // px/s, ignores the small bounce of a fighter standing on the ground
const MAX_LIFT = 0.8;
const FLY_LIFT = -0.6;           // the tail trails low behind a jetpack
const IDLE_WAVE = 2;             // rad/s, the slow wriggle of a fighter standing still
const RUN_WAVE = 8;              // rad/s, the wriggle at full speed
const LAMP_MS = 120;             // the lamp lights up this long after a shot

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Shrink a speed towards zero by `dead`, so only the part beyond the dead zone counts. */
const beyond = (v: number, dead: number) => Math.sign(v) * Math.max(0, Math.abs(v) - dead);

/** The world velocity (px/s) as the fighter sees it: x is multiplied by the facing, so forward is +x for both facings. */
export const localVelocity = (vel: Vector2, facing: number): Vector2 => ({ x: vel.x * facing, y: vel.y });

class Spring {
    value = 0;
    private speed = 0;
    private readonly damping: number;

    constructor(private readonly stiffness: number) {
        this.damping = 2 * Math.sqrt(stiffness);
    }

    step(target: number, dt: number) {
        if (dt <= 0) return;
        const slices = Math.ceil(dt / MAX_STEP_S);
        const h = dt / slices;
        for (let i = 0; i < slices; i++) {
            this.value += this.speed * h;
            this.speed += (this.stiffness * (target - this.value) - this.damping * this.speed) * h;
        }
    }
}

export class PartMotion {
    private readonly lift = new Spring(SPRING_K);
    private readonly bend = new Spring(SPRING_K);
    private readonly flop = new Spring(SPRING_K);
    private readonly wings = new Spring(WING_K);
    private wave = 0;

    /**
     * Advance by `dt` seconds. `localVel` is in px/s (see localVelocity), `firedAgoMs` is the time since the
     * last shot (Infinity before any shot).
     */
    update(dt: number, localVel: Vector2, state: FighterState, firedAgoMs: number): PartMotionFrame {
        const forward = clamp(localVel.x / FULL_SPEED, -1, 1);
        const flying = state === 'fly';
        const fall = clamp(beyond(localVel.y, VERTICAL_DEADZONE) / FULL_FALL, -1, 1);

        this.bend.step(forward, dt);
        this.lift.step(flying ? FLY_LIFT : fall * MAX_LIFT, dt);
        // Air blows floppy ears back when moving forward or falling; backing up never throws them forward
        this.flop.step(clamp(Math.max(forward, 0) + Math.max(fall, 0), 0, 1), dt);
        this.wings.step(flying ? 1 : 0, dt);
        const running = state === 'run' ? Math.abs(forward) : 0;
        this.wave += (IDLE_WAVE + (RUN_WAVE - IDLE_WAVE) * running) * Math.max(0, dt);

        return {
            tailLift: this.lift.value,
            tailBend: this.bend.value,
            tailWave: this.wave,
            earFlop: clamp(this.flop.value, 0, 1),
            lampOn: firedAgoMs < LAMP_MS,
            wingsOpen: clamp(this.wings.value, 0, 1),
        };
    }
}

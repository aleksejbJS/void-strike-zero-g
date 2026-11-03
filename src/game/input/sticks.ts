// Twin-stick maths for touch play: the left stick moves (up = jump / jetpack), the right one aims
// and fires. Pure functions; the sticks only produce the inputs a keyboard and mouse would.

import { Vector2 } from '../../types';

/** A floating stick: where the thumb landed and where it is now, in window pixels. */
export interface Stick {
    originX: number;
    originY: number;
    x: number;
    y: number;
}

export interface Deflection {
    x: number;      // -1..1, right is positive
    y: number;      // -1..1, down is positive
    amount: number; // 0..1, how far from the centre
}

export const STICK_RADIUS = 50;     // px the thumb travels to reach the rim of the move stick
export const AIM_STICK_RADIUS = 64; // the aim stick is wider, so the same thumb move turns the aim less
const MOVE_THRESHOLD = 0.4;         // share of the radius before a move key is pressed
const PRONE_DOWN = 0.6;             // lying down needs the stick mostly downward (and at the edge)
const AIM_DEAD_ZONE = 0.15;         // below this the aim keeps its last direction
// Inside this the aim stick only aims; the weapon fires only with the stick pushed to the edge,
// so a rocket launcher does not spend its ammo while you line up a shot
export const FIRE_THRESHOLD = 0.85;
// The move stick works the same way: inside it walks (or crouches), at the edge it runs (or lies down)
export const RUN_THRESHOLD = 0.85;
export const AIM_REACH = 300;       // world units from the fighter to the aim point
const AIM_SMOOTHING_MS = 70;        // time constant of the aim following the stick

export const deflection = (s: Stick, radius = STICK_RADIUS): Deflection => {
    const dx = s.x - s.originX;
    const dy = s.y - s.originY;
    const length = Math.hypot(dx, dy);
    const scale = length > radius ? radius / length : 1;
    return { x: (dx * scale) / radius, y: (dy * scale) / radius, amount: Math.min(1, length / radius) };
};

export const moveKeys = (d: Deflection) => ({
    KeyW: d.y < -MOVE_THRESHOLD,
    KeyS: d.y > MOVE_THRESHOLD,
    KeyA: d.x < -MOVE_THRESHOLD,
    KeyD: d.x > MOVE_THRESHOLD,
    Walk: d.amount < RUN_THRESHOLD,
    KeyZ: d.y > PRONE_DOWN && d.amount >= RUN_THRESHOLD,
});

/** Unit vector the aim stick points along, or null while it is near the centre. */
export const aimDirection = (d: Deflection): Vector2 | null =>
    d.amount < AIM_DEAD_ZONE ? null : { x: d.x / d.amount, y: d.y / d.amount };

export const isFiring = (d: Deflection) => d.amount >= FIRE_THRESHOLD;

/**
 * Turns the shown aim from `current` towards `target` a share of the way per frame, so the aim
 * glides after the thumb instead of jumping with every twitch. Both are unit vectors.
 */
export const smoothAim = (current: Vector2 | null, target: Vector2, dtMs: number): Vector2 => {
    if (!current) return target;
    const from = Math.atan2(current.y, current.x);
    let turn = Math.atan2(target.y, target.x) - from;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn)); // shortest way round
    const angle = from + turn * (1 - Math.exp(-Math.max(0, dtMs) / AIM_SMOOTHING_MS));
    return { x: Math.cos(angle), y: Math.sin(angle) };
};

export const aimPoint = (from: Vector2, direction: Vector2, reach = AIM_REACH): Vector2 => ({
    x: from.x + direction.x * reach,
    y: from.y + direction.y * reach,
});

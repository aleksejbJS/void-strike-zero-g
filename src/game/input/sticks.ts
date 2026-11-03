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

export const STICK_RADIUS = 50;   // px the thumb travels to reach the rim
const MOVE_THRESHOLD = 0.4;       // share of the radius before a move key is pressed
const AIM_DEAD_ZONE = 0.15;       // below this the aim keeps its last direction
const FIRE_THRESHOLD = 0.35;      // pushed this far the weapon fires
export const AIM_REACH = 300;     // world units from the fighter to the aim point

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
});

/** Unit vector the aim stick points along, or null while it is near the centre. */
export const aimDirection = (d: Deflection): Vector2 | null =>
    d.amount < AIM_DEAD_ZONE ? null : { x: d.x / d.amount, y: d.y / d.amount };

export const isFiring = (d: Deflection) => d.amount >= FIRE_THRESHOLD;

export const aimPoint = (from: Vector2, direction: Vector2, reach = AIM_REACH): Vector2 => ({
    x: from.x + direction.x * reach,
    y: from.y + direction.y * reach,
});

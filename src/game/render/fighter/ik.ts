// Two-bone inverse kinematics for limbs: where the elbow/knee goes so the hand/foot reaches a target.

import { Vector2 } from '../../../types';

export interface Limb {
    joint: Vector2; // elbow or knee
    end: Vector2;   // hand or ankle (equals the target when it is within reach)
}

/**
 * Solve a limb from `root` towards `target` with segment lengths `upper` and `lower`.
 * Of the two possible bends, the one `prefer` scores higher wins (e.g. knee forward, elbow down).
 */
export const solveLimb = (root: Vector2, target: Vector2, upper: number, lower: number, prefer: (joint: Vector2) => number): Limb => {
    const dx = target.x - root.x;
    const dy = target.y - root.y;
    const reach = Math.min(Math.max(Math.hypot(dx, dy), 0.01), upper + lower - 0.01);
    const base = Math.atan2(dy, dx);
    const cos = (upper * upper + reach * reach - lower * lower) / (2 * upper * reach);
    const bend = Math.acos(Math.min(1, Math.max(-1, cos)));

    const a = { x: root.x + Math.cos(base + bend) * upper, y: root.y + Math.sin(base + bend) * upper };
    const b = { x: root.x + Math.cos(base - bend) * upper, y: root.y + Math.sin(base - bend) * upper };
    const joint = prefer(a) >= prefer(b) ? a : b;

    const toTarget = Math.atan2(target.y - joint.y, target.x - joint.x);
    return { joint, end: { x: joint.x + Math.cos(toTarget) * lower, y: joint.y + Math.sin(toTarget) * lower } };
};

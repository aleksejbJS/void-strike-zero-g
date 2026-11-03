// Standing, crouching or lying down (spec 2026-11-03-prone): the hitbox height, where the weapon
// fires from, and the forward-only aim while lying. Shared by the simulation and client prediction.

import { Entity, Vector2 } from '../../types';

export const STANDING_HEIGHT = 72;
export const CROUCH_HEIGHT = 45;
export const PRONE_HEIGHT = 26;
const PRONE_AIM_LIMIT = Math.PI / 6; // lying, the weapon points at most 30° up or down

/** Lying wins over crouching; neither while jumping (readControls already drops it). */
export const applyStance = (p: Entity, controls: { wantsDown: boolean; wantsProne: boolean }) => {
    p.isProne = controls.wantsProne;
    p.isCrouching = !controls.wantsProne && controls.wantsDown;
    p.height = p.isProne ? PRONE_HEIGHT : p.isCrouching ? CROUCH_HEIGHT : STANDING_HEIGHT;
};

/** Height above the feet the shots leave from. */
export const muzzleHeight = (p: Pick<Entity, 'isCrouching' | 'isProne'>) => (p.isProne ? 12 : p.isCrouching ? 35 : 50);

/** An aim angle (0 = right, positive = down) kept within ±30° of level on the side it points to. */
export const clampProneAngle = (angle: number): number => {
    const left = Math.abs(angle) > Math.PI / 2;
    const level = left ? Math.atan2(Math.sin(angle), -Math.cos(angle)) : angle; // mirrored to face right
    const clamped = Math.max(-PRONE_AIM_LIMIT, Math.min(PRONE_AIM_LIMIT, level));
    const out = left ? Math.PI - clamped : clamped;
    return Math.atan2(Math.sin(out), Math.cos(out)); // back into -π..π like atan2
};

/** Lying down the fighter only shoots forward: the aim is turned into ±30° on the side it points to. */
export const clampProneAim = (p: Entity, aim: Vector2): Vector2 => {
    if (!p.isProne) return aim;
    const origin = { x: p.pos.x, y: p.pos.y - muzzleHeight(p) };
    const angle = clampProneAngle(Math.atan2(aim.y - origin.y, aim.x - origin.x));
    const reach = Math.hypot(aim.x - origin.x, aim.y - origin.y) || 1;
    return { x: origin.x + Math.cos(angle) * reach, y: origin.y + Math.sin(angle) * reach };
};

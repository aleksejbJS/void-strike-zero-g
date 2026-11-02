// Proportions of the fighter drawing, shared by the living fighter, the ragdoll and the extents check.

export const LIMB_W = 1.35;   // multiplies every limb width
export const HEAD_R = 8.6;    // head radius in rig units (the old head was 7)
export const HEAD_K = HEAD_R / 7;   // scale for the parts drawn around the old 7-unit head
export const ROBOT_HEAD_K = 1.23;   // the robot head is a box scaled by this
export const TORSO_W = 1.25;  // multiplies the x of every torso point
export const BOOT = { w: 10, h: 5, heel: 3.5 };   // heel: how far the boot reaches behind the ankle

/** The collision box in screen px (pos.x is the centre, the feet are at the bottom edge). */
export const HITBOX = { halfW: 15, standing: 72, crouched: 45, margin: 6 };

// How each weapon sits in the hands: held length and where the hands and barrel are on its picture.
// Points are fractions of the trimmed weapon images in public/assets/hud/.

import { WeaponType } from '../../../types';

export interface WeaponGrip {
    length: number;            // held length in rig units
    grip: [number, number];    // rear hand (pistol grip / handle)
    fore: [number, number];    // front hand (foregrip / barrel shroud)
    axis: number;              // barrel height, as a fraction of the image height
}

export const WEAPON_GRIPS: Record<WeaponType, WeaponGrip> = {
    [WeaponType.MACHINE_GUN]: { length: 46, grip: [0.26, 0.73], fore: [0.58, 0.49], axis: 0.36 },
    [WeaponType.SHOTGUN]: { length: 42, grip: [0.26, 0.7], fore: [0.68, 0.5], axis: 0.38 },
    [WeaponType.ROCKET_LAUNCHER]: { length: 50, grip: [0.33, 0.8], fore: [0.5, 0.72], axis: 0.32 },
    [WeaponType.RAILGUN]: { length: 50, grip: [0.29, 0.74], fore: [0.55, 0.52], axis: 0.45 },
    [WeaponType.GRENADE_LAUNCHER]: { length: 44, grip: [0.22, 0.62], fore: [0.62, 0.48], axis: 0.34 },
    [WeaponType.SMOKE_LAUNCHER]: { length: 44, grip: [0.22, 0.62], fore: [0.62, 0.48], axis: 0.34 }, // same pose as the grenade launcher
    [WeaponType.PLASMA_GUN]: { length: 46, grip: [0.31, 0.75], fore: [0.62, 0.55], axis: 0.45 },
    [WeaponType.CHAINSAW]: { length: 46, grip: [0.1, 0.5], fore: [0.24, 0.14], axis: 0.5 },
};

/** Hand and barrel points in weapon space (origin = top-left of the picture, x along the barrel). */
export const gripPoints = (type: WeaponType, aspect: number) => {
    const g = WEAPON_GRIPS[type] ?? WEAPON_GRIPS[WeaponType.MACHINE_GUN];
    const h = g.length * aspect;
    return {
        length: g.length,
        height: h,
        grip: { x: g.grip[0] * g.length, y: g.grip[1] * h },
        fore: { x: g.fore[0] * g.length, y: g.fore[1] * h },
        axisY: g.axis * h,
    };
};

export type GripPoints = ReturnType<typeof gripPoints>;

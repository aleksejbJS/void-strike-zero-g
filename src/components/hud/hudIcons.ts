// HUD icons: trimmed copies of the item sprites (public/assets/hud) so every icon
// fills its slot the same way. Map pickups keep using the originals.

import { WeaponType } from '../../types';

export const WEAPON_ICON: Record<WeaponType, string> = {
    [WeaponType.MACHINE_GUN]: '/assets/hud/machine_gun.png',
    [WeaponType.SHOTGUN]: '/assets/hud/shotgun.png',
    [WeaponType.ROCKET_LAUNCHER]: '/assets/hud/rocket_launcher.png',
    [WeaponType.GRENADE_LAUNCHER]: '/assets/hud/grenade_launcher.png',
    [WeaponType.PLASMA_GUN]: '/assets/hud/plasma_gun.png',
    [WeaponType.RAILGUN]: '/assets/hud/railgun.png',
    [WeaponType.CHAINSAW]: '/assets/hud/chainsaw.png',
};

export const ITEM_ICON = {
    health: '/assets/hud/health.png',
    armor: '/assets/hud/armor.png',
    fuel: '/assets/hud/fuel.png',
};

/** Shared panel look for HUD boxes */
export const PANEL = 'rounded bg-bay-ink/90 text-bay-chalk';

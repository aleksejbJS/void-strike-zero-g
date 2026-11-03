// HUD icons: trimmed copies of the item sprites (public/assets/hud) so every icon
// fills its slot the same way. Map pickups keep using the originals.

import { WeaponType } from '../../types';
import { assetUrl } from '../../assetUrl';

export const WEAPON_ICON: Record<WeaponType, string> = {
    [WeaponType.MACHINE_GUN]: assetUrl('assets/hud/machine_gun.png'),
    [WeaponType.SHOTGUN]: assetUrl('assets/hud/shotgun.png'),
    [WeaponType.ROCKET_LAUNCHER]: assetUrl('assets/hud/rocket_launcher.png'),
    [WeaponType.GRENADE_LAUNCHER]: assetUrl('assets/hud/grenade_launcher.png'),
    [WeaponType.SMOKE_LAUNCHER]: assetUrl('assets/hud/smoke_launcher.svg'),
    [WeaponType.PLASMA_GUN]: assetUrl('assets/hud/plasma_gun.png'),
    [WeaponType.RAILGUN]: assetUrl('assets/hud/railgun.png'),
    [WeaponType.CHAINSAW]: assetUrl('assets/hud/chainsaw.png'),
};

export const ITEM_ICON = {
    health: assetUrl('assets/hud/health.png'),
    armor: assetUrl('assets/hud/armor.png'),
    fuel: assetUrl('assets/hud/fuel.png'),
};

/** Shared panel look for HUD boxes */
export const PANEL = 'rounded bg-bay-ink/90 text-bay-chalk';

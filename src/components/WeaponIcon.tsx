import React from 'react';
import { WeaponType } from '../types';

interface WeaponIconProps {
    weaponType: WeaponType;
    size?: number;
}

const ICON_PATHS: Record<WeaponType, string> = {
    [WeaponType.MACHINE_GUN]: '/assets/items/machinegun.png',
    [WeaponType.SHOTGUN]: '/assets/items/shotgun.png',
    [WeaponType.ROCKET_LAUNCHER]: '/assets/items/rocketlunch.png',
    [WeaponType.RAILGUN]: '/assets/items/railgun.png',
    [WeaponType.PLASMA_GUN]: '/assets/items/plasma_gun.png',
    [WeaponType.GRENADE_LAUNCHER]: '/assets/items/granat.png',
    [WeaponType.CHAINSAW]: '/assets/items/chainsaw.png',
};

export const WeaponIcon: React.FC<WeaponIconProps> = ({ weaponType, size = 40 }) => {
    const src = ICON_PATHS[weaponType];
    return (
        <div className="flex items-center justify-center">
            <img
                src={src}
                width={size}
                height={size}
                style={{ objectFit: 'contain' }}
                alt={weaponType.toLowerCase().replace('_', ' ')}
                loading="lazy"
            />
        </div>
    );
};

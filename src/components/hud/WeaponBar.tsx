// Bottom HUD: six weapon slots with their pictures, plus the ammo box on the right.

import React from 'react';
import { Weapon, WeaponType } from '../../types';
import { PANEL, WEAPON_ICON } from './hudIcons';
import type { Translate } from '../menu/types';
import { weaponLabel } from './weaponLabel';

const SLOTS = 6;
// Ammo pools this large are effectively unlimited
const UNLIMITED_AMMO = 1000;

export const WeaponBar: React.FC<{ inventory: Weapon[]; active: WeaponType | null }> = ({ inventory, active }) => (
    <div className="pointer-events-none absolute bottom-8 left-1/2 z-40 flex -translate-x-1/2 gap-1.5">
        {Array.from({ length: SLOTS }, (_, i) => {
            const weapon = inventory[i];
            if (!weapon) {
                return (
                    <div key={i} className="relative h-[72px] w-24 rounded border-2 border-dashed border-bay-plate">
                        <span className="absolute left-2 top-1 text-xs font-semibold text-[#8A9099]">{i + 1}</span>
                    </div>
                );
            }
            const on = weapon.type === active;
            return (
                <div key={i} className={`relative flex h-[72px] w-24 items-center justify-center rounded ${on ? 'bg-bay-hazard' : 'bg-bay-ink/90'}`}>
                    <span className={`absolute left-2 top-1 text-xs font-semibold ${on ? 'text-bay-ink' : 'text-bay-dust'}`}>{i + 1}</span>
                    <img src={WEAPON_ICON[weapon.type]} alt={weapon.name} className="mt-2 h-10 w-[74px] object-contain" />
                </div>
            );
        })}
    </div>
);

export const AmmoPanel: React.FC<{ t: Translate; weapon: Weapon | undefined; ammo: number }> = ({ t, weapon, ammo }) => {
    if (!weapon) return null;
    const unlimited = weapon.maxAmmo > UNLIMITED_AMMO;
    return (
        <div className={`${PANEL} pointer-events-none absolute bottom-8 right-8 z-40 flex flex-col items-end px-[18px] py-3.5`}>
            <img src={WEAPON_ICON[weapon.type]} alt="" className="mb-1 h-14 w-[120px] object-contain" />
            <div className="flex items-baseline gap-1.5">
                <span className="font-display text-[64px] font-black leading-[0.85] text-bay-hazard">{unlimited ? '∞' : ammo}</span>
                {!unlimited && <span className="text-lg font-semibold text-bay-dust">/ {weapon.maxAmmo}</span>}
            </div>
            <span className="text-[15px] font-semibold">{weaponLabel(t, weapon.name)}</span>
        </div>
    );
};

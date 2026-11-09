// Bottom HUD: the weapon slots with their pictures (six, more when the inventory holds more, up to nine), plus the ammo box on the right.

import React from 'react';
import { Weapon, WeaponType } from '../../types';
import { PANEL, WEAPON_ICON } from './hudIcons';
import type { Translate } from '../menu/types';
import { weaponLabel } from './weaponLabel';
import { MAX_WEAPON_SLOTS } from './weaponSlots';

const SLOTS = 6;
/** Past this many slots each one narrows, so nine take the width of seven and stay clear of the side panels. */
const WIDE_SLOTS = 7;
// Ammo pools this large are effectively unlimited
export const UNLIMITED_AMMO = 1000;

export const WeaponBar: React.FC<{ inventory: Weapon[]; active: WeaponType | null }> = ({ inventory, active }) => {
    const count = Math.min(MAX_WEAPON_SLOTS, Math.max(SLOTS, inventory.length));
    const [slotW, iconW] = count > WIDE_SLOTS ? ['w-[72px]', 'w-[58px]'] : ['w-24', 'w-[74px]'];
    return (
        <div className="pointer-events-none absolute bottom-8 left-1/2 z-40 flex -translate-x-1/2 gap-1.5">
            {Array.from({ length: count }, (_, i) => {
                const weapon = inventory[i];
                if (!weapon) {
                    return (
                        <div key={i} className={`relative h-[72px] ${slotW} rounded border-2 border-dashed border-bay-plate`}>
                            <span className="absolute left-2 top-1 text-xs font-semibold text-[#8A9099]">{i + 1}</span>
                        </div>
                    );
                }
                const on = weapon.type === active;
                return (
                    <div key={i} className={`relative flex h-[72px] ${slotW} items-center justify-center rounded ${on ? 'bg-bay-hazard' : 'bg-bay-ink/90'}`}>
                        <span className={`absolute left-2 top-1 text-xs font-semibold ${on ? 'text-bay-ink' : 'text-bay-dust'}`}>{i + 1}</span>
                        <img src={WEAPON_ICON[weapon.type]} alt={weapon.name} className={`mt-2 h-10 ${iconW} object-contain`} />
                    </div>
                );
            })}
        </div>
    );
};

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

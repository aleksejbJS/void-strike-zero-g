// Phone weapon row above the aim stick: only the weapons you carry, tap one to switch.
// The selected one has a yellow frame and its ammo.

import React from 'react';
import { Weapon, WeaponType } from '../../../types';
import { WEAPON_ICON } from '../hudIcons';
import { UNLIMITED_AMMO } from '../WeaponBar';
import { weaponLabel } from '../weaponLabel';
import type { Translate } from '../../menu/types';

interface Props {
    t: Translate;
    inventory: Weapon[];
    active: WeaponType | null;
    ammo: number;
    onSelect: (index: number) => void;
}

export const MobileWeapons: React.FC<Props> = ({ t, inventory, active, ammo, onSelect }) => (
    <div className="absolute bottom-[122px] right-[22px] z-40 flex flex-row-reverse items-center gap-0.5">
        {inventory.map((weapon, index) => {
            const on = weapon.type === active;
            const label = weaponLabel(t, weapon.name);
            if (!on) {
                return (
                    <button key={weapon.type} type="button" aria-label={label} onClick={() => onSelect(index)}
                        className="flex h-[30px] w-10 items-center justify-center opacity-60">
                        <img src={WEAPON_ICON[weapon.type]} alt="" className="h-3.5 w-8 object-contain" />
                    </button>
                );
            }
            const unlimited = weapon.maxAmmo > UNLIMITED_AMMO;
            return (
                <button key={weapon.type} type="button" aria-label={label} aria-pressed="true" onClick={() => onSelect(index)}
                    className="flex h-[30px] items-center gap-1 rounded-sm border border-bay-hazard/75 bg-bay-deep/45 px-1.5 text-bay-hazard">
                    <img src={WEAPON_ICON[weapon.type]} alt="" className="h-4 w-9 object-contain" />
                    <span className="font-display text-[15px] font-black leading-none [text-shadow:0_1px_2px_rgba(0,0,0,0.95)]">{unlimited ? '∞' : ammo}</span>
                </button>
            );
        })}
    </div>
);

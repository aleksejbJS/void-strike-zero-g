// Every weapon can sit in a slot the player can see and pick: keys 1–9 and up to nine slots on the bar.

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WeaponType } from '../../types';
import { WEAPONS_DATA } from '../../constants';
import { WeaponBar } from './WeaponBar';
import { MAX_WEAPON_SLOTS, weaponSlotOfKey } from './weaponSlots';

describe('weaponSlotOfKey', () => {
    it('keys 1 to 9 pick slots 0 to 8', () => {
        expect(['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(weaponSlotOfKey)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it('any other key picks none', () => {
        for (const key of ['0', 'a', 'F3', 'Escape', '10', ' ', '']) expect(weaponSlotOfKey(key)).toBeNull();
    });
});

describe('WeaponBar with every weapon', () => {
    it('shows nine slots, the eighth and ninth with their keys', () => {
        const inventory = Object.values(WeaponType).map(type => WEAPONS_DATA[type]);
        expect(inventory).toHaveLength(MAX_WEAPON_SLOTS);
        const { container } = render(<WeaponBar inventory={inventory} active={WeaponType.FLAMETHROWER} />);
        expect(container.firstElementChild!.children.length).toBe(9);
        expect(screen.getByText('8')).toBeInTheDocument();
        expect(screen.getByText('9')).toBeInTheDocument();
    });

    it('narrows the slots past seven, so nine fit between the side panels at 1512 px (as wide as seven)', () => {
        const nine = render(<WeaponBar inventory={Object.values(WeaponType).map(type => WEAPONS_DATA[type])} active={null} />);
        for (const slot of Array.from(nine.container.firstElementChild!.children)) expect(slot.className).toContain('w-[72px]');
        nine.unmount();
        const six = render(<WeaponBar inventory={[WEAPONS_DATA[WeaponType.MACHINE_GUN]]} active={null} />);
        for (const slot of Array.from(six.container.firstElementChild!.children)) expect(slot.className).toContain('w-24');
    });
});

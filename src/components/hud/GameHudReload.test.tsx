import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameHud, GameHudProps } from './GameHud';
import { base } from './hudTestKit';

const phone = (): NonNullable<GameHudProps['mobile']> => ({
    sticks: { move: null, aim: null }, hookDown: false, onHook: vi.fn(), onSelectWeapon: vi.fn(),
});

const bar = () => screen.queryByRole('progressbar', { name: 'Reloading' });

describe.each([
    ['desktop', null],
    ['phone', phone()],
])('GameHud Machine Gun magazine on %s', (_name, mobile) => {
    const hud = (ammo: number, reload?: number) => <GameHud {...base({ mobile, stats: { ...base().stats, ammo, reload } })} />;

    it('shows the rounds left in the magazine and no reload bar', () => {
        render(hud(37));
        expect(screen.getByText('37')).toBeInTheDocument();
        expect(bar()).not.toBeInTheDocument();
    });

    it('swaps the count for a filling bar while reloading, and back once full', () => {
        const { rerender } = render(hud(0, 0.4));
        expect(bar()).toHaveAttribute('aria-valuenow', '40');
        expect(screen.queryByText('0')).not.toBeInTheDocument();
        rerender(hud(50));
        expect(bar()).not.toBeInTheDocument();
        expect(screen.getByText('50')).toBeInTheDocument();
    });
});

describe('GameHud desktop magazine size', () => {
    it('shows the magazine size next to the count', () => {
        render(<GameHud {...base({ stats: { ...base().stats, ammo: 37 } })} />);
        expect(screen.getByText('/ 50')).toBeInTheDocument();
        expect(screen.queryByText('Reloading')).not.toBeInTheDocument();
    });
});

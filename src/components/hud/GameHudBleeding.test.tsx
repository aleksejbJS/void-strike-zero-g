import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameHud, GameHudProps } from './GameHud';
import { base } from './hudTestKit';

const phone = (): NonNullable<GameHudProps['mobile']> => ({
    sticks: { move: null, aim: null }, hookDown: false, onHook: vi.fn(), onSelectWeapon: vi.fn(),
});

// The drop is an image named after the hud.bleeding label
const drop = () => screen.queryByRole('img', { name: 'Bleeding' });

describe.each([
    ['desktop', null],
    ['phone', phone()],
])('GameHud bleeding drop on %s', (_name, mobile) => {
    const hud = (bleeding?: boolean) => <GameHud {...base({ mobile, stats: { ...base().stats, bleeding } })} />;

    it('is absent when the flag is missing or false', () => {
        const { rerender } = render(hud());
        expect(drop()).not.toBeInTheDocument();
        rerender(hud(false));
        expect(drop()).not.toBeInTheDocument();
    });

    it('shows while bleeding and goes away when it stops', () => {
        const { rerender } = render(hud(true));
        expect(drop()).toBeInTheDocument();
        rerender(hud(false));
        expect(drop()).not.toBeInTheDocument();
    });
});

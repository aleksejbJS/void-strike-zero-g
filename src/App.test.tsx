import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';
import { SKINS } from './constants';
import { AccountContext } from './account/useAccount';
import { UIProvider } from './store/uiStore';
import { stubAccount } from './test/accountStub';

// Pixi needs WebGL, which jsdom lacks
vi.mock('./components/GameCanvas', () => ({ default: () => <div /> }));
vi.mock('./components/setup/CharacterPreview', () => ({ CharacterPreview: () => <div /> }));
vi.mock('./components/setup/builder/usePartThumbnails', () => ({ usePartThumbnails: () => ({}) }));

const renderApp = (account = stubAccount({ status: 'guest' })) => render(
    <UIProvider><AccountContext.Provider value={account}><App /></AccountContext.Provider></UIProvider>,
);

const playButton = () => screen.getByRole('button', { name: /Play vs bots/, hidden: true });
// jsdom has no Tailwind, so a screen hidden underneath still answers role queries: tell it by its wrapper class
const hidden = (element: HTMLElement) => element.closest('.hidden') !== null;
const clickBack = () => {
    const visible = screen.getAllByRole('button', { name: 'Back' }).filter(button => !hidden(button));
    expect(visible).toHaveLength(1);
    fireEvent.click(visible[0]);
};

beforeEach(() => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
});

describe('App profile navigation', () => {
    it('opens the profile from the menu button and Back returns to the menu', () => {
        renderApp();
        fireEvent.click(screen.getByRole('button', { name: 'Profile' }));
        expect(screen.getByRole('heading', { level: 1, name: 'Anonymous' })).toBeInTheDocument();
        expect(hidden(playButton())).toBe(true);

        clickBack();
        expect(screen.queryByRole('list', { name: 'Achievements' })).not.toBeInTheDocument();
        expect(hidden(playButton())).toBe(false);
    });

    it('opens the profile from the setup screen and Back returns to that screen with its unsaved look', () => {
        renderApp(stubAccount({ status: 'loggedIn', nickname: 'Alex' }));
        fireEvent.click(playButton());
        fireEvent.click(screen.getByRole('button', { name: 'Next preset' }));
        expect(screen.getByText(SKINS[1].name)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Profile →' }));
        expect(screen.getByRole('list', { name: 'Achievements' })).toBeInTheDocument();
        clickBack();

        expect(screen.queryByRole('list', { name: 'Achievements' })).not.toBeInTheDocument();
        expect(hidden(screen.getByText(SKINS[1].name))).toBe(false);
        expect(screen.queryByRole('button', { name: /Play vs bots/, hidden: true })).not.toBeInTheDocument(); // on setup, not the menu
    });
});

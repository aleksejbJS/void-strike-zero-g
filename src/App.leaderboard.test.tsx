import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import App from './App';
import { AccountContext } from './account/useAccount';
import { UIProvider } from './store/uiStore';
import { stubAccount } from './test/accountStub';
import { fetchBoard } from './leaderboard/leaderboardApi';

// Pixi needs WebGL, which jsdom lacks
vi.mock('./components/GameCanvas', () => ({ default: () => <div /> }));
vi.mock('./leaderboard/leaderboardApi', async importOriginal => ({
    ...(await importOriginal<typeof import('./leaderboard/leaderboardApi')>()),
    fetchBoard: vi.fn(),
}));

const playButton = () => screen.getByRole('button', { name: /Play vs bots/, hidden: true });
// jsdom has no Tailwind, so a screen hidden underneath still answers role queries: tell it by its wrapper class
const hidden = (element: HTMLElement) => element.closest('.hidden') !== null;

const openTop = async () => {
    render(<UIProvider><AccountContext.Provider value={stubAccount({ status: 'guest' })}><App /></AccountContext.Provider></UIProvider>);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Top' })); });
};

beforeEach(() => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
    vi.mocked(fetchBoard).mockResolvedValue({ top: [{ rank: 1, nickname: 'Kosmonavt', value: 10 }], me: null });
});

describe('App Top screen navigation', () => {
    it('opens over the menu and Back returns to it', async () => {
        await openTop();
        expect(screen.getByRole('heading', { level: 1, name: 'Top players' })).toBeInTheDocument();
        expect(hidden(playButton())).toBe(true);

        fireEvent.click(screen.getByRole('button', { name: '← Menu' }));
        expect(screen.queryByRole('heading', { level: 1, name: 'Top players' })).not.toBeInTheDocument();
        expect(hidden(playButton())).toBe(false);
    });

    it('Register closes the Top screen and opens the profile, where sign-up lives', async () => {
        await openTop();
        fireEvent.click(screen.getByRole('button', { name: 'Register' }));
        expect(screen.queryByRole('heading', { level: 1, name: 'Top players' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Protect your nickname/ })).toBeInTheDocument();
    });
});

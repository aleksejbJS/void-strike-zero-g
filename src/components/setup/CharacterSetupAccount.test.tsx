import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ALEX, installAccountHarness, snap } from '../../test/accountHarness';
import { clickStart, mountSetup, typeName, ui } from '../../test/setupAccountKit';
import { AccountError } from '../../account/accountError';
import type { AccountApi } from '../../account/accountApi';
import { AccountProvider } from '../../account/AccountProvider';
import { UIProvider } from '../../store/uiStore';
import CharacterSetup from './CharacterSetup';

// Pixi needs WebGL, which jsdom lacks; tile pictures are drawn by Pixi too
vi.mock('./CharacterPreview', () => ({ CharacterPreview: () => <div /> }));
vi.mock('./builder/usePartThumbnails', () => ({ usePartThumbnails: () => ({}) }));

describe('CharacterSetup account area', () => {
    const h = installAccountHarness();
    afterEach(() => { vi.restoreAllMocks(); });

    const dialog = () => screen.getByRole('dialog');
    const fillModal = (nickname: string, password: string) => {
        fireEvent.change(within(dialog()).getByLabelText('Nickname'), { target: { value: nickname } });
        fireEvent.change(within(dialog()).getByLabelText('Password'), { target: { value: password } });
    };

    it('shows a guest both links under the name', async () => {
        await mountSetup(h);
        expect(screen.getByRole('button', { name: /Protect nickname with a password/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
        expect(screen.getByLabelText('Name')).toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('opens the New account tab with the typed name from the protect link', async () => {
        await mountSetup(h);
        typeName('Alex');
        fireEvent.click(screen.getByRole('button', { name: /Protect nickname/ }));
        expect(within(dialog()).getByRole('tab', { name: 'New account' })).toHaveAttribute('aria-selected', 'true');
        expect(within(dialog()).getByLabelText('Nickname')).toHaveValue('Alex');
    });

    it('opens the Log in tab from the Log in link, leaving the default name out', async () => {
        await mountSetup(h);
        fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
        expect(within(dialog()).getByRole('tab', { name: 'Log in' })).toHaveAttribute('aria-selected', 'true');
        expect(within(dialog()).getByLabelText('Nickname')).toHaveValue(''); // "Anonymous" cannot be an account
    });

    it('shows the taken message when the nickname is taken', async () => {
        h.api.signUp.mockRejectedValue(new AccountError('taken'));
        await mountSetup(h);
        typeName('Alex');
        fireEvent.click(screen.getByRole('button', { name: /Protect nickname/ }));
        fillModal('Alex', 'secret1');
        fireEvent.click(within(dialog()).getByRole('button', { name: 'Create' }));
        await h.settle();
        expect(within(dialog()).getByRole('alert')).toHaveTextContent(/nickname is taken/i);
    });

    it('signing up turns the name into a locked plate and starts with the account nickname', async () => {
        h.api.signUp.mockResolvedValue(ALEX);
        const { onContinue } = await mountSetup(h);
        typeName('Zed');
        fireEvent.click(screen.getByRole('button', { name: /Protect nickname/ }));
        fillModal('Alex', 'secret1');
        fireEvent.click(within(dialog()).getByRole('button', { name: 'Create' }));
        await h.settle();

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
        expect(screen.getByText('Alex')).toBeInTheDocument();
        clickStart();
        expect(onContinue).toHaveBeenCalled();
        expect(ui().state.playerName).toBe('Alex');
        expect(h.api.isNicknameTaken).not.toHaveBeenCalled();
    });

    it('starts the editor over from the saved fighter after a login', async () => {
        h.api.logIn.mockResolvedValue(ALEX);
        h.api.fetchSnapshot.mockResolvedValue(snap(300)); // the account has more XP than this device
        await mountSetup(h);
        expect(screen.getByText('Level 1 · 50 XP to the next part')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
        fillModal('Alex', 'secret1');
        fireEvent.click(within(dialog()).getByRole('button', { name: 'Log in' }));
        await h.settle();
        expect(screen.queryByText('Level 1 · 50 XP to the next part')).not.toBeInTheDocument();
        expect(screen.getByText(/^Level \d+ ·/)).toBeInTheDocument();
    });

    describe('logged in', () => {
        const mountLoggedIn = async (onOpenProfile?: () => void) => {
            h.api.currentUser.mockResolvedValue(ALEX);
            return mountSetup(h, h.api as unknown as AccountApi, onOpenProfile);
        };

        it('shows the nickname on a plate, with no input and no account links', async () => {
            await mountLoggedIn();
            expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
            expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
            expect(screen.getByText('Alex')).toBeInTheDocument();
            expect(screen.getByText('account')).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Log in' })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /Protect nickname/ })).not.toBeInTheDocument();
        });

        it('links to the profile when the screen can open it', async () => {
            const onOpenProfile = vi.fn();
            await mountLoggedIn(onOpenProfile);
            fireEvent.click(screen.getByRole('button', { name: 'Profile →' }));
            expect(onOpenProfile).toHaveBeenCalledTimes(1);
        });

        it('hides the profile link without a handler', async () => {
            await mountLoggedIn();
            expect(screen.queryByRole('button', { name: 'Profile →' })).not.toBeInTheDocument();
        });

        it('starts at once under the account nickname, without a taken check', async () => {
            const { onContinue } = await mountLoggedIn();
            clickStart();
            expect(onContinue).toHaveBeenCalledTimes(1); // synchronous, like before accounts
            expect(ui().state.playerName).toBe('Alex');
            expect(h.api.isNicknameTaken).not.toHaveBeenCalled();
        });
    });

    describe('while accounts are unavailable', () => {
        it('looks as before when accounts are disabled', async () => {
            const { onContinue } = await mountSetup(h, null);
            expect(screen.queryByRole('button', { name: 'Log in' })).not.toBeInTheDocument();
            expect(screen.queryByText(/Protect nickname/)).not.toBeInTheDocument();
            typeName('Alex');
            clickStart();
            expect(onContinue).toHaveBeenCalledTimes(1);
            expect(ui().state.playerName).toBe('Alex');
        });

        it('shows nothing new while the account is loading', () => {
            h.api.currentUser.mockReturnValue(new Promise(() => {}));
            render(<UIProvider><AccountProvider api={h.api as unknown as AccountApi}>
                <CharacterSetup onContinue={vi.fn()} onBack={vi.fn()} />
            </AccountProvider></UIProvider>);
            expect(screen.getByLabelText('Name')).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Log in' })).not.toBeInTheDocument();
        });
    });
});
